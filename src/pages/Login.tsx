import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { signIn, getUserRole } from '../lib/auth';

const REMEMBER_ME_KEY = 'swaprunn_remember_email';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_ME_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);
  const getLoginTypeFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('type') || 'general';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);

      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      const role = await getUserRole();

      if (role === 'dealer') {
        navigate('/dealer');
      } else if (role === 'sales') {
        navigate('/sales');
      } else if (role === 'driver') {
        navigate('/driver');
      } else {
        setError('Unable to determine your account type. Please contact support.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    const type = getLoginTypeFromURL();
    if (type === 'sales') return 'Sales Login';
    if (type === 'driver') return 'Driver Login';
    return 'Log In';
  };

  const getSubtitle = () => {
    const type = getLoginTypeFromURL();
    if (type === 'sales') return 'Access your dashboard to manage delivery requests';
    if (type === 'driver') return 'Access your dashboard to view and complete deliveries';
    return 'Welcome back to SwapRunn';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-12 px-4 sm:py-20 sm:px-6">
      <div className="container mx-auto max-w-md">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-red-600 mb-8 transition font-medium"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Home
        </button>

        <div className="bg-white rounded-2xl shadow-2xl p-10 border border-gray-100">
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 text-gray-900">{getTitle()}</h1>
            <p className="text-gray-600 text-lg">{getSubtitle()}</p>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-800 px-5 py-4 rounded-xl mb-6 font-medium shadow-sm flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 transition shadow-sm"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm text-red-600 hover:text-red-700 font-semibold"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 transition shadow-sm"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-4 rounded-xl font-bold text-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:bg-gray-400 disabled:transform-none disabled:shadow-none"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div className="mt-10 border-t border-gray-200 pt-8">
            {getLoginTypeFromURL() === 'sales' ? (
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 sm:p-6 md:p-7 border-2 border-gray-200 shadow-sm">
                <div className="flex items-center justify-center mb-4">
                  <UserPlus className="text-red-600 mr-2" size={26} />
                  <h3 className="text-xl font-bold text-gray-900">First Time Signing In?</h3>
                </div>
                <p className="text-sm text-gray-600 text-center mb-4">
                  If your dealership admin has added you to the team roster, complete your first-time setup:
                </p>
                <div className="space-y-3 mb-4">
                  <div className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</span>
                    <p className="text-xs sm:text-sm text-gray-700">
                      <strong>Confirm your dealership admin</strong> has added you to the team roster
                    </p>
                  </div>
                  <div className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</span>
                    <p className="text-xs sm:text-sm text-gray-700">
                      <strong>Complete your first-time setup</strong> by creating your password below
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/signup-sales')}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3.5 rounded-xl font-bold hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center"
                >
                  <UserPlus size={20} className="mr-2" />
                  Complete First-Time Setup
                </button>
              </div>
            ) : getLoginTypeFromURL() === 'driver' ? (
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 sm:p-6 md:p-7 border-2 border-gray-200 shadow-sm">
                <div className="flex items-center justify-center mb-3">
                  <UserPlus className="text-red-600 mr-2" size={24} />
                  <h3 className="text-lg font-semibold text-gray-900">New Driver?</h3>
                </div>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Create your driver account to get started
                </p>
                <button
                  onClick={() => navigate('/signup-driver')}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3.5 rounded-xl font-bold hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center"
                >
                  <UserPlus size={20} className="mr-2" />
                  Sign Up as Driver
                </button>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 sm:p-6 md:p-7 border-2 border-gray-200 shadow-sm">
                <div className="flex items-center justify-center mb-3">
                  <UserPlus className="text-red-600 mr-2" size={24} />
                  <h3 className="text-lg font-semibold text-gray-900">New Dealership?</h3>
                </div>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Register your dealership to start managing deliveries
                </p>
                <button
                  onClick={() => navigate('/register-dealer')}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3.5 rounded-xl font-bold hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center"
                >
                  <UserPlus size={20} className="mr-2" />
                  Register Your Dealership
                </button>
                <p className="text-xs text-gray-500 mt-4 text-center">
                  Sales and drivers: Ask your dealership admin to add you to the roster first
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
