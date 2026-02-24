import React, { useEffect, useRef, useState, useCallback } from 'react';
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

interface Participant {
  id: string;
  stream: MediaStream;
  name: string;
  isLocal?: boolean;
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
  const [meetingData, setMeetingData] = useState<any>(null);
  
  const peersRef = useRef<{ [key: string]: SimplePeer.Instance }>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);

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

  // Initialize local stream
  useEffect(() => {
    if (!user) {
      navigate('/meet');
      return;
    }

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Join the meeting room with userId for host verification
        socket.emit('join-session', { sessionId: meetingId, userId: user.uid });
        socket.emit('viewer-connected', { sessionId: meetingId, viewerId: socket.id });

      } catch (err) {
        console.error("Failed to get local stream", err);
        toast.error("Could not access camera/microphone");
      }
    };

    init();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      Object.values(peersRef.current).forEach(peer => peer.destroy());
    };
  }, [meetingId, user]);

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

    socket.on('viewer-connected', ({ viewerId }) => {
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
          return [...prev, { id: viewerId, stream, name: 'Guest' }];
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
    <div className="h-screen bg-[#202124] flex flex-col text-white overflow-hidden">
      {/* Main Grid Area */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className={`grid gap-4 w-full max-w-7xl mx-auto transition-all duration-500 ${getGridClass()}`}>
          {/* Local Video */}
          <div className="relative aspect-video bg-zinc-800 rounded-xl overflow-hidden group border-2 border-transparent hover:border-primary/50 transition-all">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-3xl font-bold">{user?.displayName?.charAt(0)}</span>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-2">
              {user?.displayName} (You)
              {isMuted && <MicOff className="h-3 w-3 text-destructive" />}
            </div>
          </div>

          {/* Remote Participants */}
          {participants.map(p => (
            <ParticipantVideo key={p.id} participant={p} isHost={isHost} sessionId={meetingId!} />
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-20 px-6 flex items-center justify-between bg-[#202124]">
        <div className="flex items-center gap-2 text-sm font-medium hidden md:flex text-zinc-400">
          <span className="tabular-nums">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="opacity-20">|</span>
          <span className="text-white">{meetingId}</span>
          {isHost && <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">Host</span>}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className={`h-12 w-12 rounded-full border border-white/10 ${isMuted ? 'bg-destructive text-white hover:bg-destructive/80' : 'bg-zinc-700 hover:bg-zinc-600'}`}
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className={`h-12 w-12 rounded-full border border-white/10 ${isVideoOff ? 'bg-destructive text-white hover:bg-destructive/80' : 'bg-zinc-700 hover:bg-zinc-600'}`}
            onClick={toggleVideo}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-zinc-700 hover:bg-zinc-600 border border-white/10"
            onClick={() => setIsScreenSharing(!isScreenSharing)}
          >
            <MonitorUp className={`h-5 w-5 ${isScreenSharing ? 'text-primary' : ''}`} />
          </Button>

          {isHost ? (
            <HostGlobalControls sessionId={meetingId!} />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-zinc-700 hover:bg-zinc-600 border border-white/10"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          )}

          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-16 rounded-3xl"
            onClick={handleLeave}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-12 w-12 text-white hover:bg-white/10">
            <Info className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-12 w-12 text-white hover:bg-white/10">
            <Users className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-12 w-12 text-white hover:bg-white/10">
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>
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
