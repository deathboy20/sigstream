import { useCallback, useEffect, useRef, useState } from 'react';

type DocumentPictureInPicture = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

type AutoPipVideo = HTMLVideoElement & { autoPictureInPicture?: boolean };

const getDocPip = (): DocumentPictureInPicture | null => {
  return (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture ?? null;
};

const hasLiveVideo = (stream: MediaStream | null): boolean =>
  !!stream?.getVideoTracks().some((track) => track.readyState === 'live');

interface UseMeetingPipOptions {
  enabled: boolean;
  stream: MediaStream | null;
  title?: string;
  mirror?: boolean;
}

export const useMeetingPip = ({ enabled, stream, title, mirror = true }: UseMeetingPipOptions) => {
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const docPipWindowRef = useRef<Window | null>(null);
  const streamRef = useRef(stream);
  const enabledRef = useRef(enabled);
  const mirrorRef = useRef(mirror);
  const autoOpenedRef = useRef(false);
  const [isPipOpen, setIsPipOpen] = useState(false);

  streamRef.current = stream;
  enabledRef.current = enabled;
  mirrorRef.current = mirror;

  const attachStream = useCallback((target: HTMLVideoElement, media: MediaStream) => {
    if (target.srcObject !== media) {
      target.srcObject = media;
    }
    target.muted = true;
    target.playsInline = true;
    target.disablePictureInPicture = false;
    (target as AutoPipVideo).autoPictureInPicture = true;
    void target.play().catch(() => undefined);
  }, []);

  const closePip = useCallback(async () => {
    autoOpenedRef.current = false;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
    } catch { /* already closed */ }
    try {
      docPipWindowRef.current?.close();
    } catch { /* already closed */ }
    docPipWindowRef.current = null;
    setIsPipOpen(false);
  }, []);

  const openElementPip = useCallback(async (): Promise<boolean> => {
    const video = pipVideoRef.current;
    const media = streamRef.current;
    if (!video || !hasLiveVideo(media) || !document.pictureInPictureEnabled) {
      return false;
    }
    attachStream(video, media!);
    if (document.pictureInPictureElement === video) {
      setIsPipOpen(true);
      return true;
    }
    try {
      await video.requestPictureInPicture();
      setIsPipOpen(true);
      return true;
    } catch {
      return false;
    }
  }, [attachStream]);

  const openDocumentPip = useCallback(async (): Promise<boolean> => {
    const media = streamRef.current;
    const docPip = getDocPip();
    if (!docPip || !hasLiveVideo(media)) return false;
    if (docPipWindowRef.current && !docPipWindowRef.current.closed) return true;
    try {
      const pipWindow = await docPip.requestWindow({ width: 360, height: 220 });
      docPipWindowRef.current = pipWindow;
      pipWindow.document.title = title || 'WAR ROOM';
      pipWindow.document.body.style.cssText = 'margin:0;background:#202124;overflow:hidden;height:100%;';
      const pipVideo = pipWindow.document.createElement('video');
      pipVideo.autoplay = true;
      pipVideo.muted = true;
      pipVideo.playsInline = true;
      pipVideo.srcObject = media;
      pipVideo.style.cssText = `width:100%;height:100%;object-fit:cover;transform:${mirrorRef.current ? 'scaleX(-1)' : 'none'};`;
      pipWindow.document.body.appendChild(pipVideo);
      void pipVideo.play().catch(() => undefined);
      pipWindow.addEventListener('pagehide', () => {
        docPipWindowRef.current = null;
        setIsPipOpen(false);
      });
      setIsPipOpen(true);
      return true;
    } catch {
      return false;
    }
  }, [title]);

  const openPip = useCallback(async () => {
    if (!enabledRef.current || !hasLiveVideo(streamRef.current)) {
      return false;
    }
    autoOpenedRef.current = false;
    if (await openElementPip()) return true;
    return openDocumentPip();
  }, [openDocumentPip, openElementPip]);

  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video || !stream) return;
    attachStream(video, stream);
  }, [stream, attachStream]);

  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video) return;
    const onEnter = () => setIsPipOpen(true);
    const onLeave = () => {
      autoOpenedRef.current = false;
      setIsPipOpen(false);
    };
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      void closePip();
      return;
    }
    const onVisibility = () => {
      if (document.hidden) {
        autoOpenedRef.current = true;
        void openElementPip();
      } else if (autoOpenedRef.current && document.pictureInPictureElement) {
        void closePip();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, closePip, openElementPip]);

  useEffect(() => () => {
    void closePip();
  }, [closePip]);

  return { pipVideoRef, isPipOpen, openPip, closePip };
};
