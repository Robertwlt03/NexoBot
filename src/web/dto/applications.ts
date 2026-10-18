// Dashboard DTO for the applications module (shared by API and frontend; keep import-free).

export interface ApplicationRoleConfig {
  roleId: string;
  /** Name members use with /apply submit (read-only here, set when the application is created). */
  name: string;
  enabled: boolean;
  /** Own questions for this role; null = uses the global questions. */
  questions: string[] | null;
  /** Own log channel; null = uses the global log channel. */
  logChannelId: string | null;
}

export interface ApplicationSettingsDto {
  enabled: boolean;
  logChannelId: string | null;
  managerRoleIds: string[];
  questions: string[];
  pendingRetentionDays: number;
  reviewedRetentionDays: number;
  roles: ApplicationRoleConfig[];
}

export interface NewApplicationRole {
  roleId: string;
  name: string;
  questions: string[];
}

export type ApplicationStatus = 'pending' | 'approved' | 'denied';

export interface ApplicationEntry {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  roleId: string | null;
  roleName: string;
  status: string;
  /** Epoch ms. */
  createdAt: number;
  reviewedAt: string | null;
  reviewerName: string | null;
  reviewMessage: string | null;
  answers: { question: string; answer: string }[];
}

export interface ApplicationList {
  items: ApplicationEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReviewResult {
  application: ApplicationEntry;
  dmSent: boolean;
  /** null when denied. */
  roleAssigned: boolean | null;
}

export const MAX_QUESTIONS = 5;
export const QUESTION_MAX_LENGTH = 100;
export const APPLICATION_NAME_MAX_LENGTH = 50;
export const REVIEW_REASON_MAX_LENGTH = 500;
export const APPLICATIONS_PAGE_SIZE = 10;
