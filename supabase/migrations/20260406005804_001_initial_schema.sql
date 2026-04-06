/*
  # Cruzza Initial Database Schema

  1. New Tables
    - `users` - User accounts (customers, drivers, admins)
      - Links to auth.users
      - Stores role, profile info, FCM tokens
    
    - `driver_profiles` - Driver-specific information
      - Vehicle details, ratings, subscription status
      - Real-time location and online status
    
    - `driver_documents` - Driver verification documents
      - License, insurance, PCO, vehicle docs
      - Status tracking for approval workflow
    
    - `payment_mandates` - GoCardless Direct Debit mandates
      - Bank account details
      - Mandate status tracking
    
    - `payment_subscriptions` - Active driver subscriptions
      - £30/month subscription tracking
      - Next charge dates
    
    - `rides` - Ride bookings
      - Pickup and destination coordinates
      - Status tracking (searching → completed)
      - Fare and timing information
    
    - `driver_locations` - Real-time driver positions
      - GPS coordinates, heading, speed
      - Online/offline status
    
    - `messages` - In-ride messaging
      - Customer-driver communication
    
    - `notifications` - Push notification records
      - Notification history and read status
    
    - `earnings` - Driver earnings tracking
      - Per-ride earnings
      - Platform fees (currently £0)

  2. Security
    - Enable RLS on all tables
    - Users can read/update their own data
    - Customers can create rides
    - Drivers can update assigned rides
    - Public can view online driver locations
    - Drivers can update their own location

  3. Realtime
    - Enable realtime for driver_locations
    - Enable realtime for rides
    - Enable realtime for messages

  4. Important Notes
    - Drivers keep 100% of fares (platform_fee = 0)
    - Subscription model: £30/month via GoCardless
    - All coordinates stored as DECIMAL for precision
    - Timestamps with timezone for accurate tracking
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT,
  role TEXT CHECK (role IN ('customer', 'driver', 'admin')),
  avatar_url TEXT,
  fcm_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  license_plate TEXT,
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_trips INTEGER DEFAULT 0,
  documents_verified BOOLEAN DEFAULT FALSE,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'active', 'failed')),
  subscription_amount DECIMAL(10,2) DEFAULT 30.00,
  subscription_renewal_date TIMESTAMP WITH TIME ZONE,
  is_online BOOLEAN DEFAULT FALSE,
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  heading DECIMAL(5, 2),
  last_location_update TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver documents
CREATE TABLE IF NOT EXISTS driver_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT CHECK (document_type IN ('license', 'insurance', 'pco', 'vehicle')),
  document_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT
);

-- Payment mandates (GoCardless)
CREATE TABLE IF NOT EXISTS payment_mandates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  gocardless_mandate_id TEXT,
  gocardless_customer_id TEXT,
  account_holder_name TEXT NOT NULL,
  sort_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment subscriptions
CREATE TABLE IF NOT EXISTS payment_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mandate_id UUID REFERENCES payment_mandates(id) ON DELETE CASCADE,
  gocardless_subscription_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'GBP',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  next_charge_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rides
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pickup_lat DECIMAL(10, 8) NOT NULL,
  pickup_lng DECIMAL(11, 8) NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_lat DECIMAL(10, 8) NOT NULL,
  destination_lng DECIMAL(11, 8) NOT NULL,
  destination_address TEXT NOT NULL,
  ride_type TEXT CHECK (ride_type IN ('economy', 'executive', 'xl', 'delivery')),
  status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'driver_assigned', 'driver_arrived', 'in_progress', 'completed', 'cancelled')),
  fare DECIMAL(10,2) NOT NULL,
  distance_km DECIMAL(6, 2),
  duration_min INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT
);

-- Driver locations (real-time)
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  heading DECIMAL(5, 2),
  speed DECIMAL(5, 2),
  accuracy DECIMAL(6, 2),
  is_online BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  type TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Earnings
CREATE TABLE IF NOT EXISTS earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  net_earning DECIMAL(10,2) NOT NULL,
  paid_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own data
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Driver profiles
CREATE POLICY "Drivers can read own profile" ON driver_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Drivers can update own profile" ON driver_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Drivers can insert own profile" ON driver_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Rides
CREATE POLICY "Users can read own rides" ON rides
  FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = driver_id);

CREATE POLICY "Customers can create rides" ON rides
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Drivers can update assigned rides" ON rides
  FOR UPDATE USING (auth.uid() = driver_id);

-- Driver locations (public for online drivers)
CREATE POLICY "Public can read online driver locations" ON driver_locations
  FOR SELECT USING (is_online = TRUE);

CREATE POLICY "Drivers can update own location" ON driver_locations
  FOR ALL USING (auth.uid() = id);

-- Notifications
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Messages
CREATE POLICY "Users can read ride messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rides 
      WHERE rides.id = messages.ride_id 
      AND (rides.customer_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

CREATE POLICY "Users can send ride messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE rides;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();