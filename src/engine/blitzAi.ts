import { AIDifficulty } from "../types/game";

export type BlitzCell = "X" | "O" | "BLOCKED" | null;

export interface BlitzWinResult {
  winner: "X" | "O" | "draw" | null;
  line: number[];
}

export function generateWinLines(size: number, winLength: number): number[][] {
  const lines: number[][] = [];
  const dirs = [
    [1, 0],  // horizontal
    [0, 1],  // vertical
    [1, 1],  // diag down-right
    [1, -1], // diag up-right
  ];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dc, dr] of dirs) {
        const endC = c + dc * (winLength - 1);
        const endR = r + dr * (winLength - 1);
        if (endC >= 0 && endC < size && endR >= 0 && endR < size) {
          const line: number[] = [];
          for (let k = 0; k < winLength; k++) {
            line.push((r + dr * k) * size + (c + dc * k));
          }
          lines.push(line);
        }
      }
    }
  }
  return lines;
}

export function checkBlitzWinner(
  board: BlitzCell[],
  size: number,
  winLength: number,
  precomputedLines?: number[][]
): BlitzWinResult {
  const lines = precomputedLines ?? generateWinLines(size, winLength);
  for (const line of lines) {
    const first = board[line[0]];
    if (first !== "X" && first !== "O") continue;
    let allSame = true;
    for (let i = 1; i < line.length; i++) {
      if (board[line[i]] !== first) {
        allSame = false;
        break;
      }
    }
    if (allSame) {
      return { winner: first, line };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", line: [] };
  }
  return { winner: null, line: [] };
}

function simulateDecayMove(
  board: BlitzCell[],
  queue: number[],
  idx: number,
  mark: "X" | "O",
  maxMarks: number | null
): { nextBoard: BlitzCell[]; nextQueue: number[] } {
  const nextBoard = [...board];
  const nextQueue = [...queue];
  if (maxMarks !== null && nextQueue.length >= maxMarks) {
    const oldest = nextQueue.shift()!;
    nextBoard[oldest] = null;
  }
  nextBoard[idx] = mark;
  nextQueue.push(idx);
  return { nextBoard, nextQueue };
}

function findWinningMove(
  board: BlitzCell[],
  mark: "X" | "O",
  lines: number[][],
  markQueue: number[],
  maxMarks: number | null
): number | null {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    const { nextBoard } = simulateDecayMove(board, markQueue, i, mark, maxMarks);
    for (const line of lines) {
      if (line.every((cellIdx) => nextBoard[cellIdx] === mark)) {
        return i;
      }
    }
  }
  return null;
}

function evaluateBoardHeuristic(
  board: BlitzCell[],
  aiMark: "X" | "O",
  humanMark: "X" | "O",
  size: number,
  lines: number[][]
): number {
  let score = 0;
  for (const line of lines) {
    let aiCount = 0;
    let humanCount = 0;
    let blocked = false;
    for (const idx of line) {
      if (board[idx] === "BLOCKED") {
        blocked = true;
        break;
      }
      if (board[idx] === aiMark) aiCount++;
      else if (board[idx] === humanMark) humanCount++;
    }
    if (blocked || (aiCount > 0 && humanCount > 0)) continue;
    if (aiCount > 0) score += Math.pow(4, aiCount);
    else if (humanCount > 0) score -= Math.pow(4.3, humanCount);
  }

  const center = (size - 1) / 2;
  for (let idx = 0; idx < board.length; idx++) {
    if (board[idx] !== aiMark && board[idx] !== humanMark) continue;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const dist = Math.abs(r - center) + Math.abs(c - center);
    const bonus = Math.max(0, size - dist) * 0.5;
    score += board[idx] === aiMark ? bonus : -bonus;
  }
  return score;
}

function minimax3x3(
  board: BlitzCell[],
  depth: number,
  isMax: boolean,
  aiMark: "X" | "O",
  humanMark: "X" | "O",
  lines: number[][]
): number {
  const res = checkBlitzWinner(board, 3, 3, lines);
  if (res.winner === aiMark) return 100 - depth;
  if (res.winner === humanMark) return depth - 100;
  if (res.winner === "draw") return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiMark;
        best = Math.max(best, minimax3x3(board, depth + 1, false, aiMark, humanMark, lines));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanMark;
        best = Math.min(best, minimax3x3(board, depth + 1, true, aiMark, humanMark, lines));
        board[i] = null;
      }
    }
    return best;
  }
}

