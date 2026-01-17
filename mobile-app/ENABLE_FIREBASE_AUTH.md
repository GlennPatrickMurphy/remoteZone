# How to Enable Firebase Authentication

## The Error
`Firebase: Error (auth/configuration-not-found)`

This error means Firebase Authentication is **not enabled** in your Firebase Console.

## Step-by-Step Fix

### 1. Go to Firebase Console
Open: https://console.firebase.google.com/project/remotezone-c717d/authentication

### 2. Enable Authentication
1. Click **"Get started"** button (if Authentication isn't enabled yet)
   - If you see "Get started", click it
   - If you don't see it, Auth is already enabled - skip to step 3

### 3. Enable Email/Password Sign-in Provider
1. Click the **"Sign-in method"** tab at the top
2. Find **"Email/Password"** in the list
3. Click on **"Email/Password"**
4. Toggle **"Enable"** to ON (should be the first toggle)
5. Click **"Save"**

### 4. Verify Setup
After enabling, you should see:
- ✅ "Email/Password" shows as "Enabled" in the Sign-in method list
- ✅ Users tab is now visible (may be empty, that's OK)

### 5. Restart Your App
```bash
cd mobile-app
npx expo start --clear
```

Then reload the app in your simulator/device.

## Alternative: Check via Firebase CLI (if installed)

```bash
firebase auth:export users.json --project remotezone-c717d
```

If this works, Auth is enabled. If you get an error saying Auth isn't enabled, you need to enable it in Console.

## Verification Checklist

Before testing the app, verify:
- [ ] Firebase Console open: https://console.firebase.google.com/project/remotezone-c717d/authentication
- [ ] Authentication is enabled (no "Get started" button)
- [ ] Email/Password sign-in method is enabled
- [ ] App restarted with `--clear` flag
- [ ] App reloaded in simulator/device

## Still Having Issues?

If Authentication is already enabled but you still get the error:

1. **Check your Firebase config** matches Firebase Console:
   - Go to Project Settings → Your apps → iOS app
   - Verify the config in `src/config/firebase.js` matches

2. **Verify API key isn't restricted**:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Check your API key restrictions

3. **Check project ID**:
   - Ensure `projectId: "remotezone-c717d"` matches your Firebase project

4. **Clear all caches**:
   ```bash
   cd mobile-app
   rm -rf node_modules/.cache .expo
   npx expo start --clear
   ```

## Quick Link
**Direct link to Authentication settings:**
https://console.firebase.google.com/project/remotezone-c717d/authentication/providers

