import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Vibration, Image,
  TextInput, Platform,
} from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MASCOT = require('../../assets/ghibli-mascot-transparent.webp');
import { formatWaitTime } from '../utils/time';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToActiveToken, subscribeToToken, cancelToken,
  subscribeToWaitingQueue, submitReview, Token, OrderItem, QueueSlot,
} from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

const STEPS = ['Booked', 'In Queue', 'Almost There', 'Your Turn'];

function getStepIndex(status: string): number {
  if (status === 'waiting') return 1;
  if (status === 'called')  return 3;
  if (status === 'served')  return 4;
  return 1;
}

function formatTime(ts: any): string {
  if (!ts) return '';
  try {
    return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function TokenStatusScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { user }   = useAuth();

  const tokenId: string | undefined = route.params?.tokenId;
  const passedToken: Token | undefined = route.params?.token;

  const [token, setToken]       = useState<Token | null>(passedToken ?? null);
  const [loading, setLoading]   = useState(!passedToken);
  const [queueSlots, setSlots]  = useState<QueueSlot[]>([]);
  const [rating, setRating]             = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted]   = useState(false);

  useEffect(() => {
    let unsub: () => void;
    if (tokenId) {
      unsub = subscribeToToken(tokenId, (t) => { setToken(t); setLoading(false); });
    } else if (user) {
      unsub = subscribeToActiveToken(user.uid, (t) => { setToken(t); setLoading(false); });
    } else {
      setLoading(false);
      return;
    }
    return () => unsub?.();
  }, [tokenId, user]);

  // Vibrate when token is called
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!token) return;
    if (prevStatusRef.current !== 'called' && token.status === 'called') {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    }
    prevStatusRef.current = token.status;
  }, [token?.status]);

  // Auto-navigate home 3 seconds after token is served
  useEffect(() => {
    if (token?.status !== 'served') return;
    const t = setTimeout(() => navigation.navigate('MainTabs'), 3000);
    return () => clearTimeout(t);
  }, [token?.status]);

  // Subscribe to branch queue for visual position strip
  useEffect(() => {
    if (!token?.branchId || token.status === 'served' || token.status === 'cancelled') return;
    const unsub = subscribeToWaitingQueue(token.branchId, setSlots);
    return unsub;
  }, [token?.branchId, token?.status]);

  async function handleCancel() {
    if (!token) return;
    const doCancel = async () => {
      await cancelToken(token.id, token.branchId);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Cancel token? This will remove you from the queue.')) doCancel();
      return;
    }
    Alert.alert('Cancel Token?', 'This will remove you from the queue.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Token', style: 'destructive', onPress: doCancel },
    ]);
  }

  async function handleSubmitReview() {
    if (!token || !user || rating === 0) return;
    setReviewSubmitting(true);
    try {
      await submitReview(token.id, token.branchId, user.uid, rating, feedbackText);
      setReviewSubmitted(true);
    } catch {}
    finally { setReviewSubmitting(false); }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.center}>
        <Image source={MASCOT} style={styles.emptyMascot} resizeMode="contain" />
        <Text style={styles.emptyTitle}>No Active Token</Text>
        <Text style={styles.emptySub}>You don't have an active queue token.</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('MainTabs')}
        >
          <Text style={styles.primaryBtnText}>Find a Branch</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stepIndex   = getStepIndex(token.status);
  const isCalled    = token.status === 'called';
  const isServed    = token.status === 'served';
  const isCancelled = token.status === 'cancelled';
  const isArrivingSoon = token.status === 'waiting' &&
    (token.position <= 1 || token.estimatedWaitMinutes <= 1);

  return (
    <View style={styles.outer}>
      <AppHeader subtitle="Queue Status" showBack showProfile />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Arriving Soon banner */}
        {isArrivingSoon && (
          <View style={styles.arrivingSoonBanner}>
            <Text style={styles.alertEmoji}>⚡</Text>
            <View>
              <Text style={styles.arrivingSoonTitle}>Arriving Soon!</Text>
              <Text style={styles.arrivingSoonSub}>You're next — please make your way to the branch</Text>
            </View>
          </View>
        )}

        {/* Alert banner for called token */}
        {isCalled && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertEmoji}>🎉</Text>
            <View>
              <Text style={styles.alertTitle}>It's Your Turn!</Text>
              <Text style={styles.alertSub}>Please proceed to the counter now</Text>
            </View>
          </View>
        )}

        {/* Token hero card */}
        <View style={[styles.heroCard, isCalled && styles.heroCardCalled, isServed && styles.heroCardServed]}>
          <Text style={styles.heroLabel}>Your Token Number</Text>
          <Text style={styles.tokenCode}>{token.tokenCode}</Text>
          <View style={styles.tokenMeta}>
            <Text style={styles.tokenMetaItem}>🍽️ {token.serviceType}</Text>
            <Text style={styles.tokenMetaDot}>·</Text>
            <Text style={styles.tokenMetaItem}>📍 {token.branchName}</Text>
          </View>
          {token.isPreScheduled && token.scheduledTime && (
            <View style={styles.scheduledBadge}>
              <Text style={styles.scheduledText}>
                📅 Scheduled for {formatTime(token.scheduledTime)}
              </Text>
            </View>
          )}
        </View>

        {/* Live stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{Math.max(0, token.position)}</Text>
            <Text style={styles.statLabel}>Position</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { fontSize: FONT.lg }]}>{formatWaitTime(token.estimatedWaitMinutes)}</Text>
            <Text style={styles.statLabel}>Est. Wait</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { fontSize: FONT.md }]}>
              {isCancelled ? '❌' : isServed ? '✅' : isCalled ? '🔔' : '⏳'}
            </Text>
            <Text style={styles.statLabel}>{token.status.charAt(0).toUpperCase() + token.status.slice(1)}</Text>
          </View>
        </View>

        {/* Visual queue strip — shows surrounding positions */}
        {!isCancelled && !isServed && queueSlots.length > 0 && (
          <View style={styles.queueStripCard}>
            <Text style={styles.queueStripTitle}>📋 Live Queue</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.queueStripRow}>
              {queueSlots.map((slot) => {
                const isMe = slot.id === token.id;
                const isCur = slot.status === 'called';
                return (
                  <View key={slot.id} style={[
                    styles.queueSlot,
                    isMe && styles.queueSlotMe,
                    isCur && styles.queueSlotCalled,
                  ]}>
                    <Text style={[styles.queueSlotPos, isMe && styles.queueSlotPosMe]}>
                      {isCur ? '🔔' : `#${slot.position}`}
                    </Text>
                    <Text style={[styles.queueSlotCode, isMe && styles.queueSlotCodeMe]}>
                      {slot.tokenCode}
                    </Text>
                    {isMe && <Text style={styles.queueSlotYou}>YOU</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Progress steps */}
        {!isCancelled && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Live Status</Text>
            <View style={styles.stepsRow}>
              {STEPS.map((step, idx) => {
                const done   = idx < stepIndex;
                const active = idx === stepIndex - 1 || (isServed && idx === STEPS.length - 1);
                return (
                  <View key={step} style={styles.stepWrap}>
                    <View style={[
                      styles.stepCircle,
                      done   && styles.stepDone,
                      active && styles.stepActive,
                    ]}>
                      <Text style={[styles.stepCircleText, (done || active) && styles.stepCircleTextActive]}>
                        {done || active ? '✓' : String(idx + 1)}
                      </Text>
                    </View>
                    {idx < STEPS.length - 1 && (
                      <View style={[styles.stepLine, done && styles.stepLineDone]} />
                    )}
                    <Text style={[styles.stepLabel, (done || active) && styles.stepLabelActive]}>
                      {step}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Order items summary */}
        {token.orderItems && token.orderItems.length > 0 && (
          <View style={styles.orderCard}>
            <Text style={styles.orderTitle}>Your Order</Text>
            {token.orderItems.map((item: OrderItem) => (
              <View key={item.itemId} style={styles.orderItem}>
                <Text style={styles.orderItemName}>{item.qty}× {item.name}</Text>
                <Text style={styles.orderItemPrice}>Rs. {(item.price * item.qty).toLocaleString()}</Text>
              </View>
            ))}
            {token.orderTotal !== undefined && token.orderTotal > 0 && (
              <View style={styles.orderTotal}>
                <Text style={styles.orderTotalLabel}>Total</Text>
                <Text style={styles.orderTotalAmount}>Rs. {token.orderTotal.toLocaleString()}</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
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

        {(isServed || isCancelled) && (
          <>
            <View style={styles.doneCard}>
              <Text style={styles.doneEmoji}>{isServed ? '🎉' : '😔'}</Text>
              <Text style={styles.doneTitle}>{isServed ? 'Thank you for visiting!' : 'Token Cancelled'}</Text>
              <Text style={styles.doneSub}>
                {isServed ? 'We hope you enjoyed your experience at Olive!' : 'Your token has been cancelled.'}
              </Text>
            </View>

            {/* Review card — only for served tokens */}
            {isServed && !reviewSubmitted && (
              <View style={styles.reviewCard}>
                <Text style={styles.reviewTitle}>Rate Your Experience</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)}>
                      <Text style={[styles.star, rating >= star && styles.starActive]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Leave a comment (optional)…"
                  placeholderTextColor={COLORS.textMuted}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  multiline
                  numberOfLines={2}
                />
                <TouchableOpacity
                  style={[styles.reviewBtn, (rating === 0 || reviewSubmitting) && styles.disabledReviewBtn]}
                  onPress={handleSubmitReview}
                  disabled={rating === 0 || reviewSubmitting}
                >
                  {reviewSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.reviewBtnText}>Submit Review</Text>}
                </TouchableOpacity>
              </View>
            )}
            {isServed && reviewSubmitted && (
              <View style={[styles.reviewCard, { alignItems: 'center' }]}>
                <Text style={{ fontSize: 32 }}>🙏</Text>
                <Text style={styles.reviewTitle}>Thanks for your feedback!</Text>
              </View>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}>
              <Text style={styles.primaryBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:          { flex: 1, backgroundColor: COLORS.background },
  content:        { padding: 16 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: COLORS.background },
  emptyMascot:    { width: 140, height: 140, marginBottom: 16 },
  emptyTitle:     { fontSize: FONT.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:       { fontSize: FONT.md, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },

  arrivingSoonBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: COLORS.primary, gap: 12 },
  arrivingSoonTitle:  { fontSize: FONT.lg, fontWeight: '800', color: COLORS.primary },
  arrivingSoonSub:    { fontSize: FONT.sm, color: COLORS.primaryDark ?? COLORS.primary, marginTop: 2 },

  alertBanner:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningBg, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: COLORS.warning, gap: 12 },
  alertEmoji:     { fontSize: 32 },
  alertTitle:     { fontSize: FONT.lg, fontWeight: '800', color: '#92400E' },
  alertSub:       { fontSize: FONT.sm, color: '#B45309', marginTop: 2 },

  heroCard:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 24, alignItems: 'center', marginBottom: 14, ...SHADOW.md },
  heroCardCalled: { backgroundColor: COLORS.warning },
  heroCardServed: { backgroundColor: COLORS.success },
  heroLabel:      { fontSize: FONT.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 8, fontWeight: '600' },
  tokenCode:      { fontSize: 64, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4, marginBottom: 10 },
  tokenMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenMetaItem:  { fontSize: FONT.sm, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  tokenMetaDot:   { fontSize: FONT.lg, color: 'rgba(255,255,255,0.5)' },
  scheduledBadge: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6 },
  scheduledText:  { color: '#FFFFFF', fontSize: FONT.sm, fontWeight: '600' },

  statsRow:       { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:       { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', ...SHADOW.sm },
  statNum:        { fontSize: FONT.xxl, fontWeight: '900', color: COLORS.textPrimary },
  statLabel:      { fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 4 },

  progressCard:   { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 18, marginBottom: 14, ...SHADOW.sm },
  progressTitle:  { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  stepsRow:       { flexDirection: 'row', alignItems: 'flex-start' },
  stepWrap:       { flex: 1, alignItems: 'center', position: 'relative' },
  stepCircle:     { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.separator, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 6, zIndex: 1 },
  stepDone:       { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  stepActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepCircleText: { fontSize: FONT.xs, fontWeight: '700', color: COLORS.textMuted },
  stepCircleTextActive: { color: '#FFFFFF' },
  stepLine:       { position: 'absolute', top: 15, left: '50%', right: '-50%', height: 2, backgroundColor: COLORS.border, zIndex: 0 },
  stepLineDone:   { backgroundColor: COLORS.primary },
  stepLabel:      { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', fontWeight: '500' },
  stepLabelActive:{ color: COLORS.primary, fontWeight: '700' },

  queueStripCard:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, ...SHADOW.sm },
  queueStripTitle:    { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  queueStripRow:      { gap: 8, paddingBottom: 4 },
  queueSlot:          { width: 70, borderRadius: 12, padding: 10, alignItems: 'center', backgroundColor: COLORS.separator, borderWidth: 1.5, borderColor: COLORS.border },
  queueSlotMe:        { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  queueSlotCalled:    { backgroundColor: COLORS.warningBg, borderColor: COLORS.warning },
  queueSlotPos:       { fontSize: FONT.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 2 },
  queueSlotPosMe:     { color: 'rgba(255,255,255,0.8)' },
  queueSlotCode:      { fontSize: 11, fontWeight: '900', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] as any },
  queueSlotCodeMe:    { color: '#FFFFFF' },
  queueSlotYou:       { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.9)', marginTop: 3, letterSpacing: 0.5 },

  orderCard:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, ...SHADOW.sm },
  orderTitle:     { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  orderItem:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.separator },
  orderItemName:  { fontSize: FONT.sm, color: COLORS.textPrimary },
  orderItemPrice: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.textPrimary },
  orderTotal:     { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  orderTotalLabel:{ fontSize: FONT.md, fontWeight: '800', color: COLORS.textPrimary },
  orderTotalAmount:{ fontSize: FONT.md, fontWeight: '900', color: COLORS.primary },

  actionsRow:     { flexDirection: 'row', gap: 12, marginBottom: 14 },
  rescheduleBtn:  { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center' },
  rescheduleBtnText:{ color: COLORS.primary, fontWeight: '700', fontSize: FONT.md },
  cancelBtn:      { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.errorBg, alignItems: 'center' },
  cancelBtnText:  { color: COLORS.error, fontWeight: '700', fontSize: FONT.md },

  doneCard:       { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 24, alignItems: 'center', marginBottom: 14, ...SHADOW.sm },
  doneEmoji:      { fontSize: 56, marginBottom: 12 },
  doneTitle:      { fontSize: FONT.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  doneSub:        { fontSize: FONT.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  primaryBtn:     { paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', marginBottom: 10, ...SHADOW.md },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.lg },

  reviewCard:        { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 20, marginBottom: 14, ...SHADOW.sm },
  reviewTitle:       { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12, textAlign: 'center' },
  starsRow:          { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  star:              { fontSize: 36, color: COLORS.border },
  starActive:        { color: '#F5A623' },
  reviewInput:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: FONT.sm, color: COLORS.textPrimary, backgroundColor: COLORS.background, marginBottom: 12, minHeight: 56, textAlignVertical: 'top' },
  reviewBtn:         { paddingVertical: 14, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', ...SHADOW.sm },
  disabledReviewBtn: { opacity: 0.45 },
  reviewBtnText:     { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.md },
});