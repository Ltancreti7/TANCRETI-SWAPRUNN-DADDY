import { useState, useEffect } from 'react';
import { Driver } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver;
  onSave: (updatedDriver: Partial<Driver>) => Promise<void>;
}

export function EditProfileModal({ isOpen, onClose, driver, onSave }: EditProfileModalProps) {
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone);
  const [vehicleType, setVehicleType] = useState(driver.vehicle_type);
  const [radius, setRadius] = useState(driver.radius.toString());
  const [licenseNumber, setLicenseNumber] = useState(driver.license_number || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(driver.name);
      setPhone(driver.phone);
      setVehicleType(driver.vehicle_type);
      setRadius(driver.radius.toString());
      setLicenseNumber(driver.license_number || '');
      setError('');
    }
  }, [isOpen, driver]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const radiusNum = parseInt(radius);
    if (isNaN(radiusNum) || radiusNum < 1 || radiusNum > 500) {
      setError('Radius must be between 1 and 500 miles');
      return;
    }

    if (!name.trim() || !phone.trim() || !vehicleType.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        vehicle_type: vehicleType.trim(),
        radius: radiusNum,
        license_number: licenseNumber.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Input
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Your full name"
        />

        <Input
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="(555) 123-4567"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vehicle Type
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            required
          >
            <option value="">Select vehicle type</option>
            <option value="car">Car</option>
            <option value="truck">Truck</option>
            <option value="trailer">Trailer</option>
            <option value="van">Van</option>
            <option value="suv">SUV</option>
          </select>
        </div>

        <Input
          label="Service Radius (miles)"
          type="number"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          required
          min="1"
          max="500"
          placeholder="50"
        />

        <Input
          label="License Number (Optional)"
          type="text"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          placeholder="DL123456789"
        />

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
