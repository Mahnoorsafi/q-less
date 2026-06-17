import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { services, Service } from '../utils/mockData';
import AppHeader from '../components/AppHeader';

export default function ServicesScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <AppHeader title="Q-LESS" subtitle="Select service after branch" />
      <Text style={styles.title}>Our Services</Text>
      <Text style={styles.subtitle}>First choose a branch on Home, then select your service type.</Text>
      <FlatList<Service>
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              (navigation.getParent?.() as any)?.navigate
                ? (navigation.getParent() as any).navigate('Menu', { service: item })
                : navigation.navigate('Menu', { service: item })
            }
          >
            <Text style={styles.serviceName}>{item.name}</Text>
            <Text style={styles.waitTime}>{item.waitTime} min approx</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('HomeTab')}>
        <Text style={styles.homeButtonText}>Choose branch first</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#eef2ff' },
  title: { fontSize: 28, fontWeight: '800', color: '#14532d', marginBottom: 6 },
  subtitle: { fontSize: 16, color: '#475569', marginBottom: 18 },
  list: { paddingBottom: 20 },
  card: { padding: 18, borderRadius: 20, backgroundColor: '#ffffff', marginBottom: 14, shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 12, elevation: 4 },
  serviceName: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  waitTime: { fontSize: 14, color: '#64748b' },
  homeButton: { marginTop: 16, backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  homeButtonText: { color: '#fff', fontWeight: '700' },
});
