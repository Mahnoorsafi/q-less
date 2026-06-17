import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, FONT } from '../constants/theme';

export default function Onboarding1() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.outer}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroCircle}>
          <Text style={styles.heroEmoji}>📍</Text>
        </View>
        <Text style={styles.heroLabel}>Olive Restaurant Chain</Text>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Card */}
      <View style={styles.card}>
        {/* Progress dots */}
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>Find Your Nearest Branch</Text>
        <Text style={styles.body}>
          Browse Olive branches across Islamabad & Rawalpindi.
          See real-time queue lengths and estimated wait times before you leave home.
        </Text>

        <View style={styles.featureRow}>
          <View style={styles.featureChip}><Text style={styles.featureChipText}>📍 GPS-powered</Text></View>
          <View style={styles.featureChip}><Text style={styles.featureChipText}>🗺️ Live map</Text></View>
          <View style={styles.featureChip}><Text style={styles.featureChipText}>⏱ Wait times</Text></View>
        </View>

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => navigation.navigate('Onboarding2')}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:        { flex: 1, backgroundColor: COLORS.primary },
  hero:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  heroCircle:   { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroEmoji:    { fontSize: 68 },
  heroLabel:    { fontSize: FONT.sm, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  skipBtn:      { position: 'absolute', top: 16, right: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full },
  skipText:     { color: '#FFFFFF', fontWeight: '700', fontSize: FONT.sm },

  card:         { backgroundColor: COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingTop: 24 },
  dots:         { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive:    { width: 24, backgroundColor: COLORS.primary },

  title:        { fontSize: FONT.xxl, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 12 },
  body:         { fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 20 },

  featureRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  featureChip:  { backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7 },
  featureChipText: { fontSize: FONT.xs, fontWeight: '700', color: COLORS.primary },

  nextBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 17, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  nextBtnText:  { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.lg },
});