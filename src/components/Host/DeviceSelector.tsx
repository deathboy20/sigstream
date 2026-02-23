import React from 'react';
import { Video, Monitor, Mic } from 'lucide-react';
import { MediaDevice } from '../../types/streaming.types';

interface DeviceSelectorProps {
  videoDevices: MediaDevice[];
  audioDevices: MediaDevice[];
  selectedVideoId: string | null;
  selectedAudioId: string | null;
  onSelectVideo: (deviceId: string) => void;
  onSelectAudio: (deviceId: string) => void;
  onStartPreview: () => void;
  onScreenShare: () => void;
  isLoading: boolean;
  hasStream: boolean;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  videoDevices,
  audioDevices,
  selectedVideoId,
  selectedAudioId,
  onSelectVideo,
  onSelectAudio,
  onStartPreview,
  onScreenShare,
  isLoading,
  hasStream,
}) => {
  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-md border border-gray-700">
      <div className="flex items-center gap-2 text-lg font-semibold mb-4 border-b border-gray-700 pb-2">
        <Video className="h-5 w-5 text-green-400" />
        Select Input Source
      </div>
      
      <div className="space-y-4">
        {/* Video Device Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">
            Camera
          </label>
          <select
            value={selectedVideoId || ''}
            onChange={(e) => onSelectVideo(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>Select camera...</option>
            {videoDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        {/* Audio Device Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">
            Microphone
          </label>
          <select
            value={selectedAudioId || ''}
            onChange={(e) => onSelectAudio(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>Select microphone...</option>
            {audioDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onStartPreview}
            disabled={isLoading || (!selectedVideoId && !selectedAudioId)}
            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md font-medium transition-colors
              ${isLoading || (!selectedVideoId && !selectedAudioId) 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <Video className="h-4 w-4" />
            {hasStream ? 'Update Preview' : 'Start Preview'}
          </button>
          
          <button
            onClick={onScreenShare}
            disabled={isLoading}
            className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md font-medium transition-colors
              ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            <Monitor className="h-4 w-4" />
            Share Screen
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceSelector;
