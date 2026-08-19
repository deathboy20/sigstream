import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mic, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { readMeetDevicePrefs, writeMeetDevicePrefs } from '../lib/meetDevicePrefs';
import { useSigtrackContext } from '../hooks/useSigtrackContext';
import { IS_STANDALONE } from '../config';

interface DeviceOption {
  deviceId: string;
  label: string;
}

interface MeetSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MeetSettingsModal: React.FC<MeetSettingsModalProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const sigtrack = useSigtrackContext();
  const saved = readMeetDevicePrefs();
  const [videoDevices, setVideoDevices] = useState<DeviceOption[]>([]);
  const [audioDevices, setAudioDevices] = useState<DeviceOption[]>([]);
  const [videoId, setVideoId] = useState(saved.videoDeviceId || '');
  const [audioId, setAudioId] = useState(saved.audioDeviceId || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prefs = readMeetDevicePrefs();
    setVideoId(prefs.videoDeviceId || '');
    setAudioId(prefs.audioDeviceId || '');
    let cancelled = false;
    const load = async () => {
      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        permissionStream.getTracks().forEach((track) => track.stop());
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setVideoDevices(list.filter((d) => d.kind === 'videoinput').map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera (${d.deviceId.slice(0, 8)})`,
        })));
        setAudioDevices(list.filter((d) => d.kind === 'audioinput').map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone (${d.deviceId.slice(0, 8)})`,
        })));
        setError(null);
      } catch {
        if (!cancelled) setError('Allow camera and microphone access to choose devices.');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [open]);

  const save = () => {
    writeMeetDevicePrefs({
      videoDeviceId: videoId || null,
      audioDeviceId: audioId || null,
    });
    toast.success('Meeting device settings saved');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md bg-white text-slate-900 border-slate-200 dark:bg-[#0D1525] dark:border-white/10 dark:text-white p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Meet settings</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-zinc-400">
            Choose the camera and microphone used when you join a meeting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <label htmlFor="meet-camera" className="block space-y-1.5">
            <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Video className="h-3.5 w-3.5" /> Camera
            </span>
            <select
              id="meet-camera"
              name="camera"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-[#0B1220] dark:text-white"
            >
              <option value="">Select camera…</option>
              {videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="meet-microphone" className="block space-y-1.5">
            <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Mic className="h-3.5 w-3.5" /> Microphone
            </span>
            <select
              id="meet-microphone"
              name="microphone"
              value={audioId}
              onChange={(e) => setAudioId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-[#0B1220] dark:text-white"
            >
              <option value="">Select microphone…</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
          {sigtrack.canManageMeetings && (
            <Button
              variant="outline"
              className="w-full border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white"
              onClick={() => {
                onOpenChange(false);
                navigate(IS_STANDALONE ? '/admin' : '/teleconference/admin');
              }}
            >
              Open meeting monitor
            </Button>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" className="text-slate-700 dark:text-white" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="bg-[#3B6EF8] text-white" onClick={save}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetSettingsModal;
