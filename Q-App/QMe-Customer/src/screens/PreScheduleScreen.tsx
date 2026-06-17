import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { generateToken, countPreScheduledForSlot, Branch, Service } from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

// Parse "11:00 AM – 11:00 PM" → { open: 11, close: 23 }
function parseBranchHours(hours: string | undefined): { open: number; close: number } {
  const DEFAULT = { open: 10, close: 21 };
  if (!hours) return DEFAULT;
  const m = hours.match(/(\d+):\d+\s*(AM|PM)\s*[–\-]\s*(\d+):\d+\s*(AM|PM)/i);
  if (!m) return DEFAULT;
  let openH = parseInt(m[1], 10);
  if (m[2].toUpperCase() === 'PM' && openH !== 12) openH += 12;
  if (m[2].toUpperCase() === 'AM' && openH === 12) openH = 0;
  let closeH = parseInt(m[3], 10);
  if (m[4].toUpperCase() === 'PM' && closeH !== 12) closeH += 12;
  if (m[4].toUpperCase() === 'AM' && closeH === 12) closeH = 0;
  return { open: openH, close: closeH };
}

const TIME_SLOTS = [
  '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM',
  '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
  '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM',
  '01:00 PM', '01:15 PM', '01:30 PM', '01:45 PM',
  '02:00 PM', '02:15 PM', '02:30 PM', '02:45 PM',
  '03:00 PM', '03:15 PM', '03:30 PM', '03:45 PM',
  '04:00 PM', '04:15 PM', '04:30 PM', '04:45 PM',
  '05:00 PM', '05:15 PM', '05:30 PM', '05:45 PM',
  '06:00 PM', '06:15 PM', '06:30 PM', '06:45 PM',
  '07:00 PM', '07:15 PM', '07:30 PM', '07:45 PM',
  '08:00 PM', '08:15 PM', '08:30 PM', '08:45 PM',
  '09:00 PM', '09:15 PM', '09:30 PM', '09:45 PM',
  '10:00 PM', '10:15 PM', '10:30 PM', '10:45 PM',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekDates(): { day: string; date: number; month: number; year: number; label: string }[] {
  const today = new Date();
  const results = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    results.push({
      day:   DAYS[d.getDay()],
      date:  d.getDate(),
      month: d.getMonth(),
      year:  d.getFullYear(),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : '',
    });
  }
  return results;
}

function slotToDate(slot: string, dateInfo: { date: number; month: number; year: number }): Date {
  const [time, meridiem] = slot.split(' ');
  const [hoursStr, minutesStr] = time.split(':');
  let hours   = parseInt(hoursStr, 10);
  const mins  = parseInt(minutesStr, 10);
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return new Date(dateInfo.year, dateInfo.month, dateInfo.date, hours, mins, 0, 0);
}

function isSlotPast(slot: string, dateInfo: { date: number; month: number; year: number }): boolean {
  return slotToDate(slot, dateInfo) <= new Date();
}

