function __puyotetAiWorkerMain() {
  'use strict';

  /* =========================================================================
     PUYOTET ARENA - Dedicated Web Worker for IMPOSSIBLE AI (Fair / No Cheat)
     - Tetris: 4-Ply Beam Search (Current + NEXT1..3, Hold, SRS T-Spin, 3-Ply PC, Downstack)
     - Puyo:   3-Ply Wide Beam Search (Current + NEXT1..2, GTR, Chain Tail, Counter, Harass)
     ========================================================================= */

  const TETRIS_SHAPES = {
    I: [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]]],
    O: [[[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]]],
    T: [[[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]]],
    S: [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]], [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]]],
    Z: [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]]],
    J: [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]],
    L: [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]]
  };

  const SRS_JLSTZ = {
    '0>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '1>0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '1>2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '2>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '2>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '3>2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '3>0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '0>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]]
  };

  const PUYO_CHAIN_POWER = [0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
  const PUYO_COLOR_BONUS = [0, 0, 3, 6, 12, 24];
  const PUYO_GROUP_BONUS = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10];
  const CHILD_OFFSETS = [[0,-1],[1,0],[0,1],[-1,0]];

  /* ========================== TETRIS 4-PLY ENGINE ========================== */

  function simTetrisDropOnGrid(grid, type, x, rot) {
    const rows = 22, cols = 10;
    const cells = TETRIS_SHAPES[type][rot];
    const collides = (px, py) => {
      for (let i = 0; i < 4; i++) {
        const nx = px + cells[i][0], ny = py + cells[i][1];
        if (nx < 0 || nx >= cols || ny >= rows) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
      return false;
    };
    if (collides(x, 0)) return null;
    let y = 0;
    while (!collides(x, y + 1)) y++;
    const g = new Array(rows);
    for (let r = 0; r < rows; r++) g[r] = grid[r].slice();
    for (let i = 0; i < 4; i++) {
      const ny = y + cells[i][1], nx = x + cells[i][0];
      if (ny < 0 || ny >= rows) return null;
      g[ny][nx] = type;
    }
    let lines = 0;
    const kept = [];
    for (let r = 0; r < rows; r++) {
      let full = true;
      for (let c = 0; c < cols; c++) if (!g[r][c]) { full = false; break; }
      if (full) lines++;
      else kept.push(g[r]);
    }
    while (kept.length < rows) kept.unshift(Array(cols).fill(null));
    let filled = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (kept[r][c]) filled++;
    return { grid: kept, lines, filled, y };
  }

  function getTetrisGridStats(grid) {
    const rows = 22, cols = 10;
    const heights = new Int8Array(cols);
    let holes = 0, coveredCells = 0, shallowestHoleCover = 0, shallowestHoleRow = 99;
    for (let c = 0; c < cols; c++) {
      let topRow = -1;
      for (let r = 0; r < rows; r++) {
        if (grid[r][c]) {
          if (topRow === -1) { topRow = r; heights[c] = rows - r; }
        } else if (topRow !== -1) {
          holes++;
          const coverDepth = r - topRow;
          coveredCells += coverDepth;
          if (r < shallowestHoleRow) { shallowestHoleRow = r; shallowestHoleCover = coverDepth; }
        }
      }
    }
    let aggH = 0, maxH = 0, bump = 0;
    for (let c = 0; c < cols; c++) {
      aggH += heights[c];
      if (heights[c] > maxH) maxH = heights[c];
      if (c < cols - 1) bump += Math.abs(heights[c] - heights[c + 1]);
    }
    return { heights, holes, coveredCells, shallowestHoleCover, aggH, maxH, bump };
  }

  function countTSpinSlotsDetailed(grid) {
    let tsd = 0, tst = 0;
    for (let r = 8; r < 21; r++) {
      for (let c = 1; c < 9; c++) {
        if (!grid[r][c] && grid[r][c - 1] && grid[r][c + 1] &&
            !grid[r - 1][c] && !grid[r - 1][c - 1] && !grid[r - 1][c + 1]) {
          const roofL = r >= 2 && !!grid[r - 2][c - 1] && !grid[r - 2][c];
          const roofR = r >= 2 && !!grid[r - 2][c + 1] && !grid[r - 2][c];
          if (roofL !== roofR) tsd++;
        }
        if (r >= 4 && r <= 19 && !grid[r][c] && !grid[r - 1][c] && grid[r + 1][c]) {
          const leftWall = grid[r][c - 1] && grid[r - 1][c - 1];
          const rightWall = grid[r][c + 1] && grid[r - 1][c + 1];
          if (leftWall && !rightWall && c + 2 < 10 && grid[r - 2][c + 1] && !grid[r - 2][c]) tst++;
          else if (rightWall && !leftWall && c - 2 >= 0 && grid[r - 2][c - 1] && !grid[r - 2][c]) tst++;
        }
      }
    }
    return { tsd, tst, total: tsd + tst };
  }

  function evalTetrisOpeningBonus(tetrisMoves, type, x, rot, heights, maxH) {
    if (tetrisMoves >= 9 || maxH > 5) return 0;
    let bonus = 0;
    if (type === 'I' && rot === 0 && (x === 0 || x === 3)) bonus += 6.5;
    if (type === 'O' && (x === 0 || x === 7)) bonus += 4.5;
    if ((type === 'L' || type === 'J') && (x <= 2 || x >= 6)) bonus += 3.5;
    if ((type === 'S' || type === 'Z') && x >= 1 && x <= 6 && (rot === 0 || rot === 2)) bonus += 3.5;
    if (heights[9] === 0 && heights[8] >= 1) bonus += 2.0;
    return bonus;
  }

  function evalTetrisGridImp(grid, lines, pendingGarbage, isTSpin, type, x, rot, simState, oppCtx, tetrisMoves) {
    const st = getTetrisGridStats(grid);
    const { heights, holes, coveredCells, shallowestHoleCover, aggH, maxH, bump } = st;
    const isPerfect = lines > 0 && aggH === 0;
    const curB2B = simState.b2b;
    const curCombo = simState.combo;
    const prevMaxH = simState.baseMaxH;
    const prevHoles = simState.baseHoles;
    const prevTSlots = simState.baseTSlots;
    const downstackMode = (prevMaxH >= 12 || maxH >= 12 || pendingGarbage >= 5);
    const oppDanger = !!(oppCtx && oppCtx.oppDanger);

    let score = 0;
    if (isPerfect) score += 480;

    if (downstackMode) {
      if (isTSpin && lines >= 1) {
        score += lines === 3 ? 74 : (lines === 2 ? 54 : 26);
        if (curB2B) score += 14;
      } else if (lines === 4) {
        score += 44 + (curB2B ? 12 : 0);
      } else if (lines > 0) {
        score += lines * 15.0 + (curCombo >= 0 ? (8 + curCombo * 5.5) : 0);
        if (pendingGarbage >= 5) score += lines * 7.0;
      }
      if (holes < prevHoles) score += (prevHoles - holes) * 19.0;
      score -= shallowestHoleCover * 10.0 + holes * 15.5 + coveredCells * 0.68 + aggH * 0.72 + bump * 0.80;
      if (maxH >= 14) score -= (maxH - 13) * 8.8;
      return score;
    }

    if (isTSpin && lines >= 1) {
      score += lines === 3 ? 80 : (lines === 2 ? 56 : 25);
      if (curB2B) score += 19;
      if (curCombo >= 0) score += 6 + curCombo * 5.2;
      if (oppDanger) score += lines * 11;
    } else if (lines === 4) {
      score += 40 + (curB2B ? 16 : 0);
      if (curCombo >= 0) score += 6 + curCombo * 5.2;
      if (oppDanger) score += 19;
    } else if (lines > 0) {
      if (oppDanger) {
        score += lines * 14.0 + (curCombo >= 0 ? (10 + curCombo * 6.5) : 0);
      } else if (curCombo >= 1) {
        score += 12.5 + curCombo * 6.5;
      } else if (curCombo === 0 && lines >= 2) {
        score += 6.5;
      } else {
        score -= curB2B ? 15.0 : 4.5;
      }
    }

    if (maxH < 14) {
      const ts = countTSpinSlotsDetailed(grid);
      if (ts.total > 0) score += ts.tsd * 19.0 + ts.tst * 23.0;
      if (type !== 'T' && prevTSlots > 0 && ts.total < prevTSlots && lines === 0) score -= 17.0;
    }

    score += evalTetrisOpeningBonus(tetrisMoves, type, x, rot, heights, maxH);
    if (maxH < 12 && heights[9] === 0 && heights[8] >= 2) score += 3.8;
    if (maxH < 12 && heights[0] === 0 && heights[1] >= 2 && heights[9] > 0) score += 2.2;

    score -= holes * 12.5 + shallowestHoleCover * 2.4 + coveredCells * 0.26 + aggH * 0.44 + bump * 0.40;
    if (maxH >= 15) score -= (maxH - 14) * 6.8;
    return score;
  }

  function collectTSpinMovesOnGrid(grid, pendingGarbage, useHold, simState, oppCtx, tetrisMoves) {
    const results = [];
    const cols = 10;
    const collidesAt = (px, py, rot) => {
      const cells = TETRIS_SHAPES.T[rot];
      for (let i = 0; i < 4; i++) {
        const nx = px + cells[i][0], ny = py + cells[i][1];
        if (nx < 0 || nx >= cols || ny >= 22) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
      return false;
    };
    for (let fromRot = 0; fromRot < 4; fromRot++) {
      for (let x = -1; x < cols - 1; x++) {
        if (collidesAt(x, 0, fromRot)) continue;
        let y = 0;
        while (!collidesAt(x, y + 1, fromRot)) y++;
        for (const dir of [1, -1]) {
          const toRot = (fromRot + dir + 4) % 4;
          const kicks = SRS_JLSTZ[`${fromRot}>${toRot}`];
          for (const [kx, ky] of kicks) {
            const nx = x + kx, ny = y + ky;
            if (!collidesAt(nx, ny, toRot)) {
              const cx = nx + 1, cy = ny + 1;
              let blocked = 0;
              const corners = [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1]];
              for (let k = 0; k < 4; k++) {
                const tx = corners[k][0], ty = corners[k][1];
                if (tx < 0 || tx >= cols || ty >= 22 || (ty >= 0 && grid[ty][tx])) blocked++;
              }
              if (blocked >= 3) {
                const g = grid.map(r => r.slice());
                for (const [bx, by] of TETRIS_SHAPES.T[toRot]) if (ny + by >= 0 && ny + by < 22) g[ny + by][nx + bx] = 'T';
                let lines = 0;
                const kept = [];
                for (let r = 0; r < 22; r++) { if (g[r].every(c => c !== null)) lines++; else kept.push(g[r]); }
                while (kept.length < 22) kept.unshift(Array(10).fill(null));
                const sc = evalTetrisGridImp(kept, lines, pendingGarbage, true, 'T', nx, toRot, simState, oppCtx, tetrisMoves);
                results.push({
                  x: nx, y: ny, rot: toRot, score: sc, useHold,
                  tspinDir: useHold ? 0 : dir, preX: x, preRot: fromRot, stepPhase: 'align',
                  grid: kept, lines, isTSpin: true
                });
              }
              break;
            }
          }
        }
      }
    }
    return results;
  }

  function find3PlyPerfectClear(b, candidates) {
    const quickBad = (grid, maxAllowedH) => {
      for (let c = 0; c < 10; c++) {
        let seen = false;
        for (let r = 0; r < 22; r++) {
          if (grid[r][c]) {
            if (!seen) { if (22 - r > maxAllowedH) return true; seen = true; }
          } else if (seen) return true;
        }
      }
      return false;
    };
    for (const cand of candidates) {
      const type1 = cand.type;
      const next1 = cand.useHold ? (b.hold ? b.queue[0] : b.queue[1]) : b.queue[0];
      const next2 = cand.useHold ? (b.hold ? b.queue[1] : b.queue[2]) : b.queue[1];
      for (let r1 = 0; r1 < 4; r1++) {
        for (let x1 = -2; x1 < 10; x1++) {
          const s1 = simTetrisDropOnGrid(b.grid, type1, x1, r1);
          if (!s1) continue;
          if (s1.filled === 0) return { x: x1, y: s1.y, rot: r1, score: 540, useHold: cand.useHold, tspinDir: 0 };
          if (!next1 || s1.filled > 24) continue;
          const can2 = ((s1.filled + 4) % 10 === 0);
          const can3 = (next2 && ((s1.filled + 8) % 10 === 0) && !quickBad(s1.grid, 4));
          if (!can2 && !can3) continue;
          for (let r2 = 0; r2 < 4; r2++) {
            for (let x2 = -2; x2 < 10; x2++) {
              const s2 = simTetrisDropOnGrid(s1.grid, next1, x2, r2);
              if (!s2) continue;
              if (s2.filled === 0) return { x: x1, y: s1.y, rot: r1, score: 480, useHold: cand.useHold, tspinDir: 0 };
              if (!can3 || (s2.filled + 4) % 10 !== 0 || s2.filled > 16 || quickBad(s2.grid, 4)) continue;
              for (let r3 = 0; r3 < 4; r3++) {
                for (let x3 = -2; x3 < 10; x3++) {
                  const s3 = simTetrisDropOnGrid(s2.grid, next2, x3, r3);
                  if (s3 && s3.filled === 0) return { x: x1, y: s1.y, rot: r1, score: 420, useHold: cand.useHold, tspinDir: 0 };
                }
              }
            }
          }
        }
      }
    }
    return null;
  }

  function planTetrisImpossible4Ply(b, oppCtx, tetrisMoves) {
    const candidates = [{ type: b.current.type, useHold: false }];
    if (b.canHold) {
      const holdType = b.hold || b.queue[0];
      if (holdType && holdType !== b.current.type) candidates.push({ type: holdType, useHold: true });
    }

    let filled = 0;
    for (let r = 0; r < 22; r++) for (let c = 0; c < 10; c++) if (b.grid[r][c]) filled++;
    if (filled <= 16) {
      const pc3 = find3PlyPerfectClear(b, candidates);
      if (pc3) return pc3;
    }

    const baseStats = getTetrisGridStats(b.grid);
    const baseTSlots = countTSpinSlotsDetailed(b.grid).total;
    const baseSimState = {
      b2b: b.b2b, combo: b.combo,
      baseMaxH: baseStats.maxH, baseHoles: baseStats.holes, baseTSlots
    };

    const ply1List = [];
    for (const cand of candidates) {
      const type = cand.type;
      const holdSaveTBonus = (cand.useHold && b.current.type === 'T' && !b.hold && baseTSlots === 0 && baseStats.maxH < 12) ? 7.0 : 0;
      for (let rot = 0; rot < 4; rot++) {
        for (let x = -2; x < 10; x++) {
          const sim = simTetrisDropOnGrid(b.grid, type, x, rot);
          if (!sim) continue;
          const sc = evalTetrisGridImp(sim.grid, sim.lines, b.pendingGarbage, false, type, x, rot, baseSimState, oppCtx, tetrisMoves) + holdSaveTBonus;
          ply1List.push({ x, y: sim.y, rot, score: sc, useHold: cand.useHold, tspinDir: 0, grid: sim.grid, lines: sim.lines, isTSpin: false });
        }
      }
      if (type === 'T') {
        const tspins = collectTSpinMovesOnGrid(b.grid, b.pendingGarbage, cand.useHold, baseSimState, oppCtx, tetrisMoves);
        for (const ts of tspins) ply1List.push(ts);
      }
    }

    if (ply1List.length === 0) return { x: b.current.x, y: 0, rot: 0, score: 0, useHold: false, tspinDir: 0 };
    ply1List.sort((a, z) => z.score - a.score);
    if (ply1List[0].score >= 380) return stripGrid(ply1List[0]);

    const nextStateFrom = (prev, lines, isTSpin, grid) => {
      const st = getTetrisGridStats(grid);
      return {
        b2b: lines === 0 ? prev.b2b : (lines === 4 || isTSpin),
        combo: lines > 0 ? (prev.combo + 1) : -1,
        baseMaxH: st.maxH, baseHoles: st.holes,
        baseTSlots: st.maxH < 14 ? countTSpinSlotsDetailed(grid).total : 0
      };
    };

    const expandPly = (grid, pieceType, st, moves) => {
      const list = [];
      for (let r = 0; r < 4; r++) {
        for (let x = -2; x < 10; x++) {
          const s = simTetrisDropOnGrid(grid, pieceType, x, r);
          if (!s) continue;
          const sc = evalTetrisGridImp(s.grid, s.lines, b.pendingGarbage, false, pieceType, x, r, st, oppCtx, moves);
          list.push({ score: sc, grid: s.grid, lines: s.lines, isTSpin: false });
        }
      }
      if (pieceType === 'T' && st.baseTSlots > 0) {
        const ts = collectTSpinMovesOnGrid(grid, b.pendingGarbage, false, st, oppCtx, moves);
        for (const t of ts) list.push({ score: t.score, grid: t.grid, lines: t.lines, isTSpin: true });
      }
      list.sort((a, z) => z.score - a.score);
      return list;
    };

    // 4-Ply Beam Search: Ply1(8) -> Ply2(4) -> Ply3(3) -> Ply4(Best)
    const beam1 = ply1List.slice(0, 8);
    let best = beam1[0], bestTotal = -1e9;

    for (const c1 of beam1) {
      const qOff = (c1.useHold && !b.hold) ? 1 : 0;
      const next1 = b.queue[qOff], next2 = b.queue[qOff + 1], next3 = b.queue[qOff + 2];
      if (!next1) { if (c1.score > bestTotal) { bestTotal = c1.score; best = c1; } continue; }

      const st1 = nextStateFrom(baseSimState, c1.lines, c1.isTSpin, c1.grid);
      const beam2 = expandPly(c1.grid, next1, st1, tetrisMoves + 1).slice(0, 4);
      if (beam2.length === 0) { if (c1.score > bestTotal) { bestTotal = c1.score; best = c1; } continue; }

      let best234 = -1e9;
      for (const c2 of beam2) {
        if (!next2) { if (c2.score > best234) best234 = c2.score; continue; }
        const st2 = nextStateFrom(st1, c2.lines, c2.isTSpin, c2.grid);
        const beam3 = expandPly(c2.grid, next2, st2, tetrisMoves + 2).slice(0, 3);
        if (beam3.length === 0) { if (c2.score > best234) best234 = c2.score; continue; }

        let best34 = -1e9;
        for (const c3 of beam3) {
          if (!next3) { if (c3.score > best34) best34 = c3.score; continue; }
          const st3 = nextStateFrom(st2, c3.lines, c3.isTSpin, c3.grid);
          let best4 = -1e9;
          for (let r4 = 0; r4 < 4; r4++) {
            for (let x4 = -2; x4 < 10; x4++) {
              const s4 = simTetrisDropOnGrid(c3.grid, next3, x4, r4);
              if (!s4) continue;
              const sc4 = evalTetrisGridImp(s4.grid, s4.lines, b.pendingGarbage, false, next3, x4, r4, st3, oppCtx, tetrisMoves + 3);
              if (sc4 > best4) best4 = sc4;
            }
          }
          const comb34 = best4 > -1e8 ? (c3.score * 0.45 + best4 * 0.55) : c3.score;
          if (comb34 > best34) best34 = comb34;
        }
        const comb234 = best34 > -1e8 ? (c2.score * 0.40 + best34 * 0.60) : c2.score;
        if (comb234 > best234) best234 = comb234;
      }

      const total = best234 > -1e8 ? (c1.score * 0.25 + best234 * 0.75) : c1.score;
      if (total > bestTotal) { bestTotal = total; best = c1; }
    }
    return stripGrid(best);
  }

  function stripGrid(plan) {
    return {
      x: plan.x, y: plan.y, rot: plan.rot, score: plan.score,
      useHold: !!plan.useHold, tspinDir: plan.tspinDir || 0,
      preX: plan.preX, preRot: plan.preRot, stepPhase: plan.stepPhase
    };
  }

  /* ========================== PUYO 3-PLY WIDE BEAM ========================== */

  function clonePuyoGrid(grid) {
    const g = new Array(13);
    for (let r = 0; r < 13; r++) g[r] = grid[r].slice();
    return g;
  }

  function simPuyoSettleAndChain(grid) {
    const cols = 6, rows = 13;
    const applyGrav = () => {
      for (let c = 0; c < cols; c++) {
        let w = rows - 1;
        for (let r = rows - 1; r >= 0; r--) {
          if (grid[r][c] !== 0) {
            if (w !== r) { grid[w][c] = grid[r][c]; grid[r][c] = 0; }
            w--;
          }
        }
      }
    };
    applyGrav();
    let chain = 0, totalOjamas = 0, totalCleared = 0;
    while (true) {
      const vis = Array.from({ length: rows }, () => new Uint8Array(cols));
      const groups = [];
      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const col = grid[r][c];
          if (col >= 1 && col <= 5 && !vis[r][c]) {
            const st = [[c, r]], cells = [];
            vis[r][c] = 1;
            while (st.length) {
              const [cx, cy] = st.pop();
              cells.push([cx, cy]);
              if (cx > 0 && !vis[cy][cx - 1] && grid[cy][cx - 1] === col) { vis[cy][cx - 1] = 1; st.push([cx - 1, cy]); }
              if (cx < 5 && !vis[cy][cx + 1] && grid[cy][cx + 1] === col) { vis[cy][cx + 1] = 1; st.push([cx + 1, cy]); }
              if (cy > 1 && !vis[cy - 1][cx] && grid[cy - 1][cx] === col) { vis[cy - 1][cx] = 1; st.push([cx, cy - 1]); }
              if (cy < 12 && !vis[cy + 1][cx] && grid[cy + 1][cx] === col) { vis[cy + 1][cx] = 1; st.push([cx, cy + 1]); }
            }
            if (cells.length >= 4) groups.push({ col, cells });
          }
        }
      }
      if (groups.length === 0) break;
      chain++;
      const colors = new Set();
      let cleared = 0, gBonus = 0;
      for (const g of groups) {
        colors.add(g.col);
        cleared += g.cells.length;
        gBonus += PUYO_GROUP_BONUS[Math.min(PUYO_GROUP_BONUS.length - 1, g.cells.length)];
        for (const [cx, cy] of g.cells) {
          grid[cy][cx] = 0;
          if (cx > 0 && grid[cy][cx - 1] === 9) grid[cy][cx - 1] = 0;
          if (cx < 5 && grid[cy][cx + 1] === 9) grid[cy][cx + 1] = 0;
          if (cy > 0 && grid[cy - 1][cx] === 9) grid[cy - 1][cx] = 0;
          if (cy < 12 && grid[cy + 1][cx] === 9) grid[cy + 1][cx] = 0;
        }
      }
      totalCleared += cleared;
      const cp = PUYO_CHAIN_POWER[Math.min(PUYO_CHAIN_POWER.length - 1, chain)];
      const cb = PUYO_COLOR_BONUS[Math.min(PUYO_COLOR_BONUS.length - 1, colors.size)];
      totalOjamas += Math.floor((cleared * 10 * Math.max(1, cp + cb + gBonus)) / 70);
      applyGrav();
    }
    return { chain, totalOjamas, totalCleared, died: grid[1][2] !== 0 };
  }

  function simPuyoDrop(origGrid, x, rot, axis, child) {
    const [ox, oy] = CHILD_OFFSETS[rot];
    const x1 = x, x2 = x + ox;
    if (x1 < 0 || x1 >= 6 || x2 < 0 || x2 >= 6) return null;
    const g = clonePuyoGrid(origGrid);
    const colTop = (c) => { for (let r = 12; r >= 0; r--) if (g[r][c] === 0) return r; return -1; };
    let isChigiri = false;
    if (x1 === x2) {
      const rLow = colTop(x1);
      if (rLow < 1) return null;
      if (oy === -1) { g[rLow][x1] = axis; g[rLow - 1][x1] = child; }
      else { g[rLow][x1] = child; g[rLow - 1][x1] = axis; }
    } else {
      const r1 = colTop(x1), r2 = colTop(x2);
      if (r1 < 0 || r2 < 0) return null;
      if (r1 !== r2) isChigiri = true;
      g[r1][x1] = axis; g[r2][x2] = child;
    }
    const res = simPuyoSettleAndChain(g);
    res.grid = g;
    res.isChigiri = isChigiri;
    return res;
  }

  function probePotentialChainDetailed(grid, maxTriggers = 2) {
    let bestChain = 0, bestOjamas = 0, accessibleTrigger = false;
    const heights = new Int8Array(6);
    for (let c = 0; c < 6; c++) {
      let r = 12;
      while (r >= 1 && grid[r][c] !== 0) r--;
      heights[c] = r;
    }
    for (let c = 0; c < 6; c++) {
      const r = heights[c];
      if (r < 1) continue;
      const adjColors = new Set();
      if (r < 12 && grid[r + 1][c] >= 1 && grid[r + 1][c] <= 5) adjColors.add(grid[r + 1][c]);
      if (c > 0 && grid[r][c - 1] >= 1 && grid[r][c - 1] <= 5) adjColors.add(grid[r][c - 1]);
      if (c < 5 && grid[r][c + 1] >= 1 && grid[r][c + 1] <= 5) adjColors.add(grid[r][c + 1]);
      for (const col of adjColors) {
        const g1 = clonePuyoGrid(grid);
        g1[r][c] = col;
        const s1 = simPuyoSettleAndChain(g1);
        if (s1.chain > bestChain || (s1.chain === bestChain && s1.totalOjamas > bestOjamas)) {
          bestChain = s1.chain; bestOjamas = s1.totalOjamas; accessibleTrigger = (r >= 2);
        }
        if (maxTriggers >= 2 && s1.chain === 0 && r >= 2) {
          const g2 = clonePuyoGrid(grid);
          g2[r][c] = col; g2[r - 1][c] = col;
          const s2 = simPuyoSettleAndChain(g2);
          if (s2.chain > bestChain || (s2.chain === bestChain && s2.totalOjamas > bestOjamas)) {
            bestChain = s2.chain; bestOjamas = s2.totalOjamas; accessibleTrigger = (r >= 3);
          }
        }
      }
    }
    return { maxChain: bestChain, maxOjamas: bestOjamas, accessibleTrigger };
  }

  function scorePuyoBoardImp(sim, danger, curCount, pendingGarbage, triggerDepth, oppCtx, puyoMoves) {
    let sc = 0;
    const potInfo = probePotentialChainDetailed(sim.grid, triggerDepth);
    const pot = potInfo.maxChain;
    const oppVulnerable = !!(oppCtx && (oppCtx.oppDanger || oppCtx.oppHighStack));

    if (sim.isChigiri) sc -= 11.0;

    if (sim.chain > 0) {
      if (sim.chain >= 10) {
        sc += 1020 + sim.chain * 95 + sim.totalOjamas * 0.85;
      } else if (oppVulnerable && sim.chain >= 2 && sim.chain <= 4 && sim.totalOjamas >= 12 && pot >= 5) {
        sc += 580 + sim.totalOjamas * 3.8 + pot * 30;
      } else if (pendingGarbage >= 12) {
        if (sim.chain >= 2 && sim.chain <= 4 && sim.totalOjamas >= pendingGarbage * 0.75 && pot >= 5) {
          sc += 560 + pot * 34 + sim.totalOjamas * 2.0;
        } else if (sim.totalOjamas >= pendingGarbage * 0.70 || sim.chain >= 5) {
          sc += 480 + sim.chain * 50 + sim.totalOjamas * 1.5;
        } else if (pendingGarbage >= 24 && sim.chain >= 3) {
          sc += 290 + sim.chain * 32;
        } else {
          sc -= 95;
        }
      } else if (danger && curCount >= 52 && sim.chain >= 4) {
        sc += 290 + sim.chain * 40;
      } else if (oppVulnerable && sim.chain >= 5 && sim.totalOjamas >= 30) {
        sc += 350 + sim.chain * 36;
      } else {
        sc -= (sim.chain <= 3 ? 230 : 125) - sim.chain * 10;
      }
    }

    sc += pot * 55 + (pot >= 7 ? (pot - 6) * 28 : 0) + (pot >= 10 ? (pot - 9) * 35 : 0);
    sc += Math.min(140, potInfo.maxOjamas * 0.38);
    if (pot >= 4 && potInfo.accessibleTrigger) sc += 26;
    else if (pot >= 5 && !potInfo.accessibleTrigger) sc -= 20;

    if (puyoMoves < 8 && curCount <= 18) {
      const g = sim.grid;
      if (g[12][0] && g[12][0] === g[12][1]) sc += 22;
      if (g[11][0] && g[10][1] && g[11][0] === g[10][1]) sc += 26;
      if (g[11][0] && g[12][0] && g[11][0] !== g[12][0]) sc += 12;
      if (g[11][1] && g[12][2] && g[11][1] === g[12][2]) sc += 15;
      if (g[12][3] && g[12][3] === g[11][3]) sc += 10;
      if (g[12][4] && g[12][4] === g[11][4]) sc += 10;
      if (g[12][5] && g[12][5] === g[11][5]) sc += 9;
      if (g[12][2] === 0) sc += 6;
    }

    const vis = Array.from({ length: 13 }, () => new Uint8Array(6));
    let pairs = 0, triples = 0;
    for (let r = 1; r < 13; r++) {
      for (let c = 0; c < 6; c++) {
        const col = sim.grid[r][c];
        if (col >= 1 && col <= 5 && !vis[r][c]) {
          const st = [[c, r]]; vis[r][c] = 1;
          let sz = 0;
          while (st.length) {
            const [cx, cy] = st.pop(); sz++;
              if (cx > 0 && !vis[cy][cx - 1] && sim.grid[cy][cx - 1] === col) { vis[cy][cx - 1] = 1; st.push([cx - 1, cy]); }
              if (cx < 5 && !vis[cy][cx + 1] && sim.grid[cy][cx + 1] === col) { vis[cy][cx + 1] = 1; st.push([cx + 1, cy]); }
              if (cy > 1 && !vis[cy - 1][cx] && sim.grid[cy - 1][cx] === col) { vis[cy - 1][cx] = 1; st.push([cx, cy - 1]); }
              if (cy < 12 && !vis[cy + 1][cx] && sim.grid[cy + 1][cx] === col) { vis[cy + 1][cx] = 1; st.push([cx, cy + 1]); }
            }
            if (sz === 2) pairs++;
            else if (sz === 3) triples++;
          }
        }
      }
    sc += pairs * 6.8 + triples * 17.5;

    const colH = [0, 0, 0, 0, 0, 0];
    for (let c = 0; c < 6; c++) {
      for (let r = 1; r < 13; r++) if (sim.grid[r][c] !== 0) { colH[c] = 13 - r; break; }
    }
    if (sim.grid[12][0] && sim.grid[12][0] === sim.grid[12][1]) sc += 12;
    if (sim.grid[11][0] && sim.grid[10][1] && sim.grid[11][0] === sim.grid[10][1]) sc += 14;
    if (sim.grid[11][1] && sim.grid[12][2] && sim.grid[11][1] === sim.grid[12][2]) sc += 9;
    sc -= Math.max(0, colH[2] - 5) * 18;
    if (colH[2] >= 9) sc -= (colH[2] - 8) * 36;
    for (let c = 2; c < 5; c++) {
      const diff = Math.abs(colH[c] - colH[c + 1]);
      if (diff >= 4) sc -= (diff - 3) * 6.5;
    }
    for (let c = 0; c < 6; c++) if (colH[c] >= 11) sc -= 38;
    return sc;
  }

  function pairCollidesOnGrid(grid, x, y, rot) {
    const [ox, oy] = CHILD_OFFSETS[rot];
    const x2 = x + ox, y2 = y + oy;
    if (x < 0 || x >= 6 || x2 < 0 || x2 >= 6 || y < 0 || y >= 13 || y2 < 0 || y2 >= 13) return true;
    return grid[y][x] !== 0 || grid[y2][x2] !== 0;
  }

  function planPuyoImpossible3PlyWide(b, oppCtx, puyoMoves) {
    let best = { x: 2, rot: 0, score: -1e9 };
    let curCount = 0;
    for (let r = 1; r < 13; r++) for (let c = 0; c < 6; c++) if (b.grid[r][c] !== 0) curCount++;
    const danger = b.pendingGarbage >= 12 || curCount >= 42;

    const ply1List = [];
    for (let rot = 0; rot < 4; rot++) {
      for (let x = 0; x < 6; x++) {
        if (pairCollidesOnGrid(b.grid, x, 1, rot)) continue;
        const sim = simPuyoDrop(b.grid, x, rot, b.current.axis, b.current.child);
        if (!sim || sim.died) continue;
        const sc = scorePuyoBoardImp(sim, danger, curCount, b.pendingGarbage, 2, oppCtx, puyoMoves);
        ply1List.push({ x, rot, score: sc, sim });
      }
    }

    if (ply1List.length === 0) return best;
    ply1List.sort((a, z) => z.score - a.score);

    const next1 = b.queue && b.queue[0];
    const next2 = b.queue && b.queue[1];
    if (!next1 || ply1List[0].score >= 720) {
      return { x: ply1List[0].x, rot: ply1List[0].rot, score: ply1List[0].score };
    }

    // 3-Ply Wide Beam Search: Ply1(10) -> Ply2(5) -> Ply3(Best)
    const beam1 = ply1List.slice(0, 10);
    for (const c1 of beam1) {
      if (c1.sim.chain >= 4 && danger) {
        if (c1.score > best.score) best = { x: c1.x, rot: c1.rot, score: c1.score };
        continue;
      }
      const ply2List = [];
      for (let r2 = 0; r2 < 4; r2++) {
        for (let x2 = 0; x2 < 6; x2++) {
          const sim2 = simPuyoDrop(c1.sim.grid, x2, r2, next1[0], next1[1]);
          if (!sim2 || sim2.died) continue;
          const sc2 = scorePuyoBoardImp(sim2, danger, curCount + 2, b.pendingGarbage, 1, oppCtx, puyoMoves + 1);
          ply2List.push({ score: sc2, sim: sim2 });
        }
      }
      if (ply2List.length === 0) {
        if (c1.score > best.score) best = { x: c1.x, rot: c1.rot, score: c1.score };
        continue;
      }
      ply2List.sort((a, z) => z.score - a.score);
      const beam2 = ply2List.slice(0, 5);

      let best23 = -1e9;
      for (const c2 of beam2) {
        if (!next2 || c2.score >= 720) {
          if (c2.score > best23) best23 = c2.score;
          continue;
        }
        let best3 = -1e9;
        for (let r3 = 0; r3 < 4; r3++) {
          for (let x3 = 0; x3 < 6; x3++) {
            const sim3 = simPuyoDrop(c2.sim.grid, x3, r3, next2[0], next2[1]);
            if (!sim3 || sim3.died) continue;
            const sc3 = scorePuyoBoardImp(sim3, danger, curCount + 4, b.pendingGarbage, 1, oppCtx, puyoMoves + 2);
            if (sc3 > best3) best3 = sc3;
          }
        }
        const comb23 = best3 > -1e8 ? (c2.score * 0.44 + best3 * 0.56) : c2.score;
        if (comb23 > best23) best23 = comb23;
      }

      const total = best23 > -1e8 ? (c1.score * 0.26 + best23 * 0.74) : c1.score;
      if (total > best.score) {
        best = { x: c1.x, rot: c1.rot, score: total };
      }
    }
    return best;
  }

  self.onmessage = function (ev) {
    const msg = ev.data;
    if (!msg || !msg.id) return;
    try {
      let plan = null;
      if (msg.type === 'planTetris') {
        plan = planTetrisImpossible4Ply(msg.board, msg.oppCtx || null, msg.moves || 0);
      } else if (msg.type === 'planPuyo') {
        plan = planPuyoImpossible3PlyWide(msg.board, msg.oppCtx || null, msg.moves || 0);
      }
      self.postMessage({ id: msg.id, plan });
    } catch (err) {
      self.postMessage({ id: msg.id, plan: null, error: String(err && err.message ? err.message : err) });
    }
  };
}

if (typeof window !== 'undefined') {
  window.__PUYOTET_AI_WORKER_FN = __puyotetAiWorkerMain;
} else {
  __puyotetAiWorkerMain();
}
