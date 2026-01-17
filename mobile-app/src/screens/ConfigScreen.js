import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';
import { getChannelConfig, saveChannels, mapGameToChannel, clearGameMappings, setPriority1 } from '../services/channelConfig';

const ConfigScreen = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allGames, setAllGames] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState({});
  const [gameMappings, setGameMappings] = useState({});

  useEffect(() => {
    loadConfig();
    loadAllGames();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await getChannelConfig();
      
      // Load game mappings
      if (config.gameMappings) {
        setGameMappings(config.gameMappings);
        // Pre-populate selected channels from mappings
        const selected = {};
        Object.keys(config.gameMappings).forEach(eventId => {
          selected[eventId] = config.gameMappings[eventId].channel.toString();
        });
        setSelectedChannel(selected);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const loadAllGames = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await ApiService.getAllGames();
      const games = response.games || [];
      
      // Also fetch live games from /api/status to get updated live status
      try {
        const statusResponse = await ApiService.getStatus();
        const liveGames = statusResponse.games || [];
        
        // Create a map of live game event_ids for quick lookup
        const liveGameIds = new Set(liveGames.map(g => g.event_id));
        
        // Update is_live status for games that are currently live
        const updatedGames = games.map(game => ({
          ...game,
          is_live: liveGameIds.has(game.event_id)
        }));
        
        setAllGames(updatedGames);
        console.log(`✅ Loaded ${updatedGames.length} games (${liveGames.length} live)`);
      } catch (statusError) {
        // If status endpoint fails, just use all_games response
        console.warn('Could not fetch live status, using all_games data:', statusError);
        setAllGames(games);
      }
    } catch (error) {
      console.error('Error loading games:', error);
      if (!isRefresh) {
        Alert.alert('Error', 'Failed to load games. Please try again.');
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleMapGame = async (eventId) => {
    const channel = selectedChannel[eventId];
    if (!channel || !channel.trim()) {
      Alert.alert('Error', 'Please enter a channel number');
      return;
    }

    const channelNum = parseInt(channel);
    if (isNaN(channelNum) || channelNum <= 0) {
      Alert.alert('Error', 'Please enter a valid channel number');
      return;
    }

    setLoading(true);
    try {
      // Get current config to calculate priority correctly
      const currentConfig = await getChannelConfig();
      const currentMappings = currentConfig.gameMappings || {};
      
      // Calculate priority based on existing mappings
      // Priority is determined by the order channels are first used
      // First unique channel = priority 1, second = priority 2, etc.
      const usedChannels = new Set();
      const channelToPriority = new Map();
      
      // Build map of channel -> priority from existing mappings
      Object.values(currentMappings).forEach(mapping => {
        if (!usedChannels.has(mapping.channel)) {
          usedChannels.add(mapping.channel);
          channelToPriority.set(mapping.channel, mapping.priority);
        }
      });
      
      let priority;
      if (channelToPriority.has(channelNum)) {
        // Channel already used - use its existing priority
        priority = channelToPriority.get(channelNum);
      } else {
        // New channel - assign next priority
        priority = usedChannels.size + 1;
      }

      await mapGameToChannel(eventId, channelNum, priority);
      
      // Update channels list automatically (extract unique channels from all mappings)
      const updatedConfig = await getChannelConfig();
      const allChannels = new Set();
      if (updatedConfig.gameMappings) {
        Object.values(updatedConfig.gameMappings).forEach(m => allChannels.add(m.channel));
      }
      allChannels.add(channelNum);
      
      // Save channels list for reference
      await saveChannels(Array.from(allChannels).sort((a, b) => a - b));
      
      Alert.alert('Success', 'Game mapped successfully!');
      await loadConfig();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to map game');
    } finally {
      setLoading(false);
    }
  };

  const handleClearGames = () => {
    Alert.alert('Clear Games', 'Are you sure you want to clear all game mappings?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearGameMappings();
            Alert.alert('Success', 'All game mappings cleared');
            await loadConfig();
          } catch (error) {
            Alert.alert('Error', error.message || 'Failed to clear games');
          }
        },
      },
    ]);
  };

  const handleSetPriority1 = async (eventId) => {
    if (!gameMappings[eventId]) {
      Alert.alert('Error', 'Game must be mapped to a channel first');
      return;
    }

    setLoading(true);
    try {
      await setPriority1(eventId);
      Alert.alert('Success', 'Game set as Priority 1');
      await loadConfig();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to set priority');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAllGames(true)}
            tintColor="#667eea"
            colors={['#667eea']}
          />
        }
      >
        {/* Game Mapping */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Map Games to Channels</Text>
            <TouchableOpacity onPress={loadAllGames}>
              <Ionicons name="refresh" size={24} color="#667eea" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.subtitle}>
            Games for today - NFL & College Football
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={handleClearGames}
          >
            <Ionicons name="trash" size={20} color="white" />
            <Text style={styles.buttonText}>Clear All Mappings</Text>
          </TouchableOpacity>

          {allGames.map((game) => {
            const mapping = gameMappings[game.event_id];
            const isMapped = !!mapping;
            
            return (
            <View 
              key={game.event_id} 
              style={[
                styles.gameSelectorCard,
                isMapped && styles.gameSelectorCardMapped
              ]}
            >
              <View style={styles.gameInfo}>
                <View style={styles.gameTitleRow}>
                  <Text style={styles.gameTitle}>
                    {game.away_team} @ {game.home_team}
                  </Text>
                  {isMapped && (
                    <View style={styles.mappedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={styles.mappedBadgeText}>
                        Ch {mapping.channel} (P{mapping.priority})
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.gameStatus}>
                  {game.is_live ? '🔴 LIVE' : game.status || 'Scheduled'}
                  {game.league && ` • ${game.league === 'nfl' ? 'NFL' : 'College Football'}`}
                </Text>
              </View>

              {isMapped && (
                <TouchableOpacity
                  style={[
                    styles.priorityButton,
                    mapping.priority === 1 && styles.priorityButtonActive
                  ]}
                  onPress={() => handleSetPriority1(game.event_id)}
                  disabled={loading || mapping.priority === 1}
                >
                  <Ionicons 
                    name={mapping.priority === 1 ? "star" : "star-outline"} 
                    size={16} 
                    color={mapping.priority === 1 ? "#fbbf24" : "#666"} 
                  />
                  <Text style={[
                    styles.priorityButtonText,
                    mapping.priority === 1 && styles.priorityButtonTextActive
                  ]}>
                    {mapping.priority === 1 ? 'Priority 1' : 'Set as Priority 1'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.gameControls}>
                <View style={styles.pickerContainer}>
                  <TextInput
                    style={styles.pickerInput}
                    value={selectedChannel[game.event_id] || ''}
                    onChangeText={(text) => {
                      setSelectedChannel({
                        ...selectedChannel,
                        [game.event_id]: text,
                      });
                    }}
                    placeholder={isMapped ? `Ch ${mapping.channel}` : "Enter channel number"}
                    keyboardType="number-pad"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.mapButton, isMapped && styles.mapButtonMapped]}
                  onPress={() => handleMapGame(game.event_id)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.mapButtonText}>
                      {isMapped ? 'Update' : 'Map'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            );
          })}

          {allGames.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="football" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No games found</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={loadAllGames}
              >
                <Text style={styles.buttonText}>Load Games</Text>
              </TouchableOpacity>
            </View>
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  leagueSelector: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    alignSelf: 'flex-start',
  },
  leagueButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  leagueButtonActive: {
    backgroundColor: '#667eea',
  },
  leagueButtonDisabled: {
    opacity: 0.5,
  },
  leagueButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  leagueButtonTextActive: {
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
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
  gameSelectorCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  gameSelectorCardMapped: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  gameInfo: {
    marginBottom: 8,
  },
  gameTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  mappedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  mappedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
    marginLeft: 4,
  },
  gameStatus: {
    fontSize: 12,
    color: '#666',
  },
  gameControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerContainer: {
    flex: 1,
  },
  pickerInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: 'white',
    marginRight: 8,
  },
  mapButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  mapButtonMapped: {
    backgroundColor: '#667eea',
  },
  mapButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  priorityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  priorityButtonActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  priorityButtonTextActive: {
    color: '#92400e',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af',
  },
});

export default ConfigScreen;

