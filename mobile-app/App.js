import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { DebugProvider } from './src/context/DebugContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ConfigScreen from './src/screens/ConfigScreen';
import AuthScreen from './src/screens/AuthScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { RogersRemoteProvider } from './src/context/RogersRemoteContext';
import { initLogger } from './src/utils/remoteLogger';

const Stack = createNativeStackNavigator();

// App Navigator - handles routing based on auth state
const AppNavigator = () => {
  const { user, userProfile, loading, signIn, signUp, updateUserProfile } = useAuth();

  const handleSignIn = async (email, password, isSignUp) => {
    if (isSignUp) {
      return await signUp(email, password);
    } else {
      return await signIn(email, password);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.footballEmoji}>🏈</Text>
      </View>
    );
  }

  // Not authenticated - show login
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login">
          {({ navigation }) => (
            <LoginScreen
              navigation={navigation}
              onSignIn={handleSignIn}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  // Authenticated - show main app (TV provider selection removed, can be changed in Profile/Settings)
  return (
    <RogersRemoteProvider>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#667eea',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Redzone Controller',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Config"
          component={ConfigScreen}
          options={{
            title: 'Configuration',
          }}
        />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{
            title: 'Authentication',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Profile',
          }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile',
          }}
        />
      </Stack.Navigator>
    </RogersRemoteProvider>
  );
};

// Main App Component
export default function App() {
  useEffect(() => {
    // Initialize remote logger
    initLogger().catch(err => {
      console.error('Failed to initialize remote logger:', err);
    });

    // Initialize AdMob - wrap in try-catch to handle cases where module isn't available
    try {
      if (mobileAds && typeof mobileAds === 'function') {
        mobileAds()
          .initialize()
          .then(adapterStatuses => {
            console.log('✅ AdMob initialized successfully');
          })
          .catch(error => {
            console.error('❌ AdMob initialization error:', error);
            // Don't crash the app if AdMob fails to initialize
          });
      }
    } catch (error) {
      console.error('❌ AdMob module not available:', error);
      // Continue without AdMob if module isn't available
    }
  }, []);

  return (
    <DebugProvider>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthProvider>
    </DebugProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  footballEmoji: {
    fontSize: 80,
  },
});
