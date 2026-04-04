import { STREAM_API_URL } from '../config';
import { auth } from './firebase';
import { Session, Viewer } from '../types/streaming.types';

const API_URL = `${STREAM_API_URL}/api`;

type ApiRequestOptions = RequestInit & {
  requiresAuth?: boolean;
};

type HealthResponse = {
  status: string;
  endpoints?: string[];
};

type MeetingRecord = {
  id: string;
  hostId: string;
  hostName: string;
  title?: string;
  isActive?: boolean;
  participants?: Array<{ id: string; name: string; role?: string }>;
  [key: string]: unknown;
};

type MeetingPublicRecord = {
  id: string;
  title: string;
  hostName: string;
  isActive: boolean;
  createdAt: number | null;
  scheduledAt: number | null;
};

const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
};

const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const { requiresAuth = false, headers, ...fetchOptions } = options;
  const mergedHeaders = new Headers(headers);

  if (requiresAuth) {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    mergedHeaders.set('Authorization', `Bearer ${token}`);
    mergedHeaders.set('x-firebase-token', token);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({} as { error?: string; message?: string }));
    const errorMessage =
      (errorPayload as { error?: string; message?: string }).error ||
      (errorPayload as { error?: string; message?: string }).message ||
      `Request failed (${response.status})`;
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const api = {
  createSession: async (): Promise<Session> => {
    return request<Session>('/sessions', {
      method: 'POST',
      requiresAuth: true,
    });
  },

  getSession: async (sessionId: string): Promise<Session> => {
    return request<Session>(`/sessions/${sessionId}`);
  },

  endSession: async (sessionId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/sessions/${sessionId}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  getViewers: async (sessionId: string): Promise<Record<string, Viewer>> => {
    return request<Record<string, Viewer>>(`/sessions/${sessionId}/viewers`);
  },

  requestJoin: async (sessionId: string, name: string): Promise<Viewer> => {
    return request<Viewer>(`/sessions/${sessionId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  },

  approveViewer: async (sessionId: string, viewerId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/sessions/${sessionId}/approve`, {
      method: 'POST',
      requiresAuth: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerId }),
    });
  },

  rejectViewer: async (sessionId: string, viewerId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/sessions/${sessionId}/reject`, {
      method: 'POST',
      requiresAuth: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerId }),
    });
  },

  setAdmissionMode: async (sessionId: string, mode: 'auto' | 'manual'): Promise<{ message: string; mode: 'auto' | 'manual' }> => {
    return request<{ message: string; mode: 'auto' | 'manual' }>(`/sessions/${sessionId}/admission`, {
      method: 'POST',
      requiresAuth: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
  },

  removeViewer: async (sessionId: string, viewerId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/sessions/${sessionId}/viewers/${viewerId}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  healthCheck: async (): Promise<HealthResponse> => {
    return request<HealthResponse>('/health');
  },

  deleteSession: async (id: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/sessions/${id}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  createMeeting: async (meetingData: { id: string; hostName: string; title?: string; scheduledAt?: number; orgName?: string; team?: string; userType?: string }): Promise<MeetingRecord> => {
    return request<MeetingRecord>('/meetings', {
      method: 'POST',
      requiresAuth: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meetingData),
    });
  },

  getMeeting: async (id: string): Promise<MeetingRecord> => {
    return request<MeetingRecord>(`/meetings/${id}`, {
      requiresAuth: true,
    });
  },

  getMeetingPublic: async (id: string): Promise<MeetingPublicRecord> => {
    return request<MeetingPublicRecord>(`/meetings/${id}/public`);
  },

  listUserMeetings: async (userId: string): Promise<MeetingRecord[]> => {
    return request<MeetingRecord[]>(`/meetings/user/${userId}`, {
      requiresAuth: true,
    });
  },

  restartMeeting: async (meetingId: string): Promise<MeetingRecord> => {
    return request<MeetingRecord>(`/meetings/${meetingId}/restart`, {
      method: 'POST',
      requiresAuth: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  },

  deleteMeeting: async (meetingId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/meetings/${meetingId}`, {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};
