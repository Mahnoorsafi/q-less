import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useState } from 'react';
import AppHeader from '../components/AppHeader';
import { COLORS, RADIUS, FONT, SHADOW } from '../constants/theme';

export default function SettingsScreen() {
  const [notifyQueue,  setNotifyQueue]  = useState(true);
  const [notifyPromos, setNotifyPromos] = useState(false);
  const [darkMode,     setDarkMode]     = useState(false);

  const sections = [
    {
      title: 'Notifications',
      items: [
        { label: 'Queue updates',       sub: 'Get notified when your turn approaches', value: notifyQueue,  onToggle: setNotifyQueue },
        { label: 'Promos & offers',     sub: 'Receive special deals from Olive',       value: notifyPromos, onToggle: setNotifyPromos },
      ],
    },
    {
      title: 'Display',
      items: [
        { label: 'Dark mode',           sub: 'Use dark color scheme (coming soon)',     value: darkMode,     onToggle: setDarkMode },
      ],
    },
  ];

  const links = [
    { emoji: '🔒', label: 'Privacy Policy',     onPress: () => {} },
    { emoji: '📄', label: 'Terms of Service',   onPress: () => {} },
    { emoji: '❓', label: 'Help & Support',     onPress: () => {} },
    { emoji: '⭐', label: 'Rate the App',       onPress: () => {} },
  ];

  return (
    <View style={styles.outer}>
      <AppHeader subtitle="Settings" showBack showProfile={false} />

      <View style={{ flex: 1, padding: 16 }}>
        {sections.map((sec) => (
          <View key={sec.title} style={styles.section}>
            <Text style={styles.sectionLabel}>{sec.title}</Text>
            <View style={styles.card}>
              {sec.items.map((item, idx) => (
                <View key={item.label} style={[styles.row, idx < sec.items.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowSub}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                    thumbColor={item.value ? COLORS.primary : COLORS.textMuted}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.card}>
            {links.map((link, idx) => (
              <TouchableOpacity
                key={link.label}
                style={[styles.linkRow, idx < links.length - 1 && styles.rowBorder]}
                onPress={link.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.linkEmoji}>{link.emoji}</Text>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.versionCard}>
          <Text style={styles.versionText}>🍀 Q-Less · Version 1.0.0</Text>
          <Text style={styles.versionSub}>Powered by Olive Restaurant Chain</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:        { flex: 1, backgroundColor: COLORS.background },

  section:      { marginBottom: 18 },
  sectionLabel: { fontSize: FONT.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:         { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.sm },

  row:          { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: COLORS.separator },
  rowLabel:     { fontSize: FONT.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  rowSub:       { fontSize: FONT.xs, color: COLORS.textSecondary },

  linkRow:      { flexDirection: 'row', alignItems: 'center', padding: 16 },
  linkEmoji:    { fontSize: 20, marginRight: 14 },
  linkLabel:    { flex: 1, fontSize: FONT.md, fontWeight: '600', color: COLORS.textPrimary },
  arrow:        { fontSize: 22, color: COLORS.textMuted },

  versionCard:  { alignItems: 'center', paddingVertical: 20 },
  versionText:  { fontSize: FONT.sm, fontWeight: '700', color: COLORS.textSecondary },
  versionSub:   { fontSize: FONT.xs, color: COLORS.textMuted, marginTop: 4 },
});