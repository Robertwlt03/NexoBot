import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CHANNEL_TYPES } from '../../../src/web/apiTypes';
import type { ApiChannel, ApiRole } from '../../../src/web/apiTypes';
import { useGuild } from '../api';
import { Icon, IconTile, type IconName } from '../icons';
import { useEnter } from './motion';
import { useLocation } from 'react-router';
import { MODULES } from '../modules/registry';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// ---------- Layout ----------

/**
 * The one page header used everywhere: small section label (the module's sidebar group by default), title,
 * description, optional media (defaults to the icon tile) and actions on the right.
 */
export function PageHeader({ icon, title, description, actions, kicker, media }: {
  icon?: IconName; title: string; description: ReactNode; actions?: ReactNode; kicker?: string; media?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEnter(ref, { y: 0, x: -10 });
  const label = kicker ?? MODULES.find((m) => location.pathname.endsWith(`/${m.id}`))?.group;
  return (
    <header className="page-head" ref={ref}>
      {media ?? (icon && <IconTile name={icon} size={52} />)}
      <div className="min-w-0 flex-1">
        {label && <p className="page-kicker">{label}</p>}
        <h1>{title}</h1>
        <p className="page-desc">{description}</p>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

/** Segmented tabs with a highlight that slides to the active tab. */
export function Tabs<T extends string>({ value, onChange, items }: {
  value: T; onChange: (value: T) => void; items: { id: T; label: string; count?: number }[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const active = root.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active || !pill.current) return;
    const target = { x: active.offsetLeft, width: active.offsetWidth, autoAlpha: 1 };
    const instant = pill.current.dataset.placed !== '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant) gsap.set(pill.current, target);
    else gsap.to(pill.current, { ...target, duration: 0.35, ease: 'power3.out' });
    pill.current.dataset.placed = '1';
  }, { dependencies: [value, items.length] });
  // Snap again when the tab widths change (web font arriving, resize).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const snap = () => {
      const active = el.querySelector<HTMLElement>('[aria-selected="true"]');
      if (active && pill.current?.dataset.placed === '1') gsap.set(pill.current, { x: active.offsetLeft, width: active.offsetWidth });
    };
    const observer = new ResizeObserver(snap);
    el.querySelectorAll('.tab').forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [items.length]);
  return (
    <div className="tabs" role="tablist" ref={root}>
      <span className="tabs-pill" ref={pill} />
      {items.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={item.id === value} className="tab" onClick={() => onChange(item.id)}>
          {item.label}{item.count !== undefined && <span className="tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Previous / next paging under lists and tables. Renders nothing for a single page. */
export function Pager({ page, pages, onPage, busy }: { page: number; pages: number; onPage: (page: number) => void; busy?: boolean }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>Zurück</button>
      <span>Seite <b>{page}</b> von {pages}</span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages || busy} onClick={() => onPage(page + 1)}>Weiter</button>
    </div>
  );
}

/** Scroll container for wide tables, so they never stretch the page on small screens. */
export function TableWrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`table-wrap ${className}`}><table className="table">{children}</table></div>;
}

