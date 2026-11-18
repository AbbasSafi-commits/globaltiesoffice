import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';

export type ModuleKey =
  | 'clients'
  | 'business_details'
  | 'portal_logins'
  | 'ledger'
  | 'documents'
  | 'browse';

export type ActionKey = 'view' | 'add' | 'edit' | 'delete';

export interface ModulePermissions {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

export type PermissionsMap = Partial<Record<ModuleKey, Partial<ModulePermissions>>>;

export interface StaffProfile {
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'staff' | string;
  isActive: boolean;
  permissions?: PermissionsMap;
  createdAt?: unknown;
}

interface AuthContextValue {
  user: User | null;
  profile: StaffProfile | null;
  permissions: PermissionsMap;
  isSuperAdmin: boolean;
  can: (module: ModuleKey, action: ActionKey) => boolean;
  loading: boolean;
  signingIn: boolean;
  accessDenied: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

// The sole email authorized to auto-provision the initial super_admin profile.
const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'dailyaura76@gmail.com';

const DEFAULT_SUPER_ADMIN_PERMISSIONS: Record<ModuleKey, ModulePermissions> = {
  clients: { view: true, add: true, edit: true, delete: true },
  business_details: { view: true, add: true, edit: true, delete: true },
  portal_logins: { view: true, add: true, edit: true, delete: true },
  ledger: { view: true, add: true, edit: true, delete: true },
  documents: { view: true, add: true, edit: true, delete: true },
  browse: { view: true, add: false, edit: false, delete: false },
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides Firebase authentication state, Firestore staff profile loading,
 * and module-level permission checks throughout the application.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setAccessDenied(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setAuthError(null);
      setUser(firebaseUser);

      const email = firebaseUser.email?.trim().toLowerCase() ?? '';
      if (!email) {
        setProfile(null);
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const profilePath = `profiles/${email}`;
      const profileRef = doc(db, 'profiles', email);

      try {
        let snapshot;
        try {
          snapshot = await getDoc(profileRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, profilePath);
        }

        if (!isMounted) return;

        // First Super Admin auto-creation if the document does not exist yet
        if (!snapshot.exists() && email === BOOTSTRAP_SUPER_ADMIN_EMAIL) {
          const derivedName = (firebaseUser.displayName || 'Super Admin').trim().slice(0, 120);
          const bootstrapProfile: StaffProfile = {
            email: BOOTSTRAP_SUPER_ADMIN_EMAIL,
            fullName: derivedName || 'Super Admin',
            role: 'super_admin',
            isActive: true,
            permissions: DEFAULT_SUPER_ADMIN_PERMISSIONS,
            createdAt: serverTimestamp(),
          };

          try {
            await setDoc(profileRef, bootstrapProfile);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, profilePath);
          }

          if (!isMounted) return;
          setProfile(bootstrapProfile);
          setAccessDenied(false);
          setLoading(false);
          return;
        }

        // Deny access if profile does not exist or has been deactivated
        if (!snapshot.exists()) {
          setProfile(null);
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        const loadedProfile = snapshot.data() as StaffProfile;
        if (loadedProfile.isActive !== true) {
          setProfile(loadedProfile);
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setProfile(loadedProfile);
        setAccessDenied(false);
      } catch (err) {
        console.error('Failed to verify staff profile:', err);
        if (!isMounted) return;
        setProfile(null);
        setAccessDenied(false);
        setAuthError(
          'Unable to verify your office profile right now. Please check your connection and try again.'
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups and try again.');
      } else {
        setAuthError('Sign-in could not be completed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      setAccessDenied(false);
    } catch (err) {
      console.error('Sign out failed:', err);
      setAuthError('Failed to sign out. Please refresh and try again.');
    }
  }, []);

  const isSuperAdmin = profile?.role === 'super_admin';
  const permissions: PermissionsMap = useMemo(() => profile?.permissions ?? {}, [profile]);

  const can = useCallback(
    (module: ModuleKey, action: ActionKey): boolean => {
      if (isSuperAdmin) return true;
      const modulePerms = permissions?.[module];
      if (!modulePerms) return false;
      return Boolean(modulePerms[action]);
    },
    [isSuperAdmin, permissions]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      permissions,
      isSuperAdmin,
      can,
      loading,
      signingIn,
      accessDenied,
      authError,
      clearAuthError,
      signInWithGoogle,
      signOut,
    }),
    [
      user,
      profile,
      permissions,
      isSuperAdmin,
      can,
      loading,
      signingIn,
      accessDenied,
      authError,
      clearAuthError,
      signInWithGoogle,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook for consuming AuthContext inside components and pages.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
