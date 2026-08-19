
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, LogOut, Settings, HelpCircle, MessageSquare,
  Loader2, Shield, Zap, Users, Link2, Calendar, ArrowLeft, Trash2, ShieldCheck, Sun, Moon
} from 'lucide-react';
import { toast } from 'sonner';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useSigtrackContext } from '../hooks/useSigtrackContext';
import { useCountdown } from '../hooks/useCountdown';
import CreateMeetingModal from '../components/CreateMeetingModal';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal';
import MeetingHistoryDetail from '../components/MeetingHistoryDetail';
import MeetChatHistoryModal from '../components/MeetChatHistoryModal';
import MeetSettingsModal from '../components/MeetSettingsModal';
import { IS_STANDALONE } from '../config';
import { useTheme } from '../context/ThemeContext';
import type { MeetingDoc } from '../types/meeting.types';

/* ─── Live clock ──────────────────────────────────────────── */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const classifyMeeting = (m: MeetingDoc, now = Date.now()) => {
  if (m.status === 'ended' || m.isActive === false && m.status !== 'scheduled') return 'completed';
  if (m.status === 'scheduled' || (m.scheduledAt && m.scheduledAt > now && m.status !== 'active')) {
    return m.scheduledAt && m.scheduledAt - now < 15 * 60 * 1000 ? 'upcoming' : 'scheduled';
  }
  return 'active';
};

const meetingKindLabel = (kind: ReturnType<typeof classifyMeeting>) => {
  if (kind === 'active') return 'active meeting';
  if (kind === 'upcoming') return 'upcoming meeting';
  if (kind === 'scheduled') return 'scheduled meeting';
  return 'completed meeting';
};

const MeetingCard: React.FC<{
  meeting: MeetingDoc;
  canManage: boolean;
  teamId?: string | null;
  onJoin: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (m: MeetingDoc) => void;
  onHistory: (m: MeetingDoc) => void;
  onStart: (id: string) => void;
  restartingId: string | null;
  deletingId: string | null;
}> = ({ meeting: m, canManage, teamId, onJoin, onRestart, onDelete, onHistory, onStart, restartingId, deletingId }) => {
  const kind = classifyMeeting(m);
  const countdown = useCountdown(kind === 'scheduled' || kind === 'upcoming' ? m.scheduledAt : null);
  const invited = !!(teamId && (
    (m.participatingTeamIds || []).includes(teamId)
    || (m.allowedJoinTeamIds || []).includes(teamId)
    || m.hostTeamId === teamId
  ));
  const canDelete = canManage || (!!teamId && m.hostTeamId === teamId);
  const canStart = canManage || (!!teamId && m.hostTeamId === teamId);
  const joinReady = kind === 'active' || countdown.ready;
  const joinedTeams = Array.from(new Set(
    (m.participants || [])
      .map((p) => (p.teamName || '').trim())
      .filter(Boolean)
  ));
  const teamLine = joinedTeams.length > 0
    ? joinedTeams.join(', ')
    : (m.hostTeamName || m.team || 'Team');
  return (
    <div className={`p-4 rounded-2xl border ${kind === 'completed' ? 'bg-slate-50 border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06]' : 'bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08]'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{new Date(m.scheduledAt || m.createdAt || 0).toLocaleString()}</span>
          {canDelete && (
            <button onClick={() => onDelete(m)} disabled={deletingId === m.id} className="h-7 w-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-500 dark:text-red-400">
              {deletingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        {teamLine} · {(m.participants || []).length} participants
        {m.durationMs ? ` · ${Math.round(m.durationMs / 60000)} min` : ''}
        {invited ? ' · Your team is invited' : ''}
      </p>
      {(kind === 'scheduled' || kind === 'upcoming') && (
        <p className="text-xs text-[#3B6EF8] mt-1 font-medium">Starts in {countdown.label}</p>
      )}
      <div className="flex items-center justify-between mt-4 gap-2">
        <code className="text-xs text-[#3B6EF8] bg-[#3B6EF8]/10 px-2 py-1 rounded-lg">{m.id}</code>
        {kind === 'completed' ? (
          <div className="flex gap-2">
            <button onClick={() => onHistory(m)} className="text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-white/[0.05] px-3 py-1.5 rounded-xl">History</button>
            {canStart && (
              <button onClick={() => onRestart(m.id)} disabled={restartingId === m.id} className="text-xs font-bold text-white bg-[#3B6EF8] px-3 py-1.5 rounded-xl">
                {restartingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Start again'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            {(kind === 'scheduled' || kind === 'upcoming') && canStart && (
              <button
                onClick={() => countdown.ready ? onStart(m.id) : undefined}
                disabled={!countdown.ready}
                className="text-xs font-bold text-white bg-[#3B6EF8] disabled:opacity-40 px-4 py-1.5 rounded-xl"
              >
                {countdown.ready ? 'Start' : 'Waiting'}
              </button>
            )}
            <button
              onClick={() => onJoin(m.id)}
              disabled={!joinReady}
              className="text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-white/[0.05] hover:bg-[#3B6EF8] hover:text-white disabled:opacity-40 px-4 py-1.5 rounded-xl"
            >
              Join
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const FEATURES = [
  { icon: Shield, label: 'End-to-end encrypted' },
  { icon: Zap,    label: 'Ultra-low latency'    },
  { icon: Users,  label: '100 participants'      },
];

/* ════════════════════════════════════════════════════════════ */
const MeetDashboard: React.FC = () => {
  const { user, logout, loading, loginWithGoogle } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const sigtrack = useSigtrackContext();
  const navigate = useNavigate();
  const now      = useClock();
  const [code, setCode]         = useState('');
  const [userMeetings, setUserMeetings] = useState<MeetingDoc[]>([]);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<'instant' | 'scheduled' | null>(null);
  const [historyMeeting, setHistoryMeeting] = useState<MeetingDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MeetingDoc | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(!!auth.currentUser);
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const orgContext = React.useMemo(() => {
    const sessionRaw = sessionStorage.getItem('userCredentials');
    const localRaw = localStorage.getItem('userCredentials');
    const raw = sessionRaw || localRaw;
    if (!raw) {
      return { orgName: 'Unknown Org', team: null as string | null };
    }
    try {
      const parsed = JSON.parse(raw) as { organization?: string; team?: string | null };
      return {
        orgName: parsed.organization || 'Unknown Org',
        team: parsed.team || null
      };
    } catch {
      return { orgName: 'Unknown Org', team: null as string | null };
    }
  }, []);
  const displayName = sigtrack.teamName || sigtrack.orgName || 'Team';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseReady(!!fbUser);
    });
    return () => unsub();
  }, []);

  const refreshMeetings = useCallback(() => {
    if (!user || !auth.currentUser) return;
    const extra: Record<string, string> = {};
    if (sigtrack.teamId) extra.teamId = sigtrack.teamId;
    if (sigtrack.teamName) extra.teamName = sigtrack.teamName;
    if (sigtrack.orgDocId) extra.orgDocId = sigtrack.orgDocId;
    if (sigtrack.orgName) extra.orgName = sigtrack.orgName;
    if (sigtrack.userType) extra.userType = sigtrack.userType;
    if (sigtrack.canManageMeetings) extra.canManageMeetings = 'true';
    if (sigtrack.meetPrivilege.monitorScope) extra.monitorScope = sigtrack.meetPrivilege.monitorScope;
    if (String(sigtrack.userType || '').toLowerCase() === 'admin') extra.monitorScope = 'all';
    api.listAccessibleMeetings(extra)
      .then((meetings) => setUserMeetings(Array.isArray(meetings) ? meetings : []))
      .catch((err) => console.error('Failed to fetch meetings', err));
  }, [user, sigtrack.teamId, sigtrack.teamName, sigtrack.orgDocId, sigtrack.orgName, sigtrack.userType, sigtrack.canManageMeetings, sigtrack.meetPrivilege.monitorScope]);

  useEffect(() => {
    if (!user || !firebaseReady) return;
    refreshMeetings();
    const t = window.setInterval(refreshMeetings, 8000);
    return () => window.clearInterval(t);
  }, [user, firebaseReady, refreshMeetings]);

  /* inject Outfit font once */
  useEffect(() => {
    if (document.getElementById('meet-gfont')) return;
    const l = document.createElement('link');
    l.id = 'meet-gfont'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openMeeting = (meetingId: string, mode: 'host' | 'join' = 'join') => {
    navigate('/setup', { state: { mode, meetingCode: meetingId, meetingId } });
  };

  const handleStartMeeting = async () => {
    if (!user) { toast.error('Please sign in first'); return; }
    if (!sigtrack.canCreateMeeting) { toast.error('Your team cannot create meetings'); return; }
    setCreateMode('instant');
  };

  const handleJoinMeeting = () => {
    if (!code.trim()) { toast.error('Please enter a meeting code'); return; }
    navigate('/setup', { state: { mode: 'join', meetingCode: code.trim() } });
  };

  const handleStartScheduled = async (meetingId: string) => {
    try {
      await api.startMeeting(meetingId);
      toast.success('Meeting started');
      openMeeting(meetingId, 'host');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start meeting');
    }
  };

  const handleRestartMeeting = async (meetingId: string) => {
    if (!user) return;
    setRestartingId(meetingId);
    try {
      await api.restartMeeting(meetingId, user.uid);
      toast.success('Meeting restarted. Opening…');
      openMeeting(meetingId, 'host');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to restart meeting');
    } finally {
      setRestartingId(null);
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    if (!user) return;
    setDeletingId(meetingId);
    try {
      await api.deleteMeeting(meetingId);
      setUserMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      setDeleteTarget(null);
      toast.success('Meeting deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete meeting');
    } finally {
      setDeletingId(null);
    }
  };

  /* ── shared font style ── */
  const rootFont: React.CSSProperties = { fontFamily: "'Outfit', sans-serif" };

  /* ════ LOADING ════ */
  if (loading) return (
    <div style={rootFont}
      className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070B14]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#3B6EF8]/20 border-t-[#3B6EF8] animate-spin" />
        <span className="text-slate-500 text-sm font-medium tracking-widest uppercase">Loading</span>
      </div>
    </div>
  );

  /* ════ LOGGED IN DASHBOARD ════ */
  return (
    <div style={rootFont} className="h-[100dvh] bg-slate-50 text-slate-900 dark:bg-[#070B14] dark:text-white flex flex-col overflow-hidden">

      {/* ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-60 -right-60 w-[700px] h-[700px] rounded-full bg-[#3B6EF8]/10 dark:bg-[#3B6EF8]/8 blur-[140px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-[#06B6D4]/10 dark:bg-[#06B6D4]/6 blur-[100px]" />
      </div>

      {/* ── HEADER ── */}
      <header className="z-50 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2
        border-b border-slate-200 bg-white/80 dark:border-white/[0.06] dark:bg-[#070B14]/80 backdrop-blur-xl sticky top-0">

        {/* logo */}
        <button onClick={() => navigate('/meet')} className="flex items-center gap-2 sm:gap-2.5 group min-w-0">
        <div className="flex justify-center">
            <img src="/sigtrack-tube.png" alt="Soko" className="h-8 sm:h-10 w-auto mb-1 sm:mb-2" />
          </div>
          <span className="text-slate-900 dark:text-white font-bold text-base sm:text-lg tracking-tight group-hover:text-[#3B6EF8] transition-colors truncate">
            WAR ROOM
          </span>
        </button>

        {/* right side */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {!IS_STANDALONE && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] px-2 sm:px-3"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
          )}
          <span className="hidden md:block text-sm text-slate-500 font-medium mr-2">
            {timeStr} · {dateStr}
          </span>

          {/* icon buttons */}
          <button
            type="button"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onClick={toggleTheme}
            className="flex w-9 h-9 rounded-xl items-center justify-center text-slate-500
              hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-all duration-150">
            {theme === 'light' ? <Moon style={{ width: 18, height: 18 }} /> : <Sun style={{ width: 18, height: 18 }} />}
          </button>
          <button
            type="button"
            title="Help"
            onClick={() => setHelpOpen(true)}
            className="flex w-9 h-9 rounded-xl items-center justify-center text-slate-500
              hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-all duration-150">
            <HelpCircle className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          </button>
          <button
            type="button"
            title="Chat history"
            onClick={() => setChatHistoryOpen(true)}
            className="flex w-9 h-9 rounded-xl items-center justify-center text-slate-500
              hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-all duration-150">
            <MessageSquare className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          </button>
          <button
            type="button"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
            className="flex w-9 h-9 rounded-xl items-center justify-center text-slate-500
              hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-all duration-150">
            <Settings className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          </button>

          <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-white/[0.08] mx-1" />

          {/* avatar + info */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-slate-800 dark:text-white/90">{displayName}</span>
              {user?.email && <span className="text-[11px] text-slate-500">{user.email}</span>}
              <span className="text-[11px] text-slate-500">
                {sigtrack.orgName}{sigtrack.teamName ? ` • ${sigtrack.teamName}` : orgContext.team ? ` • ${orgContext.team}` : ''}
              </span>
            </div>
            <Avatar className="w-9 h-9 border border-slate-200 dark:border-white/10 ring-2 ring-slate-100 dark:ring-white/5 flex-shrink-0">
              <AvatarImage src={user?.photoURL || ''} alt={displayName} className="object-cover" />
              <AvatarFallback className="bg-[#3B6EF8] text-white text-xs font-bold">
                {displayName.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <button type="button" onClick={handleLogout}
              className="w-9 h-9 rounded-xl flex items-center justify-center
                bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all duration-150">
              <LogOut style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="relative z-10 flex-1 flex items-start justify-center px-3 sm:px-4 py-6 sm:py-12 overflow-y-auto scrollbar-hide">
        <div className="w-full max-w-5xl flex flex-col items-center gap-6 sm:gap-10">

          {/* greeting */}
          <div className="text-center">
            <p className="text-slate-500 text-sm font-medium mb-1">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {sigtrack.teamName || sigtrack.orgName || 'Team'} 👋
            </h1>
            {!user && (
              <button
                type="button"
                onClick={() => void loginWithGoogle()}
                className="mt-3 text-sm font-semibold text-[#3B6EF8] hover:underline"
              >
                Reconnect Google to create and host meetings
              </button>
            )}
          </div>

          {/* ACTION CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 w-full max-w-4xl">

            {/* NEW MEETING */}
            <button onClick={handleStartMeeting}
              className="group relative flex flex-col items-start p-6 rounded-2xl text-left
                bg-gradient-to-br from-[#3B6EF8] to-[#2040C0] overflow-hidden
                border border-[#3B6EF8]/50 hover:border-[#5B8AFF]
                shadow-2xl shadow-[#3B6EF8]/20 hover:shadow-[#3B6EF8]/40
                hover:-translate-y-0.5 active:translate-y-0
                transition-all duration-200">
              {/* shimmer */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0
                group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/5" />
              <div className="absolute -right-2 -bottom-2 w-20 h-20 rounded-full bg-white/5" />

              <div className="relative z-10 w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-4
                group-hover:bg-white/20 transition-colors">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="relative z-10 text-white font-bold text-lg leading-tight">
                Start Instant Meeting
              </span>
              <span className="relative z-10 text-blue-200/70 text-sm mt-1">
                Start a meeting right now
              </span>
            </button>

            {/* SCHEDULE MEETING */}
            <button 
              onClick={() => {
                if (!sigtrack.canCreateMeeting) { toast.error('Your team cannot schedule meetings'); return; }
                setCreateMode('scheduled');
              }}
              className="group relative flex flex-col items-start p-6 rounded-2xl text-left
                bg-white border border-slate-200 hover:border-[#3B6EF8]/50
                dark:bg-[#0D1525] dark:border-white/[0.08]
                shadow-xl shadow-slate-200/60 dark:shadow-black/40 hover:-translate-y-0.5 active:translate-y-0
                transition-all duration-200">
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-4
                group-hover:bg-[#3B6EF8]/10 transition-colors">
                <Calendar className="w-5 h-5 text-[#3B6EF8]" />
              </div>
              <span className="text-slate-900 dark:text-white font-bold text-lg leading-tight mb-1">Schedule Meeting</span>
              <span className="text-slate-500 text-sm mt-1">Plan a future meeting</span>
            </button>

            {/* JOIN MEETING */}
            <div className="flex flex-col p-6 rounded-2xl
              bg-white border border-slate-200 hover:border-slate-300
              dark:bg-[#0D1525] dark:border-white/[0.08] dark:hover:border-white/[0.14]
              shadow-xl shadow-slate-200/60 dark:shadow-black/40 transition-all duration-200">
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-4">
                <Link2 className="w-5 h-5 text-[#3B6EF8]" />
              </div>
              <span className="text-slate-900 dark:text-white font-bold text-lg leading-tight mb-1">Join with Code</span>
              <span className="text-slate-500 text-sm mb-5">Enter a code or link</span>

              <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                <div className="relative flex-1">
                  <input
                    id="meeting-join-code"
                    name="meetingCode"
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleJoinMeeting()}
                    placeholder="abc-defg-hij"
                    autoComplete="off"
                    className="w-full h-10 px-4 rounded-xl text-sm font-medium text-slate-900 dark:text-white
                      bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.10] placeholder:text-slate-400
                      focus:outline-none focus:border-[#3B6EF8]/60 focus:bg-[#3B6EF8]/5
                      transition-all duration-150"
                  />
                </div>
                <button
                  onClick={handleJoinMeeting}
                  disabled={!code.trim()}
                  className="h-10 w-full sm:w-auto px-5 rounded-xl bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white text-sm font-bold
                    hover:bg-[#3B6EF8] hover:text-white hover:shadow-lg hover:shadow-[#3B6EF8]/30
                    disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-100 dark:disabled:hover:bg-white/[0.08]
                    transition-all duration-200 whitespace-nowrap">
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* MEETING LISTS */}
          {userMeetings.length > 0 && (
            <div className="w-full max-w-4xl mt-8 space-y-8">
              {(['active', 'upcoming', 'scheduled', 'completed'] as const).map((section) => {
                const items = userMeetings.filter((m) => classifyMeeting(m) === section);
                if (items.length === 0) return null;
                const titles = {
                  active: 'Active meetings',
                  upcoming: 'Upcoming meetings',
                  scheduled: 'Scheduled meetings',
                  completed: 'Completed meetings',
                };
                return (
                  <div key={section}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{titles[section]}</h2>
                      <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">{items.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {items.map((m) => (
                        <MeetingCard
                          key={m.id}
                          meeting={m}
                          canManage={sigtrack.canManageMeetings}
                          teamId={sigtrack.teamId}
                          onJoin={openMeeting}
                          onRestart={handleRestartMeeting}
                          onDelete={setDeleteTarget}
                          onHistory={setHistoryMeeting}
                          onStart={handleStartScheduled}
                          restartingId={restartingId}
                          deletingId={deletingId}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sigtrack.canManageMeetings && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-sm text-[#3B6EF8] hover:underline"
            >
              <ShieldCheck className="h-4 w-4" /> Admin chat monitor
            </button>
          )}

          {/* FEATURE STRIP */}
          <div className="flex flex-wrap justify-center gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full
                  bg-white border border-slate-200 text-slate-600
                  dark:bg-white/[0.03] dark:border-white/[0.07] dark:text-[#6B7280] text-xs font-medium">
                <Icon className="w-3.5 h-3.5 text-[#3B6EF8]" />
                {label}
              </div>
            ))}
          </div>

          {/* help link */}
          <p className="text-slate-500 text-sm">
            New to WAR ROOM?{' '}
            <button onClick={() => navigate('/')}
              className="text-[#3B6EF8] font-semibold hover:underline underline-offset-2 transition-colors">
              Learn how it works
            </button>
          </p>
        </div>
      </main>
      {user && createMode === 'scheduled' && (
        <ScheduleMeetingModal
          open
          onOpenChange={(open) => { if (!open) setCreateMode(null); }}
          hostName={sigtrack.teamName || user.displayName || 'Host'}
          hostId={user.uid}
          onCreated={(_id, kind) => {
            if (kind === 'scheduled') {
              toast.success('Scheduled meeting saved');
              refreshMeetings();
            }
            setCreateMode(null);
          }}
        />
      )}
      {user && createMode === 'instant' && (
        <CreateMeetingModal
          open
          onOpenChange={(open) => { if (!open) setCreateMode(null); }}
          mode="instant"
          hostName={sigtrack.teamName || user.displayName || 'Host'}
          hostId={user.uid}
          onCreated={(id) => {
            setCreateMode(null);
            navigate('/setup', { state: { mode: 'host', meetingId: id } });
          }}
        />
      )}
      <MeetingHistoryDetail
        meeting={historyMeeting}
        open={!!historyMeeting}
        onOpenChange={(open) => { if (!open) setHistoryMeeting(null); }}
      />
      <MeetChatHistoryModal open={chatHistoryOpen} onOpenChange={setChatHistoryOpen} />
      <MeetSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="w-[95vw] max-w-md bg-white text-slate-900 border-slate-200 dark:bg-[#0D1525] dark:border-white/10 dark:text-white">
          <DialogHeader>
            <DialogTitle>WAR ROOM</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-zinc-400">
              Start, schedule, or join a meeting with a code. Chat history only includes meetings your team or organization is authorized to access.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="w-[95vw] max-w-md bg-white text-slate-900 border-slate-200 dark:bg-[#0D1525] dark:border-white/10 dark:text-white">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget ? meetingKindLabel(classifyMeeting(deleteTarget)) : 'meeting'}</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-zinc-400">
              This confirmation is based on the meeting type, not the current user. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            Delete{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {deleteTarget?.title || 'this meeting'}
            </span>
            {deleteTarget?.hostTeamName ? ` (${deleteTarget.hostTeamName})` : ''}?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="text-slate-700 dark:text-white">Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-500 text-white"
              disabled={!!deletingId}
              onClick={() => { if (deleteTarget) void deleteMeeting(deleteTarget.id); }}
            >
              {deletingId ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetDashboard;
