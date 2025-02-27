# Firebase Authentication Setup

This project uses Firebase Authentication for user management. To set up Firebase authentication in your local development environment, follow these steps:

## Client-Side Setup (Browser)

1. Create a `.env.local` file in the root of your project
2. Copy the contents of `.env.local.example` to `.env.local`
3. Fill in the Firebase configuration values from your Firebase project settings:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps" section
   - Copy the configuration values into your `.env.local` file

## Server-Side Setup (Admin SDK)

The server-side Firebase Admin SDK requires a service account key:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > Service Accounts
4. Click "Generate new private key"
5. Save the downloaded JSON file as `src/config/secrets/serviceAccountKey.json`

## Firebase Analytics

This project also includes Firebase Analytics integration:

1. Ensure that `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is set in your `.env.local` file
2. Analytics is automatically initialized in browser environments
3. You can track custom events using the Firebase Analytics API:

```jsx
import { getAnalytics, logEvent } from 'firebase/analytics';
import { app } from '@/config/firebaseClient';

// Track a custom event
const analytics = getAnalytics(app);
logEvent(analytics, 'button_click', { button_name: 'sign_in' });
```

## Security Notes

- **NEVER** commit your `.env.local` file or `serviceAccountKey.json` to your repository
- Both files are included in `.gitignore` to prevent accidental commits
- For production deployment, set these values as environment variables in your hosting platform
- For Vercel deployment, add all the `NEXT_PUBLIC_FIREBASE_*` variables in the Environment Variables section of your project settings

## Authentication Features

The authentication system provides the following features:

- Email/password authentication
- Google sign-in
- Sign up/sign in forms
- Authentication state management
- Password reset
- Protected routes

You can use the `useAuth()` hook in your components to access authentication functions and the current user state:

```jsx
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user, loading, login, logout } = useAuth();

  // Now you can use these values and functions
}
```

For more information, refer to the [Firebase Authentication documentation](https://firebase.google.com/docs/auth). 