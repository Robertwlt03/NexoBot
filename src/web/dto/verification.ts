// Dashboard DTO for the verification module (shared by API and frontend; keep import-free).

export type AutoVerifyCriteria = 'account_age' | 'server_size' | 'none';

export interface VerificationSettings {
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;
  message: string;
  buttonText: string;
  autoVerify: {
    enabled: boolean;
    criteria: AutoVerifyCriteria;
    /** Only used with criteria "account_age". */
    accountAgeDays: number;
    roleId: string | null;
  };
  /** Read-only: state of the posted panel. */
  panel: { status: 'ok' | 'deleted' | 'channel_missing' | 'none'; url: string | null };
  /** Read-only: members that currently have the verified role. */
  verifiedCount: number;
  /** Read-only: a welcome auto-role is set, which blocks verification and AutoVerify. */
  autoRoleConfigured: boolean;
}

export const ACCOUNT_AGE_MIN = 1;
export const ACCOUNT_AGE_MAX = 365;
