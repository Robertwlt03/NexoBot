import { useState } from 'react';
import type { CommandCategory, CommandEntry, CommandsOverview } from '../../../src/web/dto/commands';
import { useAction, useApi, useGuild } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Badge, Card, Empty, Notice, PageHeader, Spinner, Switch } from '../components/ui';
import { Icon } from '../icons';

function CommandRow({ command, category, busy, onToggle }: {
  command: CommandEntry; category: CommandCategory; busy: boolean; onToggle: (enabled: boolean) => void;
}) {
  const inherited = !command.enabled && !command.disabledDirectly;
  return (
    <div className="list-item" style={{ marginLeft: command.depth * 24 }}>
      <div className="grow">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-(--text-strong)">/{command.name}</code>
          {command.locked && <Badge>Geschützt</Badge>}
          {inherited && <span className="faint">Aus über {category.disabled ? 'die Kategorie' : 'den übergeordneten Command'}</span>}
        </div>
        <div className="faint">{command.description}</div>
      </div>
      <Switch checked={command.enabled} disabled={busy || command.locked || inherited} label={`/${command.name}`} onChange={onToggle} />
    </div>
  );
}

export default function CommandsPage() {
  const { guild } = useGuild();
  const base = `/guilds/${guild.id}/commands`;
  const { data, setData, error, loading } = useApi<CommandsOverview>(base);
  const { run, busy } = useAction();
  const [query, setQuery] = useState('');
  const { confirm, dialog } = useConfirm();

  const act = async (action: string, body: unknown, success: string) => {
    const result = await run<CommandsOverview>(`${base}/actions/${action}`, body, success);
    if (result) setData(result);
  };

  const header = <PageHeader icon="commands" title="Commands" description="Schalte Commands und ganze Kategorien für diesen Server an oder aus." />;
  if (loading && !data) return <>{header}<Spinner /></>;
  if (!data) return <>{header}<Notice tone="danger">{error ?? 'Laden fehlgeschlagen.'}</Notice></>;

  const q = query.trim().toLowerCase().replace(/^\//, '');
  const categories = data.categories
    .map((category) => ({
      category,
      commands: q
        ? category.commands.filter((c) => c.name.includes(q) || c.description.toLowerCase().includes(q) || category.name.toLowerCase().includes(q))
        : category.commands,
    }))
    .filter((entry) => entry.commands.length > 0);

  return (
    <>
      {header}
      <Card>
        <div className="row justify-between">
          <input className="input max-w-[360px]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Command suchen, z. B. ban" />
          <span className="muted"><strong>{data.enabledTotal}/{data.totalCommands}</strong> Einträge aktiv · Änderungen gelten sofort.</span>
        </div>
      </Card>

      {categories.length === 0 && <Card><Empty title="Nichts gefunden">Kein Command passt zu „{query}“.</Empty></Card>}

      {categories.map(({ category, commands }) => (
        <details key={category.key} className="card group" open={q ? true : undefined}>
          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden before:text-xl before:leading-none before:text-(--text-faint) before:transition-transform before:content-['›'] group-open:before:rotate-90">
            <span className="text-xl">{category.icon}</span>
            <div className="min-w-0 flex-1">
              <h3>{category.name}</h3>
              <span className="faint">{category.disabled ? 'Kategorie ist aus' : `${category.enabledCount}/${category.totalCount} aktiv`}</span>
            </div>
            <span className="row" onClick={(e) => e.preventDefault()}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => confirm({
                title: `${category.name} zurücksetzen?`,
                text: 'Die Kategorie wird eingeschaltet und alle einzeln ausgeschalteten Commands darin wieder aktiviert.',
                confirmLabel: 'Zurücksetzen',
                onConfirm: () => act('reset', { key: category.key }, `${category.name} wurde zurückgesetzt.`),
              })} aria-label={`${category.name} zurücksetzen`} title="Zurücksetzen">
                {/* Icon only on phones, so the category name keeps its line. */}
                <Icon name="refresh" size={16} /><span className="max-sm:hidden">Zurücksetzen</span>
              </button>
              <Switch checked={!category.disabled} disabled={busy !== null} label={`Kategorie ${category.name}`}
                onChange={(enabled) => act('category', { key: category.key, enabled }, enabled ? `${category.name} ist jetzt an.` : `${category.name} ist jetzt aus.`)} />
            </span>
          </summary>
          <div className="list mt-4">
            {commands.map((command) => (
              <CommandRow key={command.name} command={command} category={category} busy={busy !== null}
                onToggle={(enabled) => act('command', { name: command.name, enabled }, enabled ? `/${command.name} ist jetzt an.` : `/${command.name} ist jetzt aus.`)} />
            ))}
          </div>
        </details>
      ))}

      {dialog}
    </>
  );
}
