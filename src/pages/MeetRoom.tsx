import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { 
  Mic, MicOff, 
  Video, VideoOff, 
  PhoneOff, 
  MonitorUp, 
  MoreVertical,
  Users,
  MessageSquare,
  Grid,
  ShieldCheck,
  ArrowLeft,
  Lock,
  Unlock,
  Hand,
  Wifi,
  WifiOff,
  Share2,
  Pin,
  Maximize2,
  PictureInPicture2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import DeviceSwitcher from '../components/DeviceSwitcher';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api } from '../services/api';
import { socket } from '../lib/meetSocket';
import { useIsMobile } from '../hooks/use-mobile';
import SimplePeer from 'simple-peer';
import QRCode from 'react-qr-code';
import { auth } from '../services/firebase';
import { useSigtrackContext } from '../hooks/useSigtrackContext';
import MeetChatPanel from '../components/MeetChatPanel';
import { MeetErrorBoundary } from '../components/MeetErrorBoundary';
import { MeetWaitingRoom } from '../components/MeetWaitingRoom';
import { useMeetingPip } from '../hooks/useMeetingPip';
import { IS_STANDALONE } from '../config';
import {
  applySenderBitrate,
  audioConstraints,
  getIceServers,
  getUserMediaForDevice,
  limitSdpBitrate,
  MAX_MEETING_PARTICIPANTS,
  qualityFromStats,
  videoConstraints,
  type ConnectionQuality,
} from '../lib/meetRtc';

interface Participant {
  id: string;
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isScreenSharing?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  userId?: string;
  connectionQuality?: ConnectionQuality;
}

const labelForPeer = (remote?: { name?: string; teamName?: string } | null) =>
  (remote?.teamName || remote?.name || '').trim();

interface MeetingData {
  id: string;
  hostId?: string;
  hostName: string;
  title?: string;
  participants?: Array<{ id: string; name: string; role?: string; teamName?: string }>;
}

interface ChatMessage {
  sessionId: string;
  message: string;
  senderName: string;
  senderId: string;
  timestamp: number;
  type?: 'public' | 'private';
  recipientIds?: string[];
  fileUrl?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: number;
  mimeType?: string;
  status?: 'uploading' | 'failed' | 'sent';
  uploadProgress?: number;
  id?: string;
  text?: string;
}

interface ReactionData {
  sessionId: string;
  reaction: string;
  senderName: string;
  senderId: string;
  offset?: number;
}

interface PendingJoin {
  viewerId: string;
  name: string;
}

interface SessionParticipantsPayload {
  sessionId: string;
  participants: Array<{ viewerId: string; name?: string; teamName?: string; isHost?: boolean; userId?: string }>;
}

// Screen share is supported on desktop; on mobile only Android Chrome typically supports getDisplayMedia
const canScreenShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

const attachStreamToVideo = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
  if (!el) return;
  if (el.srcObject === stream) {
    if (stream && el.paused) void el.play().catch(() => undefined);
    return;
  }
  el.srcObject = stream;
  if (stream) void el.play().catch(() => undefined);
};

