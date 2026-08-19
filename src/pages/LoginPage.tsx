import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, User, Map as MapIcon, ChevronRight, AlertCircle, Check, Loader2, Sun, Moon, KeyRound } from 'lucide-react';
import SplashScreen from '../components/SplashScreen';
import { useTheme } from '../context/ThemeContext';
import { markMeetOrgReady, useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { CONFIG_COLLECTION, FEATURE_ACCESS_LOGIN_COLLECTION, TEAMS_COLLECTION } from '../config/collections';
import type { ConfigLevel, ParsedConfig } from '../types/org';
import {
  DEFAULT_ORG_LOGIN_ACCESS,
  extractLoginAccess,
  isFeatureAccessAuthenticated,
  persistOrgLoginAccess,
  requiresPersonnelFeatureLogin,
  type OrgLoginAccess,
} from '../util/orgLoginAccess';

const inputBase =
  'block w-full rounded-xl border bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all text-sm font-medium';

const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ml-0.5';

interface GoogleUserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

interface OrgTeam {
  id: string;
  name: string;
  level: number;
  password: string;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="rounded-xl border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-950/40 px-3.5 py-3 flex items-start gap-2.5"
    >
      <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
      <p className="text-red-700 dark:text-red-200 text-sm leading-snug">{message}</p>
    </motion.div>
  );
}

