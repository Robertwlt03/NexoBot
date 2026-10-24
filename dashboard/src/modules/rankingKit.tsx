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
  /** Line under the name; the user id when left out. */
  meta?: ReactNode;
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
              {onSelect ? (
                <button type="button" className="title block w-full cursor-pointer border-0 bg-transparent p-0 text-left [font:inherit] hover:underline"
                  title={selectLabel} onClick={() => onSelect(row.userId)}>{row.name}</button>
              ) : <div className="title">{row.name}</div>}
              {/* On phones the detail (e.g. wallet · bank) replaces the id line, so the value column stays narrow. */}
              <div className={`faint truncate${row.detail ? ' max-sm:hidden' : ''}`}>{row.meta ?? row.userId}</div>
              {row.detail && <div className="faint sm:hidden">{row.detail}</div>}
            </div>
            <div className="shrink-0 whitespace-nowrap text-right">
              <div>{row.value}</div>
              {row.detail && <div className="faint max-sm:hidden">{row.detail}</div>}
            </div>
            {/* On phones the name is the button, so the row keeps room for it. */}
            {onSelect && <button type="button" className="btn btn-ghost btn-sm max-sm:hidden" onClick={() => onSelect(row.userId)}>{selectLabel}</button>}
          </div>
        ))}
      </div>
      {onPage && page !== undefined && pages !== undefined && <Pager page={page} pages={pages} onPage={onPage} busy={loading} />}
    </div>
  );
}

/** Discord user ids are 17–20 digits. */
export const isUserId = (value: string) => /^\d{17,20}$/.test(value.trim());
