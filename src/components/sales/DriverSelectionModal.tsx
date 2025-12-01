import { useState, useEffect, useMemo } from 'react';
import { X, Star, TrendingUp, Clock, CheckCircle, Search, Award } from 'lucide-react';
import { supabase, Driver, DriverStatistics, DriverPreference } from '../../lib/supabase';
import { Card } from '../ui/Card';

interface DriverWithDetails extends Driver {
  statistics?: DriverStatistics;
  preference?: DriverPreference;
}

interface DriverSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDriver: (driverId: string) => void;
  dealerId: string;
  currentUserId: string;
  selectedDriverId?: string;
}

export function DriverSelectionModal({
  isOpen,
  onClose,
  onSelectDriver,
  dealerId,
  currentUserId,
  selectedDriverId,
}: DriverSelectionModalProps) {
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'preference' | 'performance' | 'recent' | 'name'>('preference');

  useEffect(() => {
    if (isOpen) {
      loadDrivers();
    }
  }, [isOpen, dealerId, currentUserId]);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const { data: approvedDriverRelationships } = await supabase
        .from('approved_driver_dealers')
        .select(`
          driver:drivers(*)
        `)
        .eq('dealer_id', dealerId);

      if (!approvedDriverRelationships || approvedDriverRelationships.length === 0) {
        setDrivers([]);
        setLoading(false);
        return;
      }

      const driversData = approvedDriverRelationships
        .map((rel: any) => rel.driver as Driver)
        .filter((driver: Driver) => driver && driver.status === 'active' && driver.is_available);

      const driverIds = driversData.map(d => d.id);

      const { data: statisticsData } = await supabase
        .from('driver_statistics')
        .select('*')
        .in('driver_id', driverIds)
        .eq('dealer_id', dealerId);

      const { data: preferencesData } = await supabase
        .from('driver_preferences')
        .select('*')
        .eq('user_id', currentUserId)
        .in('driver_id', driverIds)
        .eq('dealer_id', dealerId);

      const driversWithDetails: DriverWithDetails[] = driversData.map(driver => ({
        ...driver,
        statistics: statisticsData?.find(s => s.driver_id === driver.id),
        preference: preferencesData?.find(p => p.driver_id === driver.id),
      }));

      setDrivers(driversWithDetails);
    } catch (error) {
      console.error('Error loading drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedDrivers = useMemo(() => {
    let filtered = drivers;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(query) ||
        d.vehicle_type.toLowerCase().includes(query)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'preference':
          const prefA = a.preference?.preference_level || 0;
          const prefB = b.preference?.preference_level || 0;
          if (prefA !== prefB) return prefB - prefA;
          const useA = a.preference?.use_count || 0;
          const useB = b.preference?.use_count || 0;
          return useB - useA;

        case 'performance':
          const completedA = a.statistics?.completed_deliveries || 0;
          const completedB = b.statistics?.completed_deliveries || 0;
          if (completedA !== completedB) return completedB - completedA;
          const onTimeA = a.statistics?.on_time_percentage || 0;
          const onTimeB = b.statistics?.on_time_percentage || 0;
          return onTimeB - onTimeA;

        case 'recent':
          const lastUsedA = a.preference?.last_used_at || '1970-01-01';
          const lastUsedB = b.preference?.last_used_at || '1970-01-01';
          return new Date(lastUsedB).getTime() - new Date(lastUsedA).getTime();

        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return sorted;
  }, [drivers, searchQuery, sortBy]);

  const handleSelectDriver = (driverId: string) => {
    onSelectDriver(driverId);
    onClose();
  };

  const renderPreferenceStars = (level?: number) => {
    const stars = level || 0;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={14}
            className={i <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Select Driver</h2>
            <p className="text-sm text-gray-600 mt-1">Choose from available drivers or leave unassigned</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search drivers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
            >
              <option value="preference">My Preferences</option>
              <option value="performance">Top Performers</option>
              <option value="recent">Recently Used</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredAndSortedDrivers.length === 0 ? (
            <div className="text-center py-12">
              <Award size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg font-medium">No drivers available</p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery ? 'Try adjusting your search' : 'Contact your dealership to add drivers'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedDrivers.map((driver) => (
                <Card
                  key={driver.id}
                  hover
                  className={`cursor-pointer transition ${
                    selectedDriverId === driver.id ? 'ring-2 ring-red-600 bg-red-50' : ''
                  }`}
                  onClick={() => handleSelectDriver(driver.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{driver.name}</h3>
                        {driver.preference && driver.preference.preference_level >= 4 && (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-semibold">Favorite</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 mb-3">
                        <span className="px-3 py-1 bg-gray-100 text-xs rounded-full font-medium">
                          {driver.vehicle_type}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-xs rounded-full font-medium">
                          {driver.radius} mi radius
                        </span>
                      </div>

                      {driver.preference && (
                        <div className="flex items-center gap-3 mb-2">
                          {renderPreferenceStars(driver.preference.preference_level)}
                          <span className="text-xs text-gray-600">
                            You've used this driver {driver.preference.use_count} {driver.preference.use_count === 1 ? 'time' : 'times'}
                          </span>
                        </div>
                      )}

                      {driver.statistics && driver.statistics.completed_deliveries > 0 && (
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle size={16} />
                            <span className="font-semibold">{driver.statistics.completed_deliveries}</span>
                            <span className="text-gray-600">deliveries</span>
                          </div>
                          <div className="flex items-center gap-2 text-blue-700">
                            <TrendingUp size={16} />
                            <span className="font-semibold">{driver.statistics.on_time_percentage.toFixed(0)}%</span>
                            <span className="text-gray-600">success rate</span>
                          </div>
                          {driver.statistics.last_delivery_at && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <Clock size={16} />
                              <span className="text-xs">
                                Last: {new Date(driver.statistics.last_delivery_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedDriverId === driver.id && (
                      <div className="ml-4">
                        <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                          <CheckCircle size={20} className="text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSelectDriver('')}
            className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
          >
            Leave Unassigned
          </button>
        </div>
      </div>
    </div>
  );
}