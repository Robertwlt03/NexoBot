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
  halloween: <path d="M12 7.5c-4.7 0-8.7 2.7-8.7 6.6s3.7 6.5 8.7 6.5 8.7-2.6 8.7-6.5-4-6.6-8.7-6.6zM8.6 9.6c-.9 1.3-1.4 2.8-1.4 4.5s.5 3.2 1.4 4.4c-.3-1.4-.5-2.8-.5-4.4s.2-3.1.5-4.5zM15.4 9.6c.9 1.3 1.4 2.8 1.4 4.5s-.5 3.2-1.4 4.4c.3-1.4.5-2.8.5-4.4s-.2-3.1-.5-4.5zM11 7.6V4.8c0-1.2.8-2 2-2.2l.6 1.3c-.7.2-1.1.5-1.1 1.1v2.6z" />,
  sale: <path d="M2.5 11.6V3.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l9.4 9.4a1 1 0 0 1 0 1.4l-8.1 8.1a1 1 0 0 1-1.4 0l-9.4-9.4a1 1 0 0 1-.3-.7zM7.5 5.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />,
  winter: <><circle cx="12" cy="12" r="2.6" /><path {...RAY} strokeLinejoin="round" d="M12 9.4L12 2.5M9.7 10.7L3.8 7.3M9.7 13.3L3.8 16.8M12 14.6L12 21.5M14.3 13.3L20.2 16.8M14.3 10.7L20.2 7.2M14.3 4.3L12 6.6L9.7 4.3M6.5 6.2L7.3 9.3L4.2 10.1M4.2 13.9L7.3 14.7L6.5 17.8M9.7 19.7L12 17.4L14.3 19.7M17.5 17.8L16.7 14.7L19.8 13.9M19.8 10.1L16.7 9.3L17.5 6.2" /></>,
  newyear: <path d="M12 2c3.4 2.5 5 6.2 4.6 10.6L15 16.5H9l-1.6-3.9C7 8.2 8.6 4.5 12 2zM12 7.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM7.5 11.4l-3 3v4.3l4.4-3zM16.5 11.4l3 3v4.3l-4.4-3zM10 17.6h4l-2 4z" />,
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
