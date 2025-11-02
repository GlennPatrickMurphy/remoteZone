import React, { createContext, useState, useRef, useContext, useEffect } from 'react';
import { View, StyleSheet, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RogersRemoteWebView from '../components/RogersRemoteWebView';

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
  const webViewRef = useRef(null);

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
      setWebViewLoaded(true);
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
    if (!authenticated) {
      Alert.alert('Error', `Please authenticate with ${remoteProvider.name} remote first`);
      return false;
    }

    // Check if WebView ref is available
    if (!webViewRef.current) {
      console.warn('WebView ref not available, trying to find it...');
      // Wait a moment and try again - WebView might still be mounting
      setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.changeChannel(channelNumber);
        } else {
          Alert.alert(
            'Remote Not Ready',
            `The ${remoteProvider.name} remote is still loading. Please open the remote once to ensure it's fully loaded.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Remote', onPress: () => setShowWebView(true) }
            ]
          );
        }
      }, 500);
      return false;
    }

    try {
      // The changeChannel method in the component already handles clearing timeouts
      webViewRef.current.changeChannel(channelNumber);
      console.log(`Changing channel to ${channelNumber}`);
      return true;
    } catch (error) {
      console.error('Error changing channel:', error);
      Alert.alert('Error', 'Failed to change channel. Please try again.');
      return false;
    }
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
          {/* When authenticated, WebView is mounted in background - just show it here too */}
          {/* When not authenticated, this is where we mount it */}
          {authenticated ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Ionicons name="tv" size={64} color="#667eea" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 16, color: '#333' }}>
                Remote Active
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
                The remote is running in the background. You can control channels from any screen.
              </Text>
            </View>
          ) : (
            <RogersRemoteWebView
              ref={webViewRef}
              onAuthenticated={handleAuthenticated}
              remoteUrl={remoteProvider.url}
            />
          )}
        </SafeAreaView>
      </Modal>
    </RogersRemoteContext.Provider>
  );
};

const styles = StyleSheet.create({
  webViewHidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: -1,
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

