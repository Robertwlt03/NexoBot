// Combobox for the member filter: type to search (debounced), pick with mouse or arrow keys + Enter.
import { useEffect, useId, useState } from 'react';
import type { MemberHit } from '../../../../src/web/dto/insightsDetail';
import { api } from '../../api';
import { Badge } from '../../components/ui';
import { DEFAULT_AVATAR } from './shared';

export interface PickedMember { userId: string; name: string; avatarUrl: string | null }

export function MemberPicker({ base, selected, onSelect }: {
  /** /guilds/:id/insights */
  base: string;
  selected: PickedMember | null;
  onSelect: (userId: string | null) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setHits([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api<MemberHit[]>(`${base}/members/search?q=${encodeURIComponent(q)}`)
        .then((result) => { if (!cancelled) { setHits(result); setActive(0); setError(null); } })
        .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [base, query]);

  const pick = (hit: MemberHit) => {
    onSelect(hit.userId);
    setQuery('');
    setOpen(false);
  };

  if (selected) {
    return (
      <div className="input flex min-w-0 items-center gap-2 py-1.5">
        <img src={selected.avatarUrl ?? DEFAULT_AVATAR} alt="" className="h-6 w-6 shrink-0 rounded-full" />
        <span className="min-w-0 flex-1 truncate text-[#f2f3f5]">{selected.name}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(null)} aria-label="Mitgliederfilter entfernen">×</button>
      </div>
    );
  }

  const expanded = open && query.trim() !== '';
  return (
    <div className="relative min-w-0">
      <input className="input" role="combobox" aria-expanded={expanded} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={expanded && hits[active] ? `${listId}-${active}` : undefined}
        aria-label="Mitglied suchen" placeholder="Mitglied suchen (Name oder ID) …" value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (hits.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length : 0));
          } else if (e.key === 'Enter' && expanded && hits[active]) {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }} />
      {expanded && (
        <ul id={listId} role="listbox" aria-label="Gefundene Mitglieder"
          className="absolute inset-x-0 top-full z-20 m-0 mt-1 max-h-80 list-none overflow-y-auto rounded-xl border border-white/10 bg-[#0e0f11] p-1 shadow-lg">
          {hits.map((hit, i) => (
            <li key={hit.userId} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${i === active ? 'bg-white/[.08]' : ''}`}
              onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(hit)}>
              <img src={hit.avatarUrl ?? DEFAULT_AVATAR} alt="" className="h-7 w-7 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-[#f2f3f5]">{hit.name}</span> <span className="faint">@{hit.username}</span>
              </span>
              {hit.bot && <Badge>Bot</Badge>}
            </li>
          ))}
          {hits.length === 0 && (
            <li className="faint px-2.5 py-2" role="presentation">{error ?? (searching ? 'Suche …' : 'Kein Mitglied gefunden.')}</li>
          )}
        </ul>
      )}
    </div>
  );
}
