import React, { useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { api } from '../services/api';
import { useSigtrackContext } from '../hooks/useSigtrackContext';
import type { ChatInboxItem, ChatMessageDoc } from '../types/meeting.types';

interface MeetChatHistoryPanelProps {
  excludeMeetingId?: string;
}

export const MeetChatHistoryPanel: React.FC<MeetChatHistoryPanelProps> = ({ excludeMeetingId }) => {
  const sigtrack = useSigtrackContext();
  const isOrgAdmin = String(sigtrack.userType || '').toLowerCase() === 'admin';
  const [items, setItems] = useState<ChatInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listChatInbox()
      .then((list) => {
        if (cancelled) return;
        const next = (Array.isArray(list) ? list : []).filter((item) => item.meeting.id !== excludeMeetingId);
        setItems(next);
        setSelectedId(next[0]?.meeting.id || null);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [excludeMeetingId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessagesLoading(true);
    api.listMessages(selectedId)
      .then((list) => {
        if (!cancelled) setMessages(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  const selected = items.find((item) => item.meeting.id === selectedId) || null;
  const scopeLabel = isOrgAdmin
    ? 'Chats from meetings in your organization'
    : sigtrack.teamName
      ? `Chats from meetings ${sigtrack.teamName} was part of`
      : 'Chats from meetings you were authorized to join';

  if (loading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-zinc-500">
        <MessageSquare className="h-10 w-10 opacity-20" />
        <p className="text-sm">No meeting chats for your role yet.</p>
        <p className="text-xs text-zinc-600">{scopeLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="text-[11px] text-zinc-500">{scopeLabel}</p>
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        <div className="max-h-40 min-h-0 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 md:max-h-none md:w-52 md:shrink-0">
          {items.map((item) => {
            const active = item.meeting.id === selectedId;
            return (
              <button
                key={item.meeting.id}
                type="button"
                onClick={() => setSelectedId(item.meeting.id)}
                className={`block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 dark:border-white/5 ${
                  active ? 'bg-[#3B6EF8]/15' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{item.meeting.title || item.meeting.id}</p>
                <p className="truncate text-[10px] text-zinc-500">
                  {item.lastMessage?.text || (item.messageCount ? `${item.messageCount} messages` : 'No messages yet')}
                </p>
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-slate-50 dark:bg-white/5 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-900 dark:text-white">{selected?.meeting.title || selected?.meeting.id}</p>
          {messagesLoading ? (
            <div className="flex justify-center py-8 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-zinc-500">No saved messages in this meeting.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id}>
                  <span className="text-xs font-medium text-blue-400">{m.senderName}</span>
                  {m.type === 'private' && <span className="ml-1 text-[10px] text-amber-400">private</span>}
                  <span className="ml-2 text-xs text-slate-700 dark:text-zinc-300">{m.text}</span>
                  {m.fileName && <span className="ml-2 text-[10px] text-[#8ab4f8]">{m.fileName}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface MeetChatHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MeetChatHistoryModal: React.FC<MeetChatHistoryModalProps> = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[95vw] max-w-3xl bg-white text-slate-900 border-slate-200 dark:bg-[#0D1525] dark:border-white/10 dark:text-white p-4 sm:p-6 h-[80dvh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Meeting chats</DialogTitle>
        <DialogDescription className="text-slate-500 dark:text-zinc-400">
          History is limited to meetings your role is authorized to access.
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1">
        {open ? <MeetChatHistoryPanel /> : null}
      </div>
    </DialogContent>
  </Dialog>
);

export default MeetChatHistoryModal;
