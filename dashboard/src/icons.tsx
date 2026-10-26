// Line icons on a 24px grid (same style as the README section icons).
import type { ReactElement } from 'react';

export const ICON_PATHS = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  commands: <><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M6.5 10l3 2.5-3 2.5M12.5 15.5h5" /></>,
  welcome: <><path d="M3 21V5a2 2 0 0 1 2-2h8l6 6v12" /><path d="M13 3v6h6" /><path d="M8 13h6M8 17h4" /></>,
  wave: <><path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11" /><path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10" /><path d="M13 10V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M16 8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.6-2.2L3.5 15a1.5 1.5 0 0 1 2.3-1.9L7 14.5V11" /></>,
  level: <><path d="M4 20V14M10 20V9M16 20V4M22 20H2" /></>,
  shield: <><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  gavel: <><path d="M14.5 3.5l6 6M12 6l6 6M9.5 8.5l6 6M4 20l7-7" /><path d="M13 4l7 7-3 3-7-7z" /></>,
  log: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  ticket: <><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" /><path d="M9 6v12" strokeDasharray="2 2.5" /></>,
  verify: <><path d="M12 2.5l2.4 1.7 2.9-.2.9 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.8-2.9-.2L12 21.5l-2.4-1.7-2.9.2-.9-2.8-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.8 2.9.2z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  reaction: <><circle cx="12" cy="12" r="9.5" /><path d="M8 14.5a5 5 0 0 0 8 0" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth="3" /></>,
  mic: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></>,
  stats: <><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>,
  cake: <><path d="M4 21V13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8" /><path d="M4 16c1.5 1 3 1 4 0s2.5-1 4 0 3 1 4 0 2.5-1 4 0M2 21h20M12 11V7" /><path d="M12 7c-1.2 0-2-.8-2-2s2-3 2-3 2 1.8 2 3-.8 2-2 2z" /></>,
  gift: <><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13" /><path d="M12 8C10.5 4 6.5 4 7 6.5S12 8 12 8zM12 8c1.5-4 5.5-4 5-1.5S12 8 12 8z" /></>,
  hash: <><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 11h6M9 15h4" /></>,
  coins: <><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  flag: <><path d="M4 21V4" /><path d="M4 4h12l-2 4 2 4H4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3.3-5.5 6.5-5.5s6 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5c1.7.7 2.8 2.5 3 5.5" /></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" /><path d="M21 3v5h-5" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  alert: <><path d="M12 3.5L2.5 20h19z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  note: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  // Ticket priority, read like Jira: shape and colour both carry the level.
  priorityUrgent: <><path d="M6 12l6-6 6 6M6 18l6-6 6 6" /></>,
  priorityHigh: <><path d="M6 15l6-6 6 6" /></>,
  priorityMedium: <><path d="M5 9.5h14M5 14.5h14" /></>,
  priorityLow: <><path d="M6 9l6 6 6-6" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9.5 17h5" /></>,
  crown: <><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><path d="M7.5 7.5h.01" strokeWidth="3" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3.5-3.5a4 4 0 0 0-5.7-5.7L12 6.3" /><path d="M14 10a4 4 0 0 0-5.7 0l-3.5 3.5a4 4 0 0 0 5.7 5.7l1.5-1.5" /></>,
  at: <><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  userPlus: <><circle cx="9" cy="8" r="4" /><path d="M2 21c.8-4 3.5-6 7-6s6.2 2 7 6M19 8v6M16 11h6" /></>,
  chatOff: <><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M9 8.5l6 5M15 8.5l-6 5" /></>,
  gauge: <><path d="M3.5 17a9 9 0 1 1 17 0" /><path d="M12 13l4-4" /><circle cx="12" cy="13" r="1.5" /></>,
  list: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="3" /></>,
  help: <><circle cx="12" cy="12" r="9.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5h.01" /></>,
  x: <><path d="M6 6l12 12M18 6L6 18" /></>,
  send: <><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>,
  arrowLeft: <><path d="M19 12H5M11 18l-6-6 6-6" /></>,
  arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

export function IconTile({ name, size = 36 }: { name: IconName; size?: number }) {
  return (
    <span className="icon-tile" style={{ width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.5)} />
    </span>
  );
}
