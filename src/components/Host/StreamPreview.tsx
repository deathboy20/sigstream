import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Square, VolumeX, Volume2, Maximize2, Circle } from 'lucide-react';
import { StreamState } from '../../types/streaming.types';
import { toast } from 'sonner';

interface StreamPreviewProps {
  stream: MediaStream | null;
  streamState: StreamState;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onToggleMute: () => void;
}

const StreamPreview: React.FC<StreamPreviewProps> = ({
  stream,
  streamState,
  onStart,
  onStop,
  onPause,
  onResume,
  onToggleMute,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!streamState.isStreaming || !stream) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (isRecording) {
        setIsRecording(false);
      }
    }
  }, [streamState.isStreaming, stream, isRecording]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getSupportedMimeType = () => {
    const types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return types.find(type => MediaRecorder.isTypeSupported(type));
  };

  const stopCanvasDrawing = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    canvasRef.current = null;
  };

  const createRecordingStream = async (videoElement: HTMLVideoElement, sourceStream: MediaStream) => {
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    const width = videoElement.videoWidth || 1280;
    const height = videoElement.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return sourceStream;
    }

    const logo = new Image();
    logo.src = '/sigtrack-tube.png';
    await logo.decode().catch(() => undefined);

    const draw = () => {
      context.drawImage(videoElement, 0, 0, width, height);
      if (logo.naturalWidth) {
        const targetWidth = Math.round(width * 0.12);
        const targetHeight = Math.round((logo.naturalHeight / logo.naturalWidth) * targetWidth);
        const padding = Math.round(width * 0.02);
        context.drawImage(logo, padding, padding, targetWidth, targetHeight);
      }
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    const canvasStream = canvas.captureStream(30);
    sourceStream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
    return canvasStream;
  };

  const startRecording = async () => {
    if (!stream) {
      toast.error('No stream available to record');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      toast.error('Recording is not supported in this browser');
      return;
    }
    if (!videoRef.current) {
      toast.error('Preview not ready');
      return;
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      return;
    }

    if (videoRef.current.readyState < 2) {
      await new Promise<void>((resolve) => {
        const handler = () => {
          videoRef.current?.removeEventListener('loadedmetadata', handler);
          resolve();
        };
        videoRef.current?.addEventListener('loadedmetadata', handler);
      });
    }

    const recordingStream = await createRecordingStream(videoRef.current, stream);
    const mimeType = getSupportedMimeType();

    if (!mimeType || !mimeType.includes('mp4')) {
      toast.message('MP4 is not supported in this browser. Saving as WebM.');
    }

    const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const mime = recorder.mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      const url = URL.createObjectURL(blob);
      const extension = mime.includes('mp4') ? 'mp4' : 'webm';
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sigstream-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
      chunksRef.current = [];
      stopCanvasDrawing();
      toast.success('Recording saved');
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    toast.success('Recording started');
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFullscreen = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const container = videoElement.parentElement ?? videoElement;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }

    if (container.requestFullscreen) {
      container.requestFullscreen();
      return;
    }

    const legacyContainer = container as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => void;
    };

    if (legacyContainer.webkitRequestFullscreen) {
      legacyContainer.webkitRequestFullscreen();
      return;
    }

    legacyContainer.msRequestFullscreen?.();
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg">
      <div className="relative bg-black aspect-video max-h-[60vh] sm:max-h-none">
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted // Always muted locally to avoid feedback
              className="w-full h-full object-contain sm:object-cover"
            />
            
            {/* Logo Overlay */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
              <img 
                src="/sigtrack-tube.png" 
                alt="Sig-stream" 
                className="h-8 sm:h-12 w-auto drop-shadow-lg opacity-80"
              />
            </div>

            {/* Live Badge */}
            {streamState.isStreaming && (
              <div className="absolute top-3 right-16 sm:top-4 sm:right-20 z-10">
                <span className="px-2 py-1 rounded bg-red-600 text-white text-[10px] sm:text-xs font-bold animate-pulse flex items-center gap-1 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-white"></span> LIVE
                </span>
              </div>
            )}

            {/* Duration */}
            {streamState.isStreaming && (
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 bg-black/60 px-2 py-1 rounded text-[10px] sm:text-sm text-white font-mono border border-white/10 shadow-sm">
                {formatDuration(streamState.duration)}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Select a device to preview</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <div className="flex items-center justify-center gap-4">
          {!streamState.isStreaming ? (
            <button
              onClick={onStart}
              disabled={!stream}
              className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-white transition-all transform hover:scale-105
                ${!stream ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg'}`}
            >
              <Play className="h-5 w-5 fill-current" />
              Start Streaming
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-6 py-2 rounded-full font-bold text-white bg-red-600 hover:bg-red-700 transition-all transform hover:scale-105 hover:shadow-lg"
            >
              <Square className="h-5 w-5 fill-current" />
              Stop Streaming
            </button>
          )}

           <button
             onClick={isRecording ? stopRecording : startRecording}
             disabled={!streamState.isStreaming || !stream}
             className={`p-2 rounded-full transition-colors ${isRecording ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'} ${!streamState.isStreaming || !stream ? 'opacity-50 cursor-not-allowed' : ''}`}
           >
             <Circle className="h-5 w-5 fill-current" />
           </button>

           <button
             onClick={onToggleMute}
             className="p-2 rounded-full bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
           >
             {streamState.isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
           </button>

           <button
             onClick={handleFullscreen}
             className="p-2 rounded-full bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
           >
             <Maximize2 className="h-5 w-5" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default StreamPreview;
