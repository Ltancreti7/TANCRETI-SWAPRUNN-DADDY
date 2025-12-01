import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, Sales, Delivery, Driver, AddressFields, DeliveryTimeframe } from '../lib/supabase';
import { EmptyState } from '../components/ui/EmptyState';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { ProfileHeader } from '../components/sales/ProfileHeader';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { DeliveryCard } from '../components/sales/DeliveryCard';
import { DeliveryFilters } from '../components/sales/DeliveryFilters';
import { DriverSelectionModal } from '../components/sales/DriverSelectionModal';
import { AddressInput } from '../components/ui/AddressInput';
import { getVehicleYears, VEHICLE_MAKES, getModelsForMake, TRANSMISSION_TYPES } from '../lib/vehicleData';
import { formatAddress } from '../lib/addressUtils';
import { NotificationService } from '../lib/notificationService';
import { Calendar } from '../components/ui/Calendar';
import { validateVIN } from '../lib/validation';

export function SalesDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [sales, setSales] = useState<Sales | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [newDelivery, setNewDelivery] = useState({
    pickupAddress: { street: '', city: '', state: '', zip: '' } as AddressFields,
    dropoffAddress: { street: '', city: '', state: '', zip: '' } as AddressFields,
    vin: '',
    notes: '',
    driverId: '',
    year: '',
    make: '',
    model: '',
    transmission: '',
    serviceType: 'delivery' as 'delivery' | 'swap',
    hasTrade: false,
    requiresSecondDriver: false,
    requiredTimeframe: '' as DeliveryTimeframe | '',
    customDate: '',
  });
  const [, setIsUsingDefaultLocation] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'pending' | 'accepted' | 'in_progress' | 'completed' | 'all'>('pending');
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [driverMap, setDriverMap] = useState<Map<string, string>>(new Map());
  const [showDriverSelection, setShowDriverSelection] = useState(false);
  const [, setRecentlyAcceptedDeliveries] = useState<Set<string>>(new Set());
  const [deliveryToCancel, setDeliveryToCancel] = useState<string | null>(null);
  const [vinError, setVinError] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadSalesData();
    }
  }, [user]);

  useEffect(() => {
    if (!user || !sales) return undefined;

    const channelName = `sales-deliveries-${sales.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `sales_id=eq.${sales.id}` },
        async (payload) => {
          if (payload.new && payload.old) {
            const newDelivery = payload.new as Delivery;
            const oldDelivery = payload.old as Delivery;

            if (oldDelivery.status === 'pending' && (newDelivery.status === 'accepted' || newDelivery.status === 'assigned') && newDelivery.driver_id) {
              const { data: driverData } = await supabase
                .from('drivers')
                .select('name')
                .eq('id', newDelivery.driver_id)
                .single();

              if (driverData) {
                NotificationService.notifyDeliveryAccepted(driverData.name, newDelivery.vin);
                setRecentlyAcceptedDeliveries(prev => new Set(prev).add(newDelivery.id));
                setTimeout(() => {
                  setRecentlyAcceptedDeliveries(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(newDelivery.id);
                    return newSet;
                  });
                }, 10000);
              }
            }

            if (sales) {
              await loadDeliveries(sales.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[SalesDashboard] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user, sales?.id]);

  const loadSalesData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading sales data:', error);
        showToast(`Failed to load profile: ${error.message}`, 'error');
        setLoading(false);
        return;
      }

      if (salesData) {
        setSales(salesData);
        if (salesData.default_pickup_street || salesData.default_pickup_location) {
          const defaultAddress: AddressFields = {
            street: salesData.default_pickup_street || '',
            city: salesData.default_pickup_city || '',
            state: salesData.default_pickup_state || '',
            zip: salesData.default_pickup_zip || '',
          };

          if (defaultAddress.street || salesData.default_pickup_location) {
            setNewDelivery(prev => ({
              ...prev,
              pickupAddress: defaultAddress.street ? defaultAddress : prev.pickupAddress
            }));
            setIsUsingDefaultLocation(true);
          }
        }
        await Promise.all([
          loadDeliveries(salesData.id),
          loadDrivers(salesData.dealer_id)
        ]);
      } else {
        console.warn('No sales profile found for user:', user.id);
        showToast('Sales profile not found. Please contact your administrator.', 'error');
      }
    } catch (err) {
      console.error('Exception loading sales data:', err);
      showToast('An unexpected error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveries = async (salesId: string) => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('sales_id', salesId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading deliveries:', error);
        showToast('Failed to load deliveries', 'error');
        return;
      }

      if (data) setDeliveries(data);
    } catch (err) {
      console.error('Exception loading deliveries:', err);
    }
  };

  const loadDrivers = async (dealerId: string) => {
    try {
      const { data, error } = await supabase
        .from('approved_driver_dealers')
        .select(`
          driver:drivers(
            id,
            user_id,
            name,
            email,
            phone,
            vehicle_type,
            license_number,
            radius,
            status,
            activated_at,
            available_for_customer_deliveries,
            available_for_dealer_swaps,
            is_available,
            created_at
          )
        `)
        .eq('dealer_id', dealerId)
        .order('approved_at', { ascending: false });

      if (error) {
        console.error('Error loading drivers:', error);
        showToast('Failed to load drivers', 'error');
        return;
      }

      if (data) {
        const approvedDrivers = data
          .map((relationship: any) => relationship.driver as Driver)
          .filter((driver: Driver) => driver && driver.is_available === true);

        setDrivers(approvedDrivers);
        const map = new Map();
        approvedDrivers.forEach(driver => {
          map.set(driver.id, driver.name);
        });
        setDriverMap(map);
      }
    } catch (err) {
      console.error('Exception loading drivers:', err);
    }
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sales) return;

    const vinValidation = validateVIN(newDelivery.vin);
    if (!vinValidation.isValid) {
      setVinError(vinValidation.message);
      showToast('Please enter a valid 17-character VIN', 'error');
      return;
    }

    const pickupFormatted = formatAddress(newDelivery.pickupAddress);
    const dropoffFormatted = formatAddress(newDelivery.dropoffAddress);

    try {
      const { data: createdDeliveries, error } = await supabase
        .from('deliveries')
        .insert({
          dealer_id: sales.dealer_id,
          sales_id: sales.id,
          driver_id: newDelivery.driverId || null,
          pickup: pickupFormatted,
          dropoff: dropoffFormatted,
          pickup_street: newDelivery.pickupAddress.street,
          pickup_city: newDelivery.pickupAddress.city,
          pickup_state: newDelivery.pickupAddress.state,
          pickup_zip: newDelivery.pickupAddress.zip,
          dropoff_street: newDelivery.dropoffAddress.street,
          dropoff_city: newDelivery.dropoffAddress.city,
          dropoff_state: newDelivery.dropoffAddress.state,
          dropoff_zip: newDelivery.dropoffAddress.zip,
          vin: newDelivery.vin,
          notes: newDelivery.notes,
          status: newDelivery.driverId ? 'pending_driver_acceptance' : 'pending',
          year: parseInt(newDelivery.year) || null,
          make: newDelivery.make || null,
          model: newDelivery.model || null,
          transmission: newDelivery.transmission || null,
          service_type: newDelivery.serviceType,
          has_trade: newDelivery.serviceType === 'delivery' ? newDelivery.hasTrade : null,
          requires_second_driver: newDelivery.serviceType === 'delivery' ? newDelivery.requiresSecondDriver : null,
          required_timeframe: newDelivery.requiredTimeframe || null,
          custom_date: newDelivery.requiredTimeframe === 'custom' ? newDelivery.customDate : null,
        })
        .select()
        .limit(1);

      if (error) throw error;

      const createdDelivery = createdDeliveries?.[0];

      // If a specific driver was assigned, notify them directly
      if (newDelivery.driverId) {
        const { data: assignedDriver, error: assignedDriverError } = await supabase
          .from('drivers')
          .select('user_id, name')
          .eq('id', newDelivery.driverId)
          .maybeSingle();

        if (assignedDriverError) {
          console.error('Error fetching assigned driver:', assignedDriverError);
        } else if (assignedDriver?.user_id) {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: assignedDriver.user_id,
              delivery_id: createdDelivery?.id ?? null,
              type: 'delivery_request',
              title: 'New Delivery Request',
              message: `${sales.name} has requested you for a delivery (VIN: ${newDelivery.vin}). Please accept or decline.`,
              read: false,
            });

          if (notificationError) {
            console.error('Error creating assigned driver notification:', notificationError);
          }
        }
      } else {
        // If no specific driver was assigned, notify all available approved drivers
        const { data: approvedDriverRelationships, error: driversError } = await supabase
          .from('approved_driver_dealers')
          .select(`
            driver:drivers(
              user_id,
              is_available
            )
          `)
          .eq('dealer_id', sales.dealer_id);

        if (driversError) throw driversError;

        const notificationsPayload = (approvedDriverRelationships || [])
          .filter((relationship: any) => {
            if (!relationship.driver) return false;
            if (!relationship.driver.user_id) return false;
            return relationship.driver.is_available === true;
          })
          .map((relationship: any) => ({
            user_id: relationship.driver!.user_id!,
            delivery_id: createdDelivery?.id ?? null,
            type: 'new_delivery_available',
            title: 'New Delivery Available',
            message: `A new delivery is available for VIN: ${newDelivery.vin}`,
            read: false,
          }));

        if (notificationsPayload.length > 0) {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert(notificationsPayload);

          if (notificationError) throw notificationError;
        }
      }

      if (saveAsDefault && newDelivery.pickupAddress.street.trim()) {
        const { error: updateError } = await supabase
          .from('sales')
          .update({
            default_pickup_location: pickupFormatted,
            default_pickup_street: newDelivery.pickupAddress.street,
            default_pickup_city: newDelivery.pickupAddress.city,
            default_pickup_state: newDelivery.pickupAddress.state,
            default_pickup_zip: newDelivery.pickupAddress.zip,
          })
          .eq('id', sales.id);

        if (updateError) {
          console.error('Error saving default location:', updateError);
          showToast('Delivery created, but failed to save default address', 'error');
        } else {
          setSales({
            ...sales,
            default_pickup_location: pickupFormatted,
            default_pickup_street: newDelivery.pickupAddress.street,
            default_pickup_city: newDelivery.pickupAddress.city,
            default_pickup_state: newDelivery.pickupAddress.state,
            default_pickup_zip: newDelivery.pickupAddress.zip,
          });
          showToast('Delivery requested and address saved as default!', 'success');
        }
      } else {
        showToast('Delivery requested successfully!', 'success');
      }

      const resetPickupAddress: AddressFields = {
        street: sales?.default_pickup_street || '',
        city: sales?.default_pickup_city || '',
        state: sales?.default_pickup_state || '',
        zip: sales?.default_pickup_zip || '',
      };
      setNewDelivery({
        pickupAddress: resetPickupAddress,
        dropoffAddress: { street: '', city: '', state: '', zip: '' },
        vin: '',
        notes: '',
        driverId: '',
        year: '',
        make: '',
        model: '',
        transmission: '',
        serviceType: 'delivery',
        hasTrade: false,
        requiresSecondDriver: false,
        requiredTimeframe: '',
        customDate: '',
      });
      setIsUsingDefaultLocation(!!(sales?.default_pickup_street || sales?.default_pickup_location));
      setSaveAsDefault(false);
      await loadDeliveries(sales.id);
      setShowNewDelivery(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create delivery';
      showToast(message, 'error');
    }
  };

  const handleCancelDelivery = async (deliveryId: string) => {
    if (!sales) return;

    try {
      const { data: delivery, error: fetchError } = await supabase
        .from('deliveries')
        .select('*, driver:drivers(user_id, name)')
        .eq('id', deliveryId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('deliveries')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', deliveryId);

      if (error) throw error;

      if (delivery?.driver?.user_id) {
        await supabase.from('notifications').insert({
          user_id: delivery.driver.user_id,
          delivery_id: deliveryId,
          type: 'delivery_cancelled',
          title: 'Delivery Cancelled',
          message: `A delivery you accepted (VIN: ${delivery.vin}) has been cancelled by the salesperson.`,
          read: false,
        });
      }

      showToast('Delivery cancelled successfully', 'success');
      await loadDeliveries(sales.id);
      setDeliveryToCancel(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel delivery';
      showToast(message, 'error');
    }
  };

  const filteredDeliveries = useMemo(() => {
    let filtered = activeFilter === 'all'
      ? deliveries
      : deliveries.filter(d => d.status === activeFilter);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.vin.toLowerCase().includes(query) ||
        d.pickup.toLowerCase().includes(query) ||
        d.dropoff.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [deliveries, activeFilter, searchQuery]);

  const filterCounts = useMemo(() => {
    return {
      pending: deliveries.filter(d => d.status === 'pending').length,
      accepted: deliveries.filter(d => d.status === 'accepted').length,
      in_progress: deliveries.filter(d => d.status === 'in_progress').length,
      completed: deliveries.filter(d => d.status === 'completed').length,
    };
  }, [deliveries]);


  if (loading && !sales) {
    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        <div className="bg-white shadow-md sticky top-16 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (!sales) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pb-12">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <EmptyState
              icon={Package}
              title="Complete your profile"
              description="Complete your sales registration to access your dashboard."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="container mx-auto px-4 py-8">
        <ProfileHeader
          sales={sales}
          deliveries={deliveries}
          onFilterChange={(filter) => {
            if (filter === 'all') {
              setActiveFilter('all');
            } else {
              setActiveFilter(filter as 'pending' | 'accepted' | 'in_progress' | 'completed');
            }
            window.scrollTo({ top: document.querySelector('.bg-white.rounded-xl.shadow-sm.border.border-gray-200.p-6')?.getBoundingClientRect().top! + window.scrollY - 100, behavior: 'smooth' });
          }}
        />

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <div className="flex-1">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        Ready to send a vehicle?
      </h3>
      <p className="text-sm text-gray-600">
        Create a new delivery request for your drivers
      </p>
    </div>

    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
      <button
        onClick={() => {
          setShowCalendar(!showCalendar);
          setShowNewDelivery(false);
        }}
        className="w-full md:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
      >
        <CalendarIcon size={18} className="mr-2" />
        {showCalendar ? "Hide Calendar" : "Calendar"}
      </button>

      <button
        onClick={() => {
          setShowNewDelivery(!showNewDelivery);
          setShowCalendar(false);
        }}
        className="w-full md:w-auto bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center shadow-sm"
      >
        <Plus size={20} className="mr-2" />
        Request Delivery
      </button>
    </div>
  </div>
</div>

        {showCalendar && (
          <div className="mb-6">
            <Calendar
              deliveries={deliveries.filter(d => d.scheduled_date && d.scheduled_time)}
              onDeliveryClick={(id) => navigate(`/chat/${id}`)}
            />
          </div>
        )}

        {showNewDelivery && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Request New Delivery</h2>
              <button
                onClick={() => setShowNewDelivery(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="space-y-5">
              <div>
                <AddressInput
                  label="Pickup Location"
                  value={newDelivery.pickupAddress}
                  onChange={(address) => {
                    setNewDelivery({ ...newDelivery, pickupAddress: address });
                    const hasDefault = sales?.default_pickup_street || sales?.default_pickup_location;
                    const matchesDefault = hasDefault && (
                      address.street === sales?.default_pickup_street &&
                      address.city === sales?.default_pickup_city &&
                      address.state === sales?.default_pickup_state &&
                      address.zip === sales?.default_pickup_zip
                    );
                    setIsUsingDefaultLocation(!!matchesDefault);
                  }}
                  required
                />

                <div className="mt-3">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 focus:ring-2 transition cursor-pointer"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-red-600 transition">
                      Save this Address for future requests
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    {sales?.default_pickup_street || sales?.default_pickup_location
                      ? 'This will update your saved default pickup location'
                      : 'This address will be automatically filled for future delivery requests'}
                  </p>
                </div>
                {!(sales?.default_pickup_street || sales?.default_pickup_location) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tip: Save a default pickup location in your{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/profile')}
                      className="text-red-600 hover:text-red-700 font-medium underline"
                    >
                      profile settings
                    </button>
                    {' '}to avoid re-entering it every time
                  </p>
                )}
              </div>

              <div>
                <AddressInput
                  label="Dropoff Location"
                  value={newDelivery.dropoffAddress}
                  onChange={(address) => setNewDelivery({ ...newDelivery, dropoffAddress: address })}
                  required
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Vehicle Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
                    <select
                      required
                      value={newDelivery.year}
                      onChange={(e) => setNewDelivery({ ...newDelivery, year: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow shadow-sm bg-white"
                    >
                      <option value="">Select Year</option>
                      {getVehicleYears().map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Make</label>
                    <select
                      required
                      value={newDelivery.make}
                      onChange={(e) => {
                        setNewDelivery({ ...newDelivery, make: e.target.value, model: '' });
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow shadow-sm bg-white"
                    >
                      <option value="">Select Make</option>
                      {VEHICLE_MAKES.map((make) => (
                        <option key={make} value={make}>
                          {make}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Model</label>
                    <select
                      required
                      value={newDelivery.model}
                      onChange={(e) => setNewDelivery({ ...newDelivery, model: e.target.value })}
                      disabled={!newDelivery.make}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow shadow-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {newDelivery.make ? 'Select Model' : 'Select Make first'}
                      </option>
                      {newDelivery.make &&
                        getModelsForMake(newDelivery.make).map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Transmission</label>
                    <select
                      required
                      value={newDelivery.transmission}
                      onChange={(e) => setNewDelivery({ ...newDelivery, transmission: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow shadow-sm bg-white"
                    >
                      <option value="">Select Transmission</option>
                      {TRANSMISSION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">VIN</label>
                <input
                  type="text"
                  required
                  placeholder="Vehicle Identification Number (17 characters)"
                  maxLength={17}
                  value={newDelivery.vin}
                  onChange={(e) => {
                    const upperVin = e.target.value.toUpperCase();
                    setNewDelivery({ ...newDelivery, vin: upperVin });
                    if (upperVin.length > 0) {
                      const validation = validateVIN(upperVin);
                      setVinError(validation.isValid ? '' : validation.message);
                    } else {
                      setVinError('');
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow shadow-sm font-mono ${
                    vinError ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {vinError && (
                  <p className="mt-1 text-sm text-red-600">{vinError}</p>
                )}
                {newDelivery.vin.length > 0 && !vinError && newDelivery.vin.length === 17 && (
                  <p className="mt-1 text-sm text-green-600">Valid VIN</p>
                )}
              </div>

              <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Required Completion Timeframe</h3>
                <p className="text-sm text-gray-600 mb-4">When does this delivery need to be completed?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-start cursor-pointer group border-2 border-gray-300 rounded-lg p-4 hover:border-red-500 transition-all">
                    <input
                      type="radio"
                      name="requiredTimeframe"
                      value="tomorrow"
                      checked={newDelivery.requiredTimeframe === 'tomorrow'}
                      onChange={(e) => setNewDelivery({ ...newDelivery, requiredTimeframe: e.target.value as DeliveryTimeframe, customDate: '' })}
                      className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer mt-0.5"
                      required
                    />
                    <div className="ml-3">
                      <span className="block text-base font-bold text-gray-900 group-hover:text-red-600 transition">
                        Tomorrow
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        High priority, needs completion by tomorrow
                      </span>
                    </div>
                  </label>
                  <label className="flex items-start cursor-pointer group border-2 border-gray-300 rounded-lg p-4 hover:border-red-500 transition-all">
                    <input
                      type="radio"
                      name="requiredTimeframe"
                      value="next_few_days"
                      checked={newDelivery.requiredTimeframe === 'next_few_days'}
                      onChange={(e) => setNewDelivery({ ...newDelivery, requiredTimeframe: e.target.value as DeliveryTimeframe, customDate: '' })}
                      className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer mt-0.5"
                      required
                    />
                    <div className="ml-3">
                      <span className="block text-base font-bold text-gray-900 group-hover:text-red-600 transition">
                        Next Few Days
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        Flexible timeline, within 2-5 days
                      </span>
                    </div>
                  </label>
                  <label className="flex items-start cursor-pointer group border-2 border-gray-300 rounded-lg p-4 hover:border-red-500 transition-all">
                    <input
                      type="radio"
                      name="requiredTimeframe"
                      value="next_week"
                      checked={newDelivery.requiredTimeframe === 'next_week'}
                      onChange={(e) => setNewDelivery({ ...newDelivery, requiredTimeframe: e.target.value as DeliveryTimeframe, customDate: '' })}
                      className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer mt-0.5"
                      required
                    />
                    <div className="ml-3">
                      <span className="block text-base font-bold text-gray-900 group-hover:text-red-600 transition">
                        Next Week
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        No rush, completion within next week
                      </span>
                    </div>
                  </label>
                  <label className="flex items-start cursor-pointer group border-2 border-gray-300 rounded-lg p-4 hover:border-red-500 transition-all">
                    <input
                      type="radio"
                      name="requiredTimeframe"
                      value="custom"
                      checked={newDelivery.requiredTimeframe === 'custom'}
                      onChange={(e) => setNewDelivery({ ...newDelivery, requiredTimeframe: e.target.value as DeliveryTimeframe })}
                      className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer mt-0.5"
                      required
                    />
                    <div className="ml-3 flex-1">
                      <span className="block text-base font-bold text-gray-900 group-hover:text-red-600 transition">
                        Custom Date
                      </span>
                      <span className="block text-xs text-gray-500 mt-1 mb-2">
                        Specify an exact date
                      </span>
                      {newDelivery.requiredTimeframe === 'custom' && (
                        <input
                          type="date"
                          value={newDelivery.customDate}
                          onChange={(e) => setNewDelivery({ ...newDelivery, customDate: e.target.value })}
                          min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Service Type</h3>
                <div className="flex gap-6">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="serviceType"
                      value="delivery"
                      checked={newDelivery.serviceType === 'delivery'}
                      onChange={(e) => setNewDelivery({ ...newDelivery, serviceType: e.target.value as 'delivery' | 'swap', hasTrade: false, requiresSecondDriver: false })}
                      className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer"
                    />
                    <span className="ml-3 text-base font-medium text-gray-700 group-hover:text-red-600 transition">
                      Delivery
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="serviceType"
                      value="swap"
                      checked={newDelivery.serviceType === 'swap'}
                      onChange={(e) => setNewDelivery({ ...newDelivery, serviceType: e.target.value as 'delivery' | 'swap', hasTrade: false, requiresSecondDriver: false })}
                      className="w-5 h-5 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer"
                    />
                    <span className="ml-3 text-base font-medium text-gray-700 group-hover:text-red-600 transition">
                      Swap
                    </span>
                  </label>
                </div>

                {newDelivery.serviceType === 'delivery' && (
                  <div className="mt-5 pt-5 border-t border-gray-200 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-3">Is there a trade involved?</p>
                      <div className="flex gap-6">
                        <label className="flex items-center cursor-pointer group">
                          <input
                            type="radio"
                            name="hasTrade"
                            checked={newDelivery.hasTrade === true}
                            onChange={() => setNewDelivery({ ...newDelivery, hasTrade: true })}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-red-600 transition">
                            Yes
                          </span>
                        </label>
                        <label className="flex items-center cursor-pointer group">
                          <input
                            type="radio"
                            name="hasTrade"
                            checked={newDelivery.hasTrade === false}
                            onChange={() => setNewDelivery({ ...newDelivery, hasTrade: false })}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-red-600 transition">
                            No
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-3">Will a second driver be required?</p>
                      <div className="flex gap-6">
                        <label className="flex items-center cursor-pointer group">
                          <input
                            type="radio"
                            name="requiresSecondDriver"
                            checked={newDelivery.requiresSecondDriver === true}
                            onChange={() => setNewDelivery({ ...newDelivery, requiresSecondDriver: true })}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-red-600 transition">
                            Yes
                          </span>
                        </label>
                        <label className="flex items-center cursor-pointer group">
                          <input
                            type="radio"
                            name="requiresSecondDriver"
                            checked={newDelivery.requiresSecondDriver === false}
                            onChange={() => setNewDelivery({ ...newDelivery, requiresSecondDriver: false })}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 focus:ring-2 transition cursor-pointer"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-red-600 transition">
                            No
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={newDelivery.notes}
                  placeholder="Add any special instructions or notes..."
                  onChange={(e) => setNewDelivery({ ...newDelivery, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow shadow-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assign Driver (Optional)</label>
                <button
                  type="button"
                  onClick={() => setShowDriverSelection(true)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-left hover:border-red-600 hover:bg-red-50 transition font-medium text-gray-700 hover:text-red-700"
                >
                  {newDelivery.driverId ? (
                    <span className="flex items-center justify-between">
                      <span>{drivers.find(d => d.id === newDelivery.driverId)?.name || 'Select Driver'}</span>
                      <span className="text-sm text-gray-500">Click to change</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-between">
                      <span>Select Driver (or leave unassigned)</span>
                      <span className="text-sm text-gray-500">Click to choose</span>
                    </span>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Choose your preferred driver based on past performance and your preferences
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
                >
                  Create Delivery Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewDelivery(false)}
                  className="px-8 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">My Delivery Requests</h2>
            <p className="text-sm text-gray-500">Showing {filteredDeliveries.length} requests</p>
          </div>

          <DeliveryFilters
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            counts={filterCounts}
          />

          <div className="mt-6 space-y-4">
            {filteredDeliveries.length === 0 ? (
              <EmptyState
                icon={Package}
                title={searchQuery ? 'No matching deliveries' : 'No deliveries yet'}
                description={searchQuery ? 'Try adjusting your search query' : 'Request your first delivery to get started'}
                action={!searchQuery && activeFilter === 'pending' ? { label: 'Request Delivery', onClick: () => setShowNewDelivery(true) } : undefined}
              />
            ) : (
              filteredDeliveries.map((delivery) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  driverName={delivery.driver_id ? driverMap.get(delivery.driver_id) : undefined}
                  onChatClick={() => navigate(`/chat/${delivery.id}`)}
                  onCancelClick={delivery.status === 'pending' ? () => setDeliveryToCancel(delivery.id) : undefined}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {showDriverSelection && sales && user && (
        <DriverSelectionModal
          isOpen={showDriverSelection}
          onClose={() => setShowDriverSelection(false)}
          onSelectDriver={(driverId) => {
            setNewDelivery({ ...newDelivery, driverId });
            setShowDriverSelection(false);
          }}
          dealerId={sales.dealer_id}
          currentUserId={user.id}
          selectedDriverId={newDelivery.driverId}
        />
      )}

      <ConfirmationModal
        isOpen={!!deliveryToCancel}
        onClose={() => setDeliveryToCancel(null)}
        onConfirm={() => deliveryToCancel && handleCancelDelivery(deliveryToCancel)}
        title="Cancel Delivery Request"
        message="Are you sure you want to cancel this delivery request? If a driver has already accepted it, they will be notified of the cancellation."
        confirmText="Cancel Delivery"
        cancelText="Keep Request"
        variant="danger"
      />
    </div>
  );
}
