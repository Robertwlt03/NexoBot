import test from 'node:test';
import assert from 'node:assert/strict';
import { PET_STAGE_CARE, daysBetween, nextStageAt, petCare, petStage } from '../src/shared/pets.js';
import { PET_CARE_START, legacyCare, petStates } from '../src/services/cosmetics/pets.js';

test('forms need more care days the higher and the rarer they are', () => {
  assert.deepEqual([0, 13, 14, 44, 45, 99, 100].map((care) => petStage(care, 'rare')), [1, 1, 2, 2, 3, 3, 4]);
  assert.deepEqual([29, 30, 200].map((care) => petStage(care, 'legendary')), [1, 2, 4]);
  assert.deepEqual([0, 14, 99, 100].map((care) => nextStageAt(care, 'rare')), [14, 45, 100, null]);
  for (const steps of Object.values(PET_STAGE_CARE)) {
    const gaps = steps.slice(1).map((from, i) => from - steps[i]);
    assert.ok(gaps.every((gap, i) => i === 0 || gap > gaps[i - 1]), `each form needs more days than the last: ${steps}`);
  }
});

test('a missed day makes the pet sad: it keeps its form but starts the way to the next one over', () => {
  assert.equal(daysBetween('2026-10-30', '2026-11-02'), 3);
  const today = '2026-11-10';
  const fed = petCare('p', 'rare', 30, today, today);
  assert.deepEqual([fed.fedToday, fed.hungry, fed.stage, fed.care], [true, false, 2, 30]);
  assert.deepEqual([petCare('p', 'rare', 30, '2026-11-09', today).hungry, petCare('p', 'rare', 30, '2026-11-09', today).care], [false, 30]);
  const sad = petCare('p', 'rare', 30, '2026-11-08', today);
  assert.deepEqual([sad.hungry, sad.stage, sad.care, sad.stageFrom, sad.nextAt], [true, 2, 14, 14, 45]);
});

test('pets from before care keep their old form and are not hungry from the start', () => {
  assert.deepEqual([legacyCare(3, 'rare'), legacyCare(7, 'rare'), legacyCare(30, 'epic')], [0, 14, 60]);
  const stats = new Map([['chat_days', 40], ['pet_care:pet-cat', 20], ['pet_fed:pet-cat', 20261103]]);
  const [old, fresh, cat] = petStates([
    { itemId: 'pet-fox', rarity: 'rare', acquired: '2026-05-01' },
    { itemId: 'pet-owl', rarity: 'rare', acquired: '2026-11-02' },
    { itemId: 'pet-cat', rarity: 'epic', acquired: '2026-06-01' },
  ], stats, '2026-11-03');
  assert.deepEqual([old.care, old.stage, old.lastFed], [45, 3, PET_CARE_START]);
  assert.deepEqual([fresh.care, fresh.stage, fresh.lastFed, fresh.hungry], [0, 1, '2026-11-02', false]);
  assert.deepEqual([cat.care, cat.stage, cat.fedToday], [20, 1, true]);
});
