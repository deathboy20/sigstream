import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Maximize2, Share2, Send, Users, MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { useConference } from '../hooks/useConference';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Alert, AlertDescription } from '../components/ui/alert';

type ViewState = 'joining' | 'waiting' | 'active' | 'error';

const ConferenceRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { 
    room, 
    participants, 
    localStream, 
    remoteStreams,
    chatMessages,
    isScreenSharing,
    joinRoom,
    leaveRoom,
    getLocalStream,
    stopLocalStream,
    toggleLocalVideo,
    toggleLocalAudio,
    sendChatMessage,
    startScreenShare,
    stopScreenShare
  } = useConference();

  const [viewState, setViewState] = useState<ViewState>('joining');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Join conference on mount or when userNamechanges
  const handleJoinConference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !roomId) {
      setError('Please enter your name');
      return;
    }

    setViewState('joining');
    setError(null);

    try {
      // Get local media stream
      const stream = await getLocalStream();
      if (!stream) {
        throw new Error('Failed to access media devices');
      }

      // Join room
      await joinRoom(roomId, userName);
      setViewState('active');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join conference';
      setError(errorMessage);
      setViewState('error');
      toast.error('Join failed: ' + errorMessage);
    }
  };

  // Set local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote video streams
  useEffect(() => {
    remoteStreams.forEach((stream, participantId) => {
      const videoEl = remoteVideoRefs.current.get(participantId);
      if (videoEl) {
        videoEl.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  // Handle leave conference
  const handleLeaveConference = async () => {
    try {
      await leaveRoom();
      stopLocalStream();
      navigate('/conference');
    } catch (error) {
      toast.error('Error leaving conference');
    }
  };

  // Handle screen share
  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (error) {
      toast.error('Screen share failed');
    }
  };

  // Handle send chat message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendChatMessage(chatMessage);
      setChatMessage('');
    }
  };

  // Toggle video
  const handleToggleVideo = () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    toggleLocalVideo(newState);
  };

  // Toggle audio
  const handleToggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    toggleLocalAudio(newState);
  };

  if (!roomId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Alert variant="destructive" className="w-96">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Invalid room ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Join screen
  if (viewState === 'joining' || viewState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">Join Conference</h1>
              <p className="text-gray-300">Enter your name to join the room</p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleJoinConference} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Your Name</label>
                <Input
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder-gray-500 mt-2"
                  disabled={viewState === 'joining'}
                />
              </div>

              <Button
                type="submit"
                disabled={viewState === 'joining' || !userName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {viewState === 'joining' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Conference'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/conference')}
                className="w-full bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active conference screen
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            {room ? room.name[0].toUpperCase() : 'C'}
          </div>
          <div>
            <h1 className="text-white font-semibold">{room?.name || 'Conference Room'}</h1>
            <p className="text-sm text-gray-400">{participants.length} participants</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowParticipants(!showParticipants)}
            className="text-gray-300 hover:text-white"
          >
            <Users className="w-4 h-4 mr-2" />
            Participants ({participants.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="text-gray-300 hover:text-white"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">
        {/* Video Area */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Remote Videos Grid */}
          <div className="flex-1 bg-slate-800 rounded-lg p-4 overflow-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {participants.map((participant) => (
              <div key={participant.id} className="bg-slate-900 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={(el) => {
                    if (el) remoteVideoRefs.current.set(participant.id, el);
                  }}
                  autoPlay
                  playsInline
                  muted={false}
                  className="w-full h-full bg-black object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
                  {participant.name}
                </div>
              </div>
            ))}
          </div>

          {/* Local Video (Picture in Picture) */}
          <div className="bg-slate-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            {localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full bg-black object-cover"
              />
            ) : (
              <div className="text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Loading camera...</p>
              </div>
            )}
          </div>

          {/* Control Bar */}
          <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handleToggleVideo}
              className={isVideoEnabled ? 'bg-slate-700 border-slate-600' : 'bg-red-600 border-red-600'}
            >
              {isVideoEnabled ? '📹 Video' : '📹 Video Off'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleToggleAudio}
              className={isAudioEnabled ? 'bg-slate-700 border-slate-600' : 'bg-red-600 border-red-600'}
            >
              {isAudioEnabled ? '🎤 Audio' : '🎤 Muted'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleScreenShare}
              className={isScreenSharing ? 'bg-blue-600 border-blue-600' : 'bg-slate-700 border-slate-600'}
            >
              <Share2 className="w-4 h-4 mr-2" />
              {isScreenSharing ? 'Stop Share' : 'Share Screen'}
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={handleLeaveConference}
              className="bg-red-600 hover:bg-red-700"
            >
              <Phone className="w-4 h-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>

        {/* Sidebar: Participants or Chat */}
        {(isChatOpen || showParticipants) && (
          <div className="w-80 bg-slate-800 rounded-lg flex flex-col border border-slate-700">
            {isChatOpen ? (
              <>
                {/* Chat Header */}
                <div className="border-b border-slate-700 p-4 font-semibold text-white flex items-center justify-between">
                  <span>Chat</span>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 ? (
                    <p className="text-gray-500 text-center text-sm py-8">No messages yet</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="text-sm">
                        <p className="text-blue-400 font-medium">{msg.senderName}</p>
                        <p className="text-gray-300 text-xs">{msg.text}</p>
                        <p className="text-gray-600 text-xs">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Chat Input */}
                <div className="border-t border-slate-700 p-3">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      placeholder="Type message..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white text-sm flex-1"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <>
                {/* Participants Header */}
                <div className="border-b border-slate-700 p-4 font-semibold text-white flex items-center justify-between">
                  <span>Participants ({participants.length})</span>
                  <button
                    onClick={() => setShowParticipants(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Participants List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="bg-slate-700 rounded p-3 text-sm text-gray-300"
                    >
                      <p className="font-medium text-white">{participant.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Status: {participant.status}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConferenceRoom;
