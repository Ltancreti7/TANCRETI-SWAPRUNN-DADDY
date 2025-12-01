import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useUnreadMessages(deliveryId: string, userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!deliveryId || !userId) return;

    const loadUnreadCount = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_id', deliveryId)
        .eq('recipient_id', userId)
        .eq('read', false);

      setUnreadCount(count || 0);
    };

    loadUnreadCount();

    const channel = supabase
      .channel(`unread-${deliveryId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload) => {
          const newMessage = payload.new as { recipient_id: string };
          if (newMessage.recipient_id === userId) {
            setUnreadCount((current) => current + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId, userId]);

  return unreadCount;
}
