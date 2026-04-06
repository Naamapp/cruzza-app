import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/constants';

export default function CustomerProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.full_name || 'Not set'}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>

        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{user?.phone || 'Not set'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    elevation: 4,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
});