function StepProgress({ step, labels }: { step: 1 | 2 | 3; labels: string[] }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {labels.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          const active = step === stepNum;
          const done = step > stepNum;
          return (
            <div key={label} className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  active
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-4 ring-sky-500/15'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : stepNum}
              </div>
              <span
                className={`hidden sm:inline truncate text-[11px] sm:text-xs font-medium ${
                  active ? 'text-slate-900 dark:text-white' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
              {i < labels.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full mx-0.5 sm:mx-1 ${done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400 sm:hidden">
        Step {step} of {labels.length}: {labels[step - 1]}
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const LoginPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading, loginWithGoogle, orgReady } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState('');
  const [adminLevel, setAdminLevel] = useState('');
  const [loginType, setLoginType] = useState('admin');
  const [team, setTeam] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUserData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [loginStep, setLoginStep] = useState<1 | 2 | 3>(1);
  const [featureUsername, setFeatureUsername] = useState('');
  const [featurePassword, setFeaturePassword] = useState('');
  const [showFeaturePassword, setShowFeaturePassword] = useState(false);
  const [orgDocId, setOrgDocId] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('organizationDocId') : null
  );
  const [orgLoginAccess, setOrgLoginAccess] = useState<OrgLoginAccess>(DEFAULT_ORG_LOGIN_ACCESS);
  const [orgLevels, setOrgLevels] = useState<ConfigLevel[] | null>(null);
  const [orgChecking, setOrgChecking] = useState(false);
  const [orgExists, setOrgExists] = useState<boolean | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [teams, setTeams] = useState<OrgTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current || showSplash || authLoading) return;
    if (user && orgReady) {
      redirectedRef.current = true;
      navigate('/meet', { replace: true });
    }
  }, [authLoading, showSplash, user, orgReady, navigate]);

  const finishLogin = () => {
    markMeetOrgReady();
    setShowSplash(true);
    window.setTimeout(() => navigate('/meet', { replace: true }), 800);
  };

  const persistMeetCredentials = (creds: Record<string, unknown>) => {
    const raw = JSON.stringify(creds);
    sessionStorage.setItem('userCredentials', raw);
    localStorage.setItem('userCredentials', raw);
  };

  const syncLoginStepFromSession = useCallback(() => {
    const googleAuth = sessionStorage.getItem('googleAuth') === 'true' || !!user;
    const userAuth = sessionStorage.getItem('userAuth') === 'true';
    const featureAuth = isFeatureAccessAuthenticated();

    if (!googleAuth) {
      setLoginStep(1);
      setGoogleUser(null);
      return;
    }

    try {
      const stored = sessionStorage.getItem('googleUser');
      if (stored) {
        setGoogleUser(JSON.parse(stored) as GoogleUserData);
      } else if (user) {
        setGoogleUser({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
        });
      }
    } catch {
      setGoogleUser(null);
    }

    const personnelRequired = requiresPersonnelFeatureLogin(undefined, sessionStorage.getItem('userType'));
    if (googleAuth && userAuth && !featureAuth && personnelRequired) setLoginStep(3);
    else setLoginStep(2);
  }, [user]);

  useEffect(() => {
    syncLoginStepFromSession();
  }, [syncLoginStepFromSession]);

  const checkOrganizationInConfig = useCallback(async (orgInput?: string) => {
    const org = (orgInput ?? organization).trim();
    if (!org) {
      setOrgLevels(null);
      setOrgDocId(null);
      setOrgLoginAccess(DEFAULT_ORG_LOGIN_ACCESS);
      setTeams([]);
      localStorage.removeItem('organizationDocId');
      localStorage.removeItem('organizationConfig');
      setOrgExists(null);
      setOrgError(null);
      setOrgChecking(false);
      return;
    }

    setOrgChecking(true);
    setOrgError(null);

    try {
      const snap = await getDocs(query(collection(db, CONFIG_COLLECTION), where('name', '==', org)));
      if (snap.empty) {
        setOrgLevels(null);
        setOrgDocId(null);
        setOrgLoginAccess(DEFAULT_ORG_LOGIN_ACCESS);
        setTeams([]);
        localStorage.removeItem('organizationDocId');
        localStorage.removeItem('organizationConfig');
        setOrgExists(false);
        setOrgError('Organization does not exist');
        return;
      }

      const docSnap = snap.docs[0];
      const data = docSnap.data() as Record<string, unknown>;
      let levels: ConfigLevel[] | null = null;
      let configStringToPersist: string | null = null;
      if (typeof data.config === 'string') {
        configStringToPersist = data.config;
        try {
          const parsed = JSON.parse(data.config) as ParsedConfig;
          levels = Array.isArray(parsed?.Levels) ? parsed.Levels : null;
        } catch {
          levels = null;
        }
      } else if (Array.isArray(data.Levels)) {
        levels = data.Levels as ConfigLevel[];
        configStringToPersist = JSON.stringify({ Levels: levels });
      }

      const loginAccess = extractLoginAccess(data);
      setOrgDocId(docSnap.id);
      setOrgLoginAccess(loginAccess);
      persistOrgLoginAccess(loginAccess);
      localStorage.setItem('organizationDocId', docSnap.id);
      if (configStringToPersist !== null) localStorage.setItem('organizationConfig', configStringToPersist);
      else localStorage.removeItem('organizationConfig');

      setTeamsLoading(true);
      const orgRef = doc(db, CONFIG_COLLECTION, docSnap.id);
      const teamSnap = await getDocs(query(collection(db, TEAMS_COLLECTION), where('organisations', '==', orgRef)));
      setTeams(teamSnap.docs.map((d) => {
        const t = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(t.name || 'Team'),
          level: typeof t.level === 'number' ? t.level : Number(t.level) || 0,
          password: typeof t.password === 'string' ? t.password : '',
        };
      }));
      setTeamsLoading(false);

      if (levels && levels.length) {
        setOrgLevels(levels);
        setOrgExists(true);
        setOrgError(null);
      } else {
        setOrgLevels(null);
        setOrgExists(false);
        setOrgError('Organization does not exist');
      }
    } catch (err) {
      console.error('Error querying staging-config:', err);
      setOrgLevels(null);
      setOrgDocId(null);
      setOrgLoginAccess(DEFAULT_ORG_LOGIN_ACCESS);
      setTeams([]);
      localStorage.removeItem('organizationDocId');
      localStorage.removeItem('organizationConfig');
      setOrgExists(false);
      setOrgError('Failed to verify organization');
    } finally {
      setOrgChecking(false);
    }
  }, [organization]);

  useEffect(() => {
    const org = organization.trim();
    if (!org) {
      setOrgChecking(false);
      setOrgExists(null);
      setOrgError(null);
      return;
    }
    setOrgChecking(true);
    const timer = setTimeout(() => {
      void checkOrganizationInConfig(org);
    }, 400);
    return () => clearTimeout(timer);
  }, [organization, checkOrganizationInConfig]);

  useEffect(() => {
    setTeam('');
  }, [adminLevel]);

  const teamsForLevel = useMemo(
    () => teams.filter((t) => String(t.level) === adminLevel),
    [teams, adminLevel]
  );

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      const current = user;
      const authUser = current;
      const userData: GoogleUserData = {
        uid: authUser?.uid || '',
        email: authUser?.email || '',
        displayName: authUser?.displayName || '',
        photoURL: authUser?.photoURL || '',
      };
      sessionStorage.setItem('googleAuth', 'true');
      setLoginStep(2);
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      if (err && typeof err === 'object' && 'message' in err) {
        setError(`Google sign-in failed: ${(err as { message: string }).message}`);
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const userData: GoogleUserData = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
    };
    setGoogleUser(userData);
    sessionStorage.setItem('googleUser', JSON.stringify(userData));
    sessionStorage.setItem('googleAuth', 'true');
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (loginType === 'admin') {
        if (!(organization.trim() && adminLevel.trim() && password.trim())) {
          setError('Please fill in organization, admin level, and password');
          return;
        }
        if (!orgLevels || orgLevels.length === 0) {
          setError('Organization not found or contains no admin levels');
          return;
        }
        const selectedLevel = orgLevels.find((lvl) => String(lvl.id) === adminLevel);
        if (!selectedLevel) {
          setError('Please select a valid admin level');
          return;
        }
        if (password !== selectedLevel.password) {
          setError('Invalid login details');
          return;
        }
        sessionStorage.setItem('userAuth', 'true');
        sessionStorage.setItem('userType', loginType);
        persistMeetCredentials({
          organization: organization.trim(),
          organizationDocId: orgDocId || localStorage.getItem('organizationDocId') || undefined,
          adminLevel: adminLevel.trim(),
          adminLevelName: selectedLevel.name,
          loginType,
          userType: loginType,
          team: null,
          loginAccess: orgLoginAccess,
          loginTime: new Date().toISOString(),
        });
        persistOrgLoginAccess(orgLoginAccess);
        finishLogin();
      } else {
        if (!(organization.trim() && adminLevel.trim() && team.trim() && password.trim())) {
          setError('Please fill in organization, admin level, team, and password');
          return;
        }
        if (teamsLoading) {
          setError('Teams are still loading. Please wait a moment and try again.');
          return;
        }
        const candidateTeam = teamsForLevel.find((t) => t.id === team);
        if (!candidateTeam) {
          setError('Selected team not found');
          return;
        }
        if (!candidateTeam.password || password !== candidateTeam.password) {
          setError('Invalid login details');
          return;
        }
        sessionStorage.setItem('userAuth', 'true');
        sessionStorage.setItem('userType', 'team');
        persistMeetCredentials({
          organization: organization.trim(),
          organizationDocId: orgDocId || localStorage.getItem('organizationDocId') || undefined,
          adminLevel: adminLevel.trim(),
          loginType: 'team',
          userType: 'team',
          team: candidateTeam.id,
          teamName: candidateTeam.name,
          loginAccess: orgLoginAccess,
          loginTime: new Date().toISOString(),
        });
        persistOrgLoginAccess(orgLoginAccess);
        if (requiresPersonnelFeatureLogin(orgLoginAccess, 'team')) {
          setLoginStep(3);
        } else {
          finishLogin();
        }
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      if (err && typeof err === 'object' && 'message' in err) {
        setError(`Login failed: ${(err as { message: string }).message}`);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const docId = orgDocId || localStorage.getItem('organizationDocId');
      if (!docId) {
        setError('Organization not found. Complete organization login again.');
        return;
      }
      if (!featureUsername.trim() || !featurePassword.trim()) {
        setError('Please enter username and password.');
        return;
      }
      const snap = await getDocs(query(
        collection(db, FEATURE_ACCESS_LOGIN_COLLECTION),
        where('organizationDocId', '==', docId),
        where('username', '==', featureUsername.trim())
      ));
      if (snap.empty) {
        setError('Invalid feature access credentials.');
        return;
      }
      const record = snap.docs[0].data() as Record<string, unknown>;
      if (String(record.password ?? '') !== featurePassword) {
        setError('Invalid feature access credentials.');
        return;
      }
      sessionStorage.setItem('featureAccessAuth', 'true');
      sessionStorage.setItem('featureAccessUser', JSON.stringify({
        id: snap.docs[0].id,
        name: String(record.name ?? ''),
        username: String(record.username ?? ''),
        role: record.role === 'admin' ? 'admin' : 'user',
        organizationDocId: docId,
      }));
      try { window.dispatchEvent(new CustomEvent('feature-access-changed')); } catch {}
      finishLogin();
    } catch (err) {
      console.error('Feature access login error:', err);
      setError('Feature access login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Google', 'Organization', 'Feature Access'];
  const stepTitle =
    loginStep === 1 ? 'Welcome back' : loginStep === 2 ? 'Organization sign-in' : 'Feature access';
  const stepSubtitle =
    loginStep === 1
      ? 'Authenticate with Google to begin secure access.'
      : loginStep === 2
        ? 'Select your organization and team credentials to continue.'
        : 'Use your assigned account to unlock permitted modules.';

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full flex flex-col lg:flex-row overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans selection:bg-sky-500/25">
      <aside className="hidden lg:flex lg:w-[min(520px,44%)] xl:w-1/2 shrink-0 flex-col justify-between relative overflow-hidden border-r border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#64748b14_1px,transparent_1px),linear-gradient(to_bottom,#64748b14_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 p-10 xl:p-14 flex flex-col gap-10 overflow-y-auto overscroll-contain">
          <div className="flex items-center gap-3">
            <img src="/images/SIGTRACK.png" alt="SigTrack" className="w-14 h-14 object-contain" />
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">SigtrackWEB</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Command &amp; control platform</p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold text-slate-900 dark:text-white leading-[1.08]">
              Operational{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-600 dark:from-sky-400 dark:to-indigo-400">
                intelligence
              </span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed border-l-2 border-sky-500/40 pl-4">
              Real-time tracking, secure communications, and situational awareness for modern security operations.
            </p>
          </div>
        </div>

        <div className="relative z-10 p-10 xl:p-14 grid grid-cols-2 gap-6 border-t border-slate-200/60 dark:border-slate-800/80">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur px-4 py-3">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">99.9%</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mt-0.5">System uptime</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur px-4 py-3">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">256-bit</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mt-0.5">Encryption</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-2">
          <div className="lg:hidden flex items-center gap-2 min-w-0">
            <img src="/images/SIGTRACK.png" alt="" className="w-9 h-9 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">SigtrackWEB</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{stepTitle}</p>
            </div>
          </div>
          <div className="hidden lg:block" />
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
          <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-4">
            <div className="w-full max-w-[440px] my-auto">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/50 shadow-xl shadow-slate-200/40 dark:shadow-black/20 backdrop-blur-sm p-5 sm:p-7 space-y-5 sm:space-y-6">
                <div className="space-y-1.5 text-center sm:text-left">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stepTitle}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{stepSubtitle}</p>
                </div>

                <StepProgress step={loginStep} labels={stepLabels} />

                <AnimatePresence mode="wait">
                  {loginStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-5"
                    >
                      {error && <ErrorBanner message={error} />}
                      <button
                        type="button"
                        onClick={() => void handleGoogleSignIn()}
                        disabled={loading}
                        className="group w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-semibold text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all disabled:opacity-60 disabled:pointer-events-none"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : <GoogleMark />}
                        <span>Continue with Google</span>
                      </button>
                      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">Secured by Firebase Authentication</p>
                    </motion.div>
                  )}

                  {loginStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
                        {googleUser?.photoURL ? (
                          <img src={googleUser.photoURL} alt="" className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-600 shadow-sm shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{googleUser?.displayName || 'Signed in'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{googleUser?.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setGoogleUser(null);
                            setLoginStep(1);
                            sessionStorage.removeItem('googleAuth');
                            sessionStorage.removeItem('googleUser');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shrink-0"
                        >
                          Switch
                        </button>
                      </div>

                      {error && <ErrorBanner message={error} />}

                      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                        <div className="space-y-1.5">
                          <label htmlFor="org-name" className={labelClass}>Organization</label>
                          <div className="relative">
                            <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                              id="org-name"
                              name="organization"
                              type="text"
                              required
                              value={organization}
                              onChange={(e) => setOrganization(e.target.value)}
                              onBlur={() => void checkOrganizationInConfig()}
                              className={`${inputBase} pl-10 pr-10 py-3 ${
                                orgError
                                  ? 'border-red-300 dark:border-red-500/50'
                                  : orgExists
                                    ? 'border-emerald-300 dark:border-emerald-500/40'
                                    : 'border-slate-200 dark:border-slate-700'
                              }`}
                              placeholder="Organization name"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              {orgChecking ? (
                                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                              ) : orgExists ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : orgError ? (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              ) : null}
                            </div>
                          </div>
                          {orgError && <p className="text-xs text-red-500 dark:text-red-400">{orgError}</p>}
                        </div>

                        {orgExists && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5">
                            <label htmlFor="org-level" className={labelClass}>Access level</label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <select
                                id="org-level"
                                name="adminLevel"
                                required
                                value={adminLevel}
                                onChange={(e) => setAdminLevel(e.target.value)}
                                className={`${inputBase} pl-10 pr-10 py-3 appearance-none border-slate-200 dark:border-slate-700`}
                              >
                                <option value="">Select level</option>
                                {orgLevels?.map((lvl) => (
                                  <option key={lvl.id} value={String(lvl.id)}>
                                    {lvl.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                            </div>
                          </motion.div>
                        )}

                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                          {(['admin', 'team'] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setLoginType(type)}
                              className={`py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                                loginType === type
                                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                              }`}
                            >
                              {type === 'admin' ? 'Admin' : 'Team'}
                            </button>
                          ))}
                        </div>

                        {loginType === 'team' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5">
                            <label htmlFor="org-team" className={labelClass}>Field team</label>
                            <div className="relative">
                              <MapIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <select
                                id="org-team"
                                name="team"
                                required
                                value={team}
                                onChange={(e) => setTeam(e.target.value)}
                                className={`${inputBase} pl-10 pr-10 py-3 appearance-none border-slate-200 dark:border-slate-700`}
                              >
                                <option value="">Select team</option>
                                {teamsLoading && <option disabled>Loading...</option>}
                                {teamsForLevel.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                            </div>
                          </motion.div>
                        )}

                        <div className="space-y-1.5">
                          <label htmlFor="org-passcode" className={labelClass}>Passcode</label>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                              id="org-passcode"
                              name="password"
                              type={showPassword ? 'text' : 'password'}
                              required
                              autoComplete="current-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`${inputBase} pl-10 pr-11 py-3 border-slate-200 dark:border-slate-700`}
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              )}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-sky-600/25 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 transition-all"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Authenticating...
                            </>
                          ) : (
                            <>
                              Continue
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {loginStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      {error && <ErrorBanner message={error} />}
                      <form onSubmit={(e) => void handleFeatureAccessSubmit(e)} className="space-y-4">
                        <div className="space-y-1.5">
                          <label htmlFor="feature-username" className={labelClass}>Username</label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                              id="feature-username"
                              name="username"
                              type="text"
                              required
                              value={featureUsername}
                              onChange={(e) => setFeatureUsername(e.target.value)}
                              autoComplete="username"
                              className={`${inputBase} pl-10 py-3 border-slate-200 dark:border-slate-700`}
                              placeholder="Feature access username"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="feature-password" className={labelClass}>Password</label>
                          <div className="relative">
                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                              id="feature-password"
                              name="featurePassword"
                              type={showFeaturePassword ? 'text' : 'password'}
                              required
                              value={featurePassword}
                              onChange={(e) => setFeaturePassword(e.target.value)}
                              autoComplete="current-password"
                              className={`${inputBase} pl-10 pr-11 py-3 border-slate-200 dark:border-slate-700`}
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowFeaturePassword(!showFeaturePassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                              aria-label={showFeaturePassword ? 'Hide password' : 'Show password'}
                            >
                              {showFeaturePassword ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              sessionStorage.removeItem('userAuth');
                              sessionStorage.removeItem('userCredentials');
                              setLoginStep(2);
                              setError(null);
                            }}
                            className="sm:w-auto w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            Back
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-sky-600/25 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              <>
                                Enter dashboard
                                <ChevronRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SplashScreen visible={showSplash} />
    </div>
  );
};

export default LoginPage;
