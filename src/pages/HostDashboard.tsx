import React, { useEffect, useCallback } from 'react';
import { useStream, StreamProvider } from '../contexts/StreamContext';
import { useMediaDevices } from '../hooks/useMediaDevices';
import DeviceSelector from '../components/Host/DeviceSelector';
import StreamPreview from '../components/Host/StreamPreview';
import Header from '../components/Host/Header';
import UnifiedSidebar from '../components/Host/UnifiedSidebar';
import { Alert, AlertDescription } from '../components/ui/alert';
import { AlertCircle, Radio } from 'lucide-react';

const HostDashboardContent: React.FC = () => {
  const {
    session,
    viewers,
    pendingRequests,
    streamState,
    createSession,
    startStreaming,
    stopStreaming,
    pauseStreaming,
    resumeStreaming,
    toggleMute,
    updateDuration,
    removeViewer,
    approveRequest,
    rejectRequest,
    setStream, // Destructure setStream
  } = useStream();

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
    toggleMute: toggleDeviceMute,
  } = useMediaDevices();

  // Auto-create session on mount
  useEffect(() => {
    if (!session) {
      createSession();
    }
  }, [session, createSession]);

  // Sync stream to context
  useEffect(() => {
    setStream(stream);
  }, [stream, setStream]);

  // Duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (streamState.isStreaming && !streamState.isPaused) {
      interval = setInterval(() => {
        updateDuration(streamState.duration + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [streamState.isStreaming, streamState.isPaused, streamState.duration, updateDuration]);

  const handleStartPreview = useCallback(() => {
    getStream();
  }, [getStream]);

  const handleScreenShare = useCallback(() => {
    getScreenShare();
  }, [getScreenShare]);

  const handleStartStreaming = useCallback(() => {
    if (stream) {
      startStreaming();
    }
  }, [stream, startStreaming]);

  const handleStopStreaming = useCallback(() => {
    stopStreaming();
    stopStream();
  }, [stopStreaming, stopStream]);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    toggleDeviceMute();
  }, [toggleMute, toggleDeviceMute]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Radio className="h-12 w-12 mx-auto mb-4 text-accent animate-pulse" />
          <p className="text-muted-foreground">Initializing session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Branding, Stats, and Share */}
      <Header
        session={session}
        viewerCount={viewers.filter(v => v.status === 'approved').length}
        duration={streamState.duration}
      />

      <div className="flex-1 container mx-auto px-4 py-4 sm:px-6 sm:py-6">
        {/* Error Alert */}
        {deviceError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{deviceError}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:h-[calc(100vh-140px)]">
          {/* Left Column - Device Selector */}
          <div className="lg:col-span-1 space-y-6 lg:overflow-y-auto">
            <DeviceSelector
              videoDevices={videoDevices}
              audioDevices={audioDevices}
              selectedVideoId={selectedDevices.videoDeviceId}
              selectedAudioId={selectedDevices.audioDeviceId}
              onSelectVideo={(id) => selectDevice(id, 'videoinput')}
              onSelectAudio={(id) => selectDevice(id, 'audioinput')}
              onStartPreview={handleStartPreview}
              onScreenShare={handleScreenShare}
              isLoading={isLoading}
              hasStream={!!stream}
            />
          </div>

          {/* Center Column - Stream Preview (Larger) */}
          <div className="lg:col-span-2 space-y-6 flex flex-col">
            <StreamPreview
              stream={stream}
              streamState={streamState}
              onStart={handleStartStreaming}
              onStop={handleStopStreaming}
              onPause={pauseStreaming}
              onResume={resumeStreaming}
              onToggleMute={handleToggleMute}
            />
          </div>

          {/* Right Column - Unified Viewers & Requests */}
          <div className="lg:col-span-1 lg:h-full">
            <UnifiedSidebar
              viewers={viewers}
              pendingRequests={pendingRequests}
              onApprove={approveRequest}
              onReject={rejectRequest}
              onRemoveViewer={removeViewer}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const HostDashboard: React.FC = () => {
  return (
    <StreamProvider>
      <HostDashboardContent />
    </StreamProvider>
  );
};

export default HostDashboard;
