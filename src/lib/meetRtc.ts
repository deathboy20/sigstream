export const MAX_MEETING_PARTICIPANTS = 25;

type IceServer = { urls: string | string[]; username?: string; credential?: string };

export const getIceServers = (): IceServer[] => {
  const servers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;
  if (typeof turnUrl === 'string' && turnUrl && typeof turnUser === 'string' && typeof turnCredential === 'string') {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCredential });
  }
  return servers;
};

export const audioConstraints = (deviceId?: string | null): MediaTrackConstraints => ({
  ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
});

export const videoConstraints = (
  deviceId?: string | null,
  peerCount = 1,
  preferExact = false,
): MediaTrackConstraints => {
  const width = peerCount >= 16 ? 320 : peerCount >= 8 ? 480 : peerCount >= 4 ? 640 : 1280;
  const height = peerCount >= 16 ? 180 : peerCount >= 8 ? 270 : peerCount >= 4 ? 360 : 720;
  const deviceConstraint = deviceId
    ? { deviceId: preferExact ? { exact: deviceId } : { ideal: deviceId } }
    : {};
  return {
    ...deviceConstraint,
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: peerCount >= 8 ? 15 : 24, max: 30 },
  };
};

export const getUserMediaForDevice = async (
  kind: 'video' | 'audio',
  deviceId: string,
): Promise<MediaStream> => {
  const exact: MediaStreamConstraints = kind === 'video'
    ? { video: { deviceId: { exact: deviceId } }, audio: false }
    : { video: false, audio: { deviceId: { exact: deviceId } } };
  try {
    return await navigator.mediaDevices.getUserMedia(exact);
  } catch {
    const ideal: MediaStreamConstraints = kind === 'video'
      ? { video: { deviceId: { ideal: deviceId } }, audio: false }
      : { video: false, audio: { deviceId: { ideal: deviceId } } };
    return await navigator.mediaDevices.getUserMedia(ideal);
  }
};

export const videoBitrateKbps = (peerCount: number): number => {
  if (peerCount >= 16) return 180;
  if (peerCount >= 8) return 350;
  if (peerCount >= 4) return 650;
  return 1000;
};

export const limitSdpBitrate = (sdp: string, peerCount: number): string => {
  const kbps = videoBitrateKbps(peerCount);
  const lines = sdp.split('\r\n');
  const next: string[] = [];
  for (const line of lines) {
    next.push(line);
    if (line.startsWith('m=video')) {
      next.push(`b=AS:${kbps}`);
    }
  }
  return next.join('\r\n');
};

export const applySenderBitrate = (peer: { _pc?: RTCPeerConnection }, peerCount: number): void => {
  const pc = peer._pc;
  if (!pc) return;
  const maxBitrate = videoBitrateKbps(peerCount) * 1000;
  pc.getSenders().forEach((sender) => {
    if (sender.track?.kind !== 'video') return;
    const params = sender.getParameters();
    if (!params.encodings?.length) {
      params.encodings = [{ maxBitrate }];
    } else {
      params.encodings = params.encodings.map((encoding) => ({ ...encoding, maxBitrate }));
    }
    void sender.setParameters(params).catch(() => undefined);
  });
};

export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'unknown';

export const qualityFromStats = (stats: RTCStatsReport): ConnectionQuality => {
  let rtt = 0;
  let loss = 0;
  let samples = 0;
  stats.forEach((report) => {
    if (report.type === 'candidate-pair' && report.state === 'succeeded' && typeof report.currentRoundTripTime === 'number') {
      rtt = Math.max(rtt, report.currentRoundTripTime * 1000);
    }
    if (report.type === 'inbound-rtp' && typeof report.packetsLost === 'number' && typeof report.packetsReceived === 'number') {
      const total = report.packetsLost + report.packetsReceived;
      if (total > 0) {
        loss += report.packetsLost / total;
        samples += 1;
      }
    }
  });
  const packetLoss = samples ? loss / samples : 0;
  if (rtt > 450 || packetLoss > 0.08) return 'poor';
  if (rtt > 250 || packetLoss > 0.03) return 'fair';
  if (rtt > 0 || samples > 0) return 'good';
  return 'unknown';
};

