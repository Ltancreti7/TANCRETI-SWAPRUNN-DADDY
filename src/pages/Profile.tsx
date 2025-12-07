import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, AddressFields, DealerAdmin, AdminRole } from '../lib/supabase';
import { AddressInput } from '../components/ui/AddressInput';
import { formatAddress, parseAddress } from '../lib/addressUtils';
import { getUserAdminRoles } from '../lib/adminInvitations';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';

export function Profile() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    defaultPickupAddress: { street: '', city: '', state: '', zip: '' } as AddressFields,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [adminRoles, setAdminRoles] = useState<DealerAdmin[]>([]);
  const [dealerNames, setDealerNames] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user && role) {
      loadProfileData();
      loadAdminRoles();
    }
  }, [user, role]);

  const loadProfileData = async () => {
    if (!user || !role) return;

    // Authorization check: Verify user is authenticated
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || currentUser.id !== user.id) {
      console.error('[Profile] Authorization failed: User mismatch');
      return;
    }

    let tableName = '';
    if (role === 'dealer') tableName = 'dealers';
    else if (role === 'sales') tableName = 'sales';
    else if (role === 'driver') tableName = 'drivers';

    if (!tableName) return;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[Profile] Error loading profile:', error);
      return;
    }

    // Authorization check: Verify data belongs to current user
    if (data && data.user_id !== user.id) {
      console.error('[Profile] Authorization failed: Profile data does not belong to current user');
      return;
    }

    if (data && data.user_id === user.id) {
      const defaultAddress: AddressFields = {
        street: data.default_pickup_street || '',
        city: data.default_pickup_city || '',
        state: data.default_pickup_state || '',
        zip: data.default_pickup_zip || '',
      };

      if (!defaultAddress.street && data.default_pickup_location) {
        const parsed = parseAddress(data.default_pickup_location);
        defaultAddress.street = parsed.street || '';
        defaultAddress.city = parsed.city || '';
        defaultAddress.state = parsed.state || '';
        defaultAddress.zip = parsed.zip || '';
      }

      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        password: '',
        defaultPickupAddress: defaultAddress,
      });
    }
  };

  const loadAdminRoles = async () => {
    if (!user) return;

    const roles = await getUserAdminRoles(user.id);
    setAdminRoles(roles);

    if (roles.length > 0) {
      const dealerIds = roles.map(r => r.dealer_id);
      const { data: dealers } = await supabase
        .from('dealers')
        .select('id, name')
        .in('id', dealerIds);

      if (dealers) {
        const namesMap: Record<string, string> = {};
        dealers.forEach(dealer => {
          namesMap[dealer.id] = dealer.name;
        });
        setDealerNames(namesMap);
      }
    }
  };

  const getRoleBadgeColor = (role: AdminRole) => {
    switch (role) {
      case "owner":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "viewer":
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !role) return;

    setLoading(true);
    setMessage('');

    try {
      let tableName = '';
      if (role === 'dealer') tableName = 'dealers';
      else if (role === 'sales') tableName = 'sales';
      else if (role === 'driver') tableName = 'drivers';

      if (!tableName) throw new Error('Invalid role');

      const updates: any = {
        name: formData.name,
        phone: formData.phone,
      };

      if (role === 'sales') {
        const formatted = formatAddress(formData.defaultPickupAddress);
        updates.default_pickup_location = formatted || null;
        updates.default_pickup_street = formData.defaultPickupAddress.street || null;
        updates.default_pickup_city = formData.defaultPickupAddress.city || null;
        updates.default_pickup_state = formData.defaultPickupAddress.state || null;
        updates.default_pickup_zip = formData.defaultPickupAddress.zip || null;
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updates)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      if (formData.password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.password,
        });

        if (passwordError) throw passwordError;
      }

      setMessage('Profile updated successfully!');
      setFormData({ ...formData, password: '' });

      if (role === 'sales' && formData.defaultPickupAddress.street) {
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setIsDeleting(true);

    try {
      const { data, error } = await supabase.rpc('delete_user_account');

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete account');
      }

      await supabase.auth.signOut();
      navigate('/');
    } catch (err: any) {
      setMessage(err.message || 'Failed to delete account');
      setShowDeleteModal(false);
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="container mx-auto max-w-md">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-black mb-6 transition"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back
        </button>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">Profile Settings</h1>

          {adminRoles.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Shield className="text-blue-600 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-2">Administrator Access</p>
                  <div className="space-y-2">
                    {adminRoles.map((adminRole) => (
                      <div key={adminRole.id} className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(adminRole.role)}`}>
                          {adminRole.role.charAt(0).toUpperCase() + adminRole.role.slice(1)}
                        </span>
                        <span className="text-sm text-gray-700">
                          {dealerNames[adminRole.dealer_id] || 'Loading...'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className={`p-4 rounded mb-4 ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                disabled
                value={formData.email}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
            </div>

            {role === 'sales' && (
              <div>
                <AddressInput
                  label="Default Pickup Location"
                  value={formData.defaultPickupAddress}
                  onChange={(address) => setFormData({ ...formData, defaultPickupAddress: address })}
                  required={false}
                />
                <p className="text-xs text-gray-500 mt-2">This address will be automatically filled when requesting new deliveries</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">New Password</label>
              <input
                type="password"
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Leave blank to keep current password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank if you don't want to change your password</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                <Trash2 size={16} />
                Delete Account
              </h3>
              <p className="text-xs text-red-700 mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to delete your account? This will permanently remove all your data including deliveries, messages, and profile information. This action cannot be undone."
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
