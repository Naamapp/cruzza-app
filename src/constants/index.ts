export const COLORS = {
  primary: '#4f46e5',
  primaryDark: '#4338ca',
  secondary: '#7c3aed',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  background: '#f3f4f6',
  surface: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const RIDE_TYPES = [
  {
    id: 'economy',
    name: 'Cruzza Economy',
    description: 'Affordable everyday rides',
    basePrice: 3.50,
    pricePerKm: 1.20,
    eta: 2,
    icon: 'car-side',
  },
  {
    id: 'executive',
    name: 'Cruzza Executive',
    description: 'Premium vehicles & drivers',
    basePrice: 6.00,
    pricePerKm: 2.00,
    eta: 4,
    icon: 'car',
  },
  {
    id: 'xl',
    name: 'Cruzza XL',
    description: 'Spacious rides for groups',
    basePrice: 8.00,
    pricePerKm: 2.50,
    eta: 5,
    icon: 'van-shuttle',
  },
];

export const UK_CITIES = [
  { label: 'London', value: 'london' },
  { label: 'Manchester', value: 'manchester' },
  { label: 'Birmingham', value: 'birmingham' },
  { label: 'Leeds', value: 'leeds' },
  { label: 'Liverpool', value: 'liverpool' },
  { label: 'Newcastle', value: 'newcastle' },
  { label: 'Sheffield', value: 'sheffield' },
  { label: 'Bristol', value: 'bristol' },
  { label: 'Nottingham', value: 'nottingham' },
  { label: 'Leicester', value: 'leicester' },
  { label: 'Edinburgh', value: 'edinburgh' },
  { label: 'Glasgow', value: 'glasgow' },
  { label: 'Cardiff', value: 'cardiff' },
  { label: 'Belfast', value: 'belfast' },
];

export const MAP_CONFIG = {
  defaultLatitude: 51.5074,
  defaultLongitude: -0.1278,
  defaultLatitudeDelta: 0.0922,
  defaultLongitudeDelta: 0.0421,
};

export const SUBSCRIPTION_AMOUNT = 30.00;

export const API_ENDPOINTS = {
  GOCARDLESS: {
    CREATE_CUSTOMER: '/api/gocardless/customers',
    CREATE_MANDATE: '/api/gocardless/mandates',
    CREATE_PAYMENT: '/api/gocardless/payments',
    CREATE_SUBSCRIPTION: '/api/gocardless/subscriptions',
  },
};
