// Session Types
export interface Session {
  id: string;
  hostId: string;
  status: 'waiting' | 'live' | 'paused' | 'ended';
  isActive: boolean; // Added to match backend
  createdAt: Date;
  expiresAt: Date;
  viewerCount: number;
  streamSettings: StreamSettings;
  admissionMode?: 'auto' | 'manual';
}

export interface StreamSettings {
  resolution: string;
  frameRate: number;
  bitrate: number;
}

// Viewer Types
export interface Viewer {
  id: string;
  name: string;
  status: 'connected' | 'reconnecting' | 'disconnected' | 'waiting' | 'approved' | 'rejected';
  joinedAt: Date;
  connectionQuality?: 'excellent' | 'good' | 'poor'; // Made optional as backend doesn't send it initially
}

export interface PendingRequest {
  id: string;
  name: string;
  requestedAt: Date;
  sessionId: string;
}

// Conference Types
export interface Conference {
  id: string;
  createdBy: string;
  createdAt: number;
  isActive: boolean;
  name: string;
  description?: string;
  roomMode: 'open' | 'moderated';
  maxParticipants: number;
  participants: Record<string, Participant>;
  expiresAt: number;
  settings: {
    recordingEnabled: boolean;
    screenShareEnabled: boolean;
  };
}

export interface Participant {
  id: string;
  name: string;
  joinedAt: number;
  status: 'waiting' | 'active' | 'rejected';
  role: 'host' | 'participant';
}

  viewerId: string;
  candidate: RTCIceCandidateInit;
}

// Stream State
export interface StreamState {
  isStreaming: boolean;
  isPaused: boolean;
  isMuted: boolean;
  duration: number;
  bitrate: number;
  resolution: string;
  frameRate: number;
}
