export type MeetingStatus = 'scheduled' | 'active' | 'ended';
export type MeetMonitorScope = 'all' | 'teams' | 'meetings';

export interface MeetingParticipant {
  id: string;
  name: string;
  role?: string;
  teamId?: string;
  teamName?: string;
  joinedAt?: number;
  leftAt?: number;
}

export interface MeetingDoc {
  id: string;
  hostId?: string;
  hostName: string;
  hostEmail?: string;
  title?: string;
  orgName?: string;
  orgDocId?: string;
  team?: string | null;
  hostTeamId?: string | null;
  hostTeamName?: string | null;
  hostLevel?: number | null;
  userType?: string | null;
  createdAt?: number;
  scheduledAt?: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  isActive?: boolean;
  status?: MeetingStatus;
  participants?: MeetingParticipant[];
  participatingTeamIds?: string[];
  allowedJoinTeamIds?: string[];
  communicationMatrix?: Record<string, string[]>;
  autoIncludeTeamIds?: string[];
  monitorScope?: MeetMonitorScope;
  monitorTeamIds?: string[];
  monitorMeetingIds?: string[];
  restartedAt?: number;
}

export type ChatFileStatus = 'uploading' | 'failed' | 'sent';

export interface ChatMessageDoc {
  id: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  senderTeamId?: string | null;
  type: 'public' | 'private';
  recipientIds?: string[];
  text?: string;
  fileId?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  status?: ChatFileStatus;
  uploadProgress?: number;
  timestamp: number;
}

export interface MeetingFileDoc {
  id: string;
  meetingId: string;
  uploaderId: string;
  uploaderName: string;
  fileName: string;
  storagePath: string;
  downloadUrl?: string;
  mimeType: string;
  sizeBytes: number;
  timestamp: number;
}

export const MAX_MEET_FILE_BYTES = 50 * 1024 * 1024;

export interface ChatInboxItem {
  meeting: MeetingDoc;
  lastMessage: ChatMessageDoc | null;
  messageCount: number;
}

export interface CreateMeetingPayload {
  id: string;
  hostId: string;
  hostName: string;
  title?: string;
  scheduledAt?: number;
  status?: MeetingStatus;
  participatingTeamIds?: string[];
  allowedJoinTeamIds?: string[];
  communicationMatrix?: Record<string, string[]>;
  autoIncludeTeamIds?: string[];
}
