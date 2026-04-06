import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/context/LocationContext';
import {
  updateDriverProfile,
  subscribeToNearbyRides,
  updateRideStatus,
} from '@/services/supabase';
import { COLORS, MAP_CONFIG } from '@/constants';
import type { Ride, Coordinates } from '@/types';
import polyline from '@mapbox/polyline';

const { height } = Dimensions.get('window');

type RidePhase =
  | 'idle'
  | 'assigned'
  | 'navigating_to_pickup'
  | 'arrived'
  | 'in_progress'
  | 'completed';

export default function DriverDashboardScreen() {
  const navigation = useNavigation();
  const { user, driverProfile, signOut } = useAuth();
  const { location, startTracking, stopTracking } = useLocation();

  const [isOnline, setIsOnline] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [trips, setTrips] = useState(0);
  const [hours, setHours] = useState(0);

  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [ridePhase, setRidePhase] = useState<RidePhase>('idle');
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);

  const [routeCoords, setRouteCoords] = useState<Coordinates[]>([]);
  const [eta, setEta] = useState<string>('');
  const [distance, setDistance] = useState<string>('');

  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(height * 0.4)).current;

  useEffect(() => {
    if (isOnline) {
      const subscription = subscribeToNearbyRides((ride) => {
        setAvailableRides((prev) => {
          // avoid duplicates
          if (prev.find((r) => r.id === ride.id)) return prev;
          return [...prev, ride];
        });
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isOnline]);

  useEffect(() => {
    // When we have an active ride, keep map focused on route
    if (currentRide && location) {
      if (ridePhase === 'assigned' || ridePhase === 'navigating_to_pickup') {
        buildRoute(location, {
          latitude: Number(currentRide.pickup_lat),
          longitude: Number(currentRide.pickup_lng),
        });
      } else if (ridePhase === 'in_progress') {
        buildRoute(
          {
            latitude: Number(currentRide.pickup_lat),
            longitude: Number(currentRide.pickup_lng),
          },
          {
            latitude: Number(currentRide.destination_lat),
            longitude: Number(currentRide.destination_lng),
          }
        );
      }
    }
  }, [currentRide, ridePhase, location]);

  const toggleOnlineStatus = async () => {
    if (!isOnline) {
      await startTracking(async (coords) => {
        try {
          await updateDriverProfile(user?.id!, {
            current_lat: coords.latitude,
            current_lng: coords.longitude,
            is_online: true,
            last_location_update: new Date().toISOString(),
          });

        } catch (e) {
          // silent
        }
      });

      if (true) {
        setIsOnline(true);
        Animated.spring(slideAnim, {
          toValue: height * 0.6,
          useNativeDriver: true,
        }).start();
      }
    } else {
      await stopTracking();
      await updateDriverProfile(user?.id!, {
        is_online: false,
      });
      setIsOnline(false);
      setAvailableRides([]);
      setCurrentRide(null);
      setRidePhase('idle');
      setRouteCoords([]);
      setEta('');
      setDistance('');
      Animated.spring(slideAnim, {
        toValue: height * 0.4,
        useNativeDriver: true,
      }).start();
    }
  };

  const buildRoute = async (origin: Coordinates, dest: Coordinates) => {
    try {
      const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!key) return;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&key=${key}`;

      const res = await fetch(url);
      const json = await res.json();

      if (!json.routes || !json.routes.length) return;

      const points = json.routes[0].overview_polyline.points;
      const decoded = polyline.decode(points).map((coords: number[]) => ({
        latitude: coords[0],
        longitude: coords[1],
      }));

      setRouteCoords(decoded);
      const leg = json.routes[0].legs[0];
      setDistance(leg.distance.text);
      setEta(leg.duration.text);

      mapRef.current?.fitToCoordinates(decoded, {
        edgePadding: { top: 120, bottom: 320, left: 80, right: 80 },
        animated: true,
      });
    } catch (e) {
      // silent fail
    }
  };

  const handleAcceptRide = async (ride: Ride) => {
    try {
      await updateRideStatus(ride.id, {
        status: 'driver_assigned',
        driver_id: user?.id,
        accepted_at: new Date().toISOString(),
      });

      setCurrentRide(ride);
      setRidePhase('assigned');
      setAvailableRides([]);

      if (location) {
        await buildRoute(location, {
          latitude: Number(ride.pickup_lat),
          longitude: Number(ride.pickup_lng),
        });
      }

      Alert.alert('Ride Accepted', `Pickup at ${ride.pickup_address}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to accept ride');
    }
  };

  const handleArrived = async () => {
    if (!currentRide) return;
    try {
      await updateRideStatus(currentRide.id, {
        status: 'driver_arrived',
      });

      setRidePhase('arrived');
    } catch (e) {
      Alert.alert('Error', 'Failed to update ride');
    }
  };

  const handleStartTrip = async () => {
    if (!currentRide) return;
    try {
      await updateRideStatus(currentRide.id, {
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });

      setRidePhase('in_progress');

      await buildRoute(
        {
          latitude: Number(currentRide.pickup_lat),
          longitude: Number(currentRide.pickup_lng),
        },
        {
          latitude: Number(currentRide.destination_lat),
          longitude: Number(currentRide.destination_lng),
        }
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to start trip');
    }
  };

  const handleCompleteTrip = async () => {
    if (!currentRide) return;
    try {
      await updateRideStatus(currentRide.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      setRidePhase('completed');
      setCurrentRide(null);
      setRouteCoords([]);
      setEta('');
      setDistance('');
      setTrips((t) => t + 1);
      setEarnings((e) => e + Number(currentRide.fare));

      Alert.alert(
        'Trip Completed',
        `£${currentRide.fare.toFixed(2)} has been credited to your wallet!`
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to complete trip');
    }
  };

  const handleLogout = async () => {
    if (isOnline) {
      await toggleOnlineStatus();
    }
    await signOut();
  };

  const hasActiveRide = !!currentRide && ridePhase !== 'completed';

  const renderPrimaryActionLabel = () => {
    if (!hasActiveRide) return '';
    switch (ridePhase) {
      case 'assigned':
      case 'navigating_to_pickup':
        return 'Arrived';
      case 'arrived':
        return 'Start Trip';
      case 'in_progress':
        return 'Complete Trip';
      default:
        return '';
    }
  };

  const handlePrimaryAction = () => {
    if (!hasActiveRide) return;
    if (ridePhase === 'assigned' || ridePhase === 'navigating_to_pickup') {
      handleArrived();
    } else if (ridePhase === 'arrived') {
      handleStartTrip();
    } else if (ridePhase === 'in_progress') {
      handleCompleteTrip();
    }
  };

  const currentPhaseLabel = () => {
    if (!hasActiveRide) return 'No active ride';
    switch (ridePhase) {
      case 'assigned':
      case 'navigating_to_pickup':
        return 'Heading to pickup';
      case 'arrived':
        return 'Arrived at pickup';
      case 'in_progress':
        return 'Trip in progress';
      default:
        return 'No active ride';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location?.latitude || MAP_CONFIG.defaultLatitude,
          longitude: location?.longitude || MAP_CONFIG.defaultLongitude,
          latitudeDelta: MAP_CONFIG.defaultLatitudeDelta,
          longitudeDelta: MAP_CONFIG.defaultLongitudeDelta,
        }}
      >
        {location && (
          <Marker coordinate={location}>
            <View style={styles.driverMarker}>
              <View style={styles.driverMarkerInner} />
            </View>
          </Marker>
        )}

        {availableRides.map((ride) => (
          <Marker
            key={ride.id}
            coordinate={{
              latitude: Number(ride.pickup_lat),
              longitude: Number(ride.pickup_lng),
            }}
          >
            <View style={styles.rideMarker}>
              <Text style={styles.rideMarkerText}>£{ride.fare.toFixed(0)}</Text>
            </View>
          </Marker>
        ))}

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
        <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
          <FontAwesome5 name="user" size={20} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.onlineButton,
            isOnline ? styles.onlineButtonActive : styles.onlineButtonInactive,
          ]}
          onPress={toggleOnlineStatus}
        >
          <FontAwesome5
            name="power-off"
            size={16}
            color={'white'}
          />
          <Text
            style={[
              styles.onlineButtonText,
              styles.onlineButtonTextActive,
            ]}
          >
            {isOnline ? 'ONLINE' : 'GO ONLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Earnings Card */}
      <View style={styles.earningsCard}>
        <View style={styles.earningsHeader}>
          <Text style={styles.earningsLabel}>Today's Earnings</Text>
          <View style={styles.earningsBadge}>
            <Text style={styles.earningsBadgeText}>+12%</Text>
          </View>
        </View>
        <Text style={styles.earningsAmount}>£{earnings.toFixed(2)}</Text>
        <View style={styles.earningsStats}>
          <View style={styles.stat}>
            <FontAwesome5 name="car" size={14} color={COLORS.textSecondary} />
            <Text style={styles.statText}>{trips} trips</Text>
          </View>
          <View style={styles.stat}>
            <FontAwesome5 name="clock" size={14} color={COLORS.textSecondary} />
            <Text style={styles.statText}>{hours} hrs</Text>
          </View>
        </View>
      </View>

      {/* Floating Active Ride Card (current app style) */}
      {hasActiveRide && (
        <View style={styles.activeRideCard}>
          <View style={styles.activeRideHeader}>
            <Text style={styles.activeRideStatus}>{currentPhaseLabel()}</Text>
            {eta && distance && (
              <Text style={styles.activeRideEta}>
                {eta} • {distance}
              </Text>
            )}
          </View>
          <Text style={styles.activeRideAddress} numberOfLines={1}>
            {ridePhase === 'in_progress'
              ? currentRide?.destination_address
              : currentRide?.pickup_address}
          </Text>
          <View style={styles.activeRideFooter}>
            <Text style={styles.activeRideFare}>
              £{currentRide?.fare.toFixed(2)}
            </Text>
            <TouchableOpacity
              style={styles.activeRideButton}
              onPress={handlePrimaryAction}
            >
              <Text style={styles.activeRideButtonText}>
                {renderPrimaryActionLabel()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handle} />

        {!isOnline ? (
          <View style={styles.offlineContent}>
            <View style={styles.offlineIcon}>
              <FontAwesome5 name="power-off" size={32} color={COLORS.textMuted} />
            </View>
            <Text style={styles.offlineTitle}>You're Offline</Text>
            <Text style={styles.offlineSubtitle}>
              Go online to start receiving ride requests
            </Text>
          </View>
        ) : hasActiveRide ? (
          <View style={styles.onlineContent}>
            <Text style={styles.sectionTitle}>Active Ride</Text>

            <View style={styles.rideCard}>
              <View style={styles.rideHeader}>
                <View>
                  <Text style={styles.rideDestination} numberOfLines={1}>
                    {currentRide?.destination_address}
                  </Text>
                  <Text style={styles.rideDistance}>
                    {eta && distance ? `${distance} • ${eta}` : 'Routing...'}
                  </Text>
                </View>
                <View style={styles.ridePrice}>
                  <Text style={styles.ridePriceText}>
                    £{currentRide?.fare.toFixed(2)}
                  </Text>
                  <Text style={styles.rideType}>
                    {currentRide?.ride_type}
                  </Text>
                </View>
              </View>

              <View style={styles.rideActions}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={handlePrimaryAction}
                >
                  <Text style={styles.acceptButtonText}>
                    {renderPrimaryActionLabel()}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.onlineContent}>
            <Text style={styles.sectionTitle}>Incoming Requests</Text>

            {availableRides.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="search" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>Looking for rides...</Text>
              </View>
            ) : (
              availableRides.map((ride) => (
                <View key={ride.id} style={styles.rideCard}>
                  <View style={styles.rideHeader}>
                    <View>
                      <Text style={styles.rideDestination} numberOfLines={1}>
                        {ride.destination_address}
                      </Text>
                      <Text style={styles.rideDistance}>
                        2.4 miles • 8 min away
                      </Text>
                    </View>
                    <View style={styles.ridePrice}>
                      <Text style={styles.ridePriceText}>
                        £{ride.fare.toFixed(2)}
                      </Text>
                      <Text style={styles.rideType}>
                        {ride.ride_type}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rideActions}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptRide(ride)}
                    >
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.declineButton}>
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </Animated.View>

      {/* Payment Lock Overlay */}
      {driverProfile?.payment_status !== 'active' && (
        <View style={styles.lockOverlay}>
          <View style={styles.lockContent}>
            <View style={styles.lockIcon}>
              <FontAwesome5 name="lock" size={48} color={COLORS.error} />
            </View>
            <Text style={styles.lockTitle}>Payment Required</Text>
            <Text style={styles.lockSubtitle}>
              £30 monthly subscription needed to access jobs
            </Text>
            <TouchableOpacity style={styles.lockButton}>
              <Text style={styles.lockButtonText}>Setup Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  onlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  onlineButtonInactive: {
    backgroundColor: COLORS.text,
  },
  onlineButtonActive: {
    backgroundColor: COLORS.success,
  },
  onlineButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  onlineButtonTextActive: {
    color: 'white',
  },
  driverMarker: {
    width: 24,
    height: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  driverMarkerInner: {
    width: 8,
    height: 8,
    backgroundColor: 'white',
    borderRadius: 4,
  },
  rideMarker: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'white',
  },
  rideMarkerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  earningsCard: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  earningsLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  earningsBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  earningsBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  earningsStats: {
    flexDirection: 'row',
    gap: 24,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  activeRideCard: {
    position: 'absolute',
    top: 180,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeRideStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeRideEta: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  activeRideAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  activeRideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeRideFare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  activeRideButton: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  activeRideButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
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
    minHeight: height * 0.4,
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
  offlineContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  offlineIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#f3f4f6',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  offlineSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  onlineContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  rideCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rideDestination: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    maxWidth: 200,
  },
  rideDistance: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  ridePrice: {
    alignItems: 'flex-end',
  },
  ridePriceText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  rideType: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  rideActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: COLORS.text,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockContent: {
    alignItems: 'center',
  },
  lockIcon: {
    width: 96,
    height: 96,
    backgroundColor: '#fee2e2',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  lockButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  lockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
