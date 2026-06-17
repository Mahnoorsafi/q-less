import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [adminProfile, setAdminProfile] = useState(undefined); // undefined = loading

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setAdminProfile(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'admins', fbUser.uid));
        if (snap.exists()) {
          setAdminProfile({ uid: fbUser.uid, email: fbUser.email, ...snap.data() });
        } else {
          // No admins doc → backward-compatible super admin (existing admin@olive.com)
          setAdminProfile({
            uid:      fbUser.uid,
            email:    fbUser.email,
            name:     fbUser.displayName || 'Super Admin',
            role:     'super_admin',
            branchId: null,
          });
        }
      } catch {
        setAdminProfile({
          uid:      fbUser.uid,
          email:    fbUser.email,
          name:     'Admin',
          role:     'super_admin',
          branchId: null,
        });
      }
    });
    return unsub;
  }, []);

  return (
    <AdminContext.Provider value={adminProfile}>
      {children}
    </AdminContext.Provider>
  );
}

/** Returns the admin profile object, or null if logged out, undefined if loading */
export function useAdmin() {
  return useContext(AdminContext);
}

export function isSuperAdmin(profile) {
  return profile?.role === 'super_admin' || !profile?.role;
}
