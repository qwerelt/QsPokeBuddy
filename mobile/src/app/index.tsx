import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { parsePkmPayload } from '../utils/pkmParser';
import { getStoredPokemon, saveStoredPokemon } from '../utils/storage';

export default function IndexScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkStorage = async () => {
      const existing = await getStoredPokemon();
      if (existing) {
        router.replace('/pet');
      }
    };
    checkStorage();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning) return;
    setIsScanning(false);
    try {
      const pokemon = parsePkmPayload(data);
      await saveStoredPokemon(pokemon);
      router.replace('/pet');
    } catch (e) {
      Alert.alert('Scan Error', 'Invalid QR code format. Please try again.');
      setIsScanning(true);
    }
  };

  const handleManualImport = async () => {
    if (!manualInput.trim()) return;
    try {
      const pokemon = parsePkmPayload(manualInput.trim());
      await saveStoredPokemon(pokemon);
      router.replace('/pet');
    } catch (e) {
      Alert.alert('Import Error', 'Failed to parse Pokémon payload.');
    }
  };

  const handleLoadDemo = async (speciesId: number, name: string) => {
    const mockPayload = `pkm:20:${speciesId}`;
    const pokemon = parsePkmPayload(mockPayload);
    pokemon.speciesId = speciesId;
    pokemon.speciesName = name;
    pokemon.nickname = name;
    await saveStoredPokemon(pokemon);
    router.replace('/pet');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Qs Poke Buddy</Text>
          <Text style={styles.subtitle}>Pokéwalker & Tamagotchi Companion</Text>
        </View>

        {/* Camera Scanner Section */}
        <View style={styles.scannerWrapper}>
          {permission?.granted ? (
            <View style={styles.cameraBox}>
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
              />
              <View style={styles.scanOverlay}>
                <View style={styles.reticle} />
                <Text style={styles.scanTip}>Point camera at WebApp QR Code</Text>
              </View>
            </View>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permText}>Camera permission needed to scan Pokémon QR codes</Text>
              <TouchableOpacity style={styles.retroBtn} onPress={requestPermission}>
                <Text style={styles.retroBtnText}>GRANT CAMERA PERMISSION</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Manual Payload Import */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>Or Paste QR Payload:</Text>
          <TextInput
            style={styles.input}
            placeholder="pkm:20:base64..."
            placeholderTextColor="#666"
            value={manualInput}
            onChangeText={setManualInput}
          />
          <TouchableOpacity style={styles.retroBtn} onPress={handleManualImport}>
            <Text style={styles.retroBtnText}>IMPORT PAYLOAD</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Demo Starters */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeader}>Demo Companion Quick-Start:</Text>
          <View style={styles.demoBtnRow}>
            <TouchableOpacity style={styles.demoBtn} onPress={() => handleLoadDemo(25, 'Pikachu')}>
              <Text style={styles.demoBtnText}>⚡ Pikachu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoBtn} onPress={() => handleLoadDemo(6, 'Charizard')}>
              <Text style={styles.demoBtnText}>🔥 Charizard</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.demoBtnRow}>
            <TouchableOpacity style={styles.demoBtn} onPress={() => handleLoadDemo(448, 'Lucario')}>
              <Text style={styles.demoBtnText}>🥊 Lucario</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoBtn} onPress={() => handleLoadDemo(94, 'Gengar')}>
              <Text style={styles.demoBtnText}>👻 Gengar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8bac0f', // Retro Game Boy Olive Green
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  header: {
    marginVertical: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#0f380f',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#306230',
    marginTop: 4,
  },
  scannerWrapper: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 280,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#0f380f',
    backgroundColor: '#9bbc0f',
    marginBottom: 16,
  },
  cameraBox: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  reticle: {
    width: 140,
    height: 140,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 8,
  },
  scanTip: {
    color: '#fff',
    marginTop: 10,
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permText: {
    color: '#0f380f',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionCard: {
    width: '100%',
    backgroundColor: '#9bbc0f',
    borderWidth: 3,
    borderColor: '#0f380f',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#0f380f',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#cadc9f',
    borderWidth: 2,
    borderColor: '#0f380f',
    borderRadius: 6,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#0f380f',
    marginBottom: 10,
  },
  retroBtn: {
    backgroundColor: '#0f380f',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  retroBtnText: {
    color: '#9bbc0f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 1,
  },
  demoBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  demoBtn: {
    flex: 1,
    backgroundColor: '#306230',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  demoBtnText: {
    color: '#cadc9f',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
