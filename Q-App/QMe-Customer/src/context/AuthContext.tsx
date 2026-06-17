import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

type AppUser = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
};

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: { name?: string; phone?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapFirebaseUser(fbUser: User | null): AppUser | null {
  if (!fbUser) return null;
  return {
    uid: fbUser.uid,
    email: fbUser.email ?? '',
    name: fbUser.displayName ?? 'Customer',
  };
}

async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return null;
    const data = userDoc.data();
    return {
      uid,
      name: (data?.name as string) || 'Customer',
      email: (data?.email as string) || '',
      phone: (data?.phone as string) || undefined,
    };
  } catch (err) {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      async function handleUser() {
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        const profile = await fetchUserProfile(fbUser.uid);
        setUser(profile ?? mapFirebaseUser(fbUser));
        setLoading(false);
      }

      handleUser();
    });

    return unsub;
  }, []);

  const signUp = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const uid = cred.user.uid;

    await setDoc(doc(db, 'users', uid), {
      uid,
      name,
      email,
      createdAt: serverTimestamp(),
    });

    setUser({ uid, name, email });
  };

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchUserProfile(cred.user.uid);
    setUser(profile ?? { uid: cred.user.uid, email, name: cred.user.displayName || 'Customer' });
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setUser(null);
  };

  const updateUserProfile = async (updates: { name?: string; phone?: string }) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
    if (updates.name && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: updates.name });
    }
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, updateUserProfile }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

