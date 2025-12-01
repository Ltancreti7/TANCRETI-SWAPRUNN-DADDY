import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'dealer' | 'sales' | 'driver';

export interface Dealer {
  id: string;
  user_id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface Sales {
  id: string;
  user_id: string | null;
  dealer_id: string;
  name: string;
  email: string;
  phone: string;
  role?: string | null;
  status: 'pending_signup' | 'pending' | 'active' | 'inactive';
  invited_by?: string;
  invited_at?: string;
  accepted_at?: string;
  activated_at?: string;
  last_login?: string;
  password_changed: boolean;
  default_pickup_location?: string;
  default_pickup_street?: string;
  default_pickup_city?: string;
  default_pickup_state?: string;
  default_pickup_zip?: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  dealer_id: string;
  invitation_code: string;
  email: string;
  role: 'sales';
  invited_by_name?: string;
  expires_at: string;
  used: boolean;
  used_by?: string;
  created_at: string;
}

export interface Driver {
  id: string;
  user_id: string | null;
  dealer_id?: string;
  name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  license_number?: string;
  radius: number;
  status?: 'pending_signup' | 'active' | 'inactive';
  activated_at?: string;
  available_for_customer_deliveries: boolean;
  available_for_dealer_swaps: boolean;
  is_available: boolean;
  created_at: string;
}

export interface DriverApplication {
  id: string;
  driver_id: string;
  dealer_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  application_message?: string;
  reviewer_notes?: string;
  applied_at: string;
  reviewed_at?: string;
}

export interface ApprovedDriverDealer {
  id: string;
  driver_id: string;
  dealer_id: string;
  approved_at: string;
}

export type DeliveryTimeframe = 'tomorrow' | 'next_few_days' | 'next_week' | 'custom';

export interface Delivery {
  id: string;
  dealer_id: string;
  driver_id?: string;
  sales_id?: string;
  pickup: string;
  dropoff: string;
  pickup_street?: string;
  pickup_city?: string;
  pickup_state?: string;
  pickup_zip?: string;
  dropoff_street?: string;
  dropoff_city?: string;
  dropoff_state?: string;
  dropoff_zip?: string;
  vin: string;
  notes: string;
  status: 'pending' | 'accepted' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  year?: number;
  make?: string;
  model?: string;
  transmission?: string;
  service_type?: 'delivery' | 'swap';
  has_trade?: boolean;
  requires_second_driver?: boolean;
  required_timeframe?: DeliveryTimeframe;
  custom_date?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  schedule_confirmed_by?: string;
  schedule_confirmed_at?: string;
  chat_activated_at?: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  accepted_by?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
}

export interface AddressFields {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Message {
  id: string;
  delivery_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  delivery_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export type AdminRole = 'owner' | 'manager' | 'viewer';

export interface DealerAdmin {
  id: string;
  dealer_id: string;
  user_id: string;
  role: AdminRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string;
  created_at: string;
}

export interface AdminInvitation {
  id: string;
  dealer_id: string;
  email: string;
  role: AdminRole;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  created_at: string;
}

export interface DriverPreference {
  id: string;
  user_id: string;
  driver_id: string;
  dealer_id: string;
  preference_level: number;
  last_used_at: string;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface DriverStatistics {
  id: string;
  driver_id: string;
  dealer_id: string;
  total_deliveries: number;
  completed_deliveries: number;
  cancelled_deliveries: number;
  average_completion_time: string;
  on_time_percentage: number;
  last_delivery_at: string;
  created_at: string;
  updated_at: string;
}

export interface DriverWithStats extends Driver {
  statistics?: DriverStatistics;
  preference?: DriverPreference;
}
