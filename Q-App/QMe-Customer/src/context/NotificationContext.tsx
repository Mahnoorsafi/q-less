import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, StyleSheet, Text, TouchableOpacity, View, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './AuthContext';
import { subscribeToNotifications, Notification } from '../services/firebaseService';
import { COLORS, FONT, RADIUS, SHADOW } from '../constants/theme';

type NotifContextType = {
  unreadCount: number;
  latestUnread: Notification | null;
};

const NotifContext = createContext<NotifContextType>({ unreadCount: 0, latestUnread: null });

export function useNotifications() {
  return useContext(NotifContext);
}

export function NotificationProvider({
  children,
  navigationRef,
}: {
  children: React.ReactNode;
  navigationRef: React.RefObject<any>;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [unreadCount, setUnreadCount] = useState(0);
  const [latestUnread, setLatestUnread] = useState<Notification | null>(null);
  const [bannerMsg, setBannerMsg] = useState<Notification | null>(null);

  const slideY = useRef(new Animated.Value(-120)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef = useRef(-1);
  const shownIdsRef = useRef<Set<string>>(new Set());

  function hideBanner() {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    Animated.timing(slideY, { toValue: -120, duration: 280, useNativeDriver: true }).start(() =>
      setBannerMsg(null),
    );
  }

  function showBanner(msg: Notification) {
    setBannerMsg(msg);
    slideY.setValue(-120);
    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(hideBanner, 5000);
  }

  useEffect(() => {
    if (!user) {
      prevCountRef.current = -1;
      return;
    }
    prevCountRef.current = -1;
    const unsub = subscribeToNotifications(user.uid, (notifs) => {
      const unread = notifs.filter((n) => !n.read);
      setUnreadCount(unread.length);
      setLatestUnread(unread[0] ?? null);

      if (prevCountRef.current >= 0 && unread.length > prevCountRef.current) {
        const newOnes = unread.filter((n) => !shownIdsRef.current.has(n.id));
        if (newOnes.length > 0) {
          if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 100, 400]);
          showBanner(newOnes[0]);
          newOnes.forEach((n) => shownIdsRef.current.add(n.id));
        }
      } else {
        unread.forEach((n) => shownIdsRef.current.add(n.id));
      }
      prevCountRef.current = unread.length;
    });
    return () => {
      unsub();
      prevCountRef.current = -1;
    };
  }, [user?.uid]);

  function handleBannerTap() {
    hideBanner();
    try {
      navigationRef.current?.navigate('HomeTab', { screen: 'Notifications' });
    } catch {}
  }

  return (
    <NotifContext.Provider value={{ unreadCount, latestUnread }}>
      <View style={styles.root}>
        {children}
        {bannerMsg && (
          <Animated.View
            style={[
              styles.bannerWrap,
              { paddingTop: insets.top + 8 },
              { transform: [{ translateY: slideY }] },
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity style={styles.banner} activeOpacity={0.88} onPress={handleBannerTap}>
              <Text style={styles.bannerIcon}>🔔</Text>
              <View style={styles.bannerBody}>
                <Text style={styles.bannerTitle} numberOfLines={1}>{bannerMsg.title}</Text>
                <Text style={styles.bannerText} numberOfLines={2}>{bannerMsg.body}</Text>
              </View>
              <TouchableOpacity
                onPress={hideBanner}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </NotifContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    ...SHADOW.lg,
  },
  bannerIcon:  { fontSize: 22 },
  bannerBody:  { flex: 1, minWidth: 0 },
  bannerTitle: { fontSize: FONT.sm, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  bannerText:  { fontSize: FONT.xs, color: 'rgba(255,255,255,0.72)', lineHeight: 16 },
  closeBtn:    { padding: 2 },
  closeText:   { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
});
