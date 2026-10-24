// Reminder text: only when something is open, with the streak warning from day 2 on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderLines } from '../src/services/cosmetics/reminders.js';

test('reminds about the bonus, the streak and open quests – or not at all', () => {
  assert.equal(reminderLines({ available: false, streak: 5, nextAmount: 50 }, []), null);
  assert.match(reminderLines({ available: true, streak: 5, nextAmount: 50 }, [])![0], /Serie von \*\*5 Tagen\*\*/);
  assert.match(reminderLines({ available: true, streak: 0, nextAmount: 25 }, [])![0], /Tagesbonus wartet/);
  assert.deepEqual(reminderLines({ available: false, streak: 0, nextAmount: 25 }, [{ label: 'A' }, { label: 'B' }]), ['Noch offen: A · B']);
});
