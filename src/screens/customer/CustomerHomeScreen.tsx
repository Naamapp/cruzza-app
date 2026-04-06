import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/context/LocationContext';
import { createRide, subscribeToRideUpdates } from '@/services/supabase';
import { COLORS, RIDE_TYPES, MAP_CONFIG } from '@/constants';
import type { Ride, Coordinates } from '@/types';
import polyline from '@mapbox/polyline';

const { height } = Dimensions.get('window');

export default function CustomerHomeScreen() {
  const navigation = useNavigation<any>(); // ⭐ UPDATED so drawer methods work
  const { user, signOut } = useAuth();
  const { location, getCurrentLocation } = useLocation();

  const [pickup, setPickup] = useState<Coordinates | null>(null);
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [selectedRideType, setSelectedRideType] = useState('economy');
  const [isSearching, setIsSearching] = useState(false);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [estimatedFare, setEstimatedFare] = useState(0);

  // ⭐ NEW STATE FOR ROUTING
  const [routeCoords, setRouteCoords] = useState<Array<{latitude: number; longitude: number}>>([]);
  const [eta, setEta] = useState('');
  const [distance, setDistance] = useState('');

  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeLocation();
  }, []);

  useEffect(() => {
    if (currentRide) {
      const subscription = subscribeToRideUpdates(currentRide.id, (updatedRide) => {
        setCurrentRide(updatedRide);
        if (updatedRide.status === 'driver_assigned') {
          setIsSearching(false);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [currentRide]);

  const initializeLocation = async () => {
    const currentLoc = await getCurrentLocation();
    if (currentLoc) {
      setPickup(currentLoc);
      mapRef.current?.animateToRegion({
        ...currentLoc,
        latitudeDelta: MAP_CONFIG.defaultLatitudeDelta,
        longitudeDelta: MAP_CONFIG.defaultLongitudeDelta,
      });
    }
  };

  // ⭐ NEW: Fetch route + ETA + distance from Google Directions API
  const fetchRoute = async (origin: Coordinates, dest: Coordinates) => {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&key=${key}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!json.routes.length) return;

    const points = json.routes[0].overview_polyline.points;
    const decoded = polyline.decode(points).map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));

    setRouteCoords(decoded);
    setDistance(json.routes[0].legs[0].distance.text);
    setEta(json.routes[0].legs[0].duration.text);

    // Auto-fit route on map
    mapRef.current?.fitToCoordinates(decoded, {
      edgePadding: { top: 120, bottom: 300, left: 80, right: 80 },
      animated: true,
    });
  };

  const handleSetDestination = async (place: string, coords: Coordinates) => {
    setDestinationAddress(place);
    setDestination(coords);

    if (pickup) {
      await fetchRoute(pickup, coords);
      calculateFare(coords);
    }

    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const calculateFare = (dest: Coordinates) => {
    if (!pickup) return;

    const distanceKm =
      Math.sqrt(
        Math.pow(dest.latitude - pickup.latitude, 2) +
        Math.pow(dest.longitude - pickup.longitude, 2)
      ) * 111;

    const rideType = RIDE_TYPES.find(t => t.id === selectedRideType);
    if (rideType) {
      const fare = rideType.basePrice + (distanceKm * rideType.pricePerKm);
      setEstimatedFare(Math.round(fare * 100) / 100);
    }
  };

  const handleBookRide = async () => {
    if (!pickup || !destination) {
      Alert.alert('Error', 'Please select pickup and destination');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to book a ride');
      return;
    }

    setIsSearching(true);

    try {
      const { data, error } = await createRide({
        customer_id: user.id,
        pickup_lat: pickup.latitude,
        pickup_lng: pickup.longitude,
        pickup_address: 'Current Location',
        destination_lat: destination.latitude,
        destination_lng: destination.longitude,
        destination_address: destinationAddress,
        ride_type: selectedRideType as 'economy' | 'executive' | 'xl' | 'delivery',
        status: 'searching',
        fare: estimatedFare,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Ride creation error:', error);
        Alert.alert('Error', 'Failed to book ride. Please try again.');
        setIsSearching(false);
        return;
      }

      if (data) {
        setCurrentRide(data);
        Alert.alert('Success', 'Looking for nearby drivers!');
      }
    } catch (error: any) {
      console.error('Failed to book ride:', error);
      Alert.alert('Error', error?.message || 'Failed to book ride. Please try again.');
      setIsSearching(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (isSearching) {
    return (
      <View style={styles.searchingContainer}>
        <View style={styles.searchingAnimation}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
        <Text style={styles.searchingTitle}>Finding your driver...</Text>
        <Text style={styles.searchingSubtitle}>Connecting you with nearby drivers</Text>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setIsSearching(false)}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: MAP_CONFIG.defaultLatitude,
          longitude: MAP_CONFIG.defaultLongitude,
          latitudeDelta: MAP_CONFIG.defaultLatitudeDelta,
          longitudeDelta: MAP_CONFIG.defaultLongitudeDelta,
        }}
      >
        {pickup && (
          <Marker coordinate={pickup}>
            <View style={styles.pickupMarker}>
              <FontAwesome5 name="dot-circle" size={24} color={COLORS.success} />
            </View>
          </Marker>
        )}
        {destination && (
          <Marker coordinate={destination}>
            <View style={styles.destinationMarker}>
              <FontAwesome5 name="map-marker-alt" size={32} color={COLORS.error} />
            </View>
          </Marker>
        )}

        {/* ⭐ NEW: Polyline route */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor={COLORS.primary}
          />
        )}
      </MapView>

      {/* Top Bar */}
      <View style={styles.topBar}>
        {/* ⭐ UPDATED: Open Drawer instead of logout */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.openDrawer()}
        >
          <FontAwesome5 name="bars" size={20} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.locationBadge}>
          <FontAwesome5 name="location-arrow" size={14} color={COLORS.primary} />
          <Text style={styles.locationText}>
            {pickup ? 'Location found' : 'Locating...'}
          </Text>
        </View>

        <TouchableOpacity style={styles.iconButton}>
          <FontAwesome5 name="shield-alt" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [height * 0.3, 0],
              }),
            }],
          },
        ]}
      >
        <View style={styles.handle} />

        {/* Location Inputs */}
        <View style={styles.inputsContainer}>
          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: COLORS.textMuted }]} />
            <TextInput
              style={styles.input}
              placeholder="Current Location"
              value="Current Location"
              editable={false}
            />
          </View>

          <View style={[styles.inputRow, styles.destinationInput]}>
            <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
            <TextInput
              style={[styles.input, styles.destinationTextInput]}
              placeholder="Where to?"
              value={destinationAddress}
              onChangeText={setDestinationAddress}
            />
          </View>
        </View>

        {/* Recent Locations */}
        {!destination && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recentContainer}
            contentContainerStyle={styles.recentContent}
          >
            {['Heathrow Airport', "King's Cross", 'Canary Wharf', 'Shoreditch'].map((place) => (
              <TouchableOpacity
                key={place}
                style={styles.recentChip}
                onPress={() => handleSetDestination(place, {
                  latitude: 51.4700 + Math.random() * 0.1,
                  longitude: -0.4543 + Math.random() * 0.1,
                })}
              >
                <FontAwesome5 name="history" size={14} color={COLORS.primary} />
                <Text style={styles.recentText}>{place}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ⭐ NEW: ETA + Distance (A1 placement) */}
        {destination && eta && distance && (
          <Text style={styles.etaText}>
            ETA: {eta} • Distance: {distance}
          </Text>
        )}

        {/* Ride Types */}
        {destination && (
          <View style={styles.rideTypesContainer}>
            {RIDE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.rideTypeCard,
                  selectedRideType === type.id && styles.selectedRideType,
                ]}
                onPress={() => {
                  setSelectedRideType(type.id);
                  calculateFare(destination);
                }}
              >
                <View style={styles.rideTypeInfo}>
                  <View style={styles.rideIconContainer}>
                    <FontAwesome5 name={type.icon} size={20} color={COLORS.text} />
                  </View>
                  <View>
                    <Text style={styles.rideTypeName}>{type.name}</Text>
                    <Text style={styles.rideTypeEta}>{type.eta} min away</Text>
                  </View>
                </View>
                <Text style={styles.rideTypePrice}>
                  £{estimatedFare.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.bookButton}
              onPress={handleBookRide}
            >
              <Text style={styles.bookButtonText}>Confirm Booking</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    width: 48,
    height: 48,
    backgroundColor: 'white',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  locationText: {
    marginLeft: 8,
    fontWeight: '600',
    color: COLORS.text,
  },
  pickupMarker: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: COLORS.success,
  },
  destinationMarker: {
    alignItems: 'center',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: height * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 48,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    alignSelf: 'center',
    marginVertical: 12,
  },
  inputsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  destinationInput: {
    backgroundColor: COLORS.text,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  destinationTextInput: {
    color: 'white',
  },
  recentContainer: {
    maxHeight: 50,
  },
  recentContent: {
    gap: 10,
    paddingVertical: 4,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  recentText: {
    fontWeight: '600',
    color: COLORS.text,
  },

  // ⭐ NEW ETA TEXT STYLE
  etaText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },

  rideTypesContainer: {
    gap: 12,
  },
  rideTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  selectedRideType: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  rideTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rideIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideTypeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  rideTypeEta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rideTypePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  bookButton: {
    backgroundColor: COLORS.text,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchingContainer: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  searchingAnimation: {
    width: 120,
    height: 120,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  searchingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  searchingSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
