import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useUnreadMessagesCount(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const loadUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', userId)
          .eq('read', false);

        if (error) {
          console.error('Error loading unread count:', error);
          setUnreadCount(0);
        } else {
          setUnreadCount(count || 0);
        }
      } catch (error) {
        console.error('Failed to load unread count:', error);
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };

    loadUnreadCount();

    const channel = supabase
      .channel(`unread-all-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          setUnreadCount((current) => current + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { unreadCount, loading };
}
