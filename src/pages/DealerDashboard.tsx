import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Plus,
  Truck,
  Users,
  UserCircle,
  Search,
  FileCheck,
  Shield,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useDebounce } from "../hooks/useDebounce";
import { supabase, Dealer, Delivery, Driver, Sales, DriverApplication, AdminRole, AddressFields } from "../lib/supabase";
import { AddressInput } from "../components/ui/AddressInput";
import { formatAddress } from "../lib/addressUtils";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { DashboardSkeleton } from "../components/ui/LoadingSkeleton";
import { ApplicationActionModal } from "../components/dealer/ApplicationActionModal";
import { ProfileHeader } from "../components/dealer/ProfileHeader";
import { EditDealerProfileModal } from "../components/dealer/EditDealerProfileModal";
import { AdminManagement } from "../components/dealer/AdminManagement";
import { DriverSelectionModal } from "../components/dealer/DriverSelectionModal";

export function DealerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<AdminRole | null>(null);
  const [activeTab, setActiveTab] = useState<
    "deliveries" | "drivers" | "sales" | "new" | "team" | "applications" | "admins"
  >("deliveries");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [salesTeam, setSalesTeam] = useState<Sales[]>([]);
  const [pendingSales, setPendingSales] = useState<Sales[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [driverApplications, setDriverApplications] = useState<(DriverApplication & { driver: Driver })[]>([]);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);
  const [newDelivery, setNewDelivery] = useState({
    pickupAddress: { street: '', city: '', state: '', zip: '' } as AddressFields,
    dropoffAddress: { street: '', city: '', state: '', zip: '' } as AddressFields,
    vin: "",
    notes: "",
    driverId: "",
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teamTab, setTeamTab] = useState<"sales" | "drivers">("sales");
  const [newTeamMember, setNewTeamMember] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    vehicle_type: "",
    radius: "50",
  });
  const [editingMember, setEditingMember] = useState<Sales | Driver | null>(null);
  const [editType, setEditType] = useState<"sales" | "driver" | null>(null);
  const [modalAction, setModalAction] = useState<{
    application: DriverApplication & { driver: Driver };
    action: 'approve' | 'reject' | 'followup';
  } | null>(null);
  const [showDriverSelection, setShowDriverSelection] = useState(false);

  useEffect(() => {
    if (user) {
      loadDealerData();
      loadCurrentUserRole();
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'applications') {
      setActiveTab('applications');
    }
  }, []);

  const loadCurrentUserRole = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("dealer_admins")
      .select("role, dealer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setCurrentUserRole(data.role as AdminRole);
      if (!dealer) {
        const { data: dealerData } = await supabase
          .from("dealers")
          .select("*")
          .eq("id", data.dealer_id)
          .maybeSingle();

        if (dealerData) {
          setDealer(dealerData);
        }
      }
    }
  };

  const loadDealerData = async () => {
    if (!user) return;

    setLoading(true);
    const { data: adminData } = await supabase
      .from("dealer_admins")
      .select("dealer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminData) {
      const { data: dealerData } = await supabase
        .from("dealers")
        .select("*")
        .eq("id", adminData.dealer_id)
        .maybeSingle();

      if (dealerData) {
        setDealer(dealerData);
        await Promise.all([
          loadDeliveries(dealerData.id),
          loadSalesTeam(dealerData.id),
          loadDrivers(dealerData.id),
          loadApplications(dealerData.id),
        ]);
      }
    } else {
      const { data: dealerData } = await supabase
        .from("dealers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!dealerData) {
        setLoading(false);
        navigate("/complete-profile");
        return;
      }
    }
    setLoading(false);
  };

  const loadDeliveries = async (dealerId: string) => {
    const { data } = await supabase
      .from("deliveries")
      .select("*")
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false });

    if (data) setDeliveries(data);
  };

  const loadDrivers = async (dealerId: string) => {
    // Get approved drivers from the junction table
    const { data: approvedDriverIds } = await supabase
      .from("approved_driver_dealers")
      .select("driver_id")
      .eq("dealer_id", dealerId);

    if (!approvedDriverIds || approvedDriverIds.length === 0) {
      setDrivers([]);
      setPendingDrivers([]);
      return;
    }

    const driverIds = approvedDriverIds.map(d => d.driver_id);

    const { data: activeData } = await supabase
      .from("drivers")
      .select("*")
      .in("id", driverIds)
      .eq("status", "active")
      .order("name");

    const { data: pendingData } = await supabase
      .from("drivers")
      .select("*")
      .in("id", driverIds)
      .eq("status", "pending_signup")
      .order("created_at", { ascending: false });

    if (activeData) setDrivers(activeData);
    if (pendingData) setPendingDrivers(pendingData);
  };

  const loadSalesTeam = async (dealerId: string) => {
    const { data: activeData } = await supabase
      .from("sales")
      .select("*")
      .eq("dealer_id", dealerId)
      .eq("status", "active")
      .order("name");

    const { data: pendingData } = await supabase
      .from("sales")
      .select("*")
      .eq("dealer_id", dealerId)
      .eq("status", "pending_signup")
      .order("created_at", { ascending: false });

    if (activeData) setSalesTeam(activeData);
    if (pendingData) setPendingSales(pendingData);
  };

  const loadApplications = async (dealerId: string) => {
    try {
      const { data, error } = await supabase
        .from("driver_applications")
        .select(`
          *,
          driver:drivers(*)
        `)
        .eq("dealer_id", dealerId)
        .order("applied_at", { ascending: false });

      if (error) {
        console.error("Error loading applications:", error);
        showToast("Failed to load driver applications", "error");
        return;
      }

      if (data) {
        const validApplications = data.filter(app => app.driver != null);

        if (validApplications.length !== data.length) {
          console.warn(`Found ${data.length - validApplications.length} applications with null driver data`);
        }

        setDriverApplications(validApplications as (DriverApplication & { driver: Driver })[]);
        const pendingCount = validApplications.filter(app => app.status === "pending").length;
        setPendingApplicationsCount(pendingCount);
      } else {
        setDriverApplications([]);
        setPendingApplicationsCount(0);
      }
    } catch (err: unknown) {
      console.error("Exception loading applications:", err);
      const message = err instanceof Error ? err.message : "Failed to load driver applications";
      showToast(message, "error");
      setDriverApplications([]);
      setPendingApplicationsCount(0);
    }
  };

  const handleApproveApplication = async (application: DriverApplication & { driver: Driver }) => {
    if (!dealer) return;

    try {
      await supabase
        .from("driver_applications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", application.id);

      await supabase.from("approved_driver_dealers").insert({
        driver_id: application.driver_id,
        dealer_id: dealer.id,
      });

      if (application.driver.user_id) {
        await supabase.from("notifications").insert({
          user_id: application.driver.user_id,
          delivery_id: null,
          type: "application_approved",
          title: "Application Approved",
          message: `Your application to ${dealer.name} has been approved! You can now accept deliveries from them.`,
          read: false,
        });
      }

      showToast(`${application.driver.name} approved successfully!`, "success");
      await loadApplications(dealer.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve application";
      showToast(message, "error");
    }
  };

  const handleRejectApplication = async (application: DriverApplication & { driver: Driver }, notes: string) => {
    if (!dealer) return;

    try {
      await supabase
        .from("driver_applications")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", application.id);

      if (application.driver.user_id && notes) {
        await supabase.from("notifications").insert({
          user_id: application.driver.user_id,
          delivery_id: null,
          type: "application_rejected",
          title: "Application Update",
          message: `Your application to ${dealer.name}: ${notes}`,
          read: false,
        });
      }

      showToast("Application rejected", "success");
      await loadApplications(dealer.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject application";
      showToast(message, "error");
    }
  };

  const handleFollowUpApplication = async (application: DriverApplication & { driver: Driver }, message: string) => {
    if (!dealer || !user) return;

    try {
      if (application.driver.user_id) {
        await supabase.from("notifications").insert({
          user_id: application.driver.user_id,
          delivery_id: null,
          type: "application_followup",
          title: `Message from ${dealer.name}`,
          message: message,
          read: false,
        });
      }

      showToast("Message sent to driver", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      showToast(message, "error");
    }
  };

  const handleModalConfirm = async (notes: string) => {
    if (!modalAction) return;

    const { application, action } = modalAction;

    if (action === 'approve') {
      await handleApproveApplication(application);
    } else if (action === 'reject') {
      await handleRejectApplication(application, notes);
    } else if (action === 'followup') {
      await handleFollowUpApplication(application, notes);
    }

    setModalAction(null);
  };


  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer) return;

    const pickupFormatted = formatAddress(newDelivery.pickupAddress);
    const dropoffFormatted = formatAddress(newDelivery.dropoffAddress);

    try {
      const { data: createdDeliveries, error } = await supabase
        .from("deliveries")
        .insert({
          dealer_id: dealer.id,
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
          status: newDelivery.driverId ? "pending_driver_acceptance" : "pending",
        })
        .select()
        .limit(1);

      if (error) throw error;

      const createdDelivery = createdDeliveries?.[0];

      const { data: availableDrivers, error: driversError } = await supabase
        .from("drivers")
        .select("user_id")
        .eq("dealer_id", dealer?.id || '')
        .eq("is_available", true);

      if (driversError) throw driversError;

      const notificationsPayload = (availableDrivers || [])
        .filter((driverRecord) => driverRecord.user_id)
        .map((driverRecord) => ({
          user_id: driverRecord.user_id,
          delivery_id: createdDelivery?.id ?? null,
          type: "new_delivery_available",
          title: "New Delivery Available",
          message:
            "A new delivery request has been created and is now available for drivers.",
          read: false,
        }));

      if (notificationsPayload.length > 0) {
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notificationsPayload);

        if (notificationError) throw notificationError;
      }

      showToast("Delivery created successfully!", "success");
      setNewDelivery({
        pickupAddress: { street: '', city: '', state: '', zip: '' },
        dropoffAddress: { street: '', city: '', state: '', zip: '' },
        vin: "",
        notes: "",
        driverId: "",
      });
      loadDeliveries(dealer.id);
      setActiveTab("deliveries");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create delivery";
      showToast(message, "error");
    }
  };

  const handleResendNotification = async (deliveryId: string) => {
    try {
      const { data: availableDrivers, error: driversError } = await supabase
        .from("drivers")
        .select("user_id")
        .eq("dealer_id", dealer?.id || '')
        .eq("is_available", true);

      if (driversError) throw driversError;

      const notificationsPayload = (availableDrivers || [])
        .filter((driverRecord) => driverRecord.user_id)
        .map((driverRecord) => ({
          user_id: driverRecord.user_id,
          delivery_id: deliveryId,
          type: "delivery_reminder",
          title: "Delivery Still Available",
          message:
            "A pending delivery is still available—claim it now before it is gone.",
          read: false,
        }));

      if (notificationsPayload.length === 0) {
        showToast("No drivers available to notify.", "info");
        return;
      }

      const { error } = await supabase
        .from("notifications")
        .insert(notificationsPayload);

      if (error) throw error;

      showToast("Notification resent to drivers!", "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to resend notification";
      showToast(message, "error");
    }
  };

  const handleUpdateDealerProfile = async (updatedData: Partial<Dealer>) => {
    if (!dealer) return;

    try {
      const { error } = await supabase
        .from("dealers")
        .update(updatedData)
        .eq("id", dealer.id);

      if (error) throw error;

      setDealer({ ...dealer, ...updatedData } as Dealer);
      showToast("Profile updated successfully!", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      showToast(message, "error");
      throw err;
    }
  };

  const getStats = () => {
    return {
      activeDeliveries: deliveries.filter(d => d.status !== 'completed' && d.status !== 'cancelled').length,
      salesTeamCount: salesTeam.length,
      driversCount: drivers.length,
      pendingApplications: pendingApplicationsCount,
    };
  };

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      delivery.vin.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      delivery.pickup.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      delivery.dropoff.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || delivery.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer) return;

    try {
      if (teamTab === "sales") {
        const { error: insertError } = await supabase.from("sales").insert({
          dealer_id: dealer.id,
          name: newTeamMember.name,
          email: newTeamMember.email,
          phone: newTeamMember.phone,
          role: newTeamMember.role || null,
          status: "pending_signup",
          user_id: null,
        });

        if (insertError) throw insertError;
        await loadSalesTeam(dealer.id);
        showToast(
          `${newTeamMember.name} has been added! They can now sign up at the public registration page using their email: ${newTeamMember.email}`,
          "success"
        );
      } else {
        const { error: insertError } = await supabase.from("drivers").insert({
          dealer_id: dealer.id,
          name: newTeamMember.name,
          email: newTeamMember.email,
          phone: newTeamMember.phone,
          vehicle_type: newTeamMember.vehicle_type,
          radius: parseInt(newTeamMember.radius),
          status: "pending_signup",
          user_id: null,
        });

        if (insertError) throw insertError;
        await loadDrivers(dealer.id);
        showToast(
          `${newTeamMember.name} has been added! They can now sign up at the public registration page using their email: ${newTeamMember.email}`,
          "success"
        );
      }

      setNewTeamMember({
        name: "",
        email: "",
        phone: "",
        role: "",
        vehicle_type: "",
        radius: "50",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to add team member";
      showToast(message, "error");
    }
  };

  const handleUpdateTeamMember = async () => {
    if (!editingMember || !editType || !dealer) return;

    try {
      if (editType === "sales") {
        const sales = editingMember as Sales;
        const { error } = await supabase
          .from("sales")
          .update({
            name: editingMember.name,
            email: editingMember.email,
            phone: editingMember.phone,
            role: sales.role || null,
          })
          .eq("id", editingMember.id);

        if (error) throw error;
        await loadSalesTeam(dealer.id);
        showToast("Salesperson updated successfully!", "success");
      } else {
        const driver = editingMember as Driver;
        const { error } = await supabase
          .from("drivers")
          .update({
            name: driver.name,
            email: driver.email,
            phone: driver.phone,
            vehicle_type: driver.vehicle_type,
            radius: driver.radius,
          })
          .eq("id", driver.id);

        if (error) throw error;
        await loadDrivers(dealer.id);
        showToast("Driver updated successfully!", "success");
      }

      setEditingMember(null);
      setEditType(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update team member";
      showToast(message, "error");
    }
  };

  const handleDeleteTeamMember = async (
    memberId: string,
    memberType: "sales" | "driver"
  ) => {
    if (!dealer) return;
    if (!confirm("Are you sure you want to remove this team member?")) return;

    try {
      const table = memberType === "sales" ? "sales" : "drivers";
      const { error } = await supabase.from(table).delete().eq("id", memberId);

      if (error) throw error;

      if (memberType === "sales") {
        await loadSalesTeam(dealer.id);
      } else {
        await loadDrivers(dealer.id);
      }

      showToast("Team member removed successfully!", "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove team member";
      showToast(message, "error");
    }
  };

  if (loading && !dealer) {
    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        <div className="bg-white shadow-md">
          <div className="container mx-auto px-4 py-8">
            <div className="h-24 w-full bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-32 w-full bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        <div className="bg-white shadow-md sticky top-16 z-40">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-3xl font-bold">Dealer profile not found</h1>
            <p className="text-gray-600 mt-2">
              We couldn&apos;t find your dealer profile. Please finish
              registration or contact support.
            </p>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <EmptyState
            icon={UserCircle}
            title="Complete your profile"
            description="Complete your dealer registration to access the dashboard features."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <ProfileHeader
        dealer={dealer!}
        currentUserRole={currentUserRole}
        stats={getStats()}
        onEditProfile={() => setShowEditProfile(true)}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab("deliveries")}
                className={`px-6 py-4 font-semibold transition ${
                  activeTab === "deliveries"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                Active Deliveries
              </button>
              <button
                onClick={() => setActiveTab("drivers")}
                className={`px-6 py-4 font-semibold transition ${
                  activeTab === "drivers"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                Available Drivers
              </button>
              <button
                onClick={() => setActiveTab("sales")}
                className={`px-6 py-4 font-semibold transition ${
                  activeTab === "sales"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                Sales Team
              </button>
              <button
                onClick={() => setActiveTab("new")}
                className={`px-6 py-4 font-semibold transition flex items-center ${
                  activeTab === "new"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                <Plus size={20} className="mr-2" />
                New Delivery
              </button>
              <button
                onClick={() => setActiveTab("team")}
                className={`px-6 py-4 font-semibold transition flex items-center ${
                  activeTab === "team"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                <Users size={20} className="mr-2" />
                Team Management
              </button>
              <button
                onClick={() => setActiveTab("applications")}
                className={`px-6 py-4 font-semibold transition flex items-center relative ${
                  activeTab === "applications"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                <FileCheck size={20} className="mr-2" />
                Driver Applications
                {pendingApplicationsCount > 0 && (
                  <span className="ml-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingApplicationsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("admins")}
                className={`px-6 py-4 font-semibold transition flex items-center ${
                  activeTab === "admins"
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                <Shield size={20} className="mr-2" />
                Administrators
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === "deliveries" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={20}
                    />
                    <input
                      type="text"
                      placeholder="Search by VIN, pickup, or dropoff..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {filteredDeliveries.length === 0 ? (
                  deliveries.length === 0 ? (
                    <EmptyState
                      icon={Truck}
                      title="No deliveries yet"
                      description="Create your first delivery to get started with SwapRunn"
                      action={{
                        label: "Create Delivery",
                        onClick: () => setActiveTab("new"),
                      }}
                    />
                  ) : (
                    <EmptyState
                      icon={Search}
                      title="No results found"
                      description="Try adjusting your search or filter criteria"
                    />
                  )
                ) : (
                  filteredDeliveries.map((delivery) => (
                    <Card key={delivery.id} hover>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">
                            VIN: {delivery.vin}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {delivery.pickup} → {delivery.dropoff}
                          </p>
                        </div>
                        <Badge status={delivery.status} />
                      </div>
                      {delivery.notes && (
                        <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded">
                          {delivery.notes}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {delivery.status === "pending" && (
                          <button
                            onClick={() =>
                              handleResendNotification(delivery.id)
                            }
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-100 transition"
                          >
                            Resend to Drivers
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/chat/${delivery.id}`)}
                          className="text-red-600 hover:text-red-700 text-sm font-semibold flex items-center transition"
                        >
                          <MessageCircle size={16} className="mr-1" />
                          Chat
                        </button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === "drivers" && (
              <div className="space-y-4">
                {drivers.length === 0 ? (
                  <EmptyState
                    icon={UserCircle}
                    title="No available drivers"
                    description="There are currently no drivers available in your area"
                  />
                ) : (
                  drivers.map((driver) => (
                    <Card key={driver.id}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{driver.name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {driver.email}
                          </p>
                          <p className="text-sm text-gray-600">
                            {driver.phone}
                          </p>
                          <div className="mt-3 flex gap-2 flex-wrap">
                            <span className="px-3 py-1 bg-gray-100 text-xs rounded-full font-medium">
                              {driver.vehicle_type}
                            </span>
                            <span className="px-3 py-1 bg-gray-100 text-xs rounded-full font-medium">
                              {driver.radius} mi radius
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === "sales" && (
              <div className="space-y-4">
                {salesTeam.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No sales team members yet"
                    description="Invite salespeople to join your team and start requesting deliveries"
                  />
                ) : (
                  salesTeam.map((sales) => (
                    <Card key={sales.id}>
                      <p className="font-semibold text-lg">{sales.name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {sales.email}
                      </p>
                      <p className="text-sm text-gray-600">{sales.phone}</p>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === "new" && (
              <>
                {currentUserRole === "viewer" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-800">
                      <strong>View-Only Access:</strong> You cannot create deliveries. Contact an owner or manager to create new delivery requests.
                    </p>
                  </div>
                )}
                <form onSubmit={handleCreateDelivery} className="space-y-4">
                  <div>
                    <AddressInput
                      label="Pickup Location"
                      value={newDelivery.pickupAddress}
                      onChange={(address) => setNewDelivery({ ...newDelivery, pickupAddress: address })}
                      required
                      disabled={currentUserRole === "viewer"}
                    />
                  </div>

                  <div>
                    <AddressInput
                      label="Dropoff Location"
                      value={newDelivery.dropoffAddress}
                      onChange={(address) => setNewDelivery({ ...newDelivery, dropoffAddress: address })}
                      required
                      disabled={currentUserRole === "viewer"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">VIN</label>
                    <input
                      type="text"
                      required
                      disabled={currentUserRole === "viewer"}
                      value={newDelivery.vin}
                      onChange={(e) =>
                        setNewDelivery({ ...newDelivery, vin: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Notes
                    </label>
                    <textarea
                      disabled={currentUserRole === "viewer"}
                      value={newDelivery.notes}
                      onChange={(e) =>
                        setNewDelivery({ ...newDelivery, notes: e.target.value })
                      }
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Assign Driver (Optional)
                    </label>
                    <button
                      type="button"
                      disabled={currentUserRole === "viewer"}
                      onClick={() => setShowDriverSelection(true)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-left hover:border-red-600 hover:bg-red-50 transition font-medium text-gray-700 hover:text-red-700 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-gray-100"
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
                      Choose from your preferred drivers based on performance and history
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={currentUserRole === "viewer"}
                    className={`w-full py-3 rounded-lg font-semibold transition ${
                      currentUserRole === "viewer"
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    Create Delivery
                  </button>
                </form>
              </>
            )}

            {activeTab === "applications" && (
              <div className="space-y-4">
                {currentUserRole === "viewer" ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-800">
                      <strong>View-Only Access:</strong> You can view driver applications but cannot approve, reject, or respond to them. Contact an owner or manager to take action on applications.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      <strong>Driver Applications:</strong> Review applications from drivers who want to work with your dealership. Approved drivers will be able to see and accept your delivery requests.
                    </p>
                  </div>
                )}

                {driverApplications.filter(app => app.status === "pending").length === 0 ? (
                  <EmptyState
                    icon={FileCheck}
                    title="No pending applications"
                    description="You'll see new driver applications here when they apply to work with your dealership"
                  />
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Pending Applications ({driverApplications.filter(app => app.status === "pending").length})
                    </h3>
                    {driverApplications
                      .filter(app => app.status === "pending" && app.driver)
                      .map((application) => {
                        if (!application.driver) return null;

                        return (
                          <Card key={application.id} className="mb-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="font-semibold text-lg">{application.driver.name}</p>
                                  <Badge status="pending" />
                                </div>
                                <p className="text-sm text-gray-600">{application.driver.email}</p>
                                <p className="text-sm text-gray-600">{application.driver.phone}</p>
                                {application.driver.license_number && (
                                  <p className="text-sm text-gray-600">License: {application.driver.license_number}</p>
                                )}
                                <div className="mt-3 flex gap-2 flex-wrap">
                                  <span className="px-3 py-1 bg-gray-100 text-xs rounded-full font-medium">
                                    {application.driver.vehicle_type}
                                  </span>
                                  <span className="px-3 py-1 bg-gray-100 text-xs rounded-full font-medium">
                                    {application.driver.radius} mi radius
                                  </span>
                                </div>
                                {application.application_message && (
                                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-700 font-medium mb-1">Application Message:</p>
                                    <p className="text-sm text-gray-600">{application.application_message}</p>
                                  </div>
                                )}
                                <p className="text-xs text-gray-500 mt-3">
                                  Applied {new Date(application.applied_at).toLocaleDateString()} at{" "}
                                  {new Date(application.applied_at).toLocaleTimeString()}
                                </p>
                              </div>
                              {currentUserRole !== "viewer" && (
                                <div className="flex flex-col gap-2 ml-4">
                                  <button
                                    onClick={() => setModalAction({ application, action: 'approve' })}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition whitespace-nowrap"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => setModalAction({ application, action: 'followup' })}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition whitespace-nowrap"
                                  >
                                    Follow Up
                                  </button>
                                  <button
                                    onClick={() => setModalAction({ application, action: 'reject' })}
                                    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition whitespace-nowrap"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                )}

                {(driverApplications.filter(app => app.status === "approved").length > 0 ||
                  driverApplications.filter(app => app.status === "rejected").length > 0) && (
                  <div className="mt-8 pt-6 border-t">
                    <h3 className="text-lg font-semibold mb-4">Application History</h3>
                    {driverApplications.filter(app => app.status === "approved").length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Approved</h4>
                        {driverApplications
                          .filter(app => app.status === "approved" && app.driver)
                          .map((application) => {
                            if (!application.driver) return null;

                            return (
                              <Card key={application.id} className="mb-3">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold">{application.driver.name}</p>
                                      <Badge status="completed" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Approved {new Date(application.reviewed_at || "").toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                      </div>
                    )}
                    {driverApplications.filter(app => app.status === "rejected").length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Rejected</h4>
                        {driverApplications
                          .filter(app => app.status === "rejected" && app.driver)
                          .map((application) => {
                            if (!application.driver) return null;

                            return (
                              <Card key={application.id} className="mb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold">{application.driver.name}</p>
                                    <Badge status="cancelled" />
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Rejected {new Date(application.reviewed_at || "").toLocaleDateString()}
                                  </p>
                                  {application.reviewer_notes && (
                                    <p className="text-sm text-gray-600 mt-2">
                                      Note: {application.reviewer_notes}
                                    </p>
                                  )}
                                </div>
                              </Card>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "admins" && (
              <AdminManagement dealerId={dealer.id} />
            )}

            {activeTab === "team" && (
              <div>
                <div className="border-b border-gray-200 mb-6">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setTeamTab("sales")}
                      className={`px-4 py-2 font-semibold transition ${
                        teamTab === "sales"
                          ? "text-red-600 border-b-2 border-red-600"
                          : "text-gray-600 hover:text-black"
                      }`}
                    >
                      Add Salesperson
                    </button>
                    <button
                      onClick={() => setTeamTab("drivers")}
                      className={`px-4 py-2 font-semibold transition ${
                        teamTab === "drivers"
                          ? "text-red-600 border-b-2 border-red-600"
                          : "text-gray-600 hover:text-black"
                      }`}
                    >
                      Add Driver
                    </button>
                  </div>
                </div>

                {currentUserRole === "viewer" ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-800">
                      <strong>View-Only Access:</strong> You have read-only access to team information. Contact an owner or manager to add or modify team members.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      <strong>How it works:</strong> Add team member details here. They can then visit the public sign-up page and create their own account using the email you provide.
                    </p>
                  </div>
                )}

                <form onSubmit={handleAddTeamMember} className="space-y-4 mb-8">
                  {teamTab === "sales" ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newTeamMember.name}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              name: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={newTeamMember.email}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              email: e.target.value,
                            })
                          }
                          placeholder="salesperson@example.com"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Phone
                        </label>
                        <input
                          type="tel"
                          required
                          value={newTeamMember.phone}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              phone: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Role / Title (optional)
                        </label>
                        <input
                          type="text"
                          value={newTeamMember.role}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              role: e.target.value,
                            })
                          }
                          placeholder="e.g., Sales Manager, Sales Associate"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newTeamMember.name}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              name: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          required
                          value={newTeamMember.email}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              email: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Phone
                        </label>
                        <input
                          type="tel"
                          required
                          value={newTeamMember.phone}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              phone: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>
                    </>
                  )}

                  {teamTab === "drivers" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Vehicle Type
                        </label>
                        <select
                          required
                          value={newTeamMember.vehicle_type}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              vehicle_type: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        >
                          <option value="">Select Vehicle Type</option>
                          <option value="car">Car</option>
                          <option value="truck">Truck</option>
                          <option value="trailer">Trailer</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Service Radius (miles)
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={newTeamMember.radius}
                          onChange={(e) =>
                            setNewTeamMember({
                              ...newTeamMember,
                              radius: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={currentUserRole === "viewer"}
                    className={`w-full py-3 rounded-lg font-semibold transition ${
                      currentUserRole === "viewer"
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    {teamTab === "sales" ? "Pre-Register Salesperson" : "Pre-Register Driver"}
                  </button>
                </form>

                <div className="border-t pt-6">
                  {teamTab === "sales" ? (
                    <>
                      {pendingSales.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-4">
                            Pending Sign-Up ({pendingSales.length})
                          </h3>
                          <div className="space-y-3">
                            {pendingSales.map((member) => (
                              <Card key={member.id}>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold">{member.name}</p>
                                      <Badge status="pending" />
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {member.email}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {member.phone}
                                    </p>
                                    {member.role && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        {member.role}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                      Added {new Date(member.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {currentUserRole !== "viewer" && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setEditingMember(member);
                                          setEditType("sales");
                                        }}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteTeamMember(member.id, "sales")
                                        }
                                        className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      <h3 className="text-lg font-semibold mb-4">
                        Active Sales Team ({salesTeam.length})
                      </h3>
                    </>
                  ) : (
                    <>
                      {pendingDrivers.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-4">
                            Pending Sign-Up ({pendingDrivers.length})
                          </h3>
                          <div className="space-y-3">
                            {pendingDrivers.map((driver) => (
                              <Card key={driver.id}>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold">{driver.name}</p>
                                      <Badge status="pending" />
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {driver.email}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {driver.phone}
                                    </p>
                                    <div className="mt-2 flex gap-2">
                                      <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                                        {driver.vehicle_type}
                                      </span>
                                      <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                                        {driver.radius} mi
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Added {new Date(driver.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {currentUserRole !== "viewer" && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setEditingMember(driver);
                                          setEditType("driver");
                                        }}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteTeamMember(driver.id, "driver")
                                        }
                                        className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      <h3 className="text-lg font-semibold mb-4">
                        Active Drivers ({drivers.length})
                      </h3>
                    </>
                  )}

                  <div className="space-y-3">
                    {teamTab === "sales"
                      ? salesTeam.map((member) => (
                          <Card key={member.id}>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{member.name}</p>
                                <p className="text-sm text-gray-600 truncate">
                                  {member.email}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {member.phone}
                                </p>
                                {member.role && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {member.role}
                                  </p>
                                )}
                              </div>
                              {currentUserRole !== "viewer" && (
                                <div className="flex gap-2 sm:flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingMember(member);
                                      setEditType("sales");
                                    }}
                                    className="flex-1 sm:flex-initial px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition touch-target"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteTeamMember(member.id, "sales")
                                    }
                                    className="flex-1 sm:flex-initial px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition touch-target"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))
                      : drivers.map((driver) => (
                          <Card key={driver.id}>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{driver.name}</p>
                                <p className="text-sm text-gray-600 truncate">
                                  {driver.email}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {driver.phone}
                                </p>
                                <div className="mt-2 flex gap-2">
                                  <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                                    {driver.vehicle_type}
                                  </span>
                                  <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                                    {driver.radius} mi
                                  </span>
                                </div>
                              </div>
                              {currentUserRole !== "viewer" && (
                                <div className="flex gap-2 sm:flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingMember(driver);
                                      setEditType("driver");
                                    }}
                                    className="flex-1 sm:flex-initial px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition touch-target"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteTeamMember(driver.id, "driver")
                                    }
                                    className="flex-1 sm:flex-initial px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition touch-target"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditProfile && (
        <EditDealerProfileModal
          dealer={dealer}
          onClose={() => setShowEditProfile(false)}
          onSave={handleUpdateDealerProfile}
        />
      )}

      {modalAction && (
        <ApplicationActionModal
          application={modalAction.application}
          action={modalAction.action}
          onClose={() => setModalAction(null)}
          onConfirm={handleModalConfirm}
        />
      )}

      {showDriverSelection && dealer && user && (
        <DriverSelectionModal
          isOpen={showDriverSelection}
          onClose={() => setShowDriverSelection(false)}
          onSelectDriver={(driverId) => {
            setNewDelivery({ ...newDelivery, driverId });
            setShowDriverSelection(false);
          }}
          dealerId={dealer.id}
          currentUserId={user.id}
          selectedDriverId={newDelivery.driverId}
        />
      )}

      {editingMember && editType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              Edit {editType === "sales" ? "Salesperson" : "Driver"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={editingMember.name}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={editingMember.email}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input
                  type="tel"
                  value={editingMember.phone}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, phone: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
              </div>
              {editType === "sales" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Role / Title (optional)
                  </label>
                  <input
                    type="text"
                    value={(editingMember as Sales).role || ""}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        role: e.target.value,
                      } as Sales)
                    }
                    placeholder="e.g., Sales Manager, Sales Associate"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  />
                </div>
              )}
              {editType === "driver" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Vehicle Type
                    </label>
                    <select
                      value={(editingMember as Driver).vehicle_type}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          vehicle_type: e.target.value,
                        } as Driver)
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    >
                      <option value="car">Car</option>
                      <option value="truck">Truck</option>
                      <option value="trailer">Trailer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Service Radius (miles)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={(editingMember as Driver).radius}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          radius: parseInt(e.target.value),
                        } as Driver)
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleUpdateTeamMember}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditingMember(null);
                    setEditType(null);
                  }}
                  className="flex-1 border border-gray-300 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
