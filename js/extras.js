'use strict';

/* =========================================================================
   EXTRAS.JS — CPU TOWER (10F), DAILY SEED, PUZZLE DOJO (20), LOGIN BONUS
   ========================================================================= */
(function () {
  // -------------------------------------------------------------------------
  // 1. CPU TOWER (10 FLOORS BOSS RUSH)
  // -------------------------------------------------------------------------
  const TOWER_FLOORS = [
    { floor: 1,  name: '1F 門番スライム',       diff: 'easy',       rule: 'vs',   ft: 1, oppSameStyle: true,  puyoColors: 4, selfAtk: 100, oppAtk: 100, coins: 40,  xp: 50  },
    { floor: 2,  name: '2F 見習い積み手',       diff: 'normal',     rule: 'vs',   ft: 1, oppSameStyle: true,  puyoColors: 4, selfAtk: 100, oppAtk: 100, coins: 55,  xp: 65  },
    { floor: 3,  name: '3F 異種戦の騎士',       diff: 'normal',     rule: 'vs',   ft: 1, oppSameStyle: false, puyoColors: 4, selfAtk: 100, oppAtk: 100, coins: 70,  xp: 80  },
    { floor: 4,  name: '4F 五色の魔導師',       diff: 'hard',       rule: 'vs',   ft: 1, oppSameStyle: false, puyoColors: 5, selfAtk: 100, oppAtk: 100, coins: 85,  xp: 95  },
    { floor: 5,  name: '5F 中ボス・二刀流将軍', diff: 'hard',       rule: 'swap', ft: 1, oppSameStyle: true,  puyoColors: 4, selfAtk: 100, oppAtk: 100, coins: 110, xp: 120 },
    { floor: 6,  name: '6F 紫煙の連鎖使い',     diff: 'hard',       rule: 'vs',   ft: 1, oppSameStyle: true,  puyoColors: 5, selfAtk: 100, oppAtk: 100, coins: 120, xp: 130 },
    { floor: 7,  name: '7F 剛腕の破壊神',       diff: 'hard',       rule: 'vs',   ft: 1, oppSameStyle: true,  puyoColors: 4, selfAtk: 100, oppAtk: 125, coins: 140, xp: 150 },
    { floor: 8,  name: '8F 紅蓮のスワップ王',   diff: 'hard',       rule: 'swap', ft: 1, oppSameStyle: true,  puyoColors: 4, selfAtk: 100, oppAtk: 140, coins: 160, xp: 170 },
    { floor: 9,  name: '9F 漆黒の守護者',       diff: 'impossible', rule: 'vs',   ft: 1, oppSameStyle: false, puyoColors: 4, selfAtk: 100, oppAtk: 150, coins: 200, xp: 210 },
    { floor: 10, name: '10F 最終ボス・OMEGA AI',diff: 'impossible', rule: 'vs',   ft: 2, oppSameStyle: true,  puyoColors: 4, selfAtk: 100, oppAtk: 100, coins: 300, xp: 320 }
  ];

  const towerState = {
    active: false,
    floor: 1,
    style: 'tetris',
    startTimeMs: 0
  };

  function startTowerRun(style) {
    towerState.active = true;
    towerState.floor = 1;
    towerState.style = style === 'puyo' ? 'puyo' : 'tetris';
    towerState.startTimeMs = Date.now();
    launchTowerFloor(1);
  }

  function launchTowerFloor(floorNum) {
    const def = TOWER_FLOORS[floorNum - 1];
    if (!def) return;
    towerState.active = true;
    towerState.floor = floorNum;
    const mySt = towerState.style;
    const opSt = def.oppSameStyle ? mySt : (mySt === 'tetris' ? 'puyo' : 'tetris');
    const opts = {
      isOnline: false, isSolo: false, isCpu: true, isSpectate: false,
      towerFloor: floorNum,
      rule: def.rule, rated: false, targetWins: def.ft,
      puyoColors: def.puyoColors, selfAtk: def.selfAtk, oppAtk: def.oppAtk,
      selfStyle: mySt, oppStyle: opSt, cpuDiff: def.diff,
      selfInfo: { name: `${formatPrestigePrefix()}${profile.name}`, rating: profile.rating, title: profile.activeTitle, playerNo: profile.playerNo || null },
      oppInfo: { name: def.name, rating: DIFF_RATINGS[def.diff] || 1800, style: opSt, title: '' }
    };
    lastSoloOpts = opts;
    battle.setupMatch(opts);
    showVSMatchup(def.rule, false, mySt, opts.oppInfo, def.ft, false, opts.selfInfo, () => battle.startCountdown());
  }

  // -------------------------------------------------------------------------
  // 2. DAILY SEED (ROTATING DETERMINISTIC CHALLENGE)
  // -------------------------------------------------------------------------
  function getDailySeedInfo(dateStr = getTodayStr()) {
    const parts = dateStr.split('-').map(Number);
    const epochDay = Math.floor(Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1) / 86400000);
    const rot = ((epochDay % 3) + 3) % 3;
    if (rot === 0) {
      return { date: dateStr, kind: 'sprint40', style: 'tetris', label: '今日の40ライン（固定7-Bag）', scoreType: 'time' };
    }
    if (rot === 1) {
      return { date: dateStr, kind: 'ultra2m', style: 'tetris', label: '今日の2分間ウルトラ（固定7-Bag）', scoreType: 'score' };
    }
    return { date: dateStr, kind: 'daily_puyo2m', style: 'puyo', label: '今日のぷよ2分間スコアアタック（固定ツモ）', scoreType: 'score' };
  }

  function startDailySeed() {
    const info = getDailySeedInfo();
    const opts = {
      isOnline: false, isSolo: true, isCpu: false, isSpectate: false,
      soloSubType: info.kind,
      seedStr: `DAILY_${info.date}_${info.kind}`,
      isDailySeed: true,
      puyoColors: 4,
      rule: 'vs', rated: false, targetWins: 1,
      selfStyle: info.style, oppStyle: info.style,
      selfInfo: { name: `${formatPrestigePrefix()}${profile.name}`, rating: profile.rating, title: profile.activeTitle, playerNo: profile.playerNo || null }
    };
    lastSoloOpts = opts;
    battle.setupMatch(opts);
    battle.startCountdown();
  }

  // -------------------------------------------------------------------------
  // 3. PUZZLE DOJO (10 TETRIS + 10 PUYO = 20 SOLVABLE PUZZLES)
  // -------------------------------------------------------------------------
  function makeTetrisGrid(rowsFromBottom) {
    const grid = Array.from({ length: 22 }, () => Array(10).fill(null));
    const n = rowsFromBottom.length;
    for (let i = 0; i < n; i++) {
      const r = 22 - n + i;
      const line = rowsFromBottom[i];
      for (let c = 0; c < 10; c++) {
        const ch = line[c];
        grid[r][c] = (ch && ch !== '.') ? ch : null;
      }
    }
    return grid;
  }

  function makePuyoGrid(rowsFromBottom) {
    const grid = Array.from({ length: 13 }, () => Array(6).fill(0));
    const n = rowsFromBottom.length;
    for (let i = 0; i < n; i++) {
      const r = 13 - n + i;
      const line = rowsFromBottom[i];
      for (let c = 0; c < 6; c++) {
        const v = parseInt(line[c], 10);
        grid[r][c] = Number.isFinite(v) ? v : 0;
      }
    }
    return grid;
  }

  const PUZZLES = [
    // --- TETRIS 10 ---
    {
      id: 't1', type: 'tetris', title: 'T-01 基本のTETRIS', par: 1, coins: 40, xp: 50,
      goalText: '1手で4ライン同時消し（TETRIS）を決めろ！',
      hint: 'Iミノを縦に回転させて右端の隙間へハードドロップ！',
      queue: ['I'],
      grid: makeTetrisGrid([
        'JJJJJJJJJ.',
        'LLLLLLLLL.',
        'SSSSSSSSS.',
        'ZZZZZZZZZ.'
      ]),
      check: (st) => st.maxLinesInOne >= 4
    },
    {
      id: 't2', type: 'tetris', title: 'T-02 1手パーフェクトクリア', par: 1, coins: 40, xp: 50,
      goalText: '1手で盤面を全消し（Perfect Clear）せよ！',
      hint: 'Iミノを横のまま中央の4マスに落とそう。',
      queue: ['I'],
      grid: makeTetrisGrid([
        'GGG....GGG'
      ]),
      check: (st) => st.perfectClears >= 1
    },
    {
      id: 't3', type: 'tetris', title: 'T-03 はじめてのT-Spin Single', par: 1, coins: 50, xp: 60,
      goalText: '1手でT-Spinを決めろ！',
      hint: 'Tミノを凸の溝に落として回転入れしよう。',
      queue: ['T'],
      grid: makeTetrisGrid([
        'GGGGGG....',
        'GGGG...GGG',
        'GGGGG.GGGG'
      ]),
      check: (st) => st.tspins >= 1
    },
    {
      id: 't4', type: 'tetris', title: 'T-04 定番T-Spin Double', par: 1, coins: 55, xp: 65,
      goalText: '1手でT-Spin Double（2ライン）を決めろ！',
      hint: '屋根の下へTミノを差し込み、右または左回転でねじ込もう！',
      queue: ['T'],
      grid: makeTetrisGrid([
        'GGGGG.....',
        'GGGG...GGG',
        'GGGGG.GGGG'
      ]),
      check: (st) => st.tspinLines >= 2
    },
    {
      id: 't5', type: 'tetris', title: 'T-05 2手PC（O＋I）', par: 2, coins: 55, xp: 65,
      goalText: '2手でパーフェクトクリアを達成せよ！',
      hint: '左側にOミノ、右側にIミノを横向きで収めると2行が消える。',
      queue: ['O', 'I'],
      grid: makeTetrisGrid([
        'GG..GGGGGG',
        'GG......GG'
      ]),
      check: (st) => st.perfectClears >= 1
    },
    {
      id: 't6', type: 'tetris', title: 'T-06 2手PC（J＋L）', par: 2, coins: 60, xp: 70,
      goalText: '2手でパーフェクトクリアを達成せよ！',
      hint: '下2行の6マス空間をJとLのペアでぴったり埋めよう。',
      queue: ['J', 'L'],
      grid: makeTetrisGrid([
        'GG......GG',
        'GGGG..GGGG'
      ]),
      check: (st) => st.perfectClears >= 1
    },
    {
      id: 't7', type: 'tetris', title: 'T-07 180°回転入れTSD', par: 1, coins: 65, xp: 75,
      goalText: '1手でT-Spin Doubleを決めろ！',
      hint: 'Tミノを逆向き（180°回転）にして溝の上から落とし、回転で嵌め込もう。',
      queue: ['T'],
      grid: makeTetrisGrid([
        '.....GGGGG',
        'GGG...GGGG',
        'GGGG.GGGGG'
      ]),
      check: (st) => st.tspinLines >= 2
    },
    {
      id: 't8', type: 'tetris', title: 'T-08 B2Bテトリス連撃', par: 2, coins: 65, xp: 75,
      goalText: '2手で合計8ライン消去（連続TETRIS）を決めろ！',
      hint: 'Iミノを2本連続で右端の縦穴に叩き込もう！',
      queue: ['I', 'I'],
      grid: makeTetrisGrid([
        'JJJJJJJJJ.',
        'LLLLLLLLL.',
        'SSSSSSSSS.',
        'ZZZZZZZZZ.',
        'JJJJJJJJJ.',
        'LLLLLLLLL.',
        'SSSSSSSSS.',
        'ZZZZZZZZZ.'
      ]),
      check: (st) => st.totalLines >= 8
    },
    {
      id: 't9', type: 'tetris', title: 'T-09 TSDからの全消し', par: 2, coins: 75, xp: 85,
      goalText: '2手でT-Spinとパーフェクトクリアを両立せよ！',
      hint: '1手目でT-Spin Double、2手目のIミノで残りの1行を全消し！',
      queue: ['T', 'I'],
      grid: makeTetrisGrid([
        'GGGGG....G',
        'GGGG...GGG',
        'GGGGG.GGGG'
      ]),
      check: (st) => st.tspins >= 1 && st.perfectClears >= 1
    },
    {
      id: 't10', type: 'tetris', title: 'T-10 3連続RENフィニッシュ', par: 3, coins: 80, xp: 90,
      goalText: '3手連続でラインを消去（2 REN以上）せよ！',
      hint: '1手ずつ確実にラインを消してコンボを途切れさせないようにしよう。',
      queue: ['I', 'O', 'I'],
      grid: makeTetrisGrid([
        'GGG....GGG',
        'GGGG..GGGG',
        'GGGG..GGGG',
        'GGG....GGG'
      ]),
      check: (st) => st.maxCombo >= 2
    },

    // --- PUYO 10 ---
    {
      id: 'p1', type: 'puyo', title: 'P-01 基本の2連鎖（階段）', par: 1, coins: 40, xp: 50,
      goalText: '1手で2連鎖を発火せよ！',
      hint: '左端の赤3個の上に赤を落とすと、隣の青が落ちて2連鎖！',
      queue: [[1, 1]],
      grid: makePuyoGrid([
        '020000',
        '010000',
        '120000',
        '120000',
        '120000'
      ]),
      check: (st) => st.maxChain >= 2
    },
    {
      id: 'p2', type: 'puyo', title: 'P-02 3連鎖・階段積み', par: 1, coins: 45, xp: 55,
      goalText: '1手で3連鎖を発火せよ！',
      hint: '左端に赤を落として、赤→青→緑の階段連鎖を起動しよう！',
      queue: [[1, 1]],
      grid: makePuyoGrid([
        '023000',
        '012000',
        '123000',
        '123000',
        '123000'
      ]),
      check: (st) => st.maxChain >= 3
    },
    {
      id: 'p3', type: 'puyo', title: 'P-03 3連鎖・鍵積み', par: 1, coins: 50, xp: 60,
      goalText: '1手で3連鎖（鍵積み）を発火せよ！',
      hint: '左端の赤を消すと、上の青・緑が挟み込みで順番に消える！',
      queue: [[1, 1]],
      grid: makePuyoGrid([
        '023000',
        '023000',
        '012000',
        '123000',
        '123000'
      ]),
      check: (st) => st.maxChain >= 3
    },
    {
      id: 'p4', type: 'puyo', title: 'P-04 4連鎖・階段フィニッシュ', par: 1, coins: 55, xp: 65,
      goalText: '1手で4連鎖を発火せよ！',
      hint: '左端に赤を落として4色の美しい階段連鎖を決めよう。',
      queue: [[1, 1]],
      grid: makePuyoGrid([
        '023400',
        '012300',
        '123400',
        '123400',
        '123400'
      ]),
      check: (st) => st.maxChain >= 4
    },
    {
      id: 'p5', type: 'puyo', title: 'P-05 1手全消しパズル', par: 1, coins: 55, xp: 65,
      goalText: '1手で盤面のぷよをすべて消せ（全消し）！',
      hint: '赤と青をそれぞれ3個ずつの山にうまく分けて置こう。',
      queue: [[1, 2]],
      grid: makePuyoGrid([
        '001200',
        '001200',
        '001200'
      ]),
      check: (st) => st.allClears >= 1
    },
    {
      id: 'p6', type: 'puyo', title: 'P-06 2手で4連鎖構築＆発火', par: 2, coins: 60, xp: 70,
      goalText: '2手で4連鎖を完成・発火せよ！',
      hint: '1手目で4列目の緑の上に黄色を乗せ、2手目で左端から赤発火！',
      queue: [[4, 4], [1, 1]],
      grid: makePuyoGrid([
        '023000',
        '023000',
        '012300',
        '123400',
        '123400'
      ]),
      check: (st) => st.maxChain >= 4
    },
    {
      id: 'p7', type: 'puyo', title: 'P-07 5連鎖・折り返し発火', par: 1, coins: 65, xp: 75,
      goalText: '1手で5連鎖を発火せよ！',
      hint: '左端の赤を発火点にして、右端まで駆け抜ける5連鎖を決めよう！',
      queue: [[1, 1]],
      grid: makePuyoGrid([
        '023410',
        '012340',
        '123410',
        '123410',
        '123410'
      ]),
      check: (st) => st.maxChain >= 5
    },
    {
      id: 'p8', type: 'puyo', title: 'P-08 2手で5連鎖完成', par: 2, coins: 70, xp: 80,
      goalText: '2手で5連鎖を完成させて発火せよ！',
      hint: '1手目で5列目の黄の上に青を乗せて5連鎖目を繋ぎ、2手目で左端の赤を発火！',
      queue: [[2, 2], [1, 1]],
      grid: makePuyoGrid([
        '023400',
        '023400',
        '012340',
        '123420',
        '123420'
      ]),
      check: (st) => st.maxChain >= 5
    },
    {
      id: 'p9', type: 'puyo', title: 'P-09 2連鎖・全消しフィニッシュ', par: 2, coins: 75, xp: 85,
      goalText: '2手以内に2連鎖以上で全消しを達成せよ！',
      hint: '1手目で青を繋げて2連鎖の形を整え、2手目で赤を発火して綺麗に全消し！',
      queue: [[2, 2], [1, 1]],
      grid: makePuyoGrid([
        '001000',
        '012000',
        '012000'
      ]),
      check: (st) => st.maxChain >= 2 && st.allClears >= 1
    },
    {
      id: 'p10', type: 'puyo', title: 'P-10 究極の6連鎖フィニッシュ', par: 2, coins: 80, xp: 95,
      goalText: '2手で6連鎖を完成・発火せよ！',
      hint: '1手目で6列目の赤の上に緑を乗せて6連鎖目を完成させ、2手目で左端から赤発火！',
      queue: [[3, 3], [1, 1]],
      grid: makePuyoGrid([
        '023410',
        '023410',
        '012341',
        '123413',
        '123413'
      ]),
      check: (st) => st.maxChain >= 6
    }
  ];

  // -------------------------------------------------------------------------
  // PUZZLE DOJO CONTROLLER
  // -------------------------------------------------------------------------
  const puzzleDojo = {
    open: false,
    tab: 'tetris',
    currentIdx: -1,
    board: null,
    movesUsed: 0,
    finished: false,
    won: false,
    runStats: null,
    rafId: null,
    lastTs: 0,

    openOverlay() {
      sound.stopBGM();
      this.open = true;
      this.showListView();
      document.getElementById('overlayPuzzleDojo').classList.add('active');
    },

    closeOverlay() {
      this.open = false;
      this.board = null;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      document.getElementById('overlayPuzzleDojo').classList.remove('active');
    },

    showListView() {
      this.board = null;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      document.getElementById('puzzleSelectView').style.display = 'block';
      document.getElementById('puzzlePlayView').style.display = 'none';
      this.renderList();
    },

    renderList() {
      const puzMap = profile.puzzles || {};
      const clearedTotal = PUZZLES.filter(p => puzMap[p.id] && puzMap[p.id].cleared).length;
      document.getElementById('puzzleProgressPill').textContent = `クリア: ${clearedTotal} / ${PUZZLES.length}`;
      const grid = document.getElementById('puzzleListGrid');
      grid.innerHTML = '';
      PUZZLES.forEach((p, idx) => {
        if (p.type !== this.tab) return;
        const rec = puzMap[p.id];
        const isClr = !!(rec && rec.cleared);
        const stars = isClr ? '★'.repeat(rec.stars || 3) : '☆☆☆';
        const card = document.createElement('div');
        card.className = 'puzzle-card' + (isClr ? ' cleared' : '');
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
            <strong style="font-size:0.84rem;color:var(--text-main);">${isClr ? '✅' : '🧩'} ${p.title}</strong>
            <span style="font-size:0.74rem;color:#fde047;font-weight:800;">${stars}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px;line-height:1.35;">${p.goalText}</div>
          <div style="font-size:0.68rem;color:var(--cyan);margin-top:5px;">規定: ${p.par}手 / 初クリア +${p.coins}🪙</div>
        `;
        card.addEventListener('click', () => {
          sound.unlock(); sound.playSE('rotate');
          this.startPuzzle(idx);
        });
        grid.appendChild(card);
      });
    },

    startPuzzle(idx) {
      const p = PUZZLES[idx];
      if (!p) return;
      this.currentIdx = idx;
      this.movesUsed = 0;
      this.finished = false;
      this.won = false;
      this.runStats = { totalLines: 0, maxLinesInOne: 0, tspins: 0, tspinLines: 0, perfectClears: 0, maxCombo: 0, maxChain: 0, allClears: 0 };

      document.getElementById('puzzleSelectView').style.display = 'none';
      document.getElementById('puzzlePlayView').style.display = 'block';
      document.getElementById('puzTitle').textContent = p.title;
      document.getElementById('puzGoalDesc').textContent = p.goalText;
      document.getElementById('puzHintText').textContent = p.hint;
      document.getElementById('btnPuzzleNext').style.display = 'none';
      const stEl = document.getElementById('puzStatusBanner');
      stEl.className = 'puzzle-status';
      stEl.textContent = 'プレイ中：キーボードまたは下のボタンで操作';

      if (p.type === 'tetris') {
        const b = new TetrisBoard(false, null, () => this.evaluateEnd(true), (kind, label, info) => {
          if (info) {
            this.runStats.totalLines += info.lines || 0;
            if ((info.lines || 0) > this.runStats.maxLinesInOne) this.runStats.maxLinesInOne = info.lines;
            if (info.isTSpin) { this.runStats.tspins++; this.runStats.tspinLines = Math.max(this.runStats.tspinLines, info.lines || 0); }
            if (info.isPerfect) this.runStats.perfectClears++;
            if ((info.combo || 0) > this.runStats.maxCombo) this.runStats.maxCombo = info.combo;
          }
          return 0;
        }, (ev) => {
          if (ev === 'piece') {
            this.movesUsed++;
            this.updateMovesUI();
            if (p.check(this.runStats)) this.onPuzzleWin();
          }
        }, null);
        b.fixedQueueMode = true;
        b.grid = p.grid.map(r => r.slice());
        b.queue = p.queue.slice();
        b.hold = null;
        b.canHold = false;
        b.onQueueEmpty = () => this.evaluateEnd(false);
        b.spawnNext();
        this.board = b;
      } else {
        const b = new PuyoBoard(false, null, () => this.evaluateEnd(true), null, (ev, val) => {
          if (ev === 'piece') {
            this.movesUsed++;
            this.updateMovesUI();
          } else if (ev === 'chain') {
            if (val > this.runStats.maxChain) this.runStats.maxChain = val;
            sound.playSE('puyoPop', val);
          } else if (ev === 'allclear') {
            this.runStats.allClears++;
            sound.playSE('perfect');
          }
        }, null, null, 4);
        b.fixedQueueMode = true;
        b.grid = p.grid.map(r => r.slice());
        b.queue = p.queue.map(q => q.slice());
        b.onQueueEmpty = () => this.evaluateEnd(false);
        b.spawnNext();
        this.board = b;
      }
      this.updateMovesUI();
      this.lastTs = performance.now();
      if (this.rafId) cancelAnimationFrame(this.rafId);
      const loop = (ts) => {
        if (!this.open || !this.board) return;
        const dt = Math.min(0.05, Math.max(0, (ts - this.lastTs) / 1000));
        this.lastTs = ts;
        if (!this.finished) {
          if (p.type === 'tetris') {
            this.board.update(dt, false, true);
          } else {
            this.board.update(dt, false, true);
            if (p.check(this.runStats) && this.board.phase === 'active') this.onPuzzleWin();
          }
        }
        this.renderCanvas();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    },

    updateMovesUI() {
      const p = PUZZLES[this.currentIdx];
      if (!p) return;
      const rem = Math.max(0, p.par - this.movesUsed);
      document.getElementById('puzMovesLeft').textContent = `残り ${rem}手 / 全${p.par}手`;
    },

    evaluateEnd(isKo) {
      if (this.finished) return;
      const p = PUZZLES[this.currentIdx];
      if (!p) return;
      if (!isKo && p.check(this.runStats)) {
        this.onPuzzleWin();
        return;
      }
      this.finished = true;
      this.won = false;
      sound.playSE('lose');
      const stEl = document.getElementById('puzStatusBanner');
      stEl.className = 'puzzle-status fail';
      stEl.textContent = '❌ 失敗！「🔄 やり直し」で再挑戦しよう';
    },

    onPuzzleWin() {
      if (this.finished) return;
      const p = PUZZLES[this.currentIdx];
      this.finished = true;
      this.won = true;
      sound.playSE('rankUp');
      const cv = document.getElementById('puzzleCanvas');
      if (cv && typeof spawnClearEffect === 'function') spawnClearEffect(true, 3, '#fde047', cv.getBoundingClientRect());

      profile.puzzles = profile.puzzles || {};
      const prev = profile.puzzles[p.id];
      const firstClear = !(prev && prev.cleared);
      const stars = this.movesUsed <= p.par ? 3 : 2;
      profile.puzzles[p.id] = {
        cleared: true,
        bestMoves: prev && prev.bestMoves ? Math.min(prev.bestMoves, this.movesUsed) : this.movesUsed,
        stars: prev && prev.stars ? Math.max(prev.stars, stars) : stars
      };
      let rewardTxt = '';
      if (firstClear) {
        profile.coins = (profile.coins || 0) + p.coins;
        grantXP(p.xp);
        rewardTxt = ` (初クリア +${p.coins}🪙 / +${p.xp}XP)`;
      } else {
        grantXP(15);
      }
      saveProfile(profile);
      const clearedCount = PUZZLES.filter(x => profile.puzzles[x.id] && profile.puzzles[x.id].cleared).length;
      if (clearedCount >= 10) unlockAchievement('puzzle10');
      if (clearedCount >= PUZZLES.length) unlockAchievement('puzzle20');
      renderProfileUI();

      const stEl = document.getElementById('puzStatusBanner');
      stEl.className = 'puzzle-status win';
      stEl.textContent = `🎉 CLEAR! ${'★'.repeat(stars)}${rewardTxt}`;
      const nextBtn = document.getElementById('btnPuzzleNext');
      if (this.currentIdx + 1 < PUZZLES.length && PUZZLES[this.currentIdx + 1].type === p.type) {
        nextBtn.style.display = 'inline-flex';
      }
    },

    action(act) {
      if (!this.open || !this.board || this.finished) return;
      const p = PUZZLES[this.currentIdx];
      if (!p) return;
      sound.unlock();
      if (p.type === 'tetris') {
        const b = this.board;
        if (!b.current) return;
        if (act === 'left') { if (b.move(-1, 0)) sound.playSE('move'); }
        else if (act === 'right') { if (b.move(1, 0)) sound.playSE('move'); }
        else if (act === 'down') { if (b.move(0, 1)) sound.playSE('softdrop'); }
        else if (act === 'cw') { if (b.rotate(1)) sound.playSE('rotate'); }
        else if (act === 'ccw') { if (b.rotate(-1)) sound.playSE('rotate'); }
        else if (act === 'rot180') { if (b.rotate180()) sound.playSE('rotate'); }
        else if (act === 'drop') { b.hardDrop(); sound.playSE('harddrop'); }
      } else {
        const b = this.board;
        if (b.phase !== 'active' || !b.current) return;
        if (act === 'left') { if (b.move(-1, 0)) sound.playSE('move'); }
        else if (act === 'right') { if (b.move(1, 0)) sound.playSE('move'); }
        else if (act === 'down') { if (b.move(0, 1, true)) sound.playSE('softdrop'); }
        else if (act === 'cw') { if (b.rotate(1)) sound.playSE('rotate'); }
        else if (act === 'ccw') { if (b.rotate(-1)) sound.playSE('rotate'); }
        else if (act === 'drop') { b.hardDrop(); sound.playSE('puyoLand'); }
      }
    },

    renderCanvas() {
      const cv = document.getElementById('puzzleCanvas');
      if (!cv || !this.board) return;
      const ctx = cv.getContext('2d');
      const p = PUZZLES[this.currentIdx];
      ctx.fillStyle = activeThemeObj.canvasBg || '#060913';
      ctx.fillRect(0, 0, cv.width, cv.height);
      if (p.type === 'tetris') {
        renderTetrisMain(ctx, this.board, 95, 22, 24, true);
      } else {
        renderPuyoMain(ctx, this.board, 110, 22, 38, true);
      }
    }
  };

  // -------------------------------------------------------------------------
  // 4. 7-DAY LOGIN BONUS
  // -------------------------------------------------------------------------
  const LOGIN_REWARDS = [
    { coins: 30,  xp: 30 },
    { coins: 40,  xp: 40 },
    { coins: 50,  xp: 50 },
    { coins: 70,  xp: 60 },
    { coins: 90,  xp: 80 },
    { coins: 120, xp: 100 },
    { coins: 200, xp: 200 }
  ];

  function getYesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function checkLoginBonus() {
    const today = getTodayStr();
    const yest = getYesterdayStr();
    profile.loginBonus = profile.loginBonus || { lastDate: '', streak: 0 };
    if (profile.loginBonus.lastDate === today) return;
    let streak = 1;
    if (profile.loginBonus.lastDate === yest) {
      streak = (profile.loginBonus.streak % 7) + 1;
    }
    profile.loginBonus.lastDate = today;
    profile.loginBonus.streak = streak;
    const rew = LOGIN_REWARDS[streak - 1] || LOGIN_REWARDS[0];
    profile.coins = (profile.coins || 0) + rew.coins;
    saveProfile(profile);
    grantXP(rew.xp);
    if (streak >= 7) unlockAchievement('login7');
    renderProfileUI();
    setTimeout(() => {
      showToast(`🎁 連続ログイン ${streak}日目ボーナス！ +${rew.coins}🪙 / +${rew.xp}XP`);
    }, 650);
  }

  // -------------------------------------------------------------------------
  // 5. HOOKS EXPOSED TO MAIN.JS
  // -------------------------------------------------------------------------
  window.extras = {
    TOWER_FLOORS,
    PUZZLES,
    puzzleDojo,
    getDailySeedInfo,
    startTowerRun,
    startDailySeed,

    handleStartSolo(sType) {
      if (sType === 'cpu_tower') {
        const st = getSegVal('towerStyleGroup') || 'tetris';
        startTowerRun(st);
        return true;
      }
      if (sType === 'daily_seed') {
        startDailySeed();
        return true;
      }
      if (sType === 'puzzle_dojo') {
        puzzleDojo.openOverlay();
        return true;
      }
      return false;
    },

    updateSoloBanner(val, banner) {
      if (val === 'cpu_tower') {
        const bestF = (profile.records && profile.records.bestTowerFloor) || 0;
        const bestMs = profile.records && profile.records.bestTowerMs;
        const tStr = bestMs ? ` / 最速制覇: ${formatSprintTime(bestMs)}` : '';
        banner.textContent = `🗼 CPUタワー全10階層ボスラッシュ！ 最高到達: ${bestF}F${tStr}`;
        return true;
      }
      if (val === 'daily_seed') {
        const info = getDailySeedInfo();
        const ds = profile.dailySeed || { bestByDate: {}, lastRewardDate: '' };
        const best = ds.bestByDate && ds.bestByDate[info.date];
        const bestTxt = best !== undefined && best !== null
          ? (info.scoreType === 'time' ? formatSprintTime(best) : `${Number(best).toLocaleString()}点`)
          : '未記録';
        const rewTxt = ds.lastRewardDate === info.date ? '参加報酬受取済' : '初挑戦で+60🪙!';
        banner.textContent = `📅 [${info.date}] ${info.label} | 本日の自己ベスト: ${bestTxt} (${rewTxt})`;
        return true;
      }
      if (val === 'puzzle_dojo') {
        const pMap = profile.puzzles || {};
        const cleared = PUZZLES.filter(p => pMap[p.id] && pMap[p.id].cleared).length;
        banner.textContent = `🧩 詰めテトリス10問＋詰めぷよ10問の計20問！ 現在のクリア数: ${cleared} / ${PUZZLES.length}`;
        return true;
      }
      return false;
    },

    onFinishMatch(b, won) {
      if (!b.towerFloor || b.towerFloor <= 0) return;
      const fl = b.towerFloor;
      const def = TOWER_FLOORS[fl - 1];
      const badgesEl = document.getElementById('resSpecialBadges');
      const nextBtn = document.getElementById('btnNextTowerFloor');
      if (won && def) {
        profile.records = profile.records || {};
        if (fl > (profile.records.bestTowerFloor || 0)) profile.records.bestTowerFloor = fl;
        profile.coins = (profile.coins || 0) + def.coins;
        grantXP(def.xp);
        if (fl >= 5) unlockAchievement('tower_floor5');
        if (fl >= 10) {
          const elapsedMs = Math.max(1000, Date.now() - (towerState.startTimeMs || Date.now()));
          profile.records.towerClears = (profile.records.towerClears || 0) + 1;
          if (!profile.records.bestTowerMs || elapsedMs < profile.records.bestTowerMs) {
            profile.records.bestTowerMs = elapsedMs;
          }
          profile.coins = (profile.coins || 0) + 250;
          grantXP(300);
          unlockAchievement('tower_clear');
          towerState.active = false;
          document.getElementById('resTitle').textContent = '👑 TOWER CONQUERED!';
          document.getElementById('resSub').textContent = `全10階層ノーコンティニュー制覇！ タイム: ${formatSprintTime(elapsedMs)}`;
          badgesEl.innerHTML += `<span class="result-special" style="background:linear-gradient(135deg,#facc15,#f97316);color:#1c1917;">🗼 10F完全制覇ボーナス +250🪙</span>`;
        } else {
          badgesEl.innerHTML += `<span class="result-special" style="background:linear-gradient(135deg,#22c55e,#10b981);color:#052e16;">🗼 ${fl}F 突破! +${def.coins}🪙 / +${def.xp}XP</span>`;
          if (nextBtn) {
            nextBtn.textContent = `🗼 次の階層へ (${fl + 1}F)`;
            nextBtn.style.display = 'inline-flex';
          }
        }
        saveProfile(profile);
        renderProfileUI();
      } else {
        towerState.active = false;
        document.getElementById('resSub').textContent = `🗼 CPUタワー ${fl}F で敗退…（再戦は1Fからやり直し）`;
      }
    },

    onFinishChallenge(b, cleared) {
      if (!b.isDailySeed) return;
      const info = getDailySeedInfo();
      const seedBadge = document.getElementById('resSeedBadge');
      if (seedBadge) {
        seedBadge.textContent = `📅 DAILY SEED: ${info.date} (${info.label})`;
        seedBadge.style.display = 'block';
      }
      profile.dailySeed = profile.dailySeed || { lastRewardDate: '', playedDates: [], bestByDate: {} };
      if (!profile.dailySeed.playedDates.includes(info.date)) {
        profile.dailySeed.playedDates.push(info.date);
      }
      unlockAchievement('daily_seed1');
      if (profile.dailySeed.playedDates.length >= 5) unlockAchievement('daily_seed5');

      const badgesEl = document.getElementById('resSpecialBadges');
      if (profile.dailySeed.lastRewardDate !== info.date) {
        profile.dailySeed.lastRewardDate = info.date;
        profile.coins = (profile.coins || 0) + 60;
        grantXP(80);
        badgesEl.innerHTML += `<span class="result-special" style="background:linear-gradient(135deg,#38bdf8,#818cf8);color:#030712;">📅 デイリーシード参加報酬 +60🪙 / +80XP</span>`;
      }

      if (info.scoreType === 'time' && cleared) {
        const ms = Math.round(b.stats.elapsedSec * 1000);
        const prev = profile.dailySeed.bestByDate[info.date];
        if (prev === undefined || ms < prev) {
          profile.dailySeed.bestByDate[info.date] = ms;
          badgesEl.innerHTML += `<span class="result-special">📅 TODAY'S BEST!</span>`;
        }
      } else if (info.scoreType === 'score') {
        const sc = info.kind === 'daily_puyo2m' ? (b.selfPuyo ? b.selfPuyo.score : 0) : (b.selfTetris ? b.selfTetris.score : 0);
        const prev = profile.dailySeed.bestByDate[info.date] || 0;
        if (sc > prev) {
          profile.dailySeed.bestByDate[info.date] = sc;
          badgesEl.innerHTML += `<span class="result-special">📅 TODAY'S BEST!</span>`;
        }
      }
      saveProfile(profile);
      renderProfileUI();
    },

    renderExtraProfileUI() {}
  };

  // -------------------------------------------------------------------------
  // 6. EVENT WIRING & INIT
  // -------------------------------------------------------------------------
  setupSegGroup('towerStyleGroup');

  const btnPrestige = document.getElementById('btnPrestige');
  if (btnPrestige) {
    btnPrestige.addEventListener('click', () => {
      if ((profile.level || 1) < 100) return;
      if (confirm('Lv.100から転生（プレステージ）しますか？\nLv.1にリセットされ、★マーク＋300コインを獲得します。')) {
        doPrestige();
      }
    });
  }

  const btnNextTower = document.getElementById('btnNextTowerFloor');
  if (btnNextTower) {
    btnNextTower.addEventListener('click', () => {
      sound.unlock();
      document.getElementById('overlayResult').classList.remove('active');
      if (towerState.active && towerState.floor < 10) {
        launchTowerFloor(towerState.floor + 1);
      }
    });
  }

  // Puzzle Dojo bindings
  document.querySelectorAll('[data-puztab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-puztab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      puzzleDojo.tab = tab.dataset.puztab;
      puzzleDojo.renderList();
    });
  });
  document.getElementById('btnClosePuzzleDojo').addEventListener('click', () => puzzleDojo.closeOverlay());
  document.getElementById('btnPuzzleReset').addEventListener('click', () => {
    sound.unlock(); sound.playSE('undo');
    puzzleDojo.startPuzzle(puzzleDojo.currentIdx);
  });
  document.getElementById('btnPuzzleBackList').addEventListener('click', () => puzzleDojo.showListView());
  document.getElementById('btnPuzzleNext').addEventListener('click', () => {
    sound.unlock(); sound.playSE('rotate');
    puzzleDojo.startPuzzle(puzzleDojo.currentIdx + 1);
  });
  document.querySelectorAll('[data-puzact]').forEach(btn => {
    btn.addEventListener('click', () => puzzleDojo.action(btn.dataset.puzact));
  });

  window.addEventListener('keydown', (e) => {
    if (!puzzleDojo.open || !puzzleDojo.board || puzzleDojo.finished) return;
    const keys = (profile.settings && profile.settings.keys) || DEFAULT_KEYS;
    const code = e.code;
    let handled = true;
    if (code === keys.left || code === 'ArrowLeft') puzzleDojo.action('left');
    else if (code === keys.right || code === 'ArrowRight') puzzleDojo.action('right');
    else if (code === keys.down || code === 'ArrowDown') puzzleDojo.action('down');
    else if (code === keys.cw || code === 'ArrowUp' || code === 'KeyX') puzzleDojo.action('cw');
    else if (code === keys.ccw || code === 'KeyZ') puzzleDojo.action('ccw');
    else if (code === keys.rot180 || code === 'KeyA') puzzleDojo.action('rot180');
    else if (code === keys.hard || code === 'Space') puzzleDojo.action('drop');
    else if (code === keys.retry || code === 'KeyR') puzzleDojo.startPuzzle(puzzleDojo.currentIdx);
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Initialize on load
  ensureWeeklyMissions();
  checkLoginBonus();
  renderProfileUI();
})();
