import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageCircle, AlertCircle, RefreshCw, Calendar, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, Delivery, Message, Sales } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { formatMessageDate, formatTime } from '../lib/dateUtils';
import { retryWithBackoff, isNetworkError } from '../lib/retry';
import { ScheduleConfirmationModal } from '../components/sales/ScheduleConfirmationModal';
import { getTimeframeDisplay } from '../lib/deliveryUtils';

type PresenceEntry = {
  typing?: boolean;
  user_id?: string;
};

type PresenceState = Record<string, PresenceEntry[]>;

export function Chat() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<boolean>(false);
  const [retrying, setRetrying] = useState(false);
  const [salesPerson, setSalesPerson] = useState<Sales | null>(null);
  const [driverName, setDriverName] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadDelivery = useCallback(async () => {
    if (!deliveryId) return;
    const { data } = await supabase
      .from('deliveries')
      .select('*, sales:sales!sales_id(*), driver:drivers(name)')
      .eq('id', deliveryId)
      .maybeSingle();

    if (data) {
      setDelivery(data);
      if (data.sales) setSalesPerson(data.sales as unknown as Sales);
      if (data.driver) setDriverName((data.driver as { name: string }).name);
    }
  }, [deliveryId]);

  const loadMessages = useCallback(async () => {
    if (!deliveryId) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data);
  }, [deliveryId]);

  const subscribeToMessages = useCallback(() => {
    if (!deliveryId) {
      return () => {};
    }

    try {
      const channel = supabase
        .channel(`delivery-${deliveryId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `delivery_id=eq.${deliveryId}`,
          },
          (payload) => {
            const newMessage = payload.new as Message;
            setMessages((current) => {
              // Prevent duplicates
              if (current.some(m => m.id === newMessage.id)) {
                return current;
              }
              return [...current, newMessage];
            });
            setConnectionError(false);
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState() as PresenceState;
          const presenceLists = Object.values(state);
          const currentUserId = user?.id;
          const isOtherUserTyping = presenceLists.some((entries) =>
            entries.some((entry) => Boolean(entry.typing) && entry.user_id !== currentUserId)
          );
          setIsTyping(isOtherUserTyping);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionError(false);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionError(true);
            showToast('Connection lost. Messages may not sync in real-time.', 'warning');
          }
        });

      // Cleanup function - ensures channel is always removed
      return () => {
        try {
          if (channel) {
            supabase.removeChannel(channel);
          }
        } catch (error) {
          console.error('Error removing channel:', error);
        }
      };
    } catch (error) {
      console.error('Failed to subscribe to messages:', error);
      setConnectionError(true);
      showToast('Failed to connect to chat. Please refresh the page.', 'error');
      return () => {};
    }
  }, [deliveryId, user?.id, showToast]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!deliveryId) return undefined;

    loadDelivery();
    loadMessages();
    const cleanup = subscribeToMessages();

    if (user?.id) {
      supabase
        .from('messages')
        .update({ read: true })
        .eq('delivery_id', deliveryId)
        .eq('recipient_id', user.id)
        .eq('read', false)
        .then(({ error }) => {
          if (error) {
            console.error('Failed to mark messages as read:', error);
          }
        });
    }

    // Cleanup function - ensures subscription and typing timeout are cleaned up
    return () => {
      if (cleanup) {
        cleanup();
      }
      // Clear typing timeout on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [deliveryId, loadDelivery, loadMessages, subscribeToMessages, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleTyping = useCallback(() => {
    if (!deliveryId || !user?.id) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Use the same channel name as the subscription for presence tracking
    const channel = supabase.channel(`delivery-${deliveryId}`);
    channel.track({ typing: true, user_id: user.id });

    typingTimeoutRef.current = setTimeout(() => {
      channel.track({ typing: false, user_id: user.id });
    }, 2000);
  }, [deliveryId, user?.id]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim() || !user || !delivery) {
      return;
    }

    const messageContent = newMessage.trim();
    setLoading(true);
    setSendError(null);

    try {
      let recipientUserId: string | null = null;

      if (delivery.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('user_id')
          .eq('id', delivery.driver_id)
          .maybeSingle();

        if (driverData?.user_id && user.id !== driverData.user_id) {
          recipientUserId = driverData.user_id;
        }
      }

      if (!recipientUserId && delivery.sales_id) {
        const { data: salesData } = await supabase
          .from('sales')
          .select('user_id')
          .eq('id', delivery.sales_id)
          .maybeSingle();

        if (salesData?.user_id && user.id !== salesData.user_id) {
          recipientUserId = salesData.user_id;
        }
      }

      if (!recipientUserId && delivery.dealer_id) {
        const { data: dealerData } = await supabase
          .from('dealers')
          .select('user_id')
          .eq('id', delivery.dealer_id)
          .maybeSingle();

        if (dealerData?.user_id && user.id !== dealerData.user_id) {
          recipientUserId = dealerData.user_id;
        }
      }

      if (!recipientUserId) {
        throw new Error('No recipient available for this delivery');
      }

      let insertedMessage: Message | null = null;

      await retryWithBackoff(async () => {
        const { data, error } = await supabase.from('messages').insert({
          delivery_id: deliveryId,
          sender_id: user.id,
          recipient_id: recipientUserId,
          content: messageContent,
        }).select().single();

        if (error) {
          throw error;
        }

        insertedMessage = data as Message;
      }, 3, 1000);

      // Optimistically add the message to the UI immediately
      if (insertedMessage) {
        setMessages((current) => {
          // Check if message already exists (from realtime subscription)
          if (current.some(m => m.id === insertedMessage!.id)) {
            return current;
          }
          return [...current, insertedMessage!];
        });
      }

      setNewMessage('');
      setSendError(null);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      const channel = supabase.channel(`delivery-${deliveryId}`);
      channel.track({ typing: false, user_id: user?.id });
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setSendError(errorMessage);

      if (isNetworkError(err)) {
        showToast('Network error. Message not sent. Please check your connection and try again.', 'error');
      } else {
        showToast(`Failed to send message: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!sendError || !newMessage.trim()) return;

    setRetrying(true);
    try {
      await handleSendMessage({ preventDefault: () => {} } as React.FormEvent);
    } finally {
      setRetrying(false);
    }
  };

  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach((message) => {
      const dateKey = formatMessageDate(message.created_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return groups;
  };

  const handleConfirmSchedule = async (date: string, time: string) => {
    if (!deliveryId || !salesPerson) {
      showToast('Missing required information', 'error');
      return;
    }

    try {
      console.log('[ScheduleConfirm] Updating delivery with schedule:', { date, time, deliveryId });

      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          scheduled_date: date,
          scheduled_time: time,
          schedule_confirmed_by: salesPerson.id,
          schedule_confirmed_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', deliveryId);

      if (updateError) {
        console.error('[ScheduleConfirm] Error updating delivery:', updateError);
        throw updateError;
      }

      console.log('[ScheduleConfirm] Delivery updated successfully');

      // Get driver user_id for the message
      let driverUserId: string | null = null;
      if (delivery?.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('user_id')
          .eq('id', delivery.driver_id)
          .single();
        driverUserId = driverData?.user_id || null;
      }

      // Send confirmation message
      const confirmMessage = `Schedule confirmed! Delivery scheduled for ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${time}.`;

      const { error: messageError } = await supabase.from('messages').insert({
        delivery_id: deliveryId,
        sender_id: user!.id,
        recipient_id: driverUserId,
        content: confirmMessage,
      });

      if (messageError) {
        console.error('[ScheduleConfirm] Error sending message:', messageError);
      }

      // Send notification to driver
      if (driverUserId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: driverUserId,
          delivery_id: deliveryId,
          type: 'schedule_confirmed',
          title: 'Schedule Confirmed',
          message: `Delivery schedule confirmed for ${new Date(date).toLocaleDateString()} at ${time}`,
          read: false,
        });

        if (notifError) {
          console.error('[ScheduleConfirm] Error sending notification:', notifError);
        }
      }

      showToast('Schedule confirmed successfully!', 'success');
      setShowScheduleModal(false);

      // Reload delivery to show updated schedule
      await loadDelivery();

    } catch (error) {
      console.error('[ScheduleConfirm] Failed to confirm schedule:', error);
      showToast('Failed to confirm schedule. Please try again.', 'error');
    }
  };

  const canConfirmSchedule = role === 'sales' && (delivery?.status === 'accepted' || delivery?.status === 'assigned') && !delivery?.scheduled_date;

  if (!delivery) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow-md sticky top-16 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <button
            onClick={() => navigate(-1)}
            className="touch-target flex items-center text-gray-600 hover:text-black mb-3 sm:mb-4 transition"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </button>

          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate">VIN: {delivery.vin}</p>
                <p className="text-xs sm:text-sm text-gray-600 break-words">
                  {delivery.pickup} → {delivery.dropoff}
                </p>
                {delivery.required_timeframe && (
                  <p className="text-xs text-gray-500 mt-1">
                    <Calendar size={12} className="inline mr-1" />
                    Required: {getTimeframeDisplay(delivery.required_timeframe, delivery.custom_date)}
                  </p>
                )}
              </div>
              <Badge status={delivery.status} />
            </div>
            {delivery.scheduled_date && delivery.scheduled_time && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3 mb-3">
                <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-green-900">Schedule Confirmed</p>
                  <p className="text-xs text-green-800 break-words">
                    {new Date(delivery.scheduled_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {delivery.scheduled_time}
                  </p>
                </div>
              </div>
            )}
            {canConfirmSchedule && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="touch-target w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 sm:py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Calendar size={18} />
                Confirm Delivery Schedule
              </button>
            )}
            {delivery.notes && (
              <p className="text-sm text-gray-600 mt-2">{delivery.notes}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center text-gray-600 py-12">
              <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm mt-2">Start the conversation!</p>
            </div>
          ) : (
            Object.entries(groupMessagesByDate()).map(([date, dateMessages]) => (
              <div key={date} className="space-y-3">
                <div className="flex justify-center">
                  <span className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                    {date}
                  </span>
                </div>
                {dateMessages.map((message) => {
                  const isSender = message.sender_id === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] sm:max-w-xs md:max-w-md px-4 py-3 rounded-lg shadow-sm ${
                          isSender
                            ? 'bg-red-600 text-white rounded-br-none'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isSender ? 'text-red-100' : 'text-gray-500'
                          }`}
                        >
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg rounded-bl-none shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 sticky bottom-0 safe-bottom">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {connectionError && (
            <div className="max-w-3xl mx-auto mb-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-3">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-yellow-800 font-medium">Connection issues detected</p>
                <p className="text-xs text-yellow-700 mt-1">Messages may not sync in real-time. Try refreshing the page.</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-yellow-600 hover:text-yellow-800 transition"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          )}
          {sendError && (
            <div className="max-w-3xl mx-auto mb-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Failed to send message</p>
                <p className="text-xs text-red-700 mt-1">{sendError}</p>
              </div>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1"
              >
                {retrying ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Retry
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2 max-w-3xl mx-auto">
            <input
              type="text"
              value={newMessage}
              onChange={(event) => {
                setNewMessage(event.target.value);
                setSendError(null);
                handleTyping();
              }}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 px-3 sm:px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent text-base"
            />
            <button
              type="submit"
              disabled={loading || !newMessage.trim()}
              className="touch-target bg-red-600 text-white px-4 sm:px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-400 flex items-center justify-center"
              aria-label="Send message"
            >
              {loading ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </form>
        </div>
      </div>

      <ScheduleConfirmationModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onConfirm={handleConfirmSchedule}
        deliveryVin={delivery.vin}
        driverName={driverName}
        requiredTimeframe={delivery.required_timeframe}
        customDate={delivery.custom_date}
      />
    </div>
  );
}
