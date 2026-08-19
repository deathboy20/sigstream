import { useState, useEffect, useCallback, useRef } from 'react';
import { MediaDevice, SelectedDevices } from '../types/streaming.types';
import { readMeetDevicePrefs, writeMeetDevicePrefs } from '../lib/meetDevicePrefs';

export const useMediaDevices = () => {
  const [devices, setDevices] = useState<MediaDevice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>(() => readMeetDevicePrefs());
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const selectedRef = useRef<SelectedDevices>(selectedDevices);
  const permissionOnceRef = useRef(false);

  useEffect(() => {
    selectedRef.current = selectedDevices;
  }, [selectedDevices]);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const enumerateDevices = useCallback(async (requestPermission = false) => {
    try {
      let deviceList = await navigator.mediaDevices.enumerateDevices();
      const needsLabels = deviceList.some(
        (device) => (device.kind === 'videoinput' || device.kind === 'audioinput') && !device.label
      );

      // Only prompt getUserMedia once for labels. Never do this on devicechange —
      // { video: true } opens the default/first camera and resets the user's choice.
      if (needsLabels && requestPermission && !permissionOnceRef.current) {
        permissionOnceRef.current = true;
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        permissionStream.getTracks().forEach((track) => track.stop());
        deviceList = await navigator.mediaDevices.enumerateDevices();
      }

      const mediaDevices: MediaDevice[] = deviceList
        .filter((device) => device.kind === 'videoinput' || device.kind === 'audioinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
          kind: device.kind as 'videoinput' | 'audioinput',
          groupId: device.groupId,
        }));

      setDevices(mediaDevices);
      setError(null);
    } catch (err) {
      setError('Failed to access media devices. Please grant camera/microphone permissions.');
      console.error('Device enumeration error:', err);
    }
  }, []);

  const getStream = useCallback(async (override?: Partial<SelectedDevices>) => {
    const videoDeviceId = override?.videoDeviceId ?? selectedRef.current.videoDeviceId;
    const audioDeviceId = override?.audioDeviceId ?? selectedRef.current.audioDeviceId;

    setIsLoading(true);
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      let newStream: MediaStream;
      if (videoDeviceId || audioDeviceId) {
        const constraints: MediaStreamConstraints = {
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        };
        try {
          newStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: videoDeviceId ? { deviceId: { ideal: videoDeviceId } } : true,
            audio: audioDeviceId ? { deviceId: { ideal: audioDeviceId } } : true,
          });
        }
      } else {
        newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }

      const videoId = newStream.getVideoTracks()[0]?.getSettings().deviceId;
      const audioId = newStream.getAudioTracks()[0]?.getSettings().deviceId;
      setSelectedDevices((prev) => ({
        videoDeviceId: videoDeviceId || videoId || prev.videoDeviceId,
        audioDeviceId: audioDeviceId || audioId || prev.audioDeviceId,
      }));
      streamRef.current = newStream;
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
  }, []);

  const getScreenShare = useCallback(async () => {
    setIsLoading(true);
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      streamRef.current = displayStream;
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
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const toggleMute = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
  }, []);

  const selectDevice = useCallback((type: 'video' | 'audio', deviceId: string) => {
    setSelectedDevices((prev) => {
      const next = {
        ...prev,
        [type === 'video' ? 'videoDeviceId' : 'audioDeviceId']: deviceId,
      };
      selectedRef.current = next;
      writeMeetDevicePrefs(next);
      return next;
    });
  }, []);

  const syncSelectedFromStream = useCallback((mediaStream: MediaStream) => {
    const videoDeviceId = mediaStream.getVideoTracks()[0]?.getSettings().deviceId || null;
    const audioDeviceId = mediaStream.getAudioTracks()[0]?.getSettings().deviceId || null;
    setSelectedDevices((prev) => ({
      videoDeviceId: prev.videoDeviceId || videoDeviceId,
      audioDeviceId: prev.audioDeviceId || audioDeviceId,
    }));
  }, []);

  useEffect(() => {
    void enumerateDevices(true);
    const onDeviceChange = () => {
      void enumerateDevices(false);
    };
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
    };
  }, [enumerateDevices]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const videoDevices = devices.filter((d) => d.kind === 'videoinput');
  const audioDevices = devices.filter((d) => d.kind === 'audioinput');

  return {
    devices,
    videoDevices,
    audioDevices,
    selectedDevices,
    stream,
    error,
    isLoading,
    selectDevice,
    syncSelectedFromStream,
    getStream,
    getScreenShare,
    stopStream,
    toggleMute,
    enumerateDevices,
  };
};
