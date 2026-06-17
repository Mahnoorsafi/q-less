import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Vibration, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToActiveToken, subscribeToWaitingQueue,
  subscribeToBranches, cancelToken,
  Branch, Token, QueueSlot,
} from '../services/firebaseService';
import { formatWaitTime } from '../utils/time';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MASCOT = require('../../assets/ghibli-mascot-transparent.webp');

const BRANCH_EMOJIS: Record<string, string> = { gulberg: '🍀', f10: '🌿', dha: '🌱' };
const EXPECTED_IDS = ['gulberg', 'f10', 'dha'];

export default function TokenHubScreen() {
  const navigation = useNavigation<any>();
  const { user }   = useAuth();

  const [token, setToken]       = useState<Token | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [queueSlots, setSlots]  = useState<QueueSlot[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const prevStatusRef           = useRef<string | null>(null);

  // Active token subscription
  useEffect(() => {
    if (!user) { setTokenLoading(false); return; }
    const unsub = subscribeToActiveToken(user.uid, (t) => {
      setToken(t);
      setTokenLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  // Branch list when no active token
  useEffect(() => {
    if (token) return;
    const unsub = subscribeToBranches((data) =>
      setBranches(data.filter((b) => EXPECTED_IDS.includes(b.id))),
    );
    return unsub;
  }, [!!token]);

  // Live queue strip when active token
  useEffect(() => {
    if (!token?.branchId || token.status === 'served' || token.status === 'cancelled') return;
    const unsub = subscribeToWaitingQueue(token.branchId, setSlots);
    return unsub;
  }, [token?.branchId, token?.status]);

  // Vibrate when called
  useEffect(() => {
    if (!token) return;
    if (prevStatusRef.current !== 'called' && token.status === 'called') {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    }
    prevStatusRef.current = token.status;
  }, [token?.status]);

  async function handleCancel() {
    if (!token) return;
    Alert.alert('Cancel Token?', 'This will remove you from the queue.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Token', style: 'destructive',
        onPress: async () => {
          await cancelToken(token.id, token.branchId);
        },
      },
    ]);
  }

  if (tokenLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // ── NO ACTIVE TOKEN: branch picker ──────────────────────────────────────────
  if (!token) {
    return (
      <View style={styles.outer}>
        <AppHeader title="Queue" showNotifications showProfile />
        <ScrollView contentContainerStyle={styles.emptyContent} showsVerticalScrollIndicator={false}>
          {/* Mascot + CTA */}
          <View style={styles.emptyHero}>
            <Image source={MASCOT} style={styles.heroMascot} resizeMode="contain" />
            <Text style={styles.emptyTitle}>Ready to join the queue?</Text>
            <Text style={styles.emptySub}>
              Pick a branch below to get your token and skip the wait.
            </Text>
          </View>

          {/* Branch cards */}
          {branches.length === 0 ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
          ) : (
            branches.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.branchCard, !b.isOpen && styles.closedCard]}
                onPress={() => { if (b.isOpen) navigation.navigate('BranchDetail', { branch: b }); }}
                activeOpacity={0.8}
              >
                <View style={styles.branchIconWrap}>
                  <Text style={styles.branchIcon}>{BRANCH_EMOJIS[b.id] ?? '🍃'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Text style={styles.branchName}>{b.name}</Text>
                    <View style={[styles.statusDot, { backgroundColor: b.isOpen ? COLORS.success : COLORS.error }]} />
                  </View>
                  <View style={styles.branchMeta}>
                    <Text style={styles.metaChip}>👥 {b.queueLength} waiting</Text>
                    <Text style={styles.metaChip}>⏱ ~{formatWaitTime(b.avgServiceTime * (b.queueLength || 1))}</Text>
                  </View>
                </View>
                {b.isOpen ? (
                  <View style={styles.getTokenBtn}>
                    <Text style={styles.getTokenText}>Get{'\n'}Token</Text>
                  </View>
                ) : (
                  <Text style={styles.closedLabel}>Closed</Text>
                )}
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    );
  }

  // ── ACTIVE TOKEN: live status ────────────────────────────────────────────────
  const isCalled      = token.status === 'called';
  const isServed      = token.status === 'served';
  const isCancelled   = token.status === 'cancelled';
  const isArrivingSoon = token.status === 'waiting' && (token.position <= 1 || token.estimatedWaitMinutes <= 1);

  const heroColor = isCalled ? COLORS.warning : isServed ? COLORS.success : COLORS.primary;

  return (
    <View style={styles.outer}>
      <AppHeader title="My Token" showNotifications showProfile />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Called banner */}
        {isCalled && (
          <View style={styles.calledBanner}>
            <Text style={styles.bannerEmoji}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.calledTitle}>It's Your Turn!</Text>
              <Text style={styles.calledSub}>Please proceed to the counter now</Text>
            </View>
          </View>
        )}

        {isArrivingSoon && !isCalled && (
          <View style={styles.soonBanner}>
            <Text style={styles.bannerEmoji}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.soonTitle}>Almost Your Turn!</Text>
              <Text style={styles.soonSub}>Make your way to the branch</Text>
            </View>
          </View>
        )}

        {/* Token hero card */}
        <View style={[styles.tokenCard, { backgroundColor: heroColor }]}>
          <View style={styles.tokenCardInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tokenLabel}>Your Token</Text>
              <Text style={styles.tokenCode}>{token.tokenCode}</Text>
              <Text style={styles.tokenBranch}>📍 {token.branchName}</Text>
              <Text style={styles.tokenService}>🍽️ {token.serviceType}</Text>
              {token.isPreScheduled && token.scheduledTime && (
                <View style={styles.scheduledPill}>
                  <Text style={styles.scheduledPillText}>📅 Pre-Scheduled</Text>
                </View>
              )}
            </View>
            <Image source={MASCOT} style={styles.cardMascot} resizeMode="contain" />
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{Math.max(0, token.position)}</Text>
            <Text style={styles.statLbl}>Position</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { fontSize: FONT.lg }]}>
              {formatWaitTime(token.estimatedWaitMinutes)}
            </Text>
            <Text style={styles.statLbl}>Est. Wait</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { fontSize: FONT.md }]}>
              {isCancelled ? '❌' : isServed ? '✅' : isCalled ? '🔔' : '⏳'}
            </Text>
            <Text style={styles.statLbl}>
              {token.status.charAt(0).toUpperCase() + token.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Live queue strip */}
        {!isCancelled && !isServed && queueSlots.length > 0 && (
          <View style={styles.queueCard}>
            <Text style={styles.queueTitle}>📋 Live Queue</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.queueRow}>
              {queueSlots.map((slot) => {
                const isMe  = slot.id === token.id;
                const isCur = slot.status === 'called';
                return (
                  <View key={slot.id} style={[styles.slot, isMe && styles.slotMe, isCur && styles.slotCalled]}>
                    <Text style={[styles.slotPos, isMe && { color: 'rgba(255,255,255,0.8)' }]}>
                      {isCur ? '🔔' : `#${slot.position}`}
                    </Text>
                    <Text style={[styles.slotCode, isMe && { color: '#FFFFFF' }]}>
                      {slot.tokenCode}
                    </Text>
                    {isMe && <Text style={styles.slotYou}>YOU</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Mascot encouragement */}
        {!isCancelled && !isServed && (
          <View style={styles.mascotRow}>
            <Text style={styles.mascotMsg}>
              {isCalled
                ? "It's your turn! Head to the counter 🎉"
                : isArrivingSoon
                ? "Almost there! Start making your way 🏃"
                : "Hang tight — we'll notify you soon 🍀"}
            </Text>
          </View>
        )}

        {/* Actions for waiting token */}
        {token.status === 'waiting' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.rescheduleBtn}
              onPress={() => navigation.navigate('Reschedule', { tokenId: token.id })}
            >
              <Text style={styles.rescheduleBtnText}>📅 Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Done state */}
        {(isServed || isCancelled) && (
          <>
            <View style={styles.doneCard}>
              <Image source={MASCOT} style={styles.doneMascot} resizeMode="contain" />
              <Text style={styles.doneTitle}>{isServed ? 'Thank you for visiting! 🎉' : 'Token Cancelled'}</Text>
              <Text style={styles.doneSub}>
                {isServed
                  ? 'We hope you enjoyed your experience at Olive!'
                  : 'Your token has been cancelled. Come back soon!'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => navigation.navigate('HomeTab')}
            >
              <Text style={styles.homeBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:   { flex: 1, backgroundColor: COLORS.background },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  content: { padding: 16 },

  // ── Empty / No Token ──────────────────────────────────────────────────────
  emptyContent:  { paddingHorizontal: 16, paddingBottom: 24 },
  emptyHero:     { alignItems: 'center', paddingVertical: 28 },
  heroMascot:    { width: 160, height: 160, marginBottom: 16 },
  emptyTitle:    { fontSize: FONT.xl, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptySub:      { fontSize: FONT.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },

  branchCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...SHADOW.sm },
  closedCard:    { opacity: 0.5 },
  branchIconWrap:{ width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  branchIcon:    { fontSize: 24 },
  branchName:    { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  branchMeta:    { flexDirection: 'row', gap: 8 },
  metaChip:      { fontSize: FONT.xs, color: COLORS.textSecondary, backgroundColor: COLORS.separator, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  getTokenBtn:   { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', marginLeft: 8 },
  getTokenText:  { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.xs, textAlign: 'center' },
  closedLabel:   { fontSize: FONT.xs, color: COLORS.textMuted, fontWeight: '600', marginLeft: 8 },

  // ── Active Token ──────────────────────────────────────────────────────────
  calledBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningBg, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: COLORS.warning, gap: 12 },
  soonBanner:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: COLORS.primary, gap: 12 },
  bannerEmoji:   { fontSize: 32 },
  calledTitle:   { fontSize: FONT.lg, fontWeight: '800', color: '#92400E' },
  calledSub:     { fontSize: FONT.sm, color: '#B45309', marginTop: 2 },
  soonTitle:     { fontSize: FONT.lg, fontWeight: '800', color: COLORS.primary },
  soonSub:       { fontSize: FONT.sm, color: COLORS.primaryDark, marginTop: 2 },

  tokenCard:     { borderRadius: RADIUS.xl, padding: 20, marginBottom: 14, ...SHADOW.md },
  tokenCardInner:{ flexDirection: 'row', alignItems: 'center' },
  tokenLabel:    { fontSize: FONT.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 4, fontWeight: '600' },
  tokenCode:     { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: 3, marginBottom: 8 },
  tokenBranch:   { fontSize: FONT.sm, color: 'rgba(255,255,255,0.9)', marginBottom: 3, fontWeight: '600' },
  tokenService:  { fontSize: FONT.sm, color: 'rgba(255,255,255,0.75)' },
  cardMascot:    { width: 90, height: 90, marginLeft: 8 },
  scheduledPill: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5 },
  scheduledPillText: { color: '#FFFFFF', fontSize: FONT.xs, fontWeight: '700' },

  statsRow:      { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:      { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', ...SHADOW.sm },
  statNum:       { fontSize: FONT.xxl, fontWeight: '900', color: COLORS.textPrimary },
  statLbl:       { fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 4 },

  queueCard:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, ...SHADOW.sm },
  queueTitle:    { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  queueRow:      { gap: 8, paddingBottom: 4 },
  slot:          { width: 72, borderRadius: 12, padding: 10, alignItems: 'center', backgroundColor: COLORS.separator, borderWidth: 1.5, borderColor: COLORS.border },
  slotMe:        { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotCalled:    { backgroundColor: COLORS.warningBg, borderColor: COLORS.warning },
  slotPos:       { fontSize: FONT.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 2 },
  slotCode:      { fontSize: 11, fontWeight: '900', color: COLORS.textPrimary },
  slotYou:       { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.9)', marginTop: 3, letterSpacing: 0.5 },

  mascotRow:     { alignItems: 'center', paddingVertical: 16 },
  mascotMsg:     { fontSize: FONT.md, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },

  actionsRow:    { flexDirection: 'row', gap: 12, marginBottom: 14 },
  rescheduleBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center' },
  rescheduleBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: FONT.md },
  cancelBtn:     { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.errorBg, alignItems: 'center' },
  cancelBtnText: { color: COLORS.error, fontWeight: '700', fontSize: FONT.md },

  doneCard:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 24, alignItems: 'center', marginBottom: 14, ...SHADOW.sm },
  doneMascot:    { width: 120, height: 120, marginBottom: 12 },
  doneTitle:     { fontSize: FONT.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6, textAlign: 'center' },
  doneSub:       { fontSize: FONT.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  homeBtn:       { paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', ...SHADOW.md },
  homeBtnText:   { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.lg },
});
