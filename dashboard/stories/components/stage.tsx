// Shared setup of the component stories: the dashboard surface behind every example, the router and the sample guild
// some components need, and the parameters all component stories share (panel with controls, actions and the
// accessibility check; only the toolbar switches that change a component).
import type { Decorator, Parameters } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import type { ApiGuildDetail } from '../../../src/web/apiTypes';
import { GuildContext } from '../../src/api';
import { fixtures } from '../../../.storybook/sample';

/** The page surface of the dashboard behind each example, so components look like on a real page. */
export const withStage: Decorator = (Story) => (
  <div style={{ padding: 28, background: 'var(--bg-main)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
    <Story />
  </div>
);

/** For components that read the current address (PageHeader picks its section label from it). */
export const withRouter: Decorator = (Story) => <MemoryRouter initialEntries={['/server/1/willkommen']}><Story /></MemoryRouter>;

const guildId = () => (fixtures?.routes['/guilds'] as { id: string }[] | undefined)?.[0]?.id ?? '0';
const sampleGuild = () => fixtures?.resolve(`/guilds/${guildId()}`, new URLSearchParams()) as ApiGuildDetail | undefined;

/** For the channel and role pickers: they list the channels and roles of the sample server. */
export const withGuild: Decorator = (Story) => {
  const guild = sampleGuild();
  if (!guild) return <p>Keine Beispieldaten: dashboard/mock-fixtures.ts fehlt.</p>;
  return <GuildContext.Provider value={{ guild, reload: () => undefined }}><Story /></GuildContext.Provider>;
};

/** Parameters of every component story; `switches` lists the toolbar switches that change the component. */
export const componentParameters = (switches: string[] = ['scheme', 'mode']): Parameters => ({ panel: true, switches });
