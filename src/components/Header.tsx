import { Menu } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../lib/auth';
import { NotificationCenter } from './NotificationCenter';

export function Header() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, role } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setMenuOpen(false);
  };

  const handleLogoClick = () => {
    if (user && role) {
      const dashboardPath = role === 'dealer' ? '/dealer' : role === 'sales' ? '/sales' : '/driver';
      navigate(dashboardPath);
    } else {
      navigate('/');
    }
    setMenuOpen(false);
  };

  return (
    <header className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 sm:py-4 flex justify-between items-center">
        <button onClick={handleLogoClick} className="flex items-center space-x-2 touch-target">
          <img src="/swaprunn-logo-2025.png" alt="SwapRunn" className="h-12 sm:h-16 md:h-20" />
        </button>

        <div className="flex items-center gap-2">
          {user && <NotificationCenter />}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white hover:text-gray-300 transition p-2 touch-target"
            aria-label="Menu"
          >
            <Menu size={28} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div ref={menuRef} className="absolute top-full right-0 bg-neutral-900 text-white shadow-lg w-screen max-w-[280px] sm:w-64 border-t border-neutral-700 animate-slide-in">
          <nav className="flex flex-col">
            {!user ? (
              <>
                <button
                  onClick={() => {
                    navigate('/register-dealer');
                    setMenuOpen(false);
                  }}
                  className="px-6 py-3 hover:bg-neutral-800 active:bg-neutral-700 text-left transition border-b border-neutral-700 touch-target"
                >
                  Register Dealership
                </button>
                <button
                  onClick={() => {
                    navigate('/login?type=sales');
                    setMenuOpen(false);
                  }}
                  className="px-6 py-3 hover:bg-neutral-800 active:bg-neutral-700 text-left transition touch-target"
                >
                  Sales Login
                </button>
                <button
                  onClick={() => {
                    navigate('/login?type=driver');
                    setMenuOpen(false);
                  }}
                  className="px-6 py-3 hover:bg-neutral-800 active:bg-neutral-700 text-left transition touch-target"
                >
                  Driver Login
                </button>
                <button
                  onClick={() => {
                    navigate('/login');
                    setMenuOpen(false);
                  }}
                  className="px-6 py-3 hover:bg-neutral-800 active:bg-neutral-700 text-left transition text-gray-400 text-sm touch-target"
                >
                  Dealership Login
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    navigate(role === 'dealer' ? '/dealer' : role === 'sales' ? '/sales' : '/driver');
                    setMenuOpen(false);
                  }}
                  className="px-6 py-3 hover:bg-neutral-800 active:bg-neutral-700 text-left transition touch-target"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    navigate('/profile');
                    setMenuOpen(false);
                  }}
                  className="px-6 py-3 hover:bg-neutral-800 active:bg-neutral-700 text-left transition touch-target"
                >
                  Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-6 py-3 hover:bg-neutral-800 active:bg-neutral-700 text-left transition text-red-500 touch-target"
                >
                  Sign Out
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
