import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { rescheduleToken } from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

const SLOTS = [
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM',
  '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM',
  '09:00 PM',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekDates(): { day: string; date: number; month: number; year: number; label: string }[] {
  const today = new Date();
  const results = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    results.push({
      day: DAYS[d.getDay()], date: d.getDate(),
      month: d.getMonth(), year: d.getFullYear(),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : '',
    });
  }
  return results;
}

function slotToDate(slot: string, info: { date: number; month: number; year: number }): Date {
  const [time, meridiem] = slot.split(' ');
  const [hoursStr, minutesStr] = time.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return new Date(info.year, info.month, info.date, hours, minutes, 0, 0);
}

function isPast(slot: string, info: { date: number; month: number; year: number }): boolean {
  return slotToDate(slot, info) <= new Date();
}

export default function RescheduleScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const tokenId: string = route.params?.tokenId;

  const weekDates = getWeekDates();
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedSlot, setSelectedSlot]       = useState<string | null>(null);
  const [loading, setLoading]                 = useState(false);

  const currentDateInfo = weekDates[selectedDateIdx];

  async function handleReschedule() {
    if (!selectedSlot) {
      if (Platform.OS === 'web') { alert('Please choose a new time slot.'); }
      else { Alert.alert('Select a Slot', 'Please choose a new time slot.'); }
      return;
    }
    setLoading(true);
    try {
      await rescheduleToken(tokenId, slotToDate(selectedSlot, currentDateInfo));
      const msg = `Your token has been moved to ${selectedSlot} on ${currentDateInfo.day} ${currentDateInfo.date}/${currentDateInfo.month + 1}.`;
      if (Platform.OS === 'web') {
        alert(`Rescheduled! ${msg}`);
        navigation.goBack();
      } else {
        Alert.alert('📅 Rescheduled!', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch {
      if (Platform.OS === 'web') { alert('Could not reschedule. Please try again.'); }
      else { Alert.alert('Error', 'Could not reschedule. Please try again.'); }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.outer}>
      <AppHeader subtitle="Change Time Slot" showBack showProfile={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Date picker */}
        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.dateScroll} contentContainerStyle={styles.dateContent}
        >
          {weekDates.map((d, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.dateChip, selectedDateIdx === idx && styles.dateChipActive]}
              onPress={() => { setSelectedDateIdx(idx); setSelectedSlot(null); }}
            >
              <Text style={[styles.dateDayText, selectedDateIdx === idx && styles.dateTextActive]}>{d.day}</Text>
              <Text style={[styles.dateDateText, selectedDateIdx === idx && styles.dateTextActive]}>{d.date}</Text>
              {d.label ? (
                <Text style={[styles.dateTodayLabel, selectedDateIdx === idx && { color: 'rgba(255,255,255,0.8)' }]}>
                  {d.label}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Select New Time</Text>
        <Text style={styles.sectionSub}>Working hours: 10:00 AM – 9:00 PM</Text>

        <View style={styles.slotsGrid}>
          {SLOTS.map((slot) => {
            const past     = isPast(slot, currentDateInfo);
            const selected = selectedSlot === slot;
            return (
              <TouchableOpacity
                key={slot}
                disabled={past}
                style={[styles.slotChip, selected && styles.slotChipSelected, past && styles.slotChipPast]}
                onPress={() => setSelectedSlot(slot)}
              >
                {selected && <Text style={styles.checkmark}>✓ </Text>}
                <Text style={[styles.slotText, selected && styles.slotTextSelected, past && styles.slotTextPast]}>
                  {slot}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        {selectedSlot ? (
          <View style={styles.selectedRow}>
            <Text style={styles.selectedEmoji}>📅</Text>
            <Text style={styles.selectedText}>
              {currentDateInfo.day} {currentDateInfo.date}/{currentDateInfo.month + 1} at {selectedSlot}
            </Text>
          </View>
        ) : (
          <Text style={styles.hintText}>Choose a date & time slot above</Text>
        )}
        <TouchableOpacity
          style={[styles.confirmBtn, (!selectedSlot || loading) && styles.disabledBtn]}
          onPress={handleReschedule}
          disabled={!selectedSlot || loading}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.confirmBtnText}>Confirm Reschedule →</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:            { flex: 1, backgroundColor: COLORS.background },
  content:          { padding: 16 },

  dateScroll:       { flexGrow: 0, marginBottom: 20 },
  dateContent:      { gap: 10, paddingBottom: 4 },
  dateChip:         { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, minWidth: 64, ...SHADOW.sm },
  dateChipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateDayText:      { fontSize: FONT.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  dateDateText:     { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary },
  dateTodayLabel:   { fontSize: 10, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  dateTextActive:   { color: '#FFFFFF' },

  sectionTitle:     { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  sectionSub:       { fontSize: FONT.sm, color: COLORS.textSecondary, marginBottom: 16 },
  slotsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  slotChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  slotChipPast:     { opacity: 0.3, backgroundColor: COLORS.separator },
  checkmark:        { color: COLORS.primary, fontWeight: '800', fontSize: FONT.sm },
  slotText:         { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textPrimary },
  slotTextSelected: { color: COLORS.primary },
  slotTextPast:     { color: COLORS.textMuted },
  footer:           { padding: 16, paddingBottom: 28, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW.lg },
  selectedRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  selectedEmoji:    { fontSize: 20 },
  selectedText:     { fontSize: FONT.md, fontWeight: '700', color: COLORS.primary },
  hintText:         { fontSize: FONT.sm, color: COLORS.textMuted, textAlign: 'center', marginBottom: 12 },
  confirmBtn:       { paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', ...SHADOW.md },
  confirmBtnText:   { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.lg },
  disabledBtn:      { opacity: 0.5 },
});
