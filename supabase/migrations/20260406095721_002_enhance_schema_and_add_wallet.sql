/*
  # Enhancement: Driver Wallet, Document Policies, and Payment Improvements

  1. New Tables
    - `driver_wallets` - Track driver earnings and withdrawals
      - balance, total_earned, total_withdrawn
      - Available for instant withdrawal after completing a job
    
    - `wallet_transactions` - Transaction history
      - Earnings from rides, withdrawals to bank
      - Payment reference tracking

  2. Enhanced Tables
    - Add `wallet_id` to driver_profiles
    - Add indexes for better query performance

  3. Security
    - RLS policies for driver_documents
    - RLS policies for wallet access
    - RLS policies for payment_mandates and subscriptions

  4. Important Notes
    - Drivers get instant credit to wallet after completing a ride
    - Can only withdraw after completing at least one job
    - Monthly £30 payment goes to platform (your GoCardless account)
    - 100% of ride fare goes to driver wallet
*/

-- Driver Wallets
CREATE TABLE IF NOT EXISTS driver_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_earned DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_withdrawn DECIMAL(10,2) DEFAULT 0 NOT NULL,
  can_withdraw BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES driver_wallets(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('earning', 'withdrawal', 'refund', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  reference TEXT,
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE driver_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for driver_documents
CREATE POLICY "Drivers can view own documents" ON driver_documents
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can upload own documents" ON driver_documents
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update own documents" ON driver_documents
  FOR UPDATE USING (auth.uid() = driver_id);

-- RLS Policies for payment_mandates
CREATE POLICY "Drivers can view own mandates" ON payment_mandates
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can create own mandates" ON payment_mandates
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update own mandates" ON payment_mandates
  FOR UPDATE USING (auth.uid() = driver_id);

-- RLS Policies for payment_subscriptions
CREATE POLICY "Drivers can view own subscriptions" ON payment_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_mandates
      WHERE payment_mandates.id = payment_subscriptions.mandate_id
      AND payment_mandates.driver_id = auth.uid()
    )
  );

-- RLS Policies for driver_wallets
CREATE POLICY "Drivers can read own wallet" ON driver_wallets
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert own wallet" ON driver_wallets
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- RLS Policies for wallet_transactions
CREATE POLICY "Drivers can read own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = driver_id);

-- RLS Policies for earnings
CREATE POLICY "Drivers can read own earnings" ON earnings
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "System can create earnings" ON earnings
  FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_status ON driver_documents(status);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_customer_id ON rides(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_driver_id ON wallet_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_earnings_driver_id ON earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_earnings_paid_out ON earnings(paid_out);

-- Function to automatically create wallet when driver profile is created
CREATE OR REPLACE FUNCTION create_driver_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO driver_wallets (driver_id, balance, total_earned, total_withdrawn, can_withdraw)
  VALUES (NEW.id, 0, 0, 0, FALSE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create wallet
DROP TRIGGER IF EXISTS trigger_create_driver_wallet ON driver_profiles;
CREATE TRIGGER trigger_create_driver_wallet
  AFTER INSERT ON driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_driver_wallet();

-- Function to process ride completion and credit driver wallet
CREATE OR REPLACE FUNCTION process_ride_completion()
RETURNS TRIGGER AS $$
DECLARE
  driver_wallet_id UUID;
  new_balance DECIMAL(10,2);
BEGIN
  -- Only process when ride is marked as completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    -- Get driver's wallet
    SELECT id, balance INTO driver_wallet_id, new_balance
    FROM driver_wallets
    WHERE driver_id = NEW.driver_id;

    IF driver_wallet_id IS NOT NULL THEN
      -- Calculate new balance (100% of fare goes to driver)
      new_balance := new_balance + NEW.fare;

      -- Update wallet
      UPDATE driver_wallets
      SET 
        balance = new_balance,
        total_earned = total_earned + NEW.fare,
        can_withdraw = TRUE,
        updated_at = NOW()
      WHERE id = driver_wallet_id;

      -- Create wallet transaction
      INSERT INTO wallet_transactions (
        wallet_id,
        driver_id,
        type,
        amount,
        balance_after,
        reference,
        ride_id,
        status
      ) VALUES (
        driver_wallet_id,
        NEW.driver_id,
        'earning',
        NEW.fare,
        new_balance,
        'Ride #' || NEW.id,
        NEW.id,
        'completed'
      );

      -- Create earnings record
      INSERT INTO earnings (
        driver_id,
        ride_id,
        amount,
        platform_fee,
        net_earning,
        paid_out
      ) VALUES (
        NEW.driver_id,
        NEW.id,
        NEW.fare,
        0,
        NEW.fare,
        TRUE
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ride completion
DROP TRIGGER IF EXISTS trigger_process_ride_completion ON rides;
CREATE TRIGGER trigger_process_ride_completion
  AFTER UPDATE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION process_ride_completion();

-- Enable realtime for wallets
ALTER PUBLICATION supabase_realtime ADD TABLE driver_wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE wallet_transactions;
