// Event look of the bot profile: a bio within Discord's limit for every built-in event, and a look for each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarEvents } from '../src/services/cosmetics/events.js';
import { eventBio, lookFor } from '../src/services/cosmetics/botProfile.js';

test('every calendar event has its own look and a bio of at most 190 characters', () => {
  for (const event of calendarEvents(2026)) {
    assert.ok(eventBio(event).length <= 190, event.id);
    assert.ok(event.id === 'new-year' || lookFor(event).glyph !== 'star', `${event.id} falls back to the custom look`);
  }
  assert.equal(lookFor({ ...calendarEvents(2026)[0], id: 'custom-123' }).glyph, 'star');
});

test('status lines lead with the running event and fit Discord', async () => {
  const { statusLines } = await import('../src/services/cosmetics/presence.js');
  const halloween = calendarEvents(2026).find((e) => e.id === 'halloween')!;
  const lines = statusLines(halloween, '2026-10', 3);
  assert.equal(lines[0], '🎉 Halloween läuft · −15 % im Shop');
  assert.ok(lines.some((l) => l.includes('Oktober 2026')) && lines.at(-1)!.includes('3 Servern'));
  assert.equal(statusLines(null, '2026-10', 1).length, 4);
});
