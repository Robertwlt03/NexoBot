// Button games: win detection for Tic-Tac-Toe and Vier gewinnt, quiz picks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C4_ROWS, connectFourResult, dropDisc, emptyConnectFour, ticTacToeResult, type Cell } from '../src/services/games/boards.js';
import { QUIZ, pickQuestions } from '../src/services/games/quiz.js';

test('tic-tac-toe finds rows, columns, diagonals and draws', () => {
  assert.equal(ticTacToeResult([1, 1, 1, 0, 2, 2, 0, 0, 0]), 1);
  assert.equal(ticTacToeResult([2, 1, 0, 2, 1, 0, 2, 0, 1]), 2);
  assert.equal(ticTacToeResult([1, 2, 0, 2, 1, 0, 0, 0, 1]), 1);
  assert.equal(ticTacToeResult([1, 2, 1, 1, 2, 2, 2, 1, 1] as Cell[]), 'draw');
  assert.equal(ticTacToeResult([1, 0, 0, 0, 0, 0, 0, 0, 0]), null);
});

test('vier gewinnt stacks discs and finds four in a row', () => {
  const board = emptyConnectFour();
  assert.equal(dropDisc(board, 3, 1), C4_ROWS - 1);
  assert.equal(dropDisc(board, 3, 2), C4_ROWS - 2);
  for (const c of [0, 1, 2]) dropDisc(board, c, 1);
  assert.equal(connectFourResult(board), 1, 'horizontal');
  const diagonal = emptyConnectFour();
  [[0], [1, 1], [2, 2, 2], [3, 3, 3, 3]].forEach((col, c) => col.forEach((_, i) => dropDisc(diagonal, c, i === col.length - 1 ? 2 : 1)));
  assert.equal(connectFourResult(diagonal), 2, 'diagonal');
  const full = emptyConnectFour();
  for (let i = 0; i < C4_ROWS; i += 1) dropDisc(full, 0, 1);
  assert.equal(dropDisc(full, 0, 2), -1, 'full column');
});

test('quiz picks distinct questions and keeps the right answer findable', () => {
  const picked = pickQuestions(5);
  assert.equal(new Set(picked.map((p) => p.q)).size, 5);
  for (const p of picked) assert.equal(p.answers[p.correct], QUIZ.find((q) => q.q === p.q)!.a[0]);
  assert.ok(QUIZ.every((q) => new Set(q.a).size === 4 && q.a.every((a) => a.length <= 80)), 'duplicate or too long answer');
});