export function chooseBlitzAIMove(
  board: BlitzCell[],
  size: 3 | 4 | 5,
  winLength: 3 | 4,
  aiMark: "X" | "O",
  difficulty: AIDifficulty,
  maxMarksPerPlayer: number | null = null,
  aiQueue: number[] = [],
  humanQueue: number[] = []
): number {
  const humanMark: "X" | "O" = aiMark === "X" ? "O" : "X";
  const lines = generateWinLines(size, winLength);
  const emptyIndices: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) emptyIndices.push(i);
  }
  if (emptyIndices.length === 0) return -1;

  // 1. Immediate win
  const winMove = findWinningMove(board, aiMark, lines, aiQueue, maxMarksPerPlayer);
  if (winMove !== null && (difficulty !== "rookie" || Math.random() < 0.7)) {
    return winMove;
  }

  // 2. Immediate block
  const blockMove = findWinningMove(board, humanMark, lines, humanQueue, maxMarksPerPlayer);
  if (blockMove !== null && (difficulty !== "rookie" || Math.random() < 0.55)) {
    return blockMove;
  }

  if (difficulty === "rookie" && Math.random() < 0.55) {
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  // 3. Exact minimax on standard 3x3 (non-decay, non-blocked)
  if (
    size === 3 &&
    maxMarksPerPlayer === null &&
    !board.includes("BLOCKED") &&
    (difficulty === "pro" || (difficulty === "tactical" && Math.random() < 0.75))
  ) {
    const copy = [...board];
    let bestScore = -Infinity;
    let bestMoves: number[] = [];
    for (const idx of emptyIndices) {
      copy[idx] = aiMark;
      const score = minimax3x3(copy, 0, false, aiMark, humanMark, lines);
      copy[idx] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [idx];
      } else if (score === bestScore) {
        bestMoves.push(idx);
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // 4. Heuristic + 2-ply lookahead for decay / blocked / 4x4 / 5x5
  let bestScore = -Infinity;
  let bestChoices: number[] = [];

  for (const idx of emptyIndices) {
    const { nextBoard } = simulateDecayMove(board, aiQueue, idx, aiMark, maxMarksPerPlayer);

    let threatCount = 0;
    for (const line of lines) {
      let aiC = 0;
      let oppC = 0;
      let blocked = false;
      for (const c of line) {
        if (nextBoard[c] === "BLOCKED") {
          blocked = true;
          break;
        }
        if (nextBoard[c] === aiMark) aiC++;
        else if (nextBoard[c] === humanMark) oppC++;
      }
      if (!blocked && oppC === 0 && aiC === winLength - 1) threatCount++;
    }

    let score = evaluateBoardHeuristic(nextBoard, aiMark, humanMark, size, lines);
    if (threatCount >= 2) score += 240;
    else if (threatCount === 1) score += 35;

    if (difficulty === "pro") {
      let worstReply = Infinity;
      for (const oppIdx of emptyIndices) {
        if (oppIdx === idx || nextBoard[oppIdx] !== null) continue;
        const { nextBoard: oppBoard } = simulateDecayMove(
          nextBoard,
          humanQueue,
          oppIdx,
          humanMark,
          maxMarksPerPlayer
        );
        const oppWin = checkBlitzWinner(oppBoard, size, winLength, lines);
        const replyEval =
          oppWin.winner === humanMark
            ? -500
            : evaluateBoardHeuristic(oppBoard, aiMark, humanMark, size, lines);
        worstReply = Math.min(worstReply, replyEval);
      }
      if (worstReply < Infinity) {
        score = score * 0.4 + worstReply * 0.6;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestChoices = [idx];
    } else if (Math.abs(score - bestScore) < 0.01) {
      bestChoices.push(idx);
    }
  }

  return bestChoices[Math.floor(Math.random() * bestChoices.length)];
}
