export interface User {
  id: string;
  email: string;
  phone?: string;
  full_name?: string;
  role: 'customer' | 'driver' | null;
  avatar_url?: string;
  created_at?: string;
}

export interface DriverProfile {
  id: string;
  city: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  license_plate?: string;
  rating: number;
  total_trips: number;
  documents_verified: boolean;
  payment_status: 'pending' | 'active' | 'failed';
  subscription_amount: number;
  subscription_renewal_date?: string;
  is_online: boolean;
  current_lat?: number;
  current_lng?: number;
  heading?: number;
  last_location_update?: string;
}

export interface Ride {
  id: string;
  customer_id: string;
  driver_id?: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  ride_type: 'economy' | 'executive' | 'xl' | 'delivery';
  status: 'searching' | 'driver_assigned' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
  fare: number;
  distance_km?: number;
  duration_min?: number;
  created_at: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
}

export interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  accuracy: number;
  is_online: boolean;
  updated_at: string;
}

export interface PaymentMandate {
  id: string;
  driver_id: string;
  gocardless_mandate_id?: string;
  gocardless_customer_id?: string;
  account_holder_name: string;
  sort_code: string;
  account_number: string;
  status: 'pending' | 'active' | 'cancelled';
  created_at: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RideType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  pricePerKm: number;
  eta: number;
  icon: string;
}

export interface DriverWallet {
  id: string;
  driver_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  can_withdraw: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  driver_id: string;
  type: 'earning' | 'withdrawal' | 'refund' | 'adjustment';
  amount: number;
  balance_after: number;
  reference?: string;
  ride_id?: string;
  status: 'pending' | 'completed' | 'failed';
  metadata?: any;
  created_at: string;
}

export interface DriverDocument {
  id: string;
  driver_id: string;
  document_type: 'license' | 'insurance' | 'pco' | 'vehicle';
  document_url: string;
  status: 'pending' | 'approved' | 'rejected';
  uploaded_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
}
