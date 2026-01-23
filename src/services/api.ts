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

  removeViewer: async (sessionId: string, viewerId: string) => {
    await fetch(`${API_URL}/sessions/${sessionId}/viewers/${viewerId}`, {
      method: 'DELETE',
    });
  },
  
  healthCheck: async () => {
      const response = await fetch(`${API_URL}/health`);
      return response.json();
  }
};
