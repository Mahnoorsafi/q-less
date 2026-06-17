import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, FONT } from '../constants/theme';

export default function Onboarding2() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.outer}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroCircle}>
          <Text style={styles.heroEmoji}>🎫</Text>
        </View>
        <Text style={styles.heroLabel}>Skip the Queue</Text>
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
          <View style={[styles.dot, styles.dotPrev]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>Get Your Token Instantly</Text>
        <Text style={styles.body}>
          Choose Dine In or Takeaway, browse the menu and add items.
          Your token is generated in seconds — no more standing in line.
        </Text>

        <View style={styles.stepList}>
          {[
            { n: '1', text: 'Select a branch' },
            { n: '2', text: 'Pick a service & add items' },
            { n: '3', text: 'Confirm & get token' },
          ].map((s) => (
            <View key={s.n} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => navigation.navigate('Onboarding3')}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:        { flex: 1, backgroundColor: COLORS.primaryDark },
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
  dotPrev:      { backgroundColor: COLORS.primaryLight },

  title:        { fontSize: FONT.xxl, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 12 },
  body:         { fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 20 },

  stepList:     { gap: 12, marginBottom: 28 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNum:      { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText:  { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.md },
  stepText:     { fontSize: FONT.md, fontWeight: '600', color: COLORS.textPrimary },

  nextBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 17, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  nextBtnText:  { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.lg },
});