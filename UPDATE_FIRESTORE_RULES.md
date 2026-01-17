# How to Update Firestore Security Rules

## Quick Fix (Firebase Console)

1. Go to: https://console.firebase.google.com/project/remotezone-c717d/firestore/rules
2. Replace the rules with the content from `firestore.rules` file
3. Click **Publish**

## Using Firebase CLI

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

## What the Rules Do

- **app_logs**: Allows anyone to create logs (for TestFlight builds), but only authenticated users can read them
- **users**: Users can only read/write their own data
- **tvBoxRequests**: Authenticated users can create requests
- All other collections: Denied by default

## Testing

After updating rules, test by:
1. Running the app
2. Triggering a channel change
3. Checking Firebase Console → Firestore → `app_logs` collection
4. You should see logs appearing in real-time

