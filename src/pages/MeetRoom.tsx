import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Mic, MicOff, 
  Video, VideoOff, 
  PhoneOff, 
  MonitorUp, 
  MoreVertical,
  Users,
  MessageSquare,
  Info,
  Grid,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Input } from '../components/ui/input';
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
import { socket } from '../contexts/StreamContext';
import SimplePeer from 'simple-peer';
import QRCode from 'react-qr-code';
import { Share2 } from 'lucide-react';

interface Participant {
  id: string;
  stream: MediaStream;
  name: string;
  isLocal?: boolean;
}

interface MeetingData {
  id: string;
  hostId: string;
  hostName: string;
  title?: string;
}

interface ChatMessage {
  sessionId: string;
  message: string;
  senderName: string;
  senderId: string;
  timestamp: number;
}

interface ReactionData {
  sessionId: string;
  reaction: string;
  senderName: string;
  senderId: string;
}

interface PendingJoin {
  viewerId: string;
  name: string;
}

const MeetRoom: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [activeSidebar, setActiveSidebar] = useState<'none' | 'chat' | 'participants' | 'info'>('none');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState<Array<ReactionData & { id: string }>>([]);
  const [guestName, setGuestName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingJoin[]>([]);
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  
  const peersRef = useRef<{ [key: string]: SimplePeer.Instance }>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeSidebar]);

  // Listen for chat and reactions
  useEffect(() => {
    socket.on('chat-message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (activeSidebar !== 'chat') {
        toast.info(`New message from ${msg.senderName}`, {
          description: msg.message.substring(0, 30) + (msg.message.length > 30 ? "..." : ""),
          action: {
            label: 'View',
            onClick: () => setActiveSidebar('chat')
          },
        });
      }
    });

    socket.on('reaction', (data: ReactionData) => {
      const id = Math.random().toString(36).substring(7);
      setReactions((prev) => [...prev, { ...data, id }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter(r => r.id !== id));
      }, 3000);
    });

    return () => {
      socket.off('chat-message');
      socket.off('reaction');
    };
  }, [activeSidebar]);

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg = {
      sessionId: meetingId!,
      message: chatInput,
      senderName: (user?.displayName || guestName || 'Anonymous'),
      senderId: (user?.uid || socket.id),
      timestamp: Date.now()
    };
    socket.emit('chat-message', msg);
    setChatInput('');
  };

  const sendReaction = (emoji: string) => {
    socket.emit('reaction', {
      sessionId: meetingId!,
      reaction: emoji,
      senderName: (user?.displayName || guestName || 'Anonymous'),
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
        senderId: (user?.uid || socket.id), 
        id 
      }
    ]);
    setTimeout(() => {
      setReactions((prev) => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const copyMeetingLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied to clipboard!");
  };

  // Fetch meeting data and check if user is host
  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const data = await api.getMeeting(meetingId!);
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
  }, [meetingId, user]);

  useEffect(() => {
    const canJoin = !!meetingId && !hasJoined && (!!user || guestReady);
    if (!canJoin) return;
    const init = async () => {
      try {
        if (user) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(stream);
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          socket.emit('join-session', { sessionId: meetingId, userId: user.uid });
          socket.emit('viewer-connected', { sessionId: meetingId!, viewerId: socket.id, name: user.displayName || 'Anonymous' });
          setHasJoined(true);
        } else {
          socket.emit('join-request', { sessionId: meetingId!, viewerId: socket.id, name: guestName });
          setWaitingApproval(true);
        }
      } catch (err) {
        toast.error("Could not access camera/microphone");
      }
    };
    init();
  }, [meetingId, user, guestReady, hasJoined]);

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
    socket.on('join-approved', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        socket.emit('join-session', meetingId!);
        setHasJoined(true);
        setWaitingApproval(false);
      } catch {
        toast.error('Could not access camera/microphone');
      }
    });
    socket.on('join-rejected', () => {
      setWaitingApproval(false);
      toast.error('Join request rejected');
    });
    socket.on('viewer-left', ({ viewerId }: { viewerId: string }) => {
      const peer = peersRef.current[viewerId];
      if (peer) {
        peer.destroy();
        delete peersRef.current[viewerId];
      }
      setParticipants(prev => prev.filter(p => p.id !== viewerId));
    });
    socket.on('meeting-ended', () => {
      toast.error('Meeting has ended');
      navigate('/meet');
    });
    socket.on('host-left', () => {
      toast.warning('Host has left the meeting');
    });
    return () => {
      socket.off('pending-join');
      socket.off('join-approved');
      socket.off('join-rejected');
      socket.off('viewer-left');
      socket.off('meeting-ended');
      socket.off('host-left');
    };
  }, [meetingId, isHost, navigate, peersRef]);

  // If the user signs in after joining as guest, mark role and update host state
  useEffect(() => {
    if (!meetingId || !user || !hasJoined) return;
    socket.emit('join-session', { sessionId: meetingId, userId: user.uid });
    if (meetingData && meetingData.hostId === user.uid) {
      setIsHost(true);
    }
  }, [user, meetingId, hasJoined, meetingData]);

  // Handle peer commands (from host)
  useEffect(() => {
    socket.on('peer-command', (data: { command: string, value?: any }) => {
      console.log("Received peer command:", data);
      switch (data.command) {
        case 'mute':
        case 'mute-all':
          if (!isMuted) toggleMute();
          toast.info("Host has muted you");
          break;
        case 'unmute':
        case 'unmute-all':
          if (isMuted) toggleMute();
          toast.info("Host has unmuted you");
          break;
        case 'close-video':
        case 'close-video-all':
          if (!isVideoOff) toggleVideo();
          toast.info("Host has closed your video");
          break;
        case 'open-video':
        case 'open-video-all':
          if (isVideoOff) toggleVideo();
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
  }, [isMuted, isVideoOff]);

  // Handle incoming connections (Signaling)
  useEffect(() => {
    if (!localStream) return;

    socket.on('viewer-connected', ({ viewerId, name }: { viewerId: string; name?: string }) => {
      if (viewerId === socket.id) return;
      console.log("New participant joined:", viewerId);
      
      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: localStream
      });

      peer.on('signal', signal => {
        socket.emit('signal', { target: viewerId, signal, sessionId: meetingId });
      });

      peer.on('stream', stream => {
        setParticipants(prev => {
          if (prev.find(p => p.id === viewerId)) return prev;
          return [...prev, { id: viewerId, stream, name: name || 'Guest' }];
        });
      });

      peersRef.current[viewerId] = peer;
    });

    socket.on('signal', ({ signal, sender }) => {
      if (peersRef.current[sender]) {
        peersRef.current[sender].signal(signal);
      } else {
        const peer = new SimplePeer({
          initiator: false,
          trickle: false,
          stream: localStream
        });

        peer.on('signal', s => {
          socket.emit('signal', { target: sender, signal: s, sessionId: meetingId });
        });

        peer.on('stream', stream => {
          setParticipants(prev => {
            if (prev.find(p => p.id === sender)) return prev;
            return [...prev, { id: sender, stream, name: 'Guest' }];
          });
        });

        peer.signal(signal);
        peersRef.current[sender] = peer;
      }
    });

    return () => {
      socket.off('viewer-connected');
      socket.off('signal');
    };
  }, [localStream, meetingId]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleLeave = () => {
    localStream?.getTracks().forEach(track => track.stop());
    if (isHost) {
      socket.emit('host-leaving', { sessionId: meetingId });
    } else {
      socket.emit('viewer-left', { sessionId: meetingId, viewerId: socket.id });
    }
    navigate('/meet');
  };

  // Determine grid columns based on participant count
  const getGridClass = () => {
    const total = participants.length + 1;
    if (total === 1) return 'grid-cols-1';
    if (total === 2) return 'grid-cols-1 md:grid-cols-2';
    if (total <= 4) return 'grid-cols-2';
    if (total <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  };

  return (
    <div className="h-screen bg-[#202124] flex flex-col text-white overflow-hidden font-sans">
      <header className="h-12 px-4 border-b border-zinc-800/50 flex items-center justify-between sticky top-0 bg-[#202124]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/sigtrack-tube.png" alt="Soko Meet" className="h-8 w-auto" />
          <span className="text-xl font-semibold">Soko Meet</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className={`rounded-full ${activeSidebar === 'chat' ? 'text-primary bg-primary/10' : 'hover:bg-white/10'}`} onClick={() => setActiveSidebar(activeSidebar === 'chat' ? 'none' : 'chat')}>
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className={`rounded-full ${activeSidebar === 'participants' ? 'text-primary bg-primary/10' : 'hover:bg-white/10'}`} onClick={() => setActiveSidebar(activeSidebar === 'participants' ? 'none' : 'participants')}>
            <Users className="h-5 w-5" />
          </Button>
          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                <Share2 className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#202124] border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle>Share this meeting</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  {(meetingData?.hostName || 'Host')} is inviting you to join a meeting.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-700">
                  <span className="text-xs text-zinc-400 truncate flex-1">{window.location.href}</span>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={copyMeetingLink}>Copy</Button>
                </div>
                <div className="flex items-center justify-center p-4 rounded-xl bg-zinc-900 border border-zinc-700">
                  <QRCode value={window.location.href} size={128} fgColor="#ffffff" bgColor="transparent" />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      {/* Main Grid Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 flex items-center justify-center relative overflow-hidden">
          {/* Floating Reactions */}
          <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 animate-bounce-up text-4xl"
                style={{
                  animation: 'float-up 3s ease-out forwards',
                  left: `${45 + Math.random() * 10}%`
                }}
              >
                {r.reaction}
                <span className="block text-[10px] text-white/60 text-center mt-1 bg-black/40 px-1 rounded">{r.senderName}</span>
              </div>
            ))}
          </div>

          <div className={`grid gap-4 w-full max-w-7xl mx-auto transition-all duration-500 pt-2 ${getGridClass()}`}>
            {/* Local Video */}
            <div className="relative aspect-video bg-zinc-800 rounded-xl overflow-hidden group border-2 border-transparent hover:border-primary/50 transition-all shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
              />
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                  <div className="w-24 h-24 rounded-full bg-[#3B6EF8] flex items-center justify-center text-3xl font-bold shadow-xl">
                    {(user?.displayName?.charAt(0) || guestName?.charAt(0) || 'U')}
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-white/10">
                {(user?.displayName || guestName || 'You')} {isHost ? '(Host)' : '(You)'}
                {isMuted && <MicOff className="h-3.5 w-3.5 text-destructive" />}
              </div>
            </div>

            {/* Remote Participants */}
            {participants.map(p => (
              <ParticipantVideo key={p.id} participant={p} isHost={isHost} sessionId={meetingId!} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        {activeSidebar !== 'none' && (
          <div className="w-80 sm:w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold capitalize">{activeSidebar}</h2>
              <Button variant="ghost" size="icon" onClick={() => setActiveSidebar('none')} className="hover:bg-white/10">
                <Grid className="h-5 w-5 rotate-45" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {activeSidebar === 'chat' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-zinc-500 mt-10">
                        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No messages yet. Say hello!</p>
                      </div>
                    ) : (
                      messages.map((m, i) => (
                        <div key={i} className={`flex flex-col ${m.senderId === (user?.uid || socket.id) ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-zinc-400">{m.senderName}</span>
                            <span className="text-[10px] text-zinc-600">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm ${m.senderId === user?.uid ? 'bg-[#3B6EF8] text-white' : 'bg-zinc-800 text-zinc-200'}`}>
                            {m.message}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>
              )}

              {activeSidebar === 'participants' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-zinc-400 text-sm font-medium px-2">
                    <span>In call ({participants.length + 1})</span>
                  </div>
                  <div className="space-y-2">
                    {/* Local User */}
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={user?.photoURL || ''} alt={(user?.displayName || guestName || 'User')} />
                          <AvatarFallback className="bg-[#3B6EF8] text-white text-[10px] font-bold">
                            {(user?.displayName?.charAt(0) || guestName?.charAt(0) || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{(user?.displayName || guestName || 'You')} (You)</span>
                        {isHost && <span className="ml-1 text-xs text-primary font-bold">(Host)</span>}
                      </div>
                      <div className="flex gap-1">
                        {isMuted && <MicOff className="h-4 w-4 text-destructive" />}
                        {isHost && <ShieldCheck className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                    {isHost && pendingRequests.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-zinc-400 px-2">Pending requests</div>
                        {pendingRequests.map(req => (
                          <div key={req.viewerId} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8 flex-shrink-0">
                                <AvatarFallback className="bg-zinc-700 text-white text-[10px] font-bold">
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
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarFallback className="bg-zinc-700 text-white text-[10px] font-bold">
                              {p.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isHost && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/10" onClick={() => socket.emit('targeted-command', { sessionId: meetingId, targetId: p.id, command: 'mute' })}>
                                <MicOff className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-destructive/20 text-destructive" onClick={() => socket.emit('targeted-command', { sessionId: meetingId, targetId: p.id, command: 'remove' })}>
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
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-3">Joining info</h3>
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                      <p className="text-sm text-zinc-300 mb-4">Share this link with others you want in the meeting</p>
                      <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-700">
                        <span className="text-xs text-zinc-400 truncate flex-1">{window.location.href}</span>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={copyMeetingLink}>Copy</Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-3">Meeting Security</h3>
                    <div className="flex items-center gap-3 text-sm text-zinc-400">
                      <ShieldCheck className="h-5 w-5 text-success" />
                      <span>End-to-end encrypted</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeSidebar === 'chat' && (
              <div className="p-4 border-t border-zinc-800 bg-zinc-900">
                <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-4 py-1 border border-zinc-700 focus-within:border-primary/50 transition-colors">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Send a message to everyone"
                    className="flex-1 bg-transparent border-none outline-none text-sm py-2"
                  />
                  <Button variant="ghost" size="icon" onClick={sendChatMessage} className="text-primary hover:bg-transparent">
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="h-24 px-6 flex items-center justify-between bg-[#202124] border-t border-zinc-800/50 relative z-50">
        <div className="flex items-center gap-4 text-sm font-medium hidden md:flex text-zinc-400 w-1/4">
          <div className="flex flex-col">
            <span className="text-white text-base tabular-nums">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-300 font-bold">{meetingId}</span>
              {isHost && <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[9px] font-black rounded uppercase tracking-tighter border border-primary/20">Host</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-center">
          {/* Main Controls */}
          <div className="flex items-center gap-3 bg-zinc-800/40 p-2 rounded-full border border-white/5 backdrop-blur-md">
            <Button
              variant="ghost"
              size="icon"
              className={`h-12 w-12 rounded-full border border-white/10 transition-all ${isMuted ? 'bg-destructive text-white hover:bg-destructive/80 scale-95' : 'bg-zinc-700 hover:bg-zinc-600'}`}
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className={`h-12 w-12 rounded-full border border-white/10 transition-all ${isVideoOff ? 'bg-destructive text-white hover:bg-destructive/80 scale-95' : 'bg-zinc-700 hover:bg-zinc-600'}`}
              onClick={toggleVideo}
            >
              {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={`h-12 w-12 rounded-full transition-all ${isScreenSharing ? 'bg-primary text-white hover:bg-primary/80' : 'bg-zinc-700 hover:bg-zinc-600 border border-white/10'}`}
              onClick={async () => {
                try {
                  if (!isScreenSharing) {
                    const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
                    const newTrack = ds.getVideoTracks()[0];
                    const oldTrack = localStream?.getVideoTracks()[0] || null;
                    Object.values(peersRef.current).forEach(peer => {
                      if (oldTrack) peer.replaceTrack(oldTrack, newTrack, localStream!);
                    });
                    setDisplayStream(ds);
                    if (localVideoRef.current) localVideoRef.current.srcObject = ds;
                    setIsScreenSharing(true);
                    newTrack.onended = async () => {
                      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
                      const camTrack = cam.getVideoTracks()[0];
                      Object.values(peersRef.current).forEach(peer => {
                        peer.replaceTrack(newTrack, camTrack, localStream!);
                      });
                      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
                      setIsScreenSharing(false);
                      ds.getTracks().forEach(t => t.stop());
                      setDisplayStream(null);
                    };
                  } else {
                    if (displayStream) {
                      const screenTrack = displayStream.getVideoTracks()[0];
                      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
                      const camTrack = cam.getVideoTracks()[0];
                      Object.values(peersRef.current).forEach(peer => {
                        peer.replaceTrack(screenTrack, camTrack, localStream!);
                      });
                      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
                      setIsScreenSharing(false);
                      displayStream.getTracks().forEach(t => t.stop());
                      setDisplayStream(null);
                    }
                  }
                } catch {
                  toast.error('Screen share failed');
                }
              }}
            >
              <MonitorUp className="h-5 w-5" />
            </Button>

            {/* Reactions Trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-zinc-700 hover:bg-zinc-600 border border-white/10">
                  <span className="text-xl">😊</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="grid grid-cols-4 gap-2 p-2 bg-zinc-900 border-zinc-800 rounded-2xl shadow-2xl">
                {['💖', '👍', '🎉', '👏', '😂', '😮', '😢', '🤔'].map((emoji) => (
                  <Button key={emoji} variant="ghost" className="h-10 w-10 text-xl p-0 hover:bg-white/10" onClick={() => sendReaction(emoji)}>
                    {emoji}
                  </Button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {isHost && <HostGlobalControls sessionId={meetingId!} />}

            <Button
              variant="destructive"
              size="icon"
              className="h-12 w-16 rounded-3xl hover:bg-destructive/90 transition-all hover:scale-105"
              onClick={handleLeave}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 w-1/4 justify-end"></div>
      </div>

      
      {!user && !guestReady && !hasJoined && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md bg-[#202124] border border-zinc-800 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">Join as Guest</h3>
            <p className="text-sm text-zinc-400 mb-4">Enter your name to join this meeting.</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (!guestName.trim()) {
                      toast.error('Please enter your name');
                      return;
                    }
                    setGuestName(guestName.trim());
                    setGuestReady(true);
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={() => {
                  if (!guestName.trim()) {
                    toast.error('Please enter your name');
                    return;
                  }
                  setGuestName(guestName.trim());
                  setGuestReady(true);
                }}
                className="px-6"
              >
                {waitingApproval ? 'Waiting...' : 'Join'}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-3">Or sign in to join with your account.</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float-up {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
          20% { transform: translate(-50%, -20px) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -150px) scale(1); opacity: 0; }
        }
        .animate-bounce-up {
          animation: float-up 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

const HostGlobalControls: React.FC<{ sessionId: string }> = ({ sessionId }) => {
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
          className="h-12 w-12 rounded-full bg-zinc-700 hover:bg-zinc-600 border border-white/10"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800 text-white">
        <DropdownMenuLabel>Host Controls</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem onClick={() => handleAction('mute-all')} className="hover:bg-zinc-800 cursor-pointer">
          <MicOff className="mr-2 h-4 w-4" /> Mute All
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('unmute-all')} className="hover:bg-zinc-800 cursor-pointer">
          <Mic className="mr-2 h-4 w-4" /> Unmute All
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem onClick={() => handleAction('close-video-all')} className="hover:bg-zinc-800 cursor-pointer">
          <VideoOff className="mr-2 h-4 w-4" /> Close All Videos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('open-video-all')} className="hover:bg-zinc-800 cursor-pointer">
          <Video className="mr-2 h-4 w-4" /> Open All Videos
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem onClick={() => {
          socket.emit('end-meeting', { sessionId });
        }} className="hover:bg-red-900/40 cursor-pointer text-red-400">
          <PhoneOff className="mr-2 h-4 w-4" /> End Meeting For All
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ParticipantVideo: React.FC<{ participant: Participant, isHost: boolean, sessionId: string }> = ({ participant, isHost, sessionId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const handleHostAction = (command: string) => {
    socket.emit('targeted-command', {
      sessionId,
      targetId: participant.id,
      command
    });
    toast.success(`Sent ${command} to ${participant.name}`);
  };

  return (
    <div className="relative aspect-video bg-zinc-800 rounded-xl overflow-hidden group border-2 border-transparent hover:border-primary/50 transition-all">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-2">
        {participant.name}
      </div>

      {isHost && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70" onClick={() => handleHostAction('mute')}>
            <MicOff className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70" onClick={() => handleHostAction('close-video')}>
            <VideoOff className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleHostAction('remove')}>
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MeetRoom;
