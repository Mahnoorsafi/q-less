import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MASCOT = require('../../assets/ghibli-mascot-transparent.webp');

export default function SplashScreen1() {
  const navigation = useNavigation<any>();
  const { width }  = useWindowDimensions();
  const insets     = useSafeAreaInsets();
  const BASE       = Math.min(width, 430);

  // Animation values
  const mascotScale    = useRef(new Animated.Value(0)).current;
  const mascotY        = useRef(new Animated.Value(80)).current;
  const brandOpacity   = useRef(new Animated.Value(0)).current;
  const brandY         = useRef(new Animated.Value(30)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const circleScale    = useRef(new Animated.Value(0)).current;
  const dot1Scale      = useRef(new Animated.Value(0)).current;
  const dot2Scale      = useRef(new Animated.Value(0)).current;
  const dot3Scale      = useRef(new Animated.Value(0)).current;
  const glowOpacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Glow circle + mascot bounce in
    Animated.parallel([
      Animated.spring(circleScale, { toValue: 1, friction: 5, tension: 30, useNativeDriver: true }),
      Animated.timing(glowOpacity,  { toValue: 0.25, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(mascotScale, { toValue: 1, friction: 5, tension: 35, useNativeDriver: true }),
        Animated.spring(mascotY,     { toValue: 0,  friction: 6, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();

    // Brand text after mascot lands
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(brandOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(brandY,       { toValue: 0, friction: 7, tension: 45, useNativeDriver: true }),
      ]),
    ]).start();

    // Tagline
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Dots stagger
    Animated.sequence([
      Animated.delay(750),
      Animated.stagger(120, [
        Animated.spring(dot1Scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.spring(dot2Scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.spring(dot3Scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]),
    ]).start();

    const timer = setTimeout(() => navigation.replace('Splash2'), 3200);
    return () => clearTimeout(timer);
  }, []);

  const glowCircleStyle = {
    position: 'absolute' as const,
    width:  BASE * 1.4,
    height: BASE * 1.4,
    borderRadius: BASE * 0.7,
    backgroundColor: '#FFFFFF',
    top: -BASE * 0.3,
  };
  const mascotSize = BASE * 0.46;
  const subBottom  = Math.max(36, insets.bottom + 20);

  return (
    <View style={styles.container}>
      {/* Background glow circle */}
      <Animated.View style={[glowCircleStyle, { transform: [{ scale: circleScale }], opacity: glowOpacity }]} />

      {/* Mascot */}
      <Animated.View style={[styles.mascotWrap, {
        transform: [{ scale: mascotScale }, { translateY: mascotY }],
      }]}>
        <Image source={MASCOT} style={{ width: mascotSize, height: mascotSize }} resizeMode="contain" />
      </Animated.View>

      {/* Brand */}
      <Animated.Text style={[styles.brand, { opacity: brandOpacity, transform: [{ translateY: brandY }] }]}>
        Q-LESS
      </Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Queue Smart, Live More.
      </Animated.Text>

      {/* Decorative dots */}
      <View style={styles.dotRow}>
        {[dot1Scale, dot2Scale, dot3Scale].map((s, i) => (
          <Animated.View key={i} style={[styles.dot, i === 1 && styles.dotLarge, { transform: [{ scale: s }] }]} />
        ))}
      </View>

      <Animated.Text style={[styles.sub, { bottom: subBottom, opacity: taglineOpacity }]}>
        Powered by Olive Restaurant Chain
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, overflow: 'hidden' },

  mascotWrap:  { marginBottom: 8 },

  brand:       { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4, marginBottom: 8 },
  tagline:     { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 36, letterSpacing: 0.5 },

  dotRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 40 },
  dot:         { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotLarge:    { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.8)' },

  sub:         { position: 'absolute', bottom: 36, fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3 },
});