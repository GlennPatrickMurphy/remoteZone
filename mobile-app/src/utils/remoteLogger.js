// Remote logging utility for TestFlight builds
// Logs are sent to Firebase Firestore for remote viewing
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Platform } from 'react-native';

// Log levels
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

// Configuration
const LOG_COLLECTION = 'app_logs';
const ENABLE_REMOTE_LOGGING = true; // Set to false to disable remote logging
const MAX_LOG_LENGTH = 1000; // Truncate long logs

// Cache logs locally to batch send (optional optimization)
let logCache = [];
let logCacheTimer = null;
const BATCH_SIZE = 10;
const BATCH_TIMEOUT = 5000; // 5 seconds

/**
 * Send logs to Firestore in batches
 */
const flushLogCache = async () => {
  if (logCache.length === 0) return;
  
  const logsToSend = [...logCache];
  logCache = [];
  
  try {
    // Send logs in parallel
    await Promise.all(
      logsToSend.map(log => 
        addDoc(collection(db, LOG_COLLECTION), {
          ...log,
          timestamp: serverTimestamp(),
        }).catch(err => {
          // Silently fail - don't break the app if logging fails
          console.error('Failed to send log to Firestore:', err);
        })
      )
    );
  } catch (error) {
    console.error('Error flushing log cache:', error);
  }
};

/**
 * Schedule batch flush
 */
const scheduleFlush = () => {
  if (logCacheTimer) {
    clearTimeout(logCacheTimer);
  }
  
  logCacheTimer = setTimeout(() => {
    flushLogCache();
  }, BATCH_TIMEOUT);
  
  // Also flush if cache is full
  if (logCache.length >= BATCH_SIZE) {
    flushLogCache();
  }
};

/**
 * Remote logger - sends logs to Firebase Firestore
 */
export const remoteLog = async (level, message, data = null) => {
  // Always log to console first (for development)
  const consoleMethod = level === LogLevel.ERROR ? console.error :
                        level === LogLevel.WARN ? console.warn :
                        level === LogLevel.DEBUG ? console.debug :
                        console.log;
  
  if (data) {
    consoleMethod(`[${level.toUpperCase()}] ${message}`, data);
  } else {
    consoleMethod(`[${level.toUpperCase()}] ${message}`);
  }
  
  // Skip remote logging if disabled
  if (!ENABLE_REMOTE_LOGGING) {
    return;
  }
  
  try {
    // Truncate long messages
    const truncatedMessage = message.length > MAX_LOG_LENGTH 
      ? message.substring(0, MAX_LOG_LENGTH) + '... [truncated]'
      : message;
    
    // Prepare log entry
    const logEntry = {
      level,
      message: truncatedMessage,
      platform: Platform.OS,
      platformVersion: Platform.Version,
      timestamp: new Date().toISOString(),
      ...(data && { data: typeof data === 'object' ? JSON.stringify(data) : String(data) }),
    };
    
    // Add to cache for batch sending
    logCache.push(logEntry);
    scheduleFlush();
    
  } catch (error) {
    // Silently fail - don't break the app if logging fails
    console.error('Error in remote logger:', error);
  }
};

/**
 * Convenience methods
 */
export const logDebug = (message, data) => remoteLog(LogLevel.DEBUG, message, data);
export const logInfo = (message, data) => remoteLog(LogLevel.INFO, message, data);
export const logWarn = (message, data) => remoteLog(LogLevel.WARN, message, data);
export const logError = (message, data) => remoteLog(LogLevel.ERROR, message, data);

/**
 * Flush all pending logs immediately
 */
export const flushLogs = async () => {
  await flushLogCache();
};

/**
 * Initialize logger - flush logs on app start
 */
export const initLogger = async () => {
  logInfo('App started', {
    platform: Platform.OS,
    version: Platform.Version,
  });
  
  // Flush any pending logs
  await flushLogCache();
};

