import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { COLORS, SHADOW } from '../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MASCOT = require('../../assets/mascot.png');

type Props = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  showProfile?: boolean;
};

export default function AppHeader({
  title = 'Q-LESS',
  subtitle,
  showBack = false,
  showNotifications = true,
  showProfile = true,
}: Props) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { unreadCount } = useNotifications();

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <Image source={MASCOT} style={styles.mascotLogo} resizeMode="contain" />
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.brand}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.right}>
        {showNotifications && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.iconText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {showProfile && (
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('ProfileTab')}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: COLORS.primary,
    ...SHADOW.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mascotLogo: {
    width: 42,
    height: 42,
    marginRight: 10,
  },
  titleWrap: {
    flex: 1,
  },
  brand: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  backArrow: {
    fontSize: 22,
    color: '#FFFFFF',
    marginRight: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 12,
  },
});