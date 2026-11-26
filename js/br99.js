'use strict';

  /* =========================================================================
     14. TETRIS 99 BATTLE ROYALE (SOLO + ONLINE 99 LOBBY + TACTICS + BADGES)
     ========================================================================= */
  const BR99_CPU_NAMES = [
    'Akira','Haruto','Sora','Ren','Yuto','Kaito','Hana','Mei','Rin','Aoi',
    'Takumi','Daiki','Shota','Riku','Kenta','Yuki','Naoki','Tsubasa','Mio','Sakura',
    'Hinata','Yui','Koharu','Nanami','Ayaka','Honoka','Natsuki','Kana','Mizuki','Fuka',
    'Leon','Nova','Vex','Zed','Kira','Mina','Taro','Jiro','Saburo','Kenji',
    'Shinji','Goro','Ryo','Kazuki','Hayato','Soma','Asahi','Ibuki','Minato','Itsuki',
    'Noa','Sena','Rei','Kaede','Mao','Yuzuki','Mahiro','Hikari','Chihiro','Kokoro',
    'Aria','Luna','Eden','Orion','Atlas','Phoenix','Falcon','Valkyrie','Titan','Apex',
    'Blitz','Pulse','Flux','Spark','Echo','Drift','Shadow','Frost','Blaze','Storm',
    'Kuro','Shiro','Momo','Ume','Tsubaki','Botan','Kaede2','Sora2','Ren2','Kaito2',
    'Yuma','Sosuke','Haruki','Ryusei','Rento','Aoto','Minori','Kotone','Yuna','Hiyori'
  ];

  const BR99_BADGE_BONUSES = [0, 0.10, 0.25, 0.50, 1.00];
  function getBr99BadgeLevel(badges) {
    if (badges >= 9) return 4;
    if (badges >= 6) return 3;
    if (badges >= 3) return 2;
    if (badges >= 2) return 1;
    return 0;
  }

  function updateBr99RecordBanner() {
    const el = document.getElementById('br99RecordBanner');
    if (!el) return;
    const bestR = (profile.records && typeof profile.records.bestBr99Rank === 'number') ? profile.records.bestBr99Rank : null;
    const wins = (profile.records && typeof profile.records.br99Wins === 'number') ? profile.records.br99Wins : 0;
    const rTxt = bestR ? `#${bestR} / 99` : '未記録';
    el.textContent = `👑 最高順位: ${rTxt} / テト1（1位）回数: ${wins}回`;
  }

  const br99 = {
    isOpen: false,
    active: false,
    paused: false,
    ended: false,
    isOnline: false,
    isHost: false,
    roomCode: '',
    lobbyMode: 'none', // 'none' | 'auto' | 'room'
    waitSeconds: 60,
    waitTimerId: null,
    lobbyPlayers: [], // { peerId, name, rating, title, isHuman, ready, isSelf }
    onlinePeers: new Map(), // peerId -> conn
    peer: null,
    players: [],
    self: null,
    selfBoard: null,
    tactic: 'random',
    counterAttackers: [],
    koCount: 0,
    badges: 0,
    speedTier: 1,
    shownTop50: false,
    shownTop10: false,
    elapsed: 0,
    onlineSyncAccum: 0,
    selfShake: { time: 0, mag: 0 },
    calloutTimer: null,
    leftCanvas: null,
    rightCanvas: null,
    selfCanvas: null,

    initUI() {
      this.leftCanvas = document.getElementById('br99LeftCanvas');
      this.rightCanvas = document.getElementById('br99RightCanvas');
      this.selfCanvas = document.getElementById('br99SelfCanvas');

      document.getElementById('btnBr99SoloStart').addEventListener('click', () => {
        sound.unlock();
        this.leaveOnlineLobby(false);
        this.startSolo();
      });
      document.getElementById('btnBr99AutoMatch').addEventListener('click', () => {
        sound.unlock();
        this.openOnlineLobby('auto', '');
      });
      document.getElementById('btnBr99CreateRoom').addEventListener('click', () => {
        sound.unlock();
        const code = 'BR-' + Math.floor(1000 + Math.random() * 9000);
        this.openOnlineLobby('room', code);
      });
      document.getElementById('btnBr99JoinRoom').addEventListener('click', () => {
        sound.unlock();
        const code = (document.getElementById('inputBr99RoomId').value || '').trim().toUpperCase();
        if (!code) { showToast('ルームIDを入力してください'); return; }
        this.openOnlineLobby('room', code);
      });
      document.getElementById('btnBr99Leave').addEventListener('click', () => {
        this.leaveOnlineLobby(true);
      });
      document.getElementById('btnBr99Ready').addEventListener('click', () => {
        sound.unlock();
        this.toggleLobbyReady();
      });
      document.getElementById('btnBr99CopyCode').addEventListener('click', () => {
        if (this.roomCode) copyToClipboard(this.roomCode);
      });
      document.getElementById('btnBr99CopyUrl').addEventListener('click', () => {
        if (!this.roomCode) return;
        const url = location.href.split('?')[0] + '?br99=' + encodeURIComponent(this.roomCode);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => showToast('フレンド99招待リンクをコピーしました！')).catch(() => copyToClipboard(url));
        } else {
          copyToClipboard(url);
        }
      });

      document.querySelectorAll('#br99TacticBar .br99-tactic-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          sound.unlock();
          this.setTactic(btn.dataset.tactic);
        });
      });

      document.getElementById('btnBr99Retry').addEventListener('click', () => {
        if (this.isOnline) { showToast('オンライン99中はリトライできません（ロビーへ戻ってください）'); return; }
        sound.unlock();
        this.startSolo();
      });
      document.getElementById('btnBr99Pause').addEventListener('click', () => {
        if (this.isOnline) { showToast('オンライン99中はポーズできません'); return; }
        if ((this.active || this.paused) && !this.ended) this.togglePause();
      });
      document.getElementById('btnBr99Exit').addEventListener('click', () => {
        this.exitToLobby();
        showScreen('screenLobby');
        renderProfileUI();
      });

      document.querySelectorAll('#br99TouchPad .touch-btn').forEach(btn => {
        const act = btn.dataset.act;
        const releaseTouch = () => {
          btn.classList.remove('pressed');
          if (!input.touchHeld.has(act)) return;
          input.touchHeld.delete(act);
          if (act === 'left' && input.horizDir === -1) {
            input.horizDir = input.isActionDown('right') ? 1 : 0;
            input.dasTimer = 0; input.arrTimer = 0;
          } else if (act === 'right' && input.horizDir === 1) {
            input.horizDir = input.isActionDown('left') ? -1 : 0;
            input.dasTimer = 0; input.arrTimer = 0;
          }
        };
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          sound.unlock();
          if (!this.active || this.paused || this.ended) return;
          btn.classList.add('pressed');
          if (act === 'left' || act === 'right' || act === 'down') {
            input.touchHeld.add(act);
            if (act === 'left' || act === 'right') input.triggerActionPress(act);
          } else {
            input.triggerActionPress(act);
          }
        });
        btn.addEventListener('pointerup', releaseTouch);
        btn.addEventListener('pointercancel', releaseTouch);
        btn.addEventListener('pointerleave', releaseTouch);
      });
    },

    leaveOnlineLobby(showMsg = true) {
      clearInterval(this.waitTimerId);
      this.waitTimerId = null;
      this.lobbyMode = 'none';
      this.lobbyPlayers = [];
      for (const c of this.onlinePeers.values()) { try { c.close(); } catch (e) {} }
      this.onlinePeers.clear();
      if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
      document.getElementById('br99WaitBox').classList.remove('active');
      document.getElementById('br99LaunchGrid').style.display = '';
      if (showMsg) showToast('99人ロビーから退出しました');
    },

    openOnlineLobby(mode, roomCode) {
      if (typeof Peer === 'undefined') {
        showToast('PeerJSが読み込めない環境のためオンライン99は利用できません。ソロで99をお試しください。');
        return;
      }
      this.leaveOnlineLobby(false);
      this.lobbyMode = mode;
      this.roomCode = roomCode || '';
      this.waitSeconds = 60;

      const selfEntry = {
        peerId: 'local-' + DEVICE_ID,
        name: profile.name || 'PLAYER',
        rating: profile.rating || 1500,
        title: profile.activeTitle || '',
        isHuman: true,
        ready: false,
        isSelf: true
      };
      this.lobbyPlayers = [selfEntry];

      document.getElementById('br99LaunchGrid').style.display = 'none';
      document.getElementById('br99WaitBox').classList.add('active');
      document.getElementById('br99LobbyTitle').textContent =
        mode === 'room' ? `🔑 フレンド99 ロビー (${this.roomCode})` : '🌐 オンライン99 公開ロビー';
      document.getElementById('br99RoomCodeBar').style.display = mode === 'room' ? 'flex' : 'none';
      if (mode === 'room') document.getElementById('br99RoomCodeDisplay').textContent = this.roomCode;
      this.renderLobbyUI();

      clearInterval(this.waitTimerId);
      this.waitTimerId = setInterval(() => {
        if (this.lobbyMode === 'none') { clearInterval(this.waitTimerId); return; }
        this.waitSeconds--;
        this.renderLobbyUI();
        if (this.waitSeconds <= 0) {
          clearInterval(this.waitTimerId);
          this.launchFromLobby();
        }
      }, 1000);

      if (mode === 'room') {
        this.initRoomPeer(this.roomCode);
      } else {
        this.initAutoLobbyPeer();
      }
    },

    initAutoLobbyPeer() {
      const slotId = 'puyotet-br99-auto-v1';
      const p = new Peer(slotId);
      this.peer = p;
      this.isHost = true;
      p.on('open', () => {
        p.on('connection', (c) => this.handleLobbyConn(c, true));
      });
      p.on('error', () => {
        // Fallback joiner if slot already hosted
        try { p.destroy(); } catch (e) {}
        this.isHost = false;
        const p2 = new Peer();
        this.peer = p2;
        p2.on('open', () => {
          const c = p2.connect(slotId, { reliable: true });
          this.handleLobbyConn(c, false);
        });
      });
    },

    initRoomPeer(code) {
      const hostId = 'puyotet-br99-room-' + code;
      const p = new Peer(hostId);
      this.peer = p;
      this.isHost = true;
      p.on('open', () => {
        p.on('connection', (c) => this.handleLobbyConn(c, true));
      });
      p.on('error', () => {
        try { p.destroy(); } catch (e) {}
        this.isHost = false;
        const p2 = new Peer();
        this.peer = p2;
        p2.on('open', () => {
          const c = p2.connect(hostId, { reliable: true });
          this.handleLobbyConn(c, false);
        });
      });
    },

    handleLobbyConn(c, asHost) {
      c.on('open', () => {
        this.onlinePeers.set(c.peer, c);
        c.send({
          type: 'br99Join',
          peerId: this.peer.id,
          name: profile.name || 'PLAYER',
          rating: profile.rating || 1500,
          title: profile.activeTitle || '',
          ready: !!(this.lobbyPlayers[0] && this.lobbyPlayers[0].ready)
        });
        if (asHost) this.broadcastLobbyState();
      });
      c.on('data', (msg) => {
        if (!msg || !msg.type) return;
        if (msg.type === 'br99Join' || msg.type === 'br99Ready') {
          const pid = msg.peerId || c.peer;
          let entry = this.lobbyPlayers.find(x => x.peerId === pid);
          if (!entry) {
            entry = {
              peerId: pid,
              name: (msg.name || 'PLAYER').slice(0, 16),
              rating: Number(msg.rating) || 1500,
              title: msg.title || '',
              isHuman: true,
              ready: !!msg.ready,
              isSelf: false
            };
            this.lobbyPlayers.push(entry);
          } else {
            entry.name = (msg.name || entry.name).slice(0, 16);
            entry.rating = Number(msg.rating) || entry.rating;
            entry.ready = !!msg.ready;
          }
          this.renderLobbyUI();
          if (asHost) {
            this.broadcastLobbyState();
            this.checkAllReadyStart();
          }
        } else if (msg.type === 'br99LobbySync' && Array.isArray(msg.players)) {
          const myReady = !!(this.lobbyPlayers[0] && this.lobbyPlayers[0].ready);
          const merged = [{
            peerId: this.peer.id,
            name: profile.name || 'PLAYER',
            rating: profile.rating || 1500,
            title: profile.activeTitle || '',
            isHuman: true,
            ready: myReady,
            isSelf: true
          }];
          for (const p of msg.players) {
            if (p.peerId && p.peerId !== this.peer.id) {
              merged.push({ ...p, isSelf: false, isHuman: true });
            }
          }
          this.lobbyPlayers = merged;
          if (typeof msg.waitSeconds === 'number') this.waitSeconds = msg.waitSeconds;
          this.renderLobbyUI();
        } else if (msg.type === 'br99Start') {
          this.startFromLobbyRoster(msg.roster || this.lobbyPlayers, true);
        } else if (msg.type === 'br99State' && this.active && !this.ended) {
          const target = this.players.find(pl => pl.peerId === msg.peerId);
          if (target && !target.isSelf) {
            target.koCount = msg.koCount ?? target.koCount;
            target.badges = msg.badges ?? target.badges;
            if (msg.grid && target.board) target.board.grid = msg.grid;
          }
        } else if (msg.type === 'br99Atk' && this.active && !this.ended) {
          this.handleIncomingOnlineAtk(msg.fromPeerId, msg.lines || 0);
        } else if (msg.type === 'br99KO' && this.active && !this.ended) {
          const victim = this.players.find(pl => pl.peerId === msg.peerId);
          if (victim && victim.alive) {
            this.eliminatePlayer(victim, msg.killerPeerId || null, false);
          }
        }
      });
      c.on('close', () => {
        this.onlinePeers.delete(c.peer);
        this.lobbyPlayers = this.lobbyPlayers.filter(x => x.peerId !== c.peer);
        this.renderLobbyUI();
        if (asHost) this.broadcastLobbyState();
      });
    },

    broadcastLobbyState() {
      const payload = {
        type: 'br99LobbySync',
        waitSeconds: this.waitSeconds,
        players: this.lobbyPlayers.map(p => ({
          peerId: p.isSelf ? this.peer.id : p.peerId,
          name: p.name, rating: p.rating, title: p.title, ready: p.ready
        }))
      };
      for (const c of this.onlinePeers.values()) {
        if (c.open) { try { c.send(payload); } catch (e) {} }
      }
    },

    toggleLobbyReady() {
      const me = this.lobbyPlayers[0];
      if (!me) return;
      me.ready = !me.ready;
      this.renderLobbyUI();
      if (this.isHost) {
        this.broadcastLobbyState();
        this.checkAllReadyStart();
      } else {
        for (const c of this.onlinePeers.values()) {
          if (c.open) {
            try {
              c.send({
                type: 'br99Ready',
                peerId: this.peer ? this.peer.id : me.peerId,
                name: me.name, rating: me.rating, ready: me.ready
              });
            } catch (e) {}
          }
        }
      }
    },

    checkAllReadyStart() {
      if (!this.isHost || this.lobbyMode === 'none') return;
      if (this.lobbyPlayers.length >= 1 && this.lobbyPlayers.every(p => p.ready)) {
        this.launchFromLobby();
      }
    },

    launchFromLobby() {
      const roster = this.lobbyPlayers.slice(0, 99);
      if (this.isHost) {
        const msg = { type: 'br99Start', roster };
        for (const c of this.onlinePeers.values()) {
          if (c.open) { try { c.send(msg); } catch (e) {} }
        }
      }
      this.startFromLobbyRoster(roster, true);
    },

    renderLobbyUI() {
      const humans = this.lobbyPlayers.slice(0, 99);
      const cpuFill = Math.max(0, 99 - humans.length);
      document.getElementById('br99CountSummary').textContent =
        `参加人数: ${humans.length} / 99（残り${cpuFill}枠はCPU補充）`;
      document.getElementById('br99TimerBadge').textContent =
        `⏳ 自動開始まで: ${Math.max(0, this.waitSeconds)}秒`;
      const me = humans[0];
      const readyBtn = document.getElementById('btnBr99Ready');
      if (readyBtn && me) {
        readyBtn.textContent = me.ready ? '✅ 準備完了（解除）' : '▶ スタート（準備完了）';
        readyBtn.classList.toggle('btn-green', me.ready);
      }
      const listEl = document.getElementById('br99PlayerList');
      listEl.innerHTML = humans.map(p =>
        `<div class="br99-player-row">
          <span>${escapeHtml(p.name)} <small style="color:var(--text-dim);">R${p.rating}</small></span>
          <span style="color:${p.ready ? 'var(--green)' : 'var(--gold)'};">${p.ready ? '✅ READY' : '待機中'}</span>
        </div>`
      ).join('');
    },

    startSolo() {
      this.startFromLobbyRoster([{
        peerId: 'self',
        name: profile.name || 'PLAYER',
        rating: profile.rating || 1500,
        title: profile.activeTitle || '',
        isHuman: true,
        isSelf: true
      }], false);
    },

    startFromLobbyRoster(roster, isOnline) {
      clearInterval(this.waitTimerId);
      this.waitTimerId = null;
      this.lobbyMode = 'none';
      document.getElementById('br99WaitBox').classList.remove('active');
      document.getElementById('br99LaunchGrid').style.display = '';
      document.getElementById('overlayResult').classList.remove('active');
      document.getElementById('overlayPause').classList.remove('active');

      battle.soloSubType = null;
      battle.zeroGravity = false;
      battle.active = false;
      this.isOpen = true;
      this.isOnline = !!isOnline;
      this.active = false;
      this.paused = false;
      this.ended = false;
      this.cpuCursor = 0;
      this.tactic = 'random';
      this.counterAttackers = [];
      this.koCount = 0;
      this.badges = 0;
      this.speedTier = 1;
      this.shownTop50 = false;
      this.shownTop10 = false;
      this.elapsed = 0;
      this.onlineSyncAccum = 0;
      this.selfShake = { time: 0, mag: 0 };
      this.players = [];

      const humanEntries = (Array.isArray(roster) ? roster : []).slice(0, 99);
      const avgRating = humanEntries.length > 0
        ? Math.round(humanEntries.reduce((s, x) => s + (Number(x.rating) || 1500), 0) / humanEntries.length)
        : (profile.rating || 1500);
      const cpuDiff = avgRating >= 1950 ? 'impossible' : (avgRating >= 1700 ? 'hard' : (avgRating >= 1400 ? 'normal' : 'easy'));

      // Create human slots first
      for (let i = 0; i < humanEntries.length; i++) {
        const h = humanEntries[i];
        const isSelf = !!h.isSelf || (h.peerId && this.peer && h.peerId === this.peer.id) || i === 0;
        const slot = {
          id: i,
          peerId: h.peerId || ('h-' + i),
          name: (h.name || 'PLAYER').slice(0, 16),
          rating: Number(h.rating) || 1500,
          isHuman: true,
          isSelf,
          alive: true,
          koCount: 0,
          badges: 0,
          attackerCount: 0,
          targetId: null,
          board: null,
          cpu: null,
          aiTimer: 0,
          aiInterval: 0.45
        };
        if (isSelf) {
          slot.board = new TetrisBoard(
            true,
            (fromSt, amt) => this.onSelfAttack(amt),
            () => this.onSelfKO(),
            null,
            null,
            (mag, dur) => { this.selfShake.mag = Math.max(this.selfShake.mag, mag); this.selfShake.time = Math.max(this.selfShake.time, dur); }
          );
          this.self = slot;
          this.selfBoard = slot.board;
        } else {
          slot.board = new TetrisBoard(false, null, null, null, null, null);
        }
        this.players.push(slot);
      }

      // Fill remaining slots up to 99 with CPUs scaled to lobby rating
      for (let i = this.players.length; i < 99; i++) {
        const diff = cpuDiff === 'impossible' && i > 20 ? 'hard' : cpuDiff;
        const interval = diff === 'impossible' ? (0.14 + Math.random() * 0.14)
          : diff === 'hard' ? (0.24 + Math.random() * 0.22)
          : diff === 'normal' ? (0.38 + Math.random() * 0.35)
          : (0.65 + Math.random() * 0.55);
        const slot = {
          id: i,
          peerId: 'cpu-' + i,
          name: BR99_CPU_NAMES[i % BR99_CPU_NAMES.length],
          rating: avgRating + Math.round((Math.random() - 0.5) * 180),
          isHuman: false,
          isSelf: false,
          alive: true,
          koCount: 0,
          badges: 0,
          attackerCount: 0,
          targetId: null,
          board: new TetrisBoard(false, null, null, null, null, null),
          cpu: new CpuController(diff),
          aiTimer: Math.random() * interval,
          aiInterval: interval
        };
        this.seedInitialCpuStack(slot.board, diff);
        this.players.push(slot);
      }

      this.recomputeTargetsAndAttackers();
      this.updateHUD();
      showScreen('screenBr99');
      document.getElementById('br99TouchPad').classList.toggle('hidden', false);
      this.render();

      sound.resetBgmSteps();
      sound.setBgmTrack('tetris');
      battle.countdownActive = true;
      battle.startCountdown(() => {
        if (this.isOpen && !this.ended) {
          this.active = true;
        }
      });
    },

    seedInitialCpuStack(b, diff) {
      const rowsToSeed = diff === 'impossible' ? 5 : (diff === 'hard' ? 4 : 3);
      const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      for (let r = b.rows - rowsToSeed; r < b.rows; r++) {
        const hole = Math.floor(Math.random() * b.cols);
        for (let c = 0; c < b.cols; c++) {
          if (c !== hole && Math.random() < 0.85) {
            b.grid[r][c] = types[Math.floor(Math.random() * types.length)];
          }
        }
      }
    },

    getAlivePlayers() {
      return this.players.filter(p => p.alive);
    },

    setTactic(tac) {
      if (!['random', 'ko', 'badges', 'attackers'].includes(tac)) return;
      this.tactic = tac;
      document.querySelectorAll('#br99TacticBar .br99-tactic-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tactic === tac);
      });
      this.recomputeTargetsAndAttackers();
    },

    recomputeTargetsAndAttackers() {
      const alive = this.getAlivePlayers();
      for (const p of this.players) p.attackerCount = 0;

      // Dynamic simultaneous attacker cap per player (relaxed in TOP 10)
      const maxAttackers = alive.length > 50 ? 3 : (alive.length > 10 ? 4 : 99);

      const shuffleInPlace = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      const pickByBadgesRandomTie = (pool) => {
        const hasAnyBadges = pool.some(e => e.badges > 0);
        if (!hasAnyBadges) {
          return pool[Math.floor(Math.random() * pool.length)];
        }
        const shuffled = shuffleInPlace(pool.slice());
        shuffled.sort((a, b) => b.badges - a.badges);
        const topK = Math.min(shuffled.length, 4);
        return shuffled[Math.floor(Math.random() * topK)];
      };

      // Process in shuffled order so no player ID is systematically favored
      const order = shuffleInPlace(alive.slice());

      for (const p of order) {
        const enemies = alive.filter(e => e.id !== p.id);
        if (enemies.length === 0) { p.targetId = null; continue; }

        if (p.isSelf) {
          if (this.tactic === 'ko') {
            const shuffled = shuffleInPlace(enemies.slice());
            const lowHp = shuffled.filter(e => this.estimateBoardDanger(e.board) >= 0.55);
            const pool = lowHp.length ? lowHp : shuffled;
            pool.sort((a, b) => this.estimateBoardDanger(b.board) - this.estimateBoardDanger(a.board));
            p.targetId = pool[0].id;
          } else if (this.tactic === 'badges') {
            const hasBadges = enemies.some(e => e.badges > 0);
            if (!hasBadges) {
              p.targetId = enemies[Math.floor(Math.random() * enemies.length)].id;
            } else {
              const shuffled = shuffleInPlace(enemies.slice());
              shuffled.sort((a, b) => b.badges - a.badges);
              p.targetId = shuffled[0].id;
            }
          } else if (this.tactic === 'attackers') {
            const attList = enemies.filter(e => this.counterAttackers.includes(e.id));
            p.targetId = attList.length
              ? attList[Math.floor(Math.random() * attList.length)].id
              : enemies[Math.floor(Math.random() * enemies.length)].id;
          } else {
            p.targetId = enemies[Math.floor(Math.random() * enemies.length)].id;
          }
        } else {
          // Enforce simultaneous attacker cap so hate disperses fairly across alive players
          const underCap = enemies.filter(e => e.attackerCount < maxAttackers);
          const pool = underCap.length ? underCap : enemies;

          const roll = Math.random();
          let chosen = null;
          if (roll < 0.20 && this.self && this.self.alive &&
              this.self.attackerCount < maxAttackers &&
              this.estimateBoardDanger(this.self.board) >= 0.72) {
            chosen = this.self;
          } else if (roll < 0.45) {
            chosen = pickByBadgesRandomTie(pool);
          } else {
            chosen = pool[Math.floor(Math.random() * pool.length)];
          }
          p.targetId = chosen ? chosen.id : null;
        }

        if (p.targetId !== null) {
          const tgt = this.players[p.targetId];
          if (tgt && tgt.alive) tgt.attackerCount++;
        }
      }

      if (this.self) {
        this.counterAttackers = alive
          .filter(e => e.id !== this.self.id && e.targetId === this.self.id)
          .map(e => e.id);
        const cBtn = document.getElementById('br99CounterBtn');
        if (cBtn) cBtn.textContent = `4: カウンター (${this.counterAttackers.length})`;
      }
    },

    estimateBoardDanger(b) {
      if (!b || !b.grid) return 0;
      let highestRow = 22;
      for (let r = 0; r < b.rows; r++) {
        if (b.grid[r].some(c => c !== null)) { highestRow = r; break; }
      }
      const stackFactor = Math.max(0, (20 - highestRow) / 18);
      const garbFactor = Math.min(1, (b.pendingGarbage || 0) / 12);
      return Math.min(1, stackFactor * 0.7 + garbFactor * 0.3);
    },

    onSelfAttack(baseLines) {
      if (!this.active || this.ended || !this.self) return;
      const lvl = getBr99BadgeLevel(this.badges);
      const mult = 1 + (BR99_BADGE_BONUSES[lvl] || 0);
      const finalLines = Math.max(1, Math.round(baseLines * mult * 10) / 10);

      const aliveEnemies = this.getAlivePlayers().filter(e => !e.isSelf);
      if (aliveEnemies.length === 0) return;

      let targets = [];
      if (this.tactic === 'attackers') {
        const list = this.counterAttackers
          .map(id => this.players[id])
          .filter(p => p && p.alive && !p.isSelf);
        targets = list.length ? list : [aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]];
      } else {
        const tgt = (this.self.targetId !== null && this.players[this.self.targetId] && this.players[this.self.targetId].alive)
          ? this.players[this.self.targetId]
          : aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        targets = [tgt];
      }

      const splitLines = Math.max(0.5, Math.round((finalLines / targets.length) * 10) / 10);
      for (const tgt of targets) {
        if (tgt.isHuman && !tgt.isSelf && this.isOnline) {
          const conn = this.onlinePeers.get(tgt.peerId);
          if (conn && conn.open) {
            try { conn.send({ type: 'br99Atk', fromPeerId: this.peer ? this.peer.id : 'self', lines: splitLines }); } catch (e) {}
          }
        } else if (!tgt.isHuman) {
          tgt.board.receiveGarbage(splitLines);
          if (this.estimateBoardDanger(tgt.board) >= 0.92 || tgt.board.pendingGarbage >= 12) {
            this.eliminatePlayer(tgt, this.self.id, true);
          }
        }
      }
      sound.playSE('attack');
    },

    handleIncomingOnlineAtk(fromPeerId, lines) {
      if (!this.active || this.ended || !this.selfBoard || !this.self || !this.self.alive) return;
      if (lines > 0) this.selfBoard.receiveGarbage(lines);
      const attacker = this.players.find(p => p.peerId === fromPeerId);
      if (attacker && attacker.alive && !this.counterAttackers.includes(attacker.id)) {
        this.counterAttackers.push(attacker.id);
      }
    },

    eliminatePlayer(victim, killerId, isSelfKill) {
      if (!victim || !victim.alive) return;
      victim.alive = false;
      victim.board.dead = true;

      if (killerId !== null && killerId !== undefined) {
        const killer = this.players[killerId];
        if (killer && killer.id !== victim.id) {
          killer.koCount++;
          killer.badges += 1 + Math.floor(victim.badges * 0.5);
          if (killer.isSelf) {
            this.koCount = killer.koCount;
            this.badges = killer.badges;
            const totalKOs = addStatTotal('br99KOs', 1);
            unlockAchievement('br99_ko1');
            if (this.koCount >= 5) unlockAchievement('br99_ko5');
            if (totalKOs >= 30) unlockAchievement('br99_ko30');
            this.showCallout(`💥 K.O.! (${this.koCount})`);
            sound.playSE('tetris');
            if (this.isOnline) {
              const payload = { type: 'br99State', peerId: this.peer ? this.peer.id : 'self', koCount: this.koCount, badges: this.badges };
              for (const c of this.onlinePeers.values()) { if (c.open) { try { c.send(payload); } catch (e) {} } }
            }
          }
        }
      }

      const alive = this.getAlivePlayers();
      if (!this.shownTop50 && alive.length <= 50 && alive.length > 10) {
        this.shownTop50 = true;
        this.speedTier = Math.max(this.speedTier, 2);
        this.showCallout('⚡ TOP 50! SPEED UP');
        sound.playSE('swapSwitch');
      }
      if (!this.shownTop10 && alive.length <= 10 && alive.length > 1) {
        this.shownTop10 = true;
        this.speedTier = 3;
        this.showCallout('🔥 TOP 10! MAX SPEED');
        sound.playSE('swapWarn');
      }

      this.recomputeTargetsAndAttackers();
      this.updateHUD();

      if (this.self && this.self.alive && alive.length === 1) {
        this.finishBr99(1);
      }
    },

    onSelfKO() {
      if (!this.active || this.ended || !this.self) return;
      const aliveCount = this.getAlivePlayers().length;
      const placement = Math.max(1, Math.min(99, aliveCount));
      this.self.alive = false;
      this.selfBoard.dead = true;
      if (this.isOnline) {
        const payload = { type: 'br99KO', peerId: this.peer ? this.peer.id : 'self', killerPeerId: null };
        for (const c of this.onlinePeers.values()) { if (c.open) { try { c.send(payload); } catch (e) {} } }
      }
      this.finishBr99(placement);
    },

    finishBr99(placement) {
      if (this.ended) return;
      this.ended = true;
      this.active = false;
      battle.active = false;
      battle.countdownActive = false;
      sound.stopBGM();

      const isWin = placement === 1;
      addDailyProgress('play2', 1);
      const totalPlays = addStatTotal('totalPlays', 1);
      unlockAchievement('first_play');
      if (totalPlays >= 10) unlockAchievement('play10');
      if (placement <= 50) unlockAchievement('br99_top50');
      if (placement <= 10) unlockAchievement('br99_top10');

      profile.records = profile.records || {};
      let isNewRecord = false;
      if (profile.records.bestBr99Rank === null || profile.records.bestBr99Rank === undefined || placement < profile.records.bestBr99Rank) {
        profile.records.bestBr99Rank = placement;
        isNewRecord = true;
      }
      if (isWin) {
        addDailyProgress('win1', 1);
        if (typeof addWeeklyProgress === 'function') addWeeklyProgress('w_wins10', 1);
        const totalWins = addStatTotal('totalWins', 1);
        if (totalWins >= 50) unlockAchievement('wins50');
        profile.records.br99Wins = (profile.records.br99Wins || 0) + 1;
        unlockAchievement('first_win');
        unlockAchievement('br99_win');
        if (profile.records.br99Wins >= 3) unlockAchievement('br99_win3');
      }

      const earnedXp = (isWin ? 180 : (placement <= 10 ? 100 : (placement <= 50 ? 60 : 30))) + (this.koCount || 0) * 15;
      if (typeof grantXP === 'function') grantXP(earnedXp);
      const earnedCoins = isWin ? 200 : (placement <= 10 ? 70 : (placement <= 50 ? 35 : 15));
      profile.coins = (profile.coins || 0) + earnedCoins;
      saveProfile(profile);
      updateBr99RecordBanner();
      renderProfileUI();
      if (this.isOnline) {
        for (const c of this.onlinePeers.values()) {
          if (c.open) { try { c.send({ type: 'lbSync', lbRecord: buildPublicRecord() }); } catch (e) {} }
        }
      }
      syncCloudNow(true, false);

      const titleEl = document.getElementById('resTitle');
      titleEl.textContent = isWin ? '👑 TETRIS MAXIMUS! #1' : `#${placement} / 99`;
      titleEl.className = 'result-title ' + (isWin ? 'win' : 'lose');
      document.getElementById('resSub').textContent =
        `K.O.: ${this.koCount}回 / バッジ: ${this.badges}個 / 生存時間: ${this.elapsed.toFixed(1)}秒`;
      document.getElementById('resSpecialBadges').innerHTML =
        (isNewRecord ? '<span class="result-special">🏆 BEST RANK!</span>' : '') +
        `<span class="result-special" style="background:linear-gradient(135deg,#eab308,#f59e0b);color:#1c1917;">🪙 +${earnedCoins} COINS GET!</span>`;
      document.getElementById('resRatingBox').style.display = 'none';
      document.getElementById('resStatsGrid').innerHTML = [
        ['順位', `#${placement}/99`],
        ['K.O.', `${this.koCount}`],
        ['バッジ', `${this.badges}`],
        ['生存時間', `${this.elapsed.toFixed(1)}s`]
      ].map(([k, v]) => `<div class="res-stat-cell"><div class="res-stat-k">${k}</div><div class="res-stat-v">${v}</div></div>`).join('');
      document.getElementById('resStatsSummary').textContent = `SCORE: ${(this.selfBoard ? this.selfBoard.score : 0).toLocaleString()}`;
      document.getElementById('btnPlayReplay').style.display = 'none';
      document.getElementById('btnSaveReplay').style.display = 'none';
      document.getElementById('resRematchStatus').textContent = '';
      document.getElementById('btnRematch').disabled = false;
      const nextTowerBtn = document.getElementById('btnNextTowerFloor');
      if (nextTowerBtn) nextTowerBtn.style.display = 'none';
      const seedBadge = document.getElementById('resSeedBadge');
      if (seedBadge) seedBadge.style.display = 'none';
      document.getElementById('overlayResult').classList.add('active');
      sound.playSE(isWin ? 'rankUp' : 'lose');
    },

    showCallout(msg) {
      const el = document.getElementById('br99Callout');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this.calloutTimer);
      this.calloutTimer = setTimeout(() => el.classList.remove('show'), 1600);
    },

    togglePause() {
      if (this.isOnline) return;
      this.paused = !this.paused;
      document.getElementById('overlayPause').classList.toggle('active', this.paused);
    },

    exitToLobby() {
      this.isOpen = false;
      this.active = false;
      this.paused = false;
      this.ended = true;
      if (typeof battle !== 'undefined') battle.countdownActive = false;
      const cdOv = document.getElementById('overlayCountdown');
      if (cdOv) cdOv.classList.remove('active');
      if (typeof sound !== 'undefined') sound.stopBGM();
      this.leaveOnlineLobby(false);
    },

    updateHUD() {
      const alive = this.getAlivePlayers();
      const humansAlive = alive.filter(p => p.isHuman).length;
      document.getElementById('br99AliveBadge').textContent = `残り: ${alive.length} / 99`;
      document.getElementById('br99HumanBadge').textContent = `👤 実プレイヤー: ${humansAlive}人`;
      document.getElementById('br99KoBadge').textContent = `💥 K.O.: ${this.koCount}`;
      const lvl = getBr99BadgeLevel(this.badges);
      const pct = Math.round((BR99_BADGE_BONUSES[lvl] || 0) * 100);
      document.getElementById('br99BadgePill').textContent = `🏅 Lv.${lvl} (+${pct}%) バッジ:${this.badges}`;
      const pEl = document.getElementById('br99PhaseBadge');
      pEl.textContent = this.speedTier === 3 ? 'SPEED: 3x (TOP10)' : (this.speedTier === 2 ? 'SPEED: 2x (TOP50)' : 'SPEED: 1x');
      pEl.classList.toggle('danger', this.speedTier >= 2);
      const cBtn = document.getElementById('br99CounterBtn');
      if (cBtn) cBtn.textContent = `4: カウンター (${this.counterAttackers.length})`;
    },

    update(dt) {
      if (!this.isOpen || !this.active || this.paused || this.ended) return;
      this.elapsed += dt;
      if (this.selfShake.time > 0) {
        this.selfShake.time = Math.max(0, this.selfShake.time - dt);
        if (this.selfShake.time === 0) this.selfShake.mag = 0;
      }

      const speedMult = this.speedTier === 3 ? 1.55 : (this.speedTier === 2 ? 1.25 : 1.0);
      input.update(dt);
      if (this.self && this.self.alive && this.selfBoard) {
        const softHeld = input.isActionDown('down');
        this.selfBoard.update(dt * speedMult, softHeld);
        document.getElementById('br99SelfZone').classList.toggle('danger', this.selfBoard.isInDanger());
      }

      // Update CPU players (throttled per-frame lightweight 1-ply AI to keep 60fps)
      const MAX_CPU_PLANS_PER_FRAME = 4;
      let plannedThisFrame = 0;
      const totalPlayers = this.players.length;
      const startCursor = this.cpuCursor || 0;
      for (let step = 0; step < totalPlayers; step++) {
        const idx = (startCursor + step) % totalPlayers;
        const p = this.players[idx];
        if (p.isHuman || !p.alive || !p.board || !p.cpu) continue;
        p.aiTimer += dt * speedMult;
        if (p.aiTimer >= p.aiInterval && plannedThisFrame < MAX_CPU_PLANS_PER_FRAME) {
          p.aiTimer = 0;
          plannedThisFrame++;
          this.cpuCursor = (idx + 1) % totalPlayers;
          if (!p.board.dead && p.board.current) {
            const plan = p.cpu.planTetrisLite(p.board);
            if (plan) {
              p.board.current.rot = plan.rot;
              p.board.current.x = Math.max(-2, Math.min(p.board.cols - 1, plan.x));
              p.board.hardDrop();
              if (Math.random() < 0.24) {
                const lines = 1 + Math.floor(Math.random() * 4);
                const tgt = (p.targetId !== null && this.players[p.targetId] && this.players[p.targetId].alive)
                  ? this.players[p.targetId]
                  : null;
                if (tgt) {
                  if (tgt.isSelf && this.self && this.self.alive) {
                    this.selfBoard.receiveGarbage(lines);
                    if (!this.counterAttackers.includes(p.id)) this.counterAttackers.push(p.id);
                  } else if (!tgt.isHuman) {
                    tgt.board.receiveGarbage(lines);
                    if (this.estimateBoardDanger(tgt.board) >= 0.92 || tgt.board.pendingGarbage >= 12) {
                      this.eliminatePlayer(tgt, p.id, false);
                    }
                  }
                }
              }
            }
          }
        }
        p.board.update(dt * 0.45, false);
      }

      if (this.isOnline) {
        this.onlineSyncAccum += dt;
        if (this.onlineSyncAccum >= 0.25) {
          this.onlineSyncAccum = 0;
          const payload = {
            type: 'br99State',
            peerId: this.peer ? this.peer.id : 'self',
            koCount: this.koCount,
            badges: this.badges,
            grid: this.selfBoard ? this.selfBoard.grid : null
          };
          for (const c of this.onlinePeers.values()) {
            if (c.open) { try { c.send(payload); } catch (e) {} }
          }
        }
      }

      this.updateHUD();
      this.render();
    },

    render() {
      if (!this.selfCanvas || !this.selfBoard) return;
      renderPlayerCanvas(this.selfCanvas, 'tetris', this.selfBoard, null, false, true, this.selfShake);
      this.renderMiniGrid(this.leftCanvas, 0, 50, 'LEFT 50');
      this.renderMiniGrid(this.rightCanvas, 50, 99, 'RIGHT 49');
    },

    renderMiniGrid(canvas, startIdx, endIdx, label) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = activeThemeObj.canvasBg || '#060a16';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = activeThemeObj.textDim || '#94a3b8';
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 8, 14);

      const slice = this.players.slice(startIdx, endIdx);
      const cols = 7;
      const rows = Math.ceil(slice.length / cols);
      const padX = 6, padTop = 20, gap = 4;
      const cellW = Math.max(24, (W - padX * 2 - gap * (cols - 1)) / cols);
      const cellH = Math.max(36, (H - padTop - 6 - gap * (rows - 1)) / rows);

      slice.forEach((p, idx) => {
        const cIdx = idx % cols;
        const rIdx = Math.floor(idx / cols);
        const x = padX + cIdx * (cellW + gap);
        const y = padTop + rIdx * (cellH + gap);

        ctx.fillStyle = activeThemeObj.fieldBg || '#0b1224';
        ctx.fillRect(x, y, cellW, cellH);

        if (!p.alive) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(x, y, cellW, cellH);
          ctx.strokeStyle = 'rgba(148,163,184,0.22)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cellW, cellH);
          return;
        }

        // Mini stack blocks
        const miniCell = Math.max(2, Math.floor(Math.min((cellW - 4) / 10, (cellH - 4) / 20)));
        const gx = x + (cellW - miniCell * 10) / 2;
        const gy = y + (cellH - miniCell * 20) / 2;
        if (p.board && p.board.grid) {
          for (let r = 2; r < 22; r++) {
            for (let c = 0; c < 10; c++) {
              const t = p.board.grid[r][c];
              if (t) {
                ctx.fillStyle = TETRIS_COLORS[t] || '#38bdf8';
                ctx.fillRect(gx + c * miniCell, gy + (r - 2) * miniCell, miniCell - 0.5, miniCell - 0.5);
              }
            }
          }
        }

        const isTargetedByMe = this.self && this.self.targetId === p.id;
        const isTargetingMe = this.self && p.targetId === this.self.id;
        ctx.strokeStyle = isTargetedByMe ? '#fde047' : (isTargetingMe ? '#ff2e93' : 'rgba(56,189,248,0.35)');
        ctx.lineWidth = (isTargetedByMe || isTargetingMe) ? 2 : 1;
        ctx.strokeRect(x, y, cellW, cellH);
      });
    },

    drawTargetLasersOnFX(ctx) {
      if (!this.active || !this.self || !this.self.alive || !this.selfCanvas) return;
      const sr = this.selfCanvas.getBoundingClientRect();
      if (!sr.width) return;
      const sx = sr.left + sr.width * 0.5;
      const sy = sr.top + sr.height * 0.5;

      const drawBeamTo = (targetPlayer, color) => {
        if (!targetPlayer || !targetPlayer.alive) return;
        const isLeft = targetPlayer.id < 50;
        const canvas = isLeft ? this.leftCanvas : this.rightCanvas;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        const localIdx = isLeft ? targetPlayer.id : (targetPlayer.id - 50);
        const cols = 7;
        const rows = Math.ceil((isLeft ? 50 : 49) / cols);
        const padX = 6, padTop = 20, gap = 4;
        const cellW = Math.max(24, (rect.width - padX * 2 - gap * (cols - 1)) / cols);
        const cellH = Math.max(36, (rect.height - padTop - 6 - gap * (rows - 1)) / rows);
        const tx = rect.left + padX + (localIdx % cols) * (cellW + gap) + cellW * 0.5;
        const ty = rect.top + padTop + Math.floor(localIdx / cols) * (cellH + gap) + cellH * 0.5;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.restore();
      };

      if (this.self.targetId !== null) drawBeamTo(this.players[this.self.targetId], '#fde047');
      for (const attId of this.counterAttackers) {
        drawBeamTo(this.players[attId], '#ff2e93');
      }
    }
  };

