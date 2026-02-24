import { STREAM_API_URL } from '../config';

const API_URL = `${STREAM_API_URL}/api`;

export const api = {
  createSession: async () => {
    const response = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
    });
    return response.json();
  },

  getSession: async (sessionId: string) => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}`);
    if (!response.ok) throw new Error('Session not found');
    return response.json();
  },

  endSession: async (sessionId: string) => {
    await fetch(`${API_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  getViewers: async (sessionId: string) => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/viewers`);
    return response.json();
  },

  requestJoin: async (sessionId: string, name: string) => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join');
    }
    return response.json();
  },

  approveViewer: async (sessionId: string, viewerId: string) => {
    await fetch(`${API_URL}/sessions/${sessionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerId }),
    });
  },

  rejectViewer: async (sessionId: string, viewerId: string) => {
    await fetch(`${API_URL}/sessions/${sessionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerId }),
    });
  },

  setAdmissionMode: async (sessionId: string, mode: 'auto' | 'manual') => {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/admission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update admission mode');
    }
    return response.json();
  },

  removeViewer: async (sessionId: string, viewerId: string) => {
    await fetch(`${API_URL}/sessions/${sessionId}/viewers/${viewerId}`, {
      method: 'DELETE',
    });
  },
  
  healthCheck: async () => {
      const response = await fetch(`${API_URL}/health`);
      return response.json();
  },

  deleteSession: async (id: string) => {
    const response = await fetch(`${API_URL}/sessions/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // --- Meetings API ---
  createMeeting: async (meetingData: { id: string, hostId: string, hostName: string, title?: string }) => {
    const response = await fetch(`${API_URL}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meetingData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error creating meeting (${response.status}):`, errorText);
      throw new Error(`Failed to create meeting: ${response.status}`);
    }
    return response.json();
  },

  getMeeting: async (id: string) => {
    const response = await fetch(`${API_URL}/meetings/${id}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error getting meeting (${response.status}):`, errorText);
      throw new Error(`Meeting not found: ${response.status}`);
    }
    return response.json();
  },

  listUserMeetings: async (userId: string) => {
    const response = await fetch(`${API_URL}/meetings/user/${userId}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching meetings (${response.status}):`, errorText);
      throw new Error(`Failed to fetch meetings: ${response.status}`);
    }
    return response.json();
  }
};
