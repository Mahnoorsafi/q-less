import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyA2CG6HX1bgDVr5cU6fYPlEZyZoBy457rM',
  authDomain: 'queue-management-28198.firebaseapp.com',
  projectId: 'queue-management-28198',
  storageBucket: 'queue-management-28198.firebasestorage.app',
  messagingSenderId: '373591312942',
  appId: '1:373591312942:android:f2def75891abbc0c4d6dbf',
};

const app = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// Web uses browser localStorage; native uses AsyncStorage so sessions persist across app restarts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = Platform.OS !== 'web' ? require('@react-native-async-storage/async-storage').default : null;

export const auth = initializeAuth(app, {
  persistence: Platform.OS === 'web'
    ? browserLocalPersistence
    : getReactNativePersistence(AsyncStorage),
});
