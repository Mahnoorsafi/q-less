import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
import * as ExpoLocation from 'expo-location';
import AppHeader from '../components/AppHeader';
import OsmMapView, { OsmMarker } from '../components/OsmMapView';
import { subscribeToBranches, Branch } from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

const BRANCH_EMOJIS: Record<string, string> = { gulberg: '🍀', f10: '🌿', dha: '🌱' };
const EXPECTED_IDS = ['gulberg', 'f10', 'dha'];

export default function MapScreen() {
  const navigation                  = useNavigation<any>();
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const osmMarkers = useMemo<OsmMarker[]>(() =>
    branches.map((b) => ({
      lat:   b.lat,
      lng:   b.lng,
      title: `${b.name} — ${b.isOpen ? `${b.queueLength} in queue` : 'Closed'}`,
      color: b.isOpen ? COLORS.primary : '#9E9E9E',
    })),
  [branches]);

  const nearestBranchId = useMemo(() => {
    if (!userCoords || branches.length === 0) return null;
    return branches
      .filter((b) => b.isOpen)
      .reduce<{ id: string; dist: number } | null>((best, b) => {
        const d = haversineKm(userCoords.latitude, userCoords.longitude, b.lat, b.lng);
        return !best || d < best.dist ? { id: b.id, dist: d } : best;
      }, null)?.id ?? null;
  }, [userCoords, branches]);

  useEffect(() => {
    const unsub = subscribeToBranches((data) => {
      setBranches(data.filter((b) => EXPECTED_IDS.includes(b.id)));
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      setUserCoords({ latitude: result.coords.latitude, longitude: result.coords.longitude });
    })();
  }, []);

  // ── Web fallback ──────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.outer}>
        <AppHeader title="Branch Map" showBack showProfile={false} />
        <View style={styles.webWrap}>
          <Text style={styles.webEmoji}>🗺️</Text>
          <Text style={styles.webTitle}>Maps on Mobile Only</Text>
          <Text style={styles.webSub}>
            The live branch map is available in the Android / iOS app.{'\n'}
            Tap a branch below to open it in Google Maps.
          </Text>
          <View style={styles.webCards}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />
            ) : branches.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.webCard, !b.isOpen && { opacity: 0.5 }]}
                onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`)}
              >
                <Text style={styles.webCardEmoji}>{BRANCH_EMOJIS[b.id] ?? '🍃'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.webCardName}>{b.name}</Text>
                  <Text style={styles.webCardMeta}>{b.address}</Text>
                </View>
                <Text style={[styles.webCardStatus, { color: b.isOpen ? COLORS.success : COLORS.error }]}>
                  {b.isOpen ? 'Open' : 'Closed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Native map ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.outer}>
      <AppHeader title="Branch Map" showBack showProfile={false} />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      ) : (
        <OsmMapView
          flex
          interactive
          lat={userCoords?.latitude ?? 33.6900}
          lng={userCoords?.longitude ?? 73.0550}
          zoom={userCoords ? 13 : 12}
          markers={osmMarkers}
          userLat={userCoords?.latitude}
          userLng={userCoords?.longitude}
        />
      )}

      {!loading && (
        <View style={styles.bottomBar}>
          {branches.map((b) => {
            const isNearest = nearestBranchId === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.chip, !b.isOpen && styles.chipClosed, isNearest && styles.chipNearest]}
                onPress={() => { if (b.isOpen) navigation.navigate('BranchDetail', { branch: b }); }}
                activeOpacity={0.8}
              >
                <Text style={styles.chipEmoji}>{BRANCH_EMOJIS[b.id] ?? '🍃'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chipName, isNearest && styles.chipNameNearest]} numberOfLines={1}>
                    {b.name.split(' ').slice(-1)[0]}
                  </Text>
                  <Text style={styles.chipMeta}>{b.isOpen ? `${Math.max(0, b.queueLength)} waiting` : 'Closed'}</Text>
                </View>
                {isNearest && <Text style={styles.nearestBadge}>📍 Nearest</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer:       { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textSecondary, fontSize: FONT.md },

  bottomBar:  { flexDirection: 'row', backgroundColor: COLORS.surface, padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  chip:            { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.md, padding: 10 },
  chipClosed:      { backgroundColor: COLORS.separator, opacity: 0.65 },
  chipNearest:     { backgroundColor: COLORS.primary },
  chipEmoji:       { fontSize: 20 },
  chipName:        { fontSize: FONT.sm, fontWeight: '700', color: COLORS.textPrimary },
  chipNameNearest: { color: '#FFFFFF' },
  chipMeta:        { fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 1 },
  nearestBadge:    { fontSize: 9, fontWeight: '800', color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },

  // Web fallback styles
  webWrap:       { flex: 1, alignItems: 'center', padding: 24, paddingTop: 40 },
  webEmoji:      { fontSize: 64, marginBottom: 16 },
  webTitle:      { fontSize: FONT.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  webSub:        { fontSize: FONT.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  webCards:      { width: '100%', gap: 10 },
  webCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, gap: 12, ...SHADOW.sm },
  webCardEmoji:  { fontSize: 28 },
  webCardName:   { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary },
  webCardMeta:   { fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 2 },
  webCardStatus: { fontSize: FONT.xs, fontWeight: '700' },
});