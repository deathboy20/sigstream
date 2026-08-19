import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { useAuth } from '../contexts/AuthContext';
import { Mic, MicOff, Video, Monitor, Volume2, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { api } from '../services/api';
import { toast } from 'sonner';
import { useSigtrackContext } from '../hooks/useSigtrackContext';

interface LocationState {
  mode: 'host' | 'join';
  meetingCode?: string;
  meetingId?: string;
}

const PreviewSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const sigtrack = useSigtrackContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const state = location.state as LocationState;
  const mode = state?.mode || 'host';
  const meetingCode = state?.meetingCode;
  
  const {
    videoDevices,
    audioDevices,
    selectedDevices,
    stream,
    error: deviceError,
    isLoading,
    selectDevice,
    getStream,
    getScreenShare,
    stopStream,
  } = useMediaDevices();
  
  const [microphoneMuted, setMicrophoneMuted] = useState(false);
  const [selectedInputType, setSelectedInputType] = useState<'camera' | 'screen'>('camera');
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Redirect if no mode provided
  useEffect(() => {
    if (!state?.mode) {
      navigate('/meet');
    }
  }, [state, navigate]);

  // Setup video preview
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      
      const audioTracks = stream.getAudioTracks();
      setHasAudioTrack(audioTracks.length > 0);

      if (audioTracks.length > 0 && !audioContextRef.current) {
        try {
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(stream);
          const analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 256;
          source.connect(analyzer);
          
          audioContextRef.current = audioContext;
          analyzerRef.current = analyzer;

          const updateLevel = () => {
            if (analyzerRef.current) {
              const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
              analyzerRef.current.getByteFrequencyData(dataArray);
              const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
              setAudioLevel(Math.min(100, (average / 256) * 100));
            }
            requestAnimationFrame(updateLevel);
          };
          updateLevel();
        } catch (error) {
          console.error('Error setting up audio analyzer:', error);
        }
      }
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  const handleStartPreview = async () => {
    if (selectedInputType === 'camera') {
      await getStream();
    } else {
      await getScreenShare();
    }
  };

  const handleToggleMute = () => {
    const newMutedState = !microphoneMuted;
    setMicrophoneMuted(newMutedState);
    
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !newMutedState;
      });
    }
  };

  const handleStartMeeting = async () => {
    if (!stream) {
      toast.error('Please start preview first');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setIsStarting(true);
    try {
      const setup = {
        videoDeviceId: selectedDevices.videoDeviceId,
        audioDeviceId: selectedDevices.audioDeviceId,
        muted: microphoneMuted,
        inputType: selectedInputType,
      };
      sessionStorage.setItem('meetSetupContext', JSON.stringify(setup));

      if (mode === 'host') {
        const existingId = state?.meetingId;
        const id = existingId || Math.random().toString(36).substring(2, 12);
        if (!existingId) {
          await api.createMeeting({
            id,
            hostId: user.uid,
            hostName: user.displayName || sigtrack.teamName || 'Anonymous',
            title: `${sigtrack.teamName || user.displayName}'s Meeting`,
            participatingTeamIds: sigtrack.teamId ? [sigtrack.teamId, ...sigtrack.meetPrivilege.autoIncludeTeamIds] : sigtrack.meetPrivilege.autoIncludeTeamIds,
            allowedJoinTeamIds: sigtrack.teamId ? [sigtrack.teamId, ...sigtrack.meetPrivilege.autoIncludeTeamIds] : undefined,
          });
        }
        navigate(`/meet/${id}`);
      } else {
        navigate(`/meet/${meetingCode}`);
      }
    } catch (error) {
      toast.error(mode === 'host' ? 'Failed to start meeting' : 'Failed to join meeting');
      console.error(error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleInputTypeChange = async (type: 'camera' | 'screen') => {
    stopStream();
    setSelectedInputType(type);
    setMicrophoneMuted(false);
  };

  const selectVideoDevice = async (deviceId: string) => {
    selectDevice('video', deviceId);
    if (selectedInputType === 'camera') {
      await getStream({ videoDeviceId: deviceId });
    }
  };

  const selectAudioDevice = async (deviceId: string) => {
    selectDevice('audio', deviceId);
    await getStream({ audioDeviceId: deviceId });
  };

  const pageTitle = mode === 'host' ? 'Start Your Meeting' : 'Join Meeting';
  const pageDesc = mode === 'host' ? 'Select your devices and preview before starting' : `Join with meeting code: ${meetingCode}`;
  const actionButtonText = mode === 'host' ? 'Start Meeting' : 'Join Meeting';

  return (
    <div className="h-[100dvh] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="p-2 sm:p-3 md:p-6 w-full">
          <div className="max-w-6xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 md:gap-4">
          <button
            onClick={() => navigate('/meet')}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{pageTitle}</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-400 mt-1 break-words">
              {pageDesc}
              {sigtrack.teamName ? ` · Team: ${sigtrack.teamName}` : ''}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {deviceError && (
          <Alert className="mb-4 sm:mb-6 bg-red-500/10 border-red-500/30 text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm md:text-base">{deviceError}</AlertDescription>
          </Alert>
        )}

        {/* Mobile-First Responsive Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {/* Preview Panel - Full width on mobile, spans 2 cols on desktop */}
          <div className="md:col-span-2 space-y-3 sm:space-y-4">
            {/* Video Preview */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2 sm:pb-3 md:pb-4">
                <CardTitle className="text-base sm:text-lg md:text-xl text-white">Preview</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Your camera and audio preview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  {stream ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full ${selectedInputType === 'screen' ? 'object-contain bg-black' : 'object-cover -scale-x-100'}`}
                      />
                      {/* Audio Level Indicator */}
                      {hasAudioTrack && (
                        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-black/60 rounded-lg p-2 sm:p-3 backdrop-blur-sm">
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                            <div className="w-16 sm:w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all"
                                style={{ width: `${audioLevel}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Mute Indicator */}
                      {microphoneMuted && (
                        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-red-500 rounded-full p-2">
                          <MicOff className="h-4 sm:h-5 w-4 sm:w-5 text-white" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-4">
                      <Video className="h-12 sm:h-16 w-12 sm:w-16 mb-3 sm:mb-4 opacity-50" />
                      <p className="text-sm sm:text-base">No preview available</p>
                      <p className="text-xs sm:text-sm mt-2 text-center">Select devices and click "Start Preview"</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Audio Level Card */}
            {stream && hasAudioTrack && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-3 sm:pt-4 md:pt-6">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs sm:text-sm font-medium text-gray-300 block mb-2">Microphone Level</label>
                      <div className="h-6 sm:h-8 bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all"
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {microphoneMuted ? 'Microphone is muted' : 'Microphone is active'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Settings Panel - Stacks on mobile */}
          <div className="space-y-3 sm:space-y-4">
            {/* Input Type Selection - Only show for host */}
            {mode === 'host' && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg text-white">Input Source</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <button
                    onClick={() => handleInputTypeChange('camera')}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all text-sm sm:text-base ${
                      selectedInputType === 'camera'
                        ? 'bg-blue-600 text-white border border-blue-500'
                        : 'bg-slate-700/50 text-gray-300 border border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    <Video className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span>Camera</span>
                  </button>
                  <button
                    onClick={() => handleInputTypeChange('screen')}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all text-sm sm:text-base ${
                      selectedInputType === 'screen'
                        ? 'bg-blue-600 text-white border border-blue-500'
                        : 'bg-slate-700/50 text-gray-300 border border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    <Monitor className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span>Share Screen</span>
                  </button>
                </CardContent>
              </Card>
            )}

            {/* Camera Selection */}
            {selectedInputType === 'camera' && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg text-white">Camera</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {videoDevices.length > 0 ? (
                    <select
                      value={selectedDevices.videoDeviceId || ''}
                      onChange={(e) => selectVideoDevice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select camera...</option>
                      {videoDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-400 text-xs sm:text-sm">No cameras found</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Microphone Selection */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-base sm:text-lg text-white">Microphone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {audioDevices.length > 0 ? (
                  <select
                    value={selectedDevices.audioDeviceId || ''}
                    onChange={(e) => selectAudioDevice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select microphone...</option>
                    {audioDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-400 text-xs sm:text-sm">No microphones found</p>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-2 md:space-y-3 sticky bottom-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent p-3 sm:p-0 -mx-2 sm:-mx-3 md:mx-0 md:p-0 md:bg-none md:sticky-auto">
              {!stream ? (
                <Button
                  onClick={handleStartPreview}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white h-9 sm:h-10 text-sm sm:text-base"
                >
                  {isLoading ? 'Loading...' : 'Start Preview'}
                </Button>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={handleToggleMute}
                      variant="outline"
                      className="flex-1 text-white border-slate-600 hover:bg-slate-700 h-9 sm:h-10 text-xs sm:text-sm"
                    >
                      {microphoneMuted ? (
                        <>
                          <MicOff className="h-3 sm:h-4 w-3 sm:w-4 mr-1 sm:mr-2" />
                          Unmute
                        </>
                      ) : (
                        <>
                          <Mic className="h-3 sm:h-4 w-3 sm:w-4 mr-1 sm:mr-2" />
                          Mute
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleStartPreview}
                      variant="outline"
                      className="flex-1 text-white border-slate-600 hover:bg-slate-700 h-9 sm:h-10 text-xs sm:text-sm"
                    >
                      Change
                    </Button>
                  </div>
                  <Button
                    onClick={handleStartMeeting}
                    disabled={isStarting}
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-9 sm:h-10 text-sm sm:text-base"
                  >
                    {isStarting ? 'Joining...' : (
                      <>
                        <Check className="h-3 sm:h-4 w-3 sm:w-4 mr-1 sm:mr-2" />
                        {actionButtonText}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Device Status */}
            {stream && (
              <Alert className="bg-green-500/10 border-green-500/30 text-green-400">
                <Check className="h-4 w-4 flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">Ready to {mode === 'host' ? 'start' : 'join'}!</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
};

export default PreviewSetupPage;
        