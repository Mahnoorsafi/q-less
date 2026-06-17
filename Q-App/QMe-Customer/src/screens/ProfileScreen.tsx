import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Image,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import { saveUserAvatar, loadUserAvatar } from '../services/firebaseService';
import { COLORS, RADIUS, SHADOW, FONT } from '../constants/theme';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, signOut, updateUserProfile } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editName, setEditName]   = useState('');
  const [editPhone, setEditPhone] = useState('');
  const phoneRef = useRef<TextInput>(null);

  // Load persisted avatar from Firestore on mount
  useEffect(() => {
    if (!user) return;
    loadUserAvatar(user.uid).then(uri => { if (uri) setAvatarUri(uri); });
  }, [user?.uid]);

  // Navigate to Login when signed out
  useEffect(() => {
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [user]);

  function openEdit() {
    setEditName(user?.name ?? '');
    setEditPhone(user?.phone ?? '');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    const name  = editName.trim();
    const phone = editPhone.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({ name, phone: phone || undefined });
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  async function persistAvatar(dataUri: string | null) {
    setAvatarUri(dataUri);
    if (user) await saveUserAvatar(user.uid, dataUri).catch(() => {});
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const b64 = result.assets[0].base64;
      const uri = b64 ? `data:image/jpeg;base64,${b64}` : result.assets[0].uri;
      await persistAvatar(uri);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const b64 = result.assets[0].base64;
      const uri = b64 ? `data:image/jpeg;base64,${b64}` : result.assets[0].uri;
      await persistAvatar(uri);
    }
  }

  function handleAvatarPress() {
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Choose from Library', onPress: handlePickImage },
      { text: 'Take Photo',           onPress: handleTakePhoto },
      avatarUri ? { text: 'Remove Photo', style: 'destructive', onPress: () => persistAvatar(null) } : null,
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean) as any);
  }

  function handleSignOut() {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        signOut().catch(() => {});
      }
      return;
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try { await signOut(); } catch { /* user state already cleared */ }
        },
      },
    ]);
  }

  const menuItems = [
    { emoji: '🔔', label: 'Notifications',  onPress: () => navigation.navigate('Notifications') },
    { emoji: '📋', label: 'My History',     onPress: () => navigation.navigate('HistoryTab') },
    { emoji: '⚙️', label: 'Settings',       onPress: () => navigation.navigate('Settings') },
    { emoji: '❓', label: 'Help & Support', onPress: () => {} },
    { emoji: '📄', label: 'About Q-Less',   onPress: () => navigation.navigate('About') },
  ];

  return (
    <View style={styles.outer}>
      <AppHeader title="Profile" showProfile={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handleAvatarPress} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{user?.name ?? 'Guest'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>🍀 Olive Member</Text>
          </View>
        </View>

        {/* Account info */}
        <View style={styles.infoSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Account Info</Text>
            {!editing && (
              <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <View style={styles.editCard}>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>👤  Full Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your full name"
                  placeholderTextColor={COLORS.textMuted}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
              </View>
              <View style={[styles.editField, { borderTopWidth: 1, borderTopColor: COLORS.separator }]}>
                <Text style={styles.editLabel}>📱  Phone</Text>
                <TextInput
                  ref={phoneRef}
                  style={styles.editInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="e.g. +92 300 1234567"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={saveEdit}
                />
              </View>
              <View style={[styles.editField, { borderTopWidth: 1, borderTopColor: COLORS.separator, paddingBottom: 4 }]}>
                <Text style={styles.editLabel}>✉️  Email</Text>
                <Text style={styles.editEmailNote}>{user?.email ?? '—'} · cannot be changed</Text>
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={saveEdit}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>Save Changes</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.infoCard}>
              <InfoRow icon="👤" label="Full Name" value={user?.name ?? '—'} />
              <InfoRow icon="✉️" label="Email"     value={user?.email ?? '—'} />
              <InfoRow icon="📱" label="Phone"     value={user?.phone || 'Not set'} last />
            </View>
          )}
        </View>

        {/* Quick links */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionLabel}>Quick Links</Text>
          <View style={styles.menuCard}>
            {menuItems.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuRow, idx === menuItems.length - 1 && styles.menuRowLast]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.menuEmoji}>{item.emoji}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.logoutText}>🚪 Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:        { flex: 1, backgroundColor: COLORS.background },
  content:      { padding: 16 },

  avatarCard:   { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 28, alignItems: 'center', marginBottom: 14, ...SHADOW.md },
  avatarWrap:   { position: 'relative', marginBottom: 14 },
  avatarImage:   { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)' },
  avatarCircle:  { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  avatarText:    { fontSize: 34, fontWeight: '900', color: COLORS.primary },
  editBadge:     { position: 'absolute', bottom: 0, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.primary },
  editBadgeText: { fontSize: 13 },

  userName:     { fontSize: FONT.xl, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  userEmail:    { fontSize: FONT.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  memberBadge:  { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 6 },
  memberBadgeText: { fontSize: FONT.sm, color: '#FFFFFF', fontWeight: '700' },

  infoSection:  { marginBottom: 14 },
  sectionLabel: { fontSize: FONT.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: 0.4 },

  infoCard:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.sm },
  infoRow:      { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.separator },
  infoRowLast:  { borderBottomWidth: 0 },
  infoIcon:     { fontSize: 20, marginRight: 14 },
  infoLabel:    { fontSize: FONT.xs, color: COLORS.textSecondary, marginBottom: 2 },
  infoValue:    { fontSize: FONT.md, fontWeight: '600', color: COLORS.textPrimary },

  menuCard:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.sm },
  menuRow:      { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.separator },
  menuRowLast:  { borderBottomWidth: 0 },
  menuEmoji:    { fontSize: 20, marginRight: 14 },
  menuLabel:    { flex: 1, fontSize: FONT.md, fontWeight: '600', color: COLORS.textPrimary },
  menuArrow:    { fontSize: 22, color: COLORS.textMuted, fontWeight: '300' },

  logoutBtn:    { backgroundColor: COLORS.errorBg, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 4, ...SHADOW.sm },
  logoutText:   { fontSize: FONT.lg, fontWeight: '700', color: COLORS.error },

  // ── Edit profile ──────────────────────────────────────────────────────────
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 4 },
  editBtn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText:    { fontSize: FONT.xs, fontWeight: '700', color: COLORS.primary },

  editCard:       { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.sm },
  editField:      { paddingHorizontal: 16, paddingVertical: 12 },
  editLabel:      { fontSize: FONT.xs, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 6 },
  editInput:      { fontSize: FONT.md, color: COLORS.textPrimary, fontWeight: '600', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.background, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border },
  editEmailNote:  { fontSize: FONT.sm, color: COLORS.textMuted, fontStyle: 'italic' },
  editActions:    { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.separator },
  saveBtn:        { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  saveBtnText:    { color: '#FFFFFF', fontWeight: '800', fontSize: FONT.sm },
  cancelBtn:      { paddingHorizontal: 18, paddingVertical: 13, borderRadius: RADIUS.lg, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText:  { color: COLORS.textSecondary, fontWeight: '700', fontSize: FONT.sm },
});