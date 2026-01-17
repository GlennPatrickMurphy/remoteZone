import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useDebug } from '../context/DebugContext';

const ProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { debugMode, toggleDebugMode } = useDebug();

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // TODO: Implement account deletion
            Alert.alert('Info', 'Account deletion will be available in a future update.');
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    const result = await signOut();
    if (!result.success) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleOpenDiscord = async () => {
    const discordUrl = 'https://discord.gg/azbfDAf6CW';
    try {
      const supported = await Linking.canOpenURL(discordUrl);
      if (supported) {
        await Linking.openURL(discordUrl);
      } else {
        Alert.alert('Error', 'Unable to open Discord link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open Discord link');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user?.email || '--'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔧 Debug Mode</Text>
          <Text style={styles.cardDescription}>
            Enable extensive debugging and WebView testing tools. This will show detailed logs and allow you to test the remote manually.
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Debug Mode</Text>
            <Switch
              value={debugMode}
              onValueChange={toggleDebugMode}
              trackColor={{ false: '#767577', true: '#667eea' }}
              thumbColor={debugMode ? '#fff' : '#f4f3f4'}
            />
          </View>
          {debugMode && (
            <Text style={styles.debugNote}>
              ✅ Debug mode is active. You'll see detailed logs and can test the remote manually.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support & Feedback</Text>
          <Text style={styles.cardDescription}>
            Join our Discord community for help, feature requests, and updates
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.buttonInfo]}
            onPress={handleOpenDiscord}
          >
            <Ionicons name="chatbubbles" size={20} color="white" />
            <Text style={styles.buttonText}>Join Discord</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash" size={20} color="white" />
            <Text style={styles.buttonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out" size={20} color="white" />
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
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
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonPrimary: {
    backgroundColor: '#667eea',
  },
  buttonSecondary: {
    backgroundColor: '#10b981',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonInfo: {
    backgroundColor: '#5865F2',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  debugNote: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default ProfileScreen;
