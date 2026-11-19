import type { AIDifficulty } from "../types/game.ts";

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

function countImmediateThreats(
  board: BlitzCell[],
  mark: "X" | "O",
  oppMark: "X" | "O",
  winLength: number,
  lines: number[][]
): { openWinThreats: number; openSetupThreats: number } {
  let openWinThreats = 0;
  let openSetupThreats = 0;
  for (const line of lines) {
    let mCount = 0;
    let oCount = 0;
    let blocked = false;
    for (const c of line) {
      if (board[c] === "BLOCKED") {
        blocked = true;
        break;
      }
      if (board[c] === mark) mCount++;
      else if (board[c] === oppMark) oCount++;
    }
    if (blocked || oCount > 0) continue;
    if (mCount === winLength - 1) openWinThreats++;
    else if (mCount === winLength - 2 && winLength >= 4) openSetupThreats++;
  }
  return { openWinThreats, openSetupThreats };
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
    if (aiCount > 0) score += Math.pow(4.2, aiCount);
    else if (humanCount > 0) score -= Math.pow(4.6, humanCount);
  }

  const center = (size - 1) / 2;
  for (let idx = 0; idx < board.length; idx++) {
    if (board[idx] !== aiMark && board[idx] !== humanMark) continue;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const dist = Math.abs(r - center) + Math.abs(c - center);
    const bonus = Math.max(0, size - dist) * 0.65;
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

function alphaBetaDecay3x3(
  board: BlitzCell[],
  aiQueue: number[],
  humanQueue: number[],
  depth: number,
  maxDepth: number,
  alpha: number,
  beta: number,
  isMax: boolean,
  aiMark: "X" | "O",
  humanMark: "X" | "O",
  lines: number[][],
  maxMarks: number
): number {
  const res = checkBlitzWinner(board, 3, 3, lines);
  if (res.winner === aiMark) return 200 - depth * 10;
  if (res.winner === humanMark) return depth * 10 - 200;
  if (depth >= maxDepth) {
    return evaluateBoardHeuristic(board, aiMark, humanMark, 3, lines);
  }

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      const { nextBoard, nextQueue } = simulateDecayMove(board, aiQueue, i, aiMark, maxMarks);
      const val = alphaBetaDecay3x3(
        nextBoard,
        nextQueue,
        humanQueue,
        depth + 1,
        maxDepth,
        alpha,
        beta,
        false,
        aiMark,
        humanMark,
        lines,
        maxMarks
      );
      best = Math.max(best, val);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      const { nextBoard, nextQueue } = simulateDecayMove(board, humanQueue, i, humanMark, maxMarks);
      const val = alphaBetaDecay3x3(
        nextBoard,
        aiQueue,
        nextQueue,
        depth + 1,
        maxDepth,
        alpha,
        beta,
        true,
        aiMark,
        humanMark,
        lines,
        maxMarks
      );
      best = Math.min(best, val);
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
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
  if (winMove !== null && (difficulty !== "rookie" || Math.random() < 0.72)) {
    return winMove;
  }

  // 2. Immediate block
  const blockMove = findWinningMove(board, humanMark, lines, humanQueue, maxMarksPerPlayer);
  if (blockMove !== null && (difficulty !== "rookie" || Math.random() < 0.58)) {
    return blockMove;
  }

  if (difficulty === "rookie" && Math.random() < 0.5) {
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  // 3. Exact minimax on standard 3x3 (non-decay, non-blocked)
  if (
    size === 3 &&
    maxMarksPerPlayer === null &&
    !board.includes("BLOCKED") &&
    (difficulty === "pro" || (difficulty === "tactical" && Math.random() < 0.78))
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

  // 4. Deep alpha-beta search on 3x3 Decay mode
  if (size === 3 && maxMarksPerPlayer !== null && difficulty !== "rookie") {
    const maxDepth = difficulty === "pro" ? 5 : 3;
    let bestScore = -Infinity;
    let bestMoves: number[] = [];
    for (const idx of emptyIndices) {
      const { nextBoard, nextQueue } = simulateDecayMove(
        board,
        aiQueue,
        idx,
        aiMark,
        maxMarksPerPlayer
      );
      const score = alphaBetaDecay3x3(
        nextBoard,
        nextQueue,
        humanQueue,
        1,
        maxDepth,
        -Infinity,
        Infinity,
        false,
        aiMark,
        humanMark,
        lines,
        maxMarksPerPlayer
      );
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [idx];
      } else if (Math.abs(score - bestScore) < 0.01) {
        bestMoves.push(idx);
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // 5. Fork awareness + 2-ply lookahead for 4x4 / 5x5 / blocked grids
  let bestScore = -Infinity;
  let bestChoices: number[] = [];

  for (const idx of emptyIndices) {
    const { nextBoard } = simulateDecayMove(board, aiQueue, idx, aiMark, maxMarksPerPlayer);

    const aiThreats = countImmediateThreats(nextBoard, aiMark, humanMark, winLength, lines);
    let score = evaluateBoardHeuristic(nextBoard, aiMark, humanMark, size, lines);
    if (aiThreats.openWinThreats >= 2) score += 280;
    else if (aiThreats.openWinThreats === 1) score += 48;
    score += aiThreats.openSetupThreats * 14;

    if (difficulty === "pro" || difficulty === "tactical") {
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
        let replyEval: number;
        if (oppWin.winner === humanMark) {
          replyEval = -600;
        } else {
          const oppThreats = countImmediateThreats(oppBoard, humanMark, aiMark, winLength, lines);
          replyEval = evaluateBoardHeuristic(oppBoard, aiMark, humanMark, size, lines);
          if (oppThreats.openWinThreats >= 2) replyEval -= 260;
        }
        worstReply = Math.min(worstReply, replyEval);
      }
      if (worstReply < Infinity) {
        const w = difficulty === "pro" ? 0.62 : 0.4;
        score = score * (1 - w) + worstReply * w;
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
