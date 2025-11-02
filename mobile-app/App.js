import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';
import ConfigScreen from './src/screens/ConfigScreen';
import AuthScreen from './src/screens/AuthScreen';
import { RogersRemoteProvider } from './src/context/RogersRemoteContext';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <RogersRemoteProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
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
                title: '🏈 NFL Redzone',
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
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </RogersRemoteProvider>
  );
}
