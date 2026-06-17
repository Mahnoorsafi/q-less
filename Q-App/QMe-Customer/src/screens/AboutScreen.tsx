import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { fetchUserTokenHistory } from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

export default function AboutScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, served: 0, visits: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchUserTokenHistory(user.uid)
      .then((tokens) => {
        const served = tokens.filter((t) => t.status === 'served').length;
        const visits: Record<string, number> = {};
        tokens.forEach((t) => {
          visits[t.branchName] = (visits[t.branchName] ?? 0) + 1;
        });
        setStats({ total: tokens.length, served, visits });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <View style={styles.outer}>
      <AppHeader subtitle="About Q-Less" showBack showProfile={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Brand hero */}
        <View style={styles.brandCard}>
          <Text style={styles.logoEmoji}>🍀</Text>
          <Text style={styles.brandName}>Q-LESS</Text>
          <Text style={styles.brandSub}>Queue Smart, Live More.</Text>
          <View style={styles.versionChip}>
            <Text style={styles.versionText}>v1.0.0  ·  Olive Restaurant Chain</Text>
          </View>
        </View>

        {/* User token stats */}
        {user && (
          <>
            <Text style={styles.sectionTitle}>Your Token History</Text>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{stats.total}</Text>
                  <Text style={styles.statLbl}>Total Tokens</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: COLORS.success }]}>{stats.served}</Text>
                  <Text style={styles.statLbl}>Served</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: COLORS.warning }]}>{stats.total - stats.served}</Text>
                  <Text style={styles.statLbl}>Cancelled</Text>
                </View>
              </View>
            )}

            {!loading && Object.keys(stats.visits).length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Branch Visits</Text>
                {Object.entries(stats.visits).map(([branch, count]) => (
                  <View key={branch} style={styles.branchRow}>
                    <Text style={styles.branchRowName}>📍 {branch}</Text>
                    <Text style={styles.branchRowCount}>{count} visit{count !== 1 ? 's' : ''}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* Features */}
        <Text style={styles.sectionTitle}>App Features</Text>
        {[
          { e: '🎫', name: 'Digital Token Generation',     desc: 'Skip the physical queue from anywhere' },
          { e: '🤖', name: 'AI Wait-Time Prediction',      desc: 'Linear Regression model for accuracy' },
          { e: '📅', name: 'Pre-Scheduling',               desc: 'Book a slot up to 7 days in advance' },
          { e: '⚡', name: 'Smart Branch Recommendation',  desc: 'Get directed to the least-busy branch' },
          { e: '🔔', name: 'Real-time Notifications',      desc: "Get alerted the moment it's your turn" },
          { e: '🔄', name: 'Reschedule',                   desc: 'Change your slot anytime before service' },
        ].map((f) => (
          <View key={f.name} style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Text style={styles.featureEmoji}>{f.e}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureName}>{f.name}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}

        {/* Team */}
        <Text style={styles.sectionTitle}>Developed By</Text>
        <View style={styles.teamCard}>
          <Text style={styles.teamSubtitle}>IIU · BSSE-F22 · Final Year Project</Text>
          {['Hania Ramzan', 'Insiya Satti'].map((name) => (
            <View key={name} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{name[0]}</Text>
              </View>
              <Text style={styles.memberName}>{name}</Text>
            </View>
          ))}
          <View style={styles.supervisorRow}>
            <Text style={styles.supervisorLabel}>Supervisor:</Text>
            <Text style={styles.supervisorName}>Ms. Maryam Amin</Text>
          </View>
          <Text style={styles.deptText}>Dept. of Software Engineering, IIU Islamabad</Text>
        </View>

        {/* Tech stack */}
        <Text style={styles.sectionTitle}>Technology Stack</Text>
        <View style={styles.techGrid}>
          {['React Native', 'Expo SDK 56', 'Firebase', 'Flask + ML', 'Linear Regression'].map((t) => (
            <View key={t} style={styles.techChip}>
              <Text style={styles.techChipText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:        { flex: 1, backgroundColor: COLORS.background },
  content:      { padding: 16 },

  brandCard:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 28, alignItems: 'center', marginBottom: 24, ...SHADOW.md },
  logoEmoji:    { fontSize: 52, marginBottom: 8 },
  brandName:    { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: 3 },
  brandSub:     { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: 14 },
  versionChip:  { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 6 },
  versionText:  { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },

  sectionTitle: { fontSize: FONT.lg, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12, marginTop: 4 },

  statsGrid:    { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox:      { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', ...SHADOW.sm },
  statNum:      { fontSize: 30, fontWeight: '900', color: COLORS.primary },
  statLbl:      { fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },

  branchRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 8, ...SHADOW.sm },
  branchRowName:{ fontSize: FONT.sm, fontWeight: '600', color: COLORS.textPrimary },
  branchRowCount:{ fontSize: FONT.sm, fontWeight: '800', color: COLORS.primary },

  featureRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 8, gap: 14, ...SHADOW.sm },
  featureIconWrap:{ width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  featureEmoji: { fontSize: 22 },
  featureName:  { fontSize: FONT.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  featureDesc:  { fontSize: FONT.xs, color: COLORS.textSecondary },

  teamCard:     { backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.lg, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: COLORS.primary + '40' },
  teamSubtitle: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary, marginBottom: 16 },
  memberRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  memberInitial:{ color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  memberName:   { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary },
  supervisorRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  supervisorLabel:{ fontSize: FONT.sm, color: COLORS.textSecondary },
  supervisorName: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.textPrimary },
  deptText:     { fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 4 },

  techGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  techChip:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: COLORS.border, ...SHADOW.sm },
  techChipText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textPrimary },
});