import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { fetchServices, Service, Branch } from '../services/firebaseService';

export default function ServiceSelectionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const branch: Branch = route.params?.branch;
  const serviceType: string = route.params?.serviceType ?? 'Dine In';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices(branch.id)
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [branch.id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Q-LESS" subtitle={branch.name} />
      <Text style={styles.title}>{serviceType} — select a service</Text>

      <FlatList<Service>
        data={services.filter((s) => s.isAvailable)}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No services available right now.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('Token', {
                branch,
                service: item,
                serviceType,
              })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceName}>{item.name}</Text>
              <Text style={styles.serviceDesc}>{item.description}</Text>
            </View>
            <View style={styles.timeBox}>
              <Text style={styles.timeNum}>{item.avgServiceTime}</Text>
              <Text style={styles.timeLabel}>min/person</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, padding: 16, backgroundColor: '#fff' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  card:        { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: '#f8fafc', marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  serviceName: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  serviceDesc: { fontSize: 13, color: '#64748b', marginTop: 4 },
  timeBox:     { alignItems: 'center', backgroundColor: '#ede9fe', borderRadius: 10, padding: 10 },
  timeNum:     { fontSize: 20, fontWeight: '800', color: '#7c3aed' },
  timeLabel:   { fontSize: 11, color: '#7c3aed', marginTop: 2 },
  empty:       { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 15 },
});