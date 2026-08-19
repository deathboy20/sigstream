import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { CONFIG_COLLECTION, TEAMS_COLLECTION } from '../config/collections';
import {
  mergeMeetPrivilege,
  mergeFeaturePrivilege,
  type MeetPrivilege,
  type ParsedConfig,
} from '../types/org';

export interface SigtrackCredentials {
  organization?: string;
  organizationDocId?: string;
  adminLevel?: string;
  adminLevelName?: string;
  loginType?: string;
  userType?: string;
  team?: string | null;
  teamName?: string | null;
}

export interface AuthorizedTeam {
  id: string;
  name: string;
  level: number;
  reportsTo: string[];
}

export interface SigtrackContext {
  orgName: string;
  orgDocId: string;
  teamId: string | null;
  teamName: string;
  adminLevel: number | null;
  userType: string | null;
  displayNameHint: string;
  meetPrivilege: MeetPrivilege;
  canCreateMeeting: boolean;
  canJoinMeeting: boolean;
  canManageMeetings: boolean;
  authorizedTeams: AuthorizedTeam[];
  allOrgTeams: AuthorizedTeam[];
  loading: boolean;
}

const readJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const readSigtrackCredentials = (): SigtrackCredentials => {
  const raw =
    (typeof window !== 'undefined' ? sessionStorage.getItem('userCredentials') : null) ||
    (typeof window !== 'undefined' ? localStorage.getItem('userCredentials') : null);
  return readJson<SigtrackCredentials>(raw) || {};
};

export const useSigtrackContext = (): SigtrackContext => {
  const [teams, setTeams] = useState<AuthorizedTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const creds = useMemo(() => readSigtrackCredentials(), []);
  const orgDocId = typeof window !== 'undefined'
    ? (localStorage.getItem('organizationDocId') || creds.organizationDocId || '')
    : (creds.organizationDocId || '');

  const parsedConfig = useMemo((): ParsedConfig | null => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('organizationConfig') : null;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ParsedConfig;
    } catch {
      return null;
    }
  }, []);

  const adminLevel = useMemo(() => {
    const n = Number(creds.adminLevel);
    return Number.isFinite(n) ? n : null;
  }, [creds.adminLevel]);

  const meetPrivilege = useMemo(() => {
    const level = parsedConfig?.Levels?.find((l) => l.id === adminLevel);
    return mergeMeetPrivilege(level?.MeetPrivilege);
  }, [parsedConfig, adminLevel]);

  const featureEnabled = useMemo(() => {
    const level = parsedConfig?.Levels?.find((l) => l.id === adminLevel);
    return mergeFeaturePrivilege(level?.FeaturePrivilege).enableSigtrackMeet;
  }, [parsedConfig, adminLevel]);

  const isAdmin = String(creds.userType || creds.loginType || '').toLowerCase() === 'admin';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!orgDocId) {
        setLoading(false);
        return;
      }
      try {
        const orgRef = doc(db, CONFIG_COLLECTION, orgDocId);
        const q = query(collection(db, TEAMS_COLLECTION), where('organisations', '==', orgRef));
        const snap = await getDocs(q);
        if (cancelled) return;
        const next: AuthorizedTeam[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || 'Team'),
            level: typeof data.level === 'number' ? data.level : Number(data.level) || 0,
            reportsTo: Array.isArray(data.reportsTo) ? data.reportsTo.filter((s: unknown): s is string => typeof s === 'string') : [],
          };
        });
        setTeams(next);
      } catch (error) {
        console.error('Failed to load teams for Meet', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [orgDocId]);

  const currentTeam = teams.find((t) => t.id === creds.team) || null;
  const teamName = creds.teamName || currentTeam?.name || '';

  const authorizedTeams = useMemo(() => {
    if (isAdmin) return teams;
    const own = currentTeam;
    if (!own) return teams;
    const commsLevels = meetPrivilege.canCommunicateWithLevels;
    const byLevel = commsLevels.length > 0
      ? teams.filter((t) => commsLevels.includes(t.level) || t.id === own.id)
      : teams.filter((t) => t.id === own.id || own.reportsTo.includes(t.id) || t.reportsTo.includes(own.id));
    const autoIds = new Set(meetPrivilege.autoIncludeTeamIds);
    return teams.filter((t) => byLevel.some((b) => b.id === t.id) || autoIds.has(t.id));
  }, [teams, currentTeam, meetPrivilege, isAdmin]);

  return {
    orgName: creds.organization || 'Unknown Org',
    orgDocId,
    teamId: creds.team || null,
    teamName,
    adminLevel,
    userType: creds.userType || creds.loginType || null,
    displayNameHint: teamName || '',
    meetPrivilege,
    canCreateMeeting: featureEnabled && (isAdmin || meetPrivilege.canCreateMeeting),
    canJoinMeeting: featureEnabled && (isAdmin || meetPrivilege.canJoinMeeting),
    canManageMeetings: isAdmin || meetPrivilege.canManageMeetings,
    authorizedTeams,
    allOrgTeams: teams,
    loading,
  };
};

export const callerQueryParams = (ctx: Pick<SigtrackContext, 'teamId' | 'teamName' | 'orgDocId' | 'orgName' | 'userType' | 'canManageMeetings' | 'meetPrivilege'>) => ({
  teamId: ctx.teamId || undefined,
  teamName: ctx.teamName || undefined,
  orgDocId: ctx.orgDocId || undefined,
  orgName: ctx.orgName || undefined,
  userType: ctx.userType || undefined,
  canManageMeetings: ctx.canManageMeetings ? 'true' : undefined,
  monitorScope: String(ctx.userType || '').toLowerCase() === 'admin' ? 'all' : ctx.meetPrivilege.monitorScope,
  monitorTeamIds: ctx.meetPrivilege.monitorTeamIds,
  monitorMeetingIds: ctx.meetPrivilege.monitorMeetingIds,
});
