import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { validatePassword } from '../lib/validation';
import { Input } from '../components/ui/Input';

export function ResetPassword() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);

    if (value.length > 0) {
      const validation = validatePassword(value);
      setPasswordError(validation.isValid ? '' : validation.message);
      setPasswordStrength(validation.strength);
    } else {
      setPasswordError('');
      setPasswordStrength('weak');
    }

    if (confirmPassword.length > 0 && value !== confirmPassword) {
      setConfirmError('Passwords do not match');
    } else {
      setConfirmError('');
    }
  };

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);

    if (value.length > 0 && value !== password) {
      setConfirmError('Passwords do not match');
    } else {
      setConfirmError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.message);
      return;
    }

    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      showToast('Password reset successfully!', 'success');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const strengthColor = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  };

  const strengthWidth = {
    weak: 'w-1/3',
    medium: 'w-2/3',
    strong: 'w-full',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-red-600" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Reset Password</h2>
          <p className="text-gray-600">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              error={passwordError}
              placeholder="Enter new password"
              required
            />
            {password.length > 0 && !passwordError && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Password Strength</span>
                  <span className="capitalize">{passwordStrength}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strengthColor[passwordStrength]} ${strengthWidth[passwordStrength]}`}
                  />
                </div>
              </div>
            )}
          </div>

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={handleConfirmChange}
            error={confirmError}
            placeholder="Confirm new password"
            required
          />

          <button
            type="submit"
            disabled={loading || !!passwordError || !!confirmError || !password || !confirmPassword}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
