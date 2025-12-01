import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
} from 'react';

import { User } from '@supabase/supabase-js';
import { supabase, UserRole } from '../lib/supabase';
import { getUserRole } from '../lib/auth';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { checkAndAcceptPendingInvitations } from '../lib/adminInvitations';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const handleTimeout = () => {
    alert('Your session has expired due to inactivity. Please log in again.');
    window.location.href = '/login';
  };

  useSessionTimeout(handleTimeout);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setUser(session?.user ?? null);

        if (session?.user) {
          await processUserLogin(session.user);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error('Error loading session:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);

        if (session?.user) {
          await processUserLogin(session.user);
        } else {
          setRole(null);
        }

        setLoading(false);
      })();
    });

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const processUserLogin = async (user: User) => {
    try {
      if (!user.email) {
        const detectedRole = await getUserRole();
        setRole(detectedRole);
        return;
      }

      const { accepted, errors } = await checkAndAcceptPendingInvitations(
        user.email,
        user.id
      );

      if (accepted.length > 0) {
        console.log(`Accepted ${accepted.length} admin invitation(s).`);
      }

      if (errors.length > 0) {
        console.error('Invitation errors:', errors);
      }

      const detectedRole = await getUserRole();
      setRole(detectedRole);
    } catch (err) {
      console.error('Error processing user login:', err);
      setRole(null);
    }
  };

  const value = useMemo(
    () => ({ user, role, loading }),
    [user, role, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
