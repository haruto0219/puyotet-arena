'use strict';

  /* =========================================================================
     4. TETRIS GUIDELINE ENGINE
     ========================================================================= */
  const TETRIS_COLORS = {
    I: '#00f0f0', O: '#f0f000', T: '#a000f0',
    S: '#00f000', Z: '#f00000', J: '#0050ff', L: '#f0a000',
    G: '#64748b'
  };

  const TETRIS_SHAPES = {
    I: [
      [[0,1],[1,1],[2,1],[3,1]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[1,0],[1,1],[1,2],[1,3]]
    ],
    O: [
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]]
    ],
    T: [
      [[1,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[0,1],[1,1],[1,2]]
    ],
    S: [
      [[1,0],[2,0],[0,1],[1,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[1,1],[2,1],[0,2],[1,2]],
      [[0,0],[0,1],[1,1],[1,2]]
    ],
    Z: [
      [[0,0],[1,0],[1,1],[2,1]],
      [[2,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,0],[0,1],[1,1],[0,2]]
    ],
    J: [
      [[0,0],[0,1],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[0,2],[1,2]]
    ],
    L: [
      [[2,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,1],[0,2]],
      [[0,0],[1,0],[1,1],[1,2]]
    ]
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
  const SRS_I = {
    '0>1': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '1>0': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '1>2': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    '2>1': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '2>3': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '3>2': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '3>0': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '0>3': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
  };

  const REN_TABLE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];

  class TetrisBoard {
    constructor(isLocal, onAttack, onKO, onClearEvent, onStat, onShake) {
      this.isLocal = isLocal;
      this.onAttack = onAttack;
      this.onKO = onKO;
      this.onClearEvent = onClearEvent;
      this.onStat = onStat;
      this.onShake = onShake;
      this.cols = 10;
      this.rows = 22;
      this.reset();
    }

    reset() {
      this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
      this.queue = [];
      this.refillQueue();
      this.hold = null;
      this.canHold = true;
      this.current = null;
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.combo = -1;
      this.b2b = false;
      this.pendingGarbage = 0;
      this.garbageQueue = [];
      this.lastGarbageHole = -1;
      this.cheeseRemainingReserve = 0;
      this.lastCheeseHole = -1;
      this.dead = false;
      this.gravTimer = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.grounded = false;
      this.lastMoveWasRotate = false;
      this.trails = [];
      this.popups = [];
      this.clearFlash = [];
      this.spawnNext();
    }

    refillQueue() {
      if (this.isLocal && !battle.isOnline && (admQueueMode === 'I' || admQueueMode === 'T')) {
        while (this.queue.length < 7) this.queue.push(admQueueMode);
        return;
      }
      while (this.queue.length < 7) {
        const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        for (let i = types.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [types[i], types[j]] = [types[j], types[i]];
        }
        this.queue.push(...types);
      }
    }

    spawnNext() {
      this.refillQueue();
      const type = this.queue.shift();
      this.refillQueue();
      this.current = { type, rot: 0, x: 3, y: 0 };
      this.canHold = true;
      this.gravTimer = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.grounded = false;
      this.lastMoveWasRotate = false;
      if (this.collides(this.current.x, this.current.y, this.current.rot, this.current.type)) {
        this.dead = true;
        if (this.onKO) this.onKO('tetris');
      }
    }

    collides(x, y, rot, type) {
      const cells = TETRIS_SHAPES[type][rot];
      for (const [cx, cy] of cells) {
        const nx = x + cx, ny = y + cy;
        if (nx < 0 || nx >= this.cols || ny >= this.rows) return true;
        if (ny >= 0 && this.grid[ny][nx]) return true;
      }
      return false;
    }

    isInDanger() {
      if (this.pendingGarbage >= 6) return true;
      for (let r = 2; r <= 5; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c]) return true;
        }
      }
      return false;
    }

    move(dx, dy, isSoft = false) {
      if (this.dead || !this.current) return false;
      if (!this.collides(this.current.x + dx, this.current.y + dy, this.current.rot, this.current.type)) {
        this.current.x += dx;
        this.current.y += dy;
        this.lastMoveWasRotate = false;
        if (dx !== 0 && this.grounded && this.lockResets < 15) {
          this.lockTimer = 0;
          this.lockResets++;
        }
        if (isSoft) {
          this.score += 1;
          this.gravTimer = 0;
        }
        if (this.isLocal && dx !== 0) sound.playSE('move');
        return true;
      }
      return false;
    }

    rotate(dir) {
      if (this.dead || !this.current) return false;
      const p = this.current;
      const from = p.rot;
      const to = (from + dir + 4) % 4;
      const key = `${from}>${to}`;
      const kicks = p.type === 'O' ? [[0,0]] : (p.type === 'I' ? SRS_I[key] : SRS_JLSTZ[key]);
      for (const [kx, ky] of kicks) {
        if (!this.collides(p.x + kx, p.y + ky, to, p.type)) {
          p.x += kx;
          p.y += ky;
          p.rot = to;
          this.lastMoveWasRotate = true;
          if (this.grounded && this.lockResets < 15) {
            this.lockTimer = 0;
            this.lockResets++;
          }
          if (this.isLocal) sound.playSE('rotate');
          return true;
        }
      }
      return false;
    }

    rotate180() {
      if (this.dead || !this.current) return false;
      const p = this.current;
      const to = (p.rot + 2) % 4;
      const kicks = p.type === 'O' ? [[0,0]] : [[0,0],[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1]];
      for (const [kx, ky] of kicks) {
        if (!this.collides(p.x + kx, p.y + ky, to, p.type)) {
          p.x += kx;
          p.y += ky;
          p.rot = to;
          this.lastMoveWasRotate = true;
          if (this.grounded && this.lockResets < 15) {
            this.lockTimer = 0;
            this.lockResets++;
          }
          if (this.isLocal) sound.playSE('rotate');
          return true;
        }
      }
      return false;
    }

    getGhostY() {
      if (!this.current) return 0;
      let gy = this.current.y;
      while (!this.collides(this.current.x, gy + 1, this.current.rot, this.current.type)) gy++;
      return gy;
    }

    hardDrop() {
      if (this.dead || !this.current) return;
      const startY = this.current.y;
      const gy = this.getGhostY();
      const dist = gy - startY;
      const cells = TETRIS_SHAPES[this.current.type][this.current.rot];
      for (const [cx, cy] of cells) {
        this.trails.push({
          x: this.current.x + cx,
          y1: Math.max(2, startY + cy),
          y2: gy + cy,
          color: TETRIS_COLORS[this.current.type],
          alpha: 0.75
        });
      }
      this.current.y = gy;
      this.score += dist * 2;
      if (dist > 0) this.lastMoveWasRotate = false;
      if (this.isLocal) sound.playSE('harddrop');
      this.lockPiece();
    }

    doHold() {
      if (this.dead || !this.current || !this.canHold) return;
      const curType = this.current.type;
      if (this.hold) {
        this.current = { type: this.hold, rot: 0, x: 3, y: 0 };
        this.hold = curType;
      } else {
        this.hold = curType;
        this.spawnNext();
      }
      this.canHold = false;
      this.gravTimer = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.grounded = false;
      if (this.isLocal) sound.playSE('hold');
    }

    detectTSpin() {
      const p = this.current;
      if (!p || p.type !== 'T' || !this.lastMoveWasRotate) return false;
      const cx = p.x + 1, cy = p.y + 1;
      const corners = [[cx-1, cy-1],[cx+1, cy-1],[cx-1, cy+1],[cx+1, cy+1]];
      let blocked = 0;
      for (const [x, y] of corners) {
        if (x < 0 || x >= this.cols || y >= this.rows || (y >= 0 && this.grid[y][x])) blocked++;
      }
      return blocked >= 3;
    }

    addPopup(text, color = '#00f0ff') {
      this.popups.push({ text, color, life: 1.35, maxLife: 1.35, yOffset: 0 });
      if (this.popups.length > 4) this.popups.shift();
    }

    lockPiece() {
      if (!this.current) return;
      const p = this.current;
      const isTSpin = this.detectTSpin();
      const cells = TETRIS_SHAPES[p.type][p.rot];
      let allHidden = true;
      for (const [cx, cy] of cells) {
        const nx = p.x + cx, ny = p.y + cy;
        if (ny >= 2) allHidden = false;
        if (ny >= 0 && ny < this.rows && nx >= 0 && nx < this.cols) {
          this.grid[ny][nx] = p.type;
        }
      }
      if (this.onStat) this.onStat('piece');
      if (allHidden) {
        this.dead = true;
        if (this.onKO) this.onKO('tetris');
        return;
      }

      const clearedRows = [];
      for (let r = 0; r < this.rows; r++) {
        if (this.grid[r].every(c => c !== null)) clearedRows.push(r);
      }

      if (clearedRows.length > 0) {
        for (const r of clearedRows) this.clearFlash.push({ row: r, alpha: 1 });
        for (let i = clearedRows.length - 1; i >= 0; i--) this.grid.splice(clearedRows[i], 1);
        while (this.grid.length < this.rows) this.grid.unshift(Array(this.cols).fill(null));

        const n = clearedRows.length;
        this.lines += n;
        if (this.isLocal) addDailyProgress('lines15', n);
        this.level = Math.min(15, 1 + Math.floor(this.lines / 10));
        this.combo++;
        if (this.onStat && this.combo >= 1) this.onStat('ren', this.combo);
        if (this.isLocal && this.combo >= 5) unlockAchievement('ren5');

        const isPerfect = this.grid.every(row => row.every(c => c === null));
        let attack = 0;
        let label = '';
        let difficult = false;

        if (isTSpin) {
          difficult = true;
          if (this.onStat) this.onStat('tspin');
          if (this.isLocal) {
            addDailyProgress('tspin2', 1);
            profile.statsTotal = profile.statsTotal || { tspins: 0 };
            profile.statsTotal.tspins++;
            saveProfile(profile);
            if (profile.statsTotal.tspins >= 5) unlockAchievement('tspin5');
          }
          if (n === 1) { attack = 2; label = 'T-SPIN SINGLE!'; this.score += 800 * this.level; }
          else if (n === 2) { attack = 4; label = 'T-SPIN DOUBLE!'; this.score += 1200 * this.level; }
          else if (n === 3) { attack = 6; label = 'T-SPIN TRIPLE!'; this.score += 1600 * this.level; }
        } else {
          if (n === 1) { attack = 0; this.score += 100 * this.level; }
          else if (n === 2) { attack = 1; label = 'DOUBLE'; this.score += 300 * this.level; }
          else if (n === 3) { attack = 2; label = 'TRIPLE'; this.score += 500 * this.level; }
          else if (n === 4) { attack = 4; label = 'TETRIS!'; difficult = true; this.score += 800 * this.level; }
        }

        if (difficult) {
          if (this.onShake) this.onShake(6.5, 0.22);
          if (this.b2b) {
            attack += 1;
            this.addPopup('BACK-TO-BACK!', '#fbbf24');
          }
          this.b2b = true;
        } else {
          this.b2b = false;
        }

        if (this.combo >= 1) {
          const renAtk = REN_TABLE[Math.min(REN_TABLE.length - 1, this.combo)];
          attack += renAtk;
          this.score += 50 * this.combo * this.level;
          this.addPopup(`${this.combo} REN!`, '#38bdf8');
        }

        if (isPerfect) {
          attack += 10;
          this.score += 3000 * this.level;
          this.addPopup('PERFECT CLEAR!', '#fde047');
          if (this.onShake) this.onShake(9, 0.3);
          if (this.onStat) this.onStat('allclear');
          if (this.isLocal) unlockAchievement('all_clear');
          if (this.isLocal || battle.isSpectate) sound.playSE('perfect');
        } else if (label) {
          this.addPopup(label, difficult ? '#ff2e93' : '#00f0ff');
          if (this.isLocal || battle.isSpectate) sound.playSE(difficult ? 'tetris' : 'clear');
        } else {
          if (this.isLocal || battle.isSpectate) sound.playSE('clear');
        }

        let bonus = 0;
        if (this.onClearEvent) bonus = this.onClearEvent('tetris', label || `${n} LINE`);
        attack += bonus;

        if (attack > 0) {
          if (this.onStat) this.onStat('attack', attack);
          if (this.garbageQueue.length > 0) {
            let canceledTotal = 0;
            while (attack > 0 && this.garbageQueue.length > 0) {
              const g = this.garbageQueue[0];
              const take = Math.min(g.lines, attack);
              g.lines -= take;
              attack -= take;
              canceledTotal += take;
              if (g.lines <= 0.001) this.garbageQueue.shift();
            }
            this.syncPendingGarbage();
            if (canceledTotal > 0) {
              this.addPopup('COUNTER!', '#4ade80');
              if (this.onStat) this.onStat('counter', Math.round(canceledTotal * 10) / 10);
              if (this.isLocal || battle.isSpectate) sound.playSE('counter');
            }
          }
          if (attack > 0 && this.onAttack) {
            this.onAttack('tetris', attack, label || `${this.combo} REN`);
          }
        }
      } else {
        this.combo = -1;
        if (this.isLocal) sound.playSE('lock');
        const isBr99Mode = (typeof br99 !== 'undefined' && br99.isOpen);
        const maxRise = isBr99Mode ? 12 : 8;
        let readyLines = 0;
        for (const g of this.garbageQueue) {
          if (g.delay <= 0) readyLines += g.lines;
        }
        const rise = Math.min(maxRise, Math.floor(readyLines));
        if (rise >= 1) {
          let toConsume = rise;
          for (let i = 0; i < this.garbageQueue.length && toConsume > 0; ) {
            const g = this.garbageQueue[i];
            if (g.delay <= 0) {
              const take = Math.min(g.lines, toConsume);
              g.lines -= take;
              toConsume -= take;
              if (g.lines <= 0.001) this.garbageQueue.splice(i, 1);
              else i++;
            } else {
              i++;
            }
          }
          this.syncPendingGarbage();
          this.applyGarbageLines(rise);
          if (this.onShake) this.onShake(7, 0.24);
          if (this.isLocal || battle.isSpectate) sound.playSE('garbageRise');
        }
      }

      if (this.isLocal && battle.soloSubType === 'sprint40' && this.lines >= 40) {
        this.current = null;
        battle.finishChallenge(true);
        return;
      }

      if (this.isLocal && battle.soloSubType === 'cheese') {
        while (this.cheeseRemainingReserve > 0 && this.countCheeseRowsOnBoard() < 10) {
          this.pushCheeseRow();
          this.cheeseRemainingReserve--;
        }
        if (this.getTotalCheeseRemaining() === 0) {
          this.current = null;
          battle.finishChallenge(true);
          return;
        }
      }

      this.spawnNext();
    }

    initCheeseRace(totalLines) {
      const initRows = Math.min(10, totalLines);
      this.cheeseRemainingReserve = Math.max(0, totalLines - initRows);
      this.lastCheeseHole = -1;
      for (let i = 0; i < initRows; i++) {
        this.pushCheeseRow();
      }
    }

    pushCheeseRow() {
      let hole = Math.floor(Math.random() * this.cols);
      if (hole === this.lastCheeseHole) {
        hole = (hole + 1 + Math.floor(Math.random() * (this.cols - 1))) % this.cols;
      }
      this.lastCheeseHole = hole;
      this.grid.shift();
      const row = Array(this.cols).fill('G');
      row[hole] = null;
      this.grid.push(row);
    }

    countCheeseRowsOnBoard() {
      let c = 0;
      for (let r = 0; r < this.rows; r++) {
        if (this.grid[r].some(cell => cell === 'G')) c++;
      }
      return c;
    }

    getTotalCheeseRemaining() {
      return this.countCheeseRowsOnBoard() + this.cheeseRemainingReserve;
    }

    applyGarbageLines(count) {
      let hole = Math.floor(Math.random() * this.cols);
      if (this.lastGarbageHole >= 0 && hole === this.lastGarbageHole && Math.random() < 0.78) {
        hole = (hole + 1 + Math.floor(Math.random() * (this.cols - 1))) % this.cols;
      }
      for (let i = 0; i < count; i++) {
        if (i > 0 && Math.random() < 0.30) {
          hole = (hole + 1 + Math.floor(Math.random() * (this.cols - 1))) % this.cols;
        }
        this.grid.shift();
        const row = Array(this.cols).fill('G');
        row[hole] = null;
        this.grid.push(row);
      }
      this.lastGarbageHole = hole;
    }

    syncPendingGarbage() {
      let sum = 0;
      for (const g of this.garbageQueue) sum += g.lines;
      this.pendingGarbage = sum < 0.001 ? 0 : sum;
    }

    receiveGarbage(linesFloat, customDelay = null) {
      if (!linesFloat || linesFloat <= 0) return;
      const isBr99Mode = (typeof br99 !== 'undefined' && br99.isOpen);
      let delay = 0.8;
      let addLines = linesFloat;

      if (isBr99Mode) {
        const aliveCnt = br99.getAlivePlayers().length;
        delay = aliveCnt <= 10 ? 1.0 : (aliveCnt <= 50 ? 3.0 : 5.0);
        const roomLeft = Math.max(0, 12 - this.pendingGarbage);
        addLines = Math.min(linesFloat, roomLeft);
      }
      if (typeof customDelay === 'number' && customDelay >= 0) delay = customDelay;
      if (addLines <= 0.001) return;

      this.garbageQueue.push({ lines: addLines, delay, maxDelay: Math.max(0.1, delay) });
      this.syncPendingGarbage();
      if (this.isLocal && addLines >= 1) sound.playSE('warning');
    }

    update(dt, softDropHeld) {
      for (const g of this.garbageQueue) {
        if (g.delay > 0) g.delay = Math.max(0, g.delay - dt);
      }
      for (let i = this.trails.length - 1; i >= 0; i--) {
        this.trails[i].alpha -= dt * 3.8;
        if (this.trails[i].alpha <= 0) this.trails.splice(i, 1);
      }
      for (let i = this.clearFlash.length - 1; i >= 0; i--) {
        this.clearFlash[i].alpha -= dt * 4.5;
        if (this.clearFlash[i].alpha <= 0) this.clearFlash.splice(i, 1);
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        this.popups[i].life -= dt;
        this.popups[i].yOffset -= dt * 28;
        if (this.popups[i].life <= 0) this.popups.splice(i, 1);
      }

      if (this.dead || !this.current) return;

      const baseInterval = Math.max(0.06, Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1));
      const sdfSetting = this.isLocal ? profile.settings.sdf : '20';

      const zeroG = this.isLocal && battle.zeroGravity;
      if (softDropHeld && sdfSetting === 'inf') {
        while (this.move(0, 1, true)) {}
      } else if (!zeroG || softDropHeld) {
        const sdfMult = sdfSetting === 'inf' ? 40 : (parseInt(sdfSetting, 10) || 20);
        const interval = softDropHeld ? Math.max(0.01, baseInterval / sdfMult) : baseInterval;
        this.gravTimer += dt;
        while (this.gravTimer >= interval) {
          this.gravTimer -= interval;
          if (!this.move(0, 1, softDropHeld)) {
            this.gravTimer = 0;
            break;
          }
        }
      }

      this.grounded = this.collides(this.current.x, this.current.y + 1, this.current.rot, this.current.type);
      if (this.grounded && (!zeroG || softDropHeld)) {
        this.lockTimer += dt * 1000;
        if (this.lockTimer >= 500) this.lockPiece();
      } else {
        this.lockTimer = 0;
      }
    }

    serialize() {
      return {
        k: 't',
        g: this.grid,
        c: this.current,
        h: this.hold,
        q: this.queue.slice(0, 5),
        pg: Math.round(this.pendingGarbage * 10) / 10,
        gq: this.garbageQueue.map(g => [Math.round(g.lines * 10) / 10, Math.round(g.delay * 10) / 10, Math.round(g.maxDelay * 10) / 10]),
        sc: this.score,
        d: this.dead
      };
    }

    applyRemote(s) {
      if (!s || s.k !== 't') return;
      this.grid = s.g;
      this.current = s.c;
      this.hold = s.h;
      this.queue = s.q || [];
      this.pendingGarbage = s.pg || 0;
      this.garbageQueue = Array.isArray(s.gq)
        ? s.gq.map(a => ({ lines: a[0] || 0, delay: a[1] || 0, maxDelay: a[2] || 0.8 }))
        : (this.pendingGarbage > 0 ? [{ lines: this.pendingGarbage, delay: 0, maxDelay: 0.8 }] : []);
      this.score = s.sc || 0;
      this.dead = !!s.d;
    }
  }

  /* =========================================================================
     5. PUYO PUYO TSU ENGINE (NO INSTANT DROP + UNDO SNAPSHOT HOOK)
     ========================================================================= */
  const PUYO_PALETTE = {
    1: { light: '#fca5a5', main: '#ef4444', dark: '#991b1b' },
    2: { light: '#93c5fd', main: '#3b82f6', dark: '#1e3a8a' },
    3: { light: '#86efac', main: '#22c55e', dark: '#14532d' },
    4: { light: '#fef08a', main: '#eab308', dark: '#854d0e' },
    5: { light: '#e9d5ff', main: '#a855f7', dark: '#581c87' },
    9: { light: '#f8fafc', main: '#cbd5e1', dark: '#64748b' }
  };
  const PUYO_CHAIN_POWER = [0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
  const PUYO_COLOR_BONUS = [0, 0, 3, 6, 12, 24];
  const PUYO_GROUP_BONUS = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10];
  const CHILD_OFFSETS = [[0,-1],[1,0],[0,1],[-1,0]];

  class PuyoBoard {
    constructor(isLocal, onAttack, onKO, onClearEvent, onStat, onShake, onBeforeLock, numColors = 4) {
      this.isLocal = isLocal;
      this.onAttack = onAttack;
      this.onKO = onKO;
      this.onClearEvent = onClearEvent;
      this.onStat = onStat;
      this.onShake = onShake;
      this.onBeforeLock = onBeforeLock;
      this.numColors = Math.min(5, Math.max(3, numColors || 4));
      this.cols = 6;
      this.rows = 13;
      this.reset();
    }

    reset() {
      this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
      this.squish = Array.from({ length: this.rows }, () => new Float32Array(this.cols));
      this.queue = [this.randPair(), this.randPair(), this.randPair()];
      this.current = null;
      this.phase = 'active';
      this.phaseTimer = 0;
      this.gravTimer = 0;
      this.lockTimer = 0;
      this.chain = 0;
      this.score = 0;
      this.nuisanceCarry = 0;
      this.pendingGarbage = 0;
      this.allClearActive = false;
      this.popCells = [];
      this.dead = false;
      this.lastBlockedRotTime = 0;
      this.popups = [];
      this.spawnNext();
    }

    takeSnapshot() {
      return {
        grid: this.grid.map(r => r.slice()),
        queue: this.queue.map(q => q.slice()),
        current: this.current ? { x: 2, y: 1, rot: 0, axis: this.current.axis, child: this.current.child } : null,
        score: this.score,
        nuisanceCarry: this.nuisanceCarry,
        allClearActive: this.allClearActive
      };
    }

    restoreSnapshot(snap) {
      if (!snap) return;
      this.grid = snap.grid.map(r => r.slice());
      this.squish = Array.from({ length: this.rows }, () => new Float32Array(this.cols));
      this.queue = snap.queue.map(q => q.slice());
      this.current = snap.current ? { ...snap.current } : null;
      this.score = snap.score;
      this.nuisanceCarry = snap.nuisanceCarry;
      this.allClearActive = snap.allClearActive;
      this.phase = 'active';
      this.phaseTimer = 0;
      this.gravTimer = 0;
      this.lockTimer = 0;
      this.chain = 0;
      this.popCells = [];
      this.dead = false;
      this.addPopup('UNDO!', '#38bdf8');
    }

    randPair() {
      const n = this.numColors || 4;
      return [1 + Math.floor(Math.random() * n), 1 + Math.floor(Math.random() * n)];
    }

    triggerSquish(x, y) {
      if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
        this.squish[y][x] = 1.0;
      }
    }

    spawnNext() {
      if (this.grid[1][2] !== 0) {
        this.dead = true;
        if (this.onKO) this.onKO('puyo');
        return;
      }
      const pair = this.queue.shift();
      this.queue.push(this.randPair());
      this.current = { x: 2, y: 1, rot: 0, axis: pair[0], child: pair[1] };
      this.phase = 'active';
      this.gravTimer = 0;
      this.lockTimer = 0;
      this.chain = 0;
    }

    isInDanger() {
      if (this.pendingGarbage >= 24) return true;
      for (let r = 1; r <= 3; r++) {
        for (let c = 1; c <= 4; c++) {
          if (this.grid[r][c] !== 0) return true;
        }
      }
      return false;
    }

    getPairCells(x = this.current.x, y = this.current.y, rot = this.current.rot) {
      const [ox, oy] = CHILD_OFFSETS[rot];
      return [
        { x, y, c: this.current.axis },
        { x: x + ox, y: y + oy, c: this.current.child }
      ];
    }

    getGhostCells() {
      if (!this.current) return [];
      const [ox, oy] = CHILD_OFFSETS[this.current.rot];
      const x1 = this.current.x, x2 = x1 + ox;
      const colLanding = (col) => {
        for (let r = this.rows - 1; r >= 0; r--) if (this.grid[r][col] === 0) return r;
        return -1;
      };
      if (x1 === x2) {
        const rLow = colLanding(x1);
        if (rLow < 0) return [];
        if (oy === -1) {
          return [{ x: x1, y: rLow, c: this.current.axis }, { x: x1, y: rLow - 1, c: this.current.child }];
        } else {
          return [{ x: x1, y: rLow - 1, c: this.current.axis }, { x: x1, y: rLow, c: this.current.child }];
        }
      } else {
        const r1 = colLanding(x1), r2 = colLanding(x2);
        const out = [];
        if (r1 >= 0) out.push({ x: x1, y: r1, c: this.current.axis });
        if (r2 >= 0) out.push({ x: x2, y: r2, c: this.current.child });
        return out;
      }
    }

    isBlocked(x, y) {
      if (x < 0 || x >= this.cols || y >= this.rows) return true;
      if (y >= 0 && this.grid[y][x] !== 0) return true;
      return false;
    }

    pairCollides(x, y, rot) {
      const [ox, oy] = CHILD_OFFSETS[rot];
      return this.isBlocked(x, y) || this.isBlocked(x + ox, y + oy);
    }

    move(dx, dy, isSoft = false) {
      if (this.dead || this.phase !== 'active' || !this.current) return false;
      if (!this.pairCollides(this.current.x + dx, this.current.y + dy, this.current.rot)) {
        this.current.x += dx;
        this.current.y += dy;
        if (isSoft) { this.score += 1; this.gravTimer = 0; }
        if (this.isLocal && dx !== 0) sound.playSE('move');
        return true;
      }
      return false;
    }

    rotate(dir) {
      if (this.dead || this.phase !== 'active' || !this.current) return false;
      const p = this.current;
      const nextRot = (p.rot + dir + 4) % 4;
      if (!this.pairCollides(p.x, p.y, nextRot)) {
        p.rot = nextRot;
        if (this.isLocal) sound.playSE('rotate');
        return true;
      }
      if (!this.pairCollides(p.x - 1, p.y, nextRot)) {
        p.x -= 1; p.rot = nextRot;
        if (this.isLocal) sound.playSE('rotate');
        return true;
      }
      if (!this.pairCollides(p.x + 1, p.y, nextRot)) {
        p.x += 1; p.rot = nextRot;
        if (this.isLocal) sound.playSE('rotate');
        return true;
      }
      if (!this.pairCollides(p.x, p.y - 1, nextRot)) {
        p.y -= 1; p.rot = nextRot;
        if (this.isLocal) sound.playSE('rotate');
        return true;
      }
      const now = performance.now();
      if (now - this.lastBlockedRotTime < 420) {
        const flipRot = (p.rot + 2) % 4;
        if (!this.pairCollides(p.x, p.y, flipRot)) {
          p.rot = flipRot; this.lastBlockedRotTime = 0;
          if (this.isLocal) sound.playSE('rotate');
          return true;
        } else if (!this.pairCollides(p.x, p.y - 1, flipRot)) {
          p.y -= 1; p.rot = flipRot; this.lastBlockedRotTime = 0;
          if (this.isLocal) sound.playSE('rotate');
          return true;
        }
      }
      this.lastBlockedRotTime = now;
      return false;
    }

    hardDrop() {
      if (this.dead || this.phase !== 'active' || !this.current) return;
      while (this.move(0, 1, true)) {}
      this.lockPair();
    }

    lockPair() {
      if (!this.current) return;
      if (this.onBeforeLock) this.onBeforeLock(this.takeSnapshot());
      const cells = this.getPairCells();
      for (const cell of cells) {
        if (cell.y >= 0 && cell.y < this.rows) {
          this.grid[cell.y][cell.x] = cell.c;
          if (cell.y === this.rows - 1 || this.grid[cell.y + 1][cell.x] !== 0) {
            this.triggerSquish(cell.x, cell.y);
          }
        }
      }
      this.current = null;
      if (this.onStat) this.onStat('piece');
      if (this.isLocal) sound.playSE('puyoLand');
      if (this.hasFloatingPuyo()) {
        this.phase = 'chigiri';
        this.phaseTimer = 0.065;
        if (this.isLocal) sound.playSE('puyoChigiri');
      } else {
        this.phase = 'check';
        this.phaseTimer = 0.05;
      }
    }

    hasFloatingPuyo() {
      for (let x = 0; x < this.cols; x++) {
        let seenEmpty = false;
        for (let y = this.rows - 1; y >= 0; y--) {
          if (this.grid[y][x] === 0) seenEmpty = true;
          else if (seenEmpty) return true;
        }
      }
      return false;
    }

    applyGravityStep() {
      let moved = false;
      for (let x = 0; x < this.cols; x++) {
        for (let y = this.rows - 2; y >= 0; y--) {
          if (this.grid[y][x] !== 0 && this.grid[y + 1][x] === 0) {
            this.grid[y + 1][x] = this.grid[y][x];
            this.grid[y][x] = 0;
            moved = true;
            if (y + 1 === this.rows - 1 || this.grid[y + 2][x] !== 0) {
              this.triggerSquish(x, y + 1);
            }
          }
        }
      }
      return moved;
    }

    findPopGroups() {
      const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
      const groups = [];
      for (let y = 1; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const color = this.grid[y][x];
          if (color >= 1 && color <= 5 && !visited[y][x]) {
            const stack = [[x, y]];
            const cells = [];
            visited[y][x] = true;
            while (stack.length) {
              const [cx, cy] = stack.pop();
              cells.push([cx, cy]);
              for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < this.cols && ny >= 1 && ny < this.rows && !visited[ny][nx] && this.grid[ny][nx] === color) {
                  visited[ny][nx] = true;
                  stack.push([nx, ny]);
                }
              }
            }
            if (cells.length >= 4) groups.push({ color, cells });
          }
        }
      }
      return groups;
    }

    addPopup(text, color = '#ff2e93') {
      this.popups.push({ text, color, life: 1.4, maxLife: 1.4, yOffset: 0 });
      if (this.popups.length > 4) this.popups.shift();
    }

    executeCheck() {
      const groups = this.findPopGroups();
      if (groups.length === 0) {
        if (this.chain > 0) {
          const empty = this.grid.every(r => r.every(c => c === 0));
          if (empty) {
            this.allClearActive = true;
            this.addPopup('ALL CLEAR!', '#fde047');
            if (this.onShake) this.onShake(8.5, 0.28);
            if (this.onStat) this.onStat('allclear');
            if (this.isLocal) unlockAchievement('all_clear');
            if (this.isLocal || battle.isSpectate) sound.playSE('perfect');
          }
        }
        if (this.chain === 0 && this.pendingGarbage >= 1) {
          this.dropOjamaBatch();
          this.phase = 'garbageDrop';
          this.phaseTimer = 0.22;
        } else {
          this.spawnNext();
        }
        return;
      }

      this.chain++;
      if (this.onStat) this.onStat('chain', this.chain);
      if (this.isLocal) {
        if (this.chain === 1) addDailyProgress('chains3', 1);
        if (this.chain >= 5) unlockAchievement('chain5');
        if (this.chain >= 10) unlockAchievement('chain10');
      }
      if (this.chain >= 3 && this.onShake) {
        this.onShake(4.5 + Math.min(6, this.chain), 0.22);
      }

      const colorSet = new Set();
      let totalCleared = 0;
      let groupBonus = 0;
      const toPop = new Set();
      const ojamaPop = new Set();

      for (const g of groups) {
        colorSet.add(g.color);
        totalCleared += g.cells.length;
        groupBonus += PUYO_GROUP_BONUS[Math.min(PUYO_GROUP_BONUS.length - 1, g.cells.length)];
        for (const [cx, cy] of g.cells) {
          toPop.add(`${cx},${cy}`);
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.grid[ny][nx] === 9) {
              ojamaPop.add(`${nx},${ny}`);
            }
          }
        }
      }

      const chainPower = PUYO_CHAIN_POWER[Math.min(PUYO_CHAIN_POWER.length - 1, this.chain)];
      const colorBonus = PUYO_COLOR_BONUS[Math.min(PUYO_COLOR_BONUS.length - 1, colorSet.size)];
      const mult = Math.max(1, chainPower + colorBonus + groupBonus);
      const pts = totalCleared * 10 * mult;
      this.score += pts;

      let nuisancePts = pts + this.nuisanceCarry;
      let ojamas = Math.floor(nuisancePts / 70);
      this.nuisanceCarry = nuisancePts % 70;

      if (this.allClearActive) {
        ojamas += 30;
        this.allClearActive = false;
      }

      if (this.chain === 1 && this.onClearEvent) {
        const swapBonus = this.onClearEvent('puyo', `${this.chain} CHAIN!`);
        ojamas += swapBonus;
      }

      this.popCells = [...toPop, ...ojamaPop].map(s => s.split(',').map(Number));
      this.addPopup(`${this.chain} CHAIN!`, this.chain >= 4 ? '#fde047' : '#ff2e93');
      if (this.isLocal || battle.isSpectate) sound.playSE('puyoPop', this.chain);

      if (ojamas > 0) {
        if (this.onStat) this.onStat('attack', ojamas * 0.25);
        if (this.pendingGarbage > 0) {
          const canceled = Math.min(this.pendingGarbage, ojamas);
          this.pendingGarbage = Math.max(0, this.pendingGarbage - canceled);
          if (this.pendingGarbage < 0.001) this.pendingGarbage = 0;
          ojamas = Math.max(0, ojamas - canceled);
          this.addPopup('COUNTER!', '#4ade80');
          if (this.onStat) this.onStat('counter', Math.round(canceled * 0.25 * 10) / 10);
          if (this.isLocal || battle.isSpectate) sound.playSE('counter');
        }
        if (ojamas > 0 && this.onAttack) {
          this.onAttack('puyo', ojamas, `${this.chain} CHAIN!`);
        }
      }

      this.phase = 'popping';
      this.phaseTimer = 0.32;
    }

    dropOjamaBatch() {
      const maxDrop = 30;
      const amount = Math.min(maxDrop, Math.floor(this.pendingGarbage));
      this.pendingGarbage = Math.max(0, this.pendingGarbage - amount);
      if (this.pendingGarbage < 0.001) this.pendingGarbage = 0;
      const fullRows = Math.floor(amount / this.cols);
      const rem = amount % this.cols;
      const dropInCol = (col) => {
        for (let y = this.rows - 1; y >= 0; y--) {
          if (this.grid[y][col] === 0) {
            this.grid[y][col] = 9;
            this.triggerSquish(col, y);
            break;
          }
        }
      };
      for (let r = 0; r < fullRows; r++) {
        for (let c = 0; c < this.cols; c++) dropInCol(c);
      }
      if (rem > 0) {
        const cols = [0, 1, 2, 3, 4, 5];
        for (let i = cols.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cols[i], cols[j]] = [cols[j], cols[i]];
        }
        for (let i = 0; i < rem; i++) dropInCol(cols[i]);
      }
      if (this.onShake) this.onShake(7, 0.24);
      if (this.isLocal || battle.isSpectate) sound.playSE('garbageFall');
    }

    receiveGarbage(ojamasFloat) {
      this.pendingGarbage += ojamasFloat;
      if (this.isLocal && ojamasFloat >= 1) sound.playSE('warning');
    }

    update(dt, softDropHeld) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.squish[r][c] > 0) {
            this.squish[r][c] = Math.max(0, this.squish[r][c] - dt * 4.2);
          }
        }
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        this.popups[i].life -= dt;
        this.popups[i].yOffset -= dt * 26;
        if (this.popups[i].life <= 0) this.popups.splice(i, 1);
      }
      if (this.dead) return;

      if (this.phase === 'active') {
        if (!this.current) return;
        const zeroG = this.isLocal && battle.zeroGravity;
        const sdfSetting = this.isLocal ? profile.settings.sdf : '20';
        const sdfMult = sdfSetting === 'inf' ? 40 : (parseInt(sdfSetting, 10) || 20);
        const interval = softDropHeld ? Math.max(0.015, 0.55 / sdfMult) : 0.55;
        if (!zeroG || softDropHeld) {
          this.gravTimer += dt;
          while (this.gravTimer >= interval) {
            this.gravTimer -= interval;
            if (!this.move(0, 1, softDropHeld)) { this.gravTimer = 0; break; }
          }
        }
        const grounded = this.pairCollides(this.current.x, this.current.y + 1, this.current.rot);
        if (grounded && (!zeroG || softDropHeld)) {
          this.lockTimer += dt * (softDropHeld ? 2.5 : 1);
          if (this.lockTimer >= 0.42) this.lockPair();
        } else {
          this.lockTimer = 0;
        }
      } else if (this.phase === 'chigiri' || this.phase === 'falling') {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          if (this.applyGravityStep()) this.phaseTimer = 0.035;
          else { this.phase = 'check'; this.phaseTimer = 0.07; }
        }
      } else if (this.phase === 'check') {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.executeCheck();
      } else if (this.phase === 'popping') {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          for (const [x, y] of this.popCells) this.grid[y][x] = 0;
          this.popCells = [];
          this.phase = 'falling';
          this.phaseTimer = 0.05;
        }
      } else if (this.phase === 'garbageDrop') {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.spawnNext();
      }
    }

    serialize() {
      return {
        k: 'p',
        g: this.grid,
        c: this.current,
        q: this.queue.slice(0, 2),
        pg: Math.round(this.pendingGarbage * 10) / 10,
        sc: this.score,
        ac: this.allClearActive,
        d: this.dead
      };
    }

    applyRemote(s) {
      if (!s || s.k !== 'p') return;
      this.grid = s.g;
      this.current = s.c;
      this.queue = s.q || [];
      this.pendingGarbage = s.pg || 0;
      this.score = s.sc || 0;
      this.allClearActive = !!s.ac;
      this.dead = !!s.d;
    }
  }

  /* =========================================================================
     6. CANVAS RENDERER (JELLY PUYO, COLOR-SPECIFIC EYES, PUNYON, GHOST, SHAKE)
     ========================================================================= */
  function drawBevelBlock(ctx, x, y, s, color, alpha = 1, pieceType = null) {
    const skin = profile.activeSkin || 'classic';
    ctx.save();
    ctx.globalAlpha = alpha;
    if (skin === 'flat') {
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    } else if (skin === 'neonwire') {
      ctx.fillStyle = '#050811';
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.shadowBlur = 8; ctx.shadowColor = color;
      ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = color; ctx.globalAlpha = alpha * 0.22;
      ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
      ctx.globalAlpha = alpha;
    } else if (skin === 'crystal') {
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.48)';
      ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + s - 1, y + 1); ctx.lineTo(x + s / 2, y + s / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + s / 2, y + s / 2); ctx.lineTo(x + 1, y + s - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.moveTo(x + s - 1, y + s - 1); ctx.lineTo(x + 1, y + s - 1); ctx.lineTo(x + s / 2, y + s / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x + s * 0.22, y + s * 0.22, Math.max(2, s * 0.14), Math.max(2, s * 0.14));
    } else if (skin === 'retro8') {
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      const px = Math.max(2, Math.floor(s * 0.18));
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(x + 2, y + 2, px, px);
      ctx.fillRect(x + 2 + px, y + 2, px, Math.max(1, px / 2));
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + 1, y + s - px, s - 2, px - 1);
      ctx.fillRect(x + s - px, y + 1, px - 1, s - 2);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillRect(x + 1, y + 1, s - 2, Math.max(2, s * 0.16));
      ctx.fillRect(x + 1, y + 1, Math.max(2, s * 0.16), s - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(x + 1, y + s - Math.max(2, s * 0.16) - 1, s - 2, Math.max(2, s * 0.16));
      ctx.fillRect(x + s - Math.max(2, s * 0.16) - 1, y + 1, Math.max(2, s * 0.16), s - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + s * 0.25, y + s * 0.25, s * 0.5, s * 0.5);
    }

    if (profile.settings.colorblind && s >= 12) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
      if (pieceType && pieceType !== 'G') {
        const cx = x + s / 2, cy = y + s / 2, d = s * 0.22;
        ctx.strokeStyle = 'rgba(255,255,255,0.72)';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.lineWidth = 1.6;
        if (pieceType === 'I') {
          ctx.beginPath(); ctx.moveTo(cx - d, cy); ctx.lineTo(cx + d, cy); ctx.stroke();
        } else if (pieceType === 'O') {
          ctx.strokeRect(cx - d * 0.85, cy - d * 0.85, d * 1.7, d * 1.7);
        } else if (pieceType === 'T') {
          ctx.beginPath(); ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy + d * 0.8); ctx.lineTo(cx - d, cy + d * 0.8); ctx.closePath(); ctx.stroke();
        } else if (pieceType === 'S') {
          ctx.beginPath(); ctx.moveTo(cx - d, cy + d); ctx.lineTo(cx + d, cy - d); ctx.stroke();
        } else if (pieceType === 'Z') {
          ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
        } else if (pieceType === 'J') {
          ctx.beginPath(); ctx.arc(cx, cy, d * 0.65, 0, Math.PI * 2); ctx.fill();
        } else if (pieceType === 'L') {
          ctx.beginPath(); ctx.moveTo(cx - d, cy); ctx.lineTo(cx + d, cy); ctx.moveTo(cx, cy - d); ctx.lineTo(cx, cy + d); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawPuyoCbSymbol(ctx, cx, cy, size, colorCode) {
    if (!profile.settings.colorblind || colorCode < 1 || colorCode > 5) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = Math.max(1.4, size * 0.18);
    if (colorCode === 1) {
      ctx.beginPath(); ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (colorCode === 2) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.56);
      ctx.lineTo(cx + size * 0.55, cy + size * 0.44);
      ctx.lineTo(cx - size * 0.55, cy + size * 0.44);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (colorCode === 3) {
      const d = size * 0.46;
      ctx.fillRect(cx - d, cy - d, d * 2, d * 2);
      ctx.strokeRect(cx - d, cy - d, d * 2, d * 2);
    } else if (colorCode === 4) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = (i % 2 === 0) ? size * 0.62 : size * 0.27;
        const ang = -Math.PI / 2 + i * Math.PI / 5;
        const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (colorCode === 5) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.58);
      ctx.lineTo(cx + size * 0.52, cy);
      ctx.lineTo(cx, cy + size * 0.58);
      ctx.lineTo(cx - size * 0.52, cy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPuyoCell(ctx, x, y, s, colorCode, neighbors = 0, flash = false, squishVal = 0) {
    const pal = PUYO_PALETTE[colorCode] || PUYO_PALETTE[9];
    const skin = profile.activeSkin || 'classic';
    const cx = x + s / 2, cy = y + s / 2, r = s * 0.44;
    ctx.save();

    if (squishVal > 0.01) {
      const phase = (1 - squishVal) * Math.PI * 2.2;
      const amp = Math.sin(phase) * squishVal * 0.22;
      ctx.translate(cx, y + s);
      ctx.scale(1 + amp, 1 - amp);
      ctx.translate(-cx, -(y + s));
    }

    if (flash) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.04);
      ctx.shadowBlur = 14; ctx.shadowColor = '#fff';
    }

    const grad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, r * 0.12, cx, cy, r * 1.08);
    grad.addColorStop(0, pal.light);
    grad.addColorStop(0.55, pal.main);
    grad.addColorStop(1, pal.dark);
    const bodyFill = skin === 'flat' ? pal.main : (skin === 'neonwire' ? '#050811' : grad);

    if (colorCode >= 1 && colorCode <= 5 && neighbors !== 0) {
      ctx.fillStyle = skin === 'neonwire' ? pal.dark : bodyFill;
      if (neighbors & 1) ctx.fillRect(cx - r * 0.72, y, r * 1.44, s * 0.52);
      if (neighbors & 4) ctx.fillRect(cx - r * 0.72, cy, r * 1.44, s * 0.52);
      if (neighbors & 2) ctx.fillRect(cx, cy - r * 0.72, s * 0.52, r * 1.44);
      if (neighbors & 8) ctx.fillRect(x, cy - r * 0.72, s * 0.52, r * 1.44);
    }

    ctx.fillStyle = bodyFill;
    ctx.beginPath();
    if (skin === 'retro8') {
      ctx.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.35);
    } else {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
    if (skin === 'neonwire') {
      ctx.strokeStyle = pal.main;
      ctx.lineWidth = Math.max(2.2, s * 0.08);
      ctx.shadowBlur = 10; ctx.shadowColor = pal.main;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = colorCode === 9 ? 'rgba(255,255,255,0.75)' : (skin === 'flat' ? 'rgba(0,0,0,0.5)' : 'rgba(15,23,42,0.42)');
      ctx.lineWidth = Math.max(1.2, s * 0.045);
      ctx.stroke();
    }
    if (skin === 'crystal' && colorCode !== 9) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.88); ctx.lineTo(cx + r * 0.72, cy - r * 0.15);
      ctx.lineTo(cx, cy + r * 0.1); ctx.lineTo(cx - r * 0.72, cy - r * 0.15);
      ctx.closePath(); ctx.fill();
    }

    if (colorCode === 9) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(cx - r * 0.26, cy - r * 0.26, r * 0.24, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.52)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.28, cy - r * 0.36, r * 0.3, r * 0.16, -0.48, 0, Math.PI * 2);
      ctx.fill();

      if (s >= 16) {
        const cbOn = !!profile.settings.colorblind;
        const exL = cx - r * 0.32, exR = cx + r * 0.32, ey = cbOn ? (cy - r * 0.22) : (cy - r * 0.02);
        const er = Math.max(2.2, s * 0.12);

        if (colorCode === 4) {
          ctx.strokeStyle = '#422006';
          ctx.lineWidth = Math.max(1.8, s * 0.065);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(exL, ey + er * 0.25, er * 0.9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
          ctx.beginPath(); ctx.arc(exR, ey + er * 0.25, er * 0.9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(exL, ey, er, 0, Math.PI * 2);
          ctx.arc(exR, ey, er, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          const pyOff = colorCode === 2 ? er * 0.15 : 0;
          ctx.beginPath();
          ctx.arc(exL + er * 0.1, ey + pyOff, er * 0.56, 0, Math.PI * 2);
          ctx.arc(exR - er * 0.1, ey + pyOff, er * 0.56, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(exL - er * 0.12, ey - er * 0.18, er * 0.22, 0, Math.PI * 2);
          ctx.arc(exR - er * 0.28, ey - er * 0.18, er * 0.22, 0, Math.PI * 2);
          ctx.fill();

          if (colorCode === 2) {
            ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = Math.max(1.4, s * 0.05); ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(exL - er, ey - er * 0.65); ctx.lineTo(exL + er * 0.7, ey - er * 1.15);
            ctx.moveTo(exR + er, ey - er * 0.65); ctx.lineTo(exR - er * 0.7, ey - er * 1.15);
            ctx.stroke();
          } else if (colorCode === 3) {
            ctx.strokeStyle = '#14532d'; ctx.lineWidth = Math.max(1.6, s * 0.055); ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(exL - er * 0.9, ey - er * 1.1); ctx.lineTo(exL + er * 0.9, ey - er * 0.55);
            ctx.moveTo(exR + er * 0.9, ey - er * 1.1); ctx.lineTo(exR - er * 0.9, ey - er * 0.55);
            ctx.stroke();
          } else if (colorCode === 5) {
            ctx.fillStyle = pal.dark;
            ctx.fillRect(exL - er * 1.05, ey - er * 1.05, er * 2.1, er * 0.72);
            ctx.fillRect(exR - er * 1.05, ey - er * 1.05, er * 2.1, er * 0.72);
          }
        }
        if (cbOn) {
          drawPuyoCbSymbol(ctx, cx, cy + r * 0.36, Math.max(8, s * 0.32), colorCode);
        }
      } else if (profile.settings.colorblind) {
        drawPuyoCbSymbol(ctx, cx, cy, Math.max(6, s * 0.45), colorCode);
      }
    }
    ctx.restore();
  }

  function drawOjamaIcons(ctx, x, y, count) {
    let rem = Math.floor(count);
    const icons = [];
    const tiers = [
      { v: 720, sym: '👑', col: '#fde047' },
      { v: 360, sym: '🌙', col: '#fbbf24' },
      { v: 180, sym: '⭐', col: '#38bdf8' },
      { v: 30,  sym: '🪨', col: '#f87171' },
      { v: 6,   sym: '●',  col: '#e2e8f0' },
      { v: 1,   sym: '•',  col: '#94a3b8' }
    ];
    for (const t of tiers) {
      while (rem >= t.v && icons.length < 6) { icons.push(t); rem -= t.v; }
    }
    ctx.save();
    ctx.fillStyle = (activeThemeObj && activeThemeObj.sideBoxBg) || 'rgba(15,23,42,0.85)';
    ctx.strokeStyle = count >= 1 ? 'rgba(239,68,68,0.65)' : 'rgba(148,163,184,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, 228, 30, 8); ctx.fill(); ctx.stroke();

    if (icons.length === 0) {
      ctx.fillStyle = 'rgba(148,163,184,0.45)';
      ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('OJAMA: 0', x + 114, y + 19);
    } else {
      ctx.textAlign = 'left'; ctx.font = 'bold 16px sans-serif';
      icons.forEach((ic, idx) => { ctx.fillStyle = ic.col; ctx.fillText(ic.sym, x + 12 + idx * 34, y + 21); });
      ctx.fillStyle = '#fca5a5'; ctx.font = '800 11px monospace'; ctx.textAlign = 'right';
      ctx.fillText(String(Math.floor(count)), x + 220, y + 19);
    }
    ctx.restore();
  }

  function renderPlayerCanvas(canvas, activeStyle, tetris, puyo, isSwap, showGhost = true, shake = null) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = activeThemeObj.canvasBg;
    ctx.fillRect(0, 0, W, H);

    if (shake && shake.time > 0) {
      const dx = (Math.random() - 0.5) * 2 * shake.mag;
      const dy = (Math.random() - 0.5) * 2 * shake.mag;
      ctx.translate(dx, dy);
    }

    if (activeStyle === 'tetris') {
      renderTetrisMain(ctx, tetris, 118, 22, 26, showGhost);
      if (isSwap && puyo) renderPuyoMini(ctx, puyo, 404, 336, 18);
    } else {
      renderPuyoMain(ctx, puyo, 96, 56, 40, showGhost);
      if (isSwap && tetris) renderTetrisMini(ctx, tetris, 388, 286, 13);
    }
    ctx.restore();
  }

  function renderTetrisMain(ctx, b, bx, by, cell, showGhost) {
    const bw = b.cols * cell, bh = 20 * cell;
    const danger = !b.dead && b.isInDanger();
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.014);

    ctx.fillStyle = activeThemeObj.sideBoxBg;
    ctx.strokeStyle = activeThemeObj.sideBoxBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(14, by, 84, 88, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = activeThemeObj.labelT; ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HOLD', 56, by + 16);
    if (b.hold) {
      const cells = TETRIS_SHAPES[b.hold][0];
      for (const [cx, cy] of cells) {
        drawBevelBlock(ctx, 26 + cx * 15, by + 32 + cy * 15, 15, TETRIS_COLORS[b.hold], b.canHold ? 1 : 0.4, b.hold);
      }
    }

    const gBarX = bx - 14;
    ctx.fillStyle = activeThemeObj.sideBoxBg || '#0f172a';
    ctx.fillRect(gBarX, by, 10, bh);
    const qList = (b.garbageQueue && b.garbageQueue.length > 0)
      ? b.garbageQueue
      : (b.pendingGarbage > 0 ? [{ lines: b.pendingGarbage, delay: 0, maxDelay: 0.8 }] : []);
    if (qList.length > 0) {
      let curBottom = by + bh;
      const flashOn = Math.floor(performance.now() / 130) % 2 === 0;
      for (const g of qList) {
        if (curBottom <= by) break;
        const segH = Math.min(curBottom - by, g.lines * cell);
        if (segH <= 0.5) continue;
        let col = '#eab308';
        if (g.delay <= 0) {
          col = flashOn ? '#ef4444' : '#fca5a5';
        } else if (g.delay <= (g.maxDelay || 1) * 0.45) {
          col = '#f97316';
        }
        ctx.fillStyle = col;
        if (g.delay <= 0 && !(activeThemeObj && activeThemeObj.noGlow)) {
          ctx.shadowBlur = 8; ctx.shadowColor = '#ef4444';
        }
        ctx.fillRect(gBarX, curBottom - segH, 10, segH);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(gBarX, curBottom - segH, 10, 1);
        curBottom -= segH;
      }
    }

    ctx.fillStyle = danger ? `rgba(45, 10, 20, ${0.4 + pulse * 0.3})` : activeThemeObj.fieldBg;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = activeThemeObj.gridLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= b.cols; x++) {
      ctx.beginPath(); ctx.moveTo(bx + x * cell, by); ctx.lineTo(bx + x * cell, by + bh); ctx.stroke();
    }
    for (let y = 0; y <= 20; y++) {
      ctx.beginPath(); ctx.moveTo(bx, by + y * cell); ctx.lineTo(bx + bw, by + y * cell); ctx.stroke();
    }

    for (const tr of b.trails) {
      const grad = ctx.createLinearGradient(0, by + (tr.y1 - 2) * cell, 0, by + (tr.y2 - 2) * cell);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, tr.color);
      ctx.save();
      ctx.globalAlpha = tr.alpha * 0.45;
      ctx.fillStyle = grad;
      ctx.fillRect(bx + tr.x * cell + 3, by + (tr.y1 - 2) * cell, cell - 6, Math.max(4, (tr.y2 - tr.y1) * cell));
      ctx.restore();
    }

    for (let r = 2; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const t = b.grid[r][c];
        if (t) drawBevelBlock(ctx, bx + c * cell, by + (r - 2) * cell, cell, TETRIS_COLORS[t], 1, t);
      }
    }

    for (const fl of b.clearFlash) {
      if (fl.row >= 2) {
        ctx.fillStyle = `rgba(255,255,255,${fl.alpha})`;
        ctx.fillRect(bx, by + (fl.row - 2) * cell, bw, cell);
      }
    }

    if (b.current && !b.dead) {
      const cells = TETRIS_SHAPES[b.current.type][b.current.rot];
      if (showGhost) {
        const gy = b.getGhostY();
        for (const [cx, cy] of cells) {
          const ry = gy + cy - 2;
          if (ry >= 0) {
            ctx.save();
            ctx.strokeStyle = TETRIS_COLORS[b.current.type];
            ctx.globalAlpha = 0.48; ctx.lineWidth = 2;
            ctx.strokeRect(bx + (b.current.x + cx) * cell + 2, by + ry * cell + 2, cell - 4, cell - 4);
            ctx.restore();
          }
        }
      }
      for (const [cx, cy] of cells) {
        const ry = b.current.y + cy - 2;
        if (ry >= 0) drawBevelBlock(ctx, bx + (b.current.x + cx) * cell, by + ry * cell, cell, TETRIS_COLORS[b.current.type], 1, b.current.type);
      }
    }

    ctx.save();
    if (danger) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.55 + pulse * 0.45})`;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 14; ctx.shadowColor = '#ef4444';
    } else {
      ctx.strokeStyle = b.dead ? '#ef4444' : activeThemeObj.tetrisBorder;
      ctx.lineWidth = 2;
    }
    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();

    if (danger) {
      ctx.save();
      ctx.globalAlpha = 0.65 + pulse * 0.35;
      ctx.fillStyle = '#ef4444'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⚠ DANGER!', bx + bw / 2, by - 6);
      ctx.restore();
    }

    const nx = bx + bw + 14;
    ctx.fillStyle = activeThemeObj.sideBoxBg;
    ctx.strokeStyle = activeThemeObj.sideBoxBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(nx, by, 114, 278, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = activeThemeObj.labelT; ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NEXT (5)', nx + 57, by + 16);
    for (let i = 0; i < Math.min(5, b.queue.length); i++) {
      const type = b.queue[i];
      const cells = TETRIS_SHAPES[type][0];
      const sz = i === 0 ? 14 : 12;
      const ox = nx + (i === 0 ? 29 : 33);
      const oy = by + 26 + i * 49;
      for (const [cx, cy] of cells) {
        drawBevelBlock(ctx, ox + cx * sz, oy + cy * sz, sz, TETRIS_COLORS[type], 1, type);
      }
    }

    for (const pop of b.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, pop.life / pop.maxLife * 1.4);
      ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center';
      ctx.shadowBlur = 14; ctx.shadowColor = pop.color;
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, bx + bw / 2, by + bh * 0.42 + pop.yOffset);
      ctx.restore();
    }

    if (b.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#f87171'; ctx.font = '900 32px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('K.O.', bx + bw / 2, by + bh / 2);
    }
  }

  function renderPuyoMain(ctx, b, bx, by, cell, showGhost = true) {
    const bw = b.cols * cell, bh = 12 * cell;
    const danger = !b.dead && b.isInDanger();
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.014);

    drawOjamaIcons(ctx, bx + 6, by - 40, b.pendingGarbage);

    ctx.fillStyle = danger ? `rgba(45, 10, 20, ${0.4 + pulse * 0.3})` : activeThemeObj.fieldBg;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = activeThemeObj.gridLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= b.cols; x++) {
      ctx.beginPath(); ctx.moveTo(bx + x * cell, by); ctx.lineTo(bx + x * cell, by + bh); ctx.stroke();
    }
    for (let y = 0; y <= 12; y++) {
      ctx.beginPath(); ctx.moveTo(bx, by + y * cell); ctx.lineTo(bx + bw, by + y * cell); ctx.stroke();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(239,68,68,0.75)'; ctx.lineWidth = 3;
    const xx = bx + 2 * cell + 8, xy = by + 8, xs = cell - 16;
    ctx.beginPath(); ctx.moveTo(xx, xy); ctx.lineTo(xx + xs, xy + xs);
    ctx.moveTo(xx + xs, xy); ctx.lineTo(xx, xy + xs); ctx.stroke();
    ctx.restore();

    const popSet = new Set(b.popCells.map(([x, y]) => `${x},${y}`));
    for (let r = 1; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const col = b.grid[r][c];
        if (col === 0) continue;
        let mask = 0;
        if (col >= 1 && col <= 5) {
          if (r > 1 && b.grid[r - 1][c] === col) mask |= 1;
          if (c < b.cols - 1 && b.grid[r][c + 1] === col) mask |= 2;
          if (r < b.rows - 1 && b.grid[r + 1][c] === col) mask |= 4;
          if (c > 0 && b.grid[r][c - 1] === col) mask |= 8;
        }
        const sq = b.squish ? b.squish[r][c] : 0;
        drawPuyoCell(ctx, bx + c * cell, by + (r - 1) * cell, cell, col, mask, popSet.has(`${c},${r}`), sq);
      }
    }

    if (showGhost && b.current && b.phase === 'active' && !b.dead) {
      const ghosts = b.getGhostCells();
      for (const g of ghosts) {
        if (g.y >= 1) {
          const pal = PUYO_PALETTE[g.c] || PUYO_PALETTE[9];
          const gx = bx + g.x * cell + cell / 2;
          const gy = by + (g.y - 1) * cell + cell / 2;
          ctx.save();
          ctx.globalAlpha = 0.25; ctx.fillStyle = pal.main;
          ctx.beginPath(); ctx.arc(gx, gy, cell * 0.34, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.65; ctx.strokeStyle = pal.light; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(gx, gy, cell * 0.34, 0, Math.PI * 2); ctx.stroke();
          if (profile.settings.colorblind) {
            ctx.globalAlpha = 0.8;
            drawPuyoCbSymbol(ctx, gx, gy, cell * 0.32, g.c);
          }
          ctx.restore();
        }
      }
    }

    if (b.current && b.phase === 'active' && !b.dead) {
      const cells = b.getPairCells();
      for (const p of cells) {
        if (p.y >= 1) drawPuyoCell(ctx, bx + p.x * cell, by + (p.y - 1) * cell, cell, p.c, 0, false, 0);
      }
    }

    ctx.save();
    if (danger) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.55 + pulse * 0.45})`;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 14; ctx.shadowColor = '#ef4444';
    } else {
      ctx.strokeStyle = b.dead ? '#ef4444' : activeThemeObj.puyoBorder;
      ctx.lineWidth = 2;
    }
    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();

    if (danger) {
      ctx.save();
      ctx.globalAlpha = 0.65 + pulse * 0.35;
      ctx.fillStyle = '#ef4444'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⚠ DANGER!', bx + bw / 2, by + bh + 18);
      ctx.restore();
    }

    const nx = bx + bw + 18;
    ctx.fillStyle = activeThemeObj.sideBoxBg;
    ctx.strokeStyle = activeThemeObj.sideBoxBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(nx, by, 108, 196, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = activeThemeObj.labelP; ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NEXT', nx + 54, by + 16);
    if (b.queue[0]) {
      drawPuyoCell(ctx, nx + 36, by + 26, 34, b.queue[0][1]);
      drawPuyoCell(ctx, nx + 36, by + 60, 34, b.queue[0][0]);
    }
    ctx.fillStyle = '#94a3b8'; ctx.font = '700 10px sans-serif';
    ctx.fillText('NEXT 2', nx + 54, by + 114);
    if (b.queue[1]) {
      drawPuyoCell(ctx, nx + 40, by + 122, 28, b.queue[1][1]);
      drawPuyoCell(ctx, nx + 40, by + 150, 28, b.queue[1][0]);
    }

    if (b.allClearActive) {
      ctx.fillStyle = '#fde047'; ctx.font = '900 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('★ ALL CLEAR READY', bx + bw / 2, by + bh + (danger ? 34 : 18));
    }

    for (const pop of b.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, pop.life / pop.maxLife * 1.4);
      ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center';
      ctx.shadowBlur = 14; ctx.shadowColor = pop.color;
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, bx + bw / 2, by + bh * 0.42 + pop.yOffset);
      ctx.restore();
    }

    if (b.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#f87171'; ctx.font = '900 32px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('K.O.', bx + bw / 2, by + bh / 2);
    }
  }

  function renderPuyoMini(ctx, b, bx, by, cell) {
    const bw = b.cols * cell, bh = 12 * cell;
    ctx.fillStyle = activeThemeObj.sideBoxBg;
    ctx.strokeStyle = activeThemeObj.sideBoxBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx - 6, by - 22, bw + 12, bh + 28, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = activeThemeObj.labelP; ctx.font = '800 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SWAP: PUYO', bx + bw / 2, by - 7);
    ctx.fillStyle = activeThemeObj.fieldBg; ctx.fillRect(bx, by, bw, bh);
    for (let r = 1; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        if (b.grid[r][c]) drawPuyoCell(ctx, bx + c * cell, by + (r - 1) * cell, cell, b.grid[r][c]);
      }
    }
  }

  function renderTetrisMini(ctx, b, bx, by, cell) {
    const bw = b.cols * cell, bh = 20 * cell;
    ctx.fillStyle = activeThemeObj.sideBoxBg;
    ctx.strokeStyle = activeThemeObj.sideBoxBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx - 6, by - 22, bw + 12, bh + 28, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = activeThemeObj.labelT; ctx.font = '800 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SWAP: TETRIS', bx + bw / 2, by - 7);
    ctx.fillStyle = activeThemeObj.fieldBg; ctx.fillRect(bx, by, bw, bh);
    for (let r = 2; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        if (b.grid[r][c]) drawBevelBlock(ctx, bx + c * cell, by + (r - 2) * cell, cell, TETRIS_COLORS[b.grid[r][c]]);
      }
    }
  }

  /* =========================================================================
     7. ADVANCED CPU AI (NATURAL SRS T-SPIN, 2-PLY PC SEARCH, 2-PLY PUYO BEAM)
     ========================================================================= */
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
            const st = [[c, r]];
            const cells = [];
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
      const pts = cleared * 10 * Math.max(1, cp + cb + gBonus);
      totalOjamas += Math.floor(pts / 70);
      applyGrav();
    }
    return { chain, totalOjamas, totalCleared, died: grid[1][2] !== 0 };
  }

  function simPuyoDrop(origGrid, x, rot, axis, child) {
    const [ox, oy] = CHILD_OFFSETS[rot];
    const x1 = x, x2 = x + ox;
    if (x1 < 0 || x1 >= 6 || x2 < 0 || x2 >= 6) return null;
    const g = clonePuyoGrid(origGrid);
    const colTop = (c) => {
      for (let r = 12; r >= 0; r--) if (g[r][c] === 0) return r;
      return -1;
    };
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
      g[r1][x1] = axis;
      g[r2][x2] = child;
    }
    const res = simPuyoSettleAndChain(g);
    res.grid = g;
    res.isChigiri = isChigiri;
    return res;
  }

  function probeMaxPotentialChain(grid, maxTriggers = 2) {
    let bestChain = 0;
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
        if (s1.chain > bestChain) bestChain = s1.chain;
        if (maxTriggers >= 2 && s1.chain === 0 && r >= 2) {
          const g2 = clonePuyoGrid(grid);
          g2[r][c] = col;
          g2[r - 1][c] = col;
          const s2 = simPuyoSettleAndChain(g2);
          if (s2.chain > bestChain) bestChain = s2.chain;
        }
      }
    }
    return bestChain;
  }

  function simTetrisDropOnGrid(grid, type, x, rot) {
    const rows = 22, cols = 10;
    const cells = TETRIS_SHAPES[type][rot];
    const collides = (px, py) => {
      for (const [cx, cy] of cells) {
        const nx = px + cx, ny = py + cy;
        if (nx < 0 || nx >= cols || ny >= rows) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
      return false;
    };
    if (collides(x, 0)) return null;
    let y = 0;
    while (!collides(x, y + 1)) y++;
    const g = grid.map(r => r.slice());
    for (const [cx, cy] of cells) {
      if (y + cy < 0 || y + cy >= rows) return null;
      g[y + cy][x + cx] = type;
    }
    let lines = 0;
    const kept = [];
    for (let r = 0; r < rows; r++) {
      if (g[r].every(c => c !== null)) lines++;
      else kept.push(g[r]);
    }
    while (kept.length < rows) kept.unshift(Array(cols).fill(null));
    let filled = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (kept[r][c]) filled++;
    return { grid: kept, lines, filled, y };
  }

  function countTSpinSlots(grid) {
    let slots = 0;
    for (let r = 10; r < 21; r++) {
      for (let c = 1; c < 9; c++) {
        if (!grid[r][c] && grid[r][c - 1] && grid[r][c + 1] &&
            !grid[r - 1][c] && !grid[r - 1][c - 1] && !grid[r - 1][c + 1]) {
          const roofL = grid[r - 2][c - 1] && !grid[r - 2][c];
          const roofR = grid[r - 2][c + 1] && !grid[r - 2][c];
          if (roofL !== roofR) slots++;
        }
      }
    }
    return slots;
  }

  function probePotentialChainDetailed(grid, maxTriggers = 2) {
    let bestChain = 0;
    let bestOjamas = 0;
    let accessibleTrigger = false;
    let triggerCol = -1;
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
          bestChain = s1.chain;
          bestOjamas = s1.totalOjamas;
          accessibleTrigger = (r >= 2);
          triggerCol = c;
        }
        if (maxTriggers >= 2 && s1.chain === 0 && r >= 2) {
          const g2 = clonePuyoGrid(grid);
          g2[r][c] = col;
          g2[r - 1][c] = col;
          const s2 = simPuyoSettleAndChain(g2);
          if (s2.chain > bestChain || (s2.chain === bestChain && s2.totalOjamas > bestOjamas)) {
            bestChain = s2.chain;
            bestOjamas = s2.totalOjamas;
            accessibleTrigger = (r >= 3);
            triggerCol = c;
          }
        }
      }
    }
    return { maxChain: bestChain, maxOjamas: bestOjamas, accessibleTrigger, triggerCol };
  }

  function countTSpinSlotsDetailed(grid) {
    let tsd = 0;
    let tst = 0;
    for (let r = 8; r < 21; r++) {
      for (let c = 1; c < 9; c++) {
        // Classic TSD pocket: 1-wide bottom hole with 3-wide open middle row and 1-sided overhang roof
        if (!grid[r][c] && grid[r][c - 1] && grid[r][c + 1] &&
            !grid[r - 1][c] && !grid[r - 1][c - 1] && !grid[r - 1][c + 1]) {
          const roofL = r >= 2 && !!grid[r - 2][c - 1] && !grid[r - 2][c];
          const roofR = r >= 2 && !!grid[r - 2][c + 1] && !grid[r - 2][c];
          if (roofL !== roofR) tsd++;
        }
        // TST overhang notch check (vertical 2-cell cavity with side overhang)
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

  function getTetrisGridStats(grid) {
    const rows = 22, cols = 10;
    const heights = Array(cols).fill(0);
    let holes = 0, coveredCells = 0, shallowestHoleCover = 0;
    let shallowestHoleRow = 99;
    for (let c = 0; c < cols; c++) {
      let topRow = -1;
      for (let r = 0; r < rows; r++) {
        if (grid[r][c]) {
          if (topRow === -1) {
            topRow = r;
            heights[c] = rows - r;
          }
        } else if (topRow !== -1) {
          holes++;
          const coverDepth = r - topRow;
          coveredCells += coverDepth;
          if (r < shallowestHoleRow) {
            shallowestHoleRow = r;
            shallowestHoleCover = coverDepth;
          }
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

  const aiWorkerBridge = (() => {
    let worker = null;
    let failed = false;
    let nextReqId = 1;
    const pending = new Map();

    function createWorker() {
      if (worker) return worker;
      if (failed || typeof Worker === 'undefined') return null;

      const attach = (w) => {
        w.onmessage = (ev) => {
          const data = ev.data;
          if (!data || !data.id) return;
          const entry = pending.get(data.id);
          if (!entry) return;
          pending.delete(data.id);
          clearTimeout(entry.timer);
          entry.resolve(data.plan || null);
        };
        w.onerror = () => {
          for (const [, entry] of pending) {
            clearTimeout(entry.timer);
            entry.resolve(null);
          }
          pending.clear();
          try { w.terminate(); } catch (e) {}
          worker = null;
          failed = true;
        };
        return w;
      };

      const isFileProto = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');
      if (!isFileProto) {
        try {
          worker = attach(new Worker('js/ai.worker.js'));
          return worker;
        } catch (e) {}
      }

      if (typeof window !== 'undefined' && typeof window.__PUYOTET_AI_WORKER_FN === 'function') {
        try {
          const src = '(' + window.__PUYOTET_AI_WORKER_FN.toString() + ')();';
          const blob = new Blob([src], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          worker = attach(new Worker(url));
          return worker;
        } catch (e) {}
      }

      failed = true;
      return null;
    }

    function sendRequest(type, board, oppCtx, moves) {
      const w = createWorker();
      if (!w) return null;
      return new Promise((resolve) => {
        const id = nextReqId++;
        const timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            resolve(null);
          }
        }, 1800);
        pending.set(id, { resolve, timer });
        try {
          w.postMessage({ id, type, board, oppCtx, moves });
        } catch (e) {
          clearTimeout(timer);
          pending.delete(id);
          resolve(null);
        }
      });
    }

    return {
      isAvailable() { return !failed && typeof Worker !== 'undefined'; },
      requestTetrisPlan(b, oppCtx, moves) {
        const snap = {
          grid: b.grid.map(r => r.slice()),
          current: { type: b.current.type, x: b.current.x, y: b.current.y, rot: b.current.rot },
          queue: b.queue.slice(0, 6),
          hold: b.hold,
          canHold: b.canHold,
          b2b: b.b2b,
          combo: b.combo,
          pendingGarbage: b.pendingGarbage || 0
        };
        return sendRequest('planTetris', snap, oppCtx, moves);
      },
      requestPuyoPlan(b, oppCtx, moves) {
        const snap = {
          grid: b.grid.map(r => r.slice()),
          current: { x: b.current.x, y: b.current.y, rot: b.current.rot, axis: b.current.axis, child: b.current.child },
          queue: b.queue.slice(0, 2).map(pair => pair.slice()),
          pendingGarbage: b.pendingGarbage || 0
        };
        return sendRequest('planPuyo', snap, oppCtx, moves);
      }
    };
  })();

  class CpuController {
    constructor(difficulty) {
      this.difficulty = difficulty;
      this.thinkTimer = 0;
      this.plan = null;
      this.pendingRef = null;
      this.tetrisMoves = 0;
      this.puyoMoves = 0;
    }

    getInterval() {
      if (this.difficulty === 'easy') return 0.30;
      if (this.difficulty === 'normal') return 0.14;
      if (this.difficulty === 'hard') return 0.072;
      return 0.024;
    }

    buildOppContext(oppStyle, oppTetris, oppPuyo) {
      const ctx = { oppDanger: false, oppHighStack: false, oppPendingGarbage: 0, oppStyle: oppStyle || null };
      const ob = oppStyle === 'tetris' ? oppTetris : (oppStyle === 'puyo' ? oppPuyo : null);
      if (!ob || ob.dead) return ctx;
      ctx.oppPendingGarbage = ob.pendingGarbage || 0;
      if (typeof ob.isInDanger === 'function' && ob.isInDanger()) ctx.oppDanger = true;
      if (oppStyle === 'tetris' && ob.grid) {
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            if (ob.grid[r][c]) { ctx.oppHighStack = true; break; }
          }
          if (ctx.oppHighStack) break;
        }
      } else if (oppStyle === 'puyo' && ob.grid) {
        let cnt = 0;
        for (let r = 1; r < 13; r++) {
          for (let c = 0; c < 6; c++) if (ob.grid[r][c] !== 0) cnt++;
        }
        let col2H = 0;
        for (let r = 1; r < 13; r++) if (ob.grid[r][2] !== 0) { col2H = 13 - r; break; }
        if (cnt >= 38 || col2H >= 8) ctx.oppHighStack = true;
      }
      return ctx;
    }

    update(dt, activeStyle, tetris, puyo, oppStyle = null, oppTetris = null, oppPuyo = null) {
      this.thinkTimer += dt;
      if (this.thinkTimer < this.getInterval()) return;
      this.thinkTimer = 0;

      const oppCtx = this.difficulty === 'impossible'
        ? this.buildOppContext(oppStyle, oppTetris, oppPuyo)
        : null;

      if (activeStyle === 'tetris') this.stepTetris(tetris, oppCtx);
      else this.stepPuyo(puyo, oppCtx);
    }

    rotateTetrisShortest(b, targetRot) {
      const diff = ((targetRot - b.current.rot) % 4 + 4) % 4;
      if (diff === 1) b.rotate(1);
      else if (diff === 3) b.rotate(-1);
      else if (diff === 2) {
        if (typeof b.rotate180 === 'function') b.rotate180();
        else b.rotate(1);
      }
    }

    rotatePuyoShortest(b, targetRot) {
      const diff = ((targetRot - b.current.rot) % 4 + 4) % 4;
      if (diff === 3) b.rotate(-1);
      else if (diff !== 0) b.rotate(1);
    }

    stepTetris(b, oppCtx = null) {
      if (b.dead || !b.current) return;
      if (!this.plan || this.plan.ref !== b.current) {
        if (this.difficulty === 'impossible' && aiWorkerBridge.isAvailable()) {
          if (this.pendingRef === b.current) return;
          const ref = b.current;
          this.pendingRef = ref;
          const p = aiWorkerBridge.requestTetrisPlan(b, oppCtx, this.tetrisMoves);
          if (p) {
            p.then((res) => {
              if (this.pendingRef === ref) this.pendingRef = null;
              if (b.dead || b.current !== ref) return;
              this.plan = res ? Object.assign({ ref }, res) : this.planTetris(b, oppCtx);
            });
            return;
          }
          this.pendingRef = null;
        }
        this.plan = this.planTetris(b, oppCtx);
      }
      if (!this.plan) return;
      if (this.plan.useHold && b.canHold) {
        b.doHold(); this.plan = null; return;
      }

      if (this.plan.tspinDir) {
        if (this.plan.stepPhase === 'align') {
          if (b.current.rot !== this.plan.preRot) this.rotateTetrisShortest(b, this.plan.preRot);
          else if (b.current.x < this.plan.preX) { if (!b.move(1, 0)) { b.hardDrop(); this.tetrisMoves++; this.plan = null; } }
          else if (b.current.x > this.plan.preX) { if (!b.move(-1, 0)) { b.hardDrop(); this.tetrisMoves++; this.plan = null; } }
          else this.plan.stepPhase = 'drop';
          return;
        }
        if (this.plan.stepPhase === 'drop') {
          let moved = false;
          for (let k = 0; k < 5; k++) { if (b.move(0, 1, true)) moved = true; else break; }
          if (!moved) this.plan.stepPhase = 'spin';
          return;
        }
        if (this.plan.stepPhase === 'spin') {
          b.rotate(this.plan.tspinDir);
          b.lockPiece();
          this.tetrisMoves++;
          this.plan = null;
          return;
        }
      }

      if (b.current.rot !== this.plan.rot) this.rotateTetrisShortest(b, this.plan.rot);
      else if (b.current.x < this.plan.x) { if (!b.move(1, 0)) { b.hardDrop(); this.tetrisMoves++; this.plan = null; } }
      else if (b.current.x > this.plan.x) { if (!b.move(-1, 0)) { b.hardDrop(); this.tetrisMoves++; this.plan = null; } }
      else { b.hardDrop(); this.tetrisMoves++; this.plan = null; }
    }

    evalTetrisOpeningBonus(type, x, rot, heights, maxH) {
      if (this.tetrisMoves >= 9 || maxH > 5) return 0;
      let bonus = 0;
      if (type === 'I' && rot === 0 && (x === 0 || x === 3)) bonus += 6.5;
      if (type === 'O' && (x === 0 || x === 7)) bonus += 4.5;
      if ((type === 'L' || type === 'J') && (x <= 2 || x >= 6)) bonus += 3.5;
      if ((type === 'S' || type === 'Z') && x >= 1 && x <= 6 && (rot === 0 || rot === 2)) bonus += 3.5;
      if (heights[9] === 0 && heights[8] >= 1) bonus += 2.0;
      return bonus;
    }

    evalTetrisGrid(grid, lines, b, isTSpin, type, x, rot, simState = null, oppCtx = null) {
      const st = getTetrisGridStats(grid);
      const { heights, holes, coveredCells, shallowestHoleCover, aggH, maxH, bump } = st;
      const isPerfect = lines > 0 && aggH === 0;

      if (this.difficulty === 'easy' || this.difficulty === 'normal') {
        const noise = this.difficulty === 'easy' ? 7 : 1.5;
        const holePen = this.difficulty === 'easy' ? 4.8 : 6.8;
        return lines * 5.2 - aggH * 0.50 - holes * holePen - bump * 0.28 + (Math.random() - 0.5) * noise;
      }

      const isImp = this.difficulty === 'impossible';
      if (!isImp) {
        let score = 0;
        if (isPerfect) score += 340;
        if (isTSpin && lines >= 1) {
          score += lines === 3 ? 58 : (lines === 2 ? 40 : 18);
          if (b.b2b) score += 12;
        } else if (lines === 4) {
          score += 30 + (b.b2b ? 10 : 0);
        } else if (lines > 0) {
          if (b.combo >= 0) score += 9 + b.combo * 4.5;
          else if (maxH >= 11 || b.pendingGarbage >= 4) score += lines * 7.2;
          else score -= (b.b2b ? 5.2 : 1.5);
        }
        if (maxH < 14) {
          const tSlots = countTSpinSlots(grid);
          if (tSlots > 0) score += tSlots * 8.5;
        }
        score += this.evalTetrisOpeningBonus(type, x, rot, heights, maxH);
        if (maxH < 12 && heights[9] === 0 && heights[8] >= 2) score += 2.8;
        score -= holes * 8.5 + coveredCells * 0.18 + aggH * 0.45 + bump * 0.36;
        if (maxH >= 15) score -= (maxH - 14) * 5.5;
        return score;
      }

      // === IMPOSSIBLE-ONLY ADVANCED EVALUATION ===
      const curB2B = simState ? simState.b2b : b.b2b;
      const curCombo = simState ? simState.combo : b.combo;
      const prevMaxH = simState ? simState.baseMaxH : maxH;
      const prevHoles = simState ? simState.baseHoles : holes;
      const prevTSlots = simState ? simState.baseTSlots : 0;
      const downstackMode = (prevMaxH >= 12 || maxH >= 12 || b.pendingGarbage >= 5);
      const oppDanger = !!(oppCtx && oppCtx.oppDanger);

      let score = 0;
      if (isPerfect) score += 450;

      if (downstackMode) {
        // Dynamic Downstack (掘り) Mode: prioritize uncovering shallowest hole, clearing lines & canceling garbage
        if (isTSpin && lines >= 1) {
          score += lines === 3 ? 72 : (lines === 2 ? 52 : 26);
          if (curB2B) score += 14;
        } else if (lines === 4) {
          score += 42 + (curB2B ? 12 : 0);
        } else if (lines > 0) {
          score += lines * 14.5 + (curCombo >= 0 ? (8 + curCombo * 5.5) : 0);
          if (b.pendingGarbage >= 5) score += lines * 6.5;
        }
        if (holes < prevHoles) score += (prevHoles - holes) * 18.0;
        score -= shallowestHoleCover * 9.5 + holes * 15.0 + coveredCells * 0.65 + aggH * 0.72 + bump * 0.78;
        if (maxH >= 14) score -= (maxH - 13) * 8.5;
        return score;
      }

      // Normal / Offense / Finisher Mode
      if (isTSpin && lines >= 1) {
        score += lines === 3 ? 78 : (lines === 2 ? 54 : 24);
        if (curB2B) score += 18;
        if (curCombo >= 0) score += 6 + curCombo * 5.0;
        if (oppDanger) score += lines * 10;
      } else if (lines === 4) {
        score += 38 + (curB2B ? 15 : 0);
        if (curCombo >= 0) score += 6 + curCombo * 5.0;
        if (oppDanger) score += 18;
      } else if (lines > 0) {
        if (oppDanger) {
          // Finisher mode: send immediate attack / keep pressure instead of worrying about B2B
          score += lines * 13.5 + (curCombo >= 0 ? (10 + curCombo * 6.5) : 0);
        } else if (curCombo >= 1) {
          // Keep strong REN going
          score += 12 + curCombo * 6.2;
        } else if (curCombo === 0 && lines >= 2) {
          score += 6.5;
        } else {
          // Strong penalty for breaking B2B with weak single/double/triple clears
          score -= curB2B ? 14.5 : 4.2;
        }
      }

      // T-Spin slot construction & preservation
      if (maxH < 14) {
        const ts = countTSpinSlotsDetailed(grid);
        if (ts.total > 0) {
          score += ts.tsd * 18.5 + ts.tst * 22.0;
        }
        // Penalize non-T pieces breaking an already prepared T-Spin slot without scoring
        if (type !== 'T' && prevTSlots > 0 && ts.total < prevTSlots && lines === 0) {
          score -= 16.0;
        }
      }

      score += this.evalTetrisOpeningBonus(type, x, rot, heights, maxH);

      // Right-well (or col 0 well) Tetris readiness
      if (maxH < 12 && heights[9] === 0 && heights[8] >= 2) score += 3.6;
      if (maxH < 12 && heights[0] === 0 && heights[1] >= 2 && heights[9] > 0) score += 2.2;

      score -= holes * 12.0 + shallowestHoleCover * 2.2 + coveredCells * 0.25 + aggH * 0.44 + bump * 0.40;
      if (maxH >= 15) score -= (maxH - 14) * 6.5;
      return score;
    }

    find2PlyPerfectClear(b, candidates) {
      for (const cand of candidates) {
        const type1 = cand.type;
        const nextType = cand.useHold ? (b.hold ? b.queue[0] : b.queue[1]) : b.queue[0];
        if (!nextType) continue;
        for (let r1 = 0; r1 < 4; r1++) {
          for (let x1 = -2; x1 < b.cols; x1++) {
            const s1 = simTetrisDropOnGrid(b.grid, type1, x1, r1);
            if (!s1) continue;
            if (s1.filled === 0) {
              return { x: x1, y: s1.y, rot: r1, score: 420, ref: b.current, useHold: cand.useHold, tspinDir: 0 };
            }
            if ((s1.filled + 4) % 10 !== 0) continue;
            for (let r2 = 0; r2 < 4; r2++) {
              for (let x2 = -2; x2 < b.cols; x2++) {
                const s2 = simTetrisDropOnGrid(s1.grid, nextType, x2, r2);
                if (s2 && s2.filled === 0) {
                  return { x: x1, y: s1.y, rot: r1, score: 360, ref: b.current, useHold: cand.useHold, tspinDir: 0 };
                }
              }
            }
          }
        }
      }
      return null;
    }

    find3PlyPerfectClear(b, candidates) {
      const quickHasHoleOrHigh = (grid, maxAllowedH) => {
        for (let c = 0; c < 10; c++) {
          let seen = false;
          for (let r = 0; r < 22; r++) {
            if (grid[r][c]) {
              if (!seen) {
                if (22 - r > maxAllowedH) return true;
                seen = true;
              }
            } else if (seen) {
              return true;
            }
          }
        }
        return false;
      };

      for (const cand of candidates) {
        const type1 = cand.type;
        const next1 = cand.useHold ? (b.hold ? b.queue[0] : b.queue[1]) : b.queue[0];
        const next2 = cand.useHold ? (b.hold ? b.queue[1] : b.queue[2]) : b.queue[1];
        for (let r1 = 0; r1 < 4; r1++) {
          for (let x1 = -2; x1 < b.cols; x1++) {
            const s1 = simTetrisDropOnGrid(b.grid, type1, x1, r1);
            if (!s1) continue;
            if (s1.filled === 0) {
              return { x: x1, y: s1.y, rot: r1, score: 520, ref: b.current, useHold: cand.useHold, tspinDir: 0 };
            }
            if (!next1 || s1.filled > 24) continue;
            const can2 = ((s1.filled + 4) % 10 === 0);
            const can3 = (next2 && ((s1.filled + 8) % 10 === 0) && !quickHasHoleOrHigh(s1.grid, 4));
            if (!can2 && !can3) continue;

            for (let r2 = 0; r2 < 4; r2++) {
              for (let x2 = -2; x2 < b.cols; x2++) {
                const s2 = simTetrisDropOnGrid(s1.grid, next1, x2, r2);
                if (!s2) continue;
                if (s2.filled === 0) {
                  return { x: x1, y: s1.y, rot: r1, score: 460, ref: b.current, useHold: cand.useHold, tspinDir: 0 };
                }
                if (!can3 || (s2.filled + 4) % 10 !== 0 || s2.filled > 16 || quickHasHoleOrHigh(s2.grid, 4)) continue;
                for (let r3 = 0; r3 < 4; r3++) {
                  for (let x3 = -2; x3 < b.cols; x3++) {
                    const s3 = simTetrisDropOnGrid(s2.grid, next2, x3, r3);
                    if (s3 && s3.filled === 0) {
                      return { x: x1, y: s1.y, rot: r1, score: 410, ref: b.current, useHold: cand.useHold, tspinDir: 0 };
                    }
                  }
                }
              }
            }
          }
        }
      }
      return null;
    }

    collectTSpinMovesOnGrid(grid, cols, b, useHold, simState, oppCtx) {
      const results = [];
      const collidesAt = (px, py, rot) => {
        for (const [cx, cy] of TETRIS_SHAPES.T[rot]) {
          const nx = px + cx, ny = py + cy;
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
                for (const [tx, ty] of [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1]]) {
                  if (tx < 0 || tx >= cols || ty >= 22 || (ty >= 0 && grid[ty][tx])) blocked++;
                }
                if (blocked >= 3) {
                  const g = grid.map(r => r.slice());
                  for (const [bx, by] of TETRIS_SHAPES.T[toRot]) if (ny + by >= 0 && ny + by < 22) g[ny + by][nx + bx] = 'T';
                  let lines = 0;
                  const kept = [];
                  for (let r = 0; r < 22; r++) { if (g[r].every(c => c !== null)) lines++; else kept.push(g[r]); }
                  while (kept.length < 22) kept.unshift(Array(10).fill(null));
                  const sc = this.evalTetrisGrid(kept, lines, b, true, 'T', nx, toRot, simState, oppCtx);
                  results.push({
                    x: nx, y: ny, rot: toRot, score: sc, ref: b.current,
                    useHold, tspinDir: useHold ? 0 : dir,
                    preX: x, preRot: fromRot, stepPhase: 'align',
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

    planTetrisLite(b) {
      const type = b.current.type;
      const noise = this.difficulty === 'impossible' ? 0.5
        : this.difficulty === 'hard' ? 2.0
        : this.difficulty === 'normal' ? 6.0 : 14.0;
      let best = null;
      let bestSc = -1e9;
      for (let rot = 0; rot < 4; rot++) {
        for (let x = -2; x < b.cols; x++) {
          const sim = simTetrisDropOnGrid(b.grid, type, x, rot);
          if (!sim) continue;
          const sc = this.evalTetrisGrid(sim.grid, sim.lines, b, false, type, x, rot) + (Math.random() - 0.5) * noise;
          if (sc > bestSc) {
            bestSc = sc;
            best = { x, y: sim.y, rot, ref: b.current, useHold: false, tspinDir: 0 };
          }
        }
      }
      return best;
    }

    planTetris(b, oppCtx = null) {
      const isImp = this.difficulty === 'impossible';
      const isHard = this.difficulty === 'hard';
      const candidates = [{ type: b.current.type, useHold: false }];
      if ((isImp || isHard) && b.canHold) {
        const holdType = b.hold || b.queue[0];
        if (holdType && holdType !== b.current.type) candidates.push({ type: holdType, useHold: true });
      }

      if (isImp || isHard) {
        let filled = 0;
        for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) if (b.grid[r][c]) filled++;
        if (isImp && filled <= 16) {
          const pc3 = this.find3PlyPerfectClear(b, candidates);
          if (pc3) return pc3;
        } else if (isHard && filled <= 12) {
          const pcPlan = this.find2PlyPerfectClear(b, candidates);
          if (pcPlan) return pcPlan;
        }
      }

      const baseStats = isImp ? getTetrisGridStats(b.grid) : null;
      const baseTSlots = isImp ? countTSpinSlotsDetailed(b.grid).total : 0;
      const baseSimState = isImp ? {
        b2b: b.b2b,
        combo: b.combo,
        baseMaxH: baseStats.maxH,
        baseHoles: baseStats.holes,
        baseTSlots
      } : null;

      const ply1List = [];
      for (const cand of candidates) {
        const type = cand.type;
        const holdSaveTBonus = (isImp && cand.useHold && b.current.type === 'T' && !b.hold && baseTSlots === 0 && baseStats.maxH < 12) ? 6.5 : 0;
        for (let rot = 0; rot < 4; rot++) {
          for (let x = -2; x < b.cols; x++) {
            const sim = simTetrisDropOnGrid(b.grid, type, x, rot);
            if (!sim) continue;
            const sc = this.evalTetrisGrid(sim.grid, sim.lines, b, false, type, x, rot, baseSimState, oppCtx) + holdSaveTBonus;
            ply1List.push({
              x, y: sim.y, rot, score: sc, ref: b.current,
              useHold: cand.useHold, tspinDir: 0, grid: sim.grid,
              lines: sim.lines, isTSpin: false
            });
          }
        }

        if ((isImp || isHard) && type === 'T') {
          const tspins = this.collectTSpinMovesOnGrid(b.grid, b.cols, b, cand.useHold, baseSimState, oppCtx);
          for (const ts of tspins) ply1List.push(ts);
        }
      }

      if (ply1List.length === 0) return { x: b.current.x, y: 0, rot: 0, score: 0, ref: b.current, useHold: false, tspinDir: 0 };
      ply1List.sort((a, z) => z.score - a.score);

      if (!isImp || ply1List[0].score >= 340) return ply1List[0];

      // === IMPOSSIBLE 3-PLY BEAM SEARCH (Ply1 Top 8 -> Ply2 Top 4 -> Ply3 Best) ===
      const nextStateFrom = (prev, lines, isTSpin, grid) => {
        const st = getTetrisGridStats(grid);
        const nextB2B = lines === 0 ? prev.b2b : (lines === 4 || isTSpin);
        const nextCombo = lines > 0 ? (prev.combo + 1) : -1;
        return {
          b2b: nextB2B,
          combo: nextCombo,
          baseMaxH: st.maxH,
          baseHoles: st.holes,
          baseTSlots: st.maxH < 14 ? countTSpinSlotsDetailed(grid).total : 0
        };
      };

      const beam1 = ply1List.slice(0, 8);
      let best = beam1[0];
      let bestTotal = -1e9;

      for (const c1 of beam1) {
        const next1 = c1.useHold ? (b.hold ? b.queue[0] : b.queue[1]) : b.queue[0];
        const next2 = c1.useHold ? (b.hold ? b.queue[1] : b.queue[2]) : b.queue[1];
        if (!next1) {
          if (c1.score > bestTotal) { bestTotal = c1.score; best = c1; }
          continue;
        }

        const st1 = nextStateFrom(baseSimState, c1.lines, c1.isTSpin, c1.grid);
        const ply2List = [];
        for (let r2 = 0; r2 < 4; r2++) {
          for (let x2 = -2; x2 < b.cols; x2++) {
            const s2 = simTetrisDropOnGrid(c1.grid, next1, x2, r2);
            if (!s2) continue;
            const sc2 = this.evalTetrisGrid(s2.grid, s2.lines, b, false, next1, x2, r2, st1, oppCtx);
            ply2List.push({ score: sc2, grid: s2.grid, lines: s2.lines, isTSpin: false });
          }
        }
        if (next1 === 'T' && st1.baseTSlots > 0) {
          const ts2 = this.collectTSpinMovesOnGrid(c1.grid, b.cols, b, false, st1, oppCtx);
          for (const t of ts2) ply2List.push({ score: t.score, grid: t.grid, lines: t.lines, isTSpin: true });
        }

        if (ply2List.length === 0) {
          if (c1.score > bestTotal) { bestTotal = c1.score; best = c1; }
          continue;
        }

        ply2List.sort((a, z) => z.score - a.score);
        const beam2 = ply2List.slice(0, 4);

        let best23 = -1e9;
        for (const c2 of beam2) {
          if (!next2) {
            if (c2.score > best23) best23 = c2.score;
            continue;
          }
          const st2 = nextStateFrom(st1, c2.lines, c2.isTSpin, c2.grid);
          let best3 = -1e9;
          for (let r3 = 0; r3 < 4; r3++) {
            for (let x3 = -2; x3 < b.cols; x3++) {
              const s3 = simTetrisDropOnGrid(c2.grid, next2, x3, r3);
              if (!s3) continue;
              const sc3 = this.evalTetrisGrid(s3.grid, s3.lines, b, false, next2, x3, r3, st2, oppCtx);
              if (sc3 > best3) best3 = sc3;
            }
          }
          if (next2 === 'T' && st2.baseTSlots > 0) {
            const ts3 = this.collectTSpinMovesOnGrid(c2.grid, b.cols, b, false, st2, oppCtx);
            for (const t of ts3) if (t.score > best3) best3 = t.score;
          }
          const combined23 = best3 > -1e8 ? (c2.score * 0.45 + best3 * 0.55) : c2.score;
          if (combined23 > best23) best23 = combined23;
        }

        const total = best23 > -1e8 ? (c1.score * 0.30 + best23 * 0.70) : c1.score;
        if (total > bestTotal) {
          bestTotal = total;
          best = c1;
        }
      }
      return best;
    }

    stepPuyo(b, oppCtx = null) {
      if (b.dead || b.phase !== 'active' || !b.current) return;
      if (!this.plan || this.plan.ref !== b.current) {
        if (this.difficulty === 'impossible' && aiWorkerBridge.isAvailable()) {
          if (this.pendingRef === b.current) return;
          const ref = b.current;
          this.pendingRef = ref;
          const p = aiWorkerBridge.requestPuyoPlan(b, oppCtx, this.puyoMoves);
          if (p) {
            p.then((res) => {
              if (this.pendingRef === ref) this.pendingRef = null;
              if (b.dead || b.current !== ref) return;
              this.plan = res ? Object.assign({ ref }, res) : this.planPuyo(b, oppCtx);
            });
            return;
          }
          this.pendingRef = null;
        }
        this.plan = this.planPuyo(b, oppCtx);
      }
      if (!this.plan) return;
      if (b.current.rot !== this.plan.rot) this.rotatePuyoShortest(b, this.plan.rot);
      else if (b.current.x < this.plan.x) { if (!b.move(1, 0)) { b.hardDrop(); this.puyoMoves++; this.plan = null; } }
      else if (b.current.x > this.plan.x) { if (!b.move(-1, 0)) { b.hardDrop(); this.puyoMoves++; this.plan = null; } }
      else { b.hardDrop(); this.puyoMoves++; this.plan = null; }
    }

    scorePuyoBoard(sim, isImp, danger, curCount, pendingGarbage, triggerDepth, oppCtx = null) {
      let sc = 0;
      const potInfo = isImp
        ? probePotentialChainDetailed(sim.grid, triggerDepth)
        : { maxChain: probeMaxPotentialChain(sim.grid, triggerDepth), maxOjamas: 0, accessibleTrigger: true, triggerCol: -1 };
      const pot = potInfo.maxChain;
      const oppVulnerable = !!(oppCtx && (oppCtx.oppDanger || oppCtx.oppHighStack));

      if (sim.isChigiri) sc -= isImp ? 10.5 : 4.0;

      if (sim.chain > 0) {
        if (isImp) {
          if (sim.chain >= 10) {
            // Massive main chain (10-14+)
            sc += 980 + sim.chain * 90 + sim.totalOjamas * 0.8;
          } else if (oppVulnerable && sim.chain >= 2 && sim.chain <= 4 && sim.totalOjamas >= 12 && pot >= 5) {
            // 潰し・催促（本線を壊さずに相手ピンチへ即発火）
            sc += 560 + sim.totalOjamas * 3.5 + pot * 28;
          } else if (pendingGarbage >= 12) {
            // 対応・カウンター
            if (sim.chain >= 2 && sim.chain <= 4 && sim.totalOjamas >= pendingGarbage * 0.75 && pot >= 5) {
              // 本線温存の副砲対応を最優先
              sc += 540 + pot * 32 + sim.totalOjamas * 2.0;
            } else if (sim.totalOjamas >= pendingGarbage * 0.70 || sim.chain >= 5) {
              // 副砲で足りなければ本線カウンター
              sc += 460 + sim.chain * 48 + sim.totalOjamas * 1.4;
            } else if (pendingGarbage >= 24 && sim.chain >= 3) {
              sc += 280 + sim.chain * 32;
            } else {
              sc -= 90;
            }
          } else if (danger && curCount >= 52 && sim.chain >= 4) {
            sc += 280 + sim.chain * 38;
          } else if (oppVulnerable && sim.chain >= 5 && sim.totalOjamas >= 30) {
            sc += 340 + sim.chain * 35;
          } else {
            // 平時の1〜3連鎖誤爆を徹底抑制
            sc -= (sim.chain <= 3 ? 220 : 120) - sim.chain * 10;
          }
        } else {
          if (sim.chain >= 4) sc += 200 + sim.chain * 38;
          else if (danger && sim.chain >= 2) sc += 140 + sim.chain * 28;
          else if (sim.chain === 3 && curCount >= 32) sc += 120;
          else sc -= 36;
        }
      }

      if (isImp) {
        sc += pot * 52 + (pot >= 7 ? (pot - 6) * 26 : 0) + (pot >= 10 ? (pot - 9) * 32 : 0);
        sc += Math.min(120, potInfo.maxOjamas * 0.35);
        if (pot >= 4 && potInfo.accessibleTrigger) sc += 24;
        else if (pot >= 5 && !potInfo.accessibleTrigger) sc -= 18;
      } else {
        sc += pot * 26 + (pot >= 8 ? (pot - 7) * 18 : 0);
      }

      // Opening GTR & right-side chain tail structure
      if (this.puyoMoves < 8 && curCount <= 18) {
        const g = sim.grid;
        if (g[12][0] && g[12][0] === g[12][1]) sc += isImp ? 20 : 16;
        if (g[11][0] && g[10][1] && g[11][0] === g[10][1]) sc += isImp ? 24 : 18;
        if (g[11][0] && g[12][0] && g[11][0] !== g[12][0]) sc += isImp ? 12 : 8;
        if (g[11][1] && g[12][2] && g[11][1] === g[12][2]) sc += isImp ? 14 : 0;
        if (g[12][3] && g[12][3] === g[11][3]) sc += 9;
        if (g[12][4] && g[12][4] === g[11][4]) sc += 9;
        if (g[12][5] && g[12][5] === g[11][5]) sc += isImp ? 8 : 0;
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
      sc += pairs * (isImp ? 6.5 : 5.5) + triples * (isImp ? 16.5 : 13.5);

      const colH = [0, 0, 0, 0, 0, 0];
      for (let c = 0; c < 6; c++) {
        for (let r = 1; r < 13; r++) if (sim.grid[r][c] !== 0) { colH[c] = 13 - r; break; }
      }
      if (isImp) {
        // Persistent GTR fold + smooth U-shaped valley / chain tail balance
        if (sim.grid[12][0] && sim.grid[12][0] === sim.grid[12][1]) sc += 11;
        if (sim.grid[11][0] && sim.grid[10][1] && sim.grid[11][0] === sim.grid[10][1]) sc += 12;
        if (sim.grid[11][1] && sim.grid[12][2] && sim.grid[11][1] === sim.grid[12][2]) sc += 8;
        // Strongly avoid high stacking in death column (col 2)
        sc -= Math.max(0, colH[2] - 5) * 18;
        if (colH[2] >= 9) sc -= (colH[2] - 8) * 35;
        // Penalize extreme cliffs between adjacent columns in tail (cols 2..5)
        for (let c = 2; c < 5; c++) {
          const diff = Math.abs(colH[c] - colH[c + 1]);
          if (diff >= 4) sc -= (diff - 3) * 6.5;
        }
        for (let c = 0; c < 6; c++) if (colH[c] >= 11) sc -= 38;
      } else {
        sc -= Math.max(0, colH[2] - 7) * 12;
      }
      return sc;
    }

    planPuyo(b, oppCtx = null) {
      let best = { x: 2, rot: 0, score: -1e9, ref: b.current };
      const isImp = this.difficulty === 'impossible';
      const isHard = this.difficulty === 'hard';
      const noise = this.difficulty === 'easy' ? 14 : (this.difficulty === 'normal' ? 4 : 0);

      let curCount = 0;
      for (let r = 1; r < 13; r++) for (let c = 0; c < 6; c++) if (b.grid[r][c] !== 0) curCount++;
      const danger = b.pendingGarbage >= (isImp ? 12 : 6) || curCount >= 42;

      const ply1List = [];
      for (let rot = 0; rot < 4; rot++) {
        for (let x = 0; x < 6; x++) {
          if (b.pairCollides(x, 1, rot)) continue;
          const sim = simPuyoDrop(b.grid, x, rot, b.current.axis, b.current.child);
          if (!sim || sim.died) continue;

          if (!isHard && !isImp) {
            let sc = sim.chain * 14 + (Math.random() - 0.5) * noise;
            for (let r = 1; r < 13; r++) {
              for (let c = 0; c < 6; c++) {
                const col = sim.grid[r][c];
                if (col >= 1 && col <= 5) {
                  if (c < 5 && sim.grid[r][c + 1] === col) sc += 3;
                  if (r < 12 && sim.grid[r + 1][c] === col) sc += 3;
                }
              }
            }
            if (sim.grid[3][2] !== 0) sc -= 22;
            if (sc > best.score) best = { x, rot, score: sc, ref: b.current };
            continue;
          }

          const sc = this.scorePuyoBoard(sim, isImp, danger, curCount, b.pendingGarbage, isImp ? 2 : 1, oppCtx);
          ply1List.push({ x, rot, score: sc, sim });
        }
      }

      if (!isHard && !isImp) return best;
      if (ply1List.length === 0) return best;

      ply1List.sort((a, z) => z.score - a.score);
      if (!isImp) {
        const top = ply1List[0];
        return { x: top.x, rot: top.rot, score: top.score, ref: b.current };
      }

      const next1 = b.queue[0];
      const next2 = b.queue[1];
      // Immediate lethal/main-chain/counter firing on ply 1
      if (!next1 || ply1List[0].score >= 700) {
        const top = ply1List[0];
        return { x: top.x, rot: top.rot, score: top.score, ref: b.current };
      }

      // === IMPOSSIBLE 3-PLY BEAM SEARCH (Ply1 Top 7 -> Ply2 Top 4 -> Ply3 Best) ===
      const beam1 = ply1List.slice(0, 7);
      for (const c1 of beam1) {
        if (c1.sim.chain >= 4 && danger) {
          if (c1.score > best.score) best = { x: c1.x, rot: c1.rot, score: c1.score, ref: b.current };
          continue;
        }
        const ply2List = [];
        for (let r2 = 0; r2 < 4; r2++) {
          for (let x2 = 0; x2 < 6; x2++) {
            const sim2 = simPuyoDrop(c1.sim.grid, x2, r2, next1[0], next1[1]);
            if (!sim2 || sim2.died) continue;
            const sc2 = this.scorePuyoBoard(sim2, true, danger, curCount + 2, b.pendingGarbage, 1, oppCtx);
            ply2List.push({ score: sc2, sim: sim2 });
          }
        }
        if (ply2List.length === 0) {
          if (c1.score > best.score) best = { x: c1.x, rot: c1.rot, score: c1.score, ref: b.current };
          continue;
        }
        ply2List.sort((a, z) => z.score - a.score);
        const beam2 = ply2List.slice(0, 4);

        let best23 = -1e9;
        for (const c2 of beam2) {
          if (!next2 || c2.score >= 700) {
            if (c2.score > best23) best23 = c2.score;
            continue;
          }
          let best3 = -1e9;
          for (let r3 = 0; r3 < 4; r3++) {
            for (let x3 = 0; x3 < 6; x3++) {
              const sim3 = simPuyoDrop(c2.sim.grid, x3, r3, next2[0], next2[1]);
              if (!sim3 || sim3.died) continue;
              const sc3 = this.scorePuyoBoard(sim3, true, danger, curCount + 4, b.pendingGarbage, 1, oppCtx);
              if (sc3 > best3) best3 = sc3;
            }
          }
          const combined23 = best3 > -1e8 ? (c2.score * 0.45 + best3 * 0.55) : c2.score;
          if (combined23 > best23) best23 = combined23;
        }

        const total = best23 > -1e8 ? (c1.score * 0.28 + best23 * 0.72) : c1.score;
        if (total > best.score) {
          best = { x: c1.x, rot: c1.rot, score: total, ref: b.current };
        }
      }
      return best;
    }
  }

