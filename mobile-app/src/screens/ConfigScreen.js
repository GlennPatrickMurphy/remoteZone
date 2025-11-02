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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';

const ConfigScreen = () => {
  const [channels, setChannels] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState({});

  useEffect(() => {
    loadConfig();
    loadAllGames();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await ApiService.getConfig();
      if (config.channels) {
        const newChannels = [...channels];
        config.channels.forEach((ch, i) => {
          if (i < 3) newChannels[i] = ch.toString();
        });
        setChannels(newChannels);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const loadAllGames = async () => {
    try {
      const response = await ApiService.getAllGames();
      setAllGames(response.games || []);
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const handleSaveChannels = async () => {
    const validChannels = channels
      .filter((ch) => ch.trim() !== '')
      .map((ch) => parseInt(ch));

    if (validChannels.length < 2) {
      Alert.alert('Error', 'Please enter at least 2 channels');
      return;
    }

    setLoading(true);
    try {
      await ApiService.configureChannels(validChannels);
      Alert.alert('Success', 'Channels saved successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save channels');
    } finally {
      setLoading(false);
    }
  };

  const handleMapGame = async (eventId) => {
    const channel = selectedChannel[eventId];
    if (!channel) {
      Alert.alert('Error', 'Please select a channel first');
      return;
    }

    const validChannels = channels
      .filter((ch) => ch.trim() !== '')
      .map((ch) => parseInt(ch));
    const priority = validChannels.indexOf(parseInt(channel)) + 1;

    setLoading(true);
    try {
      await ApiService.mapGame(eventId, channel, priority);
      Alert.alert('Success', 'Game mapped successfully!');
      loadConfig();
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
            await ApiService.clearGames();
            Alert.alert('Success', 'All game mappings cleared');
            loadConfig();
          } catch (error) {
            Alert.alert('Error', error.message || 'Failed to clear games');
          }
        },
      },
    ]);
  };

  const validChannels = channels
    .filter((ch) => ch.trim() !== '')
    .map((ch) => parseInt(ch));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Channels Configuration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Configure Channels</Text>
          <Text style={styles.subtitle}>
            Enter channel numbers for your games
          </Text>

          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.inputContainer}>
              <Text style={styles.label}>
                Channel {index + 1}
                {index === 0 && ' (Highest Priority)'}
                {index === 2 && ' (Optional)'}
              </Text>
              <TextInput
                style={styles.input}
                value={channels[index]}
                onChangeText={(text) => {
                  const newChannels = [...channels];
                  newChannels[index] = text;
                  setChannels(newChannels);
                }}
                placeholder="e.g., 502"
                keyboardType="number-pad"
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleSaveChannels}
            disabled={loading || validChannels.length < 2}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="white" />
                <Text style={styles.buttonText}>Save Channels</Text>
              </>
            )}
          </TouchableOpacity>

          {validChannels.length < 2 && (
            <Text style={styles.warningText}>
              At least 2 channels are required
            </Text>
          )}
        </View>

        {/* Game Mapping */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Map Games to Channels</Text>
            <TouchableOpacity onPress={loadAllGames}>
              <Ionicons name="refresh" size={24} color="#667eea" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={handleClearGames}
          >
            <Ionicons name="trash" size={20} color="white" />
            <Text style={styles.buttonText}>Clear All Mappings</Text>
          </TouchableOpacity>

          {allGames.map((game) => (
            <View key={game.event_id} style={styles.gameSelectorCard}>
              <View style={styles.gameInfo}>
                <Text style={styles.gameTitle}>
                  {game.away_team} @ {game.home_team}
                </Text>
                <Text style={styles.gameStatus}>
                  {game.is_live ? '🔴 LIVE' : game.status}
                </Text>
              </View>

              {validChannels.length >= 2 && (
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
                      placeholder="Channel"
                      keyboardType="number-pad"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.mapButton}
                    onPress={() => handleMapGame(game.event_id)}
                  >
                    <Text style={styles.mapButtonText}>Map</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

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
  gameInfo: {
    marginBottom: 8,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
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
  mapButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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

