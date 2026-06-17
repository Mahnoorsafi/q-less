import { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Vibration,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToNotifications, markNotificationRead,
  markAllNotificationsRead, Notification,
} from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

function timeAgo(ts: any): string {
  if (!ts) return '';
  try {
    const diff = Date.now() - ts.toDate().getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days > 0)  return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0)  return `${mins}m ago`;
    return 'just now';
  } catch { return ''; }
}

const NOTIF_ICONS: Record<string, string> = {
  called:     '🔔',
  served:     '✅',
  skipped:    '⏭️',
  cancelled:  '❌',
  broadcast:  '📢',
};

function getIcon(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('turn') || lower.includes('called')) return '🔔';
  if (lower.includes('served'))    return '✅';
  if (lower.includes('cancelled')) return '❌';
  if (lower.includes('skipped'))   return '⏭️';
  return '📣';
}

export default function NotificationScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const unsub = subscribeToNotifications(user.uid, (data) => {
      setNotifications(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const prevUnreadRef = useRef(-1);
  useEffect(() => {
    if (prevUnreadRef.current >= 0 && unreadCount > prevUnreadRef.current) {
      Vibration.vibrate([0, 300, 100, 300]);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <AppHeader title="Notifications" showProfile />

      {unreadCount > 0 && (
        <View style={styles.unreadBar}>
          <Text style={styles.unreadText}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
          <TouchableOpacity onPress={() => user && markAllNotificationsRead(user.uid)}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList<Notification>
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyMascot}>
              <Text style={styles.emptyMascotEmoji}>🌿</Text>
            </View>
            <Text style={styles.emptyTitle}>All quiet here!</Text>
            <Text style={styles.emptySub}>
              We'll notify you when your queue token is called.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = getIcon(item.title);
          return (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.cardUnread]}
              onPress={() => user && markNotificationRead(user.uid, item.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
                <Text style={styles.icon}>{icon}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.cardMessage}>{item.body}</Text>
                <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
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

  unreadBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primaryBg, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.primaryLight },
  unreadText:     { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },
  markAllText:    { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },

  listContent:    { padding: 16, paddingBottom: 24 },
  emptyWrap:      { alignItems: 'center', paddingTop: 80 },
  emptyMascot:    { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyMascotEmoji:{ fontSize: 40 },
  emptyTitle:     { fontSize: FONT.xl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:       { fontSize: FONT.md, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 32 },

  card:           { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardUnread:     { borderLeftWidth: 3, borderLeftColor: COLORS.primary, backgroundColor: '#FAFFF9' },
  iconWrap:       { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.separator, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconWrapUnread: { backgroundColor: COLORS.primaryBg },
  icon:           { fontSize: 22 },
  cardBody:       { flex: 1 },
  cardTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle:      { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  unreadDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  cardMessage:    { fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 6 },
  cardTime:       { fontSize: FONT.xs, color: COLORS.textMuted },
});