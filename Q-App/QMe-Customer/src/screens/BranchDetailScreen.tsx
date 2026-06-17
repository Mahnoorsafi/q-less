import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Linking, ActivityIndicator, Alert, Platform, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import OsmMapView from '../components/OsmMapView';
import { useAuth } from '../context/AuthContext';
import { subscribeToBranch, subscribeToServices, generateToken, Branch, Service } from '../services/firebaseService';
import { getWaitTime, estimateWaitFallback } from '../services/aiService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

// Static display config keyed by serviceId — merged with live Firestore data
const SVC_DISPLAY: Record<string, { emoji: string; bg: string; timeMult: number }> = {
  dine_in:     { emoji: '🍽️', bg: '#E8F5E9', timeMult: 1.0 },
  takeaway:    { emoji: '🛍️', bg: '#FFF3E0', timeMult: 0.6 },
  reservation: { emoji: '📋', bg: '#EDE9FE', timeMult: 0.4 },
};

function parseBranchClosingHour(hours: string | undefined): number {
  if (!hours) return 21;
  const m = hours.match(/[–\-]\s*(\d+):\d+\s*(AM|PM)/i);
  if (!m) return 21;
  let h = parseInt(m[1], 10);
  if (m[2].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[2].toUpperCase() === 'AM' && h === 12) h = 0;
  return h;
}

export default function BranchDetailScreen() {
  const navigation            = useNavigation<any>();
  const route                 = useRoute<any>();
  const { user }              = useAuth();
  const initialBranch: Branch = route.params?.branch;

  const [branch, setBranch]               = useState<Branch>(initialBranch);
  const [services, setServices]           = useState<Service[]>([]);
  const [estimatedWait, setEstimatedWait] = useState<number>(0);
  const [waitRange, setWaitRange]         = useState<string>('…');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [tokenError, setTokenError]       = useState<string | null>(null);
  // Waitlist confirmation modal (shown when dine-in is busy)
  const [waitlistSvc, setWaitlistSvc]     = useState<Service | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showError(msg: string) {
    setTokenError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setTokenError(null), 5000);
    if (Platform.OS !== 'web') Alert.alert('Notice', msg);
  }

  useEffect(() => {
    const unsub = subscribeToBranch(branch.id, (b) => { if (b) setBranch(b); });
    return unsub;
  }, [branch.id]);

  useEffect(() => {
    if (!branch.id) return;
    const unsub = subscribeToServices(branch.id, setServices);
    return unsub;
  }, [branch.id]);

  useEffect(() => {
    getWaitTime(branch.id, branch.queueLength, branch.avgServiceTime, branch.staffCount)
      .then((r) => { setEstimatedWait(r.estimated_wait_minutes); setWaitRange(r.wait_range); })
      .catch(() => {
        const fb = estimateWaitFallback(branch.queueLength, branch.avgServiceTime);
        setEstimatedWait(fb.estimated_wait_minutes);
        setWaitRange(fb.wait_range);
      });
  }, [branch.queueLength, branch.avgServiceTime, branch.staffCount, branch.id]);

  function openMaps() {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${branch.lat},${branch.lng}`).catch(() => {});
  }

  // Estimate minutes until a table frees up based on occupancy + avg turnover
  function estimateTableWait(): number {
    const capacity  = branch.tableCapacity ?? 20;
    const occupied  = branch.currentOccupancy ?? capacity;
    const turnover  = branch.avgServiceTime ?? 40; // avg mins per table
    const overflowPct = Math.min(1, Math.max(0, (occupied - capacity + 1) / capacity));
    return Math.max(10, Math.round(turnover * overflowPct));
  }

  async function doGenerateToken(svc: Service) {
    if (!user) { showError('Please sign in to join the queue.'); return; }
    if (!branch.isOpen) { showError('This branch is currently closed and not accepting tokens.'); return; }

    const closingHour = parseBranchClosingHour(branch.hours);
    const now = new Date();
    if (now.getHours() >= closingHour) {
      showError('This branch is closed for the day. Please pre-schedule for another day.');
      return;
    }
    const closingTime = new Date(now);
    closingTime.setHours(closingHour, 0, 0, 0);
    const timeMult    = SVC_DISPLAY[svc.id]?.timeMult ?? 1.0;
    const adjustedWait = Math.round((estimatedWait || branch.avgServiceTime) * timeMult);
    if (new Date(now.getTime() + adjustedWait * 60 * 1000) > closingTime) {
      showError('The queue may extend past closing time. Please try a pre-scheduled visit instead.');
      return;
    }

    setGeneratingFor(svc.id);
    try {
      const newToken = await generateToken({
        userId:               user.uid,
        userName:             user.name,
        branchId:             branch.id,
        branchName:           branch.name,
        serviceId:            svc.id,
        serviceName:          svc.name,
        serviceType:          svc.name,
        estimatedWaitMinutes: adjustedWait,
        orderItems:           [],
        orderTotal:           0,
      });
      navigation.navigate('TokenStatus', { tokenId: newToken.id, token: newToken });
    } catch (err: any) {
      showError(err?.message ?? 'Could not generate token — check your connection and try again.');
    } finally {
      setGeneratingFor(null);
    }
  }

  function handleServicePress(svc: Service) {
    setTokenError(null);
    if (!branch.isOpen) { showError('This branch is currently closed.'); return; }

    if (svc.id === 'takeaway') {
      // Takeaway always goes to menu first — token generated there
      navigation.navigate('Menu', { branch, serviceType: svc.name, serviceId: svc.id });
      return;
    }

    if (svc.id === 'reservation') {
      if (branch.reservationsOpen === false) {
        showError('Reservations are currently closed at this branch. Please visit for dine-in or call to enquire.');
        return;
      }
      doGenerateToken(svc);
      return;
    }

    if (svc.id === 'dine_in') {
      if (branch.isBusy) {
        // Show waitlist confirmation modal
        setWaitlistSvc(svc);
        return;
      }
      doGenerateToken(svc);
    }
  }

  const tableWaitMin = estimateTableWait();
  const occupancy    = branch.currentOccupancy ?? 0;
  const capacity     = branch.tableCapacity ?? 0;

  return (
    <View style={styles.outer}>
      <AppHeader subtitle={branch.name} showBack showProfile={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Error banner */}
        {tokenError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️  {tokenError}</Text>
          </View>
        )}

        {/* Branch hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emojiText}>{branch.emoji ?? '🍃'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.branchName}>{branch.name}</Text>
              <Text style={styles.branchAddress}>📍 {branch.address}</Text>
              {branch.phone && <Text style={styles.branchMeta}>📞 {branch.phone}</Text>}
              {branch.hours && <Text style={styles.branchMeta}>⏰ {branch.hours}</Text>}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: branch.isOpen ? COLORS.successBg : COLORS.errorBg }]}>
              <Text style={[styles.statusText, { color: branch.isOpen ? COLORS.success : COLORS.error }]}>
                {branch.isOpen ? '● Open' : '● Closed'}
              </Text>
            </View>
          </View>

          {/* Capacity banner — shown when branch is busy */}
          {branch.isBusy && branch.isOpen && (
            <View style={styles.busyBanner}>
              <Text style={styles.busyBannerText}>
                🪑 Restaurant is currently full
                {capacity > 0 ? ` (${occupancy}/${capacity} seats)` : ''}.{' '}
                Estimated wait for a table: ~{tableWaitMin} min.
              </Text>
            </View>
          )}

          {/* Reservations closed banner */}
          {branch.reservationsOpen === false && branch.isOpen && (
            <View style={[styles.busyBanner, styles.reservationClosedBanner]}>
              <Text style={styles.busyBannerText}>
                📋 Reservations are currently closed at this branch.
              </Text>
            </View>
          )}

          {/* Live stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{Math.max(0, branch.queueLength)}</Text>
              <Text style={styles.statLabel}>In Queue</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{branch.staffCount}</Text>
              <Text style={styles.statLabel}>Staff Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{waitRange}</Text>
              <Text style={styles.statLabel}>Est. Wait</Text>
            </View>
            {capacity > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: branch.isBusy ? COLORS.error : COLORS.primary }]}>
                    {occupancy}/{capacity}
                  </Text>
                  <Text style={styles.statLabel}>Seats</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapCard}>
          <OsmMapView
            lat={branch.lat}
            lng={branch.lng}
            zoom={15}
            markers={[{ lat: branch.lat, lng: branch.lng, title: branch.name }]}
            height={180}
          />
          <TouchableOpacity style={styles.dirBtn} onPress={openMaps} activeOpacity={0.85}>
            <Text style={styles.dirBtnText}>🗺️ Get Directions →</Text>
          </TouchableOpacity>
        </View>

        {/* Service cards */}
        <Text style={styles.sectionTitle}>Select Service & Get Token</Text>
        <Text style={styles.sectionSub}>
          Dine-in & reservations get you in the seating queue. Takeaway requires selecting your order first.
        </Text>

        {services.map((svc) => {
          const display   = SVC_DISPLAY[svc.id] ?? { emoji: '🔧', bg: '#F5F5F5', timeMult: 1.0 };
          const isLoading = generatingFor === svc.id;
          const adjWait   = Math.round(estimatedWait * display.timeMult);
          const isTakeaway    = svc.id === 'takeaway';
          const isDineIn      = svc.id === 'dine_in';
          const isReservation = svc.id === 'reservation';

          const adminClosed = !svc.isAvailable;
          const resClosed   = isReservation && branch.reservationsOpen === false;
          const dineInFull  = isDineIn && branch.isBusy && branch.isOpen;
          const disabled    = !branch.isOpen || adminClosed || resClosed;

          return (
            <View key={svc.id} style={[styles.serviceCard, disabled && styles.serviceCardDisabled]}>
              <View style={[styles.serviceIcon, { backgroundColor: display.bg }]}>
                <Text style={styles.serviceEmoji}>{display.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.serviceTitle, disabled && styles.mutedText]}>{svc.name}</Text>
                  {adminClosed && (
                    <View style={styles.closedBadge}><Text style={styles.closedBadgeText}>CLOSED</Text></View>
                  )}
                  {!adminClosed && dineInFull && (
                    <View style={styles.fullBadge}><Text style={styles.fullBadgeText}>FULL</Text></View>
                  )}
                  {!adminClosed && resClosed && (
                    <View style={styles.closedBadge}><Text style={styles.closedBadgeText}>CLOSED</Text></View>
                  )}
                </View>
                <Text style={[styles.serviceDesc, disabled && styles.mutedText]}>{svc.description}</Text>
                {adminClosed ? (
                  <Text style={[styles.serviceWait, { color: COLORS.error }]}>
                    🚫 {svc.closedReason ?? 'Currently unavailable'}
                    {svc.unavailableUntil ? ` · Reopens ${svc.unavailableUntil}` : ''}
                  </Text>
                ) : isTakeaway ? (
                  <Text style={styles.serviceWait}>🛍️ Choose menu → token + prep estimate generated</Text>
                ) : dineInFull ? (
                  <Text style={[styles.serviceWait, { color: '#d97706' }]}>⏱ ~{tableWaitMin} min for a table (waitlist)</Text>
                ) : (
                  <Text style={styles.serviceWait}>⏱ ~{adjWait} min wait</Text>
                )}
              </View>
              <View style={styles.serviceActions}>
                {adminClosed ? (
                  <View style={[styles.tokenBtn, styles.disabledBtn]}>
                    <Text style={styles.tokenBtnText}>Unavailable</Text>
                  </View>
                ) : isTakeaway ? (
                  <TouchableOpacity
                    style={[styles.tokenBtn, !branch.isOpen && styles.disabledBtn]}
                    onPress={() => handleServicePress(svc)}
                    disabled={!branch.isOpen}
                  >
                    <Text style={styles.tokenBtnText}>🎫 Get Token</Text>
                  </TouchableOpacity>
                ) : resClosed ? (
                  <View style={[styles.tokenBtn, styles.disabledBtn]}>
                    <Text style={styles.tokenBtnText}>Unavailable</Text>
                  </View>
                ) : dineInFull ? (
                  <>
                    <TouchableOpacity
                      style={[styles.tokenBtn, styles.waitlistBtn, (isLoading || !branch.isOpen) && styles.disabledBtn]}
                      onPress={() => handleServicePress(svc)}
                      disabled={isLoading || !!generatingFor || !branch.isOpen}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.tokenBtnText}>⏳ Join Waitlist</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.menuBtn}
                      onPress={() => navigation.navigate('Menu', { branch, serviceType: svc.name, serviceId: svc.id })}
                    >
                      <Text style={styles.menuBtnText}>Browse Menu</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.tokenBtn, (isLoading || !branch.isOpen) && styles.disabledBtn]}
                      onPress={() => handleServicePress(svc)}
                      disabled={isLoading || !!generatingFor || !branch.isOpen}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.tokenBtnText}>🎫 Get Token</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.menuBtn}
                      onPress={() => navigation.navigate('Menu', { branch, serviceType: svc.name, serviceId: svc.id })}
                      disabled={!!generatingFor}
                    >
                      <Text style={styles.menuBtnText}>Browse Menu</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {/* Pre-schedule */}
        <TouchableOpacity
          style={styles.preBookBtn}
          onPress={() => navigation.navigate('PreSchedule', { branch })}
        >
          <Text style={styles.preBookEmoji}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.preBookTitle}>Pre-Book a Visit</Text>
            <Text style={styles.preBookSub}>Choose your date & time slot (up to 7 days ahead)</Text>
          </View>
          <Text style={styles.preBookArrow}>›</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Waitlist confirmation modal */}
      <Modal visible={!!waitlistSvc} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🪑 Restaurant Is Full</Text>
            <Text style={styles.modalBody}>
              All tables are currently occupied
              {capacity > 0 ? ` (${occupancy}/${capacity})` : ''}.
              {'\n\n'}
              You can join the <Text style={{ fontWeight: '800' }}>waitlist</Text> and we'll call your token when a table becomes available.
              {'\n'}
              Estimated wait: <Text style={{ fontWeight: '800', color: COLORS.primary }}>~{tableWaitMin} min</Text>.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.tokenBtn, styles.modalJoinBtn, generatingFor === 'dine_in' && styles.disabledBtn]}
                disabled={!!generatingFor}
                onPress={() => { setWaitlistSvc(null); if (waitlistSvc) doGenerateToken(waitlistSvc); }}
              >
                {generatingFor === 'dine_in' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.tokenBtnText}>✓ Join Waitlist</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setWaitlistSvc(null)}>
                <Text style={styles.modalCancelText}>Not Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:           { flex: 1, backgroundColor: COLORS.background },
  content:         { padding: 16 },

  heroCard:        { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 18, marginBottom: 14, ...SHADOW.md },
  heroTop:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  emojiCircle:     { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  emojiText:       { fontSize: 26 },
  branchName:      { fontSize: FONT.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  branchAddress:   { fontSize: FONT.sm, color: COLORS.textSecondary, marginBottom: 2 },
  branchMeta:      { fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge:     { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:      { fontSize: FONT.xs, fontWeight: '700' },

  busyBanner:             { backgroundColor: '#FEF3C7', borderRadius: RADIUS.md, padding: 10, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  reservationClosedBanner:{ backgroundColor: COLORS.errorBg, borderLeftColor: COLORS.error },
  busyBannerText:         { fontSize: FONT.xs, fontWeight: '600', color: '#78350F' },

  statsRow:        { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },
  statItem:        { flex: 1, alignItems: 'center' },
  statNum:         { fontSize: FONT.lg, fontWeight: '800', color: COLORS.primary },
  statLabel:       { fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 2 },
  statDivider:     { width: 1, height: 32, backgroundColor: COLORS.border },

  mapCard:         { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 20, ...SHADOW.sm },
  dirBtn:          { padding: 12, alignItems: 'center', backgroundColor: COLORS.primaryBg },
  dirBtnText:      { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },

  sectionTitle:    { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  sectionSub:      { fontSize: FONT.sm, color: COLORS.textSecondary, marginBottom: 14 },

  serviceCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm, gap: 12 },
  serviceCardDisabled: { opacity: 0.6 },
  serviceIcon:         { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  serviceEmoji:        { fontSize: 22 },
  serviceTitle:        { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary },
  serviceDesc:         { fontSize: FONT.xs, color: COLORS.textSecondary, marginBottom: 4, marginTop: 2 },
  serviceWait:         { fontSize: FONT.xs, fontWeight: '700', color: COLORS.primary },
  mutedText:           { color: COLORS.textMuted },

  fullBadge:       { backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  fullBadgeText:   { fontSize: 9, fontWeight: '900', color: '#d97706', letterSpacing: 0.5 },
  closedBadge:     { backgroundColor: COLORS.errorBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  closedBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.error, letterSpacing: 0.5 },

  serviceActions:  { flexDirection: 'column', gap: 6, alignItems: 'stretch' },
  tokenBtn:        { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center' },
  tokenBtnText:    { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  waitlistBtn:     { backgroundColor: '#d97706' },
  menuBtn:         { backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.md, paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center' },
  menuBtnText:     { color: COLORS.primary, fontWeight: '700', fontSize: 11 },
  disabledBtn:     { opacity: 0.5 },

  errorBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.errorBg, borderRadius: RADIUS.md, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: COLORS.error },
  errorBannerText: { color: COLORS.error, fontWeight: '600', fontSize: FONT.sm, flex: 1 },

  preBookBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 18, marginTop: 6, ...SHADOW.md },
  preBookEmoji:    { fontSize: 24, marginRight: 14 },
  preBookTitle:    { fontSize: FONT.md, fontWeight: '700', color: '#FFFFFF' },
  preBookSub:      { fontSize: FONT.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  preBookArrow:    { marginLeft: 'auto', fontSize: 24, color: '#FFFFFF', fontWeight: '300' },

  // Waitlist modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:       { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 24, width: '100%', maxWidth: 360, ...SHADOW.lg },
  modalTitle:      { fontSize: FONT.lg, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 12 },
  modalBody:       { fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 20 },
  modalActions:    { flexDirection: 'column', gap: 10 },
  modalJoinBtn:    { paddingVertical: 14 },
  modalCancelBtn:  { paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.textMuted },
});
