import React from 'react';
import { Button } from './ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';

interface MeetWaitingRoomProps {
  displayName: string;
  meetingTitle?: string;
  hostName?: string;
  status: 'knocking' | 'locked' | 'full';
  onLeave: () => void;
}

export const MeetWaitingRoom: React.FC<MeetWaitingRoomProps> = ({
  displayName,
  meetingTitle,
  hostName,
  status,
  onLeave,
}) => {
  const copy = {
    knocking: {
      title: 'Asking to be let in',
      body: hostName
        ? `${hostName} will admit you when they are ready.`
        : 'The host has been notified. You will join as soon as they admit you.',
    },
    locked: {
      title: 'This meeting is locked',
      body: 'The host locked the room. Wait here or leave and try again later.',
    },
    full: {
      title: 'This meeting is full',
      body: 'The room has reached its current participant limit. Leave and try again shortly.',
    },
  }[status];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#111214] px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,110,248,0.18),_transparent_55%)]" />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#1b1c1f]/95 backdrop-blur-xl p-8 text-white shadow-2xl">
        <div className="flex items-center gap-2 text-[#8ab4f8] text-xs font-semibold uppercase tracking-wider mb-6">
          <ShieldCheck className="h-4 w-4" />
          Sigtrack Meet
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold leading-tight mb-2">
          {copy.title}
        </h1>
        <p className="text-sm text-zinc-400 mb-6">{copy.body}</p>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Meeting</p>
          <p className="text-base font-medium mt-1">{meetingTitle || 'Team meeting'}</p>
          <p className="text-sm text-zinc-400 mt-3">Joining as <span className="text-white">{displayName}</span></p>
        </div>
        {status === 'knocking' && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
            <Loader2 className="h-4 w-4 animate-spin text-[#8ab4f8]" />
            Waiting for the host to admit you
          </div>
        )}
        <Button variant="outline" className="w-full border-white/15 bg-white/5 hover:bg-white/10" onClick={onLeave}>
          Leave waiting room
        </Button>
      </div>
    </div>
  );
};
