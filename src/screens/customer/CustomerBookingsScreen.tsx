import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants';

export default function CustomerBookingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Past Bookings</Text>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Your past rides will appear here.
        </Text>
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
  placeholder: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    elevation: 4,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
