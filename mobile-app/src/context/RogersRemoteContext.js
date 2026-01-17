import React, { createContext, useState, useRef, useContext, useEffect } from 'react';
import { View, StyleSheet, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RogersRemoteWebView from '../components/RogersRemoteWebView';
import { useDebug } from './DebugContext';
import { logInfo, logError, logWarn, logDebug } from '../utils/remoteLogger';

// Remote provider URLs
export const REMOTE_PROVIDERS = {
  ROGERS: {
    name: 'Rogers',
    url: 'https://rogers.webremote.com/remote',
  },
  XFINITY: {
    name: 'Xfinity',
    url: 'https://remote.xfinity.com/remote',
  },
  SHAW: {
    name: 'Shaw',
    url: 'https://webremote.shaw.ca/remote',
  },
};

const PROVIDER_STORAGE_KEY = '@remote_provider';

const RogersRemoteContext = createContext(null);

export const useRogersRemote = () => {
  const context = useContext(RogersRemoteContext);
  if (!context) {
    throw new Error('useRogersRemote must be used within RogersRemoteProvider');
  }
  return context;
};

export const RogersRemoteProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [remoteProvider, setRemoteProvider] = useState(REMOTE_PROVIDERS.ROGERS);
  const [webViewDebugInfo, setWebViewDebugInfo] = useState({
    lastButtonClick: null,
    lastError: null,
    buttonClicks: [],
  });
  const webViewRef = useRef(null);
  const { debugMode } = useDebug();

  // Load saved provider on mount
  useEffect(() => {
    const loadProvider = async () => {
      try {
        const savedProvider = await AsyncStorage.getItem(PROVIDER_STORAGE_KEY);
        if (savedProvider) {
          const provider = REMOTE_PROVIDERS[savedProvider.toUpperCase()];
          if (provider) {
            setRemoteProvider(provider);
          }
        }
      } catch (error) {
        console.error('Error loading provider:', error);
      }
    };
    loadProvider();
  }, []);

  // Monitor WebView ref availability when authenticated
  useEffect(() => {
    if (authenticated) {
      // Check ref availability periodically
      const checkRef = setInterval(() => {
        if (webViewRef.current) {
          console.log('✅ WebView ref is available');
          clearInterval(checkRef);
        } else {
          console.warn('⚠️ WebView ref not available yet, waiting...');
        }
      }, 500);

      // Clear interval after 5 seconds
      setTimeout(() => {
        clearInterval(checkRef);
      }, 5000);

      return () => clearInterval(checkRef);
    }
  }, [authenticated]);

  // Save provider when it changes
  const updateRemoteProvider = async (provider) => {
    setRemoteProvider(provider);
    // Reset authenticated state when provider changes
    setAuthenticated(false);
    try {
      const providerKey = Object.keys(REMOTE_PROVIDERS).find(
        key => REMOTE_PROVIDERS[key].url === provider.url
      );
      if (providerKey) {
        await AsyncStorage.setItem(PROVIDER_STORAGE_KEY, providerKey);
      }
    } catch (error) {
      console.error('Error saving provider:', error);
    }
  };

  const handleAuthenticated = (isAuth) => {
    setAuthenticated(isAuth);
    if (isAuth) {
      console.log(`✅ Authenticated with ${remoteProvider.name} remote`);
      logInfo('Authenticated with remote', { provider: remoteProvider.name });
      setWebViewLoaded(true);
      // Ensure WebView ref is available after authentication
      setTimeout(() => {
        if (webViewRef.current) {
          console.log('✅ WebView ref is available after authentication');
          logInfo('WebView ref is available after authentication', { provider: remoteProvider.name });
        } else {
          console.warn('⚠️ WebView ref not available after authentication - will retry on next channel change');
          logWarn('WebView ref not available after authentication', { provider: remoteProvider.name });
        }
      }, 1000);
    } else {
      logWarn('Authentication failed', { provider: remoteProvider.name });
    }
  };

  const openWebView = () => {
    setShowWebView(true);
  };

  const closeWebView = () => {
    if (authenticated) {
      Alert.alert(
        'Remote Active',
        'The remote will stay active in the background. You can still change channels from other screens.',
        [{ text: 'OK', onPress: () => setShowWebView(false) }]
      );
    } else {
      setShowWebView(false);
    }
  };

  const changeChannel = (channelNumber) => {
    console.log(`🔄 changeChannel called: ${channelNumber}, authenticated: ${authenticated}, webViewLoaded: ${webViewLoaded}, webViewRef: ${!!webViewRef.current}`);
    logInfo('changeChannel called', {
      channelNumber,
      authenticated,
      webViewLoaded,
      hasWebViewRef: !!webViewRef.current,
    });
    
    if (!authenticated) {
      console.error('❌ Not authenticated - cannot change channel');
      logError('Not authenticated - cannot change channel', { channelNumber });
      Alert.alert('Error', `Please authenticate with ${remoteProvider.name} remote first`);
      return Promise.resolve(false);
    }

    // Helper function to check if remote is ready
    const isRemoteReady = () => {
      if (!webViewRef.current) {
        console.log('⏳ Remote not ready: WebView ref not available');
        logWarn('Remote not ready: WebView ref not available', { channelNumber });
        return false;
      }

      // Check if the WebView is ready
      if (webViewRef.current.isReady && !webViewRef.current.isReady()) {
        console.log('⏳ Remote not ready: WebView isReady() returned false');
        logWarn('Remote not ready: WebView isReady() returned false', { channelNumber });
        return false;
      }

      // Check if WebView is loaded (authenticated)
      if (!webViewLoaded) {
        console.log('⏳ Remote not ready: WebView not loaded yet');
        logWarn('Remote not ready: WebView not loaded yet', { channelNumber });
        return false;
      }

      return true;
    };

    // Helper function to attempt channel change
    const attemptChannelChange = () => {
      if (!isRemoteReady()) {
        return false;
      }

      try {
        console.log(`📺 Calling webViewRef.current.changeChannel(${channelNumber})`);
        logInfo('Calling webViewRef.current.changeChannel', { channelNumber });
        webViewRef.current.changeChannel(channelNumber);
        console.log(`✅ Channel change initiated for ${channelNumber}`);
        logInfo('Channel change initiated', { channelNumber });
        return true;
      } catch (error) {
        console.error('❌ Error changing channel:', error);
        logError('Error changing channel', { channelNumber, error: error.message, stack: error.stack });
        return false;
      }
    };

    // Try immediately first
    if (attemptChannelChange()) {
      return Promise.resolve(true);
    }

    // If that failed, wait for remote to be ready and retry
    console.log('⏳ Waiting for remote to be ready...');
    logInfo('Waiting for remote to be ready', { channelNumber });
    return new Promise((resolve) => {
      let retryCount = 0;
      const maxRetries = 20; // 10 seconds total (20 * 500ms)
      
      const retryInterval = setInterval(() => {
        retryCount++;
        console.log(`🔄 Waiting for remote (attempt ${retryCount}/${maxRetries})...`);
        logDebug('Waiting for remote retry', { channelNumber, attempt: retryCount, maxRetries });
        
        if (attemptChannelChange()) {
          clearInterval(retryInterval);
          resolve(true);
          return;
        }
        
        if (retryCount >= maxRetries) {
          clearInterval(retryInterval);
          console.error('❌ Remote still not ready after retries');
          logError('Remote still not ready after retries', { channelNumber, retryCount: maxRetries });
          Alert.alert(
            'Remote Not Ready',
            `The ${remoteProvider.name} remote is still loading. Please open the remote once to ensure it's fully loaded.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Remote', onPress: () => setShowWebView(true) }
            ]
          );
          resolve(false);
        }
      }, 500);
    });
  };

  return (
    <RogersRemoteContext.Provider
      value={{
        authenticated,
        showWebView,
        openWebView,
        closeWebView,
        changeChannel,
        remoteProvider,
        updateRemoteProvider,
        remoteProviders: REMOTE_PROVIDERS,
        webViewDebugInfo,
      }}
    >
      {children}

      {/* Always keep ONE WebView mounted when authenticated - always in hidden container */}
      {/* Never unmount it - the ref always points to this instance */}
      {authenticated && (
        <View style={styles.webViewHidden}>
          <RogersRemoteWebView
            ref={webViewRef}
            onAuthenticated={handleAuthenticated}
            remoteUrl={remoteProvider.url}
            debugMode={debugMode}
            onButtonClick={(data) => {
              setWebViewDebugInfo(prev => ({
                ...prev,
                lastButtonClick: data,
                buttonClicks: [...prev.buttonClicks.slice(-9), data],
              }));
            }}
          />
        </View>
      )}

      {/* Modal for showing WebView */}
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeWebView}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{remoteProvider.name} Remote</Text>
            <TouchableOpacity
              onPress={closeWebView}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          {/* When authenticated, WebView is already mounted in hidden container - don't mount another one */}
          {/* When not authenticated, this is where we mount it for authentication */}
          
            <RogersRemoteWebView
              ref={webViewRef}
              onAuthenticated={handleAuthenticated}
              remoteUrl={remoteProvider.url}
              debugMode={debugMode}
              onButtonClick={(data) => {
                setWebViewDebugInfo(prev => ({
                  ...prev,
                  lastButtonClick: data,
                  buttonClicks: [...prev.buttonClicks.slice(-9), data],
                }));
              }}
            />
         
        </SafeAreaView>
      </Modal>
    </RogersRemoteContext.Provider>
  );
};

const styles = StyleSheet.create({
  webViewHidden: {
    position: 'absolute',
    // Keep WebView slightly visible to prevent iOS from suspending JavaScript execution
    // iOS may suspend JavaScript execution in completely hidden WebViews
    opacity: 0.01, // Very transparent but still "visible" to iOS
    height: 1, // Minimal size - just enough to be considered "visible"
    width: 1,
    top: 0, // Keep on screen (just barely visible) instead of off-screen
    left: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: -1,
    // Ensure WebView doesn't get clipped or suspended
    backgroundColor: 'transparent',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
});

