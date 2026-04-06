# Authentication Setup - Verification Guide

## Changes Made

### 1. Database Trigger for Automatic User Profile Creation
A trigger has been added that automatically creates a user profile in the `users` table when a new user signs up via Supabase Auth.

**Migration**: `004_fix_auth_policies.sql`

The trigger function `handle_new_user()` runs with `SECURITY DEFINER` privileges, which allows it to bypass RLS and automatically insert the user profile.

### 2. Updated AuthContext
The `AuthContext.tsx` has been updated to:
- Remove manual user profile creation (now handled by the trigger)
- Add retry logic with delays to handle race conditions
- Improve error handling and logging
- Wait for the trigger to create the user profile before proceeding

### 3. RLS Policies
The existing RLS policies ensure:
- Users can only read their own data
- Users can only update their own data
- Users can only insert their own data (validated by `auth.uid() = id`)

## How Authentication Works Now

### Sign Up Flow
1. User enters email and password
2. `supabase.auth.signUp()` is called
3. **Trigger automatically creates user profile** in `users` table
4. `loadUser()` is called with retry logic to wait for profile creation
5. User is redirected to Role Selection screen

### Sign In Flow
1. User enters email and password
2. `supabase.auth.signInWithPassword()` is called
3. `loadUser()` fetches the existing user profile
4. User is redirected based on their role:
   - No role → Role Selection
   - Customer → Customer Home
   - Driver → Driver Dashboard

## Testing Authentication

### Test Sign Up
```typescript
// The trigger will automatically create the user profile
// No manual insertion needed
const { error } = await signUp('test@example.com', 'password123');

// Wait a moment for the trigger to complete
// The loadUser function has built-in retry logic
```

### Test Sign In
```typescript
const { error } = await signIn('test@example.com', 'password123');
// Should load existing user profile immediately
```

## Troubleshooting

### Issue: "User profile not found after multiple attempts"
**Cause**: The trigger may not be firing or there's a database connection issue.

**Solution**: Check the trigger status:
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

### Issue: "Row level security policy violation"
**Cause**: RLS policy not allowing the operation.

**Solution**: Verify policies are in place:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users';
```

### Issue: Email confirmation required
**Note**: By default, Supabase requires email confirmation. If you're testing locally, you may want to disable this in the Supabase Dashboard:

1. Go to Authentication → Settings
2. Disable "Enable email confirmations"
3. Or check your email for the confirmation link

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT,
  role TEXT CHECK (role IN ('customer', 'driver', 'admin')),
  avatar_url TEXT,
  fcm_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Trigger Function
```sql
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Trigger
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## Summary

The authentication system is now properly configured with:
- Automatic user profile creation via database trigger
- Proper RLS policies for security
- Retry logic to handle race conditions
- Comprehensive error handling and logging

All authentication operations should now work correctly for both sign up and sign in flows.
