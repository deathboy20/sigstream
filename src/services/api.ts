import { STREAM_API_URL } from '../config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import type { Session, Viewer } from '../types/streaming.types';
import type { ChatInboxItem, ChatMessageDoc, CreateMeetingPayload, MeetingDoc, MeetingFileDoc } from '../types/meeting.types';
import { readSigtrackCredentials } from '../hooks/useSigtrackContext';

const API_URL = `${STREAM_API_URL}/api`;

const parseJsonResponse = async <T>(response: Response, context: string): Promise<T> => {
  const contentType = response.headers.get('content-type') || '';
  const bodyText = await response.text();
  if (!response.ok) {
    let parsedError: { error?: string } | null = null;
    try {
      parsedError = bodyText ? JSON.parse(bodyText) as { error?: string } : null;
    } catch {
      parsedError = null;
    }
    throw new Error(parsedError?.error || `${context} failed (${response.status})`);
  }
  if (!contentType.includes('application/json')) {
    const sample = bodyText.slice(0, 120);
    throw new Error(`${context} returned non-JSON response. Check env variables. Response starts with: ${sample}`);
  }
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    const sample = bodyText.slice(0, 120);
    throw new Error(`${context} returned invalid JSON. Response starts with: ${sample}`);
  }
};

const waitForAuthUser = () =>
  new Promise<User | null>((resolve) => {
    const existing = auth.currentUser;
    if (existing) {
      resolve(existing);
      return;
    }

    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });

const getAuthToken = async () => {
  const currentUser = auth.currentUser ?? await waitForAuthUser();
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken(true);
  } catch {
    return currentUser.getIdToken();
  }
};

const getOrgContext = () => {
  const parsed = readSigtrackCredentials();
  const userType = parsed.userType || parsed.loginType || null;
  return {
    orgName: parsed.organization || 'Unknown Org',
    team: parsed.team || null,
    teamName: parsed.teamName || null,
    hostTeamId: parsed.team || null,
    hostTeamName: parsed.teamName || null,
    userType,
    loginType: parsed.loginType || userType,
    adminLevel: parsed.adminLevel ? Number(parsed.adminLevel) : null,
    orgDocId:
      (typeof window !== 'undefined' ? (localStorage.getItem('organizationDocId') || null) : null)
      || parsed.organizationDocId
      || null,
  };
};

