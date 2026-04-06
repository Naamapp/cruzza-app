import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, getCurrentUser } from '@/services/supabase';
import type { User, DriverProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  driverProfile: DriverProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserRole: (role: 'customer' | 'driver') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);

      if (session?.user) {
        await loadUser(session.user.id);
      } else {
        setUser(null);
        setDriverProfile(null);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const user = await getCurrentUser();
      setUser(user);
      if (user?.role === 'driver') {
        await loadDriverProfile(user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async (userId: string) => {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setUser(data);
        if (data?.role === 'driver') {
          await loadDriverProfile(userId);
        }
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.warn('User profile not found after multiple attempts');
  };

  const loadDriverProfile = async (userId: string) => {
    const { data } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    setDriverProfile(data);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      if (data.user) {
        await loadUser(data.user.id);
      }

      return { error: null };
    } catch (err) {
      console.error('Unexpected sign in error:', err);
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('Sign up error:', error);
        return { error };
      }

      if (data.user) {
        await loadUser(data.user.id);
      }

      return { error: null };
    } catch (err) {
      console.error('Unexpected sign up error:', err);
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDriverProfile(null);
  };

  const refreshUser = async () => {
    if (user?.id) {
      await loadUser(user.id);
    }
  };

  const setUserRole = async (role: 'customer' | 'driver') => {
    if (!user?.id) return;

    await supabase
      .from('users')
      .update({ role })
      .eq('id', user.id);

    if (role === 'driver') {
      // Create initial driver profile
      await supabase.from('driver_profiles').insert({
        id: user.id,
        city: '',
        rating: 5.0,
        total_trips: 0,
        documents_verified: false,
        payment_status: 'pending',
        subscription_amount: 30.00,
        is_online: false,
      });
    }

    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        driverProfile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshUser,
        setUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
