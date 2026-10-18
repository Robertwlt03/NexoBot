import { useState } from 'react';
import type { CommandCategory, CommandEntry, CommandsOverview } from '../../../src/web/dto/commands';
import { useAction, useApi, useGuild } from '../api';
import { Badge, Empty, Modal, Notice, PageHeader, Spinner, Switch } from '../components/ui';
import './Commands.css';

function CommandRow({ command, category, busy, onToggle }: {
  command: CommandEntry; category: CommandCategory; busy: boolean; onToggle: (enabled: boolean) => void;
}) {
  const inherited = !command.enabled && !command.disabledDirectly;
  return (
    <div className="list-item cmd-row" style={{ marginLeft: command.depth * 24 }}>
      <div className="grow">
        <div className="row" style={{ gap: 8 }}>
          <code>/{command.name}</code>
          {command.locked && <Badge>Geschützt</Badge>}
          {inherited && <span className="faint">Aus über {category.disabled ? 'die Kategorie' : 'den übergeordneten Command'}</span>}
        </div>
        <div className="desc">{command.description}</div>
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
  const [resetTarget, setResetTarget] = useState<CommandCategory | null>(null);

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
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <input className="input" style={{ maxWidth: 360 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Command suchen, z. B. ban oder msg notes" />
          <span className="muted"><strong>{data.enabledTotal}/{data.totalCommands}</strong> Einträge aktiv · Änderungen gelten sofort.</span>
        </div>
      </div>

      {categories.length === 0 && <div className="card"><Empty title="Nichts gefunden">Kein Command passt zu „{query}“.</Empty></div>}

      {categories.map(({ category, commands }) => (
        <details key={category.key} className="card cmd-category" open={q ? true : undefined}>
          <summary>
            <span style={{ fontSize: 20 }}>{category.icon}</span>
            <div className="grow">
              <h3>{category.name}</h3>
              <span className="faint">{category.disabled ? 'Kategorie ist aus' : `${category.enabledCount}/${category.totalCount} aktiv`}</span>
            </div>
            <span className="row" onClick={(e) => e.preventDefault()}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => setResetTarget(category)}>Zurücksetzen</button>
              <Switch checked={!category.disabled} disabled={busy !== null} label={`Kategorie ${category.name}`}
                onChange={(enabled) => act('category', { key: category.key, enabled }, enabled ? `${category.name} ist jetzt an.` : `${category.name} ist jetzt aus.`)} />
            </span>
          </summary>
          <div className="list">
            {commands.map((command) => (
              <CommandRow key={command.name} command={command} category={category} busy={busy !== null}
                onToggle={(enabled) => act('command', { name: command.name, enabled }, enabled ? `/${command.name} ist jetzt an.` : `/${command.name} ist jetzt aus.`)} />
            ))}
          </div>
        </details>
      ))}

      {resetTarget && (
        <Modal title={`${resetTarget.name} zurücksetzen?`} onClose={() => setResetTarget(null)}
          footer={<>
            <button type="button" className="btn btn-ghost" onClick={() => setResetTarget(null)}>Abbrechen</button>
            <button type="button" className="btn btn-danger" disabled={busy !== null} onClick={async () => {
              await act('reset', { key: resetTarget.key }, `${resetTarget.name} wurde zurückgesetzt.`);
              setResetTarget(null);
            }}>Zurücksetzen</button>
          </>}>
          <p className="muted">Die Kategorie wird eingeschaltet und alle einzeln ausgeschalteten Commands darin wieder aktiviert.</p>
        </Modal>
      )}
    </>
  );
}
