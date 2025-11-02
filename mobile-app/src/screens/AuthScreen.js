import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRogersRemote } from '../context/RogersRemoteContext';

const AuthScreen = () => {
  const { 
    authenticated, 
    showWebView, 
    openWebView, 
    changeChannel,
    remoteProvider,
    updateRemoteProvider,
    remoteProviders,
  } = useRogersRemote();
  const [testChannel, setTestChannel] = useState('');

  const handleTestChannel = () => {
    if (!testChannel.trim()) {
      Alert.alert('Error', 'Please enter a channel number');
      return;
    }

    const channelNum = parseInt(testChannel, 10);
    const success = changeChannel(channelNum);
    if (success) {
      Alert.alert('Success', `Changing to channel ${channelNum}...`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Remote Provider Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Remote Provider</Text>
          <Text style={styles.subtitle}>
            Select your TV service provider
          </Text>
          <View style={styles.providerButtons}>
            {Object.values(remoteProviders).map((provider) => (
              <TouchableOpacity
                key={provider.url}
                style={[
                  styles.providerButton,
                  remoteProvider.url === provider.url && styles.providerButtonActive,
                ]}
                onPress={() => updateRemoteProvider(provider)}
              >
                <Ionicons
                  name={remoteProvider.url === provider.url ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={remoteProvider.url === provider.url ? '#667eea' : '#999'}
                />
                <Text
                  style={[
                    styles.providerButtonText,
                    remoteProvider.url === provider.url && styles.providerButtonTextActive,
                  ]}
                >
                  {provider.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Authentication Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Authentication Status</Text>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: authenticated ? '#10b981' : '#ef4444',
                },
              ]}
            >
            <Ionicons
              name={authenticated ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color="white"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.statusText}>
              {authenticated ? 'Authenticated' : 'Not Authenticated'}
            </Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Setup Instructions</Text>
          <View style={styles.instructions}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                Select your TV provider above (Rogers, Xfinity, or Shaw)
              </Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Tap "Open {remoteProvider.name} Remote" to open the remote in this app
              </Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Sign in to {remoteProvider.name} in the remote interface
              </Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepText}>
                Once authenticated, close the remote and test channel changes below
              </Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>5</Text>
              <Text style={styles.stepText}>
                All control happens from your phone - no Mac browser needed!
              </Text>
            </View>
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={openWebView}
          >
            <Ionicons name="tv" size={20} color="white" />
            <Text style={styles.buttonText}>Open {remoteProvider.name} Remote</Text>
          </TouchableOpacity>
        </View>

        {/* Test Channel */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Test Channel Change</Text>
          <Text style={styles.subtitle}>
            After authenticating, test that the remote control is working
          </Text>

          <TextInput
            style={styles.input}
            value={testChannel}
            onChangeText={setTestChannel}
            placeholder="Enter channel number (e.g., 516)"
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonSuccess,
              !authenticated && styles.buttonDisabled,
            ]}
            onPress={handleTestChannel}
            disabled={!authenticated}
          >
            <Ionicons name="tv" size={20} color="white" />
            <Text style={styles.buttonText}>Test Channel Change</Text>
          </TouchableOpacity>

          {!authenticated && (
            <Text style={styles.warningText}>
              Please open {remoteProvider.name} Remote and authenticate first
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  instructions: {
    // gap: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#667eea',
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonPrimary: {
    backgroundColor: '#667eea',
  },
  buttonSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  buttonSuccess: {
    backgroundColor: '#10b981',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
  },
  warningText: {
    marginTop: 8,
    fontSize: 12,
    color: '#f59e0b',
    textAlign: 'center',
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
  providerButtons: {
    marginTop: 8,
  },
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  providerButtonActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#667eea',
  },
  providerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 12,
  },
  providerButtonTextActive: {
    color: '#667eea',
  },
});

export default AuthScreen;

