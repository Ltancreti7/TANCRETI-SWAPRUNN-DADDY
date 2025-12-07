import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, UserCircle, FileCheck, Search, Settings, Clock, CheckCircle2, Inbox, Building2, Calendar as CalendarIcon, List, LayoutGrid, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, Driver, Delivery, Dealer, DriverApplication, ApprovedDriverDealer } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { DealershipSearch } from '../components/driver/DealershipSearch';
import { EditProfileModal } from '../components/driver/EditProfileModal';
import { DealershipRequestCard } from '../components/driver/DealershipRequestCard';
import { DealershipFilter } from '../components/driver/DealershipFilter';
import { MyDealerships } from '../components/driver/MyDealerships';
import { NotificationService } from '../lib/notificationService';
import { DeliveryCardWithChat } from '../components/driver/DeliveryCardWithChat';
import { Calendar } from '../components/ui/Calendar';
import { UnreadBadge } from '../components/ui/UnreadBadge';
import { useUnreadMessagesCount } from '../hooks/useUnreadMessagesCount';

interface DeliveryWithDealer extends Delivery {
  dealer: Dealer;
  sales?: { name: string } | null;
}

interface ApplicationWithDealer extends DriverApplication {
  dealer: Dealer;
}

interface DealershipWithStats extends ApprovedDriverDealer {
  dealer: Dealer;
  pendingCount?: number;
  upcomingCount?: number;
  completedCount?: number;
}