export default function PreScheduleScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { user }   = useAuth();

  const branch: Branch               = route.params?.branch;
  const service: Service | undefined = route.params?.service;
  const serviceType: string          = route.params?.serviceType ?? 'Dine In';
  const serviceId: string            = route.params?.serviceId ?? 'dine_in';

  const branchHours = parseBranchHours(branch?.hours);
  const weekDates   = getWeekDates();

  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedSlot, setSelectedSlot]       = useState<string | null>(null);
  const [loading, setLoading]                 = useState(false);
  const [bookError, setBookError]             = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentDateInfo = weekDates[selectedDateIdx];

  function showBookError(msg: string) {
    setBookError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setBookError(null), 5000);
    if (Platform.OS !== 'web') Alert.alert('Notice', msg);
  }

  // Disable slots outside branch opening hours or that would end after closing
  function isSlotDisabled(slot: string): boolean {
    if (isSlotPast(slot, currentDateInfo)) return true;
    const slotDate = slotToDate(slot, currentDateInfo);
    const slotHour = slotDate.getHours() + slotDate.getMinutes() / 60;
    if (slotHour < branchHours.open) return true;
    // Service must complete before closing
    const avgSvcMin = service?.avgServiceTime ?? branch?.avgServiceTime ?? 30;
    const endHour = slotHour + avgSvcMin / 60;
    if (endHour > branchHours.close) return true;
    return false;
  }

  async function handleBook() {
    if (!selectedSlot) {
      showBookError('Please choose a time slot first.');
      return;
    }
    if (!user) {
      showBookError('Please log in to pre-schedule a visit.');
      return;
    }

    const scheduledTime = slotToDate(selectedSlot, currentDateInfo);
    setLoading(true);

    try {
      // Check slot capacity — max 4 pre-scheduled tokens per 15-min window
      const slotCount = await countPreScheduledForSlot(branch.id, scheduledTime);
      if (slotCount >= 4) {
        showBookError('This time slot is fully booked (4/4). Please choose a different time slot.');
        setLoading(false);
        return;
      }

      // For pre-scheduled tokens, estimated wait = service duration (they have a reserved slot)
      const estimatedWait = service?.avgServiceTime ?? branch?.avgServiceTime ?? 15;

      // Validate slot against actual branch closing time using service duration (not queue wait)
      const avgSvcMin = service?.avgServiceTime ?? branch?.avgServiceTime ?? 30;
      const closingTime = new Date(scheduledTime);
      closingTime.setHours(branchHours.close, 0, 0, 0);
      const serviceEndTime = new Date(scheduledTime.getTime() + avgSvcMin * 60 * 1000);
      if (serviceEndTime > closingTime) {
        showBookError(
          `This slot (${selectedSlot}) would end after closing time. Please choose an earlier time.`,
        );
        setLoading(false);
        return;
      }

      const newToken = await generateToken({
        userId:               user.uid,
        userName:             user.name,
        branchId:             branch.id,
        branchName:           branch.name,
        serviceId:            service?.id ?? serviceId,
        serviceName:          service?.name ?? serviceType,
        serviceType,
        estimatedWaitMinutes: estimatedWait,
        isPreScheduled:       true,
        scheduledTime,
      });

      navigation.navigate('TokenStatus', { tokenId: newToken.id, token: newToken });
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      showBookError(`Could not reserve your slot. ${msg} — check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  }

  const hoursLabel = branch?.hours ?? `${branchHours.open}:00 – ${branchHours.close}:00`;

  return (
    <View style={styles.outer}>
      <AppHeader subtitle="Pre-Book a Visit" showBack showProfile={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Inline error banner — visible on web where Alert.alert is blocked */}
        {bookError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️  {bookError}</Text>
          </View>
        )}

        {/* Branch card */}
        <View style={styles.branchCard}>
          <Text style={styles.branchName}>{branch.name}</Text>
          <Text style={styles.branchAddress}>📍 {branch.address}</Text>
          <View style={styles.serviceChip}>
            <Text style={styles.serviceChipText}>
              {serviceType === 'Dine In' ? '🍽️' : '🛍️'} {serviceType}
            </Text>
          </View>
        </View>

        {/* Date selector */}
        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateScroll}
          contentContainerStyle={styles.dateContent}
        >
          {weekDates.map((d, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.dateChip, selectedDateIdx === idx && styles.dateChipActive]}
              onPress={() => { setSelectedDateIdx(idx); setSelectedSlot(null); }}
            >
              <Text style={[styles.dateDayText, selectedDateIdx === idx && styles.dateTextActive]}>
                {d.day}
              </Text>
              <Text style={[styles.dateDateText, selectedDateIdx === idx && styles.dateTextActive]}>
                {d.date}
              </Text>
              {d.label ? (
                <Text style={[styles.dateTodayLabel, selectedDateIdx === idx && { color: 'rgba(255,255,255,0.8)' }]}>
                  {d.label}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Time slots */}
        <Text style={styles.sectionTitle}>Available Time Slots</Text>
        <Text style={styles.sectionSub}>Working hours: {hoursLabel}</Text>

        <View style={styles.slotsGrid}>
          {TIME_SLOTS.map((slot) => {
            const disabled = isSlotDisabled(slot);
            const selected = selectedSlot === slot;
            return (
              <TouchableOpacity
                key={slot}
                disabled={disabled}
                style={[
                  styles.slotChip,
                  selected && styles.slotChipSelected,
                  disabled && styles.slotChipPast,
                ]}
                onPress={() => setSelectedSlot(slot)}
              >
                {selected && <Text style={styles.slotCheckmark}>✓ </Text>}
                <Text style={[
                  styles.slotText,
                  selected && styles.slotTextSelected,
                  disabled && styles.slotTextPast,
                ]}>
                  {slot}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {selectedSlot ? (
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedEmoji}>📅</Text>
            <Text style={styles.selectedText}>
              {DAYS[new Date(currentDateInfo.year, currentDateInfo.month, currentDateInfo.date).getDay()]}, {currentDateInfo.date}/{currentDateInfo.month + 1} at {selectedSlot}
            </Text>
          </View>
        ) : (
          <Text style={styles.noSelectionText}>Select a date & time slot above</Text>
        )}
        <TouchableOpacity
          style={[styles.confirmBtn, (!selectedSlot || loading) && styles.disabledBtn]}
          onPress={handleBook}
          disabled={!selectedSlot || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm Pre-Schedule →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:          { flex: 1, backgroundColor: COLORS.background },
  content:        { padding: 16 },

  errorBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.errorBg, borderRadius: RADIUS.md, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: COLORS.error },
  errorBannerText: { color: COLORS.error, fontWeight: '600', fontSize: FONT.sm, flex: 1 },

  branchCard:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 20, ...SHADOW.sm },
  branchName:     { fontSize: FONT.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  branchAddress:  { fontSize: FONT.sm, color: COLORS.textSecondary, marginBottom: 10 },
  serviceChip:    { alignSelf: 'flex-start', backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5 },
  serviceChipText:{ fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },

  sectionTitle:   { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  sectionSub:     { fontSize: FONT.sm, color: COLORS.textSecondary, marginBottom: 12 },

  dateScroll:     { flexGrow: 0, marginBottom: 20 },
  dateContent:    { gap: 10, paddingBottom: 4 },
  dateChip:       { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, minWidth: 64, ...SHADOW.sm },
  dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateDayText:    { fontSize: FONT.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  dateDateText:   { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary },
  dateTodayLabel: { fontSize: 10, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  dateTextActive: { color: '#FFFFFF' },

  slotsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  slotChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  slotChipPast:     { opacity: 0.3, backgroundColor: COLORS.separator },
  slotCheckmark:    { color: COLORS.primary, fontWeight: '800', fontSize: FONT.sm },
  slotText:         { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textPrimary },
  slotTextSelected: { color: COLORS.primary },
  slotTextPast:     { color: COLORS.textMuted },

  footer:          { padding: 16, paddingBottom: 28, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW.lg },
  selectedInfo:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  selectedEmoji:   { fontSize: 20 },
  selectedText:    { fontSize: FONT.md, fontWeight: '700', color: COLORS.primary },
  noSelectionText: { fontSize: FONT.sm, color: COLORS.textMuted, textAlign: 'center', marginBottom: 12 },
  confirmBtn:      { paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', ...SHADOW.md },
  confirmBtnText:  { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.lg },
  disabledBtn:     { opacity: 0.5 },
});
