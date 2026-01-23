import React, { useRef, useEffect } from 'react';
import { Play, Pause, Square, VolumeX, Volume2 } from 'lucide-react';
import { StreamState } from '../../types/streaming.types';

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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const formatDuration = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg">
      <div className="relative bg-black aspect-video">
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted // Always muted locally to avoid feedback
              className="w-full h-full object-cover"
            />
            
            {/* Logo Overlay */}
            <div className="absolute top-4 left-4 z-10">
              <img 
                src="/sigtrack-tube.png" 
                alt="Sig-stream" 
                className="h-12 w-auto drop-shadow-lg opacity-80"
              />
            </div>

            {/* Live Badge */}
            {streamState.isStreaming && (
              <div className="absolute top-4 right-20 z-10">
                <span className="px-2 py-1 rounded bg-red-600 text-white text-xs font-bold animate-pulse flex items-center gap-1 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-white"></span> LIVE
                </span>
              </div>
            )}

            {/* Duration */}
            {streamState.isStreaming && (
              <div className="absolute top-4 right-4 z-10 bg-black/60 px-2 py-1 rounded text-sm text-white font-mono border border-white/10 shadow-sm">
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
             onClick={onToggleMute}
             className="p-2 rounded-full bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
           >
             {streamState.isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
           </button>
        </div>
      </div>
    </div>
  );
};

export default StreamPreview;
