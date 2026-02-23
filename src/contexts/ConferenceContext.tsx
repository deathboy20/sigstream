import React, { createContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Conference, Participant } from '../types/streaming.types';
import { api } from '../services/api';
import { toast } from 'sonner';
import { conferenceSocket } from '../utils/conferenceSocket';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface ConferenceContextState {
  // Room state
  room: Conference | null;
  participants: Participant[];
  isHost: boolean;
  
  // Media state
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  
  // Chat state
  chatMessages: ChatMessage[];
  
  // Screen share state
  isScreenSharing: boolean;
  screenShareParticipantId: string | null;
  
  // Methods
  createRoom: (name: string, roomMode: 'open' | 'moderated') => Promise<Conference>;
  joinRoom: (roomId: string, participantName: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  approveParticipant: (participantId: string) => Promise<void>;
  rejectParticipant: (participantId: string) => Promise<void>;
  removeParticipant: (participantId: string) => Promise<void>;
  
  // Media methods
  getLocalStream: (videoDevice?: string, audioDevice?: string) => Promise<MediaStream | null>;
  stopLocalStream: () => void;
  toggleLocalVideo: (enabled: boolean) => void;
  toggleLocalAudio: (enabled: boolean) => void;
  
  // Chat methods
  sendChatMessage: (text: string) => void;
  
  // Screen share methods
  startScreenShare: () => Promise<MediaStream | undefined>;
  stopScreenShare: () => Promise<void>;
}

const ConferenceContext = createContext<ConferenceContextState | undefined>(undefined);

export { ConferenceContext, type ConferenceContextState };

export const ConferenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [room, setRoom] = useState<Conference | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareParticipantId, setScreenShareParticipantId] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Create a conference room
  const createRoom = useCallback(async (name: string, roomMode: 'open' | 'moderated') => {
    try {
      const newRoom = await api.createConference({
        name,
        roomMode,
        maxParticipants: 50
      });
      setRoom(newRoom);
      
      // Join as host
      conferenceSocket.emit('join-conference', {
        roomId: newRoom.id,
        participantId: newRoom.createdBy
      });
      
      toast.success('Conference created');
      return newRoom;
    } catch (error) {
      toast.error('Failed to create conference');
      throw error;
    }
  }, [])

  // Join a conference room
  const joinRoom = useCallback(async (roomId: string, participantName: string) => {
    try {
      const participant = await api.requestJoinConference(roomId, participantName);
      
      // Fetch room details
      const roomData = await api.getConference(roomId);
      setRoom(roomData);
      
      // Join socket room
      conferenceSocket.emit('join-conference', {
        roomId,
        participantId: participant.id
      });
      
      if (participant.status === 'active' || roomData.roomMode === 'open') {
        toast.success('Joined conference');
      } else {
        toast.info('Waiting for host approval...');
      }
    } catch (error) {
      toast.error('Failed to join conference');
      throw error;
    }
  }, [])

  // Leave the conference room
  const leaveRoom = useCallback(async () => {
    try {
      if (room && localStreamRef.current) {
        conferenceSocket.emit('leave-conference', {
          roomId: room.id,
          participantId: room.createdBy
        });

        // Cleanup
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);

        // Close all peer connections
        peersRef.current.forEach(peer => {
          peer.close();
        });
        peersRef.current.clear();

        setRoom(null);
        setParticipants([]);
        setRemoteStreams(new Map());
        setChatMessages([]);
      }
    } catch (error) {
      toast.error('Error leaving conference');
    }
  }, [room]);

  // Approve participant (host only)
  const approveParticipant = useCallback(async (participantId: string) => {
    try {
      if (!room) return;
      await api.approveParticipant(room.id, participantId);
      toast.success('Participant approved');
    } catch (error) {
      toast.error('Failed to approve participant');
    }
  }, [room]);

  // Reject participant (host only)
  const rejectParticipant = useCallback(async (participantId: string) => {
    try {
      if (!room) return;
      await api.rejectParticipant(room.id, participantId);
      toast.success('Participant rejected');
    } catch (error) {
      toast.error('Failed to reject participant');
    }
  }, [room]);

  // Remove participant from conference
  const removeParticipant = useCallback(async (participantId: string) => {
    try {
      if (!room) return;
      await api.removeParticipant(room.id, participantId);
      
      // Close peer connection
      const peer = peersRef.current.get(participantId);
      if (peer) {
        peer.close();
        peersRef.current.delete(participantId);
      }
      
      toast.success('Participant removed');
    } catch (error) {
      toast.error('Failed to remove participant');
    }
  }, [room]);

  // Get local media stream
  const getLocalStream = useCallback(async (videoDevice?: string, audioDevice?: string) => {
    try {
      // Stop existing stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: videoDevice
          ? {
              deviceId: { exact: videoDevice },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: audioDevice
          ? { deviceId: { exact: audioDevice } }
          : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      toast.error('Failed to access media devices');
      console.error('Media access error:', error);
      return null;
    }
  }, []);

  // Stop local stream
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  // Toggle local video
  const toggleLocalVideo = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }, []);

  // Toggle local audio
  const toggleLocalAudio = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }, []);

  // Send chat message
  const sendChatMessage = useCallback((text: string) => {
    if (!room || !dataChannelRef.current) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: room.createdBy,
      senderName: 'You',
      text,
      timestamp: Date.now()
    };

    // Send via data channel
    if (dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({
        type: 'chat-message',
        data: message
      }));
    }

    // Add to local state
    setChatMessages(prev => [...prev, message]);
  }, [room]);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      setIsScreenSharing(false);
      setScreenShareParticipantId(null);

      if (room) {
        conferenceSocket.emit('screen-share-stop', {
          roomId: room.id,
          participantId: room.createdBy
        });
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }, [room]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      if (!room) return;

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      // Notify others
      conferenceSocket.emit('screen-share-start', {
        roomId: room.id,
        participantId: room.createdBy
      });

      // Stop screen share when user stops sharing
      screenStream.getVideoTracks()[0].onended = async () => {
        await stopScreenShare();
      };

      return screenStream;
    } catch (error) {
      toast.error('Failed to share screen');
      console.error('Screen share error:', error);
    }
  }, [room, stopScreenShare]);

  // Handle socket events
  useEffect(() => {
    // Screen share started by another participant
    const handleScreenShareStarted = (data: { participantId: string }) => {
      setScreenShareParticipantId(data.participantId);
      toast.info('Participant is sharing screen');
    };

    // Screen share stopped
    const handleScreenShareStopped = () => {
      setScreenShareParticipantId(null);
    };

    // Participant left
    const handleParticipantLeft = (data: { participantId: string }) => {
      const peer = peersRef.current.get(data.participantId);
      if (peer) {
        peer.close();
        peersRef.current.delete(data.participantId);
      }
      
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(data.participantId);
        return next;
      });
    };

    conferenceSocket.on('screen-share-started', handleScreenShareStarted);
    conferenceSocket.on('screen-share-stopped', handleScreenShareStopped);
    conferenceSocket.on('participant-left', handleParticipantLeft);

    return () => {
      conferenceSocket.off('screen-share-started', handleScreenShareStarted);
      conferenceSocket.off('screen-share-stopped', handleScreenShareStopped);
      conferenceSocket.off('participant-left', handleParticipantLeft);
    };
  }, [])

  const value: ConferenceContextState = {
    room,
    participants,
    isHost: room ? participants.length > 0 : false,
    localStream,
    remoteStreams,
    chatMessages,
    isScreenSharing,
    screenShareParticipantId,
    createRoom,
    joinRoom,
    leaveRoom,
    approveParticipant,
    rejectParticipant,
    removeParticipant,
    getLocalStream,
    stopLocalStream,
    toggleLocalVideo,
    toggleLocalAudio,
    sendChatMessage,
    startScreenShare,
    stopScreenShare
  };

  return (
    <ConferenceContext.Provider value={value}>
      {children}
    </ConferenceContext.Provider>
  );
};
