import { STREAM_API_URL } from '../config';

const API_URL = `${STREAM_API_URL}/api`;

export const api = {
  // === STREAMING ENDPOINTS ===
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

  // === CONFERENCE ENDPOINTS ===
  createConference: async (data: { name: string; roomMode: 'open' | 'moderated'; maxParticipants?: number }) => {
    const response = await fetch(`${API_URL}/conferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create conference');
    }
    return response.json();
  },

  getConference: async (roomId: string) => {
    const response = await fetch(`${API_URL}/conferences/${roomId}`);
    if (!response.ok) throw new Error('Conference not found');
    return response.json();
  },

  endConference: async (roomId: string) => {
    const response = await fetch(`${API_URL}/conferences/${roomId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to end conference');
    return response.json();
  },

  getParticipants: async (roomId: string) => {
    const response = await fetch(`${API_URL}/conferences/${roomId}/participants`);
    if (!response.ok) throw new Error('Failed to get participants');
    return response.json();
  },

  requestJoinConference: async (roomId: string, name: string) => {
    const response = await fetch(`${API_URL}/conferences/${roomId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join conference');
    }
    return response.json();
  },

  approveParticipant: async (roomId: string, participantId: string) => {
    const response = await fetch(`${API_URL}/conferences/${roomId}/approve/${participantId}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to approve participant');
    return response.json();
  },

  rejectParticipant: async (roomId: string, participantId: string) => {
    const response = await fetch(`${API_URL}/conferences/${roomId}/reject/${participantId}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to reject participant');
    return response.json();
  },

  removeParticipant: async (roomId: string, participantId: string) => {
    const response = await fetch(`${API_URL}/conferences/${roomId}/participants/${participantId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to remove participant');
    return response.json();
  },

  setRoomMode: async (roomId: string, roomMode: 'open' | 'moderated') => {
    const response = await fetch(`${API_URL}/conferences/${roomId}/room-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomMode }),
    });
    if (!response.ok) throw new Error('Failed to set room mode');
    return response.json();
  },

  healthCheck: async () => {
      const response = await fetch(`${API_URL}/health`);
      return response.json();
  }
};
