// ⭐ REQUIRED: Must be at the VERY TOP of the file
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { enableLayoutAnimations } from 'react-native-reanimated';

// Screens
import SplashScreen from '@/screens/SplashScreen';
import AuthScreen from '@/screens/auth/AuthScreen';
import RoleSelectScreen from '@/screens/auth/RoleSelectScreen';
import CustomerDrawerNavigator from '@/navigation/CustomerDrawerNavigator';
import DriverDashboardScreen from '@/screens/driver/DriverDashboardScreen';
import DriverOnboardingScreen from '@/screens/driver/DriverOnboardingScreen';

// Context
import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
    </Stack.Navigator>
  );
}

function DriverStack() {
  const { driverProfile } = require('@/context/AuthContext').useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {!driverProfile?.documents_verified ? (
        <Stack.Screen name="DriverOnboarding" component={DriverOnboardingScreen} />
      ) : (
        <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
      )}
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = require('@/context/AuthContext').useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      {!user ? (
        <Stack.Screen name="AuthStack" component={AuthStack} />
      ) : !user.role ? (
        <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      ) : user.role === 'customer' ? (
        <Stack.Screen
          name="CustomerApp"
          component={CustomerDrawerNavigator}
          options={{ gestureEnabled: false }}
        />
      ) : (
        <Stack.Screen name="DriverApp" component={DriverStack} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  // ⭐ REQUIRED for Drawer + Reanimated on Android
  enableLayoutAnimations(true);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AuthProvider>
          <LocationProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
            <StatusBar style="auto" />
          </LocationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
