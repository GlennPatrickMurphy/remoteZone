import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addDoc } from 'firebase/firestore';
import { tvBoxRequestsRef } from '../config/firebase';

const TV_BOXES = {
  ROGERS: { name: 'Rogers', url: 'https://rogers.webremote.com/remote' },
  XFINITY: { name: 'Xfinity (Comcast)', url: 'https://remote.xfinity.com/remote' },
  SHAW: { name: 'Shaw', url: 'https://webremote.shaw.ca/remote' },
};

const TVBoxSelectionScreen = ({ navigation, user, onSelectTVBox, updateUserProfile }) => {
  const [selectedBox, setSelectedBox] = useState(null);
  const [requestingBox, setRequestingBox] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSelectBox = async (boxKey) => {
    setSelectedBox(boxKey);
    if (!updateUserProfile) {
      Alert.alert('Error', 'Update function not available');
      setSelectedBox(null);
      return;
    }
    
    const result = await updateUserProfile({ tvBox: boxKey });
    if (result.success) {
      // Call the callback to close the selection screen
      if (onSelectTVBox) {
        onSelectTVBox(boxKey);
      }
      // Don't show alert here - just close immediately
    } else {
      Alert.alert('Error', result.error || 'Failed to save TV box selection');
      setSelectedBox(null); // Reset selection on error
    }
  };

  const handleRequestBox = async () => {
    if (!requestingBox.trim()) {
      Alert.alert('Error', 'Please enter a TV box name');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(tvBoxRequestsRef, {
        userId: user.uid,
        tvBoxName: requestingBox.trim(),
        requestedAt: new Date().toISOString(),
        email: user.email,
      });
      Alert.alert('Request Submitted', 'Thank you! We\'ll consider adding this TV box in a future update.', [{ text: 'OK', onPress: () => setRequestingBox('') }]);
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.emoji}>📺</Text>
          <Text style={styles.title}>Select Your TV Provider</Text>
          <Text style={styles.subtitle}>Choose your TV service provider to get started</Text>
        </View>
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <View style={styles.warningText}>
            <Text style={styles.warningTitle}>Important Notice</Text>
            <Text style={styles.warningBody}>Only Rogers, Xfinity (Comcast), and Shaw TV boxes are currently supported.</Text>
            <Text style={styles.warningBody}>If your TV provider is not listed, you can request it to be added in a future update.</Text>
          </View>
        </View>
        <View style={styles.boxesContainer}>
          {Object.entries(TV_BOXES).map(([key, box]) => (
            <TouchableOpacity key={key} style={[styles.boxCard, selectedBox === key && styles.boxCardSelected]} onPress={() => handleSelectBox(key)}>
              <View style={styles.boxHeader}>
                <Ionicons name={selectedBox === key ? 'radio-button-on' : 'radio-button-off'} size={24} color={selectedBox === key ? '#667eea' : '#999'} />
                <Text style={[styles.boxName, selectedBox === key && styles.boxNameSelected]}>{box.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.requestSection}>
          <Text style={styles.requestTitle}>Don't see your TV provider?</Text>
          <Text style={styles.requestSubtitle}>Request a TV box to be added in a future update</Text>
          <View style={styles.requestInputContainer}>
            <TextInput style={styles.requestInput} placeholder="Enter TV box name (e.g., Spectrum, DirecTV)" value={requestingBox} onChangeText={setRequestingBox} />
            <TouchableOpacity style={[styles.requestButton, submitting && styles.requestButtonDisabled]} onPress={handleRequestBox} disabled={submitting}>
              {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.requestButtonText}>Submit Request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scrollView: { flex: 1 },
  content: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 30 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
  warningBox: { flexDirection: 'row', backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#f59e0b', borderRadius: 12, padding: 16, marginBottom: 30 },
  warningText: { flex: 1, marginLeft: 12 },
  warningTitle: { fontSize: 16, fontWeight: 'bold', color: '#92400e', marginBottom: 8 },
  warningBody: { fontSize: 14, color: '#78350f', lineHeight: 20, marginBottom: 4 },
  boxesContainer: { marginBottom: 30 },
  boxCard: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 12, borderWidth: 2, borderColor: '#e5e7eb' },
  boxCardSelected: { borderColor: '#667eea', backgroundColor: '#e0e7ff' },
  boxHeader: { flexDirection: 'row', alignItems: 'center' },
  boxName: { fontSize: 18, fontWeight: '600', color: '#333', marginLeft: 12 },
  boxNameSelected: { color: '#667eea' },
  requestSection: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginTop: 20 },
  requestTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  requestSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  requestInputContainer: { gap: 12 },
  requestInput: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f9fafb' },
  requestButton: { backgroundColor: '#667eea', borderRadius: 8, padding: 14, alignItems: 'center' },
  requestButtonDisabled: { opacity: 0.6 },
  requestButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

export default TVBoxSelectionScreen;
