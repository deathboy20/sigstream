import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { api } from '../services/api';
import { storage } from '../services/firebase';
import { getDownloadURL, ref } from 'firebase/storage';
import type { ChatMessageDoc, MeetingDoc, MeetingFileDoc } from '../types/meeting.types';

interface MeetingHistoryDetailProps {
  meeting: MeetingDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDuration = (ms?: number) => {
  if (!ms || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

const MeetingHistoryDetail: React.FC<MeetingHistoryDetailProps> = ({ meeting, open, onOpenChange }) => {
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [files, setFiles] = useState<MeetingFileDoc[]>([]);

  useEffect(() => {
    if (!open || !meeting?.id) return;
    api.listMessages(meeting.id).then(setMessages).catch(() => setMessages([]));
    api.listFiles(meeting.id).then(setFiles).catch(() => setFiles([]));
  }, [open, meeting?.id]);

  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl bg-[#0D1525] border-white/10 text-white p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meeting.title || 'Meeting'}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {meeting.id} · {meeting.status || (meeting.isActive ? 'active' : 'ended')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 text-zinc-300">
            <div>Date: {new Date(meeting.scheduledAt || meeting.createdAt || 0).toLocaleString()}</div>
            <div>Duration: {formatDuration(meeting.durationMs)}</div>
            <div>Host: {meeting.hostName}</div>
            <div>Team: {meeting.hostTeamName || meeting.team || '—'}</div>
          </div>
          <div>
            <h4 className="text-xs uppercase text-zinc-500 mb-1">Participants</h4>
            <p className="text-zinc-300">
              {(meeting.participants || []).map((p) => p.name).join(', ') || 'None recorded'}
            </p>
          </div>
          <div>
            <h4 className="text-xs uppercase text-zinc-500 mb-1">Chat</h4>
            <div className="max-h-48 overflow-y-auto space-y-2 bg-white/5 rounded-lg p-3">
              {messages.length === 0 && <p className="text-zinc-500">No saved messages.</p>}
              {messages.map((m) => (
                <div key={m.id}>
                  <span className="text-blue-400 font-medium">{m.senderName}</span>
                  {m.type === 'private' && <span className="text-[10px] text-amber-400 ml-1">private</span>}
                  <span className="text-zinc-300 ml-2">{m.text}</span>
                  {m.fileUrl && (
                    <a href={m.fileUrl} target="_blank" rel="noreferrer" className="ml-2 text-[#3B6EF8] underline">
                      {m.fileName || 'file'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase text-zinc-500 mb-1">Files</h4>
            {files.length === 0 && <p className="text-zinc-500">No files shared.</p>}
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="text-[#3B6EF8] underline"
                    onClick={async () => {
                      if (f.downloadUrl) {
                        window.open(f.downloadUrl, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      try {
                        const result = await api.getFileDownloadUrl(meeting.id, f.id);
                        if (result.url) {
                          window.open(result.url, '_blank', 'noopener,noreferrer');
                          return;
                        }
                        if (result.storagePath || f.storagePath) {
                          const url = await getDownloadURL(ref(storage, result.storagePath || f.storagePath));
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {f.fileName}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingHistoryDetail;
