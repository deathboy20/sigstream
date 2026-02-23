import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Share2, Send, Users, MessageSquare, Loader2, AlertCircle, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { useConference } from '../hooks/useConference';
import ConferenceHeader from '../components/Conference/ConferenceHeader';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { api } from '../services/api';

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

  // Validate room exists when component mounts
  useEffect(() => {
    const validateRoom = async () => {
      if (!roomId) {
        setError('Invalid room ID');
        setViewState('error');
        return;
      }

      try {
        // Use API module for proper error handling
        const conferenceData = await api.getConference(roomId);
        
        // Check if conference is still active
        if (!conferenceData.isActive) {
          setError('This conference has ended');
          setViewState('error');
          return;
        }

        // Check if conference has expired
        if (conferenceData.expiresAt && new Date(conferenceData.expiresAt) < new Date()) {
          setError('This conference has expired');
          setViewState('error');
          return;
        }

        // Room is valid, show join screen
        setViewState('joining');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load conference';
        
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          setError('Meeting not found or has been closed');
        } else {
          setError(errorMessage);
        }
        
        console.error('Room validation error:', err);
        setViewState('error');
      }
    };

    validateRoom();
  }, [roomId]);

  // When join is successful and room is set, transition to active view
  useEffect(() => {
    if (room && viewState === 'joining' && room.id === roomId) {
      setViewState('active');
    }
  }, [room, roomId, viewState]);

  const handleJoinConference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !roomId) {
      setError('Please enter your name');
      return;
    }

    setViewState('joining');
    setError(null);

    try {
      // Join room with existing local stream
      await joinRoom(roomId, userName);
      // State transition will happen via useEffect above
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join conference';
      
      // Check if it's a room not found error
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setError('Meeting not found or has been closed');
      } else if (errorMessage.includes('expired')) {
        setError('This conference has expired');
      } else if (errorMessage.includes('ended')) {
        setError('This conference has ended');
      } else {
        setError(errorMessage);
      }
      setViewState('error');
      toast.error('Join failed: ' + errorMessage);
    }
  };

  // Initialize local stream when join screen is shown
  useEffect(() => {
    if ((viewState === 'joining' || viewState === 'error') && !localStream) {
      const initializeMedia = async () => {
        try {
          await getLocalStream();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to access camera';
          setError(errorMsg);
          toast.error(errorMsg);
        }
      };
      initializeMedia();
    }
  }, [viewState, localStream, getLocalStream]);

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

  // Error screen
  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <Card className="bg-slate-800 border-slate-700 w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Unable to Join</h2>
              <p className="text-gray-300 mb-4">{error}</p>
              <Button 
                onClick={() => navigate('/conference')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Back to Conferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Join screen
  if (viewState === 'joining') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">Join Conference</h1>
                <p className="text-gray-300">Set up your media and enter your name</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Video Preview */}
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center border-2 border-slate-700">
                    {localStream ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full bg-black object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Loading camera...</p>
                      </div>
                    )}
                  </div>

                  {/* Media Controls */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleToggleVideo}
                      className={`flex-1 ${
                        isVideoEnabled
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400 hover:bg-blue-600/30'
                          : 'bg-red-600/20 border-red-500 text-red-400 hover:bg-red-600/30'
                      }`}
                    >
                      {isVideoEnabled ? '📹' : '📹‍🚫'} {isVideoEnabled ? 'Camera On' : 'Camera Off'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleToggleAudio}
                      className={`flex-1 ${
                        isAudioEnabled
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400 hover:bg-blue-600/30'
                          : 'bg-red-600/20 border-red-500 text-red-400 hover:bg-red-600/30'
                      }`}
                    >
                      {isAudioEnabled ? '🎤' : '🔇'} {isAudioEnabled ? 'Mic On' : 'Muted'}
                    </Button>
                  </div>
                </div>

                {/* Join Form */}
                <form onSubmit={handleJoinConference} className="flex flex-col gap-4 justify-center">
                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-2">Your Name</label>
                    <Input
                      placeholder="Enter your name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder-gray-500"
                      disabled={viewState === 'joining'}
                      autoFocus
                    />
                  </div>

                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-gray-300">Media Status</p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isVideoEnabled ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-sm text-gray-300">
                        Camera: {isVideoEnabled ? 'Ready' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isAudioEnabled ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-sm text-gray-300">
                        Microphone: {isAudioEnabled ? 'Ready' : 'Muted'}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={viewState === 'joining' || !userName.trim()}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6"
                  >
                    {viewState === 'joining' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      '➡️ Join Conference'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      stopLocalStream();
                      navigate('/conference');
                    }}
                    className="w-full bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                  >
                    Cancel
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Active conference screen
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header with Share */}
      <ConferenceHeader room={room} participantCount={participants.length} />

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
