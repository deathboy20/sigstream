import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Users,
} from 'lucide-react';
import { Button } from './ui/button';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { api } from '../services/api';
import type { ChatMessageDoc } from '../types/meeting.types';
import { MAX_MEET_FILE_BYTES } from '../types/meeting.types';
import { toast } from 'sonner';
import { MeetChatHistoryPanel } from './MeetChatHistoryModal';

interface ChatParticipant {
  id: string;
  name: string;
  userId?: string;
}

interface MeetChatPanelProps {
  meetingId: string;
  messages: ChatMessageDoc[];
  currentId: string;
  selfIds?: string[];
  senderName: string;
  senderTeamId?: string | null;
  participants: ChatParticipant[];
  onLocalSend: (msg: ChatMessageDoc) => void;
  emitSocket: (event: string, payload: Record<string, unknown>) => void;
  enableHistory?: boolean;
}

const URL_RE = /(https?:\/\/[^\s]+)/gi;

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageFile = (name?: string, mimeType?: string) =>
  (mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || '');

const FileGlyph: React.FC<{ fileName?: string; mimeType?: string; spinning?: boolean }> = ({
  fileName,
  mimeType,
  spinning,
}) => {
  const className = 'h-4 w-4 text-[#8ab4f8]';
  if (spinning) return <Loader2 className={`${className} animate-spin`} />;
  if (isImageFile(fileName, mimeType)) return <FileImage className={className} />;
  if (/\.(xlsx|xls|csv)$/i.test(fileName || '') || (mimeType || '').includes('spreadsheet')) {
    return <FileSpreadsheet className={className} />;
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(fileName || '') || (mimeType || '').includes('zip')) {
    return <FileArchive className={className} />;
  }
  if (/\.(pdf|docx?|txt|md)$/i.test(fileName || '') || (mimeType || '').startsWith('text/')) {
    return <FileText className={className} />;
  }
  return <File className={className} />;
};