const getMeetingUserMedia = async (
  preferred?: { videoDeviceId?: string; audioDeviceId?: string },
  peerCount = 1,
) => {
  const attempts: MediaStreamConstraints[] = [];
  if (preferred?.videoDeviceId) {
    attempts.push({
      video: videoConstraints(preferred.videoDeviceId, peerCount, true),
      audio: audioConstraints(preferred.audioDeviceId),
    });
  }
  attempts.push({
    video: videoConstraints(preferred?.videoDeviceId, peerCount),
    audio: audioConstraints(preferred?.audioDeviceId),
  });
  attempts.push({ video: true, audio: audioConstraints(preferred?.audioDeviceId) });
  attempts.push({ video: videoConstraints(preferred?.videoDeviceId, peerCount), audio: false });
  attempts.push({ video: false, audio: audioConstraints(preferred?.audioDeviceId) });

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const MeetRoom: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { user } = useAuth();
  const userId = user?.uid;
  const sigtrack = useSigtrackContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Media device management
  const {
    videoDevices,
    audioDevices,
    selectedDevices,
    selectDevice,
    syncSelectedFromStream,
  } = useMediaDevices();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [activeSidebar, setActiveSidebar] = useState<'none' | 'chat' | 'participants' | 'info'>('none');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Array<ReactionData & { id: string }>>([]);
  const [guestName, setGuestName] = useState(sigtrack.teamName || '');
  const guestNameRef = useRef('');
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const [localPinId, setLocalPinId] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingJoin[]>([]);
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [networkQuality, setNetworkQuality] = useState<'good' | 'fair' | 'poor' | 'unknown'>('unknown');
  const [hasAdaptedQuality, setHasAdaptedQuality] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [meetingLocked, setMeetingLocked] = useState(false);
  const [waitingStatus, setWaitingStatus] = useState<'knocking' | 'locked' | 'full' | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const peersRef = useRef<{ [key: string]: SimplePeer.Instance }>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const selfTileRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingScreenShareRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const userPinnedRef = useRef(false);
  const lastPoorToastRef = useRef(0);
  const speakingSinceRef = useRef<Record<string, number>>({});
  const recordedChunksRef = useRef<Blob[]>([]);
  const wasDisconnectedRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const announcedSocketIdRef = useRef<string | null>(null);
  const lastJoinedIdentityRef = useRef<string | null>(null);
  const meetingDataRef = useRef<MeetingData | null>(null);
  meetingDataRef.current = meetingData;

  const pipStream = isScreenSharing && displayStream ? displayStream : localStream;
  const { pipVideoRef, isPipOpen, openPip, closePip } = useMeetingPip({
    enabled: hasJoined && !waitingApproval,
    stream: pipStream,
    title: meetingData?.title || 'WAR ROOM',
    mirror: !(isScreenSharing && !!displayStream),
  });

  useEffect(() => {
    hasJoinedRef.current = hasJoined;
  }, [hasJoined]);

  useEffect(() => {
    if (!meetingId || !user) return;
    let cancelled = false;
    api.listMessages(meetingId)
      .then((list) => {
        if (cancelled) return;
        const mapped = list.map((m) => ({
          sessionId: meetingId,
          message: m.text || '',
          text: m.text,
          senderName: m.senderName,
          senderId: m.senderId,
          timestamp: m.timestamp,
          type: m.type,
          recipientIds: m.recipientIds,
          fileUrl: m.fileUrl,
          fileName: m.fileName,
          fileId: m.fileId,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          status: 'sent' as const,
          id: m.id,
        }));
        setMessages((prev) => {
          const byId = new Map<string, ChatMessage>();
          mapped.forEach((m) => { if (m.id) byId.set(m.id, m); });
          prev.forEach((m) => {
            if (m.id && !byId.has(m.id)) byId.set(m.id, m);
          });
          return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [meetingId, userId, hasJoined]);

  const roomLabel = (sigtrack.teamName || user?.displayName || guestName || 'Guest').trim();
  const resolvedDisplayName = roomLabel;

  useEffect(() => {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(localStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let speaking = false;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const next = speaking ? avg > 10 : avg > 22;
      if (next !== speaking) {
        speaking = next;
        setLocalSpeaking(next);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [localStream]);

  useEffect(() => {
    const onMedia = (data: { viewerId: string; isScreenSharing?: boolean; isMuted?: boolean; isVideoOff?: boolean }) => {
      setParticipants((prev) => prev.map((p) => {
        if (p.id !== data.viewerId) return p;
        const isScreenSharing = !!data.isScreenSharing;
        const isMuted = typeof data.isMuted === 'boolean' ? data.isMuted : p.isMuted;
        const isVideoOff = typeof data.isVideoOff === 'boolean' ? data.isVideoOff : p.isVideoOff;
        if (p.isScreenSharing === isScreenSharing && p.isMuted === isMuted && p.isVideoOff === isVideoOff) return p;
        return { ...p, isScreenSharing, isMuted, isVideoOff };
      }));
      if (data.isScreenSharing && data.viewerId !== socket.id && !localPinId) {
        setPinnedId(data.viewerId);
      }
    };
    socket.on('media-state', onMedia);
    return () => {
      socket.off('media-state', onMedia);
    };
  }, [localPinId]);

  const showChatPanel = useCallback(() => {
    if (isMobile) {
      setChatOpen(true);
      return;
    }
    setActiveSidebar('chat');
  }, [isMobile]);

  const appendLocalChat = useCallback((msg: {
    id: string;
    text?: string;
    senderName: string;
    senderId: string;
    timestamp: number;
    type: 'public' | 'private';
    recipientIds?: string[];
    fileUrl?: string;
    fileName?: string;
    fileId?: string;
    fileSize?: number;
    mimeType?: string;
    status?: 'uploading' | 'failed' | 'sent';
    uploadProgress?: number;
  }) => {
    setMessages((prev) => {
      const mapped: ChatMessage = {
        sessionId: meetingId!,
        message: msg.text || '',
        senderName: msg.senderName,
        senderId: msg.senderId,
        timestamp: msg.timestamp,
        type: msg.type,
        recipientIds: msg.recipientIds,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileId: msg.fileId,
        fileSize: msg.fileSize,
        mimeType: msg.mimeType,
        status: msg.status,
        uploadProgress: msg.uploadProgress,
        id: msg.id,
        text: msg.text,
      };
      if (msg.id) {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...prev[idx], ...mapped };
          return next;
        }
      }
      return [...prev, mapped];
    });
  }, [meetingId]);

  // Listen for chat and reactions
  useEffect(() => {
    const isChatVisible = isMobile ? chatOpen : activeSidebar === 'chat';
    const myId = user?.uid || socket.id || '';

    const ingestChat = (msg: ChatMessage) => {
      if (msg.type === 'private') {
        const recipients = msg.recipientIds || [];
        const selfIds = [user?.uid, socket.id, myId].filter(Boolean) as string[];
        if (!selfIds.includes(msg.senderId) && !recipients.some((id) => selfIds.includes(id))) return;
      }
      let isUpdate = false;
      setMessages((prev) => {
        if (msg.id) {
          const idx = prev.findIndex((m) => m.id === msg.id);
          if (idx >= 0) {
            isUpdate = true;
            const next = [...prev];
            next[idx] = {
              ...prev[idx],
              ...msg,
              message: msg.message || msg.text || prev[idx].message,
              text: msg.text || msg.message || prev[idx].text,
              fileUrl: msg.fileUrl ?? prev[idx].fileUrl,
              fileName: msg.fileName ?? prev[idx].fileName,
              fileId: msg.fileId ?? prev[idx].fileId,
              fileSize: msg.fileSize ?? prev[idx].fileSize,
              mimeType: msg.mimeType ?? prev[idx].mimeType,
              status: msg.status || (msg.fileUrl ? 'sent' : prev[idx].status),
              uploadProgress: msg.uploadProgress ?? (msg.fileUrl ? 100 : prev[idx].uploadProgress),
            };
            return next;
          }
        }
        const sameLive = prev.some((m) =>
          m.senderId === msg.senderId
          && m.timestamp === msg.timestamp
          && (m.text || m.message) === (msg.text || msg.message)
          && (m.fileUrl || '') === (msg.fileUrl || '')
        );
        if (sameLive) return prev;
        return [...prev, {
          ...msg,
          message: msg.message || msg.text || '',
          text: msg.text || msg.message,
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          fileId: msg.fileId,
          fileSize: msg.fileSize,
          mimeType: msg.mimeType,
          status: msg.status || (msg.fileUrl ? 'sent' : undefined),
          uploadProgress: msg.uploadProgress,
        }];
      });
      if (!isUpdate && !isChatVisible && msg.senderId !== myId) {
        setUnreadChatCount((count) => count + 1);
        const body = msg.text || msg.message || '';
        const mentioned = resolvedDisplayName && body.toLowerCase().includes(`@${resolvedDisplayName.toLowerCase()}`);
        if (mentioned) {
          toast.info(`${msg.senderName} mentioned you`, {
            description: body.substring(0, 80),
            action: { label: 'View', onClick: showChatPanel },
          });
        } else if (msg.fileName && !body) {
          toast.info(`${msg.senderName} is sharing a file`, {
            description: msg.fileName,
            action: { label: 'View', onClick: showChatPanel },
          });
        } else {
          const preview = body.substring(0, 30);
          toast.info(`${msg.type === 'private' ? 'Private message' : 'New message'} from ${msg.senderName}`, {
            description: preview + (body.length > 30 ? '...' : ''),
            action: {
              label: 'View',
              onClick: showChatPanel
            },
          });
        }
      }
    };

    const onUploadStart = (msg: ChatMessage) => {
      ingestChat({
        ...msg,
        sessionId: msg.sessionId || meetingId!,
        message: msg.text || '',
        status: 'uploading',
        uploadProgress: msg.uploadProgress ?? 0,
      });
    };

    const onUploadProgress = (data: { id?: string; progress?: number }) => {
      if (!data?.id) return;
      setMessages((prev) => prev.map((m) => (
        m.id === data.id
          ? { ...m, status: 'uploading', uploadProgress: data.progress ?? m.uploadProgress }
          : m
      )));
    };

    const onUploadCancel = (data: { id?: string }) => {
      if (!data?.id) return;
      setMessages((prev) => prev.map((m) => (
        m.id === data.id ? { ...m, status: 'failed' as const } : m
      )));
    };

    socket.on('chat-message', ingestChat);
    socket.on('private-message', ingestChat);
    socket.on('file-upload-start', onUploadStart);
    socket.on('file-upload-progress', onUploadProgress);
    socket.on('file-upload-cancel', onUploadCancel);

    socket.on('reaction', (data: ReactionData) => {
      const id = Math.random().toString(36).substring(7);
      setReactions((prev) => [...prev, { ...data, id, offset: 42 + Math.random() * 16 }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter(r => r.id !== id));
      }, 3000);
    });

    return () => {
      socket.off('chat-message', ingestChat);
      socket.off('private-message', ingestChat);
      socket.off('file-upload-start', onUploadStart);
      socket.off('file-upload-progress', onUploadProgress);
      socket.off('file-upload-cancel', onUploadCancel);
      socket.off('reaction');
    };
  }, [activeSidebar, chatOpen, isMobile, meetingId, showChatPanel, user?.uid, resolvedDisplayName]);

  const sendReaction = (emoji: string) => {
    socket.emit('reaction', {
      sessionId: meetingId!,
      reaction: emoji,
      senderName: roomLabel,
      senderId: (user?.uid || socket.id)
    });
    
    // Show local reaction too
    const id = Math.random().toString(36).substring(7);
    setReactions((prev) => [
      ...prev, 
      { 
        sessionId: meetingId!, 
        reaction: emoji, 
        senderName: 'You', 
        senderId: (user?.uid || socket.id || 'anonymous'),
        id,
        offset: 42 + Math.random() * 16,
      }
    ]);
    setTimeout(() => {
      setReactions((prev) => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const copyMeetingLink = async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Meeting link copied to clipboard!");
    } catch {
      toast.error('Could not copy link. Please copy it manually.');
    }
  };

  useEffect(() => {
    attachStreamToVideo(
      localVideoRef.current,
      isScreenSharing && displayStream ? displayStream : localStream
    );
    attachStreamToVideo(cameraPreviewRef.current, cameraStream);
    attachStreamToVideo(selfTileRef.current, isScreenSharing ? cameraStream : localStream);
  }, [localStream, cameraStream, displayStream, isScreenSharing]);

  useEffect(() => {
    guestNameRef.current = guestName.trim();
  }, [guestName]);

  useEffect(() => {
    if (!guestName && sigtrack.teamName) {
      setGuestName(sigtrack.teamName);
    }
  }, [sigtrack.teamName, guestName]);

  // Fetch meeting data and check if user is host
  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const data = user ? await api.getMeeting(meetingId!) : await api.getMeetingPublic(meetingId!);
        setMeetingData(data);
        if (user && data.hostId === user.uid) {
          setIsHost(true);
        }
      } catch (err) {
        console.error("Failed to fetch meeting data", err);
        toast.error("Meeting not found");
        navigate('/meet');
      }
    };
    fetchMeeting();
  }, [meetingId, userId, navigate]);

  const cleanupMeetingState = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    peersRef.current = {};
    localStream?.getTracks().forEach(track => track.stop());
    setParticipants([]);
    setPendingRequests([]);
    setHasJoined(false);
  }, [localStream]);

  useEffect(() => {
    const start = async () => {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      socket.auth = token ? { token } : {};
      if (!socket.connected) socket.connect();
    };
    void start();
    return () => {
      if (socket.connected) socket.disconnect();
    };
  }, []);

  useEffect(() => {
    localStreamRef.current = localStream;
    if (!localStream) return;
    Object.values(peersRef.current).forEach((peer) => {
      if (peer.destroyed) return;
      localStream.getTracks().forEach((track) => {
        try {
          const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
          const sender = pc?.getSenders().find((s) => s.track?.kind === track.kind);
          if (sender) {
            if (sender.track?.id !== track.id) void sender.replaceTrack(track);
            return;
          }
          peer.addTrack(track, localStream);
        } catch {
          /* peer may still be negotiating */
        }
      });
    });
  }, [localStream]);

  useEffect(() => {
    const canJoin = !!meetingId && !hasJoined && (!!user || guestReady);
    if (!canJoin) return;
    const init = async () => {
      try {
        if (user) {
          // Try to get media devices, but allow joining without them
          try {
            if (!localStreamRef.current) {
              let preferred: { videoDeviceId?: string; audioDeviceId?: string } | undefined;
              let inputType: 'camera' | 'screen' = 'camera';
              let startMuted = false;
              try {
                const setupRaw = sessionStorage.getItem('meetSetupContext');
                if (setupRaw) {
                  const setup = JSON.parse(setupRaw) as {
                    videoDeviceId?: string;
                    audioDeviceId?: string;
                    muted?: boolean;
                    inputType?: 'camera' | 'screen';
                  };
                  preferred = {
                    videoDeviceId: setup.videoDeviceId,
                    audioDeviceId: setup.audioDeviceId,
                  };
                  inputType = setup.inputType === 'screen' ? 'screen' : 'camera';
                  startMuted = !!setup.muted;
                }
              } catch { /* ignore */ }
              const stream = await getMeetingUserMedia(preferred);
              if (startMuted) {
                stream.getAudioTracks().forEach((track) => { track.enabled = false; });
                setIsMuted(true);
              }
              localStreamRef.current = stream;
              setLocalStream(stream);
              syncSelectedFromStream(stream);
              attachStreamToVideo(localVideoRef.current, stream);
              if (inputType === 'screen') {
                pendingScreenShareRef.current = true;
              }
            }
          } catch (mediaError) {
            console.warn('Could not access camera/microphone, joining without media:', mediaError);
            toast.info('Joined meeting without camera/microphone. You can still see and hear others.');
          }
          socket.emit('join-session', { sessionId: meetingId, userId: user.uid, name: (sigtrack.teamName || user.displayName || 'Guest').trim(), teamId: sigtrack.teamId || undefined, teamName: sigtrack.teamName || undefined, orgDocId: sigtrack.orgDocId || undefined, orgName: sigtrack.orgName || undefined, userType: sigtrack.userType || undefined });
        } else {
          socket.emit('join-request', { sessionId: meetingId!, name: guestName.trim() });
          setWaitingApproval(true);
          setWaitingStatus('knocking');
        }
      } catch (err) {
        toast.error("Could not join meeting");
      }
    };
    init();
  }, [meetingId, userId, guestReady, hasJoined]);

  useEffect(() => {
    socket.on('pending-join', (data: PendingJoin) => {
      if (isHost) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = 880;
          o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
          o.start(); o.stop(ctx.currentTime + 0.4);
        } catch {}
        toast.info(`${data.name} is requesting to join`, { duration: 3000 });
      }
      setPendingRequests(prev => {
        if (prev.find(p => p.viewerId === data.viewerId)) return prev;
        return [...prev, data];
      });
    });

    socket.on('pending-requests-updated', ({ viewerId }: { viewerId: string }) => {
      setPendingRequests(prev => prev.filter(p => p.viewerId !== viewerId));
    });
    socket.on('join-accepted', () => {
      setWaitingStatus(null);
      setWaitingApproval(false);
      setHasJoined(true);
      if (announcedSocketIdRef.current === socket.id) return;
      announcedSocketIdRef.current = socket.id || null;
      socket.emit('viewer-connected', {
        sessionId: meetingId!,
        viewerId: socket.id,
        name: (sigtrack.teamName || user?.displayName || guestNameRef.current || guestName.trim() || 'Guest').trim(),
      });
    });
    socket.on('join-waiting', () => {
      setWaitingApproval(true);
      setWaitingStatus('knocking');
    });
    socket.on('join-approved', async (payload?: { approvedName?: string }) => {
      try {
        const approvedName = payload?.approvedName?.trim() || guestName.trim() || 'Guest';
        guestNameRef.current = approvedName;
        setGuestName(approvedName);
        // Try to get media devices, but allow joining without them
        try {
          let preferred: { videoDeviceId?: string; audioDeviceId?: string } | undefined;
          try {
            const setupRaw = sessionStorage.getItem('meetSetupContext');
            if (setupRaw) {
              const setup = JSON.parse(setupRaw) as { videoDeviceId?: string; audioDeviceId?: string };
              preferred = { videoDeviceId: setup.videoDeviceId, audioDeviceId: setup.audioDeviceId };
            }
          } catch { /* ignore */ }
          const stream = await getMeetingUserMedia(preferred);
          setLocalStream(stream);
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          syncSelectedFromStream(stream);
          if (preferred?.videoDeviceId) selectDevice('video', preferred.videoDeviceId);
        } catch (mediaError) {
          console.warn('Could not access camera/microphone, joining without media:', mediaError);
          toast.info('Joined meeting without camera/microphone. You can still see and hear others.');
        }
        socket.emit('join-session', { sessionId: meetingId!, name: approvedName });
        setHasJoined(true);
        setWaitingApproval(false);
        setWaitingStatus(null);
        socket.emit('viewer-ready', { sessionId: meetingId!, viewerId: socket.id });
        void api.getMeetingPublic(meetingId!).then(setMeetingData).catch(() => {});
      } catch (err) {
        toast.error('Could not join meeting');
      }
    });
    socket.on('join-rejected', () => {
      setWaitingApproval(false);
      setWaitingStatus(null);
      toast.error('Join request rejected');
    });
    socket.on('join-error', (payload: { error?: string }) => {
      setIsEndingMeeting(false);
      toast.error(payload?.error || 'Unable to join meeting');
    });
    socket.on('meeting-locked', () => {
      setHasJoined(false);
      setWaitingApproval(true);
      setWaitingStatus('locked');
    });
    socket.on('room-full', (payload?: { maxParticipants?: number }) => {
      setHasJoined(false);
      setWaitingApproval(true);
      setWaitingStatus('full');
      toast.error(`This meeting is full (${payload?.maxParticipants || MAX_MEETING_PARTICIPANTS} people).`);
    });
    socket.on('meeting-lock-updated', (payload: { locked?: boolean }) => {
      setMeetingLocked(!!payload.locked);
      toast.info(payload.locked ? 'Host locked the meeting' : 'Host unlocked the meeting');
    });
    socket.on('hands-cleared', () => {
      setIsHandRaised(false);
      setRaisedHands([]);
    });
    socket.on('room-state', (payload: {
      locked?: boolean;
      pinnedId?: string | null;
      participants?: Array<{ viewerId: string; name: string; teamName?: string; userId?: string; isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean; handRaised?: boolean }>;
    }) => {
      setMeetingLocked(!!payload.locked);
      if (payload.pinnedId) {
        setPinnedId((current) => current === payload.pinnedId ? current : payload.pinnedId || null);
      } else if (!userPinnedRef.current && payload.pinnedId === null) {
        setPinnedId((current) => (current ? null : current));
      }
      if (payload.participants) {
        setRaisedHands(payload.participants.filter((p) => p.handRaised).map((p) => p.viewerId));
        setParticipants((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          let changed = false;
          payload.participants!.forEach((remote) => {
            if (remote.viewerId === socket.id) return;
            const existing = byId.get(remote.viewerId);
            const next: Participant = {
              id: remote.viewerId,
              name: labelForPeer(remote) || existing?.name || 'Guest',
              stream: existing?.stream || null,
              isMuted: remote.isMuted,
              isVideoOff: remote.isVideoOff,
              isScreenSharing: remote.isScreenSharing,
              connectionQuality: existing?.connectionQuality,
              isSpeaking: existing?.isSpeaking,
              userId: remote.userId || existing?.userId,
            };
            if (!existing || existing.name !== next.name || existing.isMuted !== next.isMuted || existing.isVideoOff !== next.isVideoOff || existing.isScreenSharing !== next.isScreenSharing || existing.userId !== next.userId) {
              byId.set(remote.viewerId, next);
              changed = true;
            }
          });
          return changed ? Array.from(byId.values()) : prev;
        });
      }
    });
    socket.on('viewer-left', ({ viewerId }: { viewerId: string }) => {
      const peer = peersRef.current[viewerId];
      if (peer) {
        peer.destroy();
        delete peersRef.current[viewerId];
      }
      setParticipants(prev => prev.filter(p => p.id !== viewerId));
      setPendingRequests(prev => prev.filter(p => p.viewerId !== viewerId));
    });
    socket.on('meeting-ended', () => {
      toast.error('Meeting has ended');
      setIsEndingMeeting(false);
      cleanupMeetingState();
      socket.emit('leave-session', meetingId);
      navigate('/meet');
    });
    socket.on('meeting-end-error', (payload: { error?: string }) => {
      setIsEndingMeeting(false);
      toast.error(payload?.error || 'Failed to end meeting');
    });
    socket.on('host-left', () => {
      toast.warning('Host has left the meeting');
    });
    return () => {
      socket.off('pending-join');
      socket.off('pending-requests-updated');
      socket.off('join-waiting');
      socket.off('join-accepted');
      socket.off('join-approved');
      socket.off('join-rejected');
      socket.off('join-error');
      socket.off('meeting-locked');
      socket.off('room-full');
      socket.off('meeting-lock-updated');
      socket.off('hands-cleared');
      socket.off('room-state');
      socket.off('viewer-left');
      socket.off('meeting-ended');
      socket.off('meeting-end-error');
      socket.off('host-left');
    };
  }, [meetingId, isHost, navigate, cleanupMeetingState, guestName]);

  // If the user signs in after joining as guest, upgrade identity once — never on meetingData churn
  useEffect(() => {
    if (!meetingId || !hasJoined) {
      lastJoinedIdentityRef.current = null;
      return;
    }
    const identity = user?.uid || `guest:${guestNameRef.current || 'anon'}`;
    const previous = lastJoinedIdentityRef.current;
    lastJoinedIdentityRef.current = identity;
    if (!user || !previous || previous === identity) {
      if (user && meetingData?.hostId === user.uid) setIsHost(true);
      return;
    }
    socket.emit('join-session', { sessionId: meetingId, userId: user.uid, name: (sigtrack.teamName || user.displayName || guestName || 'Guest').trim(), teamId: sigtrack.teamId || undefined, teamName: sigtrack.teamName || undefined, orgDocId: sigtrack.orgDocId || undefined, orgName: sigtrack.orgName || undefined, userType: sigtrack.userType || undefined });
    if (meetingData?.hostId === user.uid) setIsHost(true);
  }, [userId, meetingId, hasJoined, meetingData?.hostId, guestName]);

  // Handle peer commands (from host) — use direct track updates so mute-all works reliably
  useEffect(() => {
    socket.on('peer-command', (data: { command: string, value?: any }) => {
      console.log("Received peer command:", data);
      switch (data.command) {
        case 'mute':
        case 'mute-all':
          if (localStream) {
            localStream.getAudioTracks().forEach(track => { track.enabled = false; });
            setIsMuted(true);
            socket.emit('media-state', { sessionId: meetingId, isScreenSharing, isMuted: true, isVideoOff });
          }
          toast.info("Host has muted you");
          break;
        case 'unmute':
        case 'unmute-all':
          if (localStream) {
            localStream.getAudioTracks().forEach(track => { track.enabled = true; });
            setIsMuted(false);
            socket.emit('media-state', { sessionId: meetingId, isScreenSharing, isMuted: false, isVideoOff });
          }
          toast.info("Host has unmuted you");
          break;
        case 'close-video':
        case 'close-video-all':
          if (localStream) {
            localStream.getVideoTracks().forEach(track => { track.enabled = false; });
            setIsVideoOff(true);
            socket.emit('media-state', { sessionId: meetingId, isScreenSharing, isMuted, isVideoOff: true });
          }
          toast.info("Host has closed your video");
          break;
        case 'open-video':
        case 'open-video-all':
          if (localStream) {
            localStream.getVideoTracks().forEach(track => { track.enabled = true; });
            setIsVideoOff(false);
            socket.emit('media-state', { sessionId: meetingId, isScreenSharing, isMuted, isVideoOff: false });
          }
          toast.info("Host has opened your video");
          break;
        case 'remove':
          toast.error("You have been removed from the meeting");
          handleLeave();
          break;
        default:
          break;
      }
    });

    return () => {
      socket.off('peer-command');
    };
  }, [localStream]);

  // Network quality via Network Information API (fallback to unknown)
  useEffect(() => {
    const navAny = navigator as any;
    const conn = navAny?.connection || navAny?.mozConnection || navAny?.webkitConnection;
    if (!conn) return;

    const update = () => {
      const type = conn.effectiveType as string | undefined;
      if (!type) {
        setNetworkQuality('unknown');
        return;
      }
      if (type === '4g') setNetworkQuality('good');
      else if (type === '3g') setNetworkQuality('fair');
      else setNetworkQuality('poor');
    };

    conn.addEventListener('change', update);
    update();
    return () => conn.removeEventListener('change', update);
  }, []);

  // Simple quality adaptation: when network is poor, lower video resolution once
  useEffect(() => {
    if (networkQuality !== 'poor' || !localStream || hasAdaptedQuality) return;

    (async () => {
      try {
        const currentVideo = localStream.getVideoTracks()[0];
        if (!currentVideo) return;
        const currentDeviceId = currentVideo.getSettings().deviceId || selectedDevices.videoDeviceId || undefined;
        const lowStream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(currentDeviceId ? { deviceId: { exact: currentDeviceId } } : {}),
            width: { ideal: 640 },
            height: { ideal: 360 },
          },
        });
        const lowTrack = lowStream.getVideoTracks()[0];
        if (!lowTrack) return;

        localStream.removeTrack(currentVideo);
        localStream.addTrack(lowTrack);

        Object.values(peersRef.current).forEach(peer => {
          // @ts-ignore SimplePeer typings
          peer.replaceTrack(currentVideo, lowTrack, localStream);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        setHasAdaptedQuality(true);
        toast.info('Network is poor – switched to lower video quality');
      } catch (e) {
        console.error('Failed to adapt video quality', e);
      }
    })();
  }, [networkQuality, localStream, hasAdaptedQuality]);

  // Raised hands, pin/spotlight, host transfer, and reconnect handling
  useEffect(() => {
    const onHandUpdated = (data: { viewerId: string; raised: boolean }) => {
      setRaisedHands(prev => {
        if (data.raised) {
          if (prev.includes(data.viewerId)) return prev;
          return [...prev, data.viewerId];
        }
        return prev.filter(id => id !== data.viewerId);
      });
    };

    const onPinnedUpdated = (data: { targetId: string | null }) => {
      setPinnedId(data.targetId || null);
    };

    const onHostTransferred = (data: { sessionId: string; newHostUserId: string; newHostName?: string; targetSocketId: string }) => {
      setMeetingData(prev => prev ? { ...prev, hostId: data.newHostUserId, hostName: data.newHostName || prev.hostName } : prev);
      if (user?.uid) {
        setIsHost(data.newHostUserId === user.uid);
      }
      toast.info(`Host role moved to ${data.newHostName || 'another participant'}`);
    };

    const onHostTransferError = (data: { reason?: string }) => {
      toast.error(data?.reason || 'Failed to transfer host');
    };

    const onDisconnect = () => {
      wasDisconnectedRef.current = true;
      announcedSocketIdRef.current = null;
      if (meetingId && (user || guestReady) && hasJoinedRef.current) {
        toast.warning('Connection lost. Attempting to rejoin…');
      }
    };

    const onConnect = () => {
      if (!wasDisconnectedRef.current) return;
      wasDisconnectedRef.current = false;
      if (!meetingId || !(user || guestReady) || !hasJoinedRef.current) return;
      toast.success('Reconnected to meeting');
      if (user) {
        socket.emit('join-session', { sessionId: meetingId, userId: user.uid, name: (sigtrack.teamName || user.displayName || guestNameRef.current || guestName.trim() || 'Guest').trim(), teamId: sigtrack.teamId || undefined, teamName: sigtrack.teamName || undefined, orgDocId: sigtrack.orgDocId || undefined, orgName: sigtrack.orgName || undefined, userType: sigtrack.userType || undefined });
        if (meetingData?.hostId === user.uid) setIsHost(true);
      } else {
        socket.emit('join-session', { sessionId: meetingId, name: guestNameRef.current || guestName.trim() || 'Guest' });
      }
    };

    socket.on('hand-updated', onHandUpdated);
    socket.on('pinned-updated', onPinnedUpdated);
    socket.on('host-transferred', onHostTransferred);
    socket.on('host-transfer-error', onHostTransferError);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);

    return () => {
      socket.off('hand-updated', onHandUpdated);
      socket.off('pinned-updated', onPinnedUpdated);
      socket.off('host-transferred', onHostTransferred);
      socket.off('host-transfer-error', onHostTransferError);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, [meetingId, userId, guestReady, guestName]);

  useEffect(() => {
    if (!meetingId || !hasJoined) return;

    const nameFromMeeting = (viewerId: string) => {
      const row = meetingDataRef.current?.participants?.find(p => p.id === viewerId);
      return (row?.teamName || row?.name || '').trim();
    };

    const resolveRemoteName = (viewerId: string, incoming?: string) => {
      const fromIncoming = (incoming || '').trim();
      if (fromIncoming) return fromIncoming;
      const fromMeeting = nameFromMeeting(viewerId);
      if (fromMeeting) return fromMeeting;
      return 'Guest';
    };

    const upsertParticipant = (viewerId: string, stream: MediaStream | null, name?: string, userId?: string) => {
      setParticipants(prev => {
        const existingIndex = prev.findIndex(p => p.id === viewerId);
        const resolved = resolveRemoteName(viewerId, name);
        if (existingIndex === -1) {
          return [...prev, { id: viewerId, stream, name: resolved, userId }];
        }
        const existing = prev[existingIndex];
        const nextStream = stream ?? existing.stream;
        const mergedName = (name || '').trim()
          ? (name || '').trim()
          : existing.name && existing.name !== 'Guest'
            ? existing.name
            : resolved;
        const nextUserId = userId || existing.userId;
        if (existing.stream === nextStream && existing.name === mergedName && existing.userId === nextUserId) {
          return prev;
        }
        const next = [...prev];
        next[existingIndex] = {
          ...existing,
          stream: nextStream,
          name: mergedName,
          userId: nextUserId,
        };
        return next;
      });
    };

    const shouldInitiate = (remoteId: string) => (socket.id || '').localeCompare(remoteId) < 0;

    const createPeer = (remoteId: string, initiator: boolean, remoteName?: string) => {
      if (peersRef.current[remoteId]) return peersRef.current[remoteId];
      
      const peerCount = Math.max(1, Object.keys(peersRef.current).length);
      const peerOptions: SimplePeer.Options = {
        initiator,
        trickle: false,
        offerOptions: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        },
        config: {
          iceServers: getIceServers()
        },
        sdpTransform: (sdp: string) => limitSdpBitrate(sdp, peerCount),
      };

      if (localStreamRef.current) {
        peerOptions.stream = localStreamRef.current;
      }

      const peer = new SimplePeer(peerOptions);

      // Initiator with no local media: createOffer can lack m-lines; recvonly transceivers fix that.
      // Answerer path uses the remote offer's m-lines, so avoid extra transceiverRequest noise.
      if (!localStreamRef.current && initiator) {
        try {
          if (typeof (peer as any).addTransceiver === 'function') {
            (peer as any).addTransceiver('audio', { direction: 'recvonly' });
            (peer as any).addTransceiver('video', { direction: 'recvonly' });
          } else if ((peer as any)._pc && typeof (peer as any)._pc.addTransceiver === 'function') {
            (peer as any)._pc.addTransceiver('audio', { direction: 'recvonly' });
            (peer as any)._pc.addTransceiver('video', { direction: 'recvonly' });
          }
        } catch (e) {
          console.warn('MeetRoom: recvonly transceivers', e);
        }
      }

      peer.on('signal', (signal: unknown) => {
        socket.emit('signal', {
          target: remoteId,
          signal,
          sessionId: meetingId,
          metadata: {
            name: (sigtrack.teamName || user?.displayName || guestNameRef.current || guestName.trim() || 'Guest').trim()
          }
        });
      });

      peer.on('connect', () => {
        applySenderBitrate(peer as unknown as { _pc?: RTCPeerConnection }, Math.max(1, Object.keys(peersRef.current).length));
      });

      peer.on('stream', (stream: MediaStream) => {
        upsertParticipant(remoteId, stream, remoteName);
      });

      peer.on('close', () => {
        delete peersRef.current[remoteId];
        setParticipants(prev => prev.filter(p => p.id !== remoteId));
      });

      peer.on('error', () => {
        try {
          const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
          pc?.restartIce?.();
        } catch {
          delete peersRef.current[remoteId];
        }
      });

      peersRef.current[remoteId] = peer;
      return peer;
    };

    const handleViewerConnected = ({ viewerId, name, userId, teamName }: { viewerId: string; name?: string; userId?: string; teamName?: string }) => {
      if (viewerId === socket.id) return;
      upsertParticipant(viewerId, null, labelForPeer({ name, teamName }) || name, userId);
      if (!shouldInitiate(viewerId)) return;
      createPeer(viewerId, true, labelForPeer({ name, teamName }) || name);
    };

    const handleSessionParticipants = ({ participants: existingParticipants }: SessionParticipantsPayload) => {
      // Merge only — do not drop local rows that are briefly missing from a racing payload.
      // Removals are handled by `viewer-left`.
      existingParticipants.forEach(({ viewerId, name, userId, teamName }) => {
        if (viewerId === socket.id) return;
        const label = labelForPeer({ name, teamName }) || name;
        upsertParticipant(viewerId, null, label, userId);
        if (!peersRef.current[viewerId] && shouldInitiate(viewerId)) {
          createPeer(viewerId, true, label);
        }
      });
    };

    const handleSignal = ({ signal, sender, metadata }: { signal: any; sender: string; metadata?: { name?: string } }) => {
      if (!signal || !sender) return;
      const peer = peersRef.current[sender] || createPeer(sender, false, metadata?.name);
      peer.signal(signal);
    };

    socket.on('viewer-connected', handleViewerConnected);
    socket.on('session-participants', handleSessionParticipants);
    socket.on('signal', handleSignal);
    socket.emit('get-session-participants', { sessionId: meetingId });

    return () => {
      socket.off('viewer-connected', handleViewerConnected);
      socket.off('session-participants', handleSessionParticipants);
      socket.off('signal', handleSignal);
    };
  }, [hasJoined, meetingId]);

  const replaceOutgoingVideoTrack = (nextTrack: MediaStreamTrack) => {
    Object.values(peersRef.current).forEach((peer) => {
      if (peer.destroyed) return;
      try {
        const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
        const sender = pc?.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          void sender.replaceTrack(nextTrack);
          return;
        }
        peer.addTrack(nextTrack, localStream || new MediaStream([nextTrack]));
      } catch (err) {
        console.warn('Failed to replace outgoing video track', err);
      }
    });

    if (!localStream) return;
    const currentTrack = localStream.getVideoTracks()[0];
    if (currentTrack && currentTrack.id !== nextTrack.id) {
      localStream.removeTrack(currentTrack);
      const previewIds = new Set(cameraStream?.getVideoTracks().map((t) => t.id) || []);
      if (!previewIds.has(currentTrack.id)) currentTrack.stop();
    }
    if (!localStream.getVideoTracks().some((track) => track.id === nextTrack.id)) {
      localStream.addTrack(nextTrack);
    }
  };

  const replaceOutgoingAudioTrack = (nextTrack: MediaStreamTrack) => {
    Object.values(peersRef.current).forEach((peer) => {
      if (peer.destroyed) return;
      try {
        const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
        const sender = pc?.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          void sender.replaceTrack(nextTrack);
          return;
        }
        peer.addTrack(nextTrack, localStream || new MediaStream([nextTrack]));
      } catch (err) {
        console.warn('Failed to replace outgoing audio track', err);
      }
    });
    if (!localStream) return;
    const currentTrack = localStream.getAudioTracks()[0];
    if (currentTrack && currentTrack.id !== nextTrack.id) {
      localStream.removeTrack(currentTrack);
      currentTrack.stop();
    }
    if (!localStream.getAudioTracks().some((track) => track.id === nextTrack.id)) {
      localStream.addTrack(nextTrack);
    }
  };

  const switchVideoDevice = async (deviceId: string) => {
    selectDevice('video', deviceId);
    try {
      const next = await getUserMediaForDevice('video', deviceId);
      const newTrack = next.getVideoTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = !isVideoOff;
      if (isScreenSharing) {
        cameraStream?.getVideoTracks().forEach((track) => track.stop());
        setCameraStream(new MediaStream([newTrack]));
      } else {
        replaceOutgoingVideoTrack(newTrack);
        attachStreamToVideo(localVideoRef.current, localStreamRef.current);
      }
      selectDevice('video', deviceId);
      try {
        const raw = sessionStorage.getItem('meetSetupContext');
        const setup = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        sessionStorage.setItem('meetSetupContext', JSON.stringify({ ...setup, videoDeviceId: deviceId }));
      } catch { /* ignore */ }
    } catch {
      toast.error('Could not switch camera');
    }
  };

  const switchAudioDevice = async (deviceId: string) => {
    selectDevice('audio', deviceId);
    try {
      const next = await getUserMediaForDevice('audio', deviceId);
      const newTrack = next.getAudioTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = !isMuted;
      replaceOutgoingAudioTrack(newTrack);
      selectDevice('audio', deviceId);
    } catch {
      toast.error('Could not switch microphone');
    }
  };

  const beginScreenShare = async () => {
    if (!canScreenShare) return;
    const liveCam = localStreamRef.current?.getVideoTracks().filter((t) => t.readyState === 'live') || [];
    const cameraPreview = liveCam.length
      ? new MediaStream(liveCam.map((t) => t.clone()))
      : null;
    if (cameraPreview) setCameraStream(cameraPreview);

    let ds: MediaStream;
    try {
      ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      toast.error('Screen share was cancelled or blocked');
      return;
    }
    const newTrack = ds.getVideoTracks()[0];
    if (!newTrack) throw new Error('No screen-share video track');
    newTrack.enabled = true;
    replaceOutgoingVideoTrack(newTrack);
    setDisplayStream(ds);
    attachStreamToVideo(localVideoRef.current, ds);
    setIsScreenSharing(true);
    setLocalPinId('local');
    socket.emit('media-state', { sessionId: meetingId, isScreenSharing: true, isMuted, isVideoOff: false });
    newTrack.onended = () => {
      displayStream?.getTracks().forEach((t) => t.stop());
      ds.getTracks().forEach((t) => t.stop());
      const previewTrack = cameraPreview?.getVideoTracks().find((t) => t.readyState === 'live');
      if (previewTrack) {
        previewTrack.enabled = !isVideoOff;
        replaceOutgoingVideoTrack(previewTrack);
        attachStreamToVideo(localVideoRef.current, cameraPreview);
      }
      setIsScreenSharing(false);
      setDisplayStream(null);
      socket.emit('media-state', { sessionId: meetingId, isScreenSharing: false, isMuted, isVideoOff });
    };
  };

  const toggleMute = () => {
    if (!localStream) {
      toast.info('No microphone available. Click "Enable Media" to add microphone.');
      return;
    }
    localStream.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    socket.emit('media-state', { sessionId: meetingId, isScreenSharing, isMuted: nextMuted, isVideoOff });
  };

  const toggleVideo = () => {
    const cameraTracks = (isScreenSharing ? cameraStream : localStream)
      ?.getVideoTracks()
      .filter((track) => track.readyState === 'live') || [];
    if (!cameraTracks.length) {
      toast.info('No camera available. Click "Enable Media" to add camera.');
      return;
    }
    const nextOff = !isVideoOff;
    cameraTracks.forEach((track) => {
      track.enabled = !nextOff;
    });
    setIsVideoOff(nextOff);
    socket.emit('media-state', { sessionId: meetingId, isScreenSharing, isMuted, isVideoOff: nextOff });
  };

  useEffect(() => {
    if (!hasJoined || !pendingScreenShareRef.current) return;
    pendingScreenShareRef.current = false;
    void beginScreenShare();
  }, [hasJoined]);

  const enableMediaDevices = async () => {
    try {
      const stream = await getMeetingUserMedia();
      setLocalStream(stream);
      localStreamRef.current = stream;
      syncSelectedFromStream(stream);
      attachStreamToVideo(localVideoRef.current, stream);
      
      // Update existing peers with new stream
      Object.values(peersRef.current).forEach(peer => {
        if (!peer.destroyed) {
          stream.getTracks().forEach(track => {
            peer.addTrack(track, stream);
          });
        }
      });
      
      toast.success('Camera and microphone enabled!');
    } catch (error) {
      console.error('Failed to enable media devices:', error);
      toast.error('Could not access camera/microphone');
    }
  };

  const handleLeave = () => {
    cleanupMeetingState();
    if (isHost) {
      socket.emit('host-leaving', { sessionId: meetingId });
    }
    socket.emit('leave-session', meetingId);
    navigate('/meet');
  };

  const startRecording = () => {
    const sourceStream = (isScreenSharing && displayStream) || localStream;
    if (!sourceStream) {
      toast.error('No media stream available to record');
      return;
    }
    // @ts-ignore
    if (typeof MediaRecorder === 'undefined') {
      toast.error('Recording is not supported in this browser');
      return;
    }
    try {
      const recorder = new MediaRecorder(sourceStream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `soko-meet-recording-${new Date().toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsRecording(false);
        toast.success('Recording saved to your device');
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
      toast.info('Recording started (saved locally)');
    } catch (e) {
      console.error('Failed to start recording', e);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const toggleHand = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    socket.emit('hand-raised', { sessionId: meetingId, raised: next });
  };

  const handleTogglePin = useCallback((targetId: string, broadcast = false) => {
    const nextId = (localPinId || pinnedId) === targetId ? null : targetId;
    userPinnedRef.current = !!nextId;
    setLocalPinId(nextId);
    setPinnedId(nextId);
    if (broadcast || isHost) {
      socket.emit('pin-participant', { sessionId: meetingId, targetId: nextId });
    }
  }, [localPinId, pinnedId, isHost, meetingId]);

  const reportSpeaking = useCallback((id: string, speaking: boolean) => {
    if (speaking) {
      speakingSinceRef.current[id] = speakingSinceRef.current[id] || Date.now();
    } else {
      delete speakingSinceRef.current[id];
    }
  }, []);

  useEffect(() => {
    if (localSpeaking) speakingSinceRef.current.local = speakingSinceRef.current.local || Date.now();
    else delete speakingSinceRef.current.local;
  }, [localSpeaking]);

  useEffect(() => {
    const chatVisible = isMobile ? chatOpen : activeSidebar === 'chat';
    if (chatVisible) setUnreadChatCount(0);
  }, [chatOpen, activeSidebar, isMobile]);

  useEffect(() => {
    if (!hasJoined) return;
    const timer = window.setInterval(async () => {
      const next: Record<string, ConnectionQuality> = {};
      await Promise.all(Object.entries(peersRef.current).map(async ([id, peer]) => {
        const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
        if (!pc) return;
        try {
          next[id] = qualityFromStats(await pc.getStats());
        } catch {
          next[id] = 'unknown';
        }
      }));
      setParticipants((prev) => {
        let changed = false;
        const mapped = prev.map((p) => {
          const quality = next[p.id];
          if (!quality || p.connectionQuality === quality) return p;
          changed = true;
          return { ...p, connectionQuality: quality };
        });
        return changed ? mapped : prev;
      });
      const values = Object.values(next);
      const poor = values.filter((q) => q === 'poor').length;
      if (poor >= Math.max(1, Math.ceil(values.length / 2)) && Date.now() - lastPoorToastRef.current > 20000) {
        lastPoorToastRef.current = Date.now();
        toast.warning('Your connection is unstable');
        setNetworkQuality('poor');
      } else if (values.some((q) => q === 'fair')) {
        setNetworkQuality((q) => q === 'poor' ? q : 'fair');
      } else if (values.length) {
        setNetworkQuality((q) => q === 'poor' ? q : 'good');
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hasJoined, participants.length]);

  useEffect(() => {
    if (!hasJoined) return;
    socket.emit('media-state', { sessionId: meetingId, isScreenSharing, isMuted, isVideoOff });
  }, [hasJoined, meetingId]);

  const participantCount = participants.length + 1;
  const meetGridCols = participantCount <= 1 ? 1 : participantCount === 2 ? 2 : participantCount <= 4 ? 2 : participantCount <= 9 ? 3 : 4;

  const effectivePinnedId = localPinId || pinnedId;
  const pinnedParticipant = effectivePinnedId ? participants.find(p => p.id === effectivePinnedId) : undefined;
  const otherParticipants = effectivePinnedId ? participants.filter(p => p.id !== effectivePinnedId) : participants;
  const localIsPinned = effectivePinnedId === 'local';
  const speakerView = !!(effectivePinnedId || isScreenSharing);

  useEffect(() => {
    attachStreamToVideo(
      localVideoRef.current,
      isScreenSharing && displayStream ? displayStream : localStream
    );
    attachStreamToVideo(cameraPreviewRef.current, cameraStream);
    attachStreamToVideo(selfTileRef.current, isScreenSharing ? cameraStream : localStream);
  }, [localStream, cameraStream, displayStream, isScreenSharing, speakerView, localIsPinned, effectivePinnedId]);

  const renderNetworkLabel = () => {
    switch (networkQuality) {
      case 'good':
        return <span className="text-emerald-400 text-xs font-medium">Network: Good</span>;
      case 'fair':
        return <span className="text-amber-400 text-xs font-medium">Network: Fair</span>;
      case 'poor':
        return <span className="text-red-400 text-xs font-medium">Network: Poor</span>;
      default:
        return <span className="text-zinc-500 text-xs font-medium">Network: Unknown</span>;
    }
  };

  return (
    <div className="h-[100dvh] bg-[#202124] flex flex-col text-white overflow-hidden font-sans">
      <header className="px-2 sm:px-4 py-2 border-b border-zinc-800/50 flex items-center justify-between gap-2 sticky top-0 bg-[#202124]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0" onClick={() => navigate(IS_STANDALONE ? '/meet' : '/teleconference/meet')}>
          <img src="/sigtrack-tube.png" alt="WAR ROOM" className="h-8 w-auto" />
          <span className="text-base sm:text-xl font-semibold truncate">WAR ROOM</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {!IS_STANDALONE && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-white/15 bg-white/5 text-white hover:bg-white/10 px-2 sm:px-3"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`relative rounded-full ${(isMobile ? chatOpen : activeSidebar === 'chat') ? 'text-primary bg-primary/10' : 'hover:bg-white/10'}`}
            onClick={() => {
              if (isMobile) {
                setChatOpen(true);
              } else {
                setActiveSidebar(activeSidebar === 'chat' ? 'none' : 'chat');
              }
              setUnreadChatCount(0);
            }}
          >
            <MessageSquare className="h-5 w-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </Button>
          <Dialog open={chatOpen} onOpenChange={setChatOpen}>
            <DialogContent className="w-[95vw] max-w-[420px] sm:max-w-md bg-[#202124] border-zinc-800 text-white p-4 sm:p-6 h-[80dvh]">
              <DialogHeader>
                <DialogTitle>Meeting chat</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Public and private messages, plus files.
                </DialogDescription>
              </DialogHeader>
              <div className="h-[60dvh] min-h-0">
                <MeetChatPanel
                  meetingId={meetingId!}
                  messages={messages.map((m) => ({
                    id: m.id || `${m.timestamp}-${m.senderId}`,
                    meetingId: meetingId!,
                    senderId: m.senderId,
                    senderName: m.senderName,
                    type: m.type || 'public',
                    recipientIds: m.recipientIds,
                    text: m.text || m.message,
                    fileUrl: m.fileUrl,
                    fileName: m.fileName,
                    fileId: m.fileId,
                    fileSize: m.fileSize,
                    mimeType: m.mimeType,
                    status: m.status,
                    uploadProgress: m.uploadProgress,
                    timestamp: m.timestamp,
                  }))}
                  currentId={user?.uid || socket.id || 'anonymous'}
                  selfIds={[user?.uid, socket.id].filter(Boolean) as string[]}
                  senderName={roomLabel}
                  senderTeamId={sigtrack.teamId}
                  participants={participants.map((p) => ({ id: p.id, name: p.name, userId: p.userId }))}
                  onLocalSend={appendLocalChat}
                  emitSocket={(event, payload) => socket.emit(event, payload)}
                />
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full ${activeSidebar === 'participants' ? 'text-primary bg-primary/10' : 'hover:bg-white/10'}`}
            onClick={() => {
              if (isMobile) {
                setParticipantsOpen(true);
              } else {
                setActiveSidebar(activeSidebar === 'participants' ? 'none' : 'participants');
              }
            }}
          >
            <Users className="h-5 w-5" />
          </Button>
          <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
            <DialogContent className="w-[95vw] max-w-[420px] sm:max-w-md bg-[#202124] border-zinc-800 text-white p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Participants ({participants.length + 1})</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Everyone currently in this meeting.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[50dvh] overflow-y-auto scrollbar-invisible space-y-2 pr-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={user?.photoURL || ''} alt={resolvedDisplayName} />
                      <AvatarFallback className="bg-[#3B6EF8] text-white text-[10px] font-bold">
                        {resolvedDisplayName.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{resolvedDisplayName} (You)</span>
                  </div>
                  {isHost && <ShieldCheck className="h-4 w-4 text-primary" />}
                </div>
                {participants.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="bg-blue-500/10 text-white text-[10px] font-bold">
                          {p.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {raisedHands.includes(p.id) && <span className="text-xs">✋</span>}
                      {pinnedId === p.id && <span className="text-[10px] text-amber-400 font-semibold">Pinned</span>}
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                <Share2 className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[420px] sm:max-w-md bg-[#202124] border-zinc-800 text-white p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Share this meeting</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  {(meetingData?.hostName || 'Host')} is inviting you to join a meeting.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-blue-500/10 p-2 rounded-lg border border-blue-700">
                  <span className="text-xs text-zinc-400 break-all sm:truncate flex-1">{window.location.href}</span>
                  <Button variant="ghost" size="sm" className="h-9 px-3 text-primary w-full sm:w-auto" onClick={copyMeetingLink}>Copy</Button>
                </div>
                <div className="flex items-center justify-center p-3 sm:p-4 rounded-xl bg-blue-500/10 border border-blue-700">
                  <QRCode value={window.location.href} size={isMobile ? 112 : 128} fgColor="#ffffff" bgColor="transparent" />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      {/* Main Grid Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-2 sm:p-4 flex items-stretch justify-center relative overflow-hidden min-h-0">
          {/* Floating Reactions */}
          <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 animate-bounce-up text-4xl"
                style={{
                  animation: 'float-up 3s ease-out forwards',
                  left: `${r.offset ?? 50}%`
                }}
              >
                {r.reaction}
                <span className="block text-[10px] text-white/60 text-center mt-1 bg-black/40 px-1 rounded">{r.senderName}</span>
              </div>
            ))}
          </div>

          <div className="h-full w-full overflow-hidden min-h-0 p-1 sm:p-2">
            {speakerView ? (
              <div className="flex h-full w-full min-h-0 flex-col sm:flex-row gap-2">
                <aside className="order-2 sm:order-1 flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto sm:overflow-x-hidden h-28 sm:h-full w-full sm:w-[18%] sm:min-w-[140px] sm:max-w-[220px] shrink-0 scrollbar-invisible">
                  {!localIsPinned && (
                    <button
                      type="button"
                      className="relative h-full sm:h-auto sm:w-full aspect-video shrink-0 rounded-lg overflow-hidden border border-white/10 bg-black"
                      onDoubleClick={() => handleTogglePin('local')}
                    >
                      <video
                        ref={selfTileRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover object-top -scale-x-100"
                      />
                      <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1.5 py-0.5 rounded">You</span>
                    </button>
                  )}
                  {otherParticipants.map((p) => (
                    <div key={p.id} className="h-full sm:h-auto sm:w-full aspect-video shrink-0">
                      <ParticipantVideo
                        participant={p}
                        isHost={isHost}
                        sessionId={meetingId!}
                        isPinned={false}
                        isRaised={raisedHands.includes(p.id)}
                        onPinToggle={handleTogglePin}
                        compact
                        onSpeakingChange={reportSpeaking}
                      />
                    </div>
                  ))}
                </aside>
                <div className="order-1 sm:order-2 relative flex-1 min-h-0 min-w-0 rounded-xl overflow-hidden bg-black border border-white/10">
                  {localIsPinned || (isScreenSharing && !pinnedParticipant) ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`absolute inset-0 w-full h-full bg-black ${isScreenSharing ? 'object-contain object-center' : 'object-cover object-center -scale-x-100'}`}
                    />
                  ) : pinnedParticipant ? (
                    <ParticipantVideo
                      participant={pinnedParticipant}
                      isHost={isHost}
                      sessionId={meetingId!}
                      isPinned
                      isRaised={raisedHands.includes(pinnedParticipant.id)}
                      onPinToggle={handleTogglePin}
                      enlarged
                      onSpeakingChange={reportSpeaking}
                    />
                  ) : null}
                  {isScreenSharing && !isVideoOff && cameraStream && (
                    <div className="absolute bottom-3 right-3 w-28 sm:w-36 aspect-video rounded-lg overflow-hidden border border-white/20 shadow-xl bg-black z-10">
                      <video
                        ref={cameraPreviewRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover object-top -scale-x-100"
                      />
                    </div>
                  )}
                  {isScreenSharing && isVideoOff && (
                    <div className="absolute bottom-3 right-3 w-28 sm:w-36 aspect-video rounded-lg overflow-hidden border border-white/20 shadow-xl bg-[#1a1b1e] z-10 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#3B6EF8] flex items-center justify-center text-sm font-bold">
                        {(roomLabel.charAt(0) || 'U')}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10">
                    {localIsPinned || (isScreenSharing && !pinnedParticipant)
                      ? `${roomLabel} ${isHost ? '(Host)' : '(You)'}`
                      : pinnedParticipant?.name || 'Pinned'}
                  </div>
                  <button
                    type="button"
                    className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                    onClick={() => handleTogglePin(effectivePinnedId || 'local')}
                    title="Unpin"
                  >
                    <Pin className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
            <div
              className="h-full w-full min-h-0 grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${meetGridCols}, minmax(0, 1fr))`,
                gridAutoRows: 'minmax(0, 1fr)',
              }}
            >
            {/* Local Video */}
            <div
              className={`relative min-h-0 min-w-0 h-full w-full bg-black rounded-xl overflow-hidden group border-2 ${localSpeaking ? 'border-emerald-400' : 'border-transparent'} transition-colors shadow-lg`}
              onDoubleClick={() => handleTogglePin('local')}
            >
              {localStream ? (
                <>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`absolute inset-0 w-full h-full object-cover object-top -scale-x-100 bg-black ${isVideoOff ? 'hidden' : ''}`}
                  />
                  {isVideoOff && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b1e]">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#3B6EF8] flex items-center justify-center text-3xl font-bold shadow-xl">
                        {(roomLabel.charAt(0) || 'U')}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b1e]">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#3B6EF8] flex items-center justify-center text-3xl font-bold shadow-xl">
                    {(roomLabel.charAt(0) || 'U')}
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 text-center">
                    <p className="text-xs text-white/60 mb-2">No camera/microphone</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs bg-white/10 hover:bg-white/20 text-white"
                      onClick={enableMediaDevices}
                    >
                      Enable Media
                    </Button>
                  </div>
                </div>
              )}
              <div className={`absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border ${localSpeaking ? 'border-emerald-400' : 'border-white/10'}`}>
                {roomLabel} {isHost ? '(Host)' : '(You)'}
                {isMuted && <MicOff className="h-3.5 w-3.5 text-destructive" />}
                {!localStream && <span title="No microphone"><MicOff className="h-3.5 w-3.5 text-yellow-400" /></span>}
              </div>
              <button
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                onClick={() => handleTogglePin('local')}
                title="Enlarge"
              >
                <Maximize2 className="h-4 w-4 mx-auto" />
              </button>
            </div>

            {otherParticipants.map(p => (
              <div key={p.id} className="min-h-0 min-w-0 h-full w-full">
              <ParticipantVideo
                participant={p}
                isHost={isHost}
                sessionId={meetingId!}
                isPinned={false}
                isRaised={raisedHands.includes(p.id)}
                onPinToggle={handleTogglePin}
                onSpeakingChange={reportSpeaking}
              />
              </div>
            ))}
            </div>
            )}
          </div>
        </div>

        {/* Sidebar - bottom sheet on mobile, side panel on desktop */}
        {activeSidebar !== 'none' && (!isMobile || activeSidebar !== 'chat') && (
          <div className="fixed md:relative inset-x-0 bottom-0 md:inset-auto md:w-80 md:border-l bg-blue-500/10 md:bg-blue-500/10 border-blue-800 flex flex-col shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-300 rounded-t-2xl md:rounded-none z-50 max-h-[75dvh] md:max-h-none">
            <div className="p-4 border-b border-blue-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold capitalize">{activeSidebar}</h2>
              <Button variant="ghost" size="icon" onClick={() => setActiveSidebar('none')} className="hover:bg-white/10 md:hidden">
                <Grid className="h-5 w-5 rotate-45" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setActiveSidebar('none')} className="hover:bg-white/10 hidden md:inline-flex">
                <Grid className="h-5 w-5 rotate-45" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 scrollbar-invisible">
              {activeSidebar === 'chat' && (
                <MeetChatPanel
                  meetingId={meetingId!}
                  messages={messages.map((m) => ({
                    id: m.id || `${m.timestamp}-${m.senderId}`,
                    meetingId: meetingId!,
                    senderId: m.senderId,
                    senderName: m.senderName,
                    type: m.type || 'public',
                    recipientIds: m.recipientIds,
                    text: m.text || m.message,
                    fileUrl: m.fileUrl,
                    fileName: m.fileName,
                    fileId: m.fileId,
                    fileSize: m.fileSize,
                    mimeType: m.mimeType,
                    status: m.status,
                    uploadProgress: m.uploadProgress,
                    timestamp: m.timestamp,
                  }))}
                  currentId={user?.uid || socket.id || 'anonymous'}
                  selfIds={[user?.uid, socket.id].filter(Boolean) as string[]}
                  senderName={roomLabel}
                  senderTeamId={sigtrack.teamId}
                  participants={participants.map((p) => ({ id: p.id, name: p.name, userId: p.userId }))}
                  onLocalSend={appendLocalChat}
                  emitSocket={(event, payload) => socket.emit(event, payload)}
                />
              )}

              {activeSidebar === 'participants' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text--400 text-sm font-medium px-2">
                    <span>In call ({participants.length + 1})</span>
                  </div>
                  <div className="space-y-2">
                    {/* Local User */}
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={user?.photoURL || ''} alt={roomLabel} />
                          <AvatarFallback className="bg-[#3B6EF8] text-white text-[10px] font-bold">
                            {(roomLabel.charAt(0) || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{roomLabel} (You)</span>
                        {isHost && <span className="ml-1 text-xs text-primary font-bold">(Host)</span>}
                      </div>
                      <div className="flex gap-1">
                        {isMuted && <MicOff className="h-4 w-4 text-destructive" />}
                        {isHandRaised && <span className="text-xs" title="Your hand is raised">✋</span>}
                        {isHost && <ShieldCheck className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                    {isHost && pendingRequests.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                          <span className="text-xs text-zinc-400">Pending requests</span>
                          <Button
                            variant="outline"
                            size="xs"
                            className="border-blue-700 text-blue-300 hover:text-white hover:border-blue-500"
                            onClick={() => {
                              pendingRequests.forEach(req => {
                                socket.emit('approve-join', { sessionId: meetingId!, viewerId: req.viewerId });
                              });
                              setPendingRequests([]);
                            }}
                          >
                            Admit all
                          </Button>
                        </div>
                        {pendingRequests.map(req => (
                          <div key={req.viewerId} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8 flex-shrink-0">
                                <AvatarFallback className="bg-blue-500/10 text-white text-[10px] font-bold">
                                  {req.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{req.name}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="secondary" size="sm" onClick={() => {
                                socket.emit('approve-join', { sessionId: meetingId!, viewerId: req.viewerId });
                                setPendingRequests(prev => prev.filter(p => p.viewerId !== req.viewerId));
                              }}>Approve</Button>
                              <Button variant="destructive" size="sm" onClick={() => {
                                socket.emit('reject-join', { sessionId: meetingId!, viewerId: req.viewerId });
                                setPendingRequests(prev => prev.filter(p => p.viewerId !== req.viewerId));
                              }}>Reject</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Remote Users */}
                    {participants.map(p => (
                      <div key={p.id} className="flex flex-col gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarFallback className="bg-blue-500/10 text-white text-[10px] font-bold">
                                {p.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium flex items-center gap-1">
                              {p.name}
                              {raisedHands.includes(p.id) && <span className="text-[10px]" title="Hand raised">✋</span>}
                              {pinnedId === p.id && <span className="text-[10px] text-amber-400 font-semibold">Pinned</span>}
                            </span>
                          </div>
                          {isHost && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-white/10"
                                onClick={() => socket.emit('targeted-command', { sessionId: meetingId, targetId: p.id, command: 'mute' })}
                                title="Mute"
                              >
                                <MicOff className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] font-semibold hover:bg-primary/20 text-primary rounded-full"
                                onClick={() => socket.emit('transfer-host', { sessionId: meetingId, targetId: p.id })}
                                title="Make this participant the new host"
                              >
                                Host
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-destructive/20 text-destructive"
                                onClick={() => socket.emit('targeted-command', { sessionId: meetingId, targetId: p.id, command: 'remove' })}
                                title="Remove from meeting"
                              >
                                <PhoneOff className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSidebar === 'info' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-3">Joining info</h3>
                    <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500">
                      <p className="text-sm text-blue-300 mb-4">Share this link with others you want in the meeting</p>
                      <div className="flex items-center gap-2 bg-blue-900 p-2 rounded-lg border border-blue-700">
                        <span className="text-xs text-blue-400 truncate flex-1">{window.location.href}</span>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={copyMeetingLink}>Copy</Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-3">Meeting Security</h3>
                    <div className="flex items-center gap-3 text-sm text-blue-400">
                      <ShieldCheck className="h-5 w-5 text-success" />
                      <span>End-to-end encrypted</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeSidebar === 'chat' && (
              <div className="hidden" />
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="min-h-24 md:h-24 px-2 sm:px-3 md:px-6 py-2 md:py-0 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0 bg-[#202124] border-t border-zinc-800/50 relative z-50">
        <div className="hidden md:flex items-center gap-4 text-sm font-medium text-zinc-400 w-1/4">
          <div className="flex flex-col">
            <span className="text-white text-base tabular-nums">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <span className="text-blue-500">|</span>
              <span className="text-blue-300 font-bold">{meetingId}</span>
              {isHost && <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[9px] font-black rounded uppercase tracking-tighter border border-primary/20">Host</span>}
              <span className="text-zinc-500">|</span>
              {renderNetworkLabel()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:flex-1 justify-center px-0 md:px-0">
          <div className="w-full md:w-auto flex items-center justify-start sm:justify-center flex-nowrap md:flex-nowrap gap-2 md:gap-3 bg-blue-500/40 p-2 rounded-2xl md:rounded-full border border-white/5 backdrop-blur-md overflow-x-auto scrollbar-invisible">
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 md:h-12 md:w-12 rounded-full border border-white/10 transition-all ${isMuted ? 'bg-destructive text-white hover:bg-destructive/80 scale-95' : 'bg-blue-500/10 hover:bg-blue-500/10'}`}
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {/* Audio Device Switcher */}
            <DeviceSwitcher
              devices={audioDevices}
              selectedDeviceId={selectedDevices.audioDeviceId}
              onSelectDevice={(id) => void switchAudioDevice(id)}
              type="audio"
              compact={isMobile}
            />
            
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 md:h-12 md:w-12 rounded-full border border-white/10 transition-all ${isVideoOff ? 'bg-destructive text-white hover:bg-destructive/80 scale-95' : 'bg-blue-500/10 hover:bg-blue-500/10'}`}
              onClick={toggleVideo}
            >
              {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>

            {/* Video Device Switcher */}
            <DeviceSwitcher
              devices={videoDevices}
              selectedDeviceId={selectedDevices.videoDeviceId}
              onSelectDevice={(id) => void switchVideoDevice(id)}
              type="video"
              compact={isMobile}
            />

            <Button
              variant="ghost"
              size="icon"
              title={isPipOpen ? 'Stop pop-out' : 'Pop out meeting'}
              className={`h-10 w-10 md:h-12 md:w-12 rounded-full border border-white/10 transition-all ${isPipOpen ? 'bg-primary text-white' : 'bg-blue-500/10 hover:bg-blue-500/10'}`}
              onClick={() => {
                void (async () => {
                  if (isPipOpen) {
                    await closePip();
                    return;
                  }
                  const opened = await openPip();
                  if (!opened) {
                    toast.error('Pop-out needs a live camera or screen share. Allow Picture-in-Picture if the browser asks.');
                  }
                })();
              }}
            >
              <PictureInPicture2 className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              title={!canScreenShare ? 'Screen share is not supported on this device (e.g. iOS Safari)' : isScreenSharing ? 'Stop sharing' : 'Share screen'}
              disabled={!canScreenShare}
              className={`h-10 w-10 md:h-12 md:w-12 rounded-full transition-all ${!canScreenShare ? 'opacity-50 cursor-not-allowed' : ''} ${isScreenSharing ? 'bg-primary text-white hover:bg-primary/80' : 'bg-blue-500/10 hover:bg-blue-500/10 border border-white/10'}`}
              onClick={async () => {
                if (!canScreenShare) return;
                if (!isScreenSharing) {
                  try {
                    await beginScreenShare();
                  } catch {
                    toast.error(isMobile ? 'Screen share not supported or denied on this device' : 'Screen share failed');
                  }
                  return;
                }
                try {
                  displayStream?.getTracks().forEach((t) => t.stop());
                  const previewTrack = cameraStream?.getVideoTracks().find((t) => t.readyState === 'live');
                  const cam = previewTrack
                    ? cameraStream!
                    : await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                  const camTrack = cam.getVideoTracks()[0];
                  if (camTrack) {
                    camTrack.enabled = !isVideoOff;
                    replaceOutgoingVideoTrack(camTrack);
                    attachStreamToVideo(localVideoRef.current, cam);
                    if (!localStream) setLocalStream(cam);
                  }
                  setIsScreenSharing(false);
                  setDisplayStream(null);
                  socket.emit('media-state', { sessionId: meetingId, isScreenSharing: false, isMuted, isVideoOff });
                } catch {
                  toast.error('Could not restore camera');
                }
              }}
            >
              <MonitorUp className="h-5 w-5" />
            </Button>

            {/* Local recording (saved to device) */}
            <Button
              variant="ghost"
              size="icon"
              title={isRecording ? 'Stop recording' : 'Start local recording (saved to your device)'}
              className={`h-10 w-10 md:h-12 md:w-12 rounded-full border border-white/10 transition-all ${isRecording ? 'bg-red-600/80 text-white hover:bg-red-600 scale-95' : 'bg-blue-500/10 hover:bg-blue-500/10'}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              <span className="relative flex items-center justify-center">
                <span className={`h-3 w-3 rounded-full ${isRecording ? 'bg-red-300 animate-pulse' : 'bg-red-500'}`} />
              </span>
            </Button>

            {/* Reactions Trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-500/10 hover:bg-blue-500/10 border border-white/10">
                  <span className="text-xl">😊</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="grid grid-cols-4 gap-2 p-2 bg-blue-500/10 border-blue-500/10 rounded-2xl shadow-2xl">
                {['💖', '👍', '🎉', '👏', '😂', '😮', '😢', '🤔'].map((emoji) => (
                  <Button key={emoji} variant="ghost" className="h-10 w-10 text-xl p-0 hover:bg-white/10" onClick={() => sendReaction(emoji)}>
                    {emoji}
                  </Button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Raise hand */}
            <Button
              variant="ghost"
              size="icon"
              title={isHandRaised ? 'Lower hand' : 'Raise hand'}
              className={`h-10 w-10 md:h-12 md:w-12 rounded-full border border-white/10 transition-all ${isHandRaised ? 'bg-amber-500 text-white hover:bg-amber-500/90' : 'bg-zinc-700 hover:bg-zinc-600'}`}
              onClick={toggleHand}
            >
              <span className="text-lg">✋</span>
            </Button>

            {isHost && (
              <HostGlobalControls
                sessionId={meetingId!}
                locked={meetingLocked}
                pendingCount={pendingRequests.length}
                onLockToggle={() => socket.emit('lock-meeting', { sessionId: meetingId, locked: !meetingLocked })}
                onLowerHands={() => socket.emit('host-command', { sessionId: meetingId, command: 'lower-all-hands' })}
              />
            )}

            {/* Enable Media Button - only show if user has no media */}
            {!localStream && (
              <Button
                variant="ghost"
                size="icon"
                title="Enable camera and microphone"
                className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400"
                onClick={enableMediaDevices}
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}

            {isHost ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-10 w-14 md:h-12 md:w-16 rounded-3xl hover:bg-destructive/90 transition-all hover:scale-105"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="w-56 bg-zinc-900 border-zinc-800 text-white">
                  <DropdownMenuLabel className="text-zinc-400">Leave meeting</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    onClick={() => setLeaveConfirmOpen(true)}
                    className="hover:bg-zinc-800 cursor-pointer focus:bg-zinc-800"
                  >
                    <PhoneOff className="mr-2 h-4 w-4" /> Leave the meeting
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setIsEndingMeeting(true);
                      socket.emit('end-meeting', { sessionId: meetingId });
                      toast.success('Ending meeting for everyone…');
                    }}
                    disabled={isEndingMeeting}
                    className="hover:bg-red-900/40 cursor-pointer text-red-400 focus:bg-red-900/40 focus:text-red-400"
                  >
                    <PhoneOff className="mr-2 h-4 w-4" /> {isEndingMeeting ? 'Ending meeting…' : 'End meeting for all'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="destructive"
                size="icon"
                className="h-10 w-14 md:h-12 md:w-16 rounded-3xl hover:bg-destructive/90 transition-all hover:scale-105"
                onClick={() => setLeaveConfirmOpen(true)}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1 w-1/4 justify-end"></div>
      </div>

      
      {waitingApproval && waitingStatus && (
        <MeetWaitingRoom
          displayName={guestName.trim() || resolvedDisplayName}
          meetingTitle={meetingData?.title}
          hostName={meetingData?.hostName}
          status={waitingStatus}
          onLeave={() => {
            setWaitingApproval(false);
            setWaitingStatus(null);
            setGuestReady(false);
            socket.emit('leave-session', meetingId);
            navigate('/meet');
          }}
        />
      )}
      {!user && !guestReady && !hasJoined && !waitingApproval && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-blue-500/10">
          <div className="w-full max-w-md bg-blue-500/10 border-blue-700 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">Join as Guest</h3>
            <p className="text-sm text-zinc-400 mb-1">Enter your name to join this meeting.</p>
            {waitingApproval && (
              <p className="text-xs text-amber-400 mb-3">
                Waiting for the host to admit you to the meeting…
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input
                placeholder={sigtrack.teamName || 'Your name'}
                value={guestName}
                disabled={waitingApproval}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    if (!guestName.trim()) {
                      toast.error('Please enter your name');
                      return;
                    }
                    setGuestName(guestName.trim());
                    setGuestReady(true);
                  }
                }}
                className="w-full h-11 text-base sm:text-sm bg-blue-500/10 border-blue-700 text-white placeholder:text-zinc-400 focus-visible:ring-zinc-500"
              />
              <Button
                disabled={waitingApproval}
                onClick={() => {
                  if (!guestName.trim()) {
                    toast.error('Please enter your name');
                    return;
                  }
                  setGuestName(guestName.trim());
                  setGuestReady(true);
                }}
                className="h-11 px-6 w-full sm:w-auto"
              >
                {waitingApproval ? 'Waiting...' : 'Join'}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-3">Or sign in to join with your account.</p>
          </div>
        </div>
      )}

      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent className="w-[95vw] max-w-[420px] sm:max-w-md bg-[#202124] border-zinc-800 text-white p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Leave meeting?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to leave this meeting?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLeaveConfirmOpen(false)} className="hover:bg-white/10">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLeaveConfirmOpen(false);
                handleLeave();
              }}
            >
              Leave
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <video
        ref={pipVideoRef}
        autoPlay
        muted
        playsInline
        disablePictureInPicture={false}
        className="pointer-events-none fixed left-[-100vw] top-0 h-[180px] w-[320px] opacity-0"
        aria-hidden
      />

      <style>{`
        @keyframes float-up {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
          20% { transform: translate(-50%, -20px) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -150px) scale(1); opacity: 0; }
        }
        .animate-bounce-up {
          animation: float-up 3s ease-out forwards;
        }
        .scrollbar-invisible {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-invisible::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

const HostGlobalControls: React.FC<{
  sessionId: string;
  locked: boolean;
  pendingCount: number;
  onLockToggle: () => void;
  onLowerHands: () => void;
}> = ({ sessionId, locked, pendingCount, onLockToggle, onLowerHands }) => {
  const handleAction = (command: string) => {
    socket.emit('host-command', { sessionId, command });
    toast.success(`Host: ${command} applied to all`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-500/10 hover:bg-blue-500/10 border border-white/10"
        >
          <MoreVertical className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-blue-500/10 border-blue-500/10 text-white">
        <DropdownMenuLabel>Host Controls</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-blue-500/10" />
        <DropdownMenuItem onClick={() => handleAction('mute-all')} className="hover:bg-blue-500 cursor-pointer">
          <MicOff className="mr-2 h-4 w-4" /> Mute All
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('unmute-all')} className="hover:bg-zinc-800 cursor-pointer">
          <Mic className="mr-2 h-4 w-4" /> Unmute All
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLowerHands} className="hover:bg-zinc-800 cursor-pointer">
          <Hand className="mr-2 h-4 w-4" /> Lower all hands
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLockToggle} className="hover:bg-zinc-800 cursor-pointer">
          {locked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
          {locked ? 'Unlock meeting' : 'Lock meeting'}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-blue-500/10" />
        <DropdownMenuItem onClick={() => handleAction('close-video-all')} className="hover:bg-blue-500 cursor-pointer">
          <VideoOff className="mr-2 h-4 w-4" /> Close All Videos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('open-video-all')} className="hover:bg-blue-500/10 cursor-pointer">
          <Video className="mr-2 h-4 w-4" /> Open All Videos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface ParticipantVideoProps {
  participant: Participant;
  isHost: boolean;
  sessionId: string;
  isPinned?: boolean;
  isRaised?: boolean;
  onPinToggle?: (id: string) => void;
  enlarged?: boolean;
  compact?: boolean;
  onSpeakingChange?: (id: string, speaking: boolean) => void;
}

const ParticipantVideo = React.memo(function ParticipantVideo({ participant, isHost, sessionId, isPinned, isRaised, onPinToggle, enlarged, compact, onSpeakingChange }: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const videoTrack = participant.stream?.getVideoTracks()?.find((track) => track.readyState === 'live');
  const hasVideoTrack = !!videoTrack && videoTrack.enabled;
  const isScreen = !!participant.isScreenSharing || /screen|display|window|web contents/i.test(videoTrack?.label || '');

  useEffect(() => {
    attachStreamToVideo(videoRef.current, participant.stream);
  }, [participant.stream]);

  useEffect(() => {
    const stream = participant.stream;
    if (!stream?.getAudioTracks().length) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let lastSpeaking = false;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
      const nextSpeaking = lastSpeaking ? avg > 10 : avg > 22;
      if (nextSpeaking !== lastSpeaking) {
        lastSpeaking = nextSpeaking;
        setSpeaking(nextSpeaking);
        onSpeakingChange?.(participant.id, nextSpeaking);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [participant.stream, participant.id, onSpeakingChange]);

  const handleHostAction = (command: string) => {
    socket.emit('targeted-command', {
      sessionId,
      targetId: participant.id,
      command
    });
    toast.success(`Sent ${command} to ${participant.name}`);
  };

  return (
    <div
      className={`relative min-h-0 min-w-0 ${enlarged ? 'h-full w-full' : compact ? 'h-full w-full aspect-video' : 'h-full w-full'} bg-black rounded-xl overflow-hidden group border-2 ${speaking ? 'border-emerald-400' : 'border-transparent'} transition-colors`}
      onDoubleClick={() => onPinToggle?.(participant.id)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full ${isScreen ? 'object-contain object-center bg-black' : enlarged ? 'object-cover object-center bg-black' : 'object-cover object-top bg-black'} ${hasVideoTrack ? '' : 'hidden'}`}
      />
      {!hasVideoTrack && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b1e]">
          <div className={`rounded-full bg-[#3B6EF8] flex items-center justify-center font-bold shadow-xl ${compact ? 'w-10 h-10 text-sm' : 'w-20 h-20 text-2xl'}`}>
            {participant.name?.charAt(0) || 'G'}
          </div>
        </div>
      )}
      <div className={`absolute ${compact ? 'bottom-1 left-1 text-[10px] px-1 py-0.5' : 'bottom-4 left-4 text-sm px-3 py-1'} bg-black/50 backdrop-blur-md rounded-lg font-medium flex items-center gap-2 ${speaking ? 'ring-2 ring-emerald-400' : ''}`}>
        <span>{participant.name}</span>
        {participant.isMuted && <MicOff className="h-3 w-3 text-red-400" />}
        {isRaised && <span className="text-[10px]" title="Hand raised">✋</span>}
        {isPinned && <span className="text-[10px] text-amber-400 font-semibold">Pinned</span>}
        {isScreen && <span className="text-[10px] text-sky-300">Screen</span>}
      </div>
      {participant.connectionQuality && participant.connectionQuality !== 'unknown' && (
        <div className="absolute top-2 left-2" title={`Connection: ${participant.connectionQuality}`}>
          {participant.connectionQuality === 'poor'
            ? <WifiOff className="h-3.5 w-3.5 text-red-400" />
            : <Wifi className={`h-3.5 w-3.5 ${participant.connectionQuality === 'fair' ? 'text-amber-400' : 'text-emerald-400'}`} />}
        </div>
      )}

      <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          variant="secondary"
          size="icon"
          className={`h-8 w-8 rounded-full ${isPinned ? 'bg-amber-500/80 hover:bg-amber-500 text-white' : 'bg-black/50 hover:bg-black/70'}`}
          onClick={() => onPinToggle?.(participant.id)}
          title={isPinned ? 'Unpin' : 'Enlarge'}
        >
          <Pin className="h-4 w-4" />
        </Button>
        {isHost && (
          <>
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70" onClick={() => handleHostAction('mute')}>
              <MicOff className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70" onClick={() => handleHostAction('close-video')}>
              <VideoOff className="h-4 w-4" />
            </Button>
            <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleHostAction('remove')}>
              <PhoneOff className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}, (prev, next) =>
  prev.participant.id === next.participant.id
  && prev.participant.stream === next.participant.stream
  && prev.participant.name === next.participant.name
  && prev.participant.isMuted === next.participant.isMuted
  && prev.participant.isVideoOff === next.participant.isVideoOff
  && prev.participant.isScreenSharing === next.participant.isScreenSharing
  && prev.participant.connectionQuality === next.participant.connectionQuality
  && prev.isHost === next.isHost
  && prev.isPinned === next.isPinned
  && prev.isRaised === next.isRaised
  && prev.enlarged === next.enlarged
  && prev.compact === next.compact
  && prev.sessionId === next.sessionId
  && prev.onPinToggle === next.onPinToggle
  && prev.onSpeakingChange === next.onSpeakingChange
);

export default function MeetRoomWithBoundary() {
  return (
    <MeetErrorBoundary>
      <MeetRoom />
    </MeetErrorBoundary>
  );
}
