import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { ChatMessageDoc, MeetingDoc } from '../types/meeting.types';
import { useSigtrackContext } from '../hooks/useSigtrackContext';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

const MeetAdminMonitor: React.FC = () => {
  const navigate = useNavigate();
  const ctx = useSigtrackContext();
  const [meetings, setMeetings] = useState<MeetingDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);

  useEffect(() => {
    api.listAccessibleMeetings()
      .then((list) => {
        const active = list.filter((m) => m.status === 'active' || m.isActive);
        setMeetings(active);
        if (active[0]) setSelectedId(active[0].id);
      })
      .catch(() => setMeetings([]));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.listMessages(selectedId, 'admin').then(setMessages).catch(() => setMessages([]));
    const t = window.setInterval(() => {
      api.listMessages(selectedId, 'admin').then(setMessages).catch(() => {});
    }, 4000);
    return () => window.clearInterval(t);
  }, [selectedId]);

  if (!ctx.canManageMeetings) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white flex flex-col items-center justify-center gap-4">
        <p>Admin monitoring is not enabled for your level.</p>
        <Button onClick={() => navigate('/meet')}>Back</Button>
      </div>
    );
  }

  const selected = meetings.find((m) => m.id === selectedId) || null;

  return (
    <div className="h-[100dvh] bg-[#070B14] text-white flex flex-col">
      <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/meet')} className="text-white">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="font-semibold">Meeting monitor</h1>
      </header>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-0">
        <aside className="border-r border-white/10 overflow-y-auto p-3 space-y-2">
          {meetings.length === 0 && <p className="text-sm text-zinc-500">No active meetings.</p>}
          {meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm ${selectedId === m.id ? 'bg-[#3B6EF8]' : 'bg-white/5 hover:bg-white/10'}`}
            >
              <div className="font-medium truncate">{m.title}</div>
              <div className="text-[10px] text-zinc-300">{m.hostTeamName || m.team || m.hostName}</div>
            </button>
          ))}
        </aside>
        <main className="p-4 overflow-y-auto">
          {!selected && <p className="text-zinc-500">Select a meeting to inspect chat.</p>}
          {selected && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">{selected.title}</h2>
              <p className="text-xs text-zinc-400">
                Scope: {ctx.meetPrivilege.monitorScope} · Teams: {(selected.participatingTeamIds || []).join(', ') || '—'}
              </p>
              <div className="space-y-2">
                {messages.length === 0 && <p className="text-zinc-500 text-sm">No chat yet.</p>}
                {messages.map((m) => (
                  <div key={m.id} className="bg-white/5 rounded-lg px-3 py-2 text-sm">
                    <div className="text-xs text-blue-400">
                      {m.senderName} {m.type === 'private' ? <span className="text-amber-400">(private)</span> : null}
                    </div>
                    <div>{m.text}</div>
                    {m.fileUrl && (
                      <a href={m.fileUrl} className="text-[#3B6EF8] underline text-xs" target="_blank" rel="noreferrer">
                        {m.fileName}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MeetAdminMonitor;
