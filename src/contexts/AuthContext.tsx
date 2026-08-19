import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, signInWithPopup, signOut, onIdTokenChanged } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { reconnectSocket, setSocketAuthToken } from './StreamContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  orgReady: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { requiresPersonnelFeatureLogin, isFeatureAccessAuthenticated } from '../util/orgLoginAccess';

const readOrgReady = () => {
  if (typeof window === 'undefined') return false;
  const userAuth = sessionStorage.getItem('userAuth') === 'true' && !!sessionStorage.getItem('userCredentials');
  if (!userAuth) return false;
  const userType = sessionStorage.getItem('userType');
  if (!requiresPersonnelFeatureLogin(undefined, userType)) return true;
  return isFeatureAccessAuthenticated();
};

const clearOrgSession = () => {
  sessionStorage.removeItem('userAuth');
  sessionStorage.removeItem('userType');
  sessionStorage.removeItem('userCredentials');
  sessionStorage.removeItem('googleAuth');
  sessionStorage.removeItem('googleUser');
  sessionStorage.removeItem('featureAccessAuth');
  sessionStorage.removeItem('featureAccessUser');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgReady, setOrgReady] = useState(readOrgReady);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);
      try {
        const token = nextUser ? await nextUser.getIdToken() : null;
        setSocketAuthToken(token);
      } catch {
        setSocketAuthToken(null);
      }
      reconnectSocket();
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sync = () => setOrgReady(readOrgReady());
    window.addEventListener('sigstream-org-auth', sync);
    window.addEventListener('feature-access-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sigstream-org-auth', sync);
      window.removeEventListener('feature-access-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    clearOrgSession();
    setOrgReady(false);
    await signOut(auth);
  };

  const value = useMemo(
    () => ({ user, loading, orgReady, loginWithGoogle, logout }),
    [user, loading, orgReady]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
