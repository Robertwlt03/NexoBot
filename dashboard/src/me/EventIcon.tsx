// Event icons for event lists (season page, shop): small multi-colour pictures taken from the banner scenes in
// EventScene.tsx, so the list and the banner speak the same language. The art lives in src/shared/eventIcons.ts,
// where the bot's event banner in Discord draws the same pictures.
import { useId } from 'react';
import type { ShopEvent } from '../../../src/web/dto/profile';
import { eventIconMarkup, eventTheme } from '../../../src/shared/eventIcons';

export function EventIcon({ event, size = 20 }: { event: Pick<ShopEvent, 'id' | 'name'>; size?: number }) {
  // The markup is our own constant art (no user input); the id keeps its gradients unique on the page.
  const markup = eventIconMarkup(eventTheme(event), useId());
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0" dangerouslySetInnerHTML={{ __html: markup }} />;
}
