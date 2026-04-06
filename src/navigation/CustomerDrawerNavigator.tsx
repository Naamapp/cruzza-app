import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';

import CustomerHomeScreen from '@/screens/customer/CustomerHomeScreen';
import CustomerProfileScreen from '@/screens/customer/CustomerProfileScreen';
import CustomerBookingsScreen from '@/screens/customer/CustomerBookingsScreen';
import CustomerPaymentsScreen from '@/screens/customer/CustomerPaymentsScreen';
import CustomerSupportScreen from '@/screens/customer/CustomerSupportScreen';

import CustomDrawerContent from '@/components/CustomDrawerContent';

const Drawer = createDrawerNavigator();

export default function CustomerDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Drawer.Screen name="CustomerHome" component={CustomerHomeScreen} />
      <Drawer.Screen name="Profile" component={CustomerProfileScreen} />
      <Drawer.Screen name="Bookings" component={CustomerBookingsScreen} />
      <Drawer.Screen name="Payments" component={CustomerPaymentsScreen} />
      <Drawer.Screen name="Support" component={CustomerSupportScreen} />
    </Drawer.Navigator>
  );
}
