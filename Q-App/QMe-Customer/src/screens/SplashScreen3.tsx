import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Image, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, FONT, SHADOW } from '../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MASCOT = require('../../assets/ghibli-mascot-transparent.webp');

const TIPS = [
  { emoji: '🎫', text: 'Get your token in seconds' },
  { emoji: '📍', text: 'Find the nearest branch instantly' },
  { emoji: '🤖', text: 'AI predicts your exact wait time' },
];

export default function SplashScreen3() {
  const navigation = useNavigation<any>();
  const { width }  = useWindowDimensions();
  const insets     = useSafeAreaInsets();
  const BASE       = Math.min(width, 430);
  const MASCOT_SZ  = BASE * 0.42;

  const floatAnim   = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(0.5)).current;
  const mascotOp    = useRef(new Animated.Value(0)).current;
  const contentY    = useRef(new Animated.Value(40)).current;
  const contentOp   = useRef(new Animated.Value(0)).current;
  const btnScale    = useRef(new Animated.Value(0)).current;
  const tipAnims    = TIPS.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    // Mascot bounces in
    Animated.parallel([
      Animated.spring(mascotScale, { toValue: 1, friction: 5, tension: 35, useNativeDriver: true }),
      Animated.timing(mascotOp,   { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start(() => {
      // Start float loop after entrance
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ]),
      ).start();
    });

    // Content slides up
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(contentY,  { toValue: 0, friction: 7, tension: 45, useNativeDriver: true }),
        Animated.timing(contentOp, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // Tips stagger
    Animated.sequence([
      Animated.delay(400),
      Animated.stagger(130, tipAnims.map((a) =>
        Animated.spring(a, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
      )),
    ]).start();

    // Button bounces in last
    Animated.sequence([
      Animated.delay(850),
      Animated.spring(btnScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
    ]).start();

    // Skip onboarding — go straight to Login (reset clears splash stack on web + native)
    const timer = setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }), 4000);
    return () => clearTimeout(timer);
  }, []);

  const floatStyle = {
    transform: [
      { translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
    ],
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(48, insets.top + 16), paddingBottom: Math.max(28, insets.bottom + 16) }]}>
      {/* Floating mascot */}
      <Animated.View style={[styles.mascotWrap, { opacity: mascotOp, transform: [{ scale: mascotScale }] }]}>
        <Animated.View style={floatStyle}>
          <Image source={MASCOT} style={{ width: MASCOT_SZ, height: MASCOT_SZ }} resizeMode="contain" />
        </Animated.View>
      </Animated.View>

      {/* Welcome text */}
      <Animated.View style={{ opacity: contentOp, transform: [{ translateY: contentY }], alignItems: 'center' }}>
        <Text style={styles.title}>Welcome to Q-Less!</Text>
        <Text style={styles.subtitle}>
          The smarter way to dine at Olive.{'\n'}No waiting in line — relax, we'll call you.
        </Text>
      </Animated.View>

      {/* Tips */}
      <View style={styles.tipsCard}>
        {TIPS.map((t, i) => (
          <Animated.View
            key={t.text}
            style={[styles.tipRow, i < TIPS.length - 1 && styles.tipBorder, {
              opacity: tipAnims[i],
              transform: [{ translateX: tipAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            }]}
          >
            <Text style={styles.tipEmoji}>{t.emoji}</Text>
            <Text style={styles.tipText}>{t.text}</Text>
          </Animated.View>
        ))}
      </View>

      {/* CTA button */}
      <Animated.View style={{ width: '100%', transform: [{ scale: btnScale }] }}>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>Get Started  →</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.progress}>
        <View style={[styles.pgDot, { backgroundColor: COLORS.border }]} />
        <View style={[styles.pgDot, { backgroundColor: COLORS.border }]} />
        <View style={[styles.pgDot, styles.pgActive]} />
      </View>

      <Text style={styles.poweredBy}>Powered by Olive Restaurant Chain</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, alignItems: 'center', backgroundColor: COLORS.background, paddingHorizontal: 28 },

  mascotWrap:  { marginBottom: 4 },

  title:       { fontSize: FONT.xxl, fontWeight: '900', color: COLORS.primary, textAlign: 'center', marginBottom: 10 },
  subtitle:    { fontSize: FONT.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  tipsCard:    { width: '100%', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, paddingVertical: 4, paddingHorizontal: 4, marginBottom: 28, ...SHADOW.sm },
  tipRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  tipBorder:   { borderBottomWidth: 1, borderBottomColor: COLORS.separator },
  tipEmoji:    { fontSize: 24 },
  tipText:     { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textPrimary },

  startBtn:    { width: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: 18, alignItems: 'center', marginBottom: 24, ...SHADOW.md },
  startBtnText:{ color: '#FFFFFF', fontWeight: '900', fontSize: FONT.lg, letterSpacing: 0.4 },

  progress:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pgDot:       { width: 8, height: 8, borderRadius: 4 },
  pgActive:    { width: 24, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },

  poweredBy:   { fontSize: FONT.xs, color: COLORS.textMuted },
});