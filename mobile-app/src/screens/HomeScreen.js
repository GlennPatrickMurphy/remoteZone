import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import ApiService from '../services/api';
import { API_BASE_URL } from '../config/api';
import { useRogersRemote } from '../context/RogersRemoteContext';
import { getChannelConfig } from '../services/channelConfig';
import { useDebug } from '../context/DebugContext';

// Helper function to format timestamp as relative time
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Just now';
  
  try {
    const timestampDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now - timestampDate;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 10) {
      return 'Just now';
    } else if (diffSeconds < 60) {
      return `${diffSeconds} second${diffSeconds === 1 ? '' : 's'} ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
      // Fallback to formatted date if older than a week
      return timestampDate.toLocaleDateString();
    }
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Just now';
  }
};

const HomeScreen = ({ navigation }) => {
  const { authenticated, changeChannel, openWebView, webViewDebugInfo } = useRogersRemote();
  const { debugMode } = useDebug();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [channelConfig, setChannelConfig] = useState({ channels: [], gameMappings: {} });
  const [currentChannel, setCurrentChannel] = useState(null);
  const [timeNow, setTimeNow] = useState(Date.now()); // State to trigger re-render for relative time updates
  const lastChannelChangeTime = useRef(null);
  const recommendedChannelRef = useRef(null);
  const recommendedChannelTimeRef = useRef(null);
  const previousGameState = useRef({}); // Track previous game state (down/distance/play_sequence) for each game to detect play changes
  const monitoringJustStartedRef = useRef(false); // Track if monitoring just started
  const CHANNEL_CHANGE_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown between channel changes
  const CHANNEL_STABILITY_MS = 30 * 1000; // Channel must be recommended for 30 seconds before switching
  const COMMERCIAL_STUCK_TIME_MS = 60 * 1000; // If down/distance hasn't changed in 60 seconds, likely commercial

  // Load channel config from Firebase on mount
  useEffect(() => {
    loadChannelConfig();
  }, []);

  // Update time every 10 seconds to refresh relative time displays
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeNow(Date.now());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Load channel config from Firebase
  const loadChannelConfig = async () => {
    try {
      console.log('📥 Loading channel config from Firebase...');
      const config = await getChannelConfig();
      if (!config || !config.gameMappings) {
        console.warn('⚠️ No channel config or gameMappings found');
        setChannelConfig({ channels: [], gameMappings: {} });
        return;
      }
      setChannelConfig(config);
      console.log('✅ Loaded channel config from Firebase:', {
        channels: config.channels?.length || 0,
        mappings: Object.keys(config.gameMappings || {}).length,
        mappings: config.gameMappings,
      });
    } catch (error) {
      console.error('❌ Error loading channel config:', error);
      console.error('Error details:', error.message, error.stack);
      // Set empty config on error
      setChannelConfig({ channels: [], gameMappings: {} });
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh every 2 seconds when monitoring
  useEffect(() => {
    if (!monitoring) return;
    
    const interval = setInterval(() => {
      fetchStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [monitoring, fetchStatus]);

  // Auto-change channel when monitoring - based on excitement score + priority
  useEffect(() => {
    console.log('🔄 Monitoring useEffect triggered');
    
    // Debug logging for channel change conditions
    const debugInfo = {
      monitoring,
      authenticated,
      gamesCount: status?.games?.length || 0,
      mappingsCount: Object.keys(channelConfig.gameMappings || {}).length,
      recommendedChannel: recommendedChannelRef.current,
      currentChannel,
      stabilityTime: recommendedChannelTimeRef.current ? Date.now() - recommendedChannelTimeRef.current : null,
      cooldownTime: lastChannelChangeTime.current ? Date.now() - lastChannelChangeTime.current : null,
      monitoringJustStarted: monitoringJustStartedRef.current,
    };
    
    console.log('🔍 Channel change check:', JSON.stringify(debugInfo, null, 2));
    
    if (!monitoring || !authenticated || !status?.games || !channelConfig.gameMappings) {
      if (!monitoring) console.log('⏸️ Monitoring not active');
      if (!authenticated) console.log('❌ Not authenticated');
      if (!status?.games) console.log('❌ No games data');
      if (!channelConfig.gameMappings) console.log('❌ No channel mappings');
      // Reset monitoring just started flag when monitoring stops
      if (!monitoring) {
        monitoringJustStartedRef.current = false;
      }
      return;
    }

    console.log(`📊 Processing ${status.games.length} games for channel recommendation...`);

    // Calculate which channel to switch to based on excitement score + priority
    const recommendedChannel = calculateRecommendedChannel(status.games, channelConfig);
    const now = Date.now();
    
    if (!recommendedChannel) {
      // No recommended channel, clear stability tracking
      console.log('❌ No recommended channel found');
      recommendedChannelRef.current = null;
      recommendedChannelTimeRef.current = null;
      monitoringJustStartedRef.current = false;
      return;
    }
    
    console.log(`🎯 Recommended channel: ${recommendedChannel}, current: ${currentChannel}`);
    
    // If monitoring just started, immediately switch to recommended channel (skip stability check)
    if (monitoringJustStartedRef.current) {
      console.log('🚀 Monitoring just started - immediately switching to recommended channel');
      monitoringJustStartedRef.current = false;
      
      // Wait for remote to be ready, then change channel
      const attemptChange = async () => {
        const success = await changeChannel(recommendedChannel);
        console.log(`📺 changeChannel returned: ${success}`);
        if (success) {
          setCurrentChannel(recommendedChannel);
          lastChannelChangeTime.current = now;
          recommendedChannelRef.current = recommendedChannel;
          recommendedChannelTimeRef.current = now;
          console.log(`✅ Initial channel change initiated successfully`);
        } else {
          console.error('❌ Initial channel change failed');
        }
      };
      
      attemptChange();
      return;
    }
    
    // Track stability - channel must be recommended consistently before switching
    if (recommendedChannel !== recommendedChannelRef.current) {
      // Different channel recommended - reset stability timer
      console.log(`🔄 Channel recommendation changed: ${recommendedChannelRef.current} -> ${recommendedChannel}`);
      recommendedChannelRef.current = recommendedChannel;
      recommendedChannelTimeRef.current = now;
      console.log(`⏳ Waiting for stability (${CHANNEL_STABILITY_MS / 1000}s required)`);
      return;
    }
    
    // Same channel recommended - check if it's been stable long enough
    const stabilityDuration = now - recommendedChannelTimeRef.current;
    if (stabilityDuration < CHANNEL_STABILITY_MS) {
      const remainingSeconds = Math.ceil((CHANNEL_STABILITY_MS - stabilityDuration) / 1000);
      console.log(`⏳ Channel ${recommendedChannel} recommended, waiting for stability (${remainingSeconds}s remaining)`);
      return;
    }
    
    // Channel has been stable - check if we need to switch
    if (recommendedChannel !== currentChannel) {
      // Check cooldown - don't change if less than 30 seconds since last change
      if (lastChannelChangeTime.current && (now - lastChannelChangeTime.current) < CHANNEL_CHANGE_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((CHANNEL_CHANGE_COOLDOWN_MS - (now - lastChannelChangeTime.current)) / 1000);
        console.log(`⏸️ Channel change cooldown active. ${remainingSeconds}s remaining.`);
        return;
      }

      // Change channel - it's been stable and cooldown has passed
      console.log(`📺 Switching to channel ${recommendedChannel} (stable for ${Math.round(stabilityDuration / 1000)}s, excitement + priority decision)`);
      const attemptChange = async () => {
        const success = await changeChannel(recommendedChannel);
        console.log(`📺 changeChannel returned: ${success}`);
        if (success) {
          setCurrentChannel(recommendedChannel);
          lastChannelChangeTime.current = now;
          // Reset stability tracking after successful change
          recommendedChannelRef.current = null;
          recommendedChannelTimeRef.current = null;
          console.log(`✅ Channel change initiated successfully`);
        } else {
          console.error('❌ Channel change failed - changeChannel returned false');
        }
      };
      
      attemptChange();
    } else {
      console.log(`✅ Already on recommended channel ${recommendedChannel}`);
    }
  }, [monitoring, authenticated, status?.games, channelConfig, currentChannel, changeChannel, calculateRecommendedChannel]);

  // Calculate which channel to switch to based on excitement score + user priority
  const calculateRecommendedChannel = useCallback((games, config) => {
    if (!games || !config.gameMappings || Object.keys(config.gameMappings).length === 0) {
      console.log('🔍 calculateRecommendedChannel: No games or mappings');
      return null;
    }

    // Build list of candidates (games that are mapped to channels)
    const candidates = [];

    for (const game of games) {
      const mapping = config.gameMappings[game.event_id];
      if (!mapping) {
        continue; // Skip games not mapped to channels
      }

      // Only consider live games
      if (!game.is_live) {
        continue;
      }

      // Skip games that haven't started yet (no quarter, no scores, no down/distance)
      // Game hasn't started if: quarter is 0 or null, and no down/distance, and scores are 0
      const gameHasStarted = game.quarter > 0 || 
                            (game.down !== null && game.down !== undefined) ||
                            (game.home_score > 0 || game.away_score > 0) ||
                            (game.play_sequence || game.play_id);
      
      if (!gameHasStarted) {
        console.log(`⏸️ Skipping game ${game.event_id} (${game.away_team} @ ${game.home_team}): game hasn't started yet`);
        continue;
      }

      // Check if a new play has occurred - use play_sequence (most reliable) or down/distance as fallback
      const previousState = previousGameState.current[game.event_id] || {};
      const playSequence = game.play_sequence || game.play_id || null;
      const now = Date.now();
      
      // Method 1: Check if play sequence changed (most reliable - from server)
      const playSequenceChanged = playSequence && previousState.play_sequence && 
                                  playSequence !== previousState.play_sequence;
      
      // Method 2: Check if down/distance changed (fallback if play_sequence not available)
      const downChanged = previousState.down !== undefined && 
                         (previousState.down !== game.down || previousState.distance !== game.distance);
      const downChangedValid = downChanged && game.down !== null && game.distance !== null;
      
      // Method 3: Check if plays are being updated regularly
      // If down/distance hasn't changed in a while, it's likely stuck (commercial)
      const lastPlayUpdateTime = previousState.lastPlayUpdateTime;
      let isPlayStuck = false;
      let timeSinceLastPlay = 0;
      if (lastPlayUpdateTime) {
        timeSinceLastPlay = now - lastPlayUpdateTime;
        isPlayStuck = timeSinceLastPlay > COMMERCIAL_STUCK_TIME_MS;
      } else {
        // First time seeing this game - can't determine if stuck yet
        isPlayStuck = false;
      }
      
      // Check if we're at 4th down (common commercial time after punts)
      const isFourthDown = game.down === 4;
      
      // Game is actively being played if:
      // 1. Play sequence changed (new play detected)
      // 2. Down/distance changed (new play detected)
      // 3. Plays are updating regularly (not stuck) - only if we have history
      const hasNewPlay = playSequenceChanged || downChangedValid;
      const isActive = hasNewPlay || (lastPlayUpdateTime && !isPlayStuck);
      
      // Skip games that are on commercial or timeout break
      // Commercial indicators:
      // - Server says timeout/commercial AND no new play detected
      // - OR at 4th down AND play is stuck AND no new play detected
      const isCommercial = (!hasNewPlay && (game.is_timeout || game.score_just_changed)) || 
                          (isFourthDown && isPlayStuck && !hasNewPlay);
      
      if (isCommercial) {
        const reason = game.is_timeout ? 'timeout' : 
                      game.score_just_changed ? 'commercial (score changed)' :
                      isFourthDown ? 'commercial (4th down, play stuck)' : 'commercial';
        console.log(`⏸️ Skipping game ${game.event_id} (${game.away_team} @ ${game.home_team}): ${reason}`);
        if (lastPlayUpdateTime) {
          console.log(`   Play stuck: ${isPlayStuck} (${Math.round(timeSinceLastPlay / 1000)}s since last update)`);
        }
        console.log(`   Current down/distance: ${game.down}/${game.distance}, 4th down: ${isFourthDown}`);
        console.log(`   Previous play_sequence: ${previousState.play_sequence || 'none'}, Current: ${playSequence || 'none'}`);
        continue;
      }
      
      // If new play detected, log it
      if (hasNewPlay && (game.is_timeout || game.score_just_changed)) {
        console.log(`✅ New play detected for ${game.event_id} (${game.away_team} @ ${game.home_team}) - game resumed, including in candidates`);
      }

      // Add candidate with excitement score (priority bonus will be calculated later)
      candidates.push({
        event_id: game.event_id,
        channel: mapping.channel,
        priority: mapping.priority,
        excitement_score: game.game_excitement_score,
        game: game,
      });
    }

    if (candidates.length === 0) {
      console.log('🔍 calculateRecommendedChannel: No candidates found, falling back to priority 1 game');
      
      // Fallback: Find priority 1 game (or lowest priority number = highest priority)
      let fallbackGame = null;
      let lowestPriority = Infinity;
      
      for (const game of games) {
        const mapping = config.gameMappings[game.event_id];
        if (!mapping) {
          continue; // Skip games not mapped to channels
        }
        
        // Only consider live games for fallback
        if (!game.is_live) {
          continue;
        }
        
        // Skip games that haven't started yet
        const gameHasStarted = game.quarter > 0 || 
                              (game.down !== null && game.down !== undefined) ||
                              (game.home_score > 0 || game.away_score > 0) ||
                              (game.play_sequence || game.play_id);
        
        if (!gameHasStarted) {
          continue;
        }
        
        // Find the game with the lowest priority number (highest priority)
        if (mapping.priority < lowestPriority) {
          lowestPriority = mapping.priority;
          fallbackGame = {
            event_id: game.event_id,
            channel: mapping.channel,
            priority: mapping.priority,
            game: game,
          };
        }
      }
      
      if (fallbackGame) {
        console.log(`🏆 Fallback to priority ${fallbackGame.priority} game: Ch ${fallbackGame.channel} (${fallbackGame.game.away_team} @ ${fallbackGame.game.home_team})`);
        return fallbackGame.channel;
      }
      
      console.log('❌ No fallback game found (no live games with mappings)');
      return null;
    }

    // Calculate excitement score range to determine if we should use priority as tiebreaker
    const excitementScores = candidates.map(c => c.excitement_score);
    const maxExcitement = Math.max(...excitementScores);
    const minExcitement = Math.min(...excitementScores);
    const excitementDiff = maxExcitement - minExcitement;
    const EXCITEMENT_TIEBREAKER_THRESHOLD = 30; // If excitement scores are within 30 points, use priority as tiebreaker
    
    // Only apply priority bonus if excitement scores are close (within threshold)
    const usePriorityTiebreaker = excitementDiff < EXCITEMENT_TIEBREAKER_THRESHOLD;
    
    console.log(`📊 Excitement score range: ${minExcitement.toFixed(1)} - ${maxExcitement.toFixed(1)} (diff: ${excitementDiff.toFixed(1)})`);
    console.log(`🎯 Using priority tiebreaker: ${usePriorityTiebreaker ? 'Yes' : 'No'} (threshold: ${EXCITEMENT_TIEBREAKER_THRESHOLD})`);
    
    // Calculate combined scores with conditional priority bonus
    candidates.forEach(candidate => {
      // Priority bonus only applied when excitement scores are close
      // Lower priority number = higher priority (priority 1 gets more points)
      const priorityBonus = usePriorityTiebreaker ? (10 - candidate.priority) * 10 : 0; // Priority 1 = 90, Priority 2 = 80, etc. (only when close)
      candidate.combined_score = candidate.excitement_score + priorityBonus;
      
      console.log(`✅ Candidate: ${candidate.event_id} -> Ch ${candidate.channel} (P${candidate.priority}), excitement: ${candidate.excitement_score.toFixed(1)}, priority bonus: ${priorityBonus}, combined: ${candidate.combined_score.toFixed(1)}`);
    });

    // Sort by combined score (highest first)
    candidates.sort((a, b) => b.combined_score - a.combined_score);

    const recommended = candidates[0].channel;
    const topCandidate = candidates[0];
    console.log(`🏆 Recommended channel: ${recommended} (from ${candidates.length} candidates)`);
    console.log(`   Top candidate: ${topCandidate.game.away_team} @ ${topCandidate.game.home_team}, excitement: ${topCandidate.excitement_score.toFixed(1)}, combined: ${topCandidate.combined_score.toFixed(1)}`);
    
    // Return the channel with the highest combined score
    return recommended;
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      console.log('📊 Fetching status from API...');
      const data = await ApiService.getStatus();
      
      // Server returns: { games: [...] }
      // Ensure games array exists and is an array
      const games = data?.games || [];
      console.log(`📊 Received ${games.length} games from API`);
      
      if (games.length > 0) {
        console.log('📊 Games received:', games.map(g => ({
          event_id: g.event_id,
          teams: `${g.away_team} @ ${g.home_team}`,
          is_live: g.is_live,
          excitement: g.game_excitement_score,
        })));
      } else {
        console.warn('⚠️ No games received from API');
      }
      
      setStatus(prevStatus => {
        // Update previous game state for all games when status is fetched
        // This ensures we can detect play changes even if calculateRecommendedChannel hasn't run yet
        games.forEach(game => {
          const prevState = previousGameState.current[game.event_id] || {};
          const playSequence = game.play_sequence || game.play_id || null;
          
          // Check if play sequence changed (most reliable indicator of new play)
          const playChanged = playSequence && prevState.play_sequence && playSequence !== prevState.play_sequence;
          
          // Check if down/distance changed
          const downChanged = prevState.down !== undefined && 
                             (prevState.down !== game.down || prevState.distance !== game.distance);
          
          // Log commercial/timeout state changes
          if (prevState.is_timeout !== game.is_timeout) {
            if (game.is_timeout) {
              console.log(`⏸️ Timeout started for ${game.event_id} (${game.away_team} @ ${game.home_team})`);
            } else {
              console.log(`▶️ Timeout cleared for ${game.event_id} (${game.away_team} @ ${game.home_team})`);
            }
          }
          
          if (prevState.score_just_changed !== game.score_just_changed) {
            if (game.score_just_changed) {
              console.log(`📺 Commercial started (score changed) for ${game.event_id} (${game.away_team} @ ${game.home_team})`);
            } else {
              console.log(`▶️ Commercial cleared (play resumed) for ${game.event_id} (${game.away_team} @ ${game.home_team})`);
            }
          }
          
          // Log new play detection
          if (playChanged) {
            console.log(`🎮 New play detected for ${game.event_id} (${game.away_team} @ ${game.home_team}): play_sequence changed`);
          } else if (downChanged && game.down !== null && game.distance !== null) {
            console.log(`🎮 New play detected for ${game.event_id} (${game.away_team} @ ${game.home_team}): down/distance changed`);
          }
          
          // Update previous state with timestamp
          const now = Date.now();
          
          // Track when down/distance last changed
          let lastPlayUpdateTime = prevState.lastPlayUpdateTime;
          if (downChanged && game.down !== null && game.distance !== null) {
            // Down/distance changed - this is a new play
            lastPlayUpdateTime = now;
            console.log(`🎮 Play updated for ${game.event_id} (${game.away_team} @ ${game.home_team}): ${game.down} & ${game.distance}`);
          } else if (playChanged) {
            // Play sequence changed - this is a new play
            lastPlayUpdateTime = now;
            console.log(`🎮 Play sequence updated for ${game.event_id} (${game.away_team} @ ${game.home_team})`);
          }
          
          previousGameState.current[game.event_id] = {
            down: game.down,
            distance: game.distance,
            play_sequence: playSequence,
            is_timeout: game.is_timeout,
            score_just_changed: game.score_just_changed,
            lastPlayUpdateTime: lastPlayUpdateTime || now, // Track when play last updated
          };
        });
        
        // Quick check: compare key fields instead of full JSON stringify
        if (!prevStatus) {
          return { games };
        }
        
        // Compare essential fields that would cause visual changes
        if ((prevStatus.games?.length || 0) !== games.length) {
          console.log(`📊 Games count changed: ${prevStatus.games?.length || 0} → ${games.length}`);
          return { games };
        }
        
        // Check if games array changed (by event_id and excitement_score)
        if (prevStatus.games && games.length > 0) {
          const prevGamesStr = prevStatus.games.map(g => `${g.event_id}-${g.game_excitement_score}`).join('|');
          const newGamesStr = games.map(g => `${g.event_id}-${g.game_excitement_score}`).join('|');
          if (prevGamesStr !== newGamesStr) {
            console.log('📊 Games data changed (excitement scores or IDs)');
            return { games };
          }
        }
        
        return prevStatus; // No changes, keep previous state
      });
      
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('❌ Error fetching status:', error);
      console.error('Error details:', error.message, error.stack);
      console.error('API URL:', API_BASE_URL || 'Not set');
      setLoading(false);
      setRefreshing(false);
      // Keep status as null to show error message
    }
  }, []);

  const handleStart = () => {
    // Monitoring is now client-side only - just start polling
    setMonitoring(true);
    monitoringJustStartedRef.current = true; // Mark that monitoring just started
    console.log('✅ Monitoring started (client-side polling) - will immediately switch to recommended channel');
  };

  const handleStop = () => {
    // Stop client-side polling
    setMonitoring(false);
    console.log('⏸️ Monitoring stopped');
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
        {/* AdMob Banner Ad */}
        <View style={styles.bannerAdContainer}>
          <BannerAd
            unitId="ca-app-pub-5717605354410342/5201742866"
            size={BannerAdSize.BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
          />
        </View>

        {/* Debug Panel - Visible when debug mode is enabled */}
        {debugMode && (
          <View style={styles.debugPanel}>
            <Text style={styles.debugTitle}>🔍 Debug Info</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Auth:</Text>
              <Text style={[styles.debugValue, authenticated && styles.debugValueSuccess]}>
                {authenticated ? '✓' : '✗'}
              </Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Monitoring:</Text>
              <Text style={[styles.debugValue, monitoring && styles.debugValueSuccess]}>
                {monitoring ? '✓' : '✗'}
              </Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Games:</Text>
              <Text style={styles.debugValue}>{status?.games?.length || 0}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Mappings:</Text>
              <Text style={styles.debugValue}>{Object.keys(channelConfig.gameMappings || {}).length}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Recommended:</Text>
              <Text style={styles.debugValue}>{recommendedChannelRef.current || 'None'}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Current:</Text>
              <Text style={styles.debugValue}>{currentChannel || 'None'}</Text>
            </View>
            {recommendedChannelTimeRef.current && (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Stability:</Text>
                <Text style={styles.debugValue}>
                  {Math.round((Date.now() - recommendedChannelTimeRef.current) / 1000)}s
                </Text>
              </View>
            )}
            {lastChannelChangeTime.current && (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Cooldown:</Text>
                <Text style={styles.debugValue}>
                  {Math.max(0, Math.round((CHANNEL_CHANGE_COOLDOWN_MS - (Date.now() - lastChannelChangeTime.current)) / 1000))}s
                </Text>
              </View>
            )}
            
            {/* WebView Debug Info */}
            <View style={[styles.debugRow, { borderTopWidth: 2, borderTopColor: '#374151', marginTop: 8, paddingTop: 8 }]}>
              <Text style={styles.debugLabel}>WebView Debug:</Text>
            </View>
            {webViewDebugInfo?.lastButtonClick && (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Last Click:</Text>
                <Text style={[styles.debugValue, styles.debugValueSuccess]}>
                  {webViewDebugInfo.lastButtonClick.vcode} @ {new Date(webViewDebugInfo.lastButtonClick.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            )}
            {webViewDebugInfo?.lastError && (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Last Error:</Text>
                <Text style={[styles.debugValue, { color: '#ef4444' }]}>
                  {webViewDebugInfo.lastError}
                </Text>
              </View>
            )}
            {webViewDebugInfo?.buttonClicks && webViewDebugInfo.buttonClicks.length > 0 && (
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Button Clicks:</Text>
                <Text style={styles.debugValue}>
                  {webViewDebugInfo.buttonClicks.length} recent
                </Text>
              </View>
            )}
            
            {/* Manual Remote Test Button */}
            <TouchableOpacity
              style={[styles.button, styles.buttonInfo, { marginTop: 12 }]}
              onPress={() => {
                openWebView();
                Alert.alert(
                  'Remote Test Mode',
                  'The remote is now open. Try clicking buttons manually to test if they work. Check the debug overlay in the top-right corner of the remote if debug mode is enabled.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Ionicons name="bug" size={20} color="white" />
              <Text style={styles.buttonText}>🔧 Test Remote Manually</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🏈</Text>
          <Text style={styles.title}>Remote Zone</Text>
          
          {/* Settings Button */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#667eea" />
          </TouchableOpacity>
          
          <View style={styles.statusBadge}>
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
          {/* Activity logs removed - server is stateless */}
        </View>

        {/* Step 1: Authentication */}
        <View style={styles.card}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepNumber, authenticated && styles.stepNumberComplete]}>
              <Text style={[styles.stepNumberText, authenticated && styles.stepNumberTextComplete]}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Step 1: Authenticate</Text>
            <View
              style={[
                styles.authBadge,
                {
                  backgroundColor: authenticated ? '#10b981' : '#ef4444',
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {authenticated ? '✓' : '✗'}
              </Text>
            </View>
          </View>
          <Text style={styles.stepDescription}>
            {authenticated 
              ? 'You are authenticated with your TV provider.'
              : 'Authenticate with your TV provider to enable channel switching.'}
          </Text>
          {!authenticated && (
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => navigation.navigate('Auth')}
            >
              <Ionicons name="lock-closed" size={20} color="white" />
              <Text style={styles.buttonText}>Authenticate</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step 2: Configure Channels */}
        <View style={styles.card}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepNumber, Object.keys(channelConfig.gameMappings).length > 0 && styles.stepNumberComplete]}>
              <Text style={[styles.stepNumberText, Object.keys(channelConfig.gameMappings).length > 0 && styles.stepNumberTextComplete]}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Step 2: Configure Channels</Text>
            <View 
              style={[
                styles.authBadge,
                {
                  backgroundColor: Object.keys(channelConfig.gameMappings).length > 0 ? '#10b981' : '#ef4444',
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {Object.keys(channelConfig.gameMappings).length > 0 ? '✓' : '✗'}
              </Text>
            </View>
          </View>
          <Text style={styles.stepDescription}>
            {Object.keys(channelConfig.gameMappings).length > 0
              ? `You have ${Object.keys(channelConfig.gameMappings).length} game(s) mapped to channels.`
              : 'Map NFL and College Football games to TV channels.'}
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => {
              navigation.navigate('Config');
              // Reload config when returning from Config screen
              setTimeout(() => loadChannelConfig(), 1000);
            }}
          >
            <Ionicons name="settings" size={20} color="white" />
            <Text style={styles.buttonText}>Configure Channels</Text>
          </TouchableOpacity>
        </View>

        {/* Current Channel */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Channel</Text>
          <Text style={styles.currentChannel}>
            {currentChannel || '--'}
          </Text>
          {lastChannelChangeTime.current && (
            <Text style={styles.cooldownText}>
              Last changed: {new Date(lastChannelChangeTime.current).toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Control Buttons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Control</Text>
          {!monitoring ? (
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleStart}
              disabled={!authenticated || Object.keys(channelConfig.gameMappings).length === 0}
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
          {(!authenticated || Object.keys(channelConfig.gameMappings).length === 0) && (
            <Text style={styles.warningText}>
              {!authenticated
                ? 'Please authenticate with your TV provider first'
                : 'Please configure channels and map games in Config screen'}
            </Text>
          )}
        </View>

        {/* Activity Logs - Removed (server is stateless) */}
        {false && monitoring && status.logs && status.logs.length > 0 && (
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

        {/* Games List - Only show monitored games (games mapped to channels) */}
        {status.games && status.games.length > 0 && (() => {
          // Filter to only show games that are mapped to channels (monitored games)
          const monitoredGames = status.games.filter(game => 
            channelConfig.gameMappings && channelConfig.gameMappings[game.event_id]
          );
          
          if (monitoredGames.length === 0) {
            return null; // Don't show games section if no monitored games
          }
          
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Monitored Games ({monitoredGames.length})</Text>
              <Text style={styles.subtitle}>Tap a game to switch to its channel</Text>
              {monitoredGames.map((game, index) => {
                const mapping = channelConfig.gameMappings[game.event_id];
                const gameChannel = mapping?.channel;
                const gamePriority = mapping?.priority;
                
                // Check if a new play has occurred - use play_sequence (most reliable) or down/distance as fallback
                const previousState = previousGameState.current[game.event_id] || {};
                const playSequence = game.play_sequence || game.play_id || null;
                const now = Date.now();
                
                // Method 1: Check if play sequence changed (most reliable - from server)
                const playSequenceChanged = playSequence && previousState.play_sequence && 
                                          playSequence !== previousState.play_sequence;
                
                // Method 2: Check if down/distance changed (fallback if play_sequence not available)
                const downChanged = previousState.down !== undefined && 
                                   (previousState.down !== game.down || previousState.distance !== game.distance);
                const downChangedValid = downChanged && game.down !== null && game.distance !== null;
                
                // Method 3: Check if plays are being updated regularly
                // If down/distance hasn't changed in a while, it's likely stuck (commercial)
                const lastPlayUpdateTime = previousState.lastPlayUpdateTime;
                let isPlayStuck = false;
                if (lastPlayUpdateTime) {
                  const timeSinceLastPlay = now - lastPlayUpdateTime;
                  isPlayStuck = timeSinceLastPlay > COMMERCIAL_STUCK_TIME_MS;
                } else {
                  // First time seeing this game - can't determine if stuck yet
                  // But if server says timeout/commercial, trust it
                  isPlayStuck = false;
                }
                
                // Check if we're at 4th down (common commercial time after punts)
                const isFourthDown = game.down === 4;
                
                // Game is actively being played if:
                // 1. Play sequence changed (new play detected)
                // 2. Down/distance changed (new play detected)
                // 3. Plays are updating regularly (not stuck) - only if we have history
                const hasNewPlay = playSequenceChanged || downChangedValid;
                const isActive = hasNewPlay || (lastPlayUpdateTime && !isPlayStuck);
                
                // Show commercial indicator if:
                // - Server says timeout/commercial AND (no new play OR play is stuck)
                // - OR at 4th down AND play is stuck (likely punt = commercial)
                // Trust server flags immediately, but also check if play has resumed
                const showCommercialTimeout = (!hasNewPlay && (game.is_timeout || game.score_just_changed)) || 
                                            (isFourthDown && isPlayStuck && !hasNewPlay);
              
              return (
              <TouchableOpacity
                key={game.event_id || index}
                style={[
                  styles.gameCard,
                  game.in_redzone && styles.gameCardRedzone,
                  !mapping && styles.gameCardUnmapped,
                ]}
                onPress={async () => {
                  console.log(`🎮 Game card clicked: ${game.away_team} @ ${game.home_team}, channel: ${gameChannel}`);
                  
                  if (!authenticated) {
                    console.error('❌ Not authenticated - cannot change channel');
                    Alert.alert(
                      'Authentication Required',
                      'Please authenticate with your TV provider first. Go to the Auth screen to sign in.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Go to Auth', onPress: () => navigation.navigate('Auth') }
                      ]
                    );
                    return;
                  }
                  
                  if (!gameChannel) {
                    console.error('❌ No channel mapped for this game');
                    Alert.alert(
                      'Channel Not Mapped',
                      'This game is not mapped to a channel. Go to Config to map it.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Go to Config', onPress: () => navigation.navigate('Config') }
                      ]
                    );
                    return;
                  }
                  
                  console.log(`📺 Attempting manual channel change to ${gameChannel}`);
                  
                  // Manual click overrides cooldown - allow immediate channel change
                  const now = Date.now();
                  
                  // Wait for channel change to complete
                  changeChannel(gameChannel).then((success) => {
                    console.log(`📺 changeChannel returned: ${success}`);
                    
                    if (success) {
                      console.log(`✅ Channel change initiated successfully for ${gameChannel}`);
                      setCurrentChannel(gameChannel);
                      lastChannelChangeTime.current = now;
                      // Show success feedback
                      Alert.alert('Channel Change', `Changing to channel ${gameChannel}...`);
                    } else {
                      console.error('❌ Channel change failed - changeChannel returned false');
                      Alert.alert(
                        'Channel Change Failed',
                        `Could not change to channel ${gameChannel}. Please check:\n\n1. You are authenticated\n2. The remote is loaded\n3. Try opening the remote once to ensure it's ready.`,
                        [
                          { text: 'OK', style: 'cancel' },
                          { text: 'Open Remote', onPress: () => {
                            // Open the remote WebView to ensure it's loaded
                            openWebView();
                          }}
                        ]
                      );
                    }
                  });
                }}
                disabled={!authenticated || !gameChannel}
              >
                <View style={styles.gameCardHeader}>
                  <Text style={styles.gameTitle}>
                    {game.away_team} @ {game.home_team}
                  </Text>
                </View>
                {gameChannel ? (
                  <View style={styles.channelBadge}>
                    <Ionicons name="tv" size={16} color="#667eea" />
                    <Text style={styles.channelBadgeText}>Ch {gameChannel} (P{gamePriority})</Text>
                  </View>
                ) : (
                  <View style={[styles.channelBadge, { backgroundColor: '#fee2e2' }]}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={[styles.channelBadgeText, { color: '#ef4444' }]}>Not Mapped</Text>
                  </View>
                )}
                {/* Score */}
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreText} numberOfLines={1} ellipsizeMode="tail">
                    {game.away_team}: {game.away_score || 0}
                  </Text>
                  <Text style={styles.scoreText} numberOfLines={1} ellipsizeMode="tail">
                    {game.home_team}: {game.home_score || 0}
                  </Text>
                </View>
                
                {/* Game Details Grid */}
                <View style={styles.gameDetailsGrid}>
                  {game.down && game.distance !== null && (
                    <View style={styles.gameDetailItem}>
                      <Ionicons name="flag" size={16} color="#667eea" />
                      <Text style={styles.gameDetailText}>
                        {(() => {
                          const downOrdinal = game.down === 1 ? '1st' : 
                                             game.down === 2 ? '2nd' : 
                                             game.down === 3 ? '3rd' : '4th';
                          const yardText = game.distance === 1 ? 'yard' : 'yards';
                          return `${downOrdinal} down & ${game.distance} ${yardText}`;
                        })()}
                      </Text>
                    </View>
                  )}
                  {(game.yards_to_endzone !== null && game.yards_to_endzone !== undefined) && (
                    <View style={styles.gameDetailItem}>
                      <Ionicons name="location" size={16} color="#667eea" />
                      <Text style={styles.gameDetailText}>
                        {game.yards_to_endzone} {game.yards_to_endzone === 1 ? 'yd' : 'yds'} to endzone
                      </Text>
                    </View>
                  )}
                  {game.quarter > 0 && (
                    <View style={styles.gameDetailItem}>
                      <Ionicons name="time" size={16} color="#667eea" />
                      <Text style={styles.gameDetailText}>
                        Q{game.quarter} {game.clock_seconds ? `${Math.floor(game.clock_seconds / 60)}:${String(game.clock_seconds % 60).padStart(2, '0')}` : '--'}
                      </Text>
                    </View>
                  )}
                  {game.play_timestamp && (
                    <View style={styles.gameDetailItem}>
                      <Ionicons name="refresh" size={16} color="#10b981" />
                      <Text style={styles.gameDetailText}>
                        Updated: {formatRelativeTime(game.play_timestamp)}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Excitement Score */}
                <View style={styles.gameDetailItem}>
                  <Ionicons name="flame" size={16} color="#f59e0b" />
                  <Text style={styles.gameDetailText}>
                    Excitement: {game.game_excitement_score?.toFixed(0) || 0}
                  </Text>
                </View>

                {/* Possession - Only show current possession_team, not last_redzone_team */}
                {game.possession_team && (
                  <View style={styles.gameDetailItem}>
                    <Text style={styles.footballIcon}>🏈</Text>
                    <Text style={styles.gameDetailText}>
                      {game.possession_team}'s ball
                    </Text>
                  </View>
                )}

                {game.in_redzone && (
                  <View style={styles.redzoneBadge}>
                    <Text style={styles.redzoneText}>
                      🔴 REDZONE: {game.last_redzone_team || game.possession_team || 'Team'} at {game.yards_to_endzone || '?'}yds
                    </Text>
                  </View>
                )}

                {/* Commercial/Timeout Indicator - Only show if down/distance hasn't changed (game is not being played) */}
                {showCommercialTimeout && (
                  <View style={styles.commercialBadge}>
                    <Ionicons name="tv-outline" size={16} color="#f59e0b" />
                    <Text style={styles.commercialText}>
                      {game.is_timeout ? '⏸️ TIMEOUT' : '📺 COMMERCIAL'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              );
            })}
            </View>
          );
        })()}

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
  bannerAdContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    marginBottom: 12,
  },
  leagueSelector: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    alignSelf: 'center',
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
  cooldownText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  gameCardUnmapped: {
    opacity: 0.6,
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
  buttonInfo: {
    backgroundColor: '#5865F2',
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
    marginBottom: 8,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
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
  scoreRow: {
    flexDirection: 'column',
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  footballIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  gameDetailsGrid: {
    marginTop: 8,
    marginBottom: 8,
  },
  gameDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gameDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberComplete: {
    backgroundColor: '#10b981',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  stepNumberTextComplete: {
    color: 'white',
  },
  stepTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  stepBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  stepBadgeComplete: {
    backgroundColor: '#d1fae5',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  stepBadgeTextComplete: {
    color: '#065f46',
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  buttonSecondary: {
    backgroundColor: '#10b981',
  },
  settingsButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
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
  commercialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  commercialText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  logsContainer: {
    maxHeight: 200,
    marginTop: 8,
  },
  debugPanel: {
    backgroundColor: '#1f2937',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  debugTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  debugLabel: {
    color: '#9ca3af',
    fontSize: 12,
    flex: 1,
  },
  debugValue: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  debugValueSuccess: {
    color: '#10b981',
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

