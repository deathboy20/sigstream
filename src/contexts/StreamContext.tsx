import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Session, Viewer, StreamState } from '../types/streaming.types';
import { api } from '../services/api';
import SimplePeer from 'simple-peer';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { STREAM_API_URL } from '../config';

interface StreamContextState {
  session: Session | null;
  viewers: Viewer[];
  pendingRequests: Viewer[];
  streamState: StreamState;
  createSession: () => Promise<void>;
  endSession: () => Promise<void>;
  approveRequest: (viewerId: string) => Promise<void>;
  rejectRequest: (viewerId: string) => Promise<void>;
  removeViewer: (viewerId: string) => Promise<void>;
  setStream: (stream: MediaStream | null) => void;
  stream: MediaStream | null;
  startStreaming: () => void;
  stopStreaming: () => void;
  pauseStreaming: () => void;
  resumeStreaming: () => void;
  toggleMute: () => void;
  updateDuration: (duration: number) => void;
  addPendingRequest: (req: any) => void;
}

const StreamContext = createContext<StreamContextState | undefined>(undefined);

// Initialize Socket.IO connection
export const socket: Socket = io(STREAM_API_URL, {
  autoConnect: true
});

export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};

export const StreamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamState, setStreamState] = useState<StreamState>({
    isStreaming: false,
    isPaused: false,
    isMuted: false,
    duration: 0,
    bitrate: 0,
    resolution: '1920x1080',
    frameRate: 30,
  });

  const peersRef = useRef<Record<string, SimplePeer.Instance>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const viewersRef = useRef<Viewer[]>([]);
  const readyViewersRef = useRef<Set<string>>(new Set());

  const createPeer = useCallback((viewer: Viewer) => {
    if (!session) return;
    console.log(`Creating peer for viewer ${viewer.id}`);

    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      stream: streamRef.current || undefined,
    });

    peersRef.current[viewer.id] = peer;

    // On Signal (Offer/Candidate) -> Send to Viewer via Socket
    peer.on('signal', (data) => {
      console.log(`Sending signal to viewer ${viewer.id}`);
      socket.emit('signal', {
        target: viewer.id,
        signal: data,
        sessionId: session.id,
        metadata: { host: true }
      });
    });

    peer.on('connect', () => {
      console.log(`Connected to viewer ${viewer.id}`);
    });

    peer.on('close', () => {
      console.log(`Peer connection closed for ${viewer.id}`);
      if (peersRef.current[viewer.id]) {
        delete peersRef.current[viewer.id];
      }
    });

    peer.on('error', (err) => {
      console.error(`Peer error ${viewer.id}:`, err);
    });
  }, [session]);

  // Sync streamRef with stream state
  // Sync streamRef with stream state and handle late-joining stream
  useEffect(() => {
    streamRef.current = stream;
    if (stream) {
      // 1. Update existing peers (replaceTrack)
      Object.values(peersRef.current).forEach(peer => {
        if (!peer.destroyed) {
          // @ts-ignore - _pc is private but accessible
          const senders = peer._pc.getSenders();
          senders.forEach((sender: any) => {
            if (sender.track) {
              const newTrack = stream.getTracks().find(t => t.kind === sender.track.kind);
              if (newTrack) {
                sender.replaceTrack(newTrack);
              }
            }
          });
        }
      });

      // 2. Initialize peers for viewers who were ready but waiting for stream
      readyViewersRef.current.forEach(viewerId => {
        const viewer = viewersRef.current.find(v => v.id === viewerId);
        if (viewer && viewer.status === 'approved' && !peersRef.current[viewerId]) {
          console.log(`Stream now ready, creating delayed peer for ${viewerId}`);
          createPeer(viewer);
        }
      });
      // Clear the set as we've processed them (or they are now in peersRef)
      readyViewersRef.current.clear();
    }
  }, [stream, createPeer]);

  // Sync viewersRef
  useEffect(() => {
    viewersRef.current = viewers;
  }, [viewers]);



  // Handle Socket Signaling
  useEffect(() => {
    if (!session) return;

    const joinSession = () => {
      console.log('Joining session room:', session.id);
      socket.emit('join-session', session.id);
    };

    if (socket.connected) {
      joinSession();
    }

    socket.on('connect', joinSession);

    const handleSignal = (data: { signal: any; sender: string; metadata?: any }) => {
      console.log(`Received signal from ${data.sender}`);
      // Host logic: Signal from Viewer
      if (data.metadata?.viewerId) {
        const peer = peersRef.current[data.metadata.viewerId];
        if (peer) {
          peer.signal(data.signal);
        }
      }
    };

    const handleViewerReady = async ({ viewerId }: { viewerId: string }) => {
      console.log(`Viewer ready for WebRTC: ${viewerId}`);
      // If we have an existing peer, destroy it to restart connection
      if (peersRef.current[viewerId]) {
        peersRef.current[viewerId].destroy();
        delete peersRef.current[viewerId];
      }

      // Check if viewer is approved
      let viewer = viewersRef.current.find(v => v.id === viewerId);

      // Fallback: Fetch latest viewers if not found or not approved (to handle race conditions)
      if (!viewer || viewer.status !== 'approved') {
        console.log('Viewer not found or not approved in local state, fetching from API...');
        try {
          const viewersData = await api.getViewers(session.id);
          const viewersList = Object.values(viewersData) as Viewer[];
          // Update state and ref implicitly via useEffect
          setViewers(viewersList);
          viewer = viewersList.find(v => v.id === viewerId);
        } catch (e) {
          console.error('Failed to fetch viewers for ready check', e);
        }
      }

      if (viewer && viewer.status === 'approved') {
        if (streamRef.current) {
          createPeer(viewer);
        } else {
          console.log(`Stream not ready yet, queueing viewer ${viewerId}`);
          readyViewersRef.current.add(viewerId);
        }
      } else {
        console.warn(`Viewer ${viewerId} is not approved or not found, cannot initiate peer.`);
      }
    };

    const handleViewerConnected = (viewerId: string) => {
      console.log('Viewer connected via socket:', viewerId);
      // We could trigger a refresh of viewers list here
      // But polling handles the list update.
      // This might be used for instant notifications if needed.
    };

    const handleViewerWatching = ({ viewerId }: { viewerId: string }) => {
      console.log(`CONFIRMATION: Viewer ${viewerId} is receiving and watching the stream.`);
      toast.success(`Viewer is now watching the stream!`);
      // Optional: Update viewer status in state to "watching" if you have such a state
    };

    socket.on('signal', handleSignal);
    socket.on('viewer-connected', handleViewerConnected);
    socket.on('viewer-ready', handleViewerReady);
    socket.on('viewer-watching', handleViewerWatching);

    return () => {
      socket.off('connect', joinSession);
      socket.off('signal', handleSignal);
      socket.off('viewer-connected', handleViewerConnected);
      socket.off('viewer-ready', handleViewerReady);
      socket.off('viewer-watching', handleViewerWatching);
      socket.emit('leave-session', session.id);
    };
  }, [session]);

  const createSession = useCallback(async () => {
    try {
      const newSession = await api.createSession();
      setSession(newSession);
      toast.success('Session created successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create session');
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!session) return;
    try {
      await api.endSession(session.id);
      setSession(null);
      setViewers([]);
      Object.values(peersRef.current).forEach(p => p.destroy());
      peersRef.current = {};
      toast.success('Session ended');
    } catch (error) {
      console.error(error);
      toast.error('Failed to end session');
    }
  }, [session]);

  const approveRequest = useCallback(async (viewerId: string) => {
    if (!session) return;
    try {
      // Optimistic update
      setViewers(prev => prev.map(v =>
        v.id === viewerId ? { ...v, status: 'approved' } : v
      ));

      await api.approveViewer(session.id, viewerId);
      toast.success('Viewer approved');
    } catch (error) {
      // Revert on failure
      setViewers(prev => prev.map(v =>
        v.id === viewerId ? { ...v, status: 'waiting' } : v
      ));
      toast.error('Failed to approve viewer');
    }
  }, [session]);

  const rejectRequest = useCallback(async (viewerId: string) => {
    if (!session) return;
    try {
      // Optimistic update
      setViewers(prev => prev.map(v =>
        v.id === viewerId ? { ...v, status: 'rejected' } : v
      ));

      await api.rejectViewer(session.id, viewerId);
      toast.success('Viewer rejected');
    } catch (error) {
      // Revert
      setViewers(prev => prev.map(v =>
        v.id === viewerId ? { ...v, status: 'waiting' } : v
      ));
      toast.error('Failed to reject viewer');
    }
  }, [session]);

  const removeViewer = useCallback(async (viewerId: string) => {
    if (!session) return;
    try {
      // Optimistic update
      setViewers(prev => prev.filter(v => v.id !== viewerId));

      await api.removeViewer(session.id, viewerId);
      if (peersRef.current[viewerId]) {
        peersRef.current[viewerId].destroy();
        delete peersRef.current[viewerId];
      }
      toast.success('Viewer removed');
    } catch (error) {
      // Refresh viewers to revert
      const viewersData = await api.getViewers(session.id);
      setViewers(Object.values(viewersData) as Viewer[]);
      toast.error('Failed to remove viewer');
    }
  }, [session]);

  const startStreaming = useCallback(() => {
    setStreamState(prev => ({ ...prev, isStreaming: true }));
  }, []);

  const stopStreaming = useCallback(() => {
    setStreamState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  const pauseStreaming = useCallback(() => {
    setStreamState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeStreaming = useCallback(() => {
    setStreamState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const toggleMute = useCallback(() => {
    setStreamState(prev => {
      const newMuted = !prev.isMuted;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !newMuted;
        });
      }
      return { ...prev, isMuted: newMuted };
    });
  }, []);

  const updateDuration = useCallback((duration: number) => {
    setStreamState(prev => ({ ...prev, duration }));
  }, []);

  const addPendingRequest = useCallback((req: any) => {
    // Deprecated
  }, []);

  // Sync Viewers (Polling)
  useEffect(() => {
    if (!session) return;

    const fetchViewers = async () => {
      try {
        const viewersData = await api.getViewers(session.id);
        const viewersList = Object.values(viewersData) as Viewer[];
        setViewers(viewersList);
      } catch (error) {
        console.error('Failed to fetch viewers', error);
      }
    };

    fetchViewers();
    const interval = setInterval(fetchViewers, 2000);

    return () => clearInterval(interval);
  }, [session]);

  // Manage WebRTC Peers (Host Side)
  useEffect(() => {
    if (!session) return;

    // Only cleanup removed viewers here
    // Creation is now triggered by 'viewer-ready' event to avoid race conditions
    Object.keys(peersRef.current).forEach(viewerId => {
      if (!viewers.find(v => v.id === viewerId && v.status === 'approved')) {
        if (peersRef.current[viewerId]) {
          peersRef.current[viewerId].destroy();
          delete peersRef.current[viewerId];
        }
      }
    });

  }, [session, viewers]);

  const pendingRequests = viewers.filter(v => v.status === 'waiting');

  return (
    <StreamContext.Provider value={{
      session,
      viewers,
      pendingRequests,
      streamState,
      createSession,
      endSession,
      approveRequest,
      rejectRequest,
      removeViewer,
      setStream,
      stream,
      startStreaming,
      stopStreaming,
      pauseStreaming,
      resumeStreaming,
      toggleMute,
      updateDuration,
      addPendingRequest
    }}>
      {children}
    </StreamContext.Provider>
  );
};