const AttachmentCard: React.FC<{ message: ChatMessageDoc; isSelf: boolean }> = ({ message, isSelf }) => {
  const uploading = message.status === 'uploading';
  const failed = message.status === 'failed';
  const progress = Math.max(0, Math.min(100, message.uploadProgress ?? 0));
  const sizeLabel = formatBytes(message.fileSize);
  const ready = !!message.fileUrl && !uploading && !failed;
  const showImage = ready && isImageFile(message.fileName, message.mimeType);

  const statusLabel = uploading
    ? isSelf
      ? `Uploading ${progress}%`
      : progress > 0
        ? `Incoming · ${progress}%`
        : 'Incoming file…'
    : failed
      ? 'Couldn’t send'
      : [sizeLabel, 'Open'].filter(Boolean).join(' · ');

  const body = (
    <>
      {showImage && (
        <img
          src={message.fileUrl}
          alt={message.fileName || 'Attachment'}
          className="mb-2 max-h-40 w-full rounded-lg object-cover"
        />
      )}
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <FileGlyph fileName={message.fileName} mimeType={message.mimeType} spinning={uploading} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white">{message.fileName || 'Attachment'}</p>
          <p className={`text-[10px] ${failed ? 'text-red-400' : 'text-zinc-400'}`}>{statusLabel}</p>
        </div>
      </div>
      {uploading && (
        <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          {progress > 0 ? (
            <div
              className="h-full rounded-full bg-[#8ab4f8] transition-[width] duration-200"
              style={{ width: `${Math.max(progress, 6)}%` }}
            />
          ) : (
            <div className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-[#8ab4f8] to-transparent animate-pulse" />
          )}
        </div>
      )}
    </>
  );

  if (!ready) {
    return (
      <div className={`mt-2 rounded-xl border px-2.5 py-2 ${failed ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
        {body}
      </div>
    );
  }

  return (
    <a
      href={message.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 hover:bg-white/10"
    >
      {body}
    </a>
  );
};

const renderRichText = (text: string | undefined, currentName: string) => {
  if (!text) return null;
  const mention = `@${currentName}`;
  return text.split(URL_RE).map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      let host = part;
      try {
        host = new URL(part).hostname.replace(/^www\./, '');
      } catch { /* keep raw */ }
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="my-1 block rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-[#8ab4f8] hover:bg-white/10"
        >
          {host}
          <span className="block truncate text-[10px] text-zinc-500">{part}</span>
        </a>
      );
    }
    const chunks = part.split(/(@[A-Za-z0-9._-]+)/g);
    return (
      <span key={`t-${index}`}>
        {chunks.map((chunk, chunkIndex) => {
          const isMention = chunk.startsWith('@');
          const isMe = chunk.toLowerCase() === mention.toLowerCase();
          return (
            <span
              key={`${chunk}-${chunkIndex}`}
              className={isMention ? `font-semibold ${isMe ? 'text-amber-300' : 'text-[#8ab4f8]'}` : undefined}
            >
              {chunk}
            </span>
          );
        })}
      </span>
    );
  });
};

const MeetChatPanel: React.FC<MeetChatPanelProps> = ({
  meetingId,
  messages,
  currentId,
  selfIds,
  senderName,
  senderTeamId,
  participants,
  onLocalSend,
  emitSocket,
  enableHistory = false,
}) => {
  const [historyView, setHistoryView] = useState(false);
  const [tab, setTab] = useState<'public' | 'private'>('public');
  const [text, setText] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastProgressEmitRef = useRef(0);
  const identities = selfIds && selfIds.length > 0 ? selfIds : [currentId];

  const visible = useMemo(() => {
    return messages.filter((m) => {
      if (tab === 'public') return m.type !== 'private';
      if (m.type !== 'private') return false;
      const rec = m.recipientIds || [];
      return identities.includes(m.senderId) || rec.some((id) => identities.includes(id));
    });
  }, [messages, tab, identities]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visible]);

  const privateRecipientsForSend = () => {
    if (tab !== 'private') return undefined;
    return Array.from(new Set(selectedRecipients.flatMap((key) => {
      const person = participants.find((p) => p.userId === key || p.id === key);
      return [key, person?.userId, person?.id].filter((value): value is string => !!value);
    })));
  };

  const send = async (
    fileMeta?: { fileId: string; fileName: string; fileUrl: string; fileSize?: number; mimeType?: string },
    options?: { id?: string; text?: string; timestamp?: number },
  ) => {
    const body = (options?.text !== undefined ? options.text : text).trim();
    if (!body && !fileMeta) return;
    if (tab === 'private' && selectedRecipients.length === 0) {
      toast.error('Select at least one recipient');
      return;
    }
    const privateRecipients = privateRecipientsForSend();
    const payload: ChatMessageDoc = {
      id: options?.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      meetingId,
      senderId: currentId,
      senderName,
      senderTeamId,
      type: tab,
      recipientIds: privateRecipients,
      text: body || undefined,
      fileId: fileMeta?.fileId,
      fileName: fileMeta?.fileName,
      fileUrl: fileMeta?.fileUrl,
      fileSize: fileMeta?.fileSize,
      mimeType: fileMeta?.mimeType,
      status: 'sent',
      uploadProgress: fileMeta ? 100 : undefined,
      timestamp: options?.timestamp || Date.now(),
    };
    const socketPayload: Record<string, unknown> = {
      sessionId: meetingId,
      message: payload.text || '',
      senderName,
      senderId: currentId,
      timestamp: payload.timestamp,
      type: payload.type,
      id: payload.id,
    };
    if (privateRecipients) socketPayload.recipientIds = privateRecipients;
    if (payload.fileId) socketPayload.fileId = payload.fileId;
    if (payload.fileName) socketPayload.fileName = payload.fileName;
    if (payload.fileUrl) socketPayload.fileUrl = payload.fileUrl;
    if (payload.fileSize) socketPayload.fileSize = payload.fileSize;
    if (payload.mimeType) socketPayload.mimeType = payload.mimeType;
    emitSocket(tab === 'private' ? 'private-message' : 'chat-message', socketPayload);
    onLocalSend(payload);
    if (options?.text === undefined) setText('');
    try {
      const { status: _status, uploadProgress: _progress, ...persistable } = payload;
      await api.sendMessage(meetingId, persistable);
    } catch {
      // socket already persisted server-side
    }
  };

  const onPickFile = async (file: File) => {
    if (file.size > MAX_MEET_FILE_BYTES) {
      toast.error('Files must be 50 MB or smaller');
      return;
    }
    if (tab === 'private' && selectedRecipients.length === 0) {
      toast.error('Select at least one recipient');
      return;
    }
    const caption = text.trim();
    const privateRecipients = privateRecipientsForSend();
    const fileId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const messageId = fileId;
    const placeholder: ChatMessageDoc = {
      id: messageId,
      meetingId,
      senderId: currentId,
      senderName,
      senderTeamId,
      type: tab,
      recipientIds: privateRecipients,
      text: caption || undefined,
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || undefined,
      status: 'uploading',
      uploadProgress: 0,
      timestamp: Date.now(),
    };
    const audience = {
      sessionId: meetingId,
      id: messageId,
      senderId: currentId,
      senderName,
      senderTeamId,
      type: tab,
      recipientIds: privateRecipients,
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || undefined,
      timestamp: placeholder.timestamp,
      text: caption || undefined,
    };

    setUploading(true);
    setUploadName(file.name);
    setUploadProgress(0);
    setText('');
    onLocalSend(placeholder);
    emitSocket('file-upload-start', audience);

    const patchProgress = (progress: number) => {
      setUploadProgress(progress);
      onLocalSend({ ...placeholder, uploadProgress: progress });
      const now = Date.now();
      if (progress < 100 && now - lastProgressEmitRef.current < 250) return;
      lastProgressEmitRef.current = now;
      emitSocket('file-upload-progress', {
        sessionId: meetingId,
        id: messageId,
        progress,
        senderId: currentId,
        type: tab,
        recipientIds: privateRecipients,
      });
    };

    try {
      const storagePath = `tele-meet/${meetingId}/files/${fileId}/${file.name}`;
      const storageRef = ref(storage, storagePath);
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
      });
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            const pct = snap.totalBytes > 0
              ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
              : 0;
            patchProgress(pct);
          },
          reject,
          () => resolve(),
        );
      });
      patchProgress(100);
      const downloadUrl = await getDownloadURL(storageRef);
      try {
        await api.registerFile(meetingId, {
          id: fileId,
          meetingId,
          uploaderId: currentId,
          uploaderName: senderName,
          fileName: file.name,
          storagePath,
          downloadUrl,
          mimeType: file.type,
          sizeBytes: file.size,
        });
      } catch {
        // Chat still carries the download URL even if metadata persist fails.
      }
      await send(
        { fileId, fileName: file.name, fileUrl: downloadUrl, fileSize: file.size, mimeType: file.type },
        { id: messageId, text: caption, timestamp: placeholder.timestamp },
      );
      emitSocket('file-shared', { sessionId: meetingId, file: { fileId, fileName: file.name, downloadUrl } });
    } catch (error) {
      onLocalSend({ ...placeholder, status: 'failed', uploadProgress: 0 });
      emitSocket('file-upload-cancel', {
        sessionId: meetingId,
        id: messageId,
        senderId: currentId,
        type: tab,
        recipientIds: privateRecipients,
      });
      const raw = error instanceof Error ? error.message : 'File upload failed';
      const permissionDenied = /storage\/unauthorized|permission-denied|unauthorized/i.test(raw);
      toast.error(permissionDenied ? 'Could not upload the file. Sign in again and try once more.' : raw);
    } finally {
      setUploading(false);
      setUploadName('');
      setUploadProgress(0);
    }
  };

  const liveChat = (
    <>
      <div className="mb-3 flex gap-1">
        <button
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${tab === 'public' ? 'bg-[#3B6EF8] text-white' : 'bg-white/5 text-zinc-400'}`}
          onClick={() => setTab('public')}
        >
          Everyone
        </button>
        <button
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${tab === 'private' ? 'bg-[#3B6EF8] text-white' : 'bg-white/5 text-zinc-400'}`}
          onClick={() => setTab('private')}
        >
          Private
        </button>
      </div>
      {tab === 'private' && (
        <div className="mb-3 max-h-24 space-y-1 overflow-y-auto rounded-lg bg-white/5 p-2">
          <p className="flex items-center gap-1 text-[10px] text-zinc-500"><Users className="h-3 w-3" /> Select recipients</p>
          {participants.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selectedRecipients.includes(p.userId || p.id)}
                onChange={() => {
                  const key = p.userId || p.id;
                  setSelectedRecipients((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
                }}
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="mt-8 text-center text-zinc-500">
            <MessageSquare className="mx-auto mb-2 h-10 w-10 opacity-20" />
            <p className="text-sm">No messages yet.</p>
          </div>
        ) : (
          visible.map((m) => (
            <div key={m.id} className={`flex flex-col ${identities.includes(m.senderId) ? 'items-end' : 'items-start'}`}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400">{m.senderName}</span>
                {m.type === 'private' && <span className="text-[10px] text-amber-400">private</span>}
                <span className="text-[10px] text-blue-600">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="max-w-[85%] break-words rounded-2xl bg-blue-500/10 px-3 py-2 text-sm text-white">
                {renderRichText(m.text, senderName)}
                {(m.fileUrl || m.fileName) && (
                  <AttachmentCard message={m} isSelf={identities.includes(m.senderId)} />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      {tab === 'public' && participants.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {participants.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10"
              onClick={() => setText((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}@${p.name} `)}
            >
              @{p.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
      <div className="mt-auto pt-3">
        {uploading && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#8ab4f8]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-zinc-200">Sending {uploadName}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#8ab4f8] transition-[width] duration-200"
                  style={{ width: `${Math.max(uploadProgress, 6)}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] tabular-nums text-zinc-400">{uploadProgress}%</span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-blue-500/10 px-3 py-1">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPickFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="text-zinc-400 hover:text-white disabled:opacity-40"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Attach file (max 50 MB)"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void send()}
            placeholder={tab === 'private' ? 'Private message' : 'Message everyone — use @name to mention'}
            className="flex-1 border-none bg-transparent py-2 text-sm outline-none"
          />
          <Button variant="ghost" size="icon" onClick={() => void send()} className="text-primary hover:bg-transparent">
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {enableHistory && (
        <div className="mb-3 flex gap-1">
          <button
            type="button"
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${!historyView ? 'bg-[#3B6EF8] text-white' : 'bg-white/5 text-zinc-400'}`}
            onClick={() => setHistoryView(false)}
          >
            This meeting
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${historyView ? 'bg-[#3B6EF8] text-white' : 'bg-white/5 text-zinc-400'}`}
            onClick={() => setHistoryView(true)}
          >
            History
          </button>
        </div>
      )}
      {enableHistory && historyView ? (
        <div className="min-h-0 flex-1">
          <MeetChatHistoryPanel excludeMeetingId={meetingId} />
        </div>
      ) : liveChat}
    </div>
  );
};

export default MeetChatPanel;
