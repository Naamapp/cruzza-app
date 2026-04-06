import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/constants';

type RootStackParamList = {
  RoleSelect: undefined;
  CustomerHome: undefined;
  DriverOnboarding: undefined;
};

export default function RoleSelectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setUserRole } = useAuth();

  const handleRoleSelect = async (role: 'customer' | 'driver') => {
    await setUserRole(role);
    // Navigation will be handled automatically by RootNavigator when user.role changes
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>I want to...</Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleRoleSelect('customer')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: COLORS.text }]}>
            <FontAwesome5 name="user" size={28} color="white" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Book a Ride</Text>
            <Text style={styles.optionSubtitle}>I'm a passenger</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, styles.driverCard]}
          onPress={() => handleRoleSelect('driver')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: COLORS.primary }]}>
            <FontAwesome5 name="car" size={28} color="white" />
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, { color: 'white' }]}>Drive & Earn</Text>
            <Text style={[styles.optionSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              I'm a driver
            </Text>
          </View>
          <FontAwesome5 name="chevron-right" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 32,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  driverCard: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
