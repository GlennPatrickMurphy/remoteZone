import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const RogersRemoteWebView = forwardRef(({ onAuthenticated, style, remoteUrl }, ref) => {
  const webViewRef = useRef(null);
  const changingChannelRef = useRef(false);

  const changeChannel = (channelNumber) => {
    if (!webViewRef.current) return;
    
    // Prevent multiple simultaneous channel changes
    if (changingChannelRef.current) {
      console.log('Channel change already in progress, ignoring...');
      return;
    }

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
          const button = document.querySelector('[data-vcode="' + vcode + '"]');
          if (button) {
            button.click();
            return true;
          }
          return false;
        }
        
        // Press each digit - store timeout IDs to clear if needed
        const digits = "${channelStr}".split("");
        
        digits.forEach((digit, index) => {
          const timeoutId = setTimeout(() => {
            clickButton("NUMBER_" + digit);
          }, index * 400);
          window._channelChangeTimeouts.push(timeoutId);
        });
        
        // Press ENTER after all digits
        const enterTimeoutId = setTimeout(() => {
          clickButton("ENTER");
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'channelChanged', channel: ${channelNumber}}));
          // Clear timeouts after done
          window._channelChangeTimeouts = [];
        }, digits.length * 400 + 300);
        window._channelChangeTimeouts.push(enterTimeoutId);
        
        return true;
      })();
      true;
    `;
    
    webViewRef.current.injectJavaScript(script);
    
    // Reset the flag after channel change completes
    const totalTime = channelStr.length * 400 + 300 + 500;
    setTimeout(() => {
      changingChannelRef.current = false;
    }, totalTime);
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'authenticated') {
        onAuthenticated && onAuthenticated(true);
        // WebView is now loaded and ready
        console.log('WebView loaded and authenticated');
      } else if (data.type === 'channelChanged') {
        console.log('Channel changed to:', data.channel);
        // Reset the flag when channel change completes
        changingChannelRef.current = false;
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  };

  // Also track when WebView is loaded
  const handleLoadEnd = () => {
    console.log('WebView load ended - checking for authentication...');
    // Re-check authentication after load
    setTimeout(() => {
      const checkAuth = `
        (function() {
          const numberButton = document.querySelector('[data-vcode="NUMBER_1"]');
          if (numberButton) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'authenticated'}));
          }
          true;
        })();
      `;
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(checkAuth);
      }
    }, 1000);
  };

  const injectedJavaScript = `
    (function() {
      // Check if authenticated by looking for remote buttons
      setTimeout(() => {
        const numberButton = document.querySelector('[data-vcode="NUMBER_1"]');
        if (numberButton) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'authenticated'}));
        }
      }, 2000);
      
      true;
    })();
  `;

  useImperativeHandle(ref, () => ({
    changeChannel,
    isReady: () => webViewRef.current !== null,
  }), []);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ uri: remoteUrl || 'https://rogers.webremote.com/remote' }}
        style={styles.webview}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
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
});

export default RogersRemoteWebView;


