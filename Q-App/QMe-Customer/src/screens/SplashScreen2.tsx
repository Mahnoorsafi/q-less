import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, FONT, SHADOW } from '../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MASCOT = require('../../assets/ghibli-mascot-transparent.webp');

const FEATURES = [
  { emoji: '📍', title: 'Find Nearest Branch', desc: 'Live map with all Olive locations' },
  { emoji: '⏱',  title: 'AI Wait Prediction',  desc: 'Smart wait-time powered by ML' },
  { emoji: '🔔', title: 'Instant Alerts',       desc: "We notify you when it's your turn" },
];

export default function SplashScreen2() {
  const navigation = useNavigation<any>();
  const { width }  = useWindowDimensions();
  const insets     = useSafeAreaInsets();
  const BASE       = Math.min(width, 430);
  const MASCOT_SZ  = BASE * 0.28;

  const mascotX    = useRef(new Animated.Value(-120)).current;
  const mascotOp   = useRef(new Animated.Value(0)).current;
  const titleOp    = useRef(new Animated.Value(0)).current;
  const titleY     = useRef(new Animated.Value(20)).current;
  const cardAnims  = FEATURES.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    // Mascot slides in from left
    Animated.parallel([
      Animated.spring(mascotX,  { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      Animated.timing(mascotOp, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    // Title fades up
    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(titleY,  { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
      ]),
    ]).start();

    // Feature cards stagger in
    Animated.sequence([
      Animated.delay(450),
      Animated.stagger(140, cardAnims.map((a) =>
        Animated.spring(a, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      )),
    ]).start();

    const timer = setTimeout(() => navigation.replace('Splash3'), 3200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: Math.max(64, insets.top + 20) }]}>
      {/* Header with mascot */}
      <View style={styles.header}>
        <Animated.View style={{ transform: [{ translateX: mascotX }], opacity: mascotOp }}>
          <Image source={MASCOT} style={{ width: MASCOT_SZ, height: MASCOT_SZ }} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[styles.headerText, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
          <Text style={styles.title}>Skip the Line</Text>
          <Text style={styles.subtitle}>Queue smarter at Olive Restaurant with real-time AI</Text>
        </Animated.View>
      </View>

      {/* Feature cards */}
      <View style={styles.cards}>
        {FEATURES.map((f, i) => (
          <Animated.View
            key={f.title}
            style={[styles.card, {
              opacity: cardAnims[i],
              transform: [
                { scale: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                { translateX: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              ],
            }]}
          >
            <View style={styles.cardIcon}>
              <Text style={styles.cardEmoji}>{f.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{f.title}</Text>
              <Text style={styles.cardDesc}>{f.desc}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Progress dots */}
      <View style={styles.progress}>
        <View style={[styles.pgDot, { backgroundColor: COLORS.border }]} />
        <View style={[styles.pgDot, styles.pgActive]} />
        <View style={[styles.pgDot, { backgroundColor: COLORS.border }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 24, paddingBottom: 40 },

  header:      { flexDirection: 'row', alignItems: 'center', marginBottom: 32, gap: 12 },
  headerText:  { flex: 1 },
  title:       { fontSize: 28, fontWeight: '900', color: COLORS.primary, marginBottom: 6 },
  subtitle:    { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },

  cards:       { flex: 1, gap: 12 },
  card:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, gap: 14, ...SHADOW.sm },
  cardIcon:    { width: 50, height: 50, borderRadius: 14, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  cardEmoji:   { fontSize: 24 },
  cardTitle:   { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  cardDesc:    { fontSize: FONT.xs, color: COLORS.textSecondary },

  progress:    { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pgDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  pgActive:    { width: 24, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
});