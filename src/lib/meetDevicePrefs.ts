const KEY = 'soko-meet-device-prefs';

export interface MeetDevicePrefs {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
}

const empty: MeetDevicePrefs = { videoDeviceId: null, audioDeviceId: null };

export const readMeetDevicePrefs = (): MeetDevicePrefs => {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<MeetDevicePrefs>;
    return {
      videoDeviceId: typeof parsed.videoDeviceId === 'string' ? parsed.videoDeviceId : null,
      audioDeviceId: typeof parsed.audioDeviceId === 'string' ? parsed.audioDeviceId : null,
    };
  } catch {
    return empty;
  }
};

export const writeMeetDevicePrefs = (prefs: MeetDevicePrefs) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(prefs));
};
