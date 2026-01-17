import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_MODE_KEY = '@debug_mode_enabled';

const DebugContext = createContext(null);

export const useDebug = () => {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within DebugProvider');
  }
  return context;
};

export const DebugProvider = ({ children }) => {
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    loadDebugMode();
  }, []);

  const loadDebugMode = async () => {
    try {
      const saved = await AsyncStorage.getItem(DEBUG_MODE_KEY);
      setDebugMode(saved === 'true');
      console.log('🔧 Debug mode loaded:', saved === 'true');
    } catch (error) {
      console.error('Error loading debug mode:', error);
    }
  };

  const toggleDebugMode = async (enabled) => {
    try {
      await AsyncStorage.setItem(DEBUG_MODE_KEY, enabled ? 'true' : 'false');
      setDebugMode(enabled);
      console.log(`🔧 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error saving debug mode:', error);
    }
  };

  return (
    <DebugContext.Provider value={{ debugMode, toggleDebugMode }}>
      {children}
    </DebugContext.Provider>
  );
};

