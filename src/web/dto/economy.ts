// Dashboard DTO for the economy module (shared by API and frontend; keep import-free).

export interface EconomySettings {
  /** Role given by the shop item "Premium-Rolle" (/economy shop-config setrole). */
  premiumRoleId: string | null;
  /** Read-only: the currency is set in the global bot config and applies to every server. */
  currency: { name: string; symbol: string };
}

export interface EconomyAccount {
  userId: string;
  name: string;
  avatarUrl: string | null;
  wallet: number;
  bank: number;
  netWorth: number;
}

export interface EconomyLeaderboard {
  entries: (EconomyAccount & { rank: number })[];
  page: number;
  pages: number;
  /** Accounts on this server. */
  total: number;
  totalInCirculation: number;
}

export interface EconomyMember extends EconomyAccount {
  maxBank: number;
}

export type EconomyMoneyType = 'wallet' | 'bank';

export const ECONOMY_PAGE_SIZE = 10;
export const ECONOMY_MAX_AMOUNT = 1_000_000_000;
