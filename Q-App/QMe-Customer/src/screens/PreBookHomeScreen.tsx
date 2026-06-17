import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { subscribeToBranches, subscribeToActiveToken, Branch, Token } from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

const BRANCH_EMOJIS: Record<string, string> = {
  gulberg: '🍀',
  f10:     '🌿',
  dha:     '🌱',
};

function formatScheduledTime(ts: any): string {
  if (!ts) return '';
  try {
    return ts.toDate().toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function PreBookHomeScreen() {
  const navigation              = useNavigation<any>();
  const { user }                = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeToken, setActiveToken] = useState<Token | null>(null);

  useEffect(() => {
    const unsub = subscribeToBranches((data) => {
      setBranches(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToActiveToken(user.uid, setActiveToken);
    return unsub;
  }, [user?.uid]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const upcomingSchedule = activeToken?.isPreScheduled ? activeToken : null;
  const openBranches = branches.filter((b) => b.isOpen);

  return (
    <View style={styles.outer}>
      <AppHeader title="Pre-Book" showProfile />

      <FlatList<Branch>
        data={branches}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Hero */}
            <View style={styles.heroSection}>
              <Text style={styles.heroEmoji}>🗓️</Text>
              <Text style={styles.heroTitle}>Schedule Your Visit</Text>
              <Text style={styles.heroSub}>
                Skip the walk-in queue — pick your branch, date, and time slot.
              </Text>
              {openBranches.length > 0 && (
                <TouchableOpacity
                  style={styles.heroAddBtn}
                  onPress={() => {
                    // Auto-select first open branch if only one, else scroll to list
                    if (openBranches.length === 1) {
                      navigation.navigate('PreScheduleMain', {
                        branch: openBranches[0],
                        serviceType: 'Dine In',
                        serviceId: 'dine_in',
                      });
                    }
                    // If multiple, the list below is already visible — just draw attention
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.heroAddBtnText}>＋ New Pre-Schedule</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Upcoming schedule widget */}
            {upcomingSchedule && (
              <View style={styles.upcomingCard}>
                <View style={styles.upcomingHeader}>
                  <Text style={styles.upcomingLabel}>📅 Your Next Visit</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('TokenStatus', {
                      tokenId: upcomingSchedule.id,
                      token: upcomingSchedule,
                    })}
                  >
                    <Text style={styles.upcomingViewBtn}>View →</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.upcomingBranch}>{upcomingSchedule.branchName}</Text>
                <Text style={styles.upcomingTime}>
                  🕐 {formatScheduledTime(upcomingSchedule.scheduledTime)}
                </Text>
                <View style={styles.upcomingMeta}>
                  <Text style={styles.upcomingToken}>🎫 {upcomingSchedule.tokenCode}</Text>
                  <Text style={styles.upcomingService}>🍽️ {upcomingSchedule.serviceType}</Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              {upcomingSchedule ? 'Schedule Another Visit' : 'Select a Branch'}
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.branchCard}
            onPress={() =>
              navigation.navigate('PreScheduleMain', {
                branch: item,
                serviceType: 'Dine In',
                serviceId: 'dine_in',
              })
            }
            activeOpacity={0.8}
          >
            <View style={styles.branchIconWrap}>
              <Text style={styles.branchIcon}>{BRANCH_EMOJIS[item.id] ?? '🍃'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.branchName}>{item.name}</Text>
                <View style={[styles.statusDot, { backgroundColor: item.isOpen ? COLORS.success : COLORS.error }]} />
                {!item.isOpen && <Text style={styles.closedChip}>Closed now</Text>}
              </View>
              <Text style={styles.branchAddress}>📍 {item.address}</Text>
              <View style={styles.metaRow}>
                {item.isOpen && <Text style={styles.metaChip}>👥 {item.queueLength} in queue</Text>}
                <Text style={styles.metaChip}>⏰ {item.hours ?? '11AM–11PM'}</Text>
              </View>
            </View>
            <View style={[styles.scheduleBtn, !item.isOpen && styles.scheduleBtnMuted]}>
              <Text style={styles.scheduleBtnText}>Schedule</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer:          { flex: 1, backgroundColor: COLORS.background },
  loadingWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },

  heroSection:    { backgroundColor: COLORS.primary, padding: 24, paddingBottom: 32, alignItems: 'center' },
  heroEmoji:      { fontSize: 44, marginBottom: 10 },
  heroTitle:      { fontSize: FONT.xxl, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  heroSub:        { fontSize: FONT.sm, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, marginBottom: 18 },
  heroAddBtn:     { backgroundColor: '#FFFFFF', borderRadius: RADIUS.xl, paddingVertical: 12, paddingHorizontal: 28, ...SHADOW.sm },
  heroAddBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: FONT.md },

  upcomingCard:   { margin: 16, marginBottom: 8, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 18, ...SHADOW.md, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  upcomingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  upcomingLabel:  { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },
  upcomingViewBtn:{ fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },
  upcomingBranch: { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  upcomingTime:   { fontSize: FONT.md, color: COLORS.textSecondary, marginBottom: 10 },
  upcomingMeta:   { flexDirection: 'row', gap: 10 },
  upcomingToken:  { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.primaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
  upcomingService:{ fontSize: FONT.sm, color: COLORS.textSecondary, backgroundColor: COLORS.separator, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },

  sectionTitle:   { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },

  listContent:    { paddingHorizontal: 16, paddingBottom: 24 },
  branchCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...SHADOW.sm },
  closedCard:     { opacity: 0.5 },
  branchIconWrap: { width: 50, height: 50, borderRadius: 14, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  branchIcon:     { fontSize: 26 },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  branchName:     { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary },
  statusDot:      { width: 8, height: 8, borderRadius: 4 },
  branchAddress:  { fontSize: FONT.sm, color: COLORS.textSecondary, marginBottom: 6 },
  metaRow:        { flexDirection: 'row', gap: 8 },
  metaChip:       { fontSize: FONT.xs, color: COLORS.textSecondary, backgroundColor: COLORS.separator, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  scheduleBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 12, marginLeft: 8 },
  scheduleBtnMuted:{ backgroundColor: COLORS.textMuted },
  scheduleBtnText: { fontSize: FONT.xs, fontWeight: '800', color: '#FFFFFF' },
  closedChip:      { fontSize: 10, fontWeight: '700', color: COLORS.error, backgroundColor: COLORS.errorBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
});
