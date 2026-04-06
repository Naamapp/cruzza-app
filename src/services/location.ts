import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { updateDriverLocation } from './supabase';
import type { Coordinates } from '@/types';

let locationSubscription: Location.LocationSubscription | null = null;

export const requestLocationPermissions = async (): Promise<boolean> => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    Alert.alert(
      'Location Permission Required',
      'Cruzza needs location access to find nearby drivers and track your ride.'
    );
    return false;
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

  return foregroundStatus === 'granted';
};

export const getCurrentLocation = async (): Promise<Coordinates | null> => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};

export const startLocationTracking = async (
  userId: string,
  onLocationUpdate?: (coords: Coordinates) => void
): Promise<boolean> => {
  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) return false;

    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      async (location) => {
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        // Update in Supabase
        await updateDriverLocation({
          id: userId,
          lat: coords.latitude,
          lng: coords.longitude,
          heading: location.coords.heading || 0,
          speed: location.coords.speed || 0,
          accuracy: location.coords.accuracy || undefined,
          is_online: true,
          updated_at: new Date().toISOString(),
        });

        onLocationUpdate?.(coords);
      }
    );

    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return false;
  }
};

export const stopLocationTracking = async (userId: string) => {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }

  // Update driver status to offline
  await updateDriverLocation({
    id: userId,
    is_online: false,
    updated_at: new Date().toISOString(),
  });
};

export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
  const dLon = (coord2.longitude - coord1.longitude) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.latitude * (Math.PI / 180)) *
      Math.cos(coord2.latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateETA = (distanceKm: number, averageSpeedKmh: number = 30): number => {
  return Math.ceil((distanceKm / averageSpeedKmh) * 60); // Returns minutes
};
