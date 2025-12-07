import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Package, Clock, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Delivery, Message } from '../lib/supabase';
import { formatTime } from '../lib/dateUtils';
import { Badge } from '../components/ui/Badge';
import { UnreadBadge } from '../components/ui/UnreadBadge';

interface ConversationGroup {
  deliveryId: string;
  delivery: Delivery;
  lastMessage: Message;
  unreadCount: number;
  otherPartyName: string;
}

export function AllConversations() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [conversations, setConversations] = useState<ConversationGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    loadConversations();

    const channel = supabase
      .channel(`all-messages-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    // Cleanup function - ensures channel is always removed
    return () => {
      try {
        if (channel) {
          supabase.removeChannel(channel);
        }
      } catch (error) {
        console.error('[AllConversations] Error removing channel:', error);
      }
    };
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!messages || messages.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const deliveryIds = [...new Set(messages.map(m => m.delivery_id))];

      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .in('id', deliveryIds);

      if (deliveriesError) throw deliveriesError;

      const conversationMap = new Map<string, ConversationGroup>();

      for (const deliveryId of deliveryIds) {
        const deliveryMessages = messages.filter(m => m.delivery_id === deliveryId);
        const lastMessage = deliveryMessages[0];
        const unreadCount = deliveryMessages.filter(
          m => m.recipient_id === user.id && !m.read
        ).length;

        const delivery = deliveries?.find(d => d.id === deliveryId);
        if (!delivery) continue;

        let otherPartyName = 'Unknown';

        if (role === 'driver') {
          const { data: salesData } = await supabase
            .from('sales')
            .select('name')
            .eq('id', delivery.sales_id)
            .maybeSingle();
          otherPartyName = salesData?.name || 'Sales Person';
        } else if (role === 'sales') {
          const { data: driverData } = await supabase
            .from('drivers')
            .select('name')
            .eq('id', delivery.driver_id)
            .maybeSingle();
          otherPartyName = driverData?.name || 'Driver';
        }

        conversationMap.set(deliveryId, {
          deliveryId,
          delivery,
          lastMessage,
          unreadCount,
          otherPartyName,
        });
      }

      const sortedConversations = Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      );

      setConversations(sortedConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (deliveryId: string) => {
    navigate(`/chat/${deliveryId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-md sticky top-16 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="touch-target flex items-center text-gray-600 hover:text-black mb-3 transition"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <MessageCircle size={24} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Conversations</h1>
              <p className="text-sm text-gray-600">
                {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {conversations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Conversations Yet</h2>
            <p className="text-gray-600">
              {role === 'driver'
                ? 'Accept a delivery request to start chatting with the sales team.'
                : 'Assign a driver to a delivery to start a conversation.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <button
                key={conversation.deliveryId}
                onClick={() => handleConversationClick(conversation.deliveryId)}
                className="w-full bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-4 text-left border-2 border-transparent hover:border-red-200"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="bg-gradient-to-br from-red-600 to-red-700 text-white p-2.5 rounded-lg flex-shrink-0">
                      <Package size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {conversation.otherPartyName}
                        </h3>
                        {conversation.unreadCount > 0 && (
                          <UnreadBadge count={conversation.unreadCount} />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        VIN: {conversation.delivery.vin}
                      </p>
                    </div>
                  </div>
                  <Badge status={conversation.delivery.status} />
                </div>

                <div className="flex items-start gap-2 mb-3 text-sm text-gray-600">
                  <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                  <p className="flex-1 truncate">
                    {conversation.delivery.pickup_city || conversation.delivery.pickup}
                    {' → '}
                    {conversation.delivery.dropoff_city || conversation.delivery.dropoff}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-gray-500">Latest Message</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} />
                      {formatTime(conversation.lastMessage.created_at)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-900 line-clamp-2">
                    {conversation.lastMessage.sender_id === user?.id ? 'You: ' : ''}
                    {conversation.lastMessage.content}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
