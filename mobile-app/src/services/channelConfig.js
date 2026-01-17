// Firebase service for storing channel/game configuration per user
import { db, auth } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const CHANNEL_CONFIG_COLLECTION = 'channelConfig';

/**
 * Get channel configuration for the current user
 * Returns: { channels: [1, 2, 3], gameMappings: { event_id: { channel: 1, priority: 1 } } }
 */
export const getChannelConfig = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('No user logged in, cannot load channel config');
      return { channels: [], gameMappings: {} };
    }

    const configRef = doc(db, CHANNEL_CONFIG_COLLECTION, user.uid);
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      const data = configSnap.data();
      return {
        channels: data.channels || [],
        gameMappings: data.gameMappings || {},
      };
    }

    // Return default empty config
    return { channels: [], gameMappings: {} };
  } catch (error) {
    console.error('Error loading channel config:', error);
    return { channels: [], gameMappings: {} };
  }
};

/**
 * Save channel configuration for the current user
 * @param {number[]} channels - Array of channel numbers
 */
export const saveChannels = async (channels) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to save channel config');
    }

    const configRef = doc(db, CHANNEL_CONFIG_COLLECTION, user.uid);
    const currentData = (await getDoc(configRef)).data() || {};
    
    await setDoc(configRef, {
      ...currentData,
      channels: channels.filter(ch => ch !== '').map(ch => parseInt(ch)),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('✅ Channels saved to Firebase');
    return true;
  } catch (error) {
    console.error('Error saving channels:', error);
    throw error;
  }
};

/**
 * Map a game (by event_id) to a channel with priority
 * @param {string} eventId - Game event ID
 * @param {number} channel - Channel number
 * @param {number} priority - Priority (1 = highest)
 */
export const mapGameToChannel = async (eventId, channel, priority) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to map games');
    }

    const configRef = doc(db, CHANNEL_CONFIG_COLLECTION, user.uid);
    const currentData = (await getDoc(configRef)).data() || {};
    const gameMappings = currentData.gameMappings || {};

    gameMappings[eventId] = {
      channel: parseInt(channel),
      priority: parseInt(priority),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(configRef, {
      ...currentData,
      gameMappings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`✅ Mapped game ${eventId} to channel ${channel} with priority ${priority}`);
    return true;
  } catch (error) {
    console.error('Error mapping game:', error);
    throw error;
  }
};

/**
 * Remove a game mapping
 * @param {string} eventId - Game event ID to remove
 */
export const removeGameMapping = async (eventId) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to remove game mappings');
    }

    const configRef = doc(db, CHANNEL_CONFIG_COLLECTION, user.uid);
    const currentData = (await getDoc(configRef)).data() || {};
    const gameMappings = currentData.gameMappings || {};

    delete gameMappings[eventId];

    await setDoc(configRef, {
      ...currentData,
      gameMappings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`✅ Removed game mapping for ${eventId}`);
    return true;
  } catch (error) {
    console.error('Error removing game mapping:', error);
    throw error;
  }
};

/**
 * Clear all game mappings
 */
export const clearGameMappings = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to clear game mappings');
    }

    const configRef = doc(db, CHANNEL_CONFIG_COLLECTION, user.uid);
    await setDoc(configRef, {
      gameMappings: {},
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('✅ Cleared all game mappings');
    return true;
  } catch (error) {
    console.error('Error clearing game mappings:', error);
    throw error;
  }
};

/**
 * Set a game as priority 1, shifting all other priorities
 * @param {string} eventId - Game event ID to set as priority 1
 */
export const setPriority1 = async (eventId) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to set priority');
    }

    const configRef = doc(db, CHANNEL_CONFIG_COLLECTION, user.uid);
    const currentData = (await getDoc(configRef)).data() || {};
    const gameMappings = currentData.gameMappings || {};

    // Check if game is mapped
    if (!gameMappings[eventId]) {
      throw new Error('Game must be mapped to a channel before setting priority');
    }

    // Get current priority of the game we're setting to 1
    const targetPriority = gameMappings[eventId].priority;

    // If already priority 1, do nothing
    if (targetPriority === 1) {
      return true;
    }

    // Shift priorities: all games with priority < targetPriority get +1
    // The target game gets priority 1
    Object.keys(gameMappings).forEach(key => {
      if (key === eventId) {
        gameMappings[key].priority = 1;
      } else {
        const currentPriority = gameMappings[key].priority;
        if (currentPriority < targetPriority) {
          gameMappings[key].priority = currentPriority + 1;
        }
      }
      gameMappings[key].updatedAt = new Date().toISOString();
    });

    await setDoc(configRef, {
      ...currentData,
      gameMappings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`✅ Set game ${eventId} to priority 1`);
    return true;
  } catch (error) {
    console.error('Error setting priority 1:', error);
    throw error;
  }
};

