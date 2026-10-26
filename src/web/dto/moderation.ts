// Dashboard DTO for the moderation module (shared by API and frontend; keep import-free).

export interface Paged {
  total: number;
  page: number;
  pageSize: number;
}

export interface ModerationCaseDto {
  caseId: number;
  action: string;
  actionLabel: string;
  /** "tag (id)" as stored when the case was created. */
  target: string | null;
  targetUserId: string | null;
  executor: string | null;
  moderatorId: string | null;
  reason: string | null;
  duration: string | null;
  createdAt: string;
}

export interface CasesPage extends Paged {
  cases: ModerationCaseDto[];
  actions: { value: string; label: string }[];
}

export interface WarningDto {
  id: number;
  userId: string;
  userName: string;
  moderatorId: string;
  moderatorName: string;
  reason: string;
  timestamp: number;
}

export interface WarningsPage extends Paged {
  warnings: WarningDto[];
}

export type NoteType = 'warning' | 'positive' | 'neutral' | 'alert';

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  warning: 'Warnung',
  positive: 'Positiv',
  neutral: 'Neutral',
  alert: 'Alarm',
};

export interface UserNoteDto {
  id: number;
  userId: string;
  userName: string;
  content: string;
  type: NoteType;
  author: string;
  timestamp: string;
}

export interface NotesPage extends Paged {
  notes: UserNoteDto[];
}

export const NOTE_MAX_LENGTH = 1000;
