import React, { useState } from 'react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../services/firebase';

const G = {
  primary:    '#2D6A2E',
  primaryBg:  '#E8F5E9',
  bg:         '#F5F0E8',
  surface:    '#FFFFFF',
  text:       '#1A1A1A',
  muted:      '#6B7280',
  border:     '#E5E7EB',
  error:      '#DC2626',
  errorBg:    '#FEE2E2',
};

export default function LoginPage() {
  const [email, setEmail]       = useState('admin@olive.com');
  const [password, setPassword] = useState('Admin@Q123');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const code = err?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error — check your connection.');
      } else {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      const code = err?.code ?? '';
      if (code === 'auth/popup-closed-by-user') {
        setError('');
      } else if (code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized. Add it in Firebase Console → Auth → Settings → Authorized domains.');
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.leftPanel}>
        <div style={styles.logoWrap}>
          <span style={{ fontSize: 48 }}>🍀</span>
        </div>
        <h1 style={styles.brand}>Q-Less</h1>
        <p style={styles.brandSub}>Queue Smart, Live More.</p>
        <div style={styles.featureList}>
          {['Real-time queue management', 'Branch-specific analytics', 'ML-powered wait predictions', 'Customer notification system'].map((f) => (
            <div key={f} style={styles.featureItem}>
              <span style={styles.featureCheck}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
        {/* Mascot */}
        <div style={styles.mascotRow}>
          <div style={{ ...styles.mascotBubble, background: '#FFD6D6' }}>👾</div>
          <div style={{ ...styles.mascotBubble, background: '#D6F0D6', width: 56, height: 56, borderRadius: 28, fontSize: 26 }}>🌿</div>
          <div style={{ ...styles.mascotBubble, background: '#FFF0D6' }}>🐣</div>
        </div>
      </div>

      <div style={styles.rightPanel}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Admin Login</h2>
          <p style={styles.cardSub}>Olive Restaurant Management System</p>

          {/* Demo credentials notice */}
          <div style={styles.demoBox}>
            <p style={styles.demoLabel}>🔑 Demo Credentials</p>
            <div style={styles.demoRow}>
              <span style={styles.demoKey}>Email</span>
              <code style={styles.demoVal}>admin@olive.com</code>
            </div>
            <div style={styles.demoRow}>
              <span style={styles.demoKey}>Password</span>
              <code style={styles.demoVal}>Admin@Q123</code>
            </div>
          </div>

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email address</label>
              <input
                style={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@olive.com"
                required
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={styles.errorBox}>
                <span>⚠️ {error}</span>
              </div>
            )}

            <button
              style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: G.border }} />
            <span style={{ fontSize: 12, color: G.muted, fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: G.border }} />
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ width: '100%', padding: '11px 0', borderRadius: 12, background: '#fff', border: `1.5px solid ${G.border}`, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: G.text, opacity: loading ? 0.7 : 1 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p style={styles.footer}>
            Q-Less Admin Panel · Olive Restaurant Chain
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:         { display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  leftPanel:    { width: 400, background: G.primary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8 },
  logoWrap:     { width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brand:        { fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 2, margin: 0 },
  brandSub:     { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginBottom: 32 },
  featureList:  { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginBottom: 40 },
  featureItem:  { display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  featureCheck: { width: 22, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 },
  mascotRow:    { display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 8 },
  mascotBubble: { width: 46, height: 46, borderRadius: 23, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 },

  rightPanel:   { flex: 1, background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card:         { background: G.surface, borderRadius: 20, padding: 40, width: '100%', maxWidth: 440, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  cardTitle:    { fontSize: 26, fontWeight: 800, color: G.text, marginBottom: 4, textAlign: 'center' },
  cardSub:      { fontSize: 14, color: G.muted, textAlign: 'center', marginBottom: 24 },

  demoBox:      { background: G.primaryBg, borderRadius: 12, padding: 14, marginBottom: 20, border: `1.5px solid #A5D6A7` },
  demoLabel:    { fontSize: 13, fontWeight: 700, color: G.primary, marginBottom: 8, marginTop: 0 },
  demoRow:      { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  demoKey:      { fontSize: 12, fontWeight: 600, color: G.muted, width: 70 },
  demoVal:      { fontSize: 13, background: '#fff', padding: '2px 8px', borderRadius: 6, color: G.primary, fontWeight: 700, border: `1px solid #C8E6C9` },

  form:         { display: 'flex', flexDirection: 'column', gap: 16 },
  fieldGroup:   { display: 'flex', flexDirection: 'column', gap: 6 },
  label:        { fontSize: 13, fontWeight: 600, color: G.muted },
  input:        { border: `1.5px solid ${G.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 14, outline: 'none', color: G.text, background: '#fafaf9' },
  errorBox:     { background: G.errorBg, color: G.error, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600 },
  btn:          { marginTop: 4, padding: '13px 0', borderRadius: 12, background: G.primary, color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3 },
  footer:       { fontSize: 12, color: G.muted, textAlign: 'center', marginTop: 28, marginBottom: 0 },
};