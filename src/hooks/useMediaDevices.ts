import { useState, useEffect, useCallback } from 'react';
import { MediaDevice, SelectedDevices } from '../types/streaming.types';

export const useMediaDevices = () => {
  const [devices, setDevices] = useState<MediaDevice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>({
    videoDeviceId: null,
    audioDeviceId: null,
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Enumerate available devices
  const enumerateDevices = useCallback(async () => {
    try {
      // Request permissions first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const mediaDevices: MediaDevice[] = deviceList
        .filter(device => device.kind === 'videoinput' || device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
          kind: device.kind as 'videoinput' | 'audioinput',
          groupId: device.groupId,
        }));
      
      setDevices(mediaDevices);
      
      // Auto-select first devices if none selected
      const firstVideo = mediaDevices.find(d => d.kind === 'videoinput');
      const firstAudio = mediaDevices.find(d => d.kind === 'audioinput');
      
      setSelectedDevices(prev => ({
        videoDeviceId: prev.videoDeviceId || firstVideo?.deviceId || null,
        audioDeviceId: prev.audioDeviceId || firstAudio?.deviceId || null,
      }));
      
      setError(null);
    } catch (err) {
      setError('Failed to access media devices. Please grant camera/microphone permissions.');
      console.error('Device enumeration error:', err);
    }
  }, []);

  // Get media stream with selected devices
  const getStream = useCallback(async () => {
    if (!selectedDevices.videoDeviceId && !selectedDevices.audioDeviceId) {
      setError('Please select at least one device');
      return null;
    }

    setIsLoading(true);
    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDevices.videoDeviceId
          ? {
              deviceId: { exact: selectedDevices.videoDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            }
          : false,
        audio: selectedDevices.audioDeviceId
          ? { deviceId: { exact: selectedDevices.audioDeviceId } }
          : false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setError(null);
      return newStream;
    } catch (err) {
      setError('Failed to access selected devices');
      console.error('Media stream error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevices, stream]);

  // Get screen share stream
  const getScreenShare = useCallback(async () => {
    setIsLoading(true);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      setStream(displayStream);
      setError(null);
      return displayStream;
    } catch (err) {
      setError('Screen sharing was cancelled or not available');
      console.error('Screen share error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [stream]);

  // Stop all tracks
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  }, [stream]);

  // Select device
  const selectDevice = useCallback((deviceId: string, kind: 'videoinput' | 'audioinput') => {
    setSelectedDevices(prev => ({
      ...prev,
      [kind === 'videoinput' ? 'videoDeviceId' : 'audioDeviceId']: deviceId,
    }));
  }, []);

  // Listen for device changes
  useEffect(() => {
    enumerateDevices();
    
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
    };
  }, [enumerateDevices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  const audioDevices = devices.filter(d => d.kind === 'audioinput');

  return {
    devices,
    videoDevices,
    audioDevices,
    selectedDevices,
    stream,
    error,
    isLoading,
    selectDevice,
    getStream,
    getScreenShare,
    stopStream,
    toggleMute,
    enumerateDevices,
  };
};