export function DriverDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { unreadCount } = useUnreadMessagesCount(user?.id);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [requestDeliveries, setRequestDeliveries] = useState<DeliveryWithDealer[]>([]);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState<DeliveryWithDealer[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<DeliveryWithDealer[]>([]);
  const [, setApplications] = useState<ApplicationWithDealer[]>([]);
  const [approvedDealerships, setApprovedDealerships] = useState<DealershipWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'upcoming' | 'recent' | 'search' | 'dealerships'>('requests');
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);
  const [dealershipColors] = useState<Map<string, string>>(new Map());
  const [hasRequestedNotificationPermission, setHasRequestedNotificationPermission] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [upcomingViewMode, setUpcomingViewMode] = useState<'list' | 'calendar'>('list');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getDealershipColor = (dealershipId: string) => {
    if (!dealershipColors.has(dealershipId)) {
      const colors = [
        '#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED',
        '#DB2777', '#0891B2', '#EA580C', '#4F46E5', '#0D9488'
      ];
      const index = dealershipColors.size % colors.length;
      dealershipColors.set(dealershipId, colors[index]);
    }
    return dealershipColors.get(dealershipId) || '#6B7280';
  };

  useEffect(() => {
    if (user) {
      loadDriverData();
      if (!hasRequestedNotificationPermission && NotificationService.isSupported) {
        NotificationService.requestPermission();
        setHasRequestedNotificationPermission(true);
      }
    }
  }, [user, hasRequestedNotificationPermission]);

  useEffect(() => {
    if (!user || !driver) {
      console.log('[Realtime] Skipping setup - missing user or driver');
      return;
    }

    console.log('[Realtime] Setting up subscription for driver:', driver.id);
    console.log('[Realtime] User ID:', user.id);
    setRealtimeStatus('connecting');

    const channelName = `deliveries-driver-${driver.id}-${Date.now()}`;
    console.log('[Realtime] Channel name:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        async (payload) => {
          console.log('[Realtime] ========== DELIVERY CHANGE EVENT ==========');
          console.log('[Realtime] Event type:', payload.eventType);
          console.log('[Realtime] Payload:', payload);

          try {
            if (payload.eventType === 'INSERT' && payload.new) {
              const newDelivery = payload.new as Delivery;
              console.log('[Realtime] New delivery INSERT detected');
              console.log('[Realtime] Delivery ID:', newDelivery.id);
              console.log('[Realtime] Delivery dealer_id:', newDelivery.dealer_id);
              console.log('[Realtime] Delivery driver_id:', newDelivery.driver_id);
              console.log('[Realtime] Delivery status:', newDelivery.status);

              console.log('[Realtime] Fetching approved dealerships for driver:', driver.id);
              const { data: dealershipIds, error: dealershipError } = await supabase
                .from('approved_driver_dealers')
                .select('dealer_id')
                .eq('driver_id', driver.id);

              if (dealershipError) {
                console.error('[Realtime] Error fetching approved dealerships:', dealershipError);
                return;
              }

              console.log('[Realtime] Approved dealerships:', dealershipIds);
              const isFromApprovedDealer = dealershipIds?.some(d => d.dealer_id === newDelivery.dealer_id);
              console.log('[Realtime] Is from approved dealer?', isFromApprovedDealer);
              console.log('[Realtime] Has driver_id?', !!newDelivery.driver_id);
              console.log('[Realtime] Status is pending?', newDelivery.status === 'pending');

            if (
  isFromApprovedDealer &&
  newDelivery.status === "pending"
) {
  console.log("[Realtime] ✔ Delivery qualifies — fetching full details...");

  const { data: deliveryWithDetails, error: deliveryError } = await supabase
    .from("deliveries")
    .select(`
      *,
      dealer:dealers(*),
      sales:sales!sales_id(name)
    `)
    .eq("id", newDelivery.id)
    .single();

  if (deliveryError) {
    console.error("[Realtime] Error fetching delivery details:", deliveryError);
    return;
  }

  if (!deliveryWithDetails) {
    console.warn("[Realtime] deliveryWithDetails is null or undefined");
    return;
  }

  // Add to requests immediately
  setRequestDeliveries((prev) => {
    if (prev.some((d) => d.id === deliveryWithDetails.id)) {
      console.log("[Realtime] Already in list — skipping");
      return prev;
    }
    return [deliveryWithDetails as DeliveryWithDealer, ...prev];
  });

  // Build notification message
  const salesName = deliveryWithDetails.sales?.name || "Salesperson";
  const dealerName = deliveryWithDetails.dealer?.name || "Dealership";
  const pickup = deliveryWithDetails.pickup || "Pickup location";
  const dropoff = deliveryWithDetails.dropoff || "Dropoff location";

  let msg = "";

  if (
    deliveryWithDetails.scheduled_date &&
    deliveryWithDetails.scheduled_time
  ) {
    const formattedDate = new Date(
      deliveryWithDetails.scheduled_date
    ).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    msg = `New request from ${salesName} (${dealerName}). Pickup: ${pickup} on ${formattedDate} at ${deliveryWithDetails.scheduled_time}.`;
  } else {
    msg = `New request from ${salesName} (${dealerName}). Pickup: ${pickup} → Dropoff: ${dropoff}.`;
  }

  // Push notification (browser)
  NotificationService.notifyNewDelivery(msg);

  // Toast message
  showToast(msg, "success");

  console.log("[Realtime] ✔ New delivery added successfully");
} else {
  console.log("[Realtime] ❌ Delivery does not qualify — skipping");
}
            } else if (payload.eventType === 'UPDATE') {
              console.log('[Realtime] UPDATE event detected - delivery updated:', payload.new);
              if (payload.new) {
                const updatedDelivery = payload.new as Delivery;
                console.log('[Realtime] Updated delivery details:', {
                  id: updatedDelivery.id,
                  status: updatedDelivery.status,
                  scheduled_date: updatedDelivery.scheduled_date,
                  scheduled_time: updatedDelivery.scheduled_time
                });
              }
              console.log('[Realtime] Refreshing all delivery lists...');
              await loadRequestDeliveries(driver.id);
              await loadUpcomingDeliveries(driver.id);
              await loadRecentDeliveries(driver.id);
              console.log('[Realtime] All lists refreshed');
            } else if (payload.eventType === 'DELETE') {
              console.log('[Realtime] DELETE event detected - refreshing all lists');
              await loadRequestDeliveries(driver.id);
              await loadUpcomingDeliveries(driver.id);
              await loadRecentDeliveries(driver.id);
            }

            setLastUpdateTime(new Date());
            console.log('[Realtime] ========== EVENT PROCESSING COMPLETE ==========');
          } catch (error) {
            console.error('[Realtime] ❌ Error processing delivery change:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] ========== SUBSCRIPTION STATUS ==========');
        console.log('[Realtime] Status:', status);

        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          console.log('[Realtime] ✅ Successfully subscribed to delivery updates');
          stopPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('disconnected');
          console.error('[Realtime] ❌ Connection error, starting fallback polling');
          if (realtimeStatus !== 'connected') {
            startPolling();
          }
        } else if (status === 'CLOSED') {
          setRealtimeStatus('disconnected');
          console.log('[Realtime] Connection closed');
        }
      });

    channelRef.current = channel;

    // Cleanup function - ensures channel is always removed
    return () => {
      console.log('[Realtime] ========== CLEANUP ==========');
      console.log('[Realtime] Cleaning up subscription');
      stopPolling();
      
      // Use channel from closure to ensure we always have the reference
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.error('[Realtime] Error removing channel:', error);
        }
      }
      
      // Also clean up ref
      if (channelRef.current) {
        channelRef.current = null;
      }
    };
  }, [user, driver?.id]);

  const startPolling = () => {
    if (pollingIntervalRef.current || !driver) return;

    console.log('[Polling] Starting fallback polling every 30 seconds');
    pollingIntervalRef.current = setInterval(async () => {
      console.log('[Polling] Fetching deliveries...');
      try {
        await loadRequestDeliveries(driver.id);
        await loadUpcomingDeliveries(driver.id);
        await loadRecentDeliveries(driver.id);
        setLastUpdateTime(new Date());
      } catch (error) {
        console.error('[Polling] Error fetching deliveries:', error);
      }
    }, 30000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      console.log('[Polling] Stopping fallback polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const loadDriverData = async () => {
    if (!user) return;

    setLoading(true);
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (driverError) {
      console.error('Error loading driver data:', driverError);
      console.error('Driver error details:', {
        code: driverError.code,
        message: driverError.message,
        details: driverError.details,
        hint: driverError.hint,
        userId: user.id,
      });
    }

    if (!driverData) {
      console.warn('No driver data found for user:', user.id);
      console.log('User object:', user);
    }

    if (driverData) {
      setDriver(driverData);
      await Promise.all([
        loadRequestDeliveries(driverData.id),
        loadUpcomingDeliveries(driverData.id),
        loadRecentDeliveries(driverData.id),
        loadApplications(driverData.id),
        loadApprovedDealerships(driverData.id),
      ]);
    }
    setLoading(false);
  };

  const loadRequestDeliveries = async (driverId: string) => {
    try {
      // Authorization check: Verify driver belongs to current user
      if (!user || !driver || driver.user_id !== user.id) {
        console.error('[LoadRequests] Authorization failed: Driver does not belong to current user');
        showToast('Unauthorized access', 'error');
        setRequestDeliveries([]);
        setLoadingRequests(false);
        return;
      }

      // Authorization check: Verify driverId matches current driver
      if (driverId !== driver.id) {
        console.error('[LoadRequests] Authorization failed: driverId mismatch');
        showToast('Unauthorized access', 'error');
        setRequestDeliveries([]);
        setLoadingRequests(false);
        return;
      }

      console.log('[LoadRequests] Loading request deliveries for driver:', driverId);
      setLoadingRequests(true);

      const { data: dealershipIds, error: dealershipError } = await supabase
        .from('approved_driver_dealers')
        .select('dealer_id')
        .eq('driver_id', driverId);

      if (dealershipError) {
        console.error('[LoadRequests] Error fetching approved dealerships:', dealershipError);
        console.error('[LoadRequests] Error details:', {
          code: dealershipError.code,
          message: dealershipError.message,
          details: dealershipError.details,
          hint: dealershipError.hint
        });
        throw dealershipError;
      }

      if (!dealershipIds || dealershipIds.length === 0) {
        console.log('[LoadRequests] No approved dealerships found');
        setRequestDeliveries([]);
        setLoadingRequests(false);
        return;
      }

      const dealerIds = dealershipIds.map(d => d.dealer_id);
      console.log('[LoadRequests] Fetching deliveries from dealerships:', dealerIds);

      // Validate driverId to prevent injection
      if (typeof driverId !== 'string' || driverId.length === 0 || !/^[0-9a-f-]{36}$/i.test(driverId)) {
        console.error('[LoadRequests] Invalid driverId format');
        setRequestDeliveries([]);
        setLoadingRequests(false);
        return;
      }

      // Fetch two types of requests:
      // 1. General pending deliveries (no driver assigned, available to all)
      // 2. Deliveries specifically requested for this driver (pending_driver_acceptance)
      // Use separate queries to avoid string interpolation in filter
      const [pendingResult, specificRequestResult] = await Promise.all([
        // General pending deliveries
        supabase
          .from('deliveries')
          .select(`
            *,
            dealer:dealers(*),
            sales:sales!sales_id(name)
          `)
          .in('dealer_id', dealerIds)
          .is('driver_id', null)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        // Specifically requested deliveries for this driver
        supabase
          .from('deliveries')
          .select(`
            *,
            dealer:dealers(*),
            sales:sales!sales_id(name)
          `)
          .in('dealer_id', dealerIds)
          .eq('driver_id', driverId)
          .eq('status', 'pending_driver_acceptance')
          .order('created_at', { ascending: false })
      ]);

      const deliveriesError = pendingResult.error || specificRequestResult.error;
      const allDeliveries = [
        ...(pendingResult.data || []),
        ...(specificRequestResult.data || [])
      ];

      if (deliveriesError) {
        console.error('[LoadRequests] Error fetching deliveries:', deliveriesError);
        console.error('[LoadRequests] Error details:', {
          code: deliveriesError.code,
          message: deliveriesError.message,
          details: deliveriesError.details,
          hint: deliveriesError.hint
        });
        throw deliveriesError;
      }

      console.log('[LoadRequests] Found', allDeliveries.length, 'request deliveries');
      if (allDeliveries.length > 0) {
        setRequestDeliveries(allDeliveries as DeliveryWithDealer[]);
      } else {
        setRequestDeliveries([]);
      }
    } catch (error) {
      console.error('[LoadRequests] Failed to load request deliveries:', error);
      console.error('[LoadRequests] Stack trace:', error instanceof Error ? error.stack : 'N/A');
      showToast('Failed to load delivery requests', 'error');
      setRequestDeliveries([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadUpcomingDeliveries = async (driverId: string) => {
    const { data } = await supabase
      .from('deliveries')
      .select(`
        *,
        dealer:dealers(*),
        sales:sales(name)
      `)
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'assigned', 'in_progress'])
      .order('created_at', { ascending: false });

    if (data) {
      console.log('[LoadUpcoming] Loaded upcoming deliveries:', data.length);
      const scheduled = data.filter(d => d.scheduled_date && d.scheduled_time);
      console.log('[LoadUpcoming] Deliveries with schedule:', scheduled.length, scheduled.map(d => ({
        id: d.id,
        vin: d.vin,
        scheduled_date: d.scheduled_date,
        scheduled_time: d.scheduled_time
      })));
      setUpcomingDeliveries(data as DeliveryWithDealer[]);
    }
  };

  const loadRecentDeliveries = async (driverId: string) => {
    const { data } = await supabase
      .from('deliveries')
      .select(`
        *,
        dealer:dealers(*),
        sales:sales(name)
      `)
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50);

    if (data) setRecentDeliveries(data as DeliveryWithDealer[]);
  };


  const loadApplications = async (driverId: string) => {
    const { data } = await supabase
      .from('driver_applications')
      .select(`
        *,
        dealer:dealers(*)
      `)
      .eq('driver_id', driverId)
      .order('applied_at', { ascending: false });

    if (data) setApplications(data as ApplicationWithDealer[]);
  };

  const loadApprovedDealerships = async (driverId: string) => {
    const { data } = await supabase
      .from('approved_driver_dealers')
      .select(`
        *,
        dealer:dealers(*)
      `)
      .eq('driver_id', driverId)
      .order('approved_at', { ascending: false });

    if (data) {
      const dealershipsWithStats = await Promise.all(
        data.map(async (relationship) => {
          const [pendingResult, upcomingResult, completedResult] = await Promise.all([
            supabase
              .from('deliveries')
              .select('id', { count: 'exact', head: true })
              .eq('dealer_id', relationship.dealer_id)
              .is('driver_id', null)
              .eq('status', 'pending'),
            supabase
              .from('deliveries')
              .select('id', { count: 'exact', head: true })
              .eq('dealer_id', relationship.dealer_id)
              .eq('driver_id', driverId)
              .in('status', ['accepted', 'assigned', 'in_progress']),
            supabase
              .from('deliveries')
              .select('id', { count: 'exact', head: true })
              .eq('dealer_id', relationship.dealer_id)
              .eq('driver_id', driverId)
              .eq('status', 'completed'),
          ]);

          return {
            ...relationship,
            pendingCount: pendingResult.count || 0,
            upcomingCount: upcomingResult.count || 0,
            completedCount: completedResult.count || 0,
          } as DealershipWithStats;
        })
      );

      setApprovedDealerships(dealershipsWithStats);
    }
  };

  const handleManualRefresh = async () => {
    if (!driver) return;

    console.log('[Manual] Manually refreshing deliveries');
    showToast('Refreshing deliveries...', 'success');

    try {
      await Promise.all([
        loadRequestDeliveries(driver.id),
        loadUpcomingDeliveries(driver.id),
        loadRecentDeliveries(driver.id),
      ]);
      setLastUpdateTime(new Date());
      showToast('Deliveries refreshed successfully', 'success');
    } catch (error) {
      console.error('[Manual] Error refreshing:', error);
      showToast('Failed to refresh deliveries', 'error');
    }
  };

  const handleDeclineDelivery = async (deliveryId: string) => {
    if (!driver) {
      console.error('[DeclineDelivery] No driver found');
      showToast('Driver profile not found', 'error');
      return;
    }

    console.log('[DeclineDelivery] Starting decline process for delivery:', deliveryId);
    console.log('[DeclineDelivery] Driver ID:', driver.id);

    try {
      // Fetch delivery details first
      console.log('[DeclineDelivery] Fetching delivery details...');
      const { data: delivery, error: fetchError } = await supabase
        .from('deliveries')
        .select('*, dealer:dealers(user_id), sales:sales!sales_id(user_id, name)')
        .eq('id', deliveryId)
        .single();

      if (fetchError) {
        console.error('[DeclineDelivery] Error fetching delivery:', fetchError);
        throw fetchError;
      }

      console.log('[DeclineDelivery] Delivery fetched:', delivery);

      // Reset delivery to pending status (unassign driver)
      console.log('[DeclineDelivery] Resetting delivery to pending status');
      const { error } = await supabase
        .from('deliveries')
        .update({
          driver_id: null,
          status: 'pending',
        })
        .eq('id', deliveryId)
        .eq('driver_id', driver.id);

      if (error) {
        console.error('[DeclineDelivery] Error updating delivery:', error);
        throw error;
      }

      console.log('[DeclineDelivery] Delivery declined successfully');

      // Send notifications
      console.log('[DeclineDelivery] Sending notifications...');
      const notifications = [];
      if (delivery?.sales?.user_id) {
        notifications.push({
          user_id: delivery.sales.user_id,
          delivery_id: deliveryId,
          type: 'delivery_declined',
          title: 'Delivery Request Declined',
          message: `${driver.name} has declined the delivery request for VIN: ${delivery.vin}. Please assign another driver.`,
          read: false,
        });
      }
      if (delivery?.dealer?.user_id && delivery?.dealer?.user_id !== delivery?.sales?.user_id) {
        notifications.push({
          user_id: delivery.dealer.user_id,
          delivery_id: deliveryId,
          type: 'delivery_declined',
          title: 'Delivery Request Declined',
          message: `${driver.name} has declined a delivery request for VIN: ${delivery.vin}.`,
          read: false,
        });
      }

      if (notifications.length > 0) {
        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) {
          console.error('[DeclineDelivery] Error sending notifications:', notifError);
        } else {
          console.log('[DeclineDelivery] Notifications sent:', notifications.length);
        }
      }

      // Update state immediately
      console.log('[DeclineDelivery] Updating local state...');
      setRequestDeliveries(prev => {
        const filtered = prev.filter(d => d.id !== deliveryId);
        console.log('[DeclineDelivery] Removed from requests, remaining:', filtered.length);
        return filtered;
      });

      console.log('[DeclineDelivery] Decline process completed successfully');
      showToast('Delivery request declined', 'success');
    } catch (err: unknown) {
      console.error('[DeclineDelivery] Fatal error:', err);
      const message = err instanceof Error ? err.message : 'Failed to decline delivery';
      showToast(message, 'error');
    }
  };

  const handleAcceptDelivery = async (deliveryId: string) => {
    if (!driver || !user) {
      console.error('[AcceptDelivery] No driver or user found');
      showToast('Driver profile not found', 'error');
      return;
    }

    // Validate deliveryId to prevent injection
    if (!deliveryId || typeof deliveryId !== 'string' || deliveryId.length === 0) {
      console.error('[AcceptDelivery] Invalid deliveryId');
      showToast('Invalid delivery request', 'error');
      return;
    }

    console.log('[AcceptDelivery] Starting accept process for delivery:', deliveryId);
    console.log('[AcceptDelivery] Driver ID:', driver.id);

    try {
      // ATOMIC UPDATE: Try to accept the delivery atomically without pre-fetching
      // This prevents race conditions by using database-level constraints
      
      // First, try to accept a specifically requested delivery (pending_driver_acceptance)
      let updateResult = await supabase
        .from('deliveries')
        .update({
          status: 'accepted',
          chat_activated_at: new Date().toISOString(),
          accepted_at: new Date().toISOString()
        })
        .eq('id', deliveryId)
        .eq('driver_id', driver.id)
        .eq('status', 'pending_driver_acceptance')
        .select('id, dealer_id, sales_id, dealer:dealers(user_id), sales:sales!sales_id(user_id)');

      let isSpecificallyRequested = false;
      
      // If that didn't work, try to claim a general pending delivery
      if (!updateResult.data || updateResult.data.length === 0) {
        updateResult = await supabase
          .from('deliveries')
          .update({
            driver_id: driver.id,
            status: 'accepted',
            chat_activated_at: new Date().toISOString(),
            accepted_at: new Date().toISOString()
          })
          .eq('id', deliveryId)
          .is('driver_id', null)
          .eq('status', 'pending')
          .select('id, dealer_id, sales_id, dealer:dealers(user_id), sales:sales!sales_id(user_id)');
      } else {
        isSpecificallyRequested = true;
      }

      const { error, data: updateData } = updateResult;

      console.log('[AcceptDelivery] Update result:', { error, updateData, isSpecificallyRequested });

      if (error) {
        console.error('[AcceptDelivery] Error updating delivery:', error);
        console.error('[AcceptDelivery] Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      // If no rows were updated, delivery was already accepted by someone else
      if (!updateData || updateData.length === 0) {
        console.warn('[AcceptDelivery] Update affected 0 rows - delivery was already accepted');
        showToast('This delivery has already been accepted by another driver', 'error');
        await loadRequestDeliveries(driver.id);
        return;
      }

      const delivery = updateData[0];
      console.log('[AcceptDelivery] Delivery updated successfully');

      // Fetch full delivery details for notifications (after successful atomic update)
      const { data: fullDelivery, error: fetchError } = await supabase
        .from('deliveries')
        .select('*, dealer:dealers(user_id), sales:sales!sales_id(user_id)')
        .eq('id', deliveryId)
        .single();

      if (fetchError) {
        console.error('[AcceptDelivery] Error fetching delivery details:', fetchError);
        // Continue anyway - the update succeeded
      }

      const deliveryDetails = fullDelivery || delivery;

      // Send welcome message
      console.log('[AcceptDelivery] Sending welcome message...');
      const welcomeMessage = `Chat activated! Driver ${driver.name} has accepted this delivery. You can now coordinate the pickup schedule and any other details.`;
      const recipientId = deliveryDetails?.sales?.user_id || deliveryDetails?.dealer?.user_id;
      if (recipientId) {
        const { error: messageError } = await supabase.from('messages').insert({
          delivery_id: deliveryId,
          sender_id: user.id,
          recipient_id: recipientId,
          content: welcomeMessage,
        });

        if (messageError) {
          console.error('[AcceptDelivery] Error sending message:', messageError);
        } else {
          console.log('[AcceptDelivery] Welcome message sent');
        }
      }

      // Send notifications
      console.log('[AcceptDelivery] Sending notifications...');
      const notifications = [];
      if (deliveryDetails?.dealer?.user_id) {
        notifications.push({
          user_id: deliveryDetails.dealer.user_id,
          delivery_id: deliveryId,
          type: 'delivery_accepted',
          title: 'Delivery Accepted',
          message: `${driver.name} has accepted a delivery request.`,
          read: false,
        });
      }
      if (deliveryDetails?.sales?.user_id && deliveryDetails.sales.user_id !== deliveryDetails?.dealer?.user_id) {
        notifications.push({
          user_id: deliveryDetails.sales.user_id,
          delivery_id: deliveryId,
          type: 'delivery_accepted',
          title: 'Delivery Accepted',
          message: `${driver.name} has accepted your delivery request.`,
          read: false,
        });
      }

      if (notifications.length > 0) {
        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) {
          console.error('[AcceptDelivery] Error sending notifications:', notifError);
        } else {
          console.log('[AcceptDelivery] Notifications sent:', notifications.length);
        }
      }

      // Update state immediately without refresh
      console.log('[AcceptDelivery] Updating local state...');
      setRequestDeliveries(prev => {
        const filtered = prev.filter(d => d.id !== deliveryId);
        console.log('[AcceptDelivery] Removed from requests, remaining:', filtered.length);
        return filtered;
      });

      // Reload upcoming deliveries to ensure we have the latest data
      // This handles cases where the delivery wasn't in requestDeliveries (e.g., from realtime update)
      await loadUpcomingDeliveries(driver.id);
      
      // Also update local state optimistically if delivery is in requestDeliveries
      setRequestDeliveries(prev => {
        const filtered = prev.filter(d => d.id !== deliveryId);
        return filtered;
      });

      console.log('[AcceptDelivery] Accept process completed successfully');
      showToast('Delivery accepted successfully!', 'success');
    } catch (err: unknown) {
      console.error('[AcceptDelivery] Fatal error:', err);
      const message = err instanceof Error ? err.message : 'Failed to accept delivery';
      showToast(message, 'error');
    }
  };

  const handleUpdateStatus = async (deliveryId: string, newStatus: string) => {
    if (!driver) return;

    try {
      const { data: delivery, error: fetchError } = await supabase
        .from('deliveries')
        .select('*, dealer:dealers(user_id), sales:sales!sales_id(user_id)')
        .eq('id', deliveryId)
        .single();

      if (fetchError) throw fetchError;

      const updateData: { status: string; completed_at?: string } = { status: newStatus };
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('deliveries')
        .update(updateData)
        .eq('id', deliveryId);

      if (error) throw error;

      const statusMessages: Record<string, string> = {
        'in_progress': 'started the delivery',
        'completed': 'completed the delivery',
        'cancelled': 'cancelled the delivery',
      };

      const statusMessage = statusMessages[newStatus] || `updated status to ${newStatus}`;

      const notifications = [];
      if (delivery?.dealer?.user_id) {
        notifications.push({
          user_id: delivery.dealer.user_id,
          delivery_id: deliveryId,
          type: 'status_update',
          title: 'Delivery Status Update',
          message: `${driver.name} ${statusMessage}.`,
          read: false,
        });
      }
      if (delivery?.sales?.user_id) {
        notifications.push({
          user_id: delivery.sales.user_id,
          delivery_id: deliveryId,
          type: 'status_update',
          title: 'Delivery Status Update',
          message: `${driver.name} ${statusMessage}.`,
          read: false,
        });
      }

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }

      // Update local state immediately
      if (newStatus === 'completed') {
        // Remove from upcoming deliveries immediately
        setUpcomingDeliveries(prev => prev.filter(d => d.id !== deliveryId));
        // Add to recent deliveries at the top
        const completedDelivery = upcomingDeliveries.find(d => d.id === deliveryId);
        if (completedDelivery) {
          setRecentDeliveries(prev => [{
            ...completedDelivery,
            status: 'completed',
            completed_at: new Date().toISOString()
          }, ...prev]);
        }
      } else {
        // For other status updates, just reload
        loadUpcomingDeliveries(driver.id);
      }

      showToast('Status updated successfully!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      showToast(message, 'error');
    }
  };

  const toggleAvailability = async () => {
    if (!driver) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_available: !driver.is_available })
        .eq('id', driver.id);

      if (error) throw error;

      setDriver({ ...driver, is_available: !driver.is_available });
      showToast(
        `You are now ${!driver.is_available ? 'available' : 'unavailable'}`,
        'success'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update availability';
      showToast(message, 'error');
    }
  };

  const handleSaveProfile = async (updatedDriver: Partial<Driver>) => {
    if (!driver) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update(updatedDriver)
        .eq('id', driver.id);

      if (error) throw error;

      setDriver({ ...driver, ...updatedDriver });
      showToast('Profile updated successfully!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(message, 'error');
      throw err;
    }
  };

  if (loading && !driver) {
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

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        <div className="bg-white shadow-md sticky top-16 z-40">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-3xl font-bold">Driver profile not found</h1>
            <p className="text-gray-600 mt-2">
              We couldn&apos;t load your driver profile. Please finish registration or contact support.
            </p>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <EmptyState
              icon={UserCircle}
              title="Profile Not Found"
              description="Your driver profile could not be loaded. Please contact support for assistance."
            />
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white shadow-md sticky top-16 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 truncate">Welcome, {driver?.name}</h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                {driver?.vehicle_type} | {driver?.radius} mi radius
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3 items-center">
              <button
                onClick={() => navigate('/conversations')}
                className="touch-target relative p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg transition"
                title="All Conversations"
              >
                <MessageCircle size={20} />
                <UnreadBadge count={unreadCount} variant="button" />
              </button>
              <button
                onClick={() => setIsEditProfileOpen(true)}
                className="touch-target p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-lg transition"
                title="Edit Profile"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={toggleAvailability}
                className={`touch-target px-4 sm:px-6 py-2 rounded-lg font-semibold transition text-sm sm:text-base ${
                  driver?.is_available
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {driver?.is_available ? 'Available' : 'Unavailable'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold transition flex items-center whitespace-nowrap relative touch-target ${
                  activeTab === 'requests'
                    ? 'text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Inbox size={18} className="mr-1.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden xs:inline sm:inline">Requests</span>
                <span className="inline xs:hidden sm:hidden">Req</span>
                {requestDeliveries.length > 0 && (
                  <span className="absolute -top-1 -right-1 sm:static sm:ml-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    {requestDeliveries.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold transition flex items-center whitespace-nowrap touch-target ${
                  activeTab === 'upcoming'
                    ? 'text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Clock size={18} className="mr-1.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden xs:inline">Upcoming</span>
                <span className="inline xs:hidden">Up</span>
                {upcomingDeliveries.length > 0 && (
                  <span className="ml-1.5 sm:ml-2 bg-blue-100 text-blue-600 text-xs font-bold px-2 py-1 rounded-full">
                    {upcomingDeliveries.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('recent')}
                className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold transition flex items-center whitespace-nowrap touch-target ${
                  activeTab === 'recent'
                    ? 'text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <CheckCircle2 size={18} className="mr-1.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden xs:inline">Recent</span>
                <span className="inline xs:hidden">Rec</span>
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold transition flex items-center whitespace-nowrap touch-target ${
                  activeTab === 'search'
                    ? 'text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Search size={18} className="mr-1.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden xs:inline sm:inline">Search</span>
                <span className="inline xs:hidden sm:hidden">Find</span>
              </button>
              <button
                onClick={() => setActiveTab('dealerships')}
                className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold transition flex items-center whitespace-nowrap touch-target ${
                  activeTab === 'dealerships'
                    ? 'text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Building2 size={18} className="mr-1.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden xs:inline">Dealers</span>
                <span className="inline xs:hidden">My</span>
                {approvedDealerships.length > 0 && (
                  <span className="ml-1.5 sm:ml-2 bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">
                    {approvedDealerships.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      realtimeStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                      realtimeStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                      'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-700">
                      {realtimeStatus === 'connected' ? 'Real-time Connected' :
                       realtimeStatus === 'connecting' ? 'Connecting...' :
                       'Offline - Using Polling'}
                    </span>
                  </div>
                  {lastUpdateTime && (
                    <span className="text-xs text-gray-500">
                      Last update: {lastUpdateTime.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={loadingRequests}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <svg
                    className={`w-4 h-4 ${loadingRequests ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            {approvedDealerships.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <EmptyState
                  icon={FileCheck}
                  title="No approved dealerships"
                  description="Once a dealership approves your application, their delivery requests will appear here"
                />
              </div>
            ) : requestDeliveries.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <EmptyState
                  icon={Inbox}
                  title="No available requests"
                  description="New delivery requests from your approved dealerships will appear here"
                />
              </div>
            ) : (
              <>
                {approvedDealerships.length > 1 && (
                  <DealershipFilter
                    dealerships={approvedDealerships.map(ad => ad.dealer)}
                    selectedDealershipId={selectedDealershipId}
                    onSelectDealership={setSelectedDealershipId}
                    dealershipColors={dealershipColors}
                    requestCounts={requestDeliveries.reduce((map, delivery) => {
                      const count = map.get(delivery.dealer_id) || 0;
                      map.set(delivery.dealer_id, count + 1);
                      return map;
                    }, new Map<string, number>())}
                  />
                )}

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold mb-6 flex items-center">
                    <Inbox size={28} className="mr-3 text-red-600" />
                    Available Requests
                    {selectedDealershipId && (
                      <span className="ml-3 text-sm font-normal text-gray-600">
                        for {approvedDealerships.find(ad => ad.dealer.id === selectedDealershipId)?.dealer.name}
                      </span>
                    )}
                  </h2>

                  <div className="space-y-4">
                    {requestDeliveries
                      .filter(delivery => !selectedDealershipId || delivery.dealer_id === selectedDealershipId)
                      .map((delivery) => (
                        <DealershipRequestCard
                          key={delivery.id}
                          delivery={delivery}
                          onAccept={handleAcceptDelivery}
                          onDecline={handleDeclineDelivery}
                          dealerColor={getDealershipColor(delivery.dealer_id)}
                        />
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'upcoming' && (
          <div className="space-y-6">
            {upcomingDeliveries.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <Clock size={28} className="mr-3 text-red-600" />
                  Upcoming Drives
                </h2>
                <EmptyState
                  icon={Clock}
                  title="No upcoming drives"
                  description="Accept a request from the Requests tab to see it here"
                />
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center">
                      <Clock size={28} className="mr-3 text-red-600" />
                      Upcoming Drives
                    </h2>
                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setUpcomingViewMode('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition ${
                          upcomingViewMode === 'list'
                            ? 'bg-white text-red-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <List size={18} />
                        List
                      </button>
                      <button
                        onClick={() => setUpcomingViewMode('calendar')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition ${
                          upcomingViewMode === 'calendar'
                            ? 'bg-white text-red-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <LayoutGrid size={18} />
                        Calendar
                      </button>
                    </div>
                  </div>

                  {upcomingViewMode === 'list' ? (
                    <div className="space-y-4">
                      {upcomingDeliveries.map((delivery) => (
                        <Card key={delivery.id} hover>
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <p className="font-bold text-lg">VIN: {delivery.vin}</p>
                                <span className="text-xs bg-gray-100 px-3 py-1 rounded-full font-semibold text-gray-700">
                                  {delivery.dealer.name}
                                </span>
                                {delivery.sales?.name && (
                                  <span className="text-xs bg-blue-100 px-3 py-1 rounded-full font-semibold text-blue-700">
                                    {delivery.sales.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center text-sm text-gray-600 mb-1">
                                <MapPin size={16} className="mr-2 text-gray-400" />
                                <span className="font-medium">Pickup:</span>
                                <span className="ml-2">{delivery.pickup}</span>
                              </div>
                              <div className="flex items-center text-sm text-gray-600">
                                <MapPin size={16} className="mr-2 text-gray-400" />
                                <span className="font-medium">Dropoff:</span>
                                <span className="ml-2">{delivery.dropoff}</span>
                              </div>
                            </div>
                            <Badge status={delivery.status} size="md" />
                          </div>
                          {delivery.scheduled_date && delivery.scheduled_time && (
                            <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                              <div className="flex items-center gap-2 mb-2">
                                <CalendarIcon size={16} className="text-green-600" />
                                <p className="text-xs font-bold text-green-900">Schedule Confirmed</p>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">
                                {new Date(delivery.scheduled_date).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric'
                                })} at {delivery.scheduled_time}
                              </p>
                            </div>
                          )}
                          {delivery.notes && (
                            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                              <p className="text-sm text-gray-700">{delivery.notes}</p>
                            </div>
                          )}
                          <div className="flex gap-3 flex-wrap">
                            {(delivery.status === 'accepted' || delivery.status === 'assigned') && (
                              <button
                                onClick={() => handleUpdateStatus(delivery.id, 'in_progress')}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-sm hover:shadow-md"
                              >
                                Start Drive
                              </button>
                            )}
                            {delivery.status === 'in_progress' && (
                              <button
                                onClick={() => handleUpdateStatus(delivery.id, 'completed')}
                                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition shadow-sm hover:shadow-md"
                              >
                                Drive Complete
                              </button>
                            )}
                            <DeliveryCardWithChat
                              deliveryId={delivery.id}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Calendar
                      deliveries={upcomingDeliveries}
                      onDeliveryClick={(deliveryId) => navigate(`/chat/${deliveryId}`)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <CheckCircle2 size={28} className="mr-3 text-red-600" />
              Recent Drives
            </h2>

            {recentDeliveries.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No recent drives"
                description="Your completed deliveries will appear here"
              />
            ) : (
              <div className="space-y-4">
                {recentDeliveries.map((delivery) => (
                  <Card key={delivery.id}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-bold text-lg">VIN: {delivery.vin}</p>
                          <span className="text-xs bg-gray-100 px-3 py-1 rounded-full font-semibold text-gray-700">
                            {delivery.dealer.name}
                          </span>
                          {delivery.sales?.name && (
                            <span className="text-xs bg-blue-100 px-3 py-1 rounded-full font-semibold text-blue-700">
                              {delivery.sales.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <MapPin size={16} className="mr-2 text-gray-400" />
                          <span>{delivery.pickup} → {delivery.dropoff}</span>
                        </div>
                        {delivery.completed_at && (
                          <p className="text-xs text-gray-500 mt-2">
                            Completed on {new Date(delivery.completed_at).toLocaleDateString()} at {new Date(delivery.completed_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <Badge status="completed" size="md" />
                    </div>
                    {delivery.notes && (
                      <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-700">{delivery.notes}</p>
                      </div>
                    )}
                    <DeliveryCardWithChat
                      deliveryId={delivery.id}
                      buttonLabel="View Chat History"
                      buttonClass="w-full px-4 py-2.5 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg font-medium hover:bg-gray-200 transition flex items-center justify-center"
                    />
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <DealershipSearch driverId={driver.id} showToast={showToast} />
          </div>
        )}

        {activeTab === 'dealerships' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <MyDealerships
              approvedDealerships={approvedDealerships}
              dealershipColors={dealershipColors}
              onSelectDealership={setSelectedDealershipId}
              onNavigateToTab={setActiveTab}
            />
          </div>
        )}
      </div>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        driver={driver}
        onSave={handleSaveProfile}
      />
    </div>
  );
}
