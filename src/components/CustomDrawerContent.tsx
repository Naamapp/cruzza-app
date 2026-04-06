import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/constants';

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { signOut, user } = useAuth();

  const displayName =
    user?.full_name ??
    user?.email?.split('@')[0] ??
    'Customer';

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Menu Items */}
      <TouchableOpacity
        style={styles.item}
        onPress={() => props.navigation.navigate('Profile')}
      >
        <Text style={styles.itemText}>Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => props.navigation.navigate('Bookings')}
      >
        <Text style={styles.itemText}>Past Bookings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => props.navigation.navigate('Payments')}
      >
        <Text style={styles.itemText}>Payment Methods</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => props.navigation.navigate('Support')}
      >
        <Text style={styles.itemText}>Support</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logout} onPress={() => signOut()}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 40,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  email: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  item: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  itemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  logout: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  logoutText: {
    fontSize: 16,
    color: COLORS.error,
    fontWeight: 'bold',
  },
});
