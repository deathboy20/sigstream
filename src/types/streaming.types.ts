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

// Device Types
export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
  groupId: string;
}

export interface SelectedDevices {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
}

// Socket Event Types
export interface ViewerRequest {
  requestId: string;
  viewerName: string;
  sessionId: string;
  timestamp: Date;
}

export interface SignalingOffer {
  sessionId: string;
  viewerId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalingAnswer {
  sessionId: string;
  viewerId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidate {
  sessionId: string;
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
