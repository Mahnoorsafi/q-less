import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, FONT, SHADOW } from '../constants/theme';

export default function SignupScreen() {
  const navigation        = useNavigation<any>();
  const { signUp }        = useAuth();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSignup() {
    setError('');
    if (!name.trim() || !email.trim() || !password) {
      setError('Please complete all fields.');
      return;
    }
    setLoading(true);
    try {
      await signUp(name.trim(), email.trim(), password);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err: any) {
      const code = err?.code as string | undefined;
      let msg = 'Unable to create account. Please try again.';
      if (code === 'auth/network-request-failed')  msg = 'Network error — check your connection.';
      else if (code === 'auth/email-already-in-use') msg = 'This email is already in use.';
      else if (err?.message) msg = err.message.replace('Firebase: ', '');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.outer}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🍀</Text>
        </View>
        <Text style={styles.brand}>Q-LESS</Text>
        <Text style={styles.tagline}>Join Olive's smart queue system</Text>
        <View style={styles.mascotRow}>
          <View style={[styles.bubble, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Text style={styles.bubbleEmoji}>👾</Text></View>
          <View style={[styles.bubble, styles.bubbleMid, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Text style={[styles.bubbleEmoji, { fontSize: 22 }]}>🌿</Text></View>
          <View style={[styles.bubble, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Text style={styles.bubbleEmoji}>🐣</Text></View>
        </View>
      </View>

      {/* Form card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Account</Text>
        <Text style={styles.cardSub}>It's free and takes 30 seconds</Text>

        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your full name"
            value={name}
            onChangeText={setName}
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.btnText}>Create Account →</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
          style={styles.loginLink}
        >
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outer:      { flex: 1, backgroundColor: COLORS.primary },
  content:    { flexGrow: 1 },

  hero:       { alignItems: 'center', paddingTop: 56, paddingBottom: 32, paddingHorizontal: 24 },
  logoWrap:   { width: 76, height: 76, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoEmoji:  { fontSize: 38 },
  brand:      { fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: 3, marginBottom: 6 },
  tagline:    { fontSize: FONT.sm, color: 'rgba(255,255,255,0.75)', marginBottom: 20 },
  mascotRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bubble:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bubbleMid:  { width: 56, height: 56, borderRadius: 28 },
  bubbleEmoji:{ fontSize: 20 },

  card:       { backgroundColor: COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, flex: 1, ...SHADOW.lg },
  cardTitle:  { fontSize: FONT.xxl, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 4 },
  cardSub:    { fontSize: FONT.sm, color: COLORS.textSecondary, marginBottom: 24 },

  inputWrap:  { marginBottom: 14 },
  inputLabel: { fontSize: FONT.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 13, fontSize: FONT.md, color: COLORS.textPrimary },

  errorText:  { color: COLORS.error, fontSize: FONT.sm, textAlign: 'center', marginBottom: 12, fontWeight: '600' },

  btn:        { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 17, alignItems: 'center', marginTop: 8, ...SHADOW.md },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.lg },

  loginLink:     { alignItems: 'center', marginTop: 20 },
  loginLinkText: { fontSize: FONT.sm, color: COLORS.textSecondary },
});