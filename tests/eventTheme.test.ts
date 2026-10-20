import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventTheme } from '../dashboard/src/me/EventScene.tsx';
import { calendarEvents, easterSunday } from '../src/services/cosmetics/events.js';

test('every calendar event gets its own season theme', () => {
  const themes = Object.fromEntries(calendarEvents(2026).map((event) => [event.id, eventTheme(event)]));
  assert.deepEqual(themes, {
    'new-year': 'newyear', valentine: 'love', carnival: 'carnival', easter: 'easter', 'summer-sale': 'summer', autumn: 'autumn',
    halloween: 'halloween', 'black-friday': 'sale', christmas: 'winter',
  });
});

test('custom events are themed by their name', () => {
  assert.equal(eventTheme({ id: 'custom-1', name: 'Herbst-Special' }), 'autumn');
  assert.equal(eventTheme({ id: 'custom-2', name: 'Sommer-Sale' }), 'summer');
  assert.equal(eventTheme({ id: 'custom-3', name: 'Winterzauber' }), 'winter');
  assert.equal(eventTheme({ id: 'custom-4', name: 'Geburtstag von Nexo' }), 'party');
});

test('Easter-based events follow the Easter date', () => {
  assert.deepEqual([2026, 2027, 2028, 2038].map(easterSunday), [[4, 5], [3, 28], [4, 16], [4, 25]]);
  const days = (id: string) => {
    const event = calendarEvents(2026).find((e) => e.id === id)!;
    return [event.startsAt.slice(0, 10), event.endsAt.slice(0, 10)];
  };
  // Berlin midnight is the previous day in UTC.
  assert.deepEqual(days('carnival'), ['2026-02-11', '2026-02-17']); // Weiberfastnacht 12.2. – Aschermittwoch 18.2.
  assert.deepEqual(days('easter'), ['2026-03-28', '2026-04-06']); // Palmsonntag 29.3. – Ostermontag 6.4. inclusive
});
