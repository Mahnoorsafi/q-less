import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Same Firebase project as the customer app
export const firebaseConfig = {
  apiKey:            'AIzaSyA2CG6HX1bgDVr5cU6fYPlEZyZoBy457rM',
  authDomain:        'queue-management-28198.firebaseapp.com',
  projectId:         'queue-management-28198',
  storageBucket:     'queue-management-28198.firebasestorage.app',
  messagingSenderId: '373591312942',
  appId:             '1:373591312942:android:f2def75891abbc0c4d6dbf',
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);