import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { fetchUserTokenHistory, Token } from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

const FILTERS = ['All', 'Served', 'Waiting', 'Cancelled'] as const;

const STATUS_CONFIG: Record<string, { emoji: string; color: string; bg: string; label: string }> = {
  waiting:   { emoji: '⏳', color: '#3B82F6', bg: '#DBEAFE', label: 'Waiting' },
  called:    { emoji: '🔔', color: '#F59E0B', bg: '#FEF3C7', label: 'Called' },
  served:    { emoji: '✅', color: COLORS.success, bg: COLORS.successBg, label: 'Served' },
  skipped:   { emoji: '⏭️', color: COLORS.warning, bg: COLORS.warningBg, label: 'Skipped' },
  cancelled: { emoji: '❌', color: COLORS.error, bg: COLORS.errorBg, label: 'Cancelled' },
};

function formatDate(ts: any): string {
  if (!ts) return '—';
  try {
    const d = ts.toDate();
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function formatTime(ts: any): string {
  if (!ts) return '';
  try {
    return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { user }   = useAuth();

  const [tokens, setTokens]   = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>('All');

  useFocusEffect(
    useCallback(() => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      fetchUserTokenHistory(user.uid)
        .then(setTokens)
        .catch(() => setTokens([]))
        .finally(() => setLoading(false));
    }, [user])
  );

  const filtered = tokens.filter((t) => {
    if (filter === 'All')       return true;
    if (filter === 'Served')    return t.status === 'served';
    if (filter === 'Waiting')   return t.status === 'waiting' || t.status === 'called';
    if (filter === 'Cancelled') return t.status === 'cancelled' || t.status === 'skipped';
    return true;
  });

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyEmoji}>🔐</Text>
        <Text style={styles.emptyTitle}>Sign in to view history</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <AppHeader title="My History" showProfile />

      {/* Summary chips */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryNum}>{tokens.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={[styles.summaryNum, { color: COLORS.success }]}>
            {tokens.filter((t) => t.status === 'served').length}
          </Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={[styles.summaryNum, { color: '#3B82F6' }]}>
            {tokens.filter((t) => t.status === 'waiting' || t.status === 'called').length}
          </Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={[styles.summaryNum, { color: COLORS.error }]}>
            {tokens.filter((t) => t.status === 'cancelled').length}
          </Text>
          <Text style={styles.summaryLabel}>Cancelled</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList<Token>
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No tokens yet</Text>
            <Text style={styles.emptySub}>Your queue history will appear here.</Text>
            <TouchableOpacity
              style={styles.findBranchBtn}
              onPress={() => navigation.navigate('HomeTab')}
            >
              <Text style={styles.findBranchText}>Find a Branch</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.waiting;
          const isActive = item.status === 'waiting' || item.status === 'called';
          return (
            <TouchableOpacity
              style={styles.tokenCard}
              onPress={() => isActive && navigation.navigate('TokenStatus', { tokenId: item.id })}
              activeOpacity={isActive ? 0.75 : 1}
            >
              <View style={styles.tokenCardLeft}>
                <View style={[styles.statusIconWrap, { backgroundColor: cfg.bg }]}>
                  <Text style={styles.statusIcon}>{cfg.emoji}</Text>
                </View>
                <View>
                  <Text style={styles.tokenCode}>{item.tokenCode}</Text>
                  <Text style={styles.tokenBranch}>{item.branchName}</Text>
                  <Text style={styles.tokenService}>{item.serviceType}</Text>
                </View>
              </View>
              <View style={styles.tokenCardRight}>
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <Text style={styles.tokenDate}>{formatDate(item.createdAt)}</Text>
                {formatTime(item.createdAt) ? (
                  <Text style={styles.tokenTime}>{formatTime(item.createdAt)}</Text>
                ) : null}
                {item.orderTotal !== undefined && item.orderTotal > 0 && (
                  <Text style={styles.orderAmount}>Rs. {item.orderTotal.toLocaleString()}</Text>
                )}
                {isActive && (
                  <Text style={styles.trackLink}>Track →</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer:          { flex: 1, backgroundColor: COLORS.background },
  loadingWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },

  summaryRow:     { flexDirection: 'row', backgroundColor: COLORS.surface, paddingVertical: 12, paddingHorizontal: 16, gap: 4 },
  summaryChip:    { flex: 1, alignItems: 'center' },
  summaryNum:     { fontSize: FONT.xxl, fontWeight: '900', color: COLORS.textPrimary },
  summaryLabel:   { fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 2 },

  filterRow:      { flexDirection: 'row', backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingBottom: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterTab:      { paddingVertical: 7, paddingHorizontal: 14, borderRadius: RADIUS.full, backgroundColor: COLORS.separator },
  filterTabActive:{ backgroundColor: COLORS.primary },
  filterText:     { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive:{ color: '#FFFFFF' },

  listContent:    { padding: 16, paddingBottom: 24 },
  emptyWrap:      { alignItems: 'center', paddingTop: 60 },
  emptyEmoji:     { fontSize: 56, marginBottom: 12 },
  emptyTitle:     { fontSize: FONT.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  emptySub:       { fontSize: FONT.md, color: COLORS.textSecondary, marginBottom: 20 },
  findBranchBtn:  { paddingVertical: 12, paddingHorizontal: 28, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg },
  findBranchText: { color: '#FFFFFF', fontWeight: '700', fontSize: FONT.md },

  tokenCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  tokenCardLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  statusIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusIcon:     { fontSize: 22 },
  tokenCode:      { fontSize: FONT.md, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 2 },
  tokenBranch:    { fontSize: FONT.sm, color: COLORS.textSecondary },
  tokenService:   { fontSize: FONT.xs, color: COLORS.textMuted, marginTop: 2 },

  tokenCardRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge:    { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText:{ fontSize: FONT.xs, fontWeight: '700' },
  tokenDate:      { fontSize: FONT.xs, color: COLORS.textSecondary },
  tokenTime:      { fontSize: FONT.xs, color: COLORS.textMuted },
  orderAmount:    { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },
  trackLink:      { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },
});