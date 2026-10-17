import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Input } from './ui';
import { ScanIcon } from './Icons';
import { C } from '../theme';

// Camera scanner for the QR code / barcode on the inverter and WiFi dongle labels (SolaX "scan to add").
// Phone version of the web app's src/components/Scanner.jsx, using expo-camera's built-in barcode scanner.
const BARCODE_TYPES = ['qr', 'code128', 'code39', 'datamatrix', 'ean13'];
const FRAME = 260;

// Labels sometimes encode more than the number (e.g. "SN:H34…;PN:…"). Prefer a token of the expected length.
export function pickCode(text, length) {
  const tokens = String(text).toUpperCase().split(/[^A-Z0-9]+/).filter((t) => t.length >= 6);
  return tokens.find((t) => t.length === length) || tokens.sort((a, b) => b.length - a.length)[0] || String(text).trim().toUpperCase();
}

export function Scanner({ title, onResult, onClose }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  const line = useRef(new Animated.Value(0)).current;

  // Ask once when the scanner opens (the system dialog shows the text from app.json).
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission?.granted, permission?.canAskAgain]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const native = Platform.OS !== 'web';
    const move = (toValue) => Animated.timing(line, { toValue, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: native });
    const loop = Animated.loop(Animated.sequence([move(1), move(0)]));
    loop.start();
    return () => loop.stop();
  }, [line]);

  function scanned({ data }) {
    if (done.current || !data) return;
    done.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onResult(data);
  }

  const granted = permission?.granted;
  const hint = !permission ? 'Opening the camera…'
    : granted ? 'Point the camera at the QR code or barcode on the label'
      : permission.canAskAgain ? 'Voltra needs the camera to scan the label. You can also type the number.'
        : 'Camera permission was denied. Allow the camera for Voltra in Settings, or type the number.';

  return (
    <View style={sc.wrap}>
      {granted && (
        <CameraView style={StyleSheet.absoluteFill} facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }} onBarcodeScanned={scanned} />
      )}
      {/* Dimmed surround with a clear teal frame in the middle */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={sc.dim} />
        <View style={{ flexDirection: 'row', height: FRAME }}>
          <View style={sc.dim} />
          <View style={sc.frame}>
            <Animated.View style={[sc.line, { transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [FRAME * 0.08, FRAME * 0.92] }) }] }]} />
          </View>
          <View style={sc.dim} />
        </View>
        <View style={sc.dim} />
      </View>

      <View style={[sc.top, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={onClose} style={sc.close} hitSlop={8} accessibilityLabel="Close">
          <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
        </Pressable>
        <Text style={sc.title} numberOfLines={1}>{title}</Text>
      </View>

      <View style={[sc.bottom, { bottom: insets.bottom + 48 }]}>
        <Text style={sc.hint}>{hint}</Text>
        {permission && !granted && (
          <Pressable style={sc.allow} onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}>
            <Text style={sc.allowText}>{permission.canAskAgain ? 'Allow camera' : 'Open Settings'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Input with a scan button, for the inverter SN and dongle registration no.
export function ScanInput({ value, onChange, length, scanTitle, style, ...props }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Input value={value} onChangeText={(v) => onChange(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false}
        {...props} style={[style, { paddingRight: 52 }]} />
      <Pressable style={sc.btn} onPress={() => setOpen(true)} hitSlop={6} accessibilityLabel={`Scan ${scanTitle}`}>
        <ScanIcon size={22} color={C.accentDark} />
      </Pressable>
      <Modal visible={open} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
        {open && (
          <Scanner title={`Scan ${scanTitle}`} onClose={() => setOpen(false)}
            onResult={(text) => { onChange(pickCode(text, length)); setOpen(false); }} />
        )}
      </Modal>
    </View>
  );
}

const sc = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  frame: { width: FRAME, height: FRAME, borderRadius: 18, borderWidth: 2, borderColor: C.accent, overflow: 'hidden' },
  line: { position: 'absolute', top: 0, left: '6%', right: '6%', height: 2, backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  bottom: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 14 },
  hint: { color: '#fff', fontSize: 15, textAlign: 'center' },
  allow: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18 },
  allowText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btn: { position: 'absolute', right: 5, top: 0, bottom: 0, width: 40, marginVertical: 5, borderRadius: 10, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
