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
