import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthdaysOn, getMonthName, sortByDate, upcomingBirthdays, validateBirthday } from '../src/services/birthdays/core.js';

const birthdays = { a: { month: 3, day: 15 }, b: { month: 1, day: 2 }, c: { month: 3, day: 1 }, d: { month: 2, day: 29 } };

test('validation accepts real dates, the 29th of February included', () => {
  assert.deepEqual(validateBirthday(2, 29), { isValid: true });
  assert.deepEqual(validateBirthday(12, 31), { isValid: true });
  assert.equal(validateBirthday(2, 30).isValid, false);
  assert.equal(validateBirthday(4, 31).isValid, false);
  assert.equal(validateBirthday(13, 1).isValid, false);
  assert.equal(validateBirthday('1', 1).isValid, false);
});

test('month names in German', () => {
  assert.deepEqual([1, 3, 12].map(getMonthName), ['Januar', 'März', 'Dezember']);
  assert.equal(getMonthName(0), 'Ungültiger Monat');
});

test('calendar order and birthdays of a day', () => {
  assert.deepEqual(sortByDate(birthdays).map((b) => b.userId), ['b', 'd', 'c', 'a']);
  assert.deepEqual(birthdaysOn(birthdays, new Date('2026-03-15T06:00:00Z')), ['a']);
  assert.deepEqual(birthdaysOn(birthdays, new Date('2026-03-01T06:00:00Z')), ['c', 'd']);
  assert.deepEqual(birthdaysOn(birthdays, new Date('2028-03-01T06:00:00Z')), ['c']);
  assert.deepEqual(birthdaysOn(birthdays, new Date('2028-02-29T06:00:00Z')), ['d']);
});

test('upcoming birthdays count today as 0 and wrap into next year', () => {
  const upcoming = upcomingBirthdays(birthdays, new Date(2026, 2, 1, 18, 30)); // 1 March 2026, evening
  // 29 February outside a leap year falls on 1 March.
  assert.deepEqual(upcoming.map((b) => [b.userId, b.daysUntil]), [['c', 0], ['d', 0], ['a', 14], ['b', 307]]);
  assert.equal(upcomingBirthdays({ a: { month: 3, day: 2 } }, new Date(2026, 2, 1, 23, 59))[0].daysUntil, 1);
});
