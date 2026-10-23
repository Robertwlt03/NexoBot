// Board logic of the button games (/fun spiel): Tic-Tac-Toe and Vier gewinnt. Pure, for tests.

export type Cell = 0 | 1 | 2; // empty, player 1, player 2

// ---------- Tic-Tac-Toe (3×3, index = row * 3 + column) ----------

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

/** 1 or 2 for a winner, 'draw' for a full board, null while the game runs. */
export function ticTacToeResult(board: Cell[]): 1 | 2 | 'draw' | null {
  for (const [a, b, c] of LINES) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a] as 1 | 2;
  return board.every(Boolean) ? 'draw' : null;
}

// ---------- Vier gewinnt (7 columns × 6 rows, row 0 at the top) ----------

export const C4_COLUMNS = 7;
export const C4_ROWS = 6;

export const emptyConnectFour = (): Cell[][] => Array.from({ length: C4_ROWS }, () => Array<Cell>(C4_COLUMNS).fill(0));

/** Drops a disc into `column`; returns the row it landed in, or -1 when the column is full. */
export function dropDisc(board: Cell[][], column: number, player: 1 | 2): number {
  for (let row = C4_ROWS - 1; row >= 0; row -= 1) {
    if (board[row][column] === 0) {
      board[row][column] = player;
      return row;
    }
  }
  return -1;
}

export function connectFourResult(board: Cell[][]): 1 | 2 | 'draw' | null {
  const at = (r: number, c: number) => (r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLUMNS ? board[r][c] : 0);
  for (let r = 0; r < C4_ROWS; r += 1) {
    for (let c = 0; c < C4_COLUMNS; c += 1) {
      const p = board[r][c];
      if (!p) continue;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        if (at(r + dr, c + dc) === p && at(r + 2 * dr, c + 2 * dc) === p && at(r + 3 * dr, c + 3 * dc) === p) return p as 1 | 2;
      }
    }
  }
  return board[0].every(Boolean) ? 'draw' : null;
}

const DISCS = ['⚫', '🔴', '🟡'];
export const renderConnectFour = (board: Cell[][]) => `${board.map((row) => row.map((cell) => DISCS[cell]).join('')).join('\n')}\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣`;
export const DISC = { 1: DISCS[1], 2: DISCS[2] } as const;
