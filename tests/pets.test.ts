import test from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, nextStageAt, petCare, petStage } from '../src/shared/pets.js';
import { PET_CARE_START, legacyCare, petStates } from '../src/services/cosmetics/pets.js';

test('stages follow the care days: 0, 5, 15 and 40', () => {
  assert.deepEqual([0, 4, 5, 14, 15, 39, 40, 400].map(petStage), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([0, 5, 39, 40].map(nextStageAt), [5, 15, 40, null]);
});

test('a pet is hungry after two days without food and can eat once a day', () => {
  assert.equal(daysBetween('2026-10-30', '2026-11-02'), 3);
  const today = '2026-11-10';
  assert.deepEqual([petCare('p', 3, today, today).fedToday, petCare('p', 3, today, today).hungry], [true, false]);
  assert.deepEqual([petCare('p', 3, '2026-11-09', today).fedToday, petCare('p', 3, '2026-11-09', today).hungry], [false, false]);
  assert.equal(petCare('p', 3, '2026-11-08', today).hungry, true);
});

test('pets from before care keep their old stage and are not hungry from the start', () => {
  assert.deepEqual([legacyCare(3), legacyCare(7), legacyCare(30)], [0, 5, 15]);
  const stats = new Map([['chat_days', 40], ['pet_care:pet-cat', 7], ['pet_fed:pet-cat', 20261103]]);
  const [old, fresh, cat] = petStates([
    { itemId: 'pet-fox', acquired: '2026-05-01' },
    { itemId: 'pet-owl', acquired: '2026-11-02' },
    { itemId: 'pet-cat', acquired: '2026-06-01' },
  ], stats, '2026-11-03');
  assert.deepEqual([old.care, old.stage, old.lastFed], [15, 3, PET_CARE_START]);
  assert.deepEqual([fresh.care, fresh.stage, fresh.lastFed, fresh.hungry], [0, 1, '2026-11-02', false]);
  assert.deepEqual([cat.care, cat.stage, cat.fedToday], [7, 2, true]);
});
