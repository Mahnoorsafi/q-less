import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, FONT } from '../constants/theme';

export default function Onboarding3() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.outer}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroCircle}>
          <Text style={styles.heroEmoji}>🔔</Text>
        </View>
        <View style={styles.mascotRow}>
          <View style={[styles.bubble, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Text style={styles.bubbleEmoji}>👾</Text></View>
          <View style={[styles.bubble, styles.bubbleMid, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Text style={[styles.bubbleEmoji, { fontSize: 22 }]}>🌿</Text></View>
          <View style={[styles.bubble, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Text style={styles.bubbleEmoji}>🐣</Text></View>
        </View>
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
          <View style={[styles.dot, styles.dotPrev]} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>

        <Text style={styles.title}>Stay in the Loop</Text>
        <Text style={styles.body}>
          Get notified when your turn is approaching.
          Pre-book time slots, track status live, and never miss your queue again.
        </Text>

        <View style={styles.notifCard}>
          <Text style={styles.notifEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitle}>Almost your turn!</Text>
            <Text style={styles.notifSub}>Token GUL-024 · 2 people ahead of you</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Signup' }] })}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>Create Free Account →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
        >
          <Text style={styles.loginLinkText}>Already have an account? <Text style={{ color: COLORS.primary }}>Log In</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:        { flex: 1, backgroundColor: COLORS.primaryLight },
  hero:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48, gap: 16 },
  heroCircle:   { width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroEmoji:    { fontSize: 64 },
  mascotRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bubble:       { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  bubbleMid:    { width: 58, height: 58, borderRadius: 29 },
  bubbleEmoji:  { fontSize: 20 },
  skipBtn:      { position: 'absolute', top: 16, right: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full },
  skipText:     { color: '#FFFFFF', fontWeight: '700', fontSize: FONT.sm },

  card:         { backgroundColor: COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingTop: 24 },
  dots:         { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive:    { width: 24, backgroundColor: COLORS.primary },
  dotPrev:      { backgroundColor: COLORS.primaryLight },

  title:        { fontSize: FONT.xxl, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 12 },
  body:         { fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 20 },

  notifCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 28, borderLeftWidth: 4, borderLeftColor: COLORS.primary, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  notifEmoji:   { fontSize: 28 },
  notifTitle:   { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  notifSub:     { fontSize: FONT.xs, color: COLORS.textSecondary },

  ctaBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 17, alignItems: 'center', marginBottom: 14, shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  ctaBtnText:   { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.lg },

  loginLink:    { alignItems: 'center' },
  loginLinkText:{ fontSize: FONT.sm, color: COLORS.textSecondary, fontWeight: '600' },
});