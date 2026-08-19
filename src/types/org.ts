export type MeetMonitorScope = 'all' | 'teams' | 'meetings';

export interface MeetPrivilege {
  canCreateMeeting: boolean;
  canJoinMeeting: boolean;
  canManageMeetings: boolean;
  canCommunicateWithLevels: number[];
  autoIncludeTeamIds: string[];
  monitorScope: MeetMonitorScope;
  monitorTeamIds: string[];
  monitorMeetingIds: string[];
}

export const DEFAULT_MEET_PRIVILEGE: MeetPrivilege = {
  canCreateMeeting: true,
  canJoinMeeting: true,
  canManageMeetings: false,
  canCommunicateWithLevels: [],
  autoIncludeTeamIds: [],
  monitorScope: 'meetings',
  monitorTeamIds: [],
  monitorMeetingIds: [],
};

export function mergeMeetPrivilege(raw: unknown): MeetPrivilege {
  const out: MeetPrivilege = {
    ...DEFAULT_MEET_PRIVILEGE,
    canCommunicateWithLevels: [],
    autoIncludeTeamIds: [],
    monitorTeamIds: [],
    monitorMeetingIds: [],
  };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  if (typeof o.canCreateMeeting === 'boolean') out.canCreateMeeting = o.canCreateMeeting;
  if (typeof o.canJoinMeeting === 'boolean') out.canJoinMeeting = o.canJoinMeeting;
  if (typeof o.canManageMeetings === 'boolean') out.canManageMeetings = o.canManageMeetings;
  if (Array.isArray(o.canCommunicateWithLevels)) {
    out.canCommunicateWithLevels = o.canCommunicateWithLevels.filter((n): n is number => typeof n === 'number');
  }
  if (Array.isArray(o.autoIncludeTeamIds)) {
    out.autoIncludeTeamIds = o.autoIncludeTeamIds.filter((s): s is string => typeof s === 'string');
  }
  if (o.monitorScope === 'all' || o.monitorScope === 'teams' || o.monitorScope === 'meetings') {
    out.monitorScope = o.monitorScope;
  }
  if (Array.isArray(o.monitorTeamIds)) {
    out.monitorTeamIds = o.monitorTeamIds.filter((s): s is string => typeof s === 'string');
  }
  if (Array.isArray(o.monitorMeetingIds)) {
    out.monitorMeetingIds = o.monitorMeetingIds.filter((s): s is string => typeof s === 'string');
  }
  return out;
}

export interface FeaturePrivilege {
  enableSigtrackMeet: boolean;
}

export function mergeFeaturePrivilege(raw: unknown): FeaturePrivilege {
  const out: FeaturePrivilege = { enableSigtrackMeet: true };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  if (typeof o.enableSigtrackMeet === 'boolean') out.enableSigtrackMeet = o.enableSigtrackMeet;
  return out;
}

export interface ConfigLevel {
  id: number;
  name: string;
  password: string;
  MeetPrivilege?: MeetPrivilege;
  FeaturePrivilege?: FeaturePrivilege;
}

export interface ParsedConfig {
  Levels: ConfigLevel[];
}
