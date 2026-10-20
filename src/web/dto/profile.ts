// API contract for the member area ("Mein Profil", any logged-in Discord user) and the owner area (OWNER_IDS only).
// Member routes: /dashboard/api/me/...   Owner routes: /dashboard/api/owner/...
// All amounts are Bernis (global, per user).

import type {
  CosmeticItem, CosmeticSlot, Rarity, RankingKind, UserProfileSettings,
} from '../../shared/cosmetics.js';

export interface WalletSummary {
  balance: number;
  lifetimeEarned: number;
  /** Capped income (level-ups + mini games) earned today and the cap. */
  todayEarned: number;
  dailyCap: number;
}

export interface OwnedItem { itemId: string; acquiredAt: string; source: 'purchase' | 'gift' | 'achievement' | 'ranking' | 'event' | 'owner' }

export interface ProfileLevel { guildId: string; guildName: string; level: number; xp: number; xpNeeded: number; rank: number | null }

/** GET /me/profile */
export interface MeProfileResponse {
  isOwner: boolean;
  wallet: WalletSummary;
  profile: UserProfileSettings;
  inventory: OwnedItem[];
  /** The member's levels on servers where Nexo is present (for the card preview; highest first). */
  levels: ProfileLevel[];
  daily: DailyBonusState;
}
/** PUT /me/profile — body: UserProfileSettings; every equipped item must be owned (403 otherwise). Returns MeProfileResponse. */

export interface DailyBonusState { available: boolean; streak: number; nextAmount: number; nextAt: string | null }
/** POST /me/daily → { claimed: number; wallet: WalletSummary; daily: DailyBonusState } */
export interface DailyClaimResult { claimed: number; wallet: WalletSummary; daily: DailyBonusState }

export interface ShopEvent {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  /** Percentage off (0–90) for the items it covers. */
  discount: number;
  /** null = all shop items; otherwise only these slots. */
  slots: CosmeticSlot[] | null;
  /** 'auto' = built-in calendar event (Black Friday, Sommer-Sale …), 'custom' = created by the owner. */
  kind: 'auto' | 'custom';
  active: boolean;
}

export interface ShopListing {
  item: CosmeticItem;
  /** Price after the best running event discount. */
  finalPrice: number;
  discount: number;
  eventId: string | null;
  owned: boolean;
  /** Black market / event items: when they disappear. */
  availableUntil: string | null;
}

/** A set of matching items sold together; you only pay for the ones you do not own yet. */
export interface ShopBundle {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
  /** What buying the bundle costs now: the current prices of the items you do not own yet. */
  price: number;
  /** The same items at their regular prices (for the crossed-out price). */
  fullPrice: number;
  /** How many of the items you already own. */
  owned: number;
}

/** GET /me/shop */
export interface ShopResponse { listings: ShopListing[]; bundles: ShopBundle[]; events: ShopEvent[]; upcoming: ShopEvent[]; wallet: WalletSummary }

/** POST /me/shop/buy-bundle { bundleId } returns PurchaseResult. */

/** GET /me/blackmarket */
export interface BlackMarketResponse { weekStart: string; endsAt: string; listings: ShopListing[]; wallet: WalletSummary }

/** POST /me/shop/buy { itemId } and POST /me/shop/gift { itemId, toUserId, message? } */
export interface PurchaseResult { wallet: WalletSummary; inventory: OwnedItem[] }

export interface WalletTransaction {
  id: string;
  amount: number;
  /** e.g. 'level_up', 'minigame', 'monthly_ranking', 'achievement', 'daily', 'purchase', 'gift_sent', 'owner_grant' */
  reason: string;
  /** Human readable German description. */
  label: string;
  guildName: string | null;
  createdAt: string;
}
/** GET /me/transactions?page= */
export interface TransactionPage { items: WalletTransaction[]; page: number; pages: number }

export interface RankingEntry { rank: number; userId: string; name: string; avatarUrl: string | null; points: number }
export interface GuildRanking {
  guildId: string;
  guildName: string;
  guildIconUrl: string | null;
  kind: RankingKind;
  /** YYYY-MM of the running month. */
  month: string;
  endsAt: string;
  /** false when the server is below MONTHLY_MIN_HUMANS. */
  eligible: boolean;
  me: { rank: number | null; points: number };
  top: RankingEntry[];
  rewards: number[];
}
/** GET /me/rankings */
export interface RankingsResponse { rankings: GuildRanking[]; lastPayouts: { month: string; guildName: string; kind: RankingKind; rank: number; amount: number }[] }

export interface Achievement {
  id: string;
  name: string;
  description: string;
  reward: number;
  /** Badge item granted on unlock, if any. */
  itemId: string | null;
  /** Title item granted on unlock (only available this way), if any. */
  titleId: string | null;
  unlockedAt: string | null;
  progress: { current: number; target: number } | null;
}
/** GET /me/achievements */
export interface AchievementsResponse { achievements: Achievement[] }

// ---------- Owner area ----------

export interface OwnerStats {
  supply: number;
  wallets: number;
  earnedToday: number;
  spentToday: number;
  topHolders: { userId: string; name: string; balance: number }[];
  bestsellers: { itemId: string; name: string; sold: number }[];
}
/** GET /owner/overview */
export interface OwnerOverview { stats: OwnerStats; events: ShopEvent[]; blackMarket: BlackMarketResponse; config: EconomyConfig }

/** Tunables the owner can change (defaults from shared/cosmetics.ts). GET/PUT /owner/config */
export interface EconomyConfig {
  dailyEarnCap: number;
  levelUpBase: number;
  levelUpPerLevel: number;
  milestoneMultiplier: number;
  minigameReward: { min: number; max: number };
  monthlyRewards: number[];
  monthlyMinHumans: number;
  monthlyMaxServers: number;
  blackMarketSize: number;
  dailyBonus: { base: number; perStreakDay: number; maxStreakBonus: number };
}

/** GET /owner/items → CosmeticItem[];  POST /owner/items (create), PUT /owner/items/:id (update), DELETE /owner/items/:id (deactivate). */
/** GET /owner/events → ShopEvent[];  POST/PUT/DELETE /owner/events[/:id] for custom events (auto events can be toggled via PUT { active }). */
/** POST /owner/blackmarket/reroll → BlackMarketResponse (new random rotation for the current week);
 *  PUT /owner/blackmarket { itemIds } → pin this week's rotation. */
/** POST /owner/grant { userId, amount, note } → WalletSummary (logged as owner_grant; for testing and support). */

export interface ItemFilter { slot: CosmeticSlot | null; rarity: Rarity | null }
