# Cruzza - Premium Ride Booking App

A modern, full-featured ride-hailing application built with React Native and Expo. Cruzza connects passengers with drivers in real-time, offering a premium experience for both customers and drivers.

![Cruzza App Preview](https://kimi-web-img.moonshot.cn/img/cdn.dribbble.com/d112d256168b556726c3dcd5f070608e993267b4.png)

## Features

### For Customers
- **Real-time Booking**: Book rides instantly with live driver tracking
- **Multiple Ride Types**: Choose from Economy, Executive, or XL vehicles
- **Live Tracking**: Watch your driver approach in real-time on the map
- **Fare Estimates**: Get upfront pricing before booking
- **Ride History**: View past trips and receipts
- **Secure Payments**: Integrated payment processing

### For Drivers
- **Go Online/Offline**: Control your availability with one tap
- **Real-time Requests**: Receive ride requests instantly
- **Navigation**: Built-in turn-by-turn directions
- **Earnings Tracking**: Monitor daily, weekly, and monthly earnings
- **Document Management**: Upload and manage required documents
- **Subscription Model**: £30/month for unlimited ride access (drivers keep 100% of fares)

## Tech Stack

- **Frontend**: React Native + Expo
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Payments**: GoCardless (Direct Debit)
- **Maps**: React Native Maps (Google Maps)
- **State Management**: Zustand + React Context
- **Location**: Expo Location
- **Notifications**: Expo Notifications

## Project Structure

```
cruzza-app/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # App screens
│   │   ├── auth/         # Authentication screens
│   │   ├── customer/     # Customer flow screens
│   │   └── driver/       # Driver flow screens
│   ├── services/         # API services
│   │   ├── supabase.ts   # Supabase client & functions
│   │   ├── location.ts   # Location services
│   │   └── gocardless.ts # Payment services
│   ├── context/          # React Context providers
│   ├── hooks/            # Custom React hooks
│   ├── constants/        # App constants
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── assets/               # Images, fonts, etc.
├── app.json              # Expo configuration
└── package.json          # Dependencies
```

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cruzza-app.git
cd cruzza-app
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Start the development server:
```bash
npx expo start
```

### Environment Variables

Create a `.env` file with the following:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
EXPO_PUBLIC_GOCARDLESS_ACCESS_TOKEN=your_gocardless_token
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key
```

## Database Schema

The app requires the following Supabase tables:

- `users` - User accounts
- `driver_profiles` - Driver-specific information
- `rides` - Ride bookings
- `driver_locations` - Real-time driver locations
- `payment_mandates` - GoCardless mandate storage
- `notifications` - Push notification records

See `supabase/migrations/` for full schema definitions.

## Deployment

### iOS
```bash
npx expo build:ios
```

### Android
```bash
npx expo build:android
```

### Web
```bash
npx expo export:web
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, email support@cruzza.com or join our Slack channel.