const callerQuery = (extra?: Record<string, string>) => {
  const ctx = getOrgContext();
  const params = new URLSearchParams(extra || {});
  if (ctx.team && !params.get('teamId')) params.set('teamId', ctx.team);
  if (ctx.orgDocId && !params.get('orgDocId')) params.set('orgDocId', ctx.orgDocId);
  if (ctx.orgName && !params.get('orgName')) params.set('orgName', ctx.orgName);
  if (ctx.userType && !params.get('userType')) params.set('userType', ctx.userType);
  if (ctx.teamName && !params.get('teamName')) params.set('teamName', ctx.teamName);
  if (String(ctx.userType || '').toLowerCase() === 'admin') {
    params.set('canManageMeetings', 'true');
    if (!params.get('monitorScope')) params.set('monitorScope', 'all');
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

const authorizedFetch = async (url: string, init?: RequestInit) => {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Missing Firebase auth token. Please sign in again.');
  }
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-firebase-token', token);
  return fetch(url, {
    ...init,
    headers,
  });
};

export const api = {
  createSession: async (): Promise<Session> => {
    const response = await authorizedFetch(`${API_URL}/sessions`, {
      method: 'POST',
    });
    return parseJsonResponse(response, 'Create session');
  },

  getSession: async (sessionId: string): Promise<Session> => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}`);
    return parseJsonResponse(response, 'Get session');
  },

  endSession: async (sessionId: string) => {
    await authorizedFetch(`${API_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  getViewers: async (sessionId: string): Promise<Record<string, Viewer>> => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/viewers`);
    return parseJsonResponse(response, 'Get viewers');
  },

  requestJoin: async (sessionId: string, name: string): Promise<Viewer> => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseJsonResponse(response, 'Request join');
  },

  approveViewer: async (sessionId: string, viewerId: string) => {
    await authorizedFetch(`${API_URL}/sessions/${sessionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerId }),
    });
  },

  rejectViewer: async (sessionId: string, viewerId: string) => {
    await authorizedFetch(`${API_URL}/sessions/${sessionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerId }),
    });
  },

  setAdmissionMode: async (sessionId: string, mode: 'auto' | 'manual') => {
    const response = await authorizedFetch(`${API_URL}/sessions/${sessionId}/admission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    return parseJsonResponse(response, 'Set admission mode');
  },

  removeViewer: async (sessionId: string, viewerId: string) => {
    await authorizedFetch(`${API_URL}/sessions/${sessionId}/viewers/${viewerId}`, {
      method: 'DELETE',
    });
  },
  
  healthCheck: async () => {
      const response = await fetch(`${API_URL}/health`);
      return parseJsonResponse(response, 'Health check');
  },

  deleteSession: async (id: string) => {
    const response = await fetch(`${API_URL}/sessions/${id}`, {
      method: 'DELETE',
    });
    return parseJsonResponse(response, 'Delete session');
  },

  // --- Meetings API ---
  createMeeting: async (meetingData: CreateMeetingPayload) => {
    const orgContext = getOrgContext();
    const response = await authorizedFetch(`${API_URL}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...meetingData, ...orgContext }),
    });
    return parseJsonResponse<MeetingDoc>(response, 'Create meeting');
  },

  deleteMeeting: async (id: string) => {
    const orgContext = getOrgContext();
    const response = await authorizedFetch(`${API_URL}/meetings/${id}${callerQuery()}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgContext),
    });
    return parseJsonResponse(response, 'Delete meeting');
  },

  getMeeting: async (id: string) => {
    const response = await authorizedFetch(`${API_URL}/meetings/${id}${callerQuery()}`);
    return parseJsonResponse<MeetingDoc>(response, 'Get meeting');
  },

  getMeetingPublic: async (id: string) => {
    const response = await fetch(`${API_URL}/meetings/${id}/public`);
    return parseJsonResponse<MeetingDoc>(response, 'Get public meeting');
  },

  listUserMeetings: async (userId: string) => {
    const response = await authorizedFetch(`${API_URL}/meetings/user/${userId}`);
    return parseJsonResponse<MeetingDoc[]>(response, 'List user meetings');
  },

  listAccessibleMeetings: async (extra?: Record<string, string>) => {
    const response = await authorizedFetch(`${API_URL}/meetings/accessible${callerQuery(extra)}`);
    return parseJsonResponse<MeetingDoc[]>(response, 'List accessible meetings');
  },

  listChatInbox: async (extra?: Record<string, string>) => {
    const response = await authorizedFetch(`${API_URL}/meetings/chat-inbox${callerQuery(extra)}`);
    return parseJsonResponse<ChatInboxItem[]>(response, 'List chat history');
  },

  listMeetingHistory: async (status?: string) => {
    const extra = status ? { status } : undefined;
    const response = await authorizedFetch(`${API_URL}/meetings/history${callerQuery(extra)}`);
    return parseJsonResponse<MeetingDoc[]>(response, 'List meeting history');
  },

  startMeeting: async (meetingId: string) => {
    const orgContext = getOrgContext();
    const response = await authorizedFetch(`${API_URL}/meetings/${meetingId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgContext),
    });
    return parseJsonResponse<MeetingDoc>(response, 'Start meeting');
  },

  checkJoinAccess: async (meetingId: string) => {
    const orgContext = getOrgContext();
    const response = await authorizedFetch(`${API_URL}/meetings/${meetingId}/join-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgContext),
    });
    return parseJsonResponse<{ allowed: boolean; meeting?: MeetingDoc; error?: string }>(response, 'Check join access');
  },

  listMessages: async (meetingId: string, scope?: 'admin') => {
    const extra: Record<string, string> = {};
    if (scope) extra.scope = scope;
    const response = await authorizedFetch(`${API_URL}/meetings/${meetingId}/messages${callerQuery(extra)}`);
    return parseJsonResponse<ChatMessageDoc[]>(response, 'List messages');
  },

  sendMessage: async (meetingId: string, payload: Partial<ChatMessageDoc>) => {
    const orgContext = getOrgContext();
    const response = await authorizedFetch(`${API_URL}/meetings/${meetingId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...orgContext, teamId: orgContext.team }),
    });
    return parseJsonResponse<ChatMessageDoc>(response, 'Send message');
  },

  listFiles: async (meetingId: string) => {
    const orgContext = getOrgContext();
    const params = new URLSearchParams();
    if (orgContext.team) params.set('teamId', orgContext.team);
    if (orgContext.orgDocId) params.set('orgDocId', orgContext.orgDocId);
    const qs = params.toString();
    const response = await authorizedFetch(`${API_URL}/meetings/${meetingId}/files${qs ? `?${qs}` : ''}`);
    return parseJsonResponse<MeetingFileDoc[]>(response, 'List files');
  },

  registerFile: async (meetingId: string, payload: Partial<MeetingFileDoc>) => {
    const orgContext = getOrgContext();
    const response = await authorizedFetch(`${API_URL}/meetings/${meetingId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...orgContext }),
    });
    return parseJsonResponse<MeetingFileDoc>(response, 'Register file');
  },

  createUploadUrl: async (meetingId: string, fileName: string, mimeType: string, sizeBytes?: number) => {
    const orgContext = getOrgContext();
    const response = await authorizedFetch(`${API_URL}/meetings/${meetingId}/files/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orgContext, fileName, mimeType, sizeBytes }),
    });
    return parseJsonResponse<{
      id: string;
      storagePath: string;
      uploadUrl: string | null;
      contentType: string;
      clientUpload?: boolean;
    }>(response, 'Create upload URL');
  },

  getFileDownloadUrl: async (meetingId: string, fileId: string) => {
    const orgContext = getOrgContext();
    const params = new URLSearchParams();
    if (orgContext.team) params.set('teamId', orgContext.team);
    if (orgContext.orgDocId) params.set('orgDocId', orgContext.orgDocId);
    const qs = params.toString();
    const response = await authorizedFetch(
      `${API_URL}/meetings/${meetingId}/files/${fileId}/download${qs ? `?${qs}` : ''}`
    );
    return parseJsonResponse<{ url: string | null; fileName?: string; storagePath?: string; clientDownload?: boolean }>(
      response,
      'Get file download URL'
    );
  },

  /** Restart an ended meeting (host only). Reuses the same meeting ID. */
  restartMeeting: async (meetingId: string, userId: string) => {
    const response = await authorizedFetch(`${API_URL}/meetings/${meetingId}/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return parseJsonResponse(response, 'Restart meeting');
  },
};
