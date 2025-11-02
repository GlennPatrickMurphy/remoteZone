import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';
import { useRogersRemote } from '../context/RogersRemoteContext';

const HomeScreen = ({ navigation }) => {
  const { authenticated, changeChannel } = useRogersRemote();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const lastChannelRef = useRef(null);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 2 seconds when monitoring
    const interval = setInterval(() => {
      if (monitoring) {
        fetchStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [monitoring]);

  // Auto-change channel when monitoring recommends a new channel
  useEffect(() => {
    if (monitoring && authenticated && status?.current_channel) {
      const recommendedChannel = status.current_channel;
      if (recommendedChannel !== lastChannelRef.current) {
        lastChannelRef.current = recommendedChannel;
        // Change channel automatically
        changeChannel(recommendedChannel);
      }
    }
  }, [monitoring, authenticated, status?.current_channel, changeChannel]);

  const fetchStatus = async () => {
    try {
      const data = await ApiService.getStatus();
      console.log('Status response:', JSON.stringify(data, null, 2));
      setStatus(data);
      const isRunning = data.is_running === true || data.is_running === 'true';
      setMonitoring(isRunning);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching status:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStart = async () => {
    try {
      const response = await ApiService.startMonitoring();
      console.log('Start monitoring response:', response);
      if (response.success) {
        // Update monitoring state immediately
        setMonitoring(true);
        // Fetch status to confirm - wait a moment for server to update
        setTimeout(async () => {
          await fetchStatus();
        }, 100);
        // Also fetch again after a longer delay to ensure it caught up
        setTimeout(async () => {
          await fetchStatus();
        }, 1000);
      } else {
        alert(response.message || 'Failed to start monitoring');
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error starting monitoring:', error);
      alert(error.message || 'Failed to start monitoring');
      await fetchStatus();
    }
  };

  const handleStop = async () => {
    try {
      await ApiService.stopMonitoring();
      setMonitoring(false);
      await fetchStatus();
    } catch (error) {
      alert(error.message || 'Failed to stop monitoring');
      await fetchStatus();
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Unable to connect to server</Text>
          <Text style={styles.errorSubtext}>
            Make sure the Flask server is running on your Mac
          </Text>
          <TouchableOpacity style={styles.button} onPress={onRefresh}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🏈</Text>
          <Text style={styles.title}>NFL Redzone Controller</Text>
          <View style={styles.statusBadge}>
            {monitoring && (
              <View style={styles.pulsingDot} />
            )}
            <View
              style={[
                styles.statusDot,
                { backgroundColor: monitoring ? '#10b981' : '#ef4444' },
              ]}
            />
            <Text style={styles.statusText}>
              {monitoring ? 'Monitoring Active' : 'Inactive'}
            </Text>
          </View>
          {monitoring && status.logs && status.logs.length > 0 && (
            <Text style={styles.lastActivity}>
              Last activity: {status.logs[status.logs.length - 1]?.timestamp || '--'}
            </Text>
          )}
        </View>

        {/* Navigation Buttons */}
        <View style={styles.card}>
          <View style={styles.navButtons}>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary]}
              onPress={() => navigation.navigate('Config')}
            >
              <Ionicons name="settings" size={24} color="white" />
              <Text style={styles.navButtonText}>Configuration</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSecondary]}
              onPress={() => navigation.navigate('Auth')}
            >
              <Ionicons name="lock-closed" size={24} color="white" />
              <Text style={styles.navButtonText}>Authentication</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Current Channel */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Channel</Text>
          <Text style={styles.currentChannel}>
            {status.current_channel || '--'}
          </Text>
        </View>

        {/* Authentication Status */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Authentication</Text>
            <View
              style={[
                styles.authBadge,
                {
                  backgroundColor: authenticated ? '#10b981' : '#ef4444',
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {authenticated ? 'Authenticated' : 'Not Authenticated'}
              </Text>
            </View>
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Control</Text>
          {!monitoring ? (
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleStart}
              disabled={!authenticated || !status.games?.length}
            >
              <Ionicons name="play" size={20} color="white" />
              <Text style={styles.buttonText}>Start Monitoring</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={handleStop}
            >
              <Ionicons name="stop" size={20} color="white" />
              <Text style={styles.buttonText}>Stop Monitoring</Text>
            </TouchableOpacity>
          )}
          {(!authenticated || !status.games?.length) && (
            <Text style={styles.warningText}>
              {!authenticated
                ? 'Please authenticate with Rogers first'
                : 'Please configure games first'}
            </Text>
          )}
        </View>

        {/* Activity Logs */}
        {monitoring && status.logs && status.logs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Activity Log</Text>
            <ScrollView style={styles.logsContainer} nestedScrollEnabled={true}>
              {status.logs.slice(-10).reverse().map((log, index) => (
                <View key={index} style={styles.logItem}>
                  <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                  <Text style={[
                    styles.logMessage,
                    log.level === 'error' && styles.logError
                  ]}>
                    {log.message}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Games List */}
        {status.games && status.games.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Games ({status.games.length})</Text>
            <Text style={styles.subtitle}>Tap a game to switch to its channel</Text>
            {status.games.map((game, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.gameCard,
                  game.in_redzone && styles.gameCardRedzone,
                ]}
                onPress={() => {
                  if (authenticated) {
                    const success = changeChannel(game.channel);
                    if (success) {
                      // Update current channel in status
                      setStatus(prev => ({
                        ...prev,
                        current_channel: game.channel
                      }));
                    }
                  } else {
                    alert('Please authenticate with Rogers first');
                  }
                }}
                disabled={!authenticated}
              >
                <View style={styles.gameCardHeader}>
                  <Text style={styles.gameTitle}>
                    {game.away_team} @ {game.home_team}
                  </Text>
                  <View style={styles.channelBadge}>
                    <Ionicons name="tv" size={16} color="#667eea" />
                    <Text style={styles.channelBadgeText}>Ch {game.channel}</Text>
                  </View>
                </View>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameInfoText}>
                    Channel: {game.channel}
                  </Text>
                  <Text style={styles.gameInfoText}>
                    Priority: {game.priority}
                  </Text>
                </View>
                {game.in_redzone && (
                  <View style={styles.redzoneBadge}>
                    <Text style={styles.redzoneText}>
                      🔴 REDZONE: {game.last_redzone_team}
                    </Text>
                  </View>
                )}
                {game.yards_to_endzone !== null && (
                  <Text style={styles.gameInfoText}>
                    Yards to Endzone: {game.yards_to_endzone}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
    textAlign: 'center',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  pulsingDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
    opacity: 0.6,
  },
  lastActivity: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginBottom: 12,
  },
  currentChannel: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#667eea',
    textAlign: 'center',
    marginVertical: 8,
  },
  authBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningText: {
    marginTop: 8,
    fontSize: 12,
    color: '#f59e0b',
    textAlign: 'center',
  },
  gameCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    opacity: 1,
  },
  gameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  channelBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    marginLeft: 4,
  },
  gameCardRedzone: {
    borderColor: '#ef4444',
    backgroundColor: '#fee2e2',
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  gameInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gameInfoText: {
    fontSize: 14,
    color: '#666',
  },
  redzoneBadge: {
    backgroundColor: '#ef4444',
    padding: 6,
    borderRadius: 4,
    marginTop: 8,
  },
  redzoneText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  logsContainer: {
    maxHeight: 200,
    marginTop: 8,
  },
  logItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  logTimestamp: {
    fontSize: 11,
    color: '#666',
    width: 60,
    fontFamily: 'monospace',
  },
  logMessage: {
    fontSize: 12,
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  logError: {
    color: '#ef4444',
  },
  navButtons: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  navButtonPrimary: {
    backgroundColor: '#667eea',
  },
  navButtonSecondary: {
    backgroundColor: '#10b981',
  },
  navButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;

