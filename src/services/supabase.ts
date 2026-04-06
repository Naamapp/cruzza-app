import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, DriverProfile, Ride, DriverLocation } from '@/types';

const supabaseUrl = 'https://gzjdhsawlfpyovztzged.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6amRoc2F3bGZweW92enR6Z2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjU1NjcsImV4cCI6MjA5MTAwMTU2N30.EncHrP47LAobZS1EJIGoF0hgdxUY2Q29keGcz4B2wiU';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth functions
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) {
    await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      role: null,
    });
    const { data: newUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    return newUser;
  }

  return data;
};

// Driver profile functions
export const getDriverProfile = async (userId: string): Promise<DriverProfile | null> => {
  const { data } = await supabase
    .from('driver_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data;
};

export const updateDriverProfile = async (userId: string, updates: Partial<DriverProfile>) => {
  const { data, error } = await supabase
    .from('driver_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
};

export const createDriverProfile = async (profile: Partial<DriverProfile>) => {
  const { data, error } = await supabase
    .from('driver_profiles')
    .insert(profile)
    .select()
    .single();
  return { data, error };
};

// Ride functions
export const createRide = async (ride: Partial<Ride>) => {
  const { data, error } = await supabase
    .from('rides')
    .insert(ride)
    .select()
    .single();
  return { data, error };
};

export const updateRide = async (rideId: string, updates: Partial<Ride>) => {
  const { data, error } = await supabase
    .from('rides')
    .update(updates)
    .eq('id', rideId)
    .select()
    .single();
  return { data, error };
};

export const getRideById = async (rideId: string): Promise<Ride | null> => {
  const { data } = await supabase
    .from('rides')
    .select('*')
    .eq('id', rideId)
    .maybeSingle();
  return data;
};

// Location functions
export const updateDriverLocation = async (location: Partial<DriverLocation>) => {
  const { data, error } = await supabase
    .from('driver_locations')
    .upsert(location)
    .select()
    .single();
  return { data, error };
};

// Real-time subscriptions
export const subscribeToRideUpdates = (rideId: string, callback: (ride: Ride) => void) => {
  return supabase
    .channel(`ride-${rideId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      },
      (payload) => {
        callback(payload.new as Ride);
      }
    )
    .subscribe();
};

export const subscribeToDriverLocation = (driverId: string, callback: (location: DriverLocation) => void) => {
  return supabase
    .channel(`driver-location-${driverId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'driver_locations',
        filter: `id=eq.${driverId}`,
      },
      (payload) => {
        callback(payload.new as DriverLocation);
      }
    )
    .subscribe();
};

export const subscribeToNearbyRides = (callback: (ride: Ride) => void) => {
  return supabase
    .channel('nearby-rides')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rides',
        filter: `status=eq.searching`,
      },
      (payload) => {
        callback(payload.new as Ride);
      }
    )
    .subscribe();
};

// Update ride status
export const updateRideStatus = async (rideId: string, updates: {
  status?: Ride['status'];
  driver_id?: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
}) => {
  const { data, error } = await supabase
    .from('rides')
    .update(updates)
    .eq('id', rideId)
    .select()
    .single();
  return { data, error };
};

// Document upload functions
export const uploadDocument = async (
  driverId: string,
  documentType: 'license' | 'insurance' | 'pco' | 'vehicle',
  file: { uri: string; name: string; type: string }
) => {
  try {
    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${driverId}/${documentType}-${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('driver-documents')
      .upload(fileName, {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('driver-documents')
      .getPublicUrl(fileName);

    // Create document record
    const { data, error } = await supabase
      .from('driver_documents')
      .insert({
        driver_id: driverId,
        document_type: documentType,
        document_url: publicUrl,
        status: 'pending',
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getDriverDocuments = async (driverId: string) => {
  const { data, error } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', driverId)
    .order('uploaded_at', { ascending: false });
  return { data, error };
};

// Payment mandate functions
export const createPaymentMandate = async (mandate: {
  driver_id: string;
  gocardless_mandate_id: string;
  gocardless_customer_id: string;
  account_holder_name: string;
  sort_code: string;
  account_number: string;
  status: string;
}) => {
  const { data, error } = await supabase
    .from('payment_mandates')
    .insert(mandate)
    .select()
    .single();
  return { data, error };
};

export const createPaymentSubscription = async (subscription: {
  mandate_id: string;
  gocardless_subscription_id: string;
  amount: number;
  currency: string;
  status: string;
  next_charge_date: string;
}) => {
  const { data, error } = await supabase
    .from('payment_subscriptions')
    .insert(subscription)
    .select()
    .single();
  return { data, error };
};

export const getDriverMandate = async (driverId: string) => {
  const { data, error } = await supabase
    .from('payment_mandates')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .maybeSingle();
  return { data, error };
};

// Wallet functions
export const getDriverWallet = async (driverId: string) => {
  const { data, error } = await supabase
    .from('driver_wallets')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle();
  return { data, error };
};

export const getWalletTransactions = async (driverId: string) => {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });
  return { data, error };
};

export const requestWithdrawal = async (
  driverId: string,
  amount: number
) => {
  try {
    // Get wallet
    const { data: wallet, error: walletError } = await getDriverWallet(driverId);
    if (walletError || !wallet) throw new Error('Wallet not found');

    if (!wallet.can_withdraw) {
      throw new Error('Complete at least one job before withdrawing');
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Create withdrawal transaction (pending until processed)
    const newBalance = Number(wallet.balance) - amount;

    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        driver_id: driverId,
        type: 'withdrawal',
        amount: -amount,
        balance_after: newBalance,
        reference: `Withdrawal ${new Date().toISOString()}`,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Update wallet balance
    await supabase
      .from('driver_wallets')
      .update({
        balance: newBalance,
        total_withdrawn: Number(wallet.total_withdrawn) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const subscribeToWallet = (driverId: string, callback: (wallet: any) => void) => {
  return supabase
    .channel(`wallet-${driverId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'driver_wallets',
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();
};
