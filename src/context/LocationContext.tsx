import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import type { Coordinates } from '@/types';

interface LocationContextType {
  location: Coordinates | null;
  heading: number | null;
  speed: number | null;
  error: string | null;
  loading: boolean;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<Coordinates | null>;
  startTracking: (callback?: (location: Coordinates) => void) => Promise<void>;
  stopTracking: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<Location.LocationSubscription | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        setError('Location permission denied');
        Alert.alert(
          'Location Permission Required',
          'Cruzza needs location access to find nearby drivers and track your ride.'
        );
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      return foregroundStatus === 'granted';
    } catch (err) {
      setError('Error requesting location permission');
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<Coordinates | null> => {
    try {
      setLoading(true);
      const hasPermission = await requestPermission();
      if (!hasPermission) return null;

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setLocation(coords);
      setHeading(currentLocation.coords.heading);
      setSpeed(currentLocation.coords.speed);
      setError(null);

      return coords;
    } catch (err) {
      setError('Error getting current location');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startTracking = async (callback?: (location: Coordinates) => void) => {
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;

      // Stop existing subscription if any
      if (subscription) {
        subscription.remove();
      }

      const newSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (newLocation) => {
          const coords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };

          setLocation(coords);
          setHeading(newLocation.coords.heading);
          setSpeed(newLocation.coords.speed);
          callback?.(coords);
        }
      );

      setSubscription(newSubscription);
    } catch (err) {
      setError('Error starting location tracking');
    }
  };

  const stopTracking = () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
  };

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        heading,
        speed,
        error,
        loading,
        requestPermission,
        getCurrentLocation,
        startTracking,
        stopTracking,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
