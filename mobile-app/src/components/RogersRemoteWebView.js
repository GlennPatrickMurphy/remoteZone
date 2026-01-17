import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { logInfo, logError, logWarn, logDebug } from '../utils/remoteLogger';

const RogersRemoteWebView = forwardRef(({ onAuthenticated, style, remoteUrl, onButtonClick, debugMode }, ref) => {
  const webViewRef = useRef(null);
  const changingChannelRef = useRef(false);
  const [buttonClickLog, setButtonClickLog] = React.useState([]);
  const readinessResolverRef = useRef(null);

  const changeChannel = (channelNumber) => {
    if (!webViewRef.current) {
      console.error('❌ WebView ref not available for channel change');
      logError('WebView ref not available for channel change', { channelNumber });
      return;
    }
    
    // Prevent multiple simultaneous channel changes
    if (changingChannelRef.current) {
      console.log('⏸️ Channel change already in progress, ignoring...');
      logWarn('Channel change already in progress, ignoring', { channelNumber });
      return;
    }

    console.log(`📺 Attempting to change channel to ${channelNumber}`);
    logInfo('Attempting to change channel', { channelNumber });
    
    // Check if WebView is ready before proceeding
    const checkWebViewReady = () => {
      return new Promise((resolve) => {
        const readyScript = `
          (function() {
            if (document.readyState === 'complete' && document.body) {
              const button = document.querySelector('[data-vcode="NUMBER_1"]');
              if (button) {
                return { ready: true, authenticated: true };
              }
              return { ready: true, authenticated: false };
            }
            return { ready: false, authenticated: false };
          })();
        `;
        
        if (!webViewRef.current) {
          resolve({ ready: false, authenticated: false });
          return;
        }
        
        // Store resolver so message handler can call it
        readinessResolverRef.current = resolve;
        
        // Inject readiness check
        webViewRef.current.injectJavaScript(`
          (function() {
            const result = ${readyScript};
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'channelChangeReadiness',
              ready: result.ready,
              authenticated: result.authenticated
            }));
          })();
        `);
        
        // Timeout fallback in case message never arrives
        setTimeout(() => {
          if (readinessResolverRef.current === resolve) {
            console.warn('⚠️ Readiness check timeout - assuming ready but not authenticated');
            logWarn('Readiness check timeout - assuming ready but not authenticated', { channelNumber });
            readinessResolverRef.current = null;
            resolve({ ready: true, authenticated: false });
          }
        }, 2000);
      });
    };
    
    // Wait for readiness before changing channel
    checkWebViewReady().then((readiness) => {
      if (!readiness.ready) {
        console.warn('⚠️ WebView not ready, waiting...');
        logWarn('WebView not ready, waiting', { channelNumber, readiness });
        setTimeout(() => {
          changeChannel(channelNumber);
        }, 1000);
        return;
      }
      
      if (!readiness.authenticated) {
        console.warn('⚠️ WebView not authenticated, cannot change channel');
        logWarn('WebView not authenticated, cannot change channel', { channelNumber, readiness });
        changingChannelRef.current = false;
        return;
      }
      
      // Proceed with channel change
      changingChannelRef.current = true;
      const channelStr = String(channelNumber);
      
      const script = `
      (function() {
        // Clear any existing timeouts
        if (window._channelChangeTimeouts) {
          window._channelChangeTimeouts.forEach(clearTimeout);
        }
        window._channelChangeTimeouts = [];
        
        // Function to click a button by data-vcode
        function clickButton(vcode) {
          try {
            const button = document.querySelector('[data-vcode="' + vcode + '"]');
            if (button) {
              // Try multiple click methods to ensure it works
              let clicked = false;
              if (button.click) {
                button.click();
                clicked = true;
              } else if (button.dispatchEvent) {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                button.dispatchEvent(clickEvent);
                clicked = true;
              } else {
                // Fallback: trigger touch events
                try {
                  const touchStart = new TouchEvent('touchstart', { bubbles: true });
                  const touchEnd = new TouchEvent('touchend', { bubbles: true });
                  button.dispatchEvent(touchStart);
                  button.dispatchEvent(touchEnd);
                  clicked = true;
                } catch (e) {
                  // Touch events failed
                }
              }
              
              // Send confirmation
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'buttonClicked',
                vcode: vcode,
                success: true,
                timestamp: new Date().toISOString()
              }));
              
              return clicked;
            } else {
              // List available buttons for debugging
              const allButtons = document.querySelectorAll('[data-vcode]');
              const available = Array.from(allButtons).map(b => b.getAttribute('data-vcode')).slice(0, 10);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'buttonNotFound',
                vcode: vcode,
                availableButtons: available
              }));
              return false;
            }
          } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'buttonClickError',
              vcode: vcode,
              error: error.message
            }));
            return false;
          }
        }
        
        // Press each digit
        const digits = "${channelStr}".split("");
        
        digits.forEach((digit, index) => {
          const timeoutId = setTimeout(() => {
            clickButton("NUMBER_" + digit);
          }, index * 400);
          window._channelChangeTimeouts.push(timeoutId);
        });
        
        // Press ENTER after all digits
        const enterTimeoutId = setTimeout(() => {
          const enterClicked = clickButton("ENTER");
          if (enterClicked) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'channelChanged',
              channel: ${channelNumber},
              success: true,
              timestamp: new Date().toISOString()
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'channelChangeError',
              channel: ${channelNumber},
              error: 'ENTER button not found'
            }));
          }
          // Clear timeouts after done
          window._channelChangeTimeouts = [];
        }, digits.length * 400 + 300);
        window._channelChangeTimeouts.push(enterTimeoutId);
        
        return true;
      })();
      true;
    `;
      
      // Verify WebView is ready before injecting JavaScript
      if (!webViewRef.current) {
        console.error('❌ WebView ref is null - cannot inject JavaScript');
        logError('WebView ref is null - cannot inject JavaScript', { channelNumber });
        changingChannelRef.current = false;
        return;
      }

      try {
        console.log(`💉 Injecting JavaScript for channel ${channelNumber}...`);
        logInfo('Injecting JavaScript for channel change', { channelNumber });
        webViewRef.current.injectJavaScript(script);
        console.log(`✅ JavaScript injected successfully for channel ${channelNumber}`);
        logInfo('JavaScript injected successfully', { channelNumber });
        
        // Also verify the script was executed by checking for a response
        // We'll get a message back if buttons are found/not found
        
        // Reset the flag after channel change completes
        const totalTime = channelStr.length * 400 + 300 + 500;
        setTimeout(() => {
          if (changingChannelRef.current) {
            console.warn('⚠️ Channel change timeout - resetting flag');
            logWarn('Channel change timeout - resetting flag', { channelNumber, totalTime });
            changingChannelRef.current = false;
          }
        }, totalTime);
      } catch (error) {
        console.error('❌ Error injecting JavaScript:', error);
        logError('Error injecting JavaScript', { channelNumber, error: error.message, stack: error.stack });
        changingChannelRef.current = false;
      }
    });
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📨 WebView message:', data.type, data.debug || '');
      
      if (data.type === 'authenticated') {
        onAuthenticated && onAuthenticated(true);
        // WebView is now loaded and ready
        console.log('✅ WebView loaded and authenticated', data.debug || '');
        logInfo('WebView loaded and authenticated', { debug: data.debug || '' });
      } else if (data.type === 'needsAuth') {
        console.log('⚠️ WebView needs authentication', data.debug || '');
        logWarn('WebView needs authentication', { debug: data.debug || '' });
        onAuthenticated && onAuthenticated(false);
      } else if (data.type === 'authCheck') {
        console.log('🔍 WebView auth check:', data.debug || '', data.url || '');
        logDebug('WebView auth check', { debug: data.debug || '', url: data.url || '' });
      } else if (data.type === 'channelChanged') {
        console.log('✅ Channel changed to:', data.channel);
        logInfo('Channel changed successfully', { channel: data.channel });
        // Reset the flag when channel change completes
        changingChannelRef.current = false;
      } else if (data.type === 'channelChangeError') {
        console.error('❌ Channel change error:', data.error, 'for channel', data.channel);
        logError('Channel change error', { channel: data.channel, error: data.error });
        changingChannelRef.current = false;
      } else if (data.type === 'buttonNotFound') {
        console.warn('⚠️ Button not found in WebView:', data.vcode);
        logWarn('Button not found in WebView', { vcode: data.vcode, availableButtons: data.availableButtons });
        if (data.availableButtons) {
          console.log('📋 Available buttons:', data.availableButtons);
        }
      } else if (data.type === 'buttonClicked') {
        console.log('✅ Button clicked successfully:', data.vcode, 'at', data.timestamp);
        logInfo('Button clicked successfully', { vcode: data.vcode, timestamp: data.timestamp });
        setButtonClickLog(prev => [...prev.slice(-9), {
          vcode: data.vcode,
          timestamp: data.timestamp,
          success: true
        }]);
        // Expose this to parent via callback
        if (onButtonClick) {
          onButtonClick(data);
        }
      } else if (data.type === 'buttonClickError') {
        console.error('❌ Error clicking button:', data.vcode, data.error);
        logError('Error clicking button', { vcode: data.vcode, error: data.error });
        setButtonClickLog(prev => [...prev.slice(-9), {
          vcode: data.vcode,
          timestamp: new Date().toISOString(),
          success: false,
          error: data.error
        }]);
      } else if (data.type === 'webViewError') {
        console.error('❌ WebView error:', data.error, 'Code:', data.code);
        logError('WebView error', { error: data.error, code: data.code });
      } else if (data.type === 'readinessCheck') {
        console.log('🔍 Readiness check result:', data.ready, 'hasButtons:', data.hasButtons);
        logDebug('Readiness check result', { ready: data.ready, hasButtons: data.hasButtons });
      } else if (data.type === 'channelChangeReadiness') {
        console.log('🔍 Channel change readiness:', data.ready, 'authenticated:', data.authenticated);
        logDebug('Channel change readiness check', { ready: data.ready, authenticated: data.authenticated });
        // Resolve the readiness check promise
        if (readinessResolverRef.current) {
          readinessResolverRef.current({
            ready: data.ready,
            authenticated: data.authenticated
          });
          readinessResolverRef.current = null;
        }
      } else if (data.type === 'navigationStateChange') {
        console.log('📡 Navigation state:', data.url, 'loading:', data.loading);
        logDebug('Navigation state change', { url: data.url, loading: data.loading });
      } else if (data.type === 'networkRequest') {
        console.log(`🌐 Network request: ${data.method} ${data.httpMethod || 'GET'} ${data.url}`);
        logInfo('Network request', { method: data.method, httpMethod: data.httpMethod || 'GET', url: data.url });
      } else if (data.type === 'networkResponse') {
        console.log(`✅ Network response: ${data.method} ${data.url} - ${data.status} ${data.statusText || ''}`);
        logInfo('Network response', { method: data.method, url: data.url, status: data.status, statusText: data.statusText || '' });
      } else if (data.type === 'networkError') {
        console.error(`❌ Network error: ${data.method} ${data.url} - ${data.error}`);
        logError('Network error', { method: data.method, url: data.url, error: data.error });
      } else if (data.type === 'visibilityChange') {
        console.log(`👁️ Page visibility changed: hidden=${data.hidden}, state=${data.visibilityState}`);
        logDebug('Page visibility changed', { hidden: data.hidden, visibilityState: data.visibilityState });
      }
    } catch (e) {
      // Log non-JSON messages for debugging
      console.log('📨 WebView non-JSON message:', event.nativeEvent.data?.substring(0, 100));
    }
  };

  // Track when WebView starts loading
  const handleLoadStart = () => {
    console.log('📥 WebView started loading:', remoteUrl || 'https://rogers.webremote.com/remote');
    logInfo('WebView started loading', { url: remoteUrl || 'https://rogers.webremote.com/remote' });
  };

  // Track navigation state changes
  const handleNavigationStateChange = (navState) => {
    console.log('📡 Navigation state change:', {
      url: navState.url,
      loading: navState.loading,
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
      title: navState.title,
    });
    logDebug('Navigation state change', {
      url: navState.url,
      loading: navState.loading,
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
      title: navState.title,
    });
    
    // Post navigation state to parent for debugging
    if (webViewRef.current) {
      try {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'navigationStateChange',
          url: navState.url,
          loading: navState.loading,
          canGoBack: navState.canGoBack,
          canGoForward: navState.canGoForward,
          title: navState.title,
        }));
      } catch (e) {
        console.error('Could not post navigation state:', e);
        logError('Could not post navigation state', { error: e.message });
      }
    }
  };


  // Also track when WebView is loaded
  const handleLoadEnd = () => {
    console.log('✅ WebView load ended - checking for authentication...');
    console.log('WebView URL:', remoteUrl || 'https://rogers.webremote.com/remote');
    logInfo('WebView load ended - checking for authentication', { url: remoteUrl || 'https://rogers.webremote.com/remote' });
    
    // Wait longer for DOM to be ready (3-5 seconds as recommended)
    // Also check readiness before injecting
    const checkReadiness = () => {
      return new Promise((resolve) => {
        const checkScript = `
          (function() {
            if (document.readyState === 'complete' && document.body) {
              const numberButton = document.querySelector('[data-vcode="NUMBER_1"]');
              if (numberButton) {
                return { ready: true, hasButtons: true };
              }
              return { ready: true, hasButtons: false };
            }
            return { ready: false, hasButtons: false };
          })();
        `;
        
        if (!webViewRef.current) {
          resolve({ ready: false, hasButtons: false });
          return;
        }
        
        // Inject readiness check
        webViewRef.current.injectJavaScript(`
          (function() {
            const result = ${checkScript};
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'readinessCheck',
              ready: result.ready,
              hasButtons: result.hasButtons
            }));
          })();
        `);
        
        // Resolve after a delay (will be updated by message handler)
        setTimeout(() => {
          resolve({ ready: true, hasButtons: false });
        }, 500);
      });
    };
    
    // Wait for readiness, then check auth
    setTimeout(async () => {
      const readiness = await checkReadiness();
      console.log('🔍 Readiness check:', readiness);
      logDebug('Readiness check completed', readiness);
      
      // Additional delay to ensure DOM is fully interactive
      setTimeout(() => {
        const checkAuth = `
          (function() {
            const numberButton = document.querySelector('[data-vcode="NUMBER_1"]');
            const signInButton = document.querySelector('button[type="submit"]');
            const loginForm = document.querySelector('form');
            
            if (numberButton) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'authenticated',
                debug: 'Found NUMBER_1 button'
              }));
              return true;
            } else if (signInButton || loginForm) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'needsAuth',
                debug: 'Found sign in form'
              }));
              return false;
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'authCheck',
                debug: 'No auth elements found',
                bodyText: document.body ? document.body.innerText.substring(0, 100) : 'No body'
              }));
              return false;
            }
          })();
          true;
        `;
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(checkAuth);
        }
      }, 2000); // Additional 2 second delay after readiness check
    }, 3000); // Initial 3 second delay (increased from 1 second)
  };

  const injectedJavaScript = `
    (function() {
      // Network monitoring: Intercept fetch and XMLHttpRequest to log all network requests
      (function() {
        // Intercept fetch
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const url = args[0];
          const method = args[1]?.method || 'GET';
          console.log('🌐 Fetch request:', method, url);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'networkRequest',
            method: 'fetch',
            httpMethod: method,
            url: url,
            timestamp: new Date().toISOString()
          }));
          return originalFetch.apply(this, args)
            .then(response => {
              console.log('✅ Fetch response:', url, response.status);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'networkResponse',
                method: 'fetch',
                url: url,
                status: response.status,
                statusText: response.statusText,
                timestamp: new Date().toISOString()
              }));
              return response;
            })
            .catch(error => {
              console.error('❌ Fetch error:', url, error);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'networkError',
                method: 'fetch',
                url: url,
                error: error.message || 'Network error',
                timestamp: new Date().toISOString()
              }));
              throw error;
            });
        };
        
        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this._requestMethod = method;
          this._requestUrl = url;
          console.log('🌐 XHR open:', method, url);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'networkRequest',
            method: 'XHR',
            httpMethod: method,
            url: url,
            timestamp: new Date().toISOString()
          }));
          return originalOpen.apply(this, [method, url, ...args]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
          const xhr = this;
          xhr.addEventListener('load', function() {
            console.log('✅ XHR response:', xhr._requestUrl, xhr.status);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'networkResponse',
              method: 'XHR',
              url: xhr._requestUrl,
              status: xhr.status,
              statusText: xhr.statusText,
              timestamp: new Date().toISOString()
            }));
          });
          xhr.addEventListener('error', function() {
            console.error('❌ XHR error:', xhr._requestUrl);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'networkError',
              method: 'XHR',
              url: xhr._requestUrl,
              error: 'Network error',
              timestamp: new Date().toISOString()
            }));
          });
          xhr.addEventListener('timeout', function() {
            console.error('⏱️ XHR timeout:', xhr._requestUrl);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'networkError',
              method: 'XHR',
              url: xhr._requestUrl,
              error: 'Request timeout',
              timestamp: new Date().toISOString()
            }));
          });
          return originalSend.apply(this, args);
        };
      })();
      
      // Page Visibility API: Monitor when page becomes visible/hidden
      document.addEventListener('visibilitychange', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'visibilityChange',
          hidden: document.hidden,
          visibilityState: document.visibilityState,
          timestamp: new Date().toISOString()
        }));
      });
      
      // Check if authenticated by looking for remote buttons
      setTimeout(() => {
        const numberButton = document.querySelector('[data-vcode="NUMBER_1"]');
        const signInButton = document.querySelector('button[type="submit"]');
        
        if (numberButton) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'authenticated',
            debug: 'Found NUMBER_1 button on load'
          }));
        } else if (signInButton) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'needsAuth',
            debug: 'Sign in required'
          }));
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'authCheck',
            debug: 'Auth status unknown',
            url: window.location.href
          }));
        }
      }, 2000);
      
      true;
    })();
  `;

  useImperativeHandle(ref, () => ({
    changeChannel,
    isReady: () => webViewRef.current !== null,
    getWebViewRef: () => webViewRef.current,
  }), [changeChannel]);

  // On web, Rogers/Xfinity/Shaw remote blocks iframes (X-Frame-Options)
  // We need to use a different approach - open in new window for auth,
  // but we can't control it via JavaScript due to CORS
  // So we'll show a message and let the user authenticate manually
  if (Platform.OS === 'web') {
    console.log('🌐 Web platform - remote site blocks iframes');
    // For web, we can't use WebView in iframe (blocked by X-Frame-Options)
    // We need to open in a new window, but we can't inject JS due to CORS
    // So authentication must be done manually, and channel changes won't work
    // from the web app
    return (
      <View style={[styles.container, style]}>
        <View style={styles.webFallback}>
          <View style={styles.webFallbackContent}>
            <Text style={styles.webFallbackTitle}>
              ⚠️ Web Remote Not Available in Browser
            </Text>
            <Text style={styles.webFallbackText}>
              The {remoteUrl || 'Rogers'} remote blocks being embedded in web pages for security reasons.
            </Text>
            <Text style={styles.webFallbackText}>
              For remote control functionality, please use the mobile app (iOS/Android) instead.
            </Text>
            <Text style={[styles.webFallbackText, {marginTop: 16, fontSize: 12, color: '#999'}]}>
              The web app can still monitor games and recommend channels, but cannot change channels automatically.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    
    // Filter out harmless iOS system errors that we can't control
    const errorDescription = nativeEvent.description || '';
    const errorDomain = nativeEvent.domain || '';
    
    // Ignore BrowserEngineKit and MediaAnalysisServices errors (iOS system logs)
    if (errorDescription.includes('BrowserEngineKit') || 
        errorDescription.includes('MediaAnalysisServices') ||
        errorDomain.includes('BrowserEngineKit') ||
        errorDomain.includes('MediaAnalysisServices')) {
      // These are harmless iOS system logs - ignore them
      return;
    }
    
    // Only log actual WebView errors
    console.error('❌ WebView error:', nativeEvent);
    console.error('Error code:', nativeEvent.code);
    console.error('Error description:', nativeEvent.description);
    console.error('Error domain:', nativeEvent.domain);
    
    // Post error message back to React Native
    if (webViewRef.current) {
      try {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'webViewError',
          error: nativeEvent.description || 'Unknown error',
          code: nativeEvent.code,
        }));
      } catch (e) {
        console.error('Could not post error message:', e);
      }
    }
  };

  const handleHttpError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ WebView HTTP error:', nativeEvent);
    console.error('Status code:', nativeEvent.statusCode);
    console.error('URL:', nativeEvent.url);
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ uri: remoteUrl || 'https://rogers.webremote.com/remote' }}
        style={styles.webview}
        onMessage={handleMessage}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleHttpError}
        onNavigationStateChange={handleNavigationStateChange}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsBackForwardNavigationGestures={Platform.OS !== 'web'}
        // Ensure WebView stays active even when hidden
        cacheEnabled={true}
        // Add these to ensure JavaScript execution works in production
        originWhitelist={['*']}
        mixedContentMode="always"
        // Ensure WebView doesn't get suspended
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  webFallbackContent: {
    maxWidth: 400,
    alignItems: 'center',
  },
  webFallbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  webFallbackText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  webFallbackButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  webFallbackButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RogersRemoteWebView;


