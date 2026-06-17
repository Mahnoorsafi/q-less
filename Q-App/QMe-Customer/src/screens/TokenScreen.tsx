import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { generateToken, Branch, Service, Token } from '../services/firebaseService';
import { getWaitTime, estimateWaitFallback } from '../services/aiService';

export default function TokenScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const branch: Branch    = route.params?.branch;
  const service: Service  = route.params?.service;
  const serviceType: string = route.params?.serviceType ?? 'Dine In';

  const [waitInfo, setWaitInfo] = useState<{ range: string; minutes: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<Token | null>(null);

  useEffect(() => {
    getWaitTime(branch.id, branch.queueLength, service.avgServiceTime, branch.staffCount)
      .then((r) => setWaitInfo({ range: r.wait_range, minutes: r.estimated_wait_minutes }))
      .catch(() => {
        const fb = estimateWaitFallback(branch.queueLength, service.avgServiceTime);
        setWaitInfo({ range: fb.wait_range, minutes: fb.estimated_wait_minutes });
      });
  }, [branch, service]);

  async function handleGenerateToken() {
    if (!user) {
      Alert.alert('Sign in required', 'Please log in to generate a token.');
      return;
    }
    setGenerating(true);
    try {
      const newToken = await generateToken({
        userId:               user.uid,
        userName:             user.name,
        branchId:             branch.id,
        branchName:           branch.name,
        serviceId:            service.id,
        serviceName:          service.name,
        serviceType,
        estimatedWaitMinutes: waitInfo?.minutes ?? 10,
      });
      setToken(newToken);
    } catch (err) {
      Alert.alert('Error', 'Could not generate token. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  if (token) {
    return (
      <View style={styles.container}>
        <AppHeader title="Q-LESS" subtitle="Token generated!" />
        <View style={styles.successCard}>
          <Text style={styles.successLabel}>Your token number</Text>
          <Text style={styles.tokenCode}>{token.tokenCode}</Text>
          <Text style={styles.tokenDetail}>{branch.name}</Text>
          <Text style={styles.tokenDetail}>{serviceType} · {service.name}</Text>
          <View style={styles.divider} />
          <Text style={styles.waitText}>Estimated wait: {waitInfo?.range ?? '...'}</Text>
          <Text style={styles.positionText}>Position in queue: {token.position}</Text>
        </View>
        <Text style={styles.note}>
          You will be notified when your turn is approaching. Stay nearby!
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('TokenStatus', { tokenId: token.id })}
        >
          <Text style={styles.primaryBtnText}>Track Queue Status</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        >
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Q-LESS" subtitle="Confirm & get token" showBack />

      <View style={styles.previewCard}>
        <Text style={styles.previewBranch}>{branch.name}</Text>
        <Text style={styles.previewService}>{serviceType} — {service.name}</Text>
        <Text style={styles.previewWait}>
          AI estimated wait: {waitInfo ? waitInfo.range : '...'}
        </Text>
        <Text style={styles.previewQueue}>{branch.queueLength} people ahead of you</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, generating && styles.disabledBtn]}
        onPress={handleGenerateToken}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Generate Token</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.scheduleLink}
        onPress={() => navigation.navigate('PreSchedule', { branch, service, serviceType })}
      >
        <Text style={styles.scheduleLinkText}>Or pre-schedule for later →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, padding: 24, backgroundColor: '#fff' },
  previewCard:     { borderRadius: 20, backgroundColor: '#eff6ff', padding: 24, marginBottom: 24 },
  previewBranch:   { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  previewService:  { fontSize: 15, color: '#475569', marginBottom: 12 },
  previewWait:     { fontSize: 16, fontWeight: '700', color: '#7c3aed' },
  previewQueue:    { fontSize: 14, color: '#64748b', marginTop: 6 },
  successCard:     { borderRadius: 20, backgroundColor: '#f0fdf4', padding: 24, alignItems: 'center', marginBottom: 20 },
  successLabel:    { fontSize: 14, color: '#15803d', fontWeight: '600', marginBottom: 8 },
  tokenCode:       { fontSize: 72, fontWeight: '900', color: '#0f766e', letterSpacing: 2 },
  tokenDetail:     { fontSize: 16, color: '#334155', marginTop: 6 },
  divider:         { height: 1, backgroundColor: '#d1fae5', width: '100%', marginVertical: 14 },
  waitText:        { fontSize: 16, fontWeight: '700', color: '#7c3aed' },
  positionText:    { fontSize: 14, color: '#475569', marginTop: 4 },
  note:            { textAlign: 'center', color: '#64748b', fontSize: 14, marginBottom: 20 },
  primaryBtn:      { paddingVertical: 16, borderRadius: 16, backgroundColor: '#2563eb', alignItems: 'center', marginBottom: 12 },
  primaryBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabledBtn:     { opacity: 0.6 },
  secondaryBtn:    { paddingVertical: 14, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center' },
  secondaryBtnText:{ color: '#334155', fontWeight: '600', fontSize: 15 },
  scheduleLink:    { alignItems: 'center', marginTop: 12 },
  scheduleLinkText:{ color: '#2563eb', fontWeight: '600', fontSize: 14 },
});