import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Radio, User, Lock, Users, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api } from '../services/api';
import { Viewer } from '../types/streaming.types';
import { socket } from '../contexts/StreamContext';
import SimplePeer from 'simple-peer';
import { toast } from 'sonner';

type ViewerState = 'join' | 'waiting' | 'watching' | 'rejected';

const ViewerPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [viewerState, setViewerState] = useState<ViewerState>('join');
  const [name, setName] = useState('');
  const [waitTime, setWaitTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endDialogMessage, setEndDialogMessage] = useState(
    'Session ended. Kindly close the window or rejoin if you mistakenly disconnected.'
  );
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);

  const showSessionEnded = useCallback((message?: string) => {
    if (message) {
      setEndDialogMessage(message);
    } else {
      setEndDialogMessage('Session ended. Kindly close the window or rejoin if you mistakenly disconnected.');
    }
    setEndDialogOpen(true);
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
  }, []);

  // Fetch session info on load
  useEffect(() => {
    if (sessionId) {
        api.getSession(sessionId).then(data => {
            setSessionInfo(data);
            if (data && data.isActive === false && viewerState !== 'join') {
              showSessionEnded();
            }
        }).catch(err => {
            console.error('Failed to load session info:', err);
            setError('Session not found or ended');
            if (viewerState !== 'join') {
              showSessionEnded();
            }
        });

        // Poll for updates (e.g. viewer count)
        const interval = setInterval(() => {
             api.getSession(sessionId).then(data => {
               setSessionInfo(data);
               if (data && data.isActive === false && viewerState !== 'join') {
                 showSessionEnded();
               }
             }).catch(() => {
               if (viewerState !== 'join') {
                 showSessionEnded();
               }
             });
        }, 5000);
        return () => clearInterval(interval);
    }
  }, [sessionId, viewerState, showSessionEnded]);

  // Timer for waiting room
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (viewerState === 'waiting') {
      interval = setInterval(() => {
        setWaitTime(prev => prev + 1);
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    }
    return () => clearInterval(interval);
  }, [viewerState]);

  const handleJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!sessionId) {
        setError('Invalid session ID');
        return;
    }
    setError(null);
    
    try {
        const newViewer = await api.requestJoin(sessionId, name);
        setViewer(newViewer);
        setViewerState(newViewer.status === 'approved' ? 'watching' : 'waiting');
        
        // Join Socket Room
        socket.emit('join-session', sessionId);
        socket.emit('join-user', newViewer.id);

    } catch (err) {
        setError('Failed to submit join request');
        console.error(err);
    }
  };

  const handleCancelRequest = () => {
    setViewerState('join');
    setWaitTime(0);
    setViewer(null);
  };

  const formatWaitTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Manage Socket Rooms & Reconnection
  useEffect(() => {
    if (!viewer || !sessionId) return;

    const joinRooms = () => {
        console.log('Joining rooms for viewer:', viewer.id);
        socket.emit('join-session', sessionId);
        socket.emit('join-user', viewer.id);
    };

    if (socket.connected) {
        joinRooms();
    }

    socket.on('connect', joinRooms);

    return () => {
        socket.off('connect', joinRooms);
    };
  }, [viewer, sessionId]);

  // Polling for Approval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (viewerState === 'waiting' && viewer && sessionId) {
        interval = setInterval(async () => {
            try {
                const viewers = await api.getViewers(sessionId);
                const myViewer = Object.values(viewers).find((v: any) => v.id === viewer.id) as Viewer | undefined;
                
                if (myViewer) {
                    if (myViewer.status === 'approved') {
                        setViewerState('watching');
                    } else if (myViewer.status === 'rejected') {
                        setViewerState('rejected');
                        setError('Your request was rejected by the host.');
                    }
                } else {
                    setViewerState('rejected');
                    showSessionEnded('You were removed from the session. Kindly close the window or rejoin if you mistakenly disconnected.');
                }
            } catch (e) {
                console.error('Polling error', e);
            }
        }, 2000);
    }
    return () => clearInterval(interval);
  }, [viewerState, viewer, sessionId, showSessionEnded]);

  // WebRTC Connection Logic (when watching)
  useEffect(() => {
    if (viewerState === 'watching' && viewer && sessionId) {
        console.log('Viewer entering watching state, emitting ready...');
        // Emit 'viewer-ready' to Host to trigger Offer
        socket.emit('viewer-ready', { sessionId, viewerId: viewer.id });

        // Wait for Offer from Host
        const handleSignal = (data: { signal: any; sender: string; metadata?: any }) => {
            if (data.metadata?.host) {
                console.log('Received Offer from Host');
                
                // If it's a new Offer (type 'offer'), reset peer to handle restart/renegotiation
                if (data.signal.type === 'offer' && peerRef.current) {
                    console.log('Received new offer, replacing peer');
                    peerRef.current.destroy();
                    peerRef.current = null;
                }

                if (!peerRef.current) {
                    try {
                        console.log('Creating new SimplePeer instance...');
                        const peer = new SimplePeer({
                            initiator: false,
                            trickle: false
                        });

                        peer.on('signal', (signalData) => {
                            console.log('Sending Answer to Host');
                            socket.emit('signal', {
                                target: data.sender, // Host's socket ID
                                signal: signalData,
                                sessionId: sessionId,
                                metadata: { viewerId: viewer.id }
                            });
                        });

                        peer.on('stream', (stream) => {
                            console.log('Received Stream', stream);
                            if (videoRef.current) {
                                videoRef.current.srcObject = stream;
                                videoRef.current.onplaying = () => {
                                    console.log('Video is playing! Emitting viewer-watching confirmation.');
                                    socket.emit('viewer-watching', { sessionId, viewerId: viewer.id });
                                };
                                videoRef.current.play().catch(e => {
                                    console.error('Play error', e);
                                    toast.error('Click play to start watching');
                                });
                            }
                        });

                        peer.on('error', (err) => {
                            console.error('Peer error', err);
                            toast.error('Connection error: ' + err.message);
                        });

                        peer.signal(data.signal);
                        peerRef.current = peer;
                    } catch (err: any) {
                        console.error('Failed to create SimplePeer:', err);
                        toast.error('WebRTC initialization failed: ' + err.message);
                    }
                } else {
                    peerRef.current.signal(data.signal);
                }
            }
        };

        socket.on('signal', handleSignal);

        return () => {
            socket.off('signal', handleSignal);
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
        };
    }
  }, [viewerState, viewer, sessionId]);

  useEffect(() => {
    if (viewerState !== 'watching' || !viewer || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const session = await api.getSession(sessionId);
        if (session && session.isActive === false) {
          setViewerState('rejected');
          showSessionEnded();
          return;
        }

        const viewers = await api.getViewers(sessionId);
        const myViewer = Object.values(viewers).find((v: any) => v.id === viewer.id) as Viewer | undefined;
        if (!myViewer) {
          setViewerState('rejected');
          showSessionEnded('You were removed from the session. Kindly close the window or rejoin if you mistakenly disconnected.');
        }
      } catch (e) {
        setViewerState('rejected');
        showSessionEnded();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [viewerState, viewer, sessionId, showSessionEnded]);

  // Join Request Form
  if (viewerState === 'join' || viewerState === 'rejected') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex flex-col items-center gap-3">
                <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-10 w-auto" />
                <DialogTitle>Session ended</DialogTitle>
              </div>
              <DialogDescription className="text-center">
                {endDialogMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => navigate(sessionId ? `/join/${sessionId}` : '/join')}>Rejoin</Button>
              <Button variant="outline" onClick={() => navigate('/')}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
               <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-10 w-auto" />
              <span className="text-2xl font-bold text-primary">Sig-stream</span>
            </div>
            <CardTitle>Join Live Stream</CardTitle>
            <CardDescription>
              Enter your name to request access to this stream
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinRequest} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Your Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name..."
                  className="bg-background"
                />
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>You're joining a live stream:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Session ID: {sessionId || 'Unknown'}</li>
                  {sessionInfo && (
                    <li className="flex items-center gap-1">
                       <span className={`w-2 h-2 rounded-full ${sessionInfo.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                       Status: {sessionInfo.isActive ? 'Live' : 'Ended'}
                    </li>
                  )}
                  <li className="flex items-center gap-1">
                    <Users className="h-4 w-4 inline" />
                    Viewers watching: {sessionInfo ? Object.keys(sessionInfo.viewers || {}).length : '...'}
                  </li>
                </ul>
              </div>

              <Button type="submit" className="w-full" size="lg">
                🚀 Request to Join
              </Button>
            </form>

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <Lock className="h-4 w-4" />
              The host will approve your request
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting Room
  if (viewerState === 'waiting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex flex-col items-center gap-3">
                <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-10 w-auto" />
                <DialogTitle>Session ended</DialogTitle>
              </div>
              <DialogDescription className="text-center">
                {endDialogMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => navigate(sessionId ? `/join/${sessionId}` : '/join')}>Rejoin</Button>
              <Button variant="outline" onClick={() => navigate('/')}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <div className="flex flex-col items-center justify-center gap-2 mb-4">
              <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-12 w-auto drop-shadow-md" />
              <span className="text-2xl font-bold text-primary">Sig-stream</span>
            </div>
            <CardTitle>⏳ Waiting for Approval</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="py-8">
              <Loader2 className="h-16 w-16 mx-auto text-accent animate-spin" />
            </div>

            <div className="space-y-2">
              <p className="font-medium">Your join request has been sent!</p>
              <p className="text-sm text-muted-foreground">
                The host is reviewing your request.<br />
                Please wait while they approve your access.
              </p>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center justify-center gap-2">
                <User className="h-4 w-4" />
                Requested as: {name}
              </p>
              <p>🕐 Waiting for: {formatWaitTime(waitTime)}</p>
            </div>

            <Button variant="outline" onClick={handleCancelRequest}>
              Cancel Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Watching Stream
  if (viewerState === 'watching') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex flex-col items-center gap-3">
                <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-10 w-auto" />
                <DialogTitle>Session ended</DialogTitle>
              </div>
              <DialogDescription className="text-center">
                {endDialogMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => navigate(sessionId ? `/join/${sessionId}` : '/join')}>Rejoin</Button>
              <Button variant="outline" onClick={() => navigate('/')}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border bg-card shadow-sm">
          <div className="flex items-center gap-2">
            <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-8 w-auto" />
            <span className="text-lg font-bold text-primary">Sig-stream</span>
          </div>
          <div className="flex items-center gap-2 text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Connected
          </div>
        </div>

        {/* Video Player */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-4xl">
            <div className="relative bg-stream-bg aspect-video rounded-lg overflow-hidden shadow-2xl border border-border max-h-[70vh] sm:max-h-none">
              <video 
                ref={videoRef}
                autoPlay
                playsInline
                controls
                className="w-full h-full object-contain sm:object-cover"
              />
              
              {/* Logo Overlay */}
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 pointer-events-none">
                <img 
                  src="/sigtrack-tube.png" 
                  alt="Sig-stream" 
                  className="h-8 sm:h-12 w-auto drop-shadow-lg opacity-80"
                />
              </div>

              {/* Live Badge */}
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 pointer-events-none">
                <span className="bg-red-600 text-white px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm font-bold animate-pulse shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-white"></span> LIVE
                </span>
              </div>

              {/* Stream Info */}
              <div className="absolute bottom-4 left-4 hidden sm:flex items-center gap-4 text-xs text-white/80 pointer-events-none">
                <span>Live</span>
                <span>1920x1080</span>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground text-center sm:text-left">
              <span>Connection: Excellent • Bitrate: 2.5 Mbps</span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                Leave Stream
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ViewerPage;
