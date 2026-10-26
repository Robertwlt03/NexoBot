// Filled event icons for event lists (season page, shop). Kept apart from EventScene.tsx, which the tests import
// for eventTheme() without a React runtime.
import type { ReactNode } from 'react';
import type { ShopEvent } from '../../../src/web/dto/profile';
import { EVENT_THEMES, eventTheme, type EventTheme } from './EventScene';

/** Rays and arms that stay lines: drawn as strokes inside the filled icon. */
const RAY = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' } as const;

/** One filled icon per event theme, solid shapes with cut-outs (even-odd) so they read at 16 px. */
const EVENT_ICONS: Record<EventTheme, ReactNode> = {
  love: <path d="M12 21s-8.5-5.2-8.5-11.2A4.8 4.8 0 0 1 12 6.7a4.8 4.8 0 0 1 8.5 3.1C20.5 15.8 12 21 12 21z" />,
  carnival: <path d="M2 9c.8-3.6 5.6-3.4 10-1 4.4-2.4 9.2-2.6 10 1 .8 3.8-1.6 7.5-5.2 7.5-2.2 0-3.6-1.4-4.8-3-1.2 1.6-2.6 3-4.8 3C3.6 16.5 1.2 12.8 2 9zM5.2 10.7c.7-1.3 2.8-1.5 4-.4-.7 1.4-2.8 1.7-4 .4zM18.8 10.7c-.7-1.3-2.8-1.5-4-.4.7 1.4 2.8 1.7 4 .4z" />,
  easter: <path d="M12 2.5c4.2 0 7.5 7 7.5 11.5a7.5 7.5 0 0 1-15 0C4.5 9.5 7.8 2.5 12 2.5zM5 12.4l2.3-1.6 2.3 1.6 2.4-1.6 2.4 1.6 2.3-1.6 2.3 1.6v1.8l-2.3-1.6-2.3 1.6-2.4-1.6-2.4 1.6-2.3-1.6L5 14.2z" />,
  summer: <><circle cx="12" cy="12" r="4.6" /><path {...RAY} d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" /></>,
  autumn: <><path d="M4.5 19.5C4.5 10 10 4.5 20 4c-.4 10-6 15.5-15.5 15.5zM7 17.6l9.6-9.6.8.8L7.8 18.4z" /><path {...RAY} strokeWidth={2} d="M3 21l3-3" /></>,
  halloween: <path d="M12 7.5c-4.7 0-8.7 2.7-8.7 6.6s3.7 6.5 8.7 6.5 8.7-2.6 8.7-6.5-4-6.6-8.7-6.6zM8.4 8.7c-1.2 1.5-1.8 3.3-1.8 5.4s.6 3.9 1.8 5.3c-.5-1.6-.7-3.3-.7-5.3s.2-3.8.7-5.4zM15.6 8.7c1.2 1.5 1.8 3.3 1.8 5.4s-.6 3.9-1.8 5.3c.5-1.6.7-3.3.7-5.3s-.2-3.8-.7-5.4zM11 7.6V4.8c0-1.2.8-2 2-2.2l.6 1.3c-.7.2-1.1.5-1.1 1.1v2.6z" />,
  sale: <path d="M2.5 11.6V3.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l9.4 9.4a1 1 0 0 1 0 1.4l-8.1 8.1a1 1 0 0 1-1.4 0l-9.4-9.4a1 1 0 0 1-.3-.7zM7.5 5.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />,
  winter: <><circle cx="12" cy="12" r="2.4" /><path {...RAY} d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.6 4l2.4 2 2.4-2M9.6 20l2.4-2 2.4 2M3.5 10.1l3 .5-1-2.9M20.5 13.9l-3-.5 1 2.9M3.5 13.9l3-.5-1 2.9M20.5 10.1l-3 .5 1-2.9" /></>,
  newyear: <path d="M12 2c3.6 2.6 5.2 6.4 4.6 11l-2.1 3.5h-5L7.4 13C6.8 8.4 8.4 4.6 12 2zM12 7.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM7.6 12.2L4.5 15.5l.3 3.5 3.8-2.2zM16.4 12.2l3.1 3.3-.3 3.5-3.8-2.2zM10.3 18h3.4L12 22z" />,
  party: <path d="M3 8h8v4H3zM13 8h8v4h-8zM4.5 13.2H11V21H4.5zM13 13.2h6.5V21H13zM12 8C10.5 4 6.5 4 7 6.5S12 8 12 8zM12 8c1.5-4 5.5-4 5-1.5S12 8 12 8z" />,
};

/** The event's filled icon in its season tint, mixed with the text colour so it keeps its contrast in both modes. */
export function EventIcon({ event, size = 18 }: { event: Pick<ShopEvent, 'id' | 'name'>; size?: number }) {
  const theme = eventTheme(event);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true" className="shrink-0"
      style={{ color: `color-mix(in srgb, ${EVENT_THEMES[theme].tint} 70%, var(--text-strong))` }}>
      {EVENT_ICONS[theme]}
    </svg>
  );
}
