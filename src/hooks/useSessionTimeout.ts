import { useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const TIMEOUT_DURATION = 30 * 60 * 1000;
const WARNING_DURATION = 5 * 60 * 1000;

export function useSessionTimeout(onTimeout: () => void, onWarning?: () => void) {
  const resetTimer = useCallback(() => {
    const now = Date.now();
    localStorage.setItem('lastActivity', now.toString());
  }, []);

  useEffect(() => {
    resetTimer();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    const checkSession = async () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (!lastActivity) return;

      const timeSinceActivity = Date.now() - parseInt(lastActivity);

      if (timeSinceActivity >= TIMEOUT_DURATION) {
        await supabase.auth.signOut();
        onTimeout();
      } else if (onWarning && timeSinceActivity >= TIMEOUT_DURATION - WARNING_DURATION) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          onWarning();
        }
      }
    };

    const interval = setInterval(checkSession, 60000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      clearInterval(interval);
    };
  }, [resetTimer, onTimeout, onWarning]);
}