/** Row of number tiles (overview, ticket stats, counting status …). */
export function Stats({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  return (
    <dl className="stats">
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <dt>{item.value}</dt>
          <dd>{item.label}</dd>
          {item.hint && <dd className="stat-hint">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Buttons at the end of a card or form, right-aligned. */
export function Actions({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' | 'between' }) {
  return <div className={`actions-row actions-${align}`}>{children}</div>;
}

export function Card({ title, description, icon, right, disabled, children }: {
  title?: string; description?: string; icon?: IconName; right?: ReactNode; disabled?: boolean; children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEnter(ref);
  return (
    <section className={`card${disabled ? ' disabled-section' : ''}`} ref={ref}>
      {(title || right) && (
        <div className="card-head">
          <div>
            {title && <h3>{icon && <Icon name={icon} size={18} />}{title}</h3>}
            {description && <p>{description}</p>}
          </div>
          {right && <div className="right">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------- Inputs ----------

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)} />
  );
}

export function SwitchRow({ title, description, checked, onChange, disabled }: {
  title: string; description?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="switch-row">
      <div className="text">
        <div className="title">{title}</div>
        {description && <div className="desc">{description}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, maxLength }: { value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  return <input className="input" value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />;
}

export function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input className="input" type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step}
      onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
  );
}

/** Textarea with clickable placeholder chips that insert at the cursor. */
export function TextArea({ value, onChange, placeholder, maxLength, variables, rows = 4 }: {
  value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number; variables?: string[]; rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (token: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };
  return (
    <>
      <textarea ref={ref} className="textarea" rows={rows} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      {(variables?.length || maxLength) ? (
        <div className="row justify-between">
          <div className="var-list">{variables?.map((v) => <button key={v} type="button" onClick={() => insert(v)}>{v}</button>)}</div>
          {maxLength && <span className="faint">{value.length}/{maxLength}</span>}
        </div>
      ) : null}
    </>
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="input-group">
      <input className="input" type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#7c5cff'} onChange={(e) => onChange(e.target.value)} />
      <input className="input max-w-[140px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder="#7C5CFF" maxLength={7} />
    </div>
  );
}

// ---------- Discord pickers ----------

export type ChannelKind = 'text' | 'voice' | 'category';

const KIND_TYPES: Record<ChannelKind, number[]> = {
  text: [CHANNEL_TYPES.text, CHANNEL_TYPES.announcement],
  voice: [CHANNEL_TYPES.voice, CHANNEL_TYPES.stage],
  category: [CHANNEL_TYPES.category],
};

const channelPrefix = (channel: ApiChannel) =>
  channel.type === CHANNEL_TYPES.voice || channel.type === CHANNEL_TYPES.stage ? '🔊 ' : channel.type === CHANNEL_TYPES.category ? '' : '# ';

function channelsOfKind(channels: ApiChannel[], kind: ChannelKind) {
  const allowed = KIND_TYPES[kind];
  const categories = new Map(channels.filter((c) => c.type === CHANNEL_TYPES.category).map((c) => [c.id, c]));
  const list = channels.filter((c) => allowed.includes(c.type));
  if (kind === 'category') return [{ label: '', items: list }];
  const groups = new Map<string, ApiChannel[]>();
  for (const channel of list) {
    const key = channel.parentId ?? '';
    groups.set(key, [...(groups.get(key) ?? []), channel]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (categories.get(a)?.position ?? -1) - (categories.get(b)?.position ?? -1))
    .map(([parent, items]) => ({ label: categories.get(parent)?.name.toUpperCase() ?? '', items }));
}

export function ChannelSelect({ value, onChange, kind = 'text', placeholder = 'Kanal auswählen', allowNone = true }: {
  value: string | null | undefined; onChange: (value: string | null) => void; kind?: ChannelKind; placeholder?: string; allowNone?: boolean;
}) {
  const { guild } = useGuild();
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="" disabled={!allowNone}>{allowNone ? `— ${placeholder} —` : placeholder}</option>
      {channelsOfKind(guild.channels, kind).map((group) =>
        group.label ? (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((c) => <option key={c.id} value={c.id}>{channelPrefix(c)}{c.name}</option>)}
          </optgroup>
        ) : group.items.map((c) => <option key={c.id} value={c.id}>{channelPrefix(c)}{c.name}</option>),
      )}
    </select>
  );
}

export function RoleSelect({ value, onChange, placeholder = 'Rolle auswählen', assignableOnly = false }: {
  value: string | null | undefined; onChange: (value: string | null) => void; placeholder?: string; assignableOnly?: boolean;
}) {
  const { guild } = useGuild();
  const roles = guild.roles.filter((role) => !role.managed && (!assignableOnly || role.assignable));
  return (
    <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— {placeholder} —</option>
      {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
    </select>
  );
}

function RoleChip({ role, onRemove }: { role: ApiRole | undefined; onRemove: () => void }) {
  return (
    <span className="chip">
      <span className="dot" style={{ background: role && role.color !== '#000000' ? role.color : '#99aab5' }} />
      {role ? role.name : 'Unbekannte Rolle'}
      <button type="button" onClick={onRemove} aria-label="Entfernen">×</button>
    </span>
  );
}

export function MultiRoleSelect({ value, onChange, assignableOnly = false, max }: {
  value: string[]; onChange: (value: string[]) => void; assignableOnly?: boolean; max?: number;
}) {
  const { guild } = useGuild();
  const byId = new Map(guild.roles.map((role) => [role.id, role]));
  const available = guild.roles.filter((role) => !role.managed && !value.includes(role.id) && (!assignableOnly || role.assignable));
  return (
    <div className="stack gap-2">
      {value.length > 0 && <div className="chips">{value.map((id) => <RoleChip key={id} role={byId.get(id)} onRemove={() => onChange(value.filter((v) => v !== id))} />)}</div>}
      {(!max || value.length < max) && (
        <select className="select" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">+ Rolle hinzufügen</option>
          {available.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
        </select>
      )}
    </div>
  );
}

export function MultiChannelSelect({ value, onChange, kind = 'text' }: { value: string[]; onChange: (value: string[]) => void; kind?: ChannelKind }) {
  const { guild } = useGuild();
  const byId = new Map(guild.channels.map((channel) => [channel.id, channel]));
  const available = guild.channels.filter((c) => KIND_TYPES[kind].includes(c.type) && !value.includes(c.id));
  return (
    <div className="stack gap-2">
      {value.length > 0 && (
        <div className="chips">
          {value.map((id) => (
            <span className="chip" key={id}>
              {byId.get(id) ? `${channelPrefix(byId.get(id)!)}${byId.get(id)!.name}` : 'Unbekannter Kanal'}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} aria-label="Entfernen">×</button>
            </span>
          ))}
        </div>
      )}
      <select className="select" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
        <option value="">+ Kanal hinzufügen</option>
        {available.map((c) => <option key={c.id} value={c.id}>{channelPrefix(c)}{c.name}</option>)}
      </select>
    </div>
  );
}

/** Editable list of short strings (e.g. words, questions). */
export function TagInput({ value, onChange, placeholder = 'Eintrag hinzufügen und Enter drücken', max }: {
  value: string[]; onChange: (value: string[]) => void; placeholder?: string; max?: number;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const entries = draft.split(',').map((e) => e.trim()).filter((e) => e && !value.includes(e));
    if (entries.length) onChange([...value, ...entries].slice(0, max ?? Infinity));
    setDraft('');
  };
  return (
    <div className="stack gap-2">
      {value.length > 0 && (
        <div className="chips">
          {value.map((entry) => (
            <span className="chip" key={entry}>{entry}<button type="button" onClick={() => onChange(value.filter((v) => v !== entry))} aria-label="Entfernen">×</button></span>
          ))}
        </div>
      )}
      <input className="input" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} onBlur={add} />
    </div>
  );
}

// ---------- Feedback ----------

export function Badge({ on, children }: { on?: boolean; children: ReactNode }) {
  return <span className={`badge ${on === undefined ? 'badge-brand' : on ? 'badge-on' : 'badge-off'}`}>{children}</span>;
}

export function Notice({ tone, children }: { tone?: 'warn' | 'danger'; children: ReactNode }) {
  return <div className={`notice${tone ? ` ${tone}` : ''}`}>{children}</div>;
}

export function Spinner() {
  return <div className="center"><div className="spinner" /></div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

export function Modal({ title, children, footer, onClose, wide = false }: { title: string; children: ReactNode; footer: ReactNode; onClose: () => void; wide?: boolean }) {
  const backdrop = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(backdrop.current, { autoAlpha: 0, duration: 0.2 });
      gsap.from('.modal', { y: 16, scale: 0.95, autoAlpha: 0, duration: 0.35, ease: 'back.out(1.6)' });
    });
    return () => mm.revert();
  }, { scope: backdrop });
  return (
    <div ref={backdrop} className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-body"><h2>{title}</h2>{children}</div>
        <div className="modal-foot">{footer}</div>
      </div>
    </div>
  );
}

/** Generic page body for settings modules: loading, error and the save bar. */
export function SettingsPage<T>({ settings, children }: {
  settings: { value: T | null; dirty: boolean; save: () => Promise<void>; reset: () => void; saving: boolean; error: string | null; loading: boolean };
  children: (value: T) => ReactNode;
}) {
  if (settings.loading && !settings.value) return <Spinner />;
  if (settings.error && !settings.value) return <Notice tone="danger">{settings.error}</Notice>;
  if (!settings.value) return null;
  return (
    <>
      {children(settings.value)}
      <SaveBar dirty={settings.dirty} saving={settings.saving} onSave={settings.save} onReset={settings.reset} />
    </>
  );
}

export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  useGSAP(() => {
    const el = bar.current;
    if (!el) return;
    if (!shown.current && !dirty) { gsap.set(el, { xPercent: -50, y: 40, autoAlpha: 0 }); return; }
    shown.current = true;
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(el, dirty
      ? { xPercent: -50, y: 0, autoAlpha: 1, duration: instant ? 0 : 0.45, ease: 'back.out(1.7)' }
      : { xPercent: -50, y: 40, autoAlpha: 0, duration: instant ? 0 : 0.25, ease: 'power2.in' });
  }, { dependencies: [dirty] });
  return (
    <div ref={bar} className="save-bar" id="save-bar" aria-hidden={!dirty}>
      <span className="msg">Achtung – du hast ungespeicherte Änderungen!</span>
      <button className="btn btn-ghost btn-sm" type="button" onClick={onReset} disabled={saving}>Zurücksetzen</button>
      <button className="btn btn-primary btn-sm" type="button" onClick={onSave} disabled={saving}>{saving ? 'Speichern …' : 'Änderungen speichern'}</button>
    </div>
  );
}

// ---------- Discord message preview ----------

/** Replaces common placeholders with sample values for previews. */
export function renderPlaceholders(text: string, sample: Record<string, string>): ReactNode[] {
  const parts = text.split(/(\{[\w.]+\})/g);
  return parts.map((part, index) => {
    const replacement = sample[part];
    if (replacement === undefined) return part;
    return replacement.startsWith('@') || replacement.startsWith('#')
      ? <span key={index} className="mention">{replacement}</span>
      : replacement;
  });
}

export function MessagePreview({ content, embed, sample }: {
  content?: string;
  embed?: { title?: string; description?: string; color?: string; image?: string | null; footer?: string } | null;
  sample: Record<string, string>;
}) {
  return (
    <div className="preview">
      <img className="avatar" src="/dashboard/nexo.svg" alt="" />
      <div className="min-w-0 flex-1">
        <div className="author">Nexo <span className="bot-tag">App</span></div>
        {content && <div className="msg-content">{renderPlaceholders(content, sample)}</div>}
        {embed && (
          <div className="embed" style={{ borderLeftColor: embed.color || 'var(--brand)' }}>
            {embed.title && <div className="e-title">{renderPlaceholders(embed.title, sample)}</div>}
            {embed.description && <div className="e-desc">{renderPlaceholders(embed.description, sample)}</div>}
            {embed.image && <img className="e-image" src={embed.image} alt="" />}
            {embed.footer && <div className="e-footer">{renderPlaceholders(embed.footer, sample)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
