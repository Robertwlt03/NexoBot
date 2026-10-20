import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventTheme } from '../dashboard/src/me/EventScene.tsx';
import { calendarEvents } from '../src/services/cosmetics/events.js';

test('every calendar event gets its own season theme', () => {
  const themes = Object.fromEntries(calendarEvents(2026).map((event) => [event.id, eventTheme(event)]));
  assert.deepEqual(themes, { 'new-year': 'newyear', 'summer-sale': 'summer', halloween: 'halloween', 'black-friday': 'sale', christmas: 'winter' });
});

test('custom events are themed by their name', () => {
  assert.equal(eventTheme({ id: 'custom-1', name: 'Herbst-Special' }), 'autumn');
  assert.equal(eventTheme({ id: 'custom-2', name: 'Sommer-Sale' }), 'summer');
  assert.equal(eventTheme({ id: 'custom-3', name: 'Winterzauber' }), 'winter');
  assert.equal(eventTheme({ id: 'custom-4', name: 'Geburtstag von Nexo' }), 'party');
});
