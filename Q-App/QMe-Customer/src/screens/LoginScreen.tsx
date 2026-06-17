import { useEffect, useState } from 'react';
import {
  ActivityIndicator, View, Text, TextInput,
  TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { subscribeToBranches } from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

try { WebBrowser.maybeCompleteAuthSession(); } catch {}

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { signIn } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [openCount, setOpenCount]       = useState(0);
  const [totalQueue, setTotalQueue]     = useState(0);

  // Live branch stats — anonymous read (no auth required)
  useEffect(() => {
    const unsub = subscribeToBranches((branches) => {
      const open = branches.filter((b) => b.isOpen);
      setOpenCount(open.length);
      setTotalQueue(branches.reduce((sum, b) => sum + (b.queueLength ?? 0), 0));
    });
    return unsub;
  }, []);

  // Google Sign In (native only)
  const GOOGLE_WEB_CLIENT_ID = '373591312942-i1b32j1n063n13qlga0udhogc6370ai0.apps.googleusercontent.com';
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'com.qless.customer' });
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId:     GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri,
  });


  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken =
        (googleResponse as any).authentication?.idToken ??
        googleResponse.params?.id_token;
      if (!idToken) { setError('Google sign-in failed — no token received.'); return; }
      setLoading(true);
      const credential = GoogleAuthProvider.credential(idToken);
      signInWithCredential(auth, credential)
        .then(async (cred) => {
          // Register Google user in users collection so broadcast-to-all includes them
          const { uid, displayName, email: gEmail } = cred.user;
          await setDoc(doc(db, 'users', uid), {
            uid,
            name:  displayName ?? 'Customer',
            email: gEmail ?? '',
            createdAt: serverTimestamp(),
          }, { merge: true });
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        })
        .catch(() => setError('Google sign-in failed. Please try again.'))
        .finally(() => setLoading(false));
    } else if (googleResponse?.type === 'error') {
      setError('Google sign-in failed. Please try again.');
    }
  }, [googleResponse]);

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address above first, then tap Forgot Password.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Email Sent', `A password reset link has been sent to ${email.trim()}. Check your inbox.`);
    } catch (err: any) {
      const code = err?.code as string | undefined;
      let msg = 'Could not send reset email.';
      if (code === 'auth/user-not-found') msg = 'No account found with this email address.';
      else if (code === 'auth/invalid-email') msg = 'Please enter a valid email address.';
      Alert.alert('Reset Failed', msg);
    } finally {
      setResetLoading(false);
    }
  }

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err: any) {
      const code = err?.code as string | undefined;
      let msg = 'Unable to sign in. Please check your credentials.';
      if (code === 'auth/network-request-failed') msg = 'Network error — check your connection.';
      else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') msg = 'Incorrect email or password.';
      else if (code === 'auth/user-not-found') msg = 'No account found with this email.';
      else if (err?.message) msg = err.message.replace('Firebase: ', '').replace(/\s*\(.*\)/, '');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Top mascot area */}
        <View style={styles.heroArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🍀</Text>
          </View>
          <Text style={styles.brand}>Q-LESS</Text>
          <Text style={styles.brandSub}>Queue Smart, Live More.</Text>

          {/* Live dashboard stats */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>3</Text>
              <Text style={styles.statLabel}>Branches</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{openCount}</Text>
              <Text style={styles.statLabel}>Open Now</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{totalQueue}</Text>
              <Text style={styles.statLabel}>In Queue</Text>
            </View>
          </View>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back!</Text>
          <Text style={styles.cardSub}>Sign in to skip the line</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Text style={styles.showPassText}>{showPass ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword} disabled={resetLoading}>
            <Text style={styles.forgotText}>
              {resetLoading ? 'Sending…' : 'Forgot Password?'}
            </Text>
          </TouchableOpacity>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, loading && styles.disabledBtn]}
            onPress={() => { googlePromptAsync(); }}
            disabled={loading}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupLink}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Signup' }] })}
          >
            <Text style={styles.signupLinkText}>
              New here? <Text style={styles.signupLinkBold}>Create an account →</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page:         { flex: 1, backgroundColor: COLORS.primary },
  scroll:       { flexGrow: 1 },

  heroArea:     { alignItems: 'center', paddingTop: 56, paddingBottom: 24 },
  logoCircle:   { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoEmoji:    { fontSize: 36 },
  brand:        { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  brandSub:     { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: 20 },

  statsRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.xl, paddingVertical: 14, paddingHorizontal: 24, gap: 0 },
  statChip:     { flex: 1, alignItems: 'center' },
  statNum:      { fontSize: FONT.xxl, fontWeight: '900', color: '#FFFFFF' },
  statLabel:    { fontSize: FONT.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },
  statDivider:  { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },

  card:         { backgroundColor: COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 40, flex: 1 },
  cardTitle:    { fontSize: FONT.xxl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  cardSub:      { fontSize: FONT.md, color: COLORS.textSecondary, marginBottom: 24 },

  inputWrap:    { marginBottom: 16 },
  inputLabel:   { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, borderWidth: 1.5, borderColor: COLORS.border },
  inputIcon:    { fontSize: 16, marginRight: 8 },
  input:        { flex: 1, height: 50, fontSize: FONT.md, color: COLORS.textPrimary },
  showPassText: { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },

  errorBox:     { backgroundColor: COLORS.errorBg, borderRadius: RADIUS.sm, padding: 12, marginBottom: 12 },
  errorText:    { color: COLORS.error, fontSize: FONT.sm, fontWeight: '600' },

  loginBtn:     { height: 54, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOW.md, marginBottom: 20 },
  loginBtnText: { color: '#FFFFFF', fontSize: FONT.lg, fontWeight: '800' },
  disabledBtn:  { opacity: 0.6 },

  dividerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText:  { fontSize: FONT.xs, color: COLORS.textMuted },

  googleBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: 24 },
  googleIcon:     { fontSize: 20, fontWeight: '900', color: '#DB4437' },
  googleBtnText:  { fontSize: FONT.md, fontWeight: '700', color: COLORS.textPrimary },

  forgotBtn:    { alignSelf: 'flex-end', marginBottom: 12, marginTop: -8 },
  forgotText:   { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },

  signupLink:   { alignItems: 'center' },
  signupLinkText:  { fontSize: FONT.md, color: COLORS.textSecondary },
  signupLinkBold:  { color: COLORS.primary, fontWeight: '700' },
});