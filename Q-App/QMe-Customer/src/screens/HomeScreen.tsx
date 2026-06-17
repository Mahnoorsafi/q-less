import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, TextInput, Alert,
  Animated, Image, Platform,
} from 'react-native';
import * as ExpoLocation from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import { subscribeToBranches, Branch, seedMenuIfEmpty } from '../services/firebaseService';
import { forceSeedBranches } from '../services/reseed';
import { recommendBranch } from '../services/aiService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MASCOT = require('../../assets/mascot.png');

const EXPECTED_IDS = ['gulberg', 'f10', 'dha'];

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

const BRANCH_EMOJIS: Record<string, string> = {
  gulberg: '🍀',
  f10:     '🌿',
  dha:     '🌱',
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [branches, setBranches]       = useState<Branch[]>([]);
  const [recommended, setRecommended] = useState<Branch | null>(null);
  const [recWait, setRecWait]         = useState('');
  const [loading, setLoading]         = useState(true);
  const [dbError, setDbError]         = useState(false);
  const [search, setSearch]           = useState('');
  const [reseeding, setReseeding]     = useState(false);
  const [userCoords, setUserCoords]   = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationKnown, setLocationKnown] = useState(false);
  const isReseeding                   = useRef(false);

  // Mascot float animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  // GPS location — native + web
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocationKnown(true); },
          () => {},
        );
      }
      return;
    }
    (async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        setUserCoords({ latitude: result.coords.latitude, longitude: result.coords.longitude });
        setLocationKnown(true);
      } catch {}
    })();
  }, []);

  // Show an error state if Firestore never responds within 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) { setDbError(true); return false; }
        return prev;
      });
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  async function handleReseed() {
    Alert.alert(
      'Refresh Branch Data?',
      'This will reset branches to Islamabad/Rawalpindi locations with full menu data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refresh',
          onPress: async () => {
            setReseeding(true);
            try { await forceSeedBranches(); } catch {}
            setReseeding(false);
          },
        },
      ],
    );
  }

  // Fallback center if GPS unavailable
  const userLat = userCoords?.latitude  ?? 33.7215;
  const userLng = userCoords?.longitude ?? 73.0433;

  useEffect(() => {
    const unsub = subscribeToBranches(async (data) => {
      const hasCorrectData = data.some((b) => EXPECTED_IDS.includes(b.id));
      if (!hasCorrectData && !isReseeding.current) {
        isReseeding.current = true;
        try { await forceSeedBranches(); } catch {}
        isReseeding.current = false;
        return;
      }
      if (!hasCorrectData) return;

      const correctBranches = data.filter((b) => EXPECTED_IDS.includes(b.id));
      setBranches(correctBranches);
      setLoading(false);

      correctBranches.forEach((b) => seedMenuIfEmpty(b.id).catch(() => {}));

      // Only recommend branches that are currently open
      const openBranches = correctBranches.filter((b) => b.isOpen);
      if (openBranches.length > 0) {
        // Get live GPS coords at recommendation time (state may have updated since mount)
        setUserCoords((coords) => {
          const lat = coords?.latitude  ?? 33.7215;
          const lng = coords?.longitude ?? 73.0433;

          recommendBranch(
            openBranches.map((b) => ({
              id: b.id, name: b.name,
              queue_length:     b.queueLength,
              avg_service_time: b.avgServiceTime,
              staff_count:      b.staffCount,
              lat: b.lat, lng: b.lng,
            })),
            lat,
            lng,
          ).then((res) => {
            if (res.best) {
              const best = openBranches.find((b) => b.id === res.best?.branch_id) ?? openBranches[0];
              setRecommended(best);
              setRecWait(res.best.wait_range ?? `${best.queueLength * 2}–${best.queueLength * 3} min`);
            }
          }).catch(() => {
            // Fallback: score = 0.6 × normalised queue + 0.4 × normalised distance
            const lat2 = coords?.latitude  ?? 33.7215;
            const lng2 = coords?.longitude ?? 73.0433;
            const scored = openBranches.map((b) => ({
              branch: b,
              dist: haversineKm(lat2, lng2, b.lat, b.lng),
            }));
            const maxDist  = Math.max(...scored.map((s) => s.dist),  1);
            const maxQueue = Math.max(...openBranches.map((b) => b.queueLength), 1);
            const best = scored
              .map((s) => ({
                branch: s.branch,
                score: 0.6 * (s.branch.queueLength / maxQueue) + 0.4 * (s.dist / maxDist),
              }))
              .sort((a, b) => a.score - b.score)[0].branch;
            setRecommended(best);
            const w = Math.max(2, best.queueLength * 2);
            setRecWait(`${w}–${w + 5} min`);
          });

          return coords; // don't change state, just read it
        });
      }
    });

    return unsub;
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const filtered = search.trim()
    ? branches.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.address.toLowerCase().includes(search.toLowerCase()),
      )
    : branches;

  const withDistance = filtered
    .map((b) => ({
      ...b,
      distanceKm: haversineKm(userLat, userLng, b.lat, b.lng),
    }))
    .sort((a, b) => {
      // Open branches always before closed ones; ties broken by distance
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });

  // Smart alternative: if nearest open branch is busy (>5 in queue) and another is shorter
  const nearestOpen = withDistance.find((b) => b.isOpen);
  const busyAlternative =
    nearestOpen && nearestOpen.queueLength > 5
      ? withDistance.find((b) => b.isOpen && b.id !== nearestOpen.id && b.queueLength < nearestOpen.queueLength)
      : null;

  const floatStyle = {
    transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }],
  };

  if (dbError) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={{ fontSize: 44, marginBottom: 14 }}>⚠️</Text>
        <Text style={[styles.loadingText, { fontWeight: '700', color: COLORS.textPrimary, fontSize: FONT.lg }]}>
          Could not load branches
        </Text>
        <Text style={{ fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 36 }}>
          Database is unreachable. Check your internet connection.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 24, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 28, paddingVertical: 13 }}
          onPress={() => { setDbError(false); setLoading(true); }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: FONT.md }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading branches…</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      {/* Green header — AppHeader already green, flows into hero */}
      <AppHeader showNotifications showProfile />

      {/* Green hero: greeting + floating mascot */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroHi}>Hi, {firstName}! 👋</Text>
          <Text style={styles.heroSub}>Where would you like to dine today?</Text>
        </View>
        <Animated.View style={floatStyle}>
          <Image source={MASCOT} style={styles.mascotImg} resizeMode="contain" />
        </Animated.View>
      </View>

      {/* Cream content — rounded top overlaps green hero */}
      <View style={styles.scrollWrap}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Search */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search branches…"
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* AI Recommendation card */}
          {recommended && (
            <View style={styles.recCard}>
              <View style={styles.recBadge}>
                <Text style={styles.recBadgeText}>⚡ Smart Recommendation</Text>
              </View>
              <View style={styles.recBody}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recName}>{recommended.name}</Text>
                  <Text style={styles.recAddress}>{recommended.address}</Text>
                  <View style={styles.recMetaRow}>
                    <View style={styles.recMetaChip}>
                      <Text style={styles.recMetaText}>⏱ {recWait}</Text>
                    </View>
                    <View style={[styles.recMetaChip, { backgroundColor: COLORS.primaryBg }]}>
                      <Text style={[styles.recMetaText, { color: COLORS.primary }]}>
                        ✅ Best Choice
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.recBtn}
                  onPress={() => navigation.navigate('BranchDetail', { branch: recommended })}
                >
                  <Text style={styles.recBtnText}>Get{'\n'}Token</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Smart alternative banner — nearest branch is busy */}
          {busyAlternative && (
            <TouchableOpacity
              style={styles.altCard}
              onPress={() => navigation.navigate('BranchDetail', { branch: busyAlternative })}
              activeOpacity={0.85}
            >
              <Text style={styles.altEmoji}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.altTitle}>Shorter wait nearby!</Text>
                <Text style={styles.altBody}>
                  {busyAlternative.name} has only {busyAlternative.queueLength} in queue vs {nearestOpen!.queueLength} at your nearest branch.
                </Text>
              </View>
              <Text style={styles.altArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* All Branches */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>All Branches</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.sectionCount}>{filtered.length} locations</Text>
              <TouchableOpacity
                style={styles.reseedBtn}
                onPress={handleReseed}
                disabled={reseeding}
              >
                <Text style={styles.reseedBtnText}>{reseeding ? '⏳' : '🔄'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {withDistance.length === 0 && (
            <View style={styles.noResultsWrap}>
              <Text style={styles.noResultsEmoji}>🔍</Text>
              <Text style={styles.noResultsText}>No branches match "{search}"</Text>
            </View>
          )}

          {withDistance.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.branchCard, !item.isOpen && styles.closedCard]}
              onPress={() => navigation.navigate('BranchDetail', { branch: item })}
              activeOpacity={0.8}
            >
              <View style={styles.branchIconWrap}>
                <Text style={styles.branchIcon}>{BRANCH_EMOJIS[item.id] ?? '🍃'}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.nameStatusRow}>
                  <Text style={styles.branchName}>{item.name}</Text>
                  <View style={[
                    styles.statusPill,
                    { backgroundColor: item.isOpen ? COLORS.successBg : COLORS.errorBg },
                  ]}>
                    <Text style={[
                      styles.statusPillText,
                      { color: item.isOpen ? COLORS.success : COLORS.error },
                    ]}>
                      {item.isOpen ? '● Open' : '● Closed'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.branchAddress}>{item.address}</Text>
                <View style={styles.branchMeta}>
                  {item.isOpen
                    ? <Text style={styles.metaChip}>👥 {Math.max(0, item.queueLength)} waiting</Text>
                    : <Text style={[styles.metaChip, styles.closedMetaChip]}>🗓️ Tap to Pre-Book</Text>
                  }
                  {item.isOpen && (
                    <Text style={styles.metaChip}>⏱ ~{item.avgServiceTime * item.queueLength || item.avgServiceTime} min</Text>
                  )}
                  <Text style={styles.metaChip}>📍 {locationKnown ? `${item.distanceKm.toFixed(1)} km` : 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.arrowWrap}>
                <Text style={styles.arrow}>›</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Quick Actions */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {/* Get Token — navigates to nearest open branch */}
            <TouchableOpacity
              style={[styles.quickCard, styles.quickCardPrimary]}
              onPress={() => {
                const target = recommended ?? nearestOpen;
                if (target) navigation.navigate('BranchDetail', { branch: target });
                else Alert.alert('No branches open', 'All branches are currently closed.');
              }}
            >
              <Text style={styles.quickEmoji}>🎫</Text>
              <Text style={[styles.quickLabel, { color: COLORS.primary, fontWeight: '800' }]}>Get Token</Text>
            </TouchableOpacity>

            {[
              { emoji: '🗓️', label: 'Pre-Book',   screen: 'PreBookTab' },
              { emoji: '🕐', label: 'My History',  screen: 'HistoryTab' },
              { emoji: '🔔', label: 'Alerts',      screen: 'Notifications' },
              { emoji: '🗺️', label: 'Branch Map',  screen: 'Map' },
            ].map((a) => (
              <TouchableOpacity
                key={a.label}
                style={styles.quickCard}
                onPress={() => navigation.navigate(a.screen)}
              >
                <Text style={styles.quickEmoji}>{a.emoji}</Text>
                <Text style={styles.quickLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:        { flex: 1, backgroundColor: COLORS.primary },
  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText:  { marginTop: 12, color: COLORS.textSecondary, fontSize: FONT.md },

  // Green hero section
  hero:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 36 },
  heroHi:       { fontSize: FONT.xl, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  heroSub:      { fontSize: FONT.sm, color: 'rgba(255,255,255,0.8)', flexShrink: 1 },
  mascotImg:    { width: 90, height: 90, flexShrink: 0 },

  // Cream content that overlaps the green hero
  scrollWrap:   { flex: 1, backgroundColor: COLORS.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, overflow: 'hidden' },
  content:      { paddingTop: 20, paddingBottom: 20 },

  searchBar:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, ...SHADOW.sm },
  searchIcon:   { fontSize: 16, marginRight: 8 },
  searchInput:  { flex: 1, fontSize: FONT.md, color: COLORS.textPrimary },

  recCard:      { marginHorizontal: 20, marginBottom: 20, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOW.md },
  recBadge:     { backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 14, paddingVertical: 6 },
  recBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: FONT.xs },
  recBody:      { flexDirection: 'row', alignItems: 'center', padding: 16 },
  recName:      { fontSize: FONT.lg, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  recAddress:   { fontSize: FONT.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 10 },
  recMetaRow:   { flexDirection: 'row', gap: 8 },
  recMetaChip:  { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  recMetaText:  { color: '#FFFFFF', fontSize: FONT.xs, fontWeight: '600' },
  recBtn:       { width: 64, height: 64, borderRadius: RADIUS.md, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginLeft: 12, ...SHADOW.sm },
  recBtnText:   { color: COLORS.primary, fontWeight: '800', fontSize: FONT.sm, textAlign: 'center' },

  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle:  { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary },
  sectionCount:  { fontSize: FONT.sm, color: COLORS.textSecondary },

  branchCard:    { marginHorizontal: 20, marginBottom: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, flexDirection: 'row', alignItems: 'center', ...SHADOW.sm },
  closedCard:    { opacity: 0.5 },
  branchIconWrap:{ width: 50, height: 50, borderRadius: 14, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  branchIcon:    { fontSize: 24 },
  nameStatusRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  statusPill:      { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText:  { fontSize: 10, fontWeight: '700' },
  closedMetaChip:  { backgroundColor: '#FEE2E2', color: COLORS.error },
  branchName:    { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  branchAddress: { fontSize: FONT.xs, color: COLORS.textSecondary, marginBottom: 8 },
  branchMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip:      { fontSize: FONT.xs, color: COLORS.textSecondary, backgroundColor: COLORS.separator, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  arrowWrap:     { marginLeft: 8 },
  arrow:         { fontSize: 22, color: COLORS.textMuted, fontWeight: '300' },

  quickGrid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginTop: 12 },
  quickCard:     { flex: 1, minWidth: '45%', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', ...SHADOW.sm },
  quickEmoji:    { fontSize: 28, marginBottom: 6 },
  quickLabel:    { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textPrimary },
  reseedBtn:     { width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.separator, alignItems: 'center', justifyContent: 'center' },
  reseedBtnText: { fontSize: 16 },

  altCard:       { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFFBEB', borderRadius: RADIUS.lg, padding: 14, borderWidth: 1.5, borderColor: '#F59E0B', gap: 12 },
  altEmoji:      { fontSize: 24 },
  altTitle:      { fontSize: FONT.sm, fontWeight: '800', color: '#92400E', marginBottom: 2 },
  altBody:       { fontSize: FONT.xs, color: '#B45309', lineHeight: 18 },
  altArrow:      { fontSize: 22, color: '#F59E0B', fontWeight: '300' },

  noResultsWrap: { alignItems: 'center', paddingVertical: 32 },
  noResultsEmoji:{ fontSize: 36, marginBottom: 10 },
  noResultsText: { fontSize: FONT.md, color: COLORS.textSecondary },

  quickCardPrimary: { borderWidth: 1.5, borderColor: COLORS.primaryBg, backgroundColor: COLORS.primaryBg },
});
