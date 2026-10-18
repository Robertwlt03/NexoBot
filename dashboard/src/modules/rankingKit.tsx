// Shared leaderboard list with paging (leveling, economy, counting).
import type { ReactNode } from 'react';
import { Empty, Notice, Pager, Spinner } from '../components/ui';

export interface RankRow {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  value: ReactNode;
  detail?: ReactNode;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

export function RankList({ rows, loading, error, emptyTitle, emptyText, page, pages, onPage, onSelect, selectLabel = 'Bearbeiten' }: {
  rows: RankRow[] | null; loading: boolean; error: string | null; emptyTitle: string; emptyText?: string;
  page?: number; pages?: number; onPage?: (page: number) => void;
  onSelect?: (userId: string) => void; selectLabel?: string;
}) {
  if (error && !rows) return <Notice tone="danger">{error}</Notice>;
  if (!rows) return loading ? <Spinner /> : null;
  if (rows.length === 0) return <Empty title={emptyTitle}>{emptyText}</Empty>;
  return (
    <div className={loading ? 'opacity-60' : undefined}>
      <div className="list">
        {rows.map((row) => (
          <div className="list-item" key={row.userId}>
            <span className="w-8 text-center font-bold">{MEDALS[row.rank - 1] ?? `#${row.rank}`}</span>
            <img src={row.avatarUrl ?? DEFAULT_AVATAR} alt="" className="h-8 w-8 rounded-full" />
            <div className="grow">
              <div className="title">{row.name}</div>
              <div className="faint">{row.userId}</div>
            </div>
            <div className="text-right">
              <div>{row.value}</div>
              {row.detail && <div className="faint">{row.detail}</div>}
            </div>
            {onSelect && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(row.userId)}>{selectLabel}</button>}
          </div>
        ))}
      </div>
      {onPage && page !== undefined && pages !== undefined && <Pager page={page} pages={pages} onPage={onPage} busy={loading} />}
    </div>
  );
}

/** Discord user ids are 17–20 digits. */
export const isUserId = (value: string) => /^\d{17,20}$/.test(value.trim());
