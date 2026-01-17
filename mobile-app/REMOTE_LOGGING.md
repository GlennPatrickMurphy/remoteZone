# Remote Logging Setup

This app uses Firebase Firestore for remote logging, which allows you to view logs from TestFlight builds in real-time.

## How to View Logs

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `remotezone-c717d`
3. **Navigate to Firestore Database**
4. **Open the `app_logs` collection**
5. **View logs in real-time** - logs are automatically sent when events occur

## Log Structure

Each log entry contains:
- `level`: `debug`, `info`, `warn`, or `error`
- `message`: The log message
- `platform`: `ios` or `android`
- `platformVersion`: iOS/Android version
- `timestamp`: ISO timestamp
- `data`: Optional additional data (JSON string)

## Log Levels

- **DEBUG**: Detailed debugging information (e.g., retry attempts)
- **INFO**: General information (e.g., channel change initiated)
- **WARN**: Warnings (e.g., readiness check timeout)
- **ERROR**: Errors (e.g., channel change failed)

## Filtering Logs

In Firebase Console, you can:
- Filter by `level` to see only errors or warnings
- Filter by `platform` to see only iOS logs
- Sort by `timestamp` to see most recent logs first
- Search by `message` to find specific events

## Example Queries

To see all channel change attempts:
```
Filter: message contains "changeChannel"
```

To see only errors:
```
Filter: level == "error"
```

To see recent logs:
```
Sort by: timestamp (descending)
```

## Disabling Remote Logging

To disable remote logging (for development), edit `src/utils/remoteLogger.js`:
```javascript
const ENABLE_REMOTE_LOGGING = false;
```

## Log Retention

Logs are stored in Firestore. Consider:
- Setting up automatic deletion after 30 days
- Using Firestore rules to limit access
- Monitoring storage costs

## Troubleshooting

If logs aren't appearing:
1. Check Firebase connection in the app
2. Verify Firestore is enabled in Firebase Console
3. **Check Firestore security rules allow writes** - See "Setting Up Security Rules" below
4. Look for errors in the console about Firestore writes

## Setting Up Security Rules

If you see "Missing or insufficient permissions" errors, you need to update Firestore security rules:

### Option 1: Update Rules in Firebase Console (Quickest)

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: `remotezone-c717d`
3. Navigate to **Firestore Database** → **Rules**
4. Add this rule for `app_logs` collection:
   ```
   match /app_logs/{logId} {
     allow create: if true; // Allow anyone to create logs
     allow read: if request.auth != null; // Only authenticated users can read
     allow update, delete: if false; // Prevent updates/deletes
   }
   ```
5. Click **Publish** to save the rules

### Option 2: Deploy Rules File (Recommended for Production)

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize (if not already): `firebase init firestore`
4. Deploy rules: `firebase deploy --only firestore:rules`

The `firestore.rules` file in the project root contains the complete rules configuration.

