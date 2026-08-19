import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User, signInWithPopup, signOut, onIdTokenChanged } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { disconnectMeetSocket } from '../lib/meetSocket';
import { requiresPersonnelFeatureLogin, isFeatureAccessAuthenticated } from '../util/orgLoginAccess';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  orgReady: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MEET_ORG_READY_KEY = 'meetOrgReady';

const readStoredCredentials = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('userCredentials') || localStorage.getItem('userCredentials');
};

export const readOrgReady = () => {
  if (typeof window === 'undefined') return false;
  const creds = readStoredCredentials();
  if (sessionStorage.getItem('userAuth') !== 'true' || !creds) return false;
  if (sessionStorage.getItem(MEET_ORG_READY_KEY) === 'true') return true;
  const userType = sessionStorage.getItem('userType');
  if (!requiresPersonnelFeatureLogin(undefined, userType)) return true;
  return isFeatureAccessAuthenticated();
};

export const markMeetOrgReady = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(MEET_ORG_READY_KEY, 'true');
  window.dispatchEvent(new Event('sigstream-org-auth'));
};

const clearOrgSession = () => {
  sessionStorage.removeItem('userAuth');
  sessionStorage.removeItem('userType');
  sessionStorage.removeItem('userCredentials');
  sessionStorage.removeItem('googleAuth');
  sessionStorage.removeItem('googleUser');
  sessionStorage.removeItem('featureAccessAuth');
  sessionStorage.removeItem('featureAccessUser');
  sessionStorage.removeItem(MEET_ORG_READY_KEY);
  localStorage.removeItem('userCredentials');
  localStorage.removeItem('organizationDocId');
  localStorage.removeItem('organizationConfig');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgReady, setOrgReady] = useState(() => readOrgReady());

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;

    const settle = (nextUser: User | null) => {
      if (cancelled) return;
      setUser(nextUser);
      setLoading(false);
    };

    const timeout = window.setTimeout(() => {
      settle(auth.currentUser);
    }, 4000);

    const start = async () => {
      try {
        await auth.authStateReady();
      } catch {
        /* IndexedDB restore can hang behind blockers; timeout covers it. */
      }
      if (cancelled) return;
      window.clearTimeout(timeout);
      settle(auth.currentUser);

      unsub = onIdTokenChanged(auth, (nextUser) => {
        if (cancelled) return;
        if (!nextUser) {
          if (auth.currentUser) {
            setUser(auth.currentUser);
            return;
          }
          setUser(null);
          return;
        }
        setUser(nextUser);
      });
    };

    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsub();
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      if (readOrgReady()) setOrgReady(true);
    };
    window.addEventListener('sigstream-org-auth', sync);
    window.addEventListener('feature-access-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sigstream-org-auth', sync);
      window.removeEventListener('feature-access-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const logout = useCallback(async () => {
    clearOrgSession();
    setOrgReady(false);
    disconnectMeetSocket();
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user, loading, orgReady, loginWithGoogle, logout }),
    [user, loading, orgReady, loginWithGoogle, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      loading: true,
      orgReady: false,
      loginWithGoogle: async () => undefined,
      logout: async () => undefined,
    };
  }
  return context;
};
