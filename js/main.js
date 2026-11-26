'use strict';


  /* =========================================================================
     0. FIREBASE CONFIG (Authentication + Cloud Firestore)
     Firebaseコンソール → プロジェクト設定 → マイアプリ から値を貼り付けてください。
     未設定（"YOUR_API_KEY"）またはオフライン時は自動でゲスト（ローカル）モードで動作します。
     ========================================================================= */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAd1HsTKp4pMpr7Nz19EKTaWenSZ_cLkXk",
    authDomain: "puyotet-arena-b60cc.firebaseapp.com",
    projectId: "puyotet-arena-b60cc",
    storageBucket: "puyotet-arena-b60cc.firebasestorage.app",
    messagingSenderId: "713097149059",
    appId: "1:713097149059:web:b1dec993fb9848d3ff39b6"
  };

  let fbApp = null;
  let fbAuth = null;
  let fbDb = null;
  let fbReady = false;
  let fbUser = null;
  let fbSaveTimer = null;
  let fbLeaderboardCache = null;

  function isFirebaseConfigured() {
    return !!(
      typeof firebase !== 'undefined' &&
      FIREBASE_CONFIG &&
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY' &&
      FIREBASE_CONFIG.projectId &&
      FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID'
    );
  }

  function initFirebaseSafe() {
    if (!isFirebaseConfigured()) {
      fbReady = false;
      return;
    }
    try {
      fbApp = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
      fbReady = true;
    } catch (e) {
      fbReady = false;
      fbAuth = null;
      fbDb = null;
    }
  }
  initFirebaseSafe();

  function formatFirebaseAuthError(err) {
    const code = (err && err.code) || '';
    switch (code) {
      case 'auth/email-already-in-use': return 'そのIDはすでに使われています。別のIDをお試しください。';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-login-credentials': return 'IDまたはパスワードが違います。';
      case 'auth/weak-password': return 'パスワードは6文字以上にしてください。';
      case 'auth/invalid-email': return 'ユーザーIDの形式が正しくありません。';
      case 'auth/too-many-requests': return '試行回数が多すぎます。少し待ってから再度お試しください。';
      case 'auth/network-request-failed': return 'ネットワークエラーです。通信環境を確認してください。';
      case 'auth/popup-blocked': return 'ポップアップがブロックされました。上の『ID＋パスワード』をご利用ください。';
      case 'auth/popup-closed-by-user': return 'ログインウィンドウが閉じられました。';
      case 'auth/unauthorized-domain': return 'このドメインはGoogleログイン未許可です。上の『ID＋パスワード』をご利用ください。';
      case 'auth/operation-not-allowed': return 'Firebaseコンソールでこの認証方式を有効にしてください。';
      default: return '認証エラーが発生しました（' + (code || 'unknown') + '）。';
    }
  }

  function getAuthAccountDisplayName(user) {
    if (!user) return '';
    if (user.email && user.email.endsWith('@puyotet.local')) {
      return user.email.slice(0, -'@puyotet.local'.length);
    }
    return user.displayName || (user.email ? user.email.split('@')[0] : 'ACCOUNT');
  }

  function setCloudBadgeState(state) {
    const badge = document.getElementById('cloudSyncBadge');
    const topBtn = document.getElementById('btnAuthModal');
    if (topBtn) {
      if (fbUser) {
        const label = getAuthAccountDisplayName(fbUser).slice(0, 12);
        topBtn.textContent = `👤 ${label}`;
        topBtn.classList.add('active');
      } else {
        topBtn.textContent = '👤 ログイン / 登録';
        topBtn.classList.remove('active');
      }
    }
    if (!badge) return;
    badge.classList.remove('synced', 'syncing');
    if (!fbUser) {
      badge.textContent = '☁ クラウド保存：未ログイン（ゲスト）';
    } else if (state === 'syncing') {
      badge.textContent = '☁ クラウド同期中...';
      badge.classList.add('syncing');
    } else if (state === 'error') {
      badge.textContent = '☁ クラウド保存：オフライン待機中';
    } else {
      badge.textContent = '☁ クラウド同期済';
      badge.classList.add('synced');
    }
  }

  function normalizeProfileData(parsed) {
    const owned = Array.isArray(parsed.ownedThemes) && parsed.ownedThemes.length > 0
      ? Array.from(new Set(['neon', ...parsed.ownedThemes.filter(id => THEMES[id])]))
      : ['neon'];
    const actTheme = (parsed.activeTheme && owned.includes(parsed.activeTheme)) ? parsed.activeTheme : 'neon';
    const ownedSk = Array.isArray(parsed.ownedSkins) && parsed.ownedSkins.length > 0
      ? Array.from(new Set(['classic', ...parsed.ownedSkins.filter(id => SKINS[id])]))
      : ['classic'];
    const actSkin = (parsed.activeSkin && ownedSk.includes(parsed.activeSkin)) ? parsed.activeSkin : 'classic';
    const ownedFx = Array.isArray(parsed.ownedEffects) && parsed.ownedEffects.length > 0
      ? Array.from(new Set(['default', ...parsed.ownedEffects.filter(id => EFFECTS[id])]))
      : ['default'];
    const actFx = (parsed.activeEffect && ownedFx.includes(parsed.activeEffect)) ? parsed.activeEffect : 'default';
    const ownedSe = Array.isArray(parsed.ownedSePacks) && parsed.ownedSePacks.length > 0
      ? Array.from(new Set(['chiptune', ...parsed.ownedSePacks.filter(id => SE_PACKS[id])]))
      : ['chiptune'];
    const actSe = (parsed.activeSePack && ownedSe.includes(parsed.activeSePack)) ? parsed.activeSePack : 'chiptune';
    const achs = Array.isArray(parsed.achievements) ? Array.from(new Set(parsed.achievements.filter(id => ACHIEVEMENTS.some(a => a.id === id)))) : [];
    const actTitle = (parsed.activeTitle === 'admin' || parsed.activeTitle === 'special_ren' || (parsed.activeTitle && achs.includes(parsed.activeTitle)))
      ? parsed.activeTitle : '';
    const lv = (typeof parsed.level === 'number' && Number.isFinite(parsed.level)) ? Math.min(100, Math.max(1, Math.floor(parsed.level))) : 1;
    const xpVal = (typeof parsed.xp === 'number' && Number.isFinite(parsed.xp) && parsed.xp >= 0) ? Math.floor(parsed.xp) : 0;
    const prest = (typeof parsed.prestige === 'number' && Number.isFinite(parsed.prestige) && parsed.prestige >= 0) ? Math.floor(parsed.prestige) : 0;
    const pNo = (typeof parsed.playerNo === 'number' && Number.isFinite(parsed.playerNo) && parsed.playerNo >= 1) ? Math.floor(parsed.playerNo) : null;
    const jAt = (typeof parsed.joinedAt === 'number' && Number.isFinite(parsed.joinedAt) && parsed.joinedAt > 0) ? Math.floor(parsed.joinedAt) : null;
    return {
      ...JSON.parse(JSON.stringify(defaultProfile)),
      ...parsed,
      playerNo: pNo,
      joinedAt: jAt,
      coins: (typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) && parsed.coins >= 0) ? Math.floor(parsed.coins) : 200,
      xp: xpVal,
      level: lv,
      prestige: prest,
      ownedThemes: owned,
      activeTheme: actTheme,
      ownedSkins: ownedSk,
      activeSkin: actSkin,
      ownedEffects: ownedFx,
      activeEffect: actFx,
      ownedSePacks: ownedSe,
      activeSePack: actSe,
      achievements: achs,
      activeTitle: actTitle,
      loginBonus: (parsed.loginBonus && typeof parsed.loginBonus === 'object')
        ? { lastDate: String(parsed.loginBonus.lastDate || ''), streak: Math.max(0, Math.floor(parsed.loginBonus.streak || 0)) }
        : { lastDate: '', streak: 0 },
      weekly: (parsed.weekly && typeof parsed.weekly === 'object')
        ? { weekKey: String(parsed.weekly.weekKey || ''), missions: Array.isArray(parsed.weekly.missions) ? parsed.weekly.missions : [] }
        : { weekKey: '', missions: [] },
      dailySeed: (parsed.dailySeed && typeof parsed.dailySeed === 'object')
        ? {
            lastRewardDate: String(parsed.dailySeed.lastRewardDate || ''),
            playedDates: Array.isArray(parsed.dailySeed.playedDates) ? parsed.dailySeed.playedDates.slice(-60) : [],
            bestByDate: (parsed.dailySeed.bestByDate && typeof parsed.dailySeed.bestByDate === 'object') ? parsed.dailySeed.bestByDate : {}
          }
        : { lastRewardDate: '', playedDates: [], bestByDate: {} },
      puzzles: (parsed.puzzles && typeof parsed.puzzles === 'object') ? parsed.puzzles : {},
      statsTotal: (() => {
        const s = (parsed.statsTotal && typeof parsed.statsTotal === 'object') ? parsed.statsTotal : {};
        const n = (k) => (typeof s[k] === 'number' && Number.isFinite(s[k]) && s[k] >= 0) ? Math.floor(s[k]) : 0;
        return {
          tspins: n('tspins'),
          lines: n('lines'),
          tetris4: n('tetris4'),
          chains: n('chains'),
          totalWins: n('totalWins'),
          totalPlays: n('totalPlays'),
          br99KOs: n('br99KOs'),
          perfectClears: n('perfectClears'),
          counters: n('counters')
        };
      })(),
      daily: (parsed.daily && typeof parsed.daily === 'object') ? parsed.daily : { date: '', missions: [] },
      skillRating: (typeof parsed.skillRating === 'number' && Number.isFinite(parsed.skillRating) && parsed.skillRating >= 0) ? Math.round(parsed.skillRating) : 1500,
      maxSkillRating: (typeof parsed.maxSkillRating === 'number' && Number.isFinite(parsed.maxSkillRating) && parsed.maxSkillRating >= 0) ? Math.round(parsed.maxSkillRating) : 1500,
      skillWins: (typeof parsed.skillWins === 'number' && Number.isFinite(parsed.skillWins) && parsed.skillWins >= 0) ? Math.floor(parsed.skillWins) : 0,
      skillLosses: (typeof parsed.skillLosses === 'number' && Number.isFinite(parsed.skillLosses) && parsed.skillLosses >= 0) ? Math.floor(parsed.skillLosses) : 0,
      ownedSkills: (parsed.ownedSkills && typeof parsed.ownedSkills === 'object' && Object.keys(parsed.ownedSkills).length > 0)
        ? parsed.ownedSkills : { sk_n01: 1, sk_n06: 1, sk_n15: 1 },
      equippedSkills: Array.isArray(parsed.equippedSkills)
        ? parsed.equippedSkills.slice(0, 3) : ['sk_n01', 'sk_n06', 'sk_n15'],
      skillGachaCount: (typeof parsed.skillGachaCount === 'number' && Number.isFinite(parsed.skillGachaCount) && parsed.skillGachaCount >= 0) ? Math.floor(parsed.skillGachaCount) : 0,
      records: { ...defaultProfile.records, ...(parsed.records || {}) },
      settings: {
        ...defaultProfile.settings,
        ...(parsed.settings || {}),
        sdf: (parsed.settings && parsed.settings.sdf === 'inf') ? '40' : ((parsed.settings && parsed.settings.sdf) || defaultProfile.settings.sdf),
        keys: { ...DEFAULT_KEYS, ...((parsed.settings && parsed.settings.keys) || {}) }
      },
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 10) : []
    };
  }

  function scheduleCloudProfileSave() {
    if (!fbReady || !fbDb || !fbUser) return;
    setCloudBadgeState('syncing');
    clearTimeout(fbSaveTimer);
    fbSaveTimer = setTimeout(() => {
      syncCloudNow(false);
    }, 1500);
  }

  async function syncCloudNow(includeLeaderboard = true, showNotice = false) {
    if (!fbReady || !fbDb || !fbUser) return false;
    clearTimeout(fbSaveTimer);
    setCloudBadgeState('syncing');
    try {
      const uid = fbUser.uid;
      const cleanProfile = JSON.parse(JSON.stringify(profile));
      cleanProfile.updatedAt = Date.now();
      await fbDb.collection('users').doc(uid).set(cleanProfile, { merge: true });
      if (includeLeaderboard) {
        const pub = buildPublicRecord();
        pub.uid = uid;
        await fbDb.collection('leaderboard').doc(uid).set(pub, { merge: true });
      }
      setCloudBadgeState('synced');
      if (showNotice) showToast('☁ クラウドと同期しました！');
      return true;
    } catch (e) {
      setCloudBadgeState('error');
      if (showNotice) showToast('⚠ クラウド同期に失敗しました（オフラインまたは権限設定を確認）');
      return false;
    }
  }

  let cloudProfileLoadingUid = null;

  function formatPlayerId(no) {
    if (typeof no !== 'number' || !Number.isFinite(no) || no < 1) return '';
    const n = Math.floor(no);
    return '#' + (n >= 10000 ? String(n) : String(n).padStart(4, '0'));
  }

  function formatJoinedMonth(ts) {
    if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return '';
    const d = new Date(ts);
    return `Since ${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function renderPlayerIdBadgeHtml(no, showGuest = false, compact = false) {
    const idStr = formatPlayerId(no);
    if (idStr) {
      const isVet = no <= 5;
      const prefix = isVet ? '👑 ' : '';
      const label = compact ? `${prefix}${idStr}` : `${prefix}ID ${idStr}`;
      return `<span class="pid-badge${isVet ? ' veteran' : ''}">${label}</span>`;
    }
    return showGuest ? '<span class="pid-badge guest">ID: GUEST</span>' : '';
  }

  function setPlayerIdBadgeEl(elId, no, showGuest = false, compact = false) {
    const el = document.getElementById(elId);
    if (!el) return;
    const idStr = formatPlayerId(no);
    if (idStr) {
      const isVet = no <= 5;
      el.textContent = (isVet ? '👑 ' : '') + (compact ? idStr : `ID ${idStr}`);
      el.className = 'pid-badge' + (isVet ? ' veteran' : '');
      el.style.display = 'inline-flex';
    } else if (showGuest) {
      el.textContent = 'ID: GUEST';
      el.className = 'pid-badge guest';
      el.style.display = 'inline-flex';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  async function ensureCloudPlayerNo(user) {
    if (!fbReady || !fbDb || !user) return;
    if (typeof profile.playerNo === 'number' && profile.playerNo >= 1) return;
    try {
      const counterRef = fbDb.collection('meta').doc('counters');
      const userRef = fbDb.collection('users').doc(user.uid);
      const assignedNo = await fbDb.runTransaction(async (tx) => {
        const uSnap = await tx.get(userRef);
        if (uSnap.exists && uSnap.data() && typeof uSnap.data().playerNo === 'number' && uSnap.data().playerNo >= 1) {
          return Math.floor(uSnap.data().playerNo);
        }
        const cSnap = await tx.get(counterRef);
        const cur = (cSnap.exists && cSnap.data() && typeof cSnap.data().lastPlayerNo === 'number')
          ? Math.floor(cSnap.data().lastPlayerNo)
          : 0;
        const nextNo = cur + 1;
        tx.set(counterRef, { lastPlayerNo: nextNo, updatedAt: Date.now() }, { merge: true });
        const joinedAt = (uSnap.exists && uSnap.data() && typeof uSnap.data().joinedAt === 'number' && uSnap.data().joinedAt > 0)
          ? Math.floor(uSnap.data().joinedAt)
          : (profile.joinedAt || Date.now());
        tx.set(userRef, { playerNo: nextNo, joinedAt }, { merge: true });
        return nextNo;
      });
      if (typeof assignedNo === 'number' && assignedNo >= 1) {
        profile.playerNo = assignedNo;
        if (!profile.joinedAt) profile.joinedAt = Date.now();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch (e) {}
      }
    } catch (e) {
      // Permission or offline fallback: do not block game flow
    }
  }

  async function loadOrMigrateCloudProfile(user) {
    if (!fbReady || !fbDb || !user) return;
    if (cloudProfileLoadingUid === user.uid) return;
    cloudProfileLoadingUid = user.uid;
    setCloudBadgeState('syncing');
    try {
      const ref = fbDb.collection('users').doc(user.uid);
      const snap = await ref.get();
      if (snap.exists && snap.data()) {
        profile = normalizeProfileData(snap.data());
        await ensureCloudPlayerNo(user);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch (e) {}
        renderProfileUI();
        const pub = buildPublicRecord();
        pub.uid = user.uid;
        fbDb.collection('leaderboard').doc(user.uid).set(pub, { merge: true }).catch(() => {});
        setCloudBadgeState('synced');
        showToast(`☁ クラウドデータを読み込みました（${profile.name}）`);
      } else {
        if (profile.name === 'PLAYER') {
          const accName = getAuthAccountDisplayName(user).slice(0, 16);
          if (accName) profile.name = accName;
        }
        if (!profile.joinedAt) profile.joinedAt = Date.now();
        await ensureCloudPlayerNo(user);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch (e) {}
        await syncCloudNow(true, false);
        renderProfileUI();
        showToast('☁ ゲストの戦績をクラウドへ引き継ぎました！');
      }
    } catch (e) {
      setCloudBadgeState('error');
    } finally {
      if (cloudProfileLoadingUid === user.uid) cloudProfileLoadingUid = null;
    }
  }

  async function fetchCloudLeaderboard() {
    if (!fbReady || !fbDb) {
      fbLeaderboardCache = null;
      return;
    }
    try {
      const snap = await fbDb.collection('leaderboard').orderBy('rating', 'desc').limit(50).get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d && typeof d.name === 'string') {
          rows.push({
            uid: doc.id,
            deviceId: d.deviceId || '',
            name: d.name.slice(0, 16),
            playerNo: (typeof d.playerNo === 'number' && d.playerNo >= 1) ? Math.floor(d.playerNo) : null,
            title: d.title || '',
            rating: Number(d.rating) || 1500,
            wins: Number(d.wins) || 0,
            losses: Number(d.losses) || 0,
            skillRating: Number(d.skillRating) || 1500,
            skillWins: Number(d.skillWins) || 0,
            skillLosses: Number(d.skillLosses) || 0,
            bestSprintMs: (typeof d.bestSprintMs === 'number' && d.bestSprintMs > 0) ? d.bestSprintMs : null,
            bestUltraScore: Number(d.bestUltraScore) || 0,
            bestCheese10Ms: (typeof d.bestCheese10Ms === 'number' && d.bestCheese10Ms > 0) ? d.bestCheese10Ms : null,
            bestCheese20Ms: (typeof d.bestCheese20Ms === 'number' && d.bestCheese20Ms > 0) ? d.bestCheese20Ms : null,
            bestBr99Rank: (typeof d.bestBr99Rank === 'number' && d.bestBr99Rank >= 1) ? d.bestBr99Rank : null,
            br99Wins: Number(d.br99Wins) || 0,
            maxChain: Number(d.maxChain) || 0,
            bestEndlessScore: Number(d.bestEndlessScore) || 0,
            updatedAt: d.updatedAt || 0
          });
        }
      });
      fbLeaderboardCache = rows;
    } catch (e) {
      fbLeaderboardCache = null;
    }
  }

  /* =========================================================================
     1. UTILITIES, STORAGE, KEY CONFIG, RECORDS, ELO & RANK SYSTEM
     ========================================================================= */
  const STORAGE_KEY = 'puyotet_online_profile_v2';
  const DEVICE_ID_KEY = 'puyotet_device_id_v2';
  const LEADERBOARD_KEY = 'puyotet_leaderboard_v2';

  function getOrCreateDeviceId() {
    try {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : ('dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return 'dev-ephemeral-' + Math.random().toString(36).slice(2, 12);
    }
  }
  const DEVICE_ID = getOrCreateDeviceId();
  const DEFAULT_KEYS = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    down: 'ArrowDown',
    hard: 'ArrowUp',
    cw: 'KeyX',
    ccw: 'KeyZ',
    rot180: 'KeyS',
    hold: 'KeyC',
    pause: 'KeyP',
    undo: 'Backspace',
    retry: 'KeyR'
  };
  const KEY_LABELS = {
    left: '左移動',
    right: '右移動',
    down: 'ソフトドロップ',
    hard: 'ハードドロップ (テトリス)',
    cw: '右回転 (CW)',
    ccw: '左回転 (CCW)',
    rot180: '180度回転 (テトリス)',
    hold: 'ホールド (テトリス)',
    pause: 'ポーズ',
    undo: '1手戻す (とことんぷよ)',
    retry: '即リトライ (オフライン)'
  };
  const defaultProfile = {
    name: 'PLAYER',
    playerNo: null,
    joinedAt: null,
    favStyle: 'tetris',
    rating: 1500,
    maxRating: 1500,
    wins: 0,
    losses: 0,
    skillRating: 1500,
    maxSkillRating: 1500,
    skillWins: 0,
    skillLosses: 0,
    ownedSkills: { sk_n01: 1, sk_n06: 1, sk_n15: 1 },
    equippedSkills: ['sk_n01', 'sk_n06', 'sk_n15'],
    skillGachaCount: 0,
    streak: 0,
    bestStreak: 0,
    coins: 200,
    xp: 0,
    level: 1,
    prestige: 0,
    ownedThemes: ['neon'],
    activeTheme: 'neon',
    ownedSkins: ['classic'],
    activeSkin: 'classic',
    ownedEffects: ['default'],
    activeEffect: 'default',
    ownedSePacks: ['chiptune'],
    activeSePack: 'chiptune',
    achievements: [],
    activeTitle: '',
    statsTotal: { tspins: 0, lines: 0, tetris4: 0, chains: 0, totalWins: 0, totalPlays: 0, br99KOs: 0, perfectClears: 0, counters: 0 },
    daily: { date: '', missions: [] },
    weekly: { weekKey: '', missions: [] },
    loginBonus: { lastDate: '', streak: 0 },
    dailySeed: { lastRewardDate: '', playedDates: [], bestByDate: {} },
    puzzles: {},
    history: [],
    records: {
      bestSprintMs: null,
      bestUltraScore: 0,
      bestCheese10Ms: null,
      bestCheese20Ms: null,
      bestBr99Rank: null,
      br99Wins: 0,
      maxChain: 0,
      bestEndlessScore: 0,
      bestTowerFloor: 0,
      bestTowerMs: null,
      towerClears: 0,
      bestBigBangScore: 0,
      bestBigBangClears: 0
    },
    settings: {
      bgm: true,
      se: true,
      bgmVol: 70,
      seVol: 80,
      bgmMode: 'auto',
      das: 150,
      arr: 35,
      sdf: '20',
      colorblind: false,
      keys: { ...DEFAULT_KEYS }
    }
  };

  const THEMES = {
    neon: {
      id: 'neon', name: 'CYBER NEON', price: 0,
      desc: '標準のネオンシアン＆ダークネイビー',
      swatches: ['#070a14', '#00f0ff', '#ff2e93', '#a855f7'],
      bgGrad: 'radial-gradient(circle at 20% 0%, #131c3a 0%, #070a14 55%, #04060d 100%)',
      panelBg: 'linear-gradient(160deg, rgba(21,30,56,0.92), rgba(11,16,32,0.96))',
      cyan: '#00f0ff', pink: '#ff2e93', borderGlow: 'rgba(56, 189, 248, 0.25)',
      canvasBg: '#060a16', fieldBg: '#070c1b', gridLine: 'rgba(148,163,184,0.09)',
      tetrisBorder: 'rgba(0,240,255,0.55)', puyoBorder: 'rgba(255,46,147,0.6)',
      sideBoxBg: 'rgba(15,23,42,0.9)', sideBoxBorder: 'rgba(56,189,248,0.35)',
      labelT: '#38bdf8', labelP: '#f9a8d4'
    },
    highcontrast: {
      id: 'highcontrast', name: 'HIGH CONTRAST', price: 300,
      desc: '競技向け純黒背景＋くっきり白枠＆鮮明グリッド',
      swatches: ['#000000', '#ffffff', '#38bdf8', '#fde047'],
      bgGrad: 'linear-gradient(180deg, #050505 0%, #000000 100%)',
      panelBg: 'linear-gradient(160deg, rgba(16,16,18,0.96), rgba(5,5,7,0.98))',
      cyan: '#ffffff', pink: '#fde047', borderGlow: 'rgba(255, 255, 255, 0.42)',
      canvasBg: '#000000', fieldBg: '#000000', gridLine: 'rgba(255,255,255,0.18)',
      tetrisBorder: '#ffffff', puyoBorder: '#ffffff',
      sideBoxBg: 'rgba(10,10,12,0.96)', sideBoxBorder: 'rgba(255,255,255,0.65)',
      labelT: '#ffffff', labelP: '#fde047'
    },
    arcade: {
      id: 'arcade', name: 'CLASSIC ARCADE', price: 400,
      desc: 'レトロ筐体風の深緑ネイビー＋暖色アクセント',
      swatches: ['#091c22', '#fb923c', '#facc15', '#2dd4bf'],
      bgGrad: 'radial-gradient(circle at 30% 0%, #102e34 0%, #07161a 60%, #030b0d 100%)',
      panelBg: 'linear-gradient(160deg, rgba(14,40,46,0.93), rgba(8,22,26,0.97))',
      cyan: '#facc15', pink: '#fb923c', borderGlow: 'rgba(250, 204, 21, 0.35)',
      canvasBg: '#061317', fieldBg: '#081b20', gridLine: 'rgba(45,212,191,0.13)',
      tetrisBorder: '#facc15', puyoBorder: '#fb923c',
      sideBoxBg: 'rgba(10,29,34,0.92)', sideBoxBorder: 'rgba(250,204,21,0.45)',
      labelT: '#fde047', labelP: '#fdba74'
    },
    sakura: {
      id: 'sakura', name: 'SAKURA NIGHT', price: 600,
      desc: '夜桜ピンク＆紫グラデーションの和モダン盤面',
      swatches: ['#1d0c2e', '#f472b6', '#c084fc', '#fbcfe8'],
      bgGrad: 'radial-gradient(circle at 20% 0%, #311245 0%, #160926 55%, #0a0414 100%)',
      panelBg: 'linear-gradient(160deg, rgba(44,18,64,0.92), rgba(20,8,34,0.96))',
      cyan: '#f472b6', pink: '#c084fc', borderGlow: 'rgba(244, 114, 182, 0.38)',
      canvasBg: '#120720', fieldBg: '#180a2b', gridLine: 'rgba(244,114,182,0.12)',
      tetrisBorder: '#f472b6', puyoBorder: '#e879f9',
      sideBoxBg: 'rgba(32,12,50,0.92)', sideBoxBorder: 'rgba(244,114,182,0.45)',
      labelT: '#f9a8d4', labelP: '#e9d5ff'
    },
    matrix: {
      id: 'matrix', name: 'EMERALD MATRIX', price: 600,
      desc: 'サイバーグリーン＆ブラックのデジタル盤面',
      swatches: ['#02140a', '#22c55e', '#4ade80', '#10b981'],
      bgGrad: 'radial-gradient(circle at 25% 0%, #063018 0%, #021209 55%, #010804 100%)',
      panelBg: 'linear-gradient(160deg, rgba(6,36,20,0.92), rgba(2,16,9,0.96))',
      cyan: '#4ade80', pink: '#10b981', borderGlow: 'rgba(74, 222, 128, 0.36)',
      canvasBg: '#020d06', fieldBg: '#03150a', gridLine: 'rgba(34,197,94,0.14)',
      tetrisBorder: '#4ade80', puyoBorder: '#2dd4bf',
      sideBoxBg: 'rgba(4,26,14,0.92)', sideBoxBorder: 'rgba(74,222,128,0.45)',
      labelT: '#4ade80', labelP: '#5eead4'
    },
    gold: {
      id: 'gold', name: 'ROYAL GOLD', price: 1200,
      desc: '高級感ある漆黒＆ゴールドネオン枠（上級者向け）',
      swatches: ['#141005', '#fbbf24', '#fde047', '#f59e0b'],
      bgGrad: 'radial-gradient(circle at 20% 0%, #2b2109 0%, #100c03 55%, #070501 100%)',
      panelBg: 'linear-gradient(160deg, rgba(36,28,10,0.94), rgba(14,11,4,0.98))',
      cyan: '#fbbf24', pink: '#f59e0b', borderGlow: 'rgba(251, 191, 36, 0.45)',
      canvasBg: '#0a0802', fieldBg: '#100c04', gridLine: 'rgba(251,191,36,0.13)',
      tetrisBorder: '#fbbf24', puyoBorder: '#fde047',
      sideBoxBg: 'rgba(24,18,6,0.94)', sideBoxBorder: 'rgba(251,191,36,0.55)',
      labelT: '#fde047', labelP: '#fcd34d'
    },
    pastel: {
      id: 'pastel', name: 'PASTEL POP', price: 450,
      desc: '優しいクリーム背景＆ミント・コーラルのポップ配色（非ネオン）',
      swatches: ['#fff9f0', '#2cb5a0', '#f47280', '#3b3248'],
      bgGrad: 'linear-gradient(160deg, #fffaf2 0%, #f4f1ff 55%, #eefaf7 100%)',
      panelBg: 'rgba(255, 255, 255, 0.92)',
      topbarBg: 'rgba(255, 250, 244, 0.94)',
      cardSubBg: 'rgba(248, 244, 238, 0.92)',
      textMain: '#2d2638', textDim: '#6b627a',
      isLight: true, noGlow: true,
      cyan: '#1fa693', pink: '#e85d75', borderGlow: 'rgba(130, 118, 150, 0.30)',
      canvasBg: '#fdf7ee', fieldBg: '#ffffff', gridLine: 'rgba(60, 50, 80, 0.08)',
      tetrisBorder: '#2cb5a0', puyoBorder: '#f47280',
      sideBoxBg: '#f6efe5', sideBoxBorder: 'rgba(44, 181, 160, 0.45)',
      labelT: '#158574', labelP: '#d94862'
    },
    wafu: {
      id: 'wafu', name: 'WAFU PAPER', price: 550,
      desc: '生成り和紙ベースに墨・朱色・抹茶の落ち着いた和風テーマ（非ネオン）',
      swatches: ['#f4ede0', '#b83b2a', '#4f7a4b', '#26231f'],
      bgGrad: 'linear-gradient(160deg, #f6f0e4 0%, #ece3d1 55%, #e5dac5 100%)',
      panelBg: 'rgba(250, 245, 235, 0.94)',
      topbarBg: 'rgba(244, 237, 224, 0.95)',
      cardSubBg: 'rgba(239, 231, 216, 0.92)',
      textMain: '#26231f', textDim: '#665e53',
      isLight: true, noGlow: true,
      cyan: '#4f7a4b', pink: '#b83b2a', borderGlow: 'rgba(70, 58, 44, 0.28)',
      canvasBg: '#efe7d6', fieldBg: '#faf5ea', gridLine: 'rgba(38, 35, 31, 0.09)',
      tetrisBorder: '#4f7a4b', puyoBorder: '#b83b2a',
      sideBoxBg: '#ebe1cd', sideBoxBorder: 'rgba(70, 58, 44, 0.38)',
      labelT: '#3b6138', labelP: '#a32f20'
    },
    wood: {
      id: 'wood', name: 'WARM WOOD', price: 500,
      desc: '深みのあるウォールナット木目調とクリーム枠のカフェ風テーマ（非ネオン）',
      swatches: ['#2b1d14', '#d9a46b', '#e07a5f', '#f4eadc'],
      bgGrad: 'linear-gradient(160deg, #352318 0%, #241710 55%, #1a100b 100%)',
      panelBg: 'linear-gradient(160deg, rgba(56, 38, 27, 0.95), rgba(34, 22, 15, 0.97))',
      topbarBg: 'rgba(32, 21, 14, 0.95)',
      cardSubBg: 'rgba(48, 32, 22, 0.90)',
      textMain: '#f5ece0', textDim: '#cbb79f',
      isLight: false, noGlow: true,
      cyan: '#d9a46b', pink: '#e07a5f', borderGlow: 'rgba(217, 164, 107, 0.36)',
      canvasBg: '#21150e', fieldBg: '#2a1b12', gridLine: 'rgba(245, 236, 224, 0.08)',
      tetrisBorder: '#d9a46b', puyoBorder: '#e07a5f',
      sideBoxBg: '#2e1e14', sideBoxBorder: 'rgba(217, 164, 107, 0.45)',
      labelT: '#e8bc8a', labelP: '#f09a82'
    },
    gameboy: {
      id: 'gameboy', name: 'MONO GAMEBOY', price: 400,
      desc: '懐かしの携帯機オリーブグリーン液晶＆濃オリーブ枠（非ネオン）',
      swatches: ['#cadc9f', '#8bac0f', '#306230', '#0f380f'],
      bgGrad: 'linear-gradient(160deg, #d7e5b0 0%, #c4d697 55%, #b5ca84 100%)',
      panelBg: 'rgba(215, 229, 176, 0.94)',
      topbarBg: 'rgba(196, 214, 151, 0.96)',
      cardSubBg: 'rgba(181, 202, 132, 0.85)',
      textMain: '#0f380f', textDim: '#306230',
      isLight: true, noGlow: true,
      cyan: '#306230', pink: '#0f380f', borderGlow: 'rgba(15, 56, 15, 0.35)',
      canvasBg: '#9bbc0f', fieldBg: '#cadc9f', gridLine: 'rgba(15, 56, 15, 0.14)',
      tetrisBorder: '#0f380f', puyoBorder: '#306230',
      sideBoxBg: '#b8cc86', sideBoxBorder: 'rgba(15, 56, 15, 0.55)',
      labelT: '#0f380f', labelP: '#1d4d1d'
    },
    galaxy: {
      id: 'galaxy', name: 'DEEP GALAXY', price: 550,
      desc: '深宇宙パープルと星雲シアンが輝く壮大なコズミックテーマ',
      swatches: ['#090418', '#38bdf8', '#c084fc', '#f472b6'],
      bgGrad: 'radial-gradient(circle at 25% 15%, #2e1065 0%, #0f0728 52%, #050210 100%)',
      panelBg: 'linear-gradient(160deg, rgba(24, 14, 58, 0.94), rgba(10, 6, 28, 0.97))',
      topbarBg: 'rgba(10, 5, 26, 0.94)',
      cardSubBg: 'rgba(26, 15, 62, 0.78)',
      textMain: '#f5f3ff', textDim: '#c4b5fd',
      isLight: false, noGlow: false,
      cyan: '#38bdf8', pink: '#e879f9', borderGlow: 'rgba(192, 132, 252, 0.35)',
      canvasBg: '#070316', fieldBg: '#0d0626', gridLine: 'rgba(192, 132, 252, 0.11)',
      tetrisBorder: '#38bdf8', puyoBorder: '#e879f9',
      sideBoxBg: '#120930', sideBoxBorder: 'rgba(192, 132, 252, 0.4)',
      labelT: '#7dd3fc', labelP: '#f0abfc'
    },
    glacier: {
      id: 'glacier', name: 'ARCTIC GLACIER', price: 500,
      desc: '透き通る氷河アイスブルー＆クリスタルホワイトの爽快ライト系',
      swatches: ['#f0f9ff', '#0284c7', '#06b6d4', '#0f172a'],
      bgGrad: 'linear-gradient(160deg, #f0f9ff 0%, #e0f2fe 55%, #bae6fd 100%)',
      panelBg: 'rgba(255, 255, 255, 0.92)',
      topbarBg: 'rgba(240, 249, 255, 0.96)',
      cardSubBg: 'rgba(224, 242, 254, 0.85)',
      textMain: '#0c4a6e', textDim: '#0369a1',
      isLight: true, noGlow: true,
      cyan: '#0284c7', pink: '#0891b2', borderGlow: 'rgba(2, 132, 199, 0.3)',
      canvasBg: '#e0f2fe', fieldBg: '#f8fafc', gridLine: 'rgba(2, 132, 199, 0.12)',
      tetrisBorder: '#0284c7', puyoBorder: '#0891b2',
      sideBoxBg: '#ffffff', sideBoxBorder: 'rgba(2, 132, 199, 0.35)',
      labelT: '#0284c7', labelP: '#0891b2'
    },
    sunset: {
      id: 'sunset', name: 'CRIMSON SUNSET', price: 480,
      desc: '夕焼けオレンジとディープマゼンタが溶け合うドラマチックテーマ',
      swatches: ['#1c0b19', '#fb923c', '#f43f5e', '#fde047'],
      bgGrad: 'linear-gradient(160deg, #3b0a2a 0%, #1e0b1f 55%, #120610 100%)',
      panelBg: 'linear-gradient(160deg, rgba(55, 16, 40, 0.94), rgba(26, 9, 24, 0.97))',
      topbarBg: 'rgba(28, 9, 24, 0.95)',
      cardSubBg: 'rgba(58, 18, 42, 0.8)',
      textMain: '#fff7ed', textDim: '#fdba74',
      isLight: false, noGlow: false,
      cyan: '#fb923c', pink: '#f43f5e', borderGlow: 'rgba(251, 146, 60, 0.35)',
      canvasBg: '#160713', fieldBg: '#220b1c', gridLine: 'rgba(251, 146, 60, 0.1)',
      tetrisBorder: '#fb923c', puyoBorder: '#f43f5e',
      sideBoxBg: '#260d20', sideBoxBorder: 'rgba(251, 146, 60, 0.42)',
      labelT: '#fdba74', labelP: '#fda4af'
    },
    cyberyellow: {
      id: 'cyberyellow', name: 'CYBERPUNK 2099', price: 620,
      desc: '漆黒ボディに鮮烈なネオンイエロー＆シアンが走る近未来テーマ',
      swatches: ['#09090b', '#facc15', '#22d3ee', '#ef4444'],
      bgGrad: 'linear-gradient(160deg, #18181b 0%, #09090b 60%, #000000 100%)',
      panelBg: 'linear-gradient(160deg, rgba(24, 24, 27, 0.96), rgba(9, 9, 11, 0.98))',
      topbarBg: 'rgba(9, 9, 11, 0.96)',
      cardSubBg: 'rgba(30, 30, 36, 0.88)',
      textMain: '#fefce8', textDim: '#fde047',
      isLight: false, noGlow: false,
      cyan: '#facc15', pink: '#22d3ee', borderGlow: 'rgba(250, 204, 21, 0.4)',
      canvasBg: '#060608', fieldBg: '#101014', gridLine: 'rgba(250, 204, 21, 0.1)',
      tetrisBorder: '#facc15', puyoBorder: '#22d3ee',
      sideBoxBg: '#141418', sideBoxBorder: 'rgba(250, 204, 21, 0.5)',
      labelT: '#facc15', labelP: '#22d3ee'
    },
    abyss: {
      id: 'abyss', name: 'OCEAN ABYSS', price: 520,
      desc: '深海ネイビーと発光アクアマリンが静かに揺らめくディープマリン',
      swatches: ['#020c1b', '#2dd4bf', '#38bdf8', '#0f2942'],
      bgGrad: 'linear-gradient(160deg, #06213e 0%, #03152a 55%, #020b17 100%)',
      panelBg: 'linear-gradient(160deg, rgba(7, 32, 58, 0.95), rgba(3, 18, 36, 0.97))',
      topbarBg: 'rgba(3, 16, 32, 0.95)',
      cardSubBg: 'rgba(9, 38, 68, 0.8)',
      textMain: '#ecfeff', textDim: '#99f6e4',
      isLight: false, noGlow: false,
      cyan: '#2dd4bf', pink: '#38bdf8', borderGlow: 'rgba(45, 212, 191, 0.35)',
      canvasBg: '#020e1e', fieldBg: '#051a32', gridLine: 'rgba(45, 212, 191, 0.1)',
      tetrisBorder: '#2dd4bf', puyoBorder: '#38bdf8',
      sideBoxBg: '#07223e', sideBoxBorder: 'rgba(45, 212, 191, 0.42)',
      labelT: '#5eead4', labelP: '#7dd3fc'
    },
    matcha: {
      id: 'matcha', name: 'KYOTO MATCHA', price: 460,
      desc: '抹茶グリーンと黒漆が調和するシックな和モダンテーマ（非ネオン）',
      swatches: ['#141b14', '#84a955', '#d4a373', '#e9edc9'],
      bgGrad: 'linear-gradient(160deg, #1d261c 0%, #141b14 55%, #0e130e 100%)',
      panelBg: 'linear-gradient(160deg, rgba(31, 41, 30, 0.95), rgba(18, 24, 18, 0.97))',
      topbarBg: 'rgba(18, 24, 18, 0.95)',
      cardSubBg: 'rgba(36, 48, 35, 0.88)',
      textMain: '#f1f5e8', textDim: '#b8c9a3',
      isLight: false, noGlow: true,
      cyan: '#84a955', pink: '#d4a373', borderGlow: 'rgba(132, 169, 85, 0.36)',
      canvasBg: '#101610', fieldBg: '#172017', gridLine: 'rgba(233, 237, 201, 0.08)',
      tetrisBorder: '#84a955', puyoBorder: '#d4a373',
      sideBoxBg: '#1b261b', sideBoxBorder: 'rgba(132, 169, 85, 0.45)',
      labelT: '#a3c674', labelP: '#e2b88b'
    }
  };

  const EFFECTS = {
    default:   { id: 'default',   name: 'STANDARD SPARK', price: 0,   desc: '標準のクリーンなスパーク演出', swatches: ['#00f0ff', '#ff2e93', '#fde047', '#ffffff'] },
    fireworks: { id: 'fireworks', name: 'FIREWORKS 花火', price: 400, desc: '大消去・連鎖で夜空に花火が炸裂する華やか演出', swatches: ['#f43f5e', '#facc15', '#38bdf8', '#a855f7'] },
    sakura:    { id: 'sakura',    name: 'SAKURA 桜吹雪',  price: 500, desc: '淡い桜の花びらが舞い散る雅なパーティクル演出', swatches: ['#fbcfe8', '#f9a8d4', '#f472b6', '#fff1f2'] },
    lightning: { id: 'lightning', name: 'LIGHTNING 雷撃', price: 600, desc: '高圧の電撃ボルトと青白い放電スパークが走る演出', swatches: ['#e0f2fe', '#38bdf8', '#818cf8', '#facc15'] },
    pixel:     { id: 'pixel',     name: '8-BIT PIXEL',    price: 450, desc: 'ドット絵風の四角ブロックが弾け飛ぶレトロ爆発演出', swatches: ['#22c55e', '#facc15', '#ef4444', '#3b82f6'] },
    stardust:  { id: 'stardust',  name: 'STARDUST 星屑',  price: 700, desc: '星型パーティクルと銀河のきらめきが舞う豪華演出', swatches: ['#fef08a', '#c084fc', '#38bdf8', '#ffffff'] }
  };

  const SE_PACKS = {
    chiptune: { id: 'chiptune', name: 'CHIPTUNE (標準)',  price: 0,   desc: 'バランスの良い標準シンセチップチューン効果音', swatches: ['#00f0ff', '#38bdf8', '#818cf8', '#f1f5f9'] },
    arcade:   { id: 'arcade',   name: 'ARCADE FM風',      price: 450, desc: '重厚な倍音とキレのある硬派アーケード基板風サウンド', swatches: ['#f97316', '#ef4444', '#facc15', '#1e293b'] },
    crystal:  { id: 'crystal',  name: 'CRYSTAL BELL',     price: 550, desc: '透き通るクリスタルベルのような高音シマー音色', swatches: ['#e0f2fe', '#67e8f9', '#c084fc', '#ffffff'] },
    retro8:   { id: 'retro8',   name: 'RETRO 8-BIT',      price: 400, desc: 'ファミコン風パルス波のキレ味鋭い8ビット効果音', swatches: ['#4ade80', '#facc15', '#f43f5e', '#0f172a'] }
  };

  const SKINS = {
    classic: {
      id: 'classic', name: 'CLASSIC GLOSS', price: 0,
      desc: '標準の立体ベベルミノ＆ゼリーぷよ',
      swatches: ['#00f0ff', '#a000f0', '#ef4444', '#eab308']
    },
    flat: {
      id: 'flat', name: 'FLAT PRO', price: 350,
      desc: '競技向けのくっきりフラット配色＆シャープ枠',
      swatches: ['#38bdf8', '#c084fc', '#f87171', '#facc15']
    },
    crystal: {
      id: 'crystal', name: 'CRYSTAL JEWEL', price: 600,
      desc: '宝石のような多面カットハイライト＆輝き演出',
      swatches: ['#e0f2fe', '#67e8f9', '#f9a8d4', '#fef08a']
    },
    neonwire: {
      id: 'neonwire', name: 'NEON WIRE', price: 750,
      desc: '漆黒の中身にネオン発光フレームが光るサイバー仕様',
      swatches: ['#050811', '#00f0ff', '#ff2e93', '#4ade80']
    },
    retro8: {
      id: 'retro8', name: 'RETRO 8-BIT', price: 500,
      desc: 'ドット絵風のピクセル段差＆レトロな表情',
      swatches: ['#1d4ed8', '#15803d', '#b91c1c', '#ca8a04']
    }
  };

  const ACH_CATEGORIES = [
    { id: 'all',     label: 'すべて' },
    { id: 'basic',   label: '入門' },
    { id: 'tetris',  label: 'テトリス' },
    { id: 'puyo',    label: 'ぷよ' },
    { id: 'battle',  label: '対戦・99' },
    { id: 'extreme', label: '極限' }
  ];

  const ACHIEVEMENTS = [
    // --- basic (入門: 10) ---
    { id: 'first_play',   cat: 'basic',   name: '初陣',               desc: '試合またはチャレンジを初めてプレイする',                           title: 'チャレンジャー',     coins: 20 },
    { id: 'first_win',    cat: 'basic',   name: '初勝利',             desc: 'CPU対戦・オンラインまたは99で1勝する',                             title: 'ルーキー',           coins: 40 },
    { id: 'first_line',   cat: 'basic',   name: '最初の一歩',         desc: 'テトリスで初めてラインを消去する',                                 title: 'ライン消し入門',     coins: 20 },
    { id: 'first_tetris', cat: 'basic',   name: 'はじめてのTETRIS',   desc: 'テトリスで初めて4ライン同時消し（TETRIS）を決める',                title: '4ラインの目覚め',    coins: 30 },
    { id: 'chain2',       cat: 'basic',   name: '連鎖の芽生え',       desc: 'ぷよぷよで2連鎖以上を発動する',                                    title: 'ぷよ見習い',         coins: 20 },
    { id: 'tspin1',       cat: 'basic',   name: '回転の妙',           desc: '初めてT-Spinを決める',                                             title: 'スピナー見習い',     coins: 30 },
    { id: 'first_shop',   cat: 'basic',   name: 'こだわり派',         desc: 'ショップでテーマまたはスキンを初購入する',                         title: 'おしゃれ勢',         coins: 40 },
    { id: 'open_editor',  cat: 'basic',   name: '連鎖研究家',         desc: 'ぷよ連鎖エディタを起動する',                                       title: '連鎖研究者',         coins: 20 },
    { id: 'play10',       cat: 'basic',   name: '常連プレイヤー',     desc: '累計10試合プレイする',                                             title: 'アリーナ常連',       coins: 40 },
    { id: 'lines100',     cat: 'basic',   name: '100ライン突破',      desc: '累計100ライン消去する',                                            title: '積み込み入門',       coins: 40 },

    // --- tetris (テトリス技術・ソロ記録: 18) ---
    { id: 'tspin5',       cat: 'tetris',  name: 'T-Spin職人',         desc: 'T-Spinを累計5回決める',                                            title: 'T-Spin職人',         coins: 80 },
    { id: 'tspin30',      cat: 'tetris',  name: 'T-Spinの達人',       desc: 'T-Spinを累計30回決める',                                           title: '回転の達人',         coins: 150 },
    { id: 'tspin100',     cat: 'tetris',  name: 'T-Spinマスター',     desc: 'T-Spinを累計100回決める',                                          title: 'T-Spinマスター',     coins: 250 },
    { id: 'tetris20',     cat: 'tetris',  name: '四連撃の極意',       desc: '4ライン同時消し（TETRIS）を累計20回決める',                        title: 'テトリス職人',       coins: 80 },
    { id: 'ren5',         cat: 'tetris',  name: '怒涛の連撃',         desc: 'テトリスで5 REN以上を達成する',                                    title: 'コンボマスター',     coins: 100 },
    { id: 'ren8',         cat: 'tetris',  name: '止まらぬ猛攻',       desc: 'テトリスで8 REN以上を達成する',                                    title: 'RENの鬼',            coins: 180 },
    { id: 'ren12',        cat: 'tetris',  name: '無限連撃',           desc: 'テトリスで12 REN以上を達成する',                                   title: 'REN神',              coins: 280 },
    { id: 'sprint_clear', cat: 'tetris',  name: '40ライン完走',       desc: '40ラインスプリントを完走する',                                     title: 'スプリンター',       coins: 50 },
    { id: 'sprint90',     cat: 'tetris',  name: '疾風の積み手',       desc: '40ラインを90秒未満でクリアする',                                   title: '疾風の積み手',       coins: 80 },
    { id: 'sprint60',     cat: 'tetris',  name: '音速の積み手',       desc: '40ラインを60秒未満でクリアする',                                   title: '音速の積み手',       coins: 160 },
    { id: 'sprint40',     cat: 'tetris',  name: '光速の積み手',       desc: '40ラインを40秒未満でクリアする',                                   title: '光速の積み手',       coins: 300 },
    { id: 'ultra10k',     cat: 'tetris',  name: 'ウルトラ入門',       desc: 'ウルトラ（2分間）で10,000点以上を記録する',                        title: 'スコアラー',         coins: 50 },
    { id: 'ultra30k',     cat: 'tetris',  name: 'ウルトラ上級者',     desc: 'ウルトラ（2分間）で30,000点以上を記録する',                        title: 'ハイスコアラー',     coins: 120 },
    { id: 'ultra60k',     cat: 'tetris',  name: 'ウルトラ覇者',       desc: 'ウルトラ（2分間）で60,000点以上を記録する',                        title: 'スコアの覇者',       coins: 250 },
    { id: 'cheese10',     cat: 'tetris',  name: '掘り師入門',         desc: 'チーズレース10Lをクリアする',                                      title: '掘り師',             coins: 60 },
    { id: 'cheese20',     cat: 'tetris',  name: '伝説の掘り師',       desc: 'チーズレース20Lをクリアする',                                      title: '伝説の掘り師',       coins: 150 },
    { id: 'lines1000',    cat: 'tetris',  name: '千ラインの軌跡',     desc: '累計1,000ライン消去する',                                          title: '千本積み',           coins: 120 },
    { id: 'lines5000',    cat: 'tetris',  name: '五千ラインの境地',   desc: '累計5,000ライン消去する',                                          title: '積み上げの賢者',     coins: 250 },

    // --- puyo (ぷよぷよ技術: 9) ---
    { id: 'chain3',       cat: 'puyo',    name: '3連鎖の使い手',      desc: 'ぷよぷよで3連鎖以上を達成する',                                    title: '三連撃',             coins: 40 },
    { id: 'chain5',       cat: 'puyo',    name: '5連鎖マスター',      desc: 'ぷよぷよで5連鎖以上を達成する',                                    title: '連鎖使い',           coins: 80 },
    { id: 'chain7',       cat: 'puyo',    name: '7連鎖の導師',        desc: 'ぷよぷよで7連鎖以上を達成する',                                    title: '七色の連鎖',         coins: 150 },
    { id: 'chain10',      cat: 'puyo',    name: '大連鎖の境地',       desc: 'ぷよぷよで10連鎖以上を達成する',                                   title: '連鎖の魔術師',       coins: 220 },
    { id: 'chain13',      cat: 'puyo',    name: '伝説の13連鎖',       desc: 'ぷよぷよで13連鎖以上を達成する',                                   title: '連鎖神',             coins: 300 },
    { id: 'all_clear',    cat: 'puyo',    name: '完全燃焼',           desc: 'パーフェクトクリアまたは全消しを達成する',                         title: '完全燃焼',           coins: 120 },
    { id: 'all_clear5',   cat: 'puyo',    name: '全消しの達人',       desc: 'パーフェクトクリアまたは全消しを累計5回達成する',                  title: '盤面清掃人',         coins: 200 },
    { id: 'puyo5_win',    cat: 'puyo',    name: '5色の支配者',        desc: '5色ぷよ設定のCPU対戦で勝利する',                                   title: '五色の魔導師',       coins: 120 },
    { id: 'counter30',    cat: 'puyo',    name: '鉄壁の相殺師',       desc: 'おじゃま相殺を累計30回達成する',                                   title: '鉄壁の守り',         coins: 120 },

    // --- battle (対戦・ランク・TETRIS 99・コレクション: 17) ---
    { id: 'swap_combo',   cat: 'battle',  name: '二刀流の極み',       desc: 'SWAPモードでSWAP COMBOを発動する',                                 title: '二刀流',             coins: 80 },
    { id: 'upset_win',    cat: 'battle',  name: 'ジャイアントキラー', desc: 'ランクマッチで格上(+100以上)に勝利する',                           title: 'ジャイアントキラー', coins: 180 },
    { id: 'streak3',      cat: 'battle',  name: '勢いに乗る者',       desc: 'ランクマッチで3連勝を達成する',                                    title: '連勝街道',           coins: 100 },
    { id: 'streak5',      cat: 'battle',  name: '無敗の快進撃',       desc: 'ランクマッチで5連勝を達成する',                                    title: '不敗神話',           coins: 200 },
    { id: 'rank_plat',    cat: 'battle',  name: 'プラチナ到達',       desc: 'ランクマッチでPLATINUM (R1650+) に到達する',                       title: 'プラチナ',           coins: 120 },
    { id: 'rank_dia',     cat: 'battle',  name: 'ダイヤモンドの輝き', desc: 'ランクマッチでDIAMOND (R1800+) に到達する',                        title: 'ダイヤモンド',       coins: 200 },
    { id: 'rank_master',  cat: 'battle',  name: '頂点の証',           desc: 'ランクマッチでMASTER (R2000+) に到達する',                         title: 'グランドマスター',   coins: 300 },
    { id: 'br99_ko1',     cat: 'battle',  name: '99初撃破',           desc: 'TETRIS 99で初めてK.O.を獲得する',                                  title: 'ハンター',           coins: 40 },
    { id: 'br99_ko5',     cat: 'battle',  name: '99の狩人',           desc: 'TETRIS 99の1試合で5 K.O.以上を達成する',                           title: 'バーサーカー',       coins: 120 },
    { id: 'br99_ko30',    cat: 'battle',  name: '百戦錬磨の狩人',     desc: 'TETRIS 99で累計30 K.O.を達成する',                                 title: '99の死神',           coins: 220 },
    { id: 'br99_top50',   cat: 'battle',  name: '生存者',             desc: 'TETRIS 99でTOP50（50位以内）に入る',                               title: 'サバイバー',         coins: 40 },
    { id: 'br99_top10',   cat: 'battle',  name: '最終決戦',           desc: 'TETRIS 99でTOP10（10位以内）に入る',                               title: 'ファイナリスト',     coins: 120 },
    { id: 'br99_win',     cat: 'battle',  name: '99人の頂点',         desc: 'TETRIS 99で1位（TETRIS MAXIMUS）を獲得する',                       title: 'MAXIMUS',            coins: 250 },
    { id: 'br99_win3',    cat: 'battle',  name: '絶対王者',           desc: 'TETRIS 99で累計3回1位を獲得する',                                  title: '99の覇王',           coins: 300 },
    { id: 'wins50',       cat: 'battle',  name: '歴戦の猛者',         desc: '累計50勝を達成する（CPU＋オンライン＋99）',                        title: '歴戦の猛者',         coins: 200 },
    { id: 'themes5',      cat: 'battle',  name: '空間の演出家',       desc: 'ショップのテーマを合計5種類以上所持する',                          title: 'コレクター',         coins: 100 },
    { id: 'skins_all',    cat: 'battle',  name: 'スキンコンプリート', desc: 'ショップのスキンを全種類所持する',                                 title: 'スキンマスター',     coins: 200 },

    // --- extreme (高難易度・極限やりこみ: 7) ---
    { id: 'beat_imp',             cat: 'extreme', name: '人智を超える者',       desc: 'CPU IMPOSSIBLE (R2400) をFT2・火力ハンデなし・4色以上で撃破する',       title: 'AIキラー',       coins: 250 },
    { id: 'beat_imp_tetris',      cat: 'extreme', name: '絶対零度の積み手',     desc: 'VSルール・テトリスでCPU IMPOSSIBLEをFT2・ハンデなし・4色以上で撃破する', title: 'テト神',         coins: 350 },
    { id: 'beat_imp_puyo',        cat: 'extreme', name: '深淵の連鎖使い',       desc: 'VSルール・ぷよぷよでCPU IMPOSSIBLEをFT2・ハンデなし・4色以上で撃破する', title: 'ぷよ神',         coins: 350 },
    { id: 'beat_imp_swap',        cat: 'extreme', name: '二刀流の覇者',         desc: 'SWAPルールでCPU IMPOSSIBLEをFT2・ハンデなし・4色以上で撃破する',         title: 'スワップ神',     coins: 400 },
    { id: 'beat_imp_hell_tetris', cat: 'extreme', name: '【極】神域のテトリス', desc: 'VS・テトリスでCPU IMPOSSIBLEをFT2・自分50%／相手200%・4色以上で撃破する', title: '神域の積み手',   coins: 450 },
    { id: 'beat_imp_hell_puyo',   cat: 'extreme', name: '【極】神域のぷよぷよ', desc: 'VS・ぷよぷよでCPU IMPOSSIBLEをFT2・自分50%／相手200%・4色以上で撃破する', title: '神域の連鎖師',   coins: 450 },
    { id: 'beat_imp_hell_swap',   cat: 'extreme', name: '【極】神域の二刀流',   desc: 'SWAPでCPU IMPOSSIBLEをFT2・自分50%／相手200%・4色以上で撃破する',         title: '神域の覇者',     coins: 500 },

    // --- progression & new modes (14) ---
    { id: 'tower_floor5',         cat: 'battle',  name: '塔の中腹へ',           desc: 'CPUタワーで5Fを突破する',                                                 title: '登攀者',         coins: 100 },
    { id: 'tower_clear',          cat: 'extreme', name: 'タワー完全制覇',       desc: 'CPUタワー全10階層をノーコンティニューで制覇する',                         title: 'タワー覇者',     coins: 400 },
    { id: 'daily_seed1',          cat: 'basic',   name: 'シード初挑戦',         desc: 'デイリーシードに初めて挑戦する',                                           title: 'シード挑戦者',   coins: 30 },
    { id: 'daily_seed5',          cat: 'battle',  name: '毎日の日課',           desc: 'デイリーシードに累計5日間参加する',                                       title: 'シード常連',     coins: 120 },
    { id: 'puzzle10',             cat: 'tetris',  name: 'パズル道場・中伝',     desc: 'パズル道場で合計10問以上クリアする',                                       title: '詰めパズル師',   coins: 120 },
    { id: 'puzzle20',             cat: 'extreme', name: 'パズル道場・免許皆伝', desc: 'パズル道場の全20問を完全制覇する',                                         title: 'パズル宗師',     coins: 350 },
    { id: 'lv20',                 cat: 'basic',   name: '熟練の証 (Lv.20)',     desc: 'プレイヤーレベルが20に到達する',                                           title: 'ベテラン',       coins: 60 },
    { id: 'lv50',                 cat: 'battle',  name: '達人の領域 (Lv.50)',   desc: 'プレイヤーレベルが50に到達する',                                           title: 'マスター候補',   coins: 150 },
    { id: 'lv100',                cat: 'extreme', name: '限界突破 (Lv.100)',    desc: 'プレイヤーレベルが最大(Lv.100)に到達する',                                 title: 'カンスト勢',     coins: 300 },
    { id: 'prestige1',            cat: 'extreme', name: '転生者 (★1)',          desc: 'Lv.100から初めて転生（プレステージ）を実行する',                           title: '転生者',         coins: 400 },
    { id: 'buy_effect',           cat: 'basic',   name: '演出のこだわり',       desc: 'ショップで消去・連鎖エフェクトを購入する',                                 title: 'エフェクト使い', coins: 40 },
    { id: 'buy_sepack',           cat: 'basic',   name: '音色のこだわり',       desc: 'ショップでSEパックを購入する',                                             title: 'サウンド職人',   coins: 40 },
    { id: 'login7',               cat: 'battle',  name: '7日連続ログイン',      desc: '7日連続ログインボーナスを達成する',                                       title: '皆勤賞',         coins: 150 },
    { id: 'weekly_done',          cat: 'battle',  name: '週間チャンプ',         desc: 'ウィークリーミッションの報酬を受け取る',                                   title: '週間チャンプ',   coins: 100 }
  ];

  const WEEKLY_POOL = [
    { id: 'w_lines100', name: '今週中に累計100ライン消去する',     goal: 100, coins: 150, xp: 200 },
    { id: 'w_chains20', name: '今週中にぷよ連鎖を合計20回発動する', goal: 20,  coins: 150, xp: 200 },
    { id: 'w_wins10',   name: '今週中に試合で累計10勝する',        goal: 10,  coins: 200, xp: 250 }
  ];

  const DAILY_POOL = [
    { id: 'lines15',    name: 'ラインを合計15ライン消去',          goal: 15, coins: 60 },
    { id: 'chains3',    name: 'ぷよで合計3回以上連鎖を発動',       goal: 3,  coins: 60 },
    { id: 'tspin2',     name: 'T-Spinを合計2回決める',             goal: 2,  coins: 80 },
    { id: 'win1',       name: 'CPUまたはオンラインで1勝する',      goal: 1,  coins: 80 },
    { id: 'play2',      name: '試合を合計2回プレイする',           goal: 2,  coins: 50 },
    { id: 'challenge1', name: '40ラインまたはウルトラを1回完走',   goal: 1,  coins: 80 }
  ];

  function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const SPECIAL_REN_UIDS = new Set(['3RY4RS3O57X1Op840MKo5VJTkij2']);

  function getTitleName(titleId) {
    if (!titleId) return '';
    if (titleId === 'admin') return 'ADMIN';
    if (titleId === 'special_ren') return 'REN';
    const found = ACHIEVEMENTS.find(a => a.id === titleId);
    return found ? found.title : '';
  }

  function getTitleBadgeClass(titleId) {
    if (titleId === 'admin') return 'title-admin-rainbow';
    if (titleId === 'special_ren') return 'title-special-ren';
    return '';
  }

  function setTitleBadgeEl(elId, titleId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const txt = getTitleName(titleId);
    el.textContent = txt ? `《${txt}》` : '';
    el.classList.toggle('active', !!txt);
    el.classList.toggle('title-admin-rainbow', titleId === 'admin');
    el.classList.toggle('title-special-ren', titleId === 'special_ren');
  }

  function ensureDailyMissions() {
    const today = getTodayStr();
    if (!profile.daily || profile.daily.date !== today || !Array.isArray(profile.daily.missions) || profile.daily.missions.length !== 3) {
      let hash = 0;
      for (let i = 0; i < today.length; i++) hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
      const pool = DAILY_POOL.slice();
      const picked = [];
      for (let k = 0; k < 3; k++) {
        const idx = (hash + k * 7) % pool.length;
        const m = pool.splice(idx, 1)[0];
        picked.push({ id: m.id, progress: 0, claimed: false });
      }
      profile.daily = { date: today, missions: picked };
      saveProfile(profile);
    }
    updateDailyNotifDot();
  }

  function updateDailyNotifDot() {
    const dot = document.getElementById('dailyNotifDot');
    if (!dot || !profile.daily || !Array.isArray(profile.daily.missions)) return;
    const hasClaimable = profile.daily.missions.some(m => {
      const def = DAILY_POOL.find(d => d.id === m.id);
      return def && m.progress >= def.goal && !m.claimed;
    });
    dot.classList.toggle('active', hasClaimable);
  }

  function addDailyProgress(id, amount = 1) {
    if (typeof battle !== 'undefined' && battle.isSpectate) return;
    ensureDailyMissions();
    let changed = false;
    for (const m of profile.daily.missions) {
      if (m.id === id && !m.claimed) {
        const def = DAILY_POOL.find(d => d.id === id);
        if (def && m.progress < def.goal) {
          m.progress = Math.min(def.goal, m.progress + amount);
          changed = true;
        }
      }
    }
    if (changed) {
      saveProfile(profile);
      updateDailyNotifDot();
    }
  }

  function getWeekKey() {
    const d = new Date();
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  function ensureWeeklyMissions() {
    const wk = getWeekKey();
    if (!profile.weekly || profile.weekly.weekKey !== wk || !Array.isArray(profile.weekly.missions) || profile.weekly.missions.length === 0) {
      profile.weekly = {
        weekKey: wk,
        missions: WEEKLY_POOL.map(m => ({ id: m.id, progress: 0, claimed: false }))
      };
      saveProfile(profile);
    }
  }

  function addWeeklyProgress(id, amount = 1) {
    if (typeof battle !== 'undefined' && battle.isSpectate) return;
    ensureWeeklyMissions();
    const m = profile.weekly.missions.find(x => x.id === id);
    if (!m || m.claimed) return;
    const def = WEEKLY_POOL.find(d => d.id === id);
    if (!def) return;
    const prev = m.progress;
    m.progress = Math.min(def.goal, m.progress + amount);
    if (m.progress !== prev) {
      saveProfile(profile);
      if (prev < def.goal && m.progress >= def.goal) {
        showToast(`📆 ウィークリー達成！「${def.name}」`);
      }
    }
  }

  function getXpForNextLevel(lv) {
    const L = Math.max(1, Math.min(100, lv || 1));
    return Math.floor(100 + (L - 1) * 35 + Math.pow(L - 1, 1.35) * 4);
  }

  function formatPrestigePrefix(p = profile) {
    const pr = (p && typeof p.prestige === 'number') ? p.prestige : 0;
    return pr > 0 ? `★${pr} ` : '';
  }

  function grantXP(amount) {
    if (typeof battle !== 'undefined' && battle.isSpectate) return;
    const gain = Math.max(0, Math.floor(amount || 0));
    if (gain <= 0) return;
    if (typeof profile.level !== 'number' || profile.level < 1) profile.level = 1;
    if (typeof profile.xp !== 'number' || profile.xp < 0) profile.xp = 0;
    if (profile.level >= 100) {
      profile.xp = getXpForNextLevel(100);
      return;
    }
    profile.xp += gain;
    let leveledUp = false;
    let bonusCoins = 0;
    while (profile.level < 100) {
      const need = getXpForNextLevel(profile.level);
      if (profile.xp >= need) {
        profile.xp -= need;
        profile.level++;
        leveledUp = true;
        if (profile.level % 5 === 0) {
          bonusCoins += (profile.level >= 50 ? 120 : 60);
        }
        if (profile.level >= 20) unlockAchievement('lv20');
        if (profile.level >= 50) unlockAchievement('lv50');
        if (profile.level >= 100) {
          profile.xp = getXpForNextLevel(100);
          unlockAchievement('lv100');
          break;
        }
      } else {
        break;
      }
    }
    if (bonusCoins > 0) profile.coins = (profile.coins || 0) + bonusCoins;
    saveProfile(profile);
    if (leveledUp) {
      sound.playSE('rankUp');
      showToast(`📈 LEVEL UP! Lv.${profile.level}${bonusCoins > 0 ? ` (+${bonusCoins}🪙)` : ''}`);
    }
    if (typeof renderProfileUI === 'function') renderProfileUI();
  }

  function doPrestige() {
    if ((profile.level || 1) < 100) return false;
    profile.prestige = (profile.prestige || 0) + 1;
    profile.level = 1;
    profile.xp = 0;
    profile.coins = (profile.coins || 0) + 300;
    saveProfile(profile);
    unlockAchievement('prestige1');
    sound.playSE('rankUp');
    showToast(`✨ 転生完了！Prestige ★${profile.prestige} に到達 (+300🪙)`);
    renderProfileUI();
    syncCloudNow(true, false);
    return true;
  }

  function addStatTotal(key, amount = 1) {
    if (typeof battle !== 'undefined' && battle.isSpectate) return 0;
    profile.statsTotal = profile.statsTotal || {};
    const prev = (typeof profile.statsTotal[key] === 'number' && Number.isFinite(profile.statsTotal[key])) ? profile.statsTotal[key] : 0;
    profile.statsTotal[key] = prev + amount;
    saveProfile(profile);
    return profile.statsTotal[key];
  }

  function unlockAchievement(id) {
    if (typeof battle !== 'undefined' && battle.isSpectate) return;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return;
    if (!Array.isArray(profile.achievements)) profile.achievements = [];
    if (profile.achievements.includes(id)) return;
    profile.achievements.push(id);
    profile.coins = (profile.coins || 0) + def.coins;
    saveProfile(profile);
    sound.playSE('rankUp');
    showToast(`🏅 実績解除「${def.name}」 +${def.coins}🪙`);
    if (typeof renderProfileUI === 'function') renderProfileUI();
  }

  let activeThemeObj = THEMES.neon;
  let admQueueMode = 'normal';

  function applyTheme(themeId) {
    const t = THEMES[themeId] || THEMES.neon;
    activeThemeObj = t;
    const root = document.documentElement;
    root.style.setProperty('--theme-bg', t.bgGrad);
    root.style.setProperty('--theme-panel', t.panelBg);
    root.style.setProperty('--cyan', t.cyan);
    root.style.setProperty('--pink', t.pink);
    root.style.setProperty('--border-glow', t.borderGlow);
    root.style.setProperty('--text-main', t.textMain || '#f1f5f9');
    root.style.setProperty('--text-dim', t.textDim || '#94a3b8');
    root.style.setProperty('--topbar-bg', t.topbarBg || 'rgba(7, 10, 20, 0.92)');
    root.style.setProperty('--card-sub-bg', t.cardSubBg || 'rgba(15, 23, 42, 0.65)');
    document.body.classList.toggle('theme-light', !!t.isLight);
    document.body.classList.toggle('theme-noglow', !!t.noGlow);
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultProfile));
      const parsed = JSON.parse(raw);
      return normalizeProfileData(parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(defaultProfile));
    }
  }

  function saveProfile(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
    scheduleCloudProfileSave();
  }

  let profile = loadProfile();

  function loadRemoteLeaderboard() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(x => x && typeof x.name === 'string' && x.deviceId !== DEVICE_ID) : [];
    } catch (e) { return []; }
  }

  function saveRemoteLeaderboard(list) {
    try { localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list)); } catch (e) {}
  }

  let remoteLeaderboard = loadRemoteLeaderboard();

  function buildPublicRecord() {
    return {
      deviceId: DEVICE_ID,
      name: profile.name || 'PLAYER',
      playerNo: (typeof profile.playerNo === 'number' && profile.playerNo >= 1) ? Math.floor(profile.playerNo) : null,
      title: profile.activeTitle || '',
      rating: profile.rating || 1500,
      wins: profile.wins || 0,
      losses: profile.losses || 0,
      skillRating: profile.skillRating || 1500,
      skillWins: profile.skillWins || 0,
      skillLosses: profile.skillLosses || 0,
      bestSprintMs: (profile.records && typeof profile.records.bestSprintMs === 'number') ? profile.records.bestSprintMs : null,
      bestUltraScore: (profile.records && typeof profile.records.bestUltraScore === 'number') ? profile.records.bestUltraScore : 0,
      bestCheese10Ms: (profile.records && typeof profile.records.bestCheese10Ms === 'number') ? profile.records.bestCheese10Ms : null,
      bestCheese20Ms: (profile.records && typeof profile.records.bestCheese20Ms === 'number') ? profile.records.bestCheese20Ms : null,
      bestBr99Rank: (profile.records && typeof profile.records.bestBr99Rank === 'number') ? profile.records.bestBr99Rank : null,
      br99Wins: (profile.records && typeof profile.records.br99Wins === 'number') ? profile.records.br99Wins : 0,
      maxChain: (profile.records && typeof profile.records.maxChain === 'number') ? profile.records.maxChain : 0,
      bestEndlessScore: (profile.records && typeof profile.records.bestEndlessScore === 'number') ? profile.records.bestEndlessScore : 0,
      updatedAt: Date.now()
    };
  }

  function upsertLeaderboardPlayer(rec) {
    if (!rec || typeof rec !== 'object' || typeof rec.name !== 'string') return;
    if (rec.deviceId && rec.deviceId === DEVICE_ID) return;
    const clean = {
      deviceId: typeof rec.deviceId === 'string' ? rec.deviceId : '',
      name: rec.name.slice(0, 16) || 'RIVAL',
      playerNo: (typeof rec.playerNo === 'number' && rec.playerNo >= 1) ? Math.floor(rec.playerNo) : null,
      title: typeof rec.title === 'string' ? rec.title : '',
      rating: (typeof rec.rating === 'number' && Number.isFinite(rec.rating)) ? Math.max(0, Math.round(rec.rating)) : 1500,
      wins: (typeof rec.wins === 'number' && rec.wins >= 0) ? Math.floor(rec.wins) : 0,
      losses: (typeof rec.losses === 'number' && rec.losses >= 0) ? Math.floor(rec.losses) : 0,
      skillRating: (typeof rec.skillRating === 'number' && Number.isFinite(rec.skillRating)) ? Math.max(0, Math.round(rec.skillRating)) : 1500,
      skillWins: (typeof rec.skillWins === 'number' && rec.skillWins >= 0) ? Math.floor(rec.skillWins) : 0,
      skillLosses: (typeof rec.skillLosses === 'number' && rec.skillLosses >= 0) ? Math.floor(rec.skillLosses) : 0,
      bestSprintMs: (typeof rec.bestSprintMs === 'number' && rec.bestSprintMs > 0) ? rec.bestSprintMs : null,
      bestUltraScore: (typeof rec.bestUltraScore === 'number' && rec.bestUltraScore > 0) ? Math.floor(rec.bestUltraScore) : 0,
      bestCheese10Ms: (typeof rec.bestCheese10Ms === 'number' && rec.bestCheese10Ms > 0) ? rec.bestCheese10Ms : null,
      bestCheese20Ms: (typeof rec.bestCheese20Ms === 'number' && rec.bestCheese20Ms > 0) ? rec.bestCheese20Ms : null,
      bestBr99Rank: (typeof rec.bestBr99Rank === 'number' && rec.bestBr99Rank >= 1 && rec.bestBr99Rank <= 99) ? Math.floor(rec.bestBr99Rank) : null,
      br99Wins: (typeof rec.br99Wins === 'number' && rec.br99Wins >= 0) ? Math.floor(rec.br99Wins) : 0,
      maxChain: (typeof rec.maxChain === 'number' && rec.maxChain > 0) ? Math.floor(rec.maxChain) : 0,
      bestEndlessScore: (typeof rec.bestEndlessScore === 'number' && rec.bestEndlessScore > 0) ? Math.floor(rec.bestEndlessScore) : 0,
      updatedAt: Date.now()
    };
    const idx = remoteLeaderboard.findIndex(p =>
      (clean.deviceId && p.deviceId && p.deviceId === clean.deviceId) ||
      (!clean.deviceId && p.name === clean.name)
    );
    if (idx >= 0) remoteLeaderboard[idx] = clean;
    else remoteLeaderboard.push(clean);
    saveRemoteLeaderboard(remoteLeaderboard);
  }

  function formatKeyCode(code) {
    if (!code) return '-';
    const map = {
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      Space: 'Space', Backspace: 'BS', Escape: 'Esc',
      ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
      ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl'
    };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }

  function formatSprintTime(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalSec = Math.floor(totalCs / 100);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  function getRankTier(rating) {
    if (rating >= 2000) return { name: 'MASTER', cls: 'rank-MASTER', idx: 5 };
    if (rating >= 1800) return { name: 'DIAMOND', cls: 'rank-DIAMOND', idx: 4 };
    if (rating >= 1650) return { name: 'PLATINUM', cls: 'rank-PLATINUM', idx: 3 };
    if (rating >= 1500) return { name: 'GOLD', cls: 'rank-GOLD', idx: 2 };
    if (rating >= 1400) return { name: 'SILVER', cls: 'rank-SILVER', idx: 1 };
    return { name: 'BRONZE', cls: 'rank-BRONZE', idx: 0 };
  }

  function calcEloPreview(rSelf, rOpp) {
    const E = 1 / (1 + Math.pow(10, (rOpp - rSelf) / 400));
    const winDelta = Math.max(1, Math.round(32 * (1 - E)));
    const loseDelta = -Math.max(1, Math.round(32 * E));
    const win20 = Math.max(1, Math.round(winDelta * 1.25));
    const win21 = Math.max(1, Math.round(winDelta * 0.85));
    const lose02 = -Math.max(1, Math.round(Math.abs(loseDelta) * 1.25));
    const lose12 = -Math.max(1, Math.round(Math.abs(loseDelta) * 0.85));
    return { expected: E, winDelta, loseDelta, win20, win21, lose02, lose12, diff: rOpp - rSelf };
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('ルームIDをコピーしました: ' + text)).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('ルームIDをコピーしました: ' + text); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* =========================================================================
     2. WEB AUDIO API SOUND & CHIPTUNE BGM ENGINE (INDIVIDUAL VOLUMES)
     ========================================================================= */
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.bgmTimer = null;
      this.bgmTrack = 'tetris';
      this.bgmStepTetris = 0;
      this.bgmStepPuyo = 0;
      this.bgmPlaying = false;
      this.fastMode = false;
    }
    resetBgmSteps() {
      this.bgmStepTetris = 0;
      this.bgmStepPuyo = 0;
    }
    setBgmTrack(track, forceRaw = false) {
      const mode = (!forceRaw && profile && profile.settings && profile.settings.bgmMode) || 'auto';
      if (mode === 'tetris') this.bgmTrack = 'tetris';
      else if (mode === 'puyo') this.bgmTrack = 'puyo';
      else this.bgmTrack = track === 'puyo' ? 'puyo' : 'tetris';
    }
    startPreviewBGM(track) {
      this.unlock();
      this.stopBGM();
      this.isPreviewBgm = true;
      this.fastMode = false;
      this.setBgmTrack(track, true);
      this.startBGM(true);
    }
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
    tone(freq, dur, type = 'square', vol = 0.08, slideTo = null, delay = 0) {
      const seMult = (profile.settings.seVol ?? 80) / 100;
      if (!profile.settings.se || seMult <= 0.001) return;
      this.unlock();
      if (!this.ctx) return;
      const effVol = Math.max(0.001, vol * seMult);
      const now = this.ctx.currentTime + delay;
      const pack = (profile && profile.activeSePack) || 'chiptune';
      let useType = type;
      let useFreq = freq;
      let useSlide = slideTo;
      let useDur = dur;
      if (pack === 'arcade') {
        useType = (type === 'sine' || type === 'triangle') ? 'sawtooth' : 'square';
        useFreq = freq * 0.94;
        if (useSlide) useSlide = slideTo * 0.94;
        useDur = dur * 0.9;
      } else if (pack === 'crystal') {
        useType = (type === 'square' || type === 'sawtooth') ? 'triangle' : 'sine';
        useFreq = freq * 1.18;
        if (useSlide) useSlide = slideTo * 1.18;
        useDur = dur * 1.25;
      } else if (pack === 'retro8') {
        useType = 'square';
        useDur = Math.max(0.02, dur * 0.82);
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = useType;
      osc.frequency.setValueAtTime(Math.max(20, useFreq), now);
      if (useSlide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, useSlide), now + useDur);
      gain.gain.setValueAtTime(effVol, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + useDur);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now); osc.stop(now + useDur + 0.015);
      if (pack === 'crystal' || pack === 'arcade') {
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = pack === 'crystal' ? 'sine' : 'triangle';
        const mult2 = pack === 'crystal' ? 2.0 : 1.5;
        osc2.frequency.setValueAtTime(Math.max(20, useFreq * mult2), now);
        if (useSlide) osc2.frequency.exponentialRampToValueAtTime(Math.max(20, useSlide * mult2), now + useDur);
        gain2.gain.setValueAtTime(effVol * (pack === 'crystal' ? 0.38 : 0.28), now);
        gain2.gain.exponentialRampToValueAtTime(0.0005, now + useDur);
        osc2.connect(gain2); gain2.connect(this.ctx.destination);
        osc2.start(now); osc2.stop(now + useDur + 0.015);
      }
    }
    playSE(name, param = 1) {
      if (!profile.settings.se) return;
      switch (name) {
        case 'move': this.tone(360, 0.035, 'triangle', 0.06); break;
        case 'rotate': this.tone(540, 0.05, 'square', 0.06, 720); break;
        case 'softdrop': this.tone(240, 0.025, 'sine', 0.04); break;
        case 'harddrop': this.tone(220, 0.11, 'sawtooth', 0.1, 75); break;
        case 'hold': this.tone(440, 0.07, 'triangle', 0.07, 660); break;
        case 'undo': this.tone(620, 0.09, 'triangle', 0.08, 390); break;
        case 'lock': this.tone(170, 0.06, 'triangle', 0.07, 110); break;
        case 'clear':
          this.tone(523, 0.09, 'square', 0.08, null, 0);
          this.tone(659, 0.12, 'square', 0.08, null, 0.06);
          break;
        case 'tetris':
          [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.13, 'square', 0.09, null, i * 0.055));
          break;
        case 'perfect':
          [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.1, null, i * 0.05));
          break;
        case 'puyoLand': this.tone(210, 0.06, 'sine', 0.07, 140); break;
        case 'puyoChigiri': this.tone(300, 0.05, 'sine', 0.05, 220); break;
        case 'puyoPop': {
          const scale = [523, 587, 659, 698, 784, 880, 988, 1046, 1175, 1318, 1397, 1568, 1760];
          const base = scale[Math.min(scale.length - 1, Math.max(0, param - 1))];
          this.tone(base, 0.14, 'sine', 0.12, base * 1.15, 0);
          this.tone(base * 1.5, 0.12, 'triangle', 0.08, base * 1.6, 0.04);
          break;
        }
        case 'attack': this.tone(320, 0.18, 'sawtooth', 0.09, 920); break;
        case 'counter':
          this.tone(880, 0.08, 'square', 0.09, 1175, 0);
          this.tone(1175, 0.12, 'triangle', 0.09, 1568, 0.05);
          break;
        case 'warning': this.tone(740, 0.09, 'sawtooth', 0.08, 620); break;
        case 'dangerBeep': this.tone(920, 0.06, 'square', 0.05, 760); break;
        case 'garbageRise': this.tone(130, 0.18, 'sawtooth', 0.1, 70); break;
        case 'garbageFall': this.tone(190, 0.14, 'triangle', 0.1, 85); break;
        case 'swapWarn': this.tone(880, 0.07, 'square', 0.07); break;
        case 'swapSwitch':
          this.tone(440, 0.1, 'sawtooth', 0.09, 880, 0);
          this.tone(660, 0.14, 'square', 0.09, 1320, 0.06);
          break;
        case 'swapCombo':
          [659, 880, 1175, 1568].forEach((f, i) => this.tone(f, 0.14, 'square', 0.1, null, i * 0.05));
          break;
        case 'stamp':
          this.tone(784, 0.06, 'sine', 0.08, 1046, 0);
          this.tone(1046, 0.09, 'triangle', 0.07, 1318, 0.05);
          break;
        case 'matchFound':
          [523, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'square', 0.09, null, i * 0.08));
          break;
        case 'countdown': this.tone(587, 0.11, 'square', 0.09); break;
        case 'go': this.tone(1175, 0.28, 'square', 0.11); break;
        case 'win':
          [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.09, null, i * 0.1));
          break;
        case 'lose':
          [392, 349, 311, 261].forEach((f, i) => this.tone(f, 0.2, 'sawtooth', 0.08, null, i * 0.13));
          break;
        case 'rankUp':
          [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.11, null, i * 0.07));
          break;
        case 'upset':
          [440, 554, 659, 880, 1108].forEach((f, i) => this.tone(f, 0.15, 'square', 0.1, null, i * 0.06));
          break;
        case 'coinGet':
          this.tone(988, 0.08, 'square', 0.08, null, 0);
          this.tone(1318, 0.16, 'square', 0.09, null, 0.07);
          break;
        case 'shopBuy':
          [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, null, i * 0.05));
          break;
      }
    }

    startBGM(ignoreMute = false) {
      if (this.bgmPlaying) return;
      this.bgmPlaying = true;
      this.bgmIgnoreMute = !!ignoreMute;
      const tetrisMelody = [
        659, 0, 494, 523, 587, 0, 523, 494, 440, 0, 440, 523, 659, 0, 587, 523,
        494, 0, 494, 523, 587, 0, 659, 0, 523, 0, 440, 0, 440, 0, 0, 0,
        0, 587, 0, 698, 880, 0, 784, 698, 659, 0, 523, 659, 587, 0, 523, 494,
        494, 0, 523, 587, 659, 0, 523, 0, 440, 0, 440, 0, 0, 0, 0, 0
      ];
      const tetrisBass = [
        165, 330, 165, 330, 147, 294, 147, 294, 110, 220, 110, 220, 110, 220, 131, 262,
        123, 247, 123, 247, 165, 330, 165, 330, 110, 220, 110, 220, 110, 0, 110, 0,
        147, 294, 147, 294, 175, 349, 175, 349, 131, 262, 131, 262, 165, 330, 123, 247,
        123, 247, 165, 330, 110, 220, 131, 262, 110, 220, 110, 0, 110, 0, 0, 0
      ];
      const puyoMelody = [
        523, 659, 784, 1046, 0, 988, 784, 659, 698, 880, 1046, 880, 784, 0, 659, 0,
        587, 659, 698, 784, 880, 0, 784, 698, 659, 784, 1046, 0, 988, 0, 784, 0,
        1046, 0, 880, 1046, 1175, 0, 1046, 880, 784, 880, 1046, 784, 659, 0, 523, 0,
        698, 880, 784, 659, 587, 659, 784, 988, 1046, 0, 1318, 0, 1046, 0, 0, 0
      ];
      const puyoBass = [
        131, 262, 196, 262, 131, 262, 196, 262, 175, 349, 220, 349, 131, 262, 196, 262,
        147, 294, 196, 294, 196, 392, 247, 392, 131, 262, 196, 262, 196, 392, 247, 0,
        175, 349, 220, 349, 196, 392, 247, 392, 165, 330, 220, 330, 131, 262, 196, 262,
        147, 294, 175, 349, 196, 392, 247, 392, 131, 262, 196, 262, 131, 0, 196, 0
      ];
      const tick = () => {
        if (!this.bgmPlaying) return;
        const isPuyo = this.bgmTrack === 'puyo';
        const stepMs = isPuyo ? (this.fastMode ? 102 : 136) : (this.fastMode ? 112 : 155);
        const bgmMult = (profile.settings.bgmVol ?? 70) / 100;
        if ((this.bgmIgnoreMute || profile.settings.bgm) && bgmMult > 0.001 && this.ctx && this.ctx.state === 'running') {
          let m = 0, b = 0;
          if (isPuyo) {
            const i = this.bgmStepPuyo % puyoMelody.length;
            m = puyoMelody[i]; b = puyoBass[i];
            this.bgmStepPuyo++;
          } else {
            const i = this.bgmStepTetris % tetrisMelody.length;
            m = tetrisMelody[i]; b = tetrisBass[i];
            this.bgmStepTetris++;
          }
          const now = this.ctx.currentTime;
          if (m > 0) {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = isPuyo ? 'triangle' : 'square';
            osc.frequency.setValueAtTime(this.fastMode ? m * 1.059 : m, now);
            g.gain.setValueAtTime(Math.max(0.0008, (isPuyo ? 0.065 : 0.042) * bgmMult), now);
            g.gain.exponentialRampToValueAtTime(0.0005, now + stepMs / 1000 * 0.88);
            osc.connect(g); g.connect(this.ctx.destination);
            osc.start(now); osc.stop(now + stepMs / 1000);
          }
          if (b > 0) {
            const osc2 = this.ctx.createOscillator();
            const g2 = this.ctx.createGain();
            osc2.type = isPuyo ? 'square' : 'triangle';
            osc2.frequency.setValueAtTime(this.fastMode ? b * 1.059 : b, now);
            g2.gain.setValueAtTime(Math.max(0.0008, (isPuyo ? 0.028 : 0.056) * bgmMult), now);
            g2.gain.exponentialRampToValueAtTime(0.0005, now + stepMs / 1000 * 0.82);
            osc2.connect(g2); g2.connect(this.ctx.destination);
            osc2.start(now); osc2.stop(now + stepMs / 1000);
          }
        }
        this.bgmTimer = setTimeout(tick, stepMs);
      };
      tick();
    }

    setFastMode(v) {
      this.fastMode = !!v;
    }
    stopBGM() {
      this.bgmPlaying = false;
      this.isPreviewBgm = false;
      this.bgmIgnoreMute = false;
      clearTimeout(this.bgmTimer);
    }
  }
  const sound = new SoundEngine();

  /* =========================================================================
     3. PROJECTILE / PARTICLE FX & QUICK STAMPS (1.5s COOLDOWN + CPU REPLY)
     ========================================================================= */
  const fxCanvas = document.getElementById('fxCanvas');
  const fxCtx = fxCanvas.getContext('2d');
  const projectiles = [];
  const fxParticles = [];

  function resizeFx() {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeFx);
  resizeFx();

  function spawnAttackOrb(fromSelf, power, color = '#00f0ff') {
    const srcEl = document.getElementById(fromSelf ? 'selfCanvas' : 'oppCanvas');
    const dstEl = document.getElementById(fromSelf ? 'oppCanvas' : 'selfCanvas');
    if (!srcEl || !dstEl) return;
    const sr = srcEl.getBoundingClientRect();
    const dr = dstEl.getBoundingClientRect();
    if (sr.width === 0 || dr.width === 0) return;
    const count = Math.min(6, Math.max(1, Math.ceil(power / 2)));
    for (let i = 0; i < count; i++) {
      projectiles.push({
        sx: sr.left + sr.width * 0.5,
        sy: sr.top + sr.height * (0.4 + Math.random() * 0.2),
        ex: dr.left + dr.width * 0.25,
        ey: dr.top + dr.height * (0.2 + Math.random() * 0.2),
        cx: (sr.left + dr.left) * 0.5 + sr.width * 0.5,
        cy: Math.min(sr.top, dr.top) - 60 - Math.random() * 90,
        t: -i * 0.08,
        speed: 2.3,
        color,
        size: 7 + Math.min(8, power)
      });
    }
  }

  function updateAndDrawFX(dt) {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    if (typeof br99 !== 'undefined' && br99.isOpen) br99.drawTargetLasersOnFX(fxCtx);
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.t += dt * p.speed;
      if (p.t < 0) continue;
      if (p.t >= 1) {
        for (let k = 0; k < 12; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 60 + Math.random() * 140;
          fxParticles.push({
            x: p.ex, y: p.ey, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            life: 0.45, maxLife: 0.45, color: p.color, r: 3 + Math.random() * 3
          });
        }
        projectiles.splice(i, 1);
        continue;
      }
      const u = 1 - p.t;
      const x = u * u * p.sx + 2 * u * p.t * p.cx + p.t * p.t * p.ex;
      const y = u * u * p.sy + 2 * u * p.t * p.cy + p.t * p.t * p.ey;
      fxCtx.save();
      fxCtx.shadowBlur = 18; fxCtx.shadowColor = p.color;
      fxCtx.fillStyle = '#fff';
      fxCtx.beginPath(); fxCtx.arc(x, y, p.size * 0.6, 0, Math.PI * 2); fxCtx.fill();
      fxCtx.fillStyle = p.color;
      fxCtx.globalAlpha = 0.7;
      fxCtx.beginPath(); fxCtx.arc(x, y, p.size, 0, Math.PI * 2); fxCtx.fill();
      fxCtx.restore();
    }
    for (let i = fxParticles.length - 1; i >= 0; i--) {
      const pt = fxParticles[i];
      pt.life -= dt;
      if (pt.life <= 0) { fxParticles.splice(i, 1); continue; }
      if (pt.gravity) pt.vy += pt.gravity * dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.rotSpeed) pt.rot = (pt.rot || 0) + pt.rotSpeed * dt;
      fxCtx.save();
      fxCtx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      fxCtx.fillStyle = pt.color;
      fxCtx.strokeStyle = pt.color;
      if (pt.kind === 'petal') {
        fxCtx.translate(pt.x, pt.y);
        fxCtx.rotate(pt.rot || 0);
        fxCtx.beginPath();
        fxCtx.ellipse(0, 0, pt.r * 1.6, pt.r * 0.85, 0, 0, Math.PI * 2);
        fxCtx.fill();
      } else if (pt.kind === 'pixel') {
        fxCtx.fillRect(pt.x - pt.r, pt.y - pt.r, pt.r * 2, pt.r * 2);
      } else if (pt.kind === 'star') {
        fxCtx.translate(pt.x, pt.y);
        fxCtx.rotate(pt.rot || 0);
        fxCtx.shadowBlur = 10; fxCtx.shadowColor = pt.color;
        fxCtx.beginPath();
        for (let k = 0; k < 4; k++) {
          const ang = k * Math.PI / 2;
          fxCtx.lineTo(Math.cos(ang) * pt.r * 2.1, Math.sin(ang) * pt.r * 2.1);
          fxCtx.lineTo(Math.cos(ang + Math.PI / 4) * pt.r * 0.65, Math.sin(ang + Math.PI / 4) * pt.r * 0.65);
        }
        fxCtx.closePath();
        fxCtx.fill();
      } else if (pt.kind === 'bolt') {
        fxCtx.shadowBlur = 14; fxCtx.shadowColor = '#38bdf8';
        fxCtx.lineWidth = 2.4;
        fxCtx.beginPath();
        fxCtx.moveTo(pt.x, pt.y);
        fxCtx.lineTo(pt.x + pt.dx1, pt.y + pt.dy1);
        fxCtx.lineTo(pt.x + pt.dx2, pt.y + pt.dy2);
        fxCtx.stroke();
      } else {
        if (pt.glow) { fxCtx.shadowBlur = 12; fxCtx.shadowColor = pt.color; }
        fxCtx.beginPath(); fxCtx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); fxCtx.fill();
      }
      fxCtx.restore();
    }
  }

  function spawnClearEffect(isSelf, power = 1, baseColor = '#00f0ff', customRect = null) {
    const fxId = (profile && profile.activeEffect) || 'default';
    let cx = window.innerWidth * 0.5, cy = window.innerHeight * 0.45, w = 220, h = 300;
    if (customRect) {
      cx = customRect.left + customRect.width * 0.5;
      cy = customRect.top + customRect.height * 0.5;
      w = customRect.width; h = customRect.height;
    } else {
      const el = document.getElementById(isSelf ? 'selfCanvas' : 'oppCanvas');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) { cx = r.left + r.width * 0.5; cy = r.top + r.height * 0.5; w = r.width; h = r.height; }
      }
    }
    const count = Math.min(48, (fxId === 'default' ? 10 : 18) * power);
    if (fxId === 'fireworks') {
      const cols = ['#f43f5e', '#facc15', '#38bdf8', '#a855f7', '#4ade80'];
      const bx = cx + (Math.random() - 0.5) * w * 0.5;
      const by = cy + (Math.random() - 0.5) * h * 0.4;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const spd = 90 + Math.random() * 190;
        fxParticles.push({ x: bx, y: by, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, gravity: 240, life: 0.72, maxLife: 0.72, color: cols[i % cols.length], r: 3 + Math.random() * 2.5, glow: true });
      }
    } else if (fxId === 'sakura') {
      const cols = ['#fbcfe8', '#f9a8d4', '#f472b6', '#fff1f2'];
      for (let i = 0; i < count; i++) {
        fxParticles.push({
          kind: 'petal',
          x: cx + (Math.random() - 0.5) * w, y: cy - h * 0.3 + (Math.random() - 0.5) * h * 0.5,
          vx: -50 + Math.random() * 120, vy: 45 + Math.random() * 90,
          gravity: 30, rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 6,
          life: 1.05, maxLife: 1.05, color: cols[i % cols.length], r: 4 + Math.random() * 2.5
        });
      }
    } else if (fxId === 'lightning') {
      const bolts = Math.min(8, 3 + power * 2);
      for (let i = 0; i < bolts; i++) {
        const sx = cx + (Math.random() - 0.5) * w * 0.8;
        const sy = cy + (Math.random() - 0.5) * h * 0.6;
        const dx1 = (Math.random() - 0.5) * 70, dy1 = (Math.random() - 0.5) * 70;
        const dx2 = dx1 + (Math.random() - 0.5) * 80, dy2 = dy1 + (Math.random() - 0.5) * 80;
        fxParticles.push({ kind: 'bolt', x: sx, y: sy, vx: 0, vy: 0, dx1, dy1, dx2, dy2, life: 0.28, maxLife: 0.28, color: i % 2 === 0 ? '#e0f2fe' : '#38bdf8', r: 3 });
      }
      for (let i = 0; i < Math.floor(count * 0.7); i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 120 + Math.random() * 220;
        fxParticles.push({ x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.42, maxLife: 0.42, color: i % 3 === 0 ? '#facc15' : '#38bdf8', r: 2.5 + Math.random() * 2, glow: true });
      }
    } else if (fxId === 'pixel') {
      const cols = ['#22c55e', '#facc15', '#ef4444', '#3b82f6', '#ffffff'];
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 170;
        fxParticles.push({ kind: 'pixel', x: cx + (Math.random() - 0.5) * w * 0.6, y: cy + (Math.random() - 0.5) * h * 0.4, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 60, gravity: 320, life: 0.65, maxLife: 0.65, color: cols[i % cols.length], r: 4 + Math.random() * 3 });
      }
    } else if (fxId === 'stardust') {
      const cols = ['#fef08a', '#c084fc', '#38bdf8', '#ffffff'];
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 50 + Math.random() * 140;
        fxParticles.push({ kind: 'star', x: cx + (Math.random() - 0.5) * w * 0.7, y: cy + (Math.random() - 0.5) * h * 0.5, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 25, rot: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 5, life: 0.85, maxLife: 0.85, color: cols[i % cols.length], r: 3.5 + Math.random() * 2.5 });
      }
    } else {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 50 + Math.random() * 120;
        fxParticles.push({ x: cx + (Math.random() - 0.5) * w * 0.5, y: cy + (Math.random() - 0.5) * h * 0.4, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.45, maxLife: 0.45, color: baseColor, r: 2.5 + Math.random() * 2.5 });
      }
    }
  }

  const QUICK_STAMPS = ['👋 よろしく！', '👍 ナイス！', '🔥 すごい！', '😱 やばい！', '🔄 もう一戦！', '👏 GG！'];
  const CPU_REPLY_STAMPS = ['🔥 いくぞ！', '👍 ナイス！', '😎 まだまだ！', '😱 すごい！', '👏 GG！', '🤖 計算通り！'];
  const stampTimers = {};
  let lastStampSentAt = 0;
  let stampCooldownTimer = null;

  function showStampBubble(elId, text) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(stampTimers[elId]);
    stampTimers[elId] = setTimeout(() => el.classList.remove('show'), 2300);
  }

  function sendQuickStamp(text, context) {
    const now = performance.now();
    if (now - lastStampSentAt < 1500) return;
    lastStampSentAt = now;

    document.querySelectorAll('.stamp-bar').forEach(b => b.classList.add('cooldown'));
    clearTimeout(stampCooldownTimer);
    stampCooldownTimer = setTimeout(() => {
      document.querySelectorAll('.stamp-bar').forEach(b => b.classList.remove('cooldown'));
    }, 1500);

    sound.unlock();
    sound.playSE('stamp');
    if (context === 'room') showStampBubble('stampRoomSelf', text);
    else if (context === 'battle') showStampBubble('stampBattleSelf', text);
    else if (context === 'result') showToast('送信: ' + text);

    if (net.conn && net.conn.open) {
      net.send({ type: 'stamp', text, context });
    } else if (battle.isCpu && !battle.isSpectate) {
      const reply = CPU_REPLY_STAMPS[Math.floor(Math.random() * CPU_REPLY_STAMPS.length)];
      setTimeout(() => {
        if (!battle.isCpu || battle.isSpectate) return;
        receiveQuickStamp({ text: reply });
      }, 650 + Math.random() * 450);
    }
  }

  function receiveQuickStamp(msg) {
    sound.playSE('stamp');
    if (document.getElementById('overlayResult').classList.contains('active')) {
      showStampBubble('stampResultOpp', msg.text);
    } else if (document.getElementById('screenBattle').classList.contains('active')) {
      showStampBubble('stampBattleOpp', msg.text);
    } else if (document.getElementById('roomWaitBox').classList.contains('active')) {
      showStampBubble('stampRoomOpp', msg.text);
    }
  }

  function initStampBars() {
    document.querySelectorAll('[data-stamp-bar]').forEach(bar => {
      const ctx = bar.dataset.stampBar;
      bar.innerHTML = '';
      QUICK_STAMPS.forEach(txt => {
        const b = document.createElement('button');
        b.className = 'stamp-btn';
        b.textContent = txt;
        b.addEventListener('click', () => sendQuickStamp(txt, ctx));
        bar.appendChild(b);
      });
    });
  }


  /* =========================================================================
     8. ONLINE P2P NETWORK MANAGER (FT2 SYNC + REALTIME PING RTT)
     ========================================================================= */
  const net = {
    peer: null,
    conn: null,
    isHost: false,
    mode: null,
    rule: 'vs',
    targetWins: 2,
    puyoColors: 4,
    hostAtk: 100,
    guestAtk: 100,
    rated: true,
    searching: false,
    roomCode: '',
    myStyle: 'tetris',
    myReady: false,
    oppInfo: null,
    oppReady: false,
    pingInterval: null,
    lastPingMs: null,

    startPingLoop() {
      this.stopPingLoop();
      this.pingInterval = setInterval(() => {
        if (this.conn && this.conn.open) {
          this.send({ type: 'ping', t: performance.now() });
        }
      }, 2000);
      if (this.conn && this.conn.open) this.send({ type: 'ping', t: performance.now() });
    },

    stopPingLoop() {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      this.lastPingMs = null;
      ['pingBadgeRoom', 'pingBadgeBattle'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active', 'ping-good', 'ping-warn', 'ping-bad'); }
      });
    },

    updatePingUI(rtt) {
      this.lastPingMs = rtt;
      const cls = rtt <= 60 ? 'ping-good' : (rtt <= 120 ? 'ping-warn' : 'ping-bad');
      ['pingBadgeRoom', 'pingBadgeBattle'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = `📡 Ping: ${rtt}ms`;
        el.classList.remove('ping-good', 'ping-warn', 'ping-bad');
        el.classList.add('active', cls);
      });
    },

    cleanup() {
      this.searching = false;
      this.myReady = false;
      this.oppReady = false;
      this.oppInfo = null;
      this.stopPingLoop();
      if (this.conn) { try { this.conn.close(); } catch (e) {} this.conn = null; }
      if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
      document.getElementById('rankedSearchBox').classList.remove('active');
      document.getElementById('btnFindRanked').disabled = false;
      document.getElementById('roomWaitBox').classList.remove('active');
    },

    send(obj) {
      if (this.conn && this.conn.open) {
        try { this.conn.send(obj); } catch (e) {}
      }
    },

    async startRankedSearch(rule, style, targetWins, isFree = false) {
      if (typeof Peer === 'undefined') {
        showToast('PeerJSが読み込めない環境のためオンライン対戦は利用できません。ソロ/CPU対戦をお試しください。');
        return;
      }
      this.cleanup();
      this.mode = isFree ? 'free' : 'ranked';
      this.rule = rule;
      this.targetWins = targetWins;
      this.rated = !isFree;
      this.myStyle = rule === 'swap' ? 'tetris' : style;
      this.searching = true;
      document.getElementById('btnFindRanked').disabled = true;
      document.getElementById('rankedSearchBox').classList.add('active');
      const statusEl = document.getElementById('rankedSearchStatus');
      const subEl = document.getElementById('rankedSearchSub');

      const prefix = isFree
        ? `puyotet-free-${rule}-ft${targetWins}-`
        : (rule === 'skill' ? `puyotet-skill-ranked-ft${targetWins}-` : `puyotet-ranked-${rule}-ft${targetWins}-`);
      let hosted = false;
      for (let slot = 0; slot < 10; slot++) {
        if (!this.searching) return;
        const slotId = prefix + slot;
        statusEl.textContent = `公開スロット ${slot + 1}/10 を確認中...`;
        subEl.textContent = `ルール: ${rule.toUpperCase()} / FT${targetWins}`;

        const found = await this.tryJoinSlot(slotId);
        if (found) return;
        if (!this.searching) return;

        const claimed = await this.tryHostSlot(slotId);
        if (claimed) {
          hosted = true;
          statusEl.textContent = `対戦相手を待機中 (スロット #${slot + 1})`;
          subEl.textContent = `他のプレイヤーが検索すると自動でマッチングします`;
          return;
        }
      }
      if (!hosted && this.searching) {
        showToast('全スロットが混雑しています。少し待ってから再試行してください。');
        this.cleanup();
      }
    },

    tryJoinSlot(slotId) {
      return new Promise(resolve => {
        let settled = false;
        const finish = (ok) => { if (settled) return; settled = true; clearTimeout(timer); resolve(ok); };
        const p = new Peer();
        const timer = setTimeout(() => { try { p.destroy(); } catch (e) {} finish(false); }, 1600);

        p.on('open', () => {
          if (!this.searching) { try { p.destroy(); } catch (e) {} return finish(false); }
          const c = p.connect(slotId, { reliable: true });
          c.on('open', () => {
            const myRate = this.rule === 'skill' ? (profile.skillRating || 1500) : profile.rating;
            c.send({
              type: 'hello', name: profile.name, playerNo: profile.playerNo || null, rating: myRate, title: profile.activeTitle,
              deviceId: DEVICE_ID, lbRecord: buildPublicRecord(),
              equippedSkills: profile.equippedSkills || [], ownedSkills: profile.ownedSkills || {},
              style: this.myStyle, rule: this.rule, targetWins: this.targetWins, puyoColors: 4, rated: this.rated
            });
          });
          c.on('data', (msg) => {
            if (this.rated && msg && (msg.type === 'sameDeviceReject' || (msg.type === 'welcome' && msg.deviceId && msg.deviceId === DEVICE_ID))) {
              try { c.close(); p.destroy(); } catch (e) {}
              this.cleanup();
              showToast('同一デバイス同士ではランクマッチできません（フリーマッチまたはルーム対戦をご利用ください）');
              finish(true);
              return;
            }
            if (msg && msg.type === 'welcome') {
              this.peer = p; this.conn = c; this.isHost = false; this.searching = false;
              this.targetWins = msg.targetWins || this.targetWins;
              this.puyoColors = 4;
              this.attachConnHandlers(c);
              this.startPingLoop();
              if (msg.lbRecord) upsertLeaderboardPlayer(msg.lbRecord);
              this.oppInfo = {
                name: msg.name, playerNo: msg.playerNo || null, rating: msg.rating, style: msg.style, title: msg.title || '',
                equippedSkills: msg.equippedSkills || [], ownedSkills: msg.ownedSkills || {}
              };
              finish(true);
              startOnlineMatch(this.rule, this.rated, this.myStyle, this.oppInfo, this.targetWins, 4);
            }
          });
          c.on('error', () => { try { p.destroy(); } catch (e) {} finish(false); });
        });
        p.on('error', () => { try { p.destroy(); } catch (e) {} finish(false); });
      });
    },

    tryHostSlot(slotId) {
      return new Promise(resolve => {
        let settled = false;
        const finish = (ok) => { if (settled) return; settled = true; clearTimeout(timer); resolve(ok); };
        const p = new Peer(slotId);
        const timer = setTimeout(() => { try { p.destroy(); } catch (e) {} finish(false); }, 2200);

        p.on('open', () => {
          this.peer = p; this.isHost = true;
          p.on('connection', (c) => {
            if (this.conn) { c.close(); return; }
            this.conn = c;
            c.on('data', (msg) => {
              if (msg && msg.type === 'hello' && this.searching) {
                if (this.rated && msg.deviceId && msg.deviceId === DEVICE_ID) {
                  try { c.send({ type: 'sameDeviceReject' }); } catch (e) {}
                  setTimeout(() => { try { c.close(); } catch (e) {} }, 120);
                  this.cleanup();
                  showToast('同一デバイス同士ではランクマッチできません（フリーマッチまたはルーム対戦をご利用ください）');
                  return;
                }
                this.searching = false;
                this.puyoColors = 4;
                if (msg.lbRecord) upsertLeaderboardPlayer(msg.lbRecord);
                this.oppInfo = {
                  name: msg.name, playerNo: msg.playerNo || null, rating: msg.rating, style: msg.style, title: msg.title || '',
                  equippedSkills: msg.equippedSkills || [], ownedSkills: msg.ownedSkills || {}
                };
                const myRate = this.rule === 'skill' ? (profile.skillRating || 1500) : profile.rating;
                c.send({
                  type: 'welcome', name: profile.name, playerNo: profile.playerNo || null, rating: myRate, title: profile.activeTitle,
                  deviceId: DEVICE_ID, lbRecord: buildPublicRecord(),
                  equippedSkills: profile.equippedSkills || [], ownedSkills: profile.ownedSkills || {},
                  style: this.myStyle, rule: this.rule, targetWins: this.targetWins, puyoColors: 4, rated: this.rated
                });
                this.attachConnHandlers(c);
                this.startPingLoop();
                startOnlineMatch(this.rule, this.rated, this.myStyle, this.oppInfo, this.targetWins, 4);
              }
            });
          });
          finish(true);
        });
        p.on('error', () => { try { p.destroy(); } catch (e) {} finish(false); });
      });
    },

    createRoom(rule, targetWins, puyoColors = 4, hostAtk = 100, guestAtk = 100) {
      if (typeof Peer === 'undefined') {
        showToast('PeerJSが読み込めない環境のためオンライン対戦は利用できません。');
        return;
      }
      this.cleanup();
      this.mode = 'room'; this.rule = rule; this.rated = false; this.targetWins = targetWins;
      this.puyoColors = puyoColors; this.hostAtk = hostAtk; this.guestAtk = guestAtk; this.isHost = true;
      this.myStyle = profile.favStyle;
      const code = 'PT-' + Math.floor(1000 + Math.random() * 9000);
      this.roomCode = code;
      const p = new Peer('puyotet-room-' + code);
      this.peer = p;
      showToast('ルームを作成中...');

      p.on('open', () => {
        document.getElementById('roomWaitBox').classList.add('active');
        document.getElementById('roomCodeDisplay').textContent = code;
        document.getElementById('roomLobbyTitle').textContent =
          `ルーム待機中 (${rule.toUpperCase()} / FT${targetWins} / ${puyoColors}色 / 完全フリー)`;
        document.getElementById('roomStylePickRow').style.display = rule !== 'swap' ? 'block' : 'none';
        updateRoomLobbyUI();
      });

      p.on('connection', (c) => {
        if (this.conn) { c.close(); return; }
        this.conn = c;
        this.attachConnHandlers(c);
        c.on('open', () => {
          this.startPingLoop();
          c.send({
            type: 'roomSync', rule: this.rule, rated: this.rated, targetWins: this.targetWins, puyoColors: this.puyoColors,
            hostAtk: this.hostAtk, guestAtk: this.guestAtk, lbRecord: buildPublicRecord(),
            equippedSkills: profile.equippedSkills || [], ownedSkills: profile.ownedSkills || {},
            name: profile.name, playerNo: profile.playerNo || null, rating: this.rule === 'skill' ? (profile.skillRating || 1500) : profile.rating, title: profile.activeTitle, style: this.myStyle, ready: this.myReady
          });
        });
      });
      p.on('error', (err) => showToast('接続エラー: ' + (err.type || '通信に失敗しました')));
    },

    joinRoom(rawCode) {
      if (typeof Peer === 'undefined') {
        showToast('PeerJSが読み込めない環境のためオンライン対戦は利用できません。');
        return;
      }
      const code = rawCode.trim().toUpperCase();
      if (!code) { showToast('ルームIDを入力してください'); return; }
      this.cleanup();
      this.mode = 'room'; this.isHost = false; this.roomCode = code; this.myStyle = profile.favStyle;
      const p = new Peer();
      this.peer = p;
      showToast('ルームに接続中...');

      p.on('open', () => {
        const c = p.connect('puyotet-room-' + code, { reliable: true });
        this.conn = c;
        this.attachConnHandlers(c);
        c.on('open', () => {
          this.startPingLoop();
          document.getElementById('roomWaitBox').classList.add('active');
          document.getElementById('roomCodeDisplay').textContent = code;
          c.send({ type: 'roomJoin', name: profile.name, playerNo: profile.playerNo || null, rating: profile.rating, title: profile.activeTitle, lbRecord: buildPublicRecord(), equippedSkills: profile.equippedSkills || [], ownedSkills: profile.ownedSkills || {}, style: this.myStyle, ready: this.myReady });
          updateRoomLobbyUI();
        });
      });
      p.on('error', () => { showToast('ルームが見つかりませんでした。IDを確認してください。'); this.cleanup(); });
    },

    attachConnHandlers(c) {
      c.on('data', (msg) => {
        if (!msg || !msg.type) return;
        switch (msg.type) {
          case 'ping':
            this.send({ type: 'pong', t: msg.t });
            break;
          case 'pong':
            if (typeof msg.t === 'number') {
              this.updatePingUI(Math.max(1, Math.round(performance.now() - msg.t)));
            }
            break;
          case 'lbSync':
            if (msg.lbRecord) upsertLeaderboardPlayer(msg.lbRecord);
            break;
          case 'roomSync':
            this.rule = msg.rule; this.rated = false; this.targetWins = msg.targetWins || 2;
            this.puyoColors = msg.puyoColors || 4;
            this.hostAtk = msg.hostAtk || 100; this.guestAtk = msg.guestAtk || 100;
            if (msg.lbRecord) upsertLeaderboardPlayer(msg.lbRecord);
            this.oppInfo = {
              name: msg.name, playerNo: msg.playerNo || null, rating: msg.rating, style: msg.style, title: msg.title || '',
              equippedSkills: msg.equippedSkills || [], ownedSkills: msg.ownedSkills || {}
            };
            this.oppReady = !!msg.ready;
            document.getElementById('roomLobbyTitle').textContent =
              `ルーム接続済 (${this.rule.toUpperCase()} / FT${this.targetWins} / ${this.puyoColors}色 / 火力${this.guestAtk}%:${this.hostAtk}%)`;
            document.getElementById('roomStylePickRow').style.display = this.rule !== 'swap' ? 'block' : 'none';
            updateRoomLobbyUI();
            break;
          case 'roomJoin':
          case 'roomState':
            if (msg.lbRecord) upsertLeaderboardPlayer(msg.lbRecord);
            this.oppInfo = {
              name: msg.name, playerNo: msg.playerNo || null, rating: msg.rating, style: msg.style, title: msg.title || '',
              equippedSkills: msg.equippedSkills || (this.oppInfo && this.oppInfo.equippedSkills) || [],
              ownedSkills: msg.ownedSkills || (this.oppInfo && this.oppInfo.ownedSkills) || {}
            };
            this.oppReady = !!msg.ready;
            if (msg.type === 'roomJoin') {
              this.send({
                type: 'roomSync', rule: this.rule, rated: this.rated, targetWins: this.targetWins, puyoColors: this.puyoColors,
                hostAtk: this.hostAtk, guestAtk: this.guestAtk, lbRecord: buildPublicRecord(),
                equippedSkills: profile.equippedSkills || [], ownedSkills: profile.ownedSkills || {},
                name: profile.name, playerNo: profile.playerNo || null, rating: this.rule === 'skill' ? (profile.skillRating || 1500) : profile.rating, title: profile.activeTitle, style: this.myStyle, ready: this.myReady
              });
            }
            updateRoomLobbyUI();
            if (this.isHost && this.myReady && this.oppReady) {
              this.send({ type: 'roomStart', targetWins: this.targetWins, puyoColors: this.puyoColors, hostAtk: this.hostAtk, guestAtk: this.guestAtk });
              startOnlineMatch(this.rule, this.rated, this.myStyle, this.oppInfo, this.targetWins, this.puyoColors, this.hostAtk, this.guestAtk);
            }
            break;
          case 'roomStart':
            this.targetWins = msg.targetWins || this.targetWins;
            this.puyoColors = msg.puyoColors || this.puyoColors;
            this.hostAtk = msg.hostAtk || 100; this.guestAtk = msg.guestAtk || 100;
            startOnlineMatch(this.rule, this.rated, this.myStyle, this.oppInfo, this.targetWins, this.puyoColors, this.guestAtk, this.hostAtk);
            break;
          case 'state':
            if (battle.active) battle.applyRemoteState(msg);
            break;
          case 'swapSwitch':
            if (battle.active && battle.rule === 'swap' && !this.isHost) {
              battle.applySyncedSwap(msg.side, msg.timer);
            }
            break;
          case 'attack':
            if (battle.active) battle.receiveRemoteAttack(msg);
            break;
          case 'stamp':
            receiveQuickStamp(msg);
            break;
          case 'ko':
            if (battle.active && !battle.ended) battle.onRoundEnd(true, '相手がK.O.しました！');
            break;
          case 'skillUse':
          case 'bigbangClash':
            if (window.skillsBigBang && typeof window.skillsBigBang.onRemoteMessage === 'function') {
              window.skillsBigBang.onRemoteMessage(msg, battle);
            }
            break;
          case 'rematchReq':
            battle.oppRematch = true;
            if (battle.myRematch) {
              battle.oppInfo.rating = msg.rating ?? battle.oppInfo.rating;
              startOnlineMatch(this.rule, this.rated, this.myStyle, battle.oppInfo, this.targetWins, this.puyoColors, this.isHost ? this.hostAtk : this.guestAtk, this.isHost ? this.guestAtk : this.hostAtk);
            } else {
              document.getElementById('resRematchStatus').textContent = '相手が再戦を希望しています！';
            }
            break;
        }
      });

      c.on('close', () => {
        this.stopPingLoop();
        if ((battle.active || battle.roundIntermission) && !battle.ended && battle.isOnline) {
          battle.finishMatch(true, '相手の通信が切断されました（不戦勝）', true);
        } else if (document.getElementById('roomWaitBox').classList.contains('active')) {
          showToast('相手がルームから退出しました');
          this.oppInfo = null; this.oppReady = false;
          updateRoomLobbyUI();
        }
      });
    }
  };

  function updateRoomLobbyUI() {
    const p1 = document.getElementById('roomP1Card');
    const p2 = document.getElementById('roomP2Card');
    const stLabel = net.rule === 'swap' ? 'SWAP' : (net.myStyle === 'tetris' ? 'TETRIS' : 'PUYO');
    document.getElementById('roomP1Info').textContent = `${profile.name} (R${profile.rating}) [${stLabel}] ${net.myReady ? '✅ READY' : ''}`;
    p1.classList.toggle('ready', net.myReady);

    if (net.oppInfo) {
      const ost = net.rule === 'swap' ? 'SWAP' : (net.oppInfo.style === 'tetris' ? 'TETRIS' : 'PUYO');
      document.getElementById('roomP2Info').textContent = `${net.oppInfo.name} (R${net.oppInfo.rating}) [${ost}] ${net.oppReady ? '✅ READY' : ''}`;
      p2.classList.toggle('ready', net.oppReady);
      document.getElementById('btnRoomReady').disabled = false;
    } else {
      document.getElementById('roomP2Info').textContent = '接続待ち...';
      p2.classList.remove('ready');
      document.getElementById('btnRoomReady').disabled = true;
    }
    document.getElementById('btnRoomReady').textContent = net.myReady ? 'READY 解除' : 'READY（準備完了）';
  }

  /* =========================================================================
     9. BATTLE CONTROLLER (FT2 ROUNDS, SPRINT/ULTRA, PUYO UNDO, SPECTATE)
     ========================================================================= */
  const battle = {
    active: false,
    paused: false,
    ended: false,
    countdownActive: false,
    roundIntermission: false,
    isOnline: false,
    isSolo: false,
    isCpu: false,
    isSpectate: false,
    soloSubType: null,
    rule: 'vs',
    rated: false,
    targetWins: 1,
    roundNum: 1,
    selfWins: 0,
    oppWins: 0,
    selfStyle: 'tetris',
    oppStyle: 'puyo',
    activeSwapSide: 'tetris',
    swapTimer: 25,
    lastSwapSecInt: 25,
    lastSelfClearTime: -999,
    lastSwapTime: -999,
    swapComboUsed: false,
    zeroGravity: false,
    puyoColors: 4,
    selfAtkMult: 1.0,
    oppAtkMult: 1.0,
    replayFrames: [],
    replayAccum: 0,
    replayMeta: null,
    ultraRemaining: 120,
    selfTetris: null,
    selfPuyo: null,
    oppTetris: null,
    oppPuyo: null,
    leftCpu: null,
    cpu: null,
    selfInfo: { name: 'PLAYER', rating: 1500 },
    oppInfo: { name: 'CPU', rating: 1500, style: 'puyo' },
    myRematch: false,
    oppRematch: false,
    syncTimer: 0,
    dangerBeepTimer: 0,
    selfShake: { time: 0, mag: 0 },
    oppShake: { time: 0, mag: 0 },
    puyoUndoStack: [],
    stats: {
      elapsedSec: 0, pieces: 0, attack: 0,
      maxChain: 0, maxRen: 0, tSpins: 0, allClears: 0, countered: 0
    },
    oppStats: {
      pieces: 0, attack: 0, pps: 0, apm: 0
    },

    triggerShake(isSelf, mag, dur) {
      const target = isSelf ? this.selfShake : this.oppShake;
      target.mag = Math.max(target.mag, mag);
      target.time = Math.max(target.time, dur);
    },

    convertAttack(fromStyle, toStyle, amount) {
      if (fromStyle === toStyle) return amount;
      if (fromStyle === 'tetris' && toStyle === 'puyo') return amount * 4;
      if (fromStyle === 'puyo' && toStyle === 'tetris') return amount * 0.25;
      return amount;
    },

    getActiveBoard(isSelf) {
      const style = this.rule === 'swap' ? this.activeSwapSide : (isSelf ? this.selfStyle : this.oppStyle);
      if (isSelf) return style === 'tetris' ? this.selfTetris : this.selfPuyo;
      return style === 'tetris' ? this.oppTetris : this.oppPuyo;
    },

    getActiveStyle(isSelf) {
      return this.rule === 'swap' ? this.activeSwapSide : (isSelf ? this.selfStyle : this.oppStyle);
    },

    recordStat(type, val = 1) {
      if (type === 'piece') this.stats.pieces++;
      else if (type === 'attack') this.stats.attack += val;
      else if (type === 'chain') {
        this.stats.maxChain = Math.max(this.stats.maxChain, val);
        if (!this.isSpectate && val > (profile.records.maxChain || 0)) {
          profile.records.maxChain = val;
          saveProfile(profile);
        }
      }
      else if (type === 'ren') this.stats.maxRen = Math.max(this.stats.maxRen, val);
      else if (type === 'tspin') this.stats.tSpins++;
      else if (type === 'allclear') this.stats.allClears++;
      else if (type === 'counter') this.stats.countered += val;
    },

    recordOppStat(type, val = 1) {
      if (type === 'piece') this.oppStats.pieces++;
      else if (type === 'attack') this.oppStats.attack += val;
    },

    pushPuyoUndo(snap) {
      if (this.soloSubType !== 'endless_puyo') return;
      this.puyoUndoStack.push(snap);
      if (this.puyoUndoStack.length > 20) this.puyoUndoStack.shift();
      this.updateUndoBtn();
    },

    doPuyoUndo() {
      if (this.soloSubType !== 'endless_puyo' || !this.active || this.paused || this.ended) return;
      if (this.puyoUndoStack.length === 0) {
        showToast('戻せる履歴がありません');
        return;
      }
      const snap = this.puyoUndoStack.pop();
      this.selfPuyo.restoreSnapshot(snap);
      sound.playSE('undo');
      this.updateUndoBtn();
      this.render();
    },

    updateUndoBtn() {
      const btn = document.getElementById('btnPuyoUndo');
      if (this.soloSubType === 'endless_puyo') {
        btn.style.display = 'inline-flex';
        btn.textContent = `↩ 1手戻す (${this.puyoUndoStack.length})`;
      } else {
        btn.style.display = 'none';
      }
    },

    handleSwapCombo(isSelf, style) {
      if (!isSelf || this.rule !== 'swap') return 0;
      const now = performance.now() / 1000;
      const sinceSwap = now - this.lastSwapTime;
      if (!this.swapComboUsed && sinceSwap >= 0 && sinceSwap <= 4.0 && (this.lastSwapTime - this.lastSelfClearTime) <= 2.6 && (this.lastSwapTime - this.lastSelfClearTime) >= 0) {
        this.swapComboUsed = true;
        this.lastSelfClearTime = now;
        this.getActiveBoard(true).addPopup('SWAP COMBO!', '#fde047');
        sound.playSE('swapCombo');
        unlockAchievement('swap_combo');
        return style === 'tetris' ? 3 : 12;
      }
      this.lastSelfClearTime = now;
      return 0;
    },

    applySyncedSwap(newSide, newTimer = 25.0) {
      this.activeSwapSide = newSide;
      this.swapTimer = newTimer;
      this.lastSwapSecInt = Math.ceil(newTimer);
      this.lastSwapTime = performance.now() / 1000;
      this.swapComboUsed = false;
      sound.setBgmTrack(newSide);
      sound.playSE('swapSwitch');
      this.getActiveBoard(true).addPopup('SWAP!', '#a855f7');
    },

    createBoardsForRound() {
      this.activeSwapSide = 'tetris';
      this.swapTimer = 25.0;
      this.lastSwapSecInt = 25;
      this.lastSelfClearTime = -999;
      this.lastSwapTime = -999;
      this.swapComboUsed = false;
      this.ultraRemaining = 120.0;
      this.dangerBeepTimer = 0;
      this.selfShake = { time: 0, mag: 0 };
      this.oppShake = { time: 0, mag: 0 };
      this.puyoUndoStack = [];
      if (this.leftCpu) {
        this.leftCpu.plan = null;
        this.leftCpu.pendingRef = null;
        this.leftCpu.puyoSoftDrop = false;
        this.leftCpu.tetrisSoftDrop = false;
        this.leftCpu.lastPuyoRef = null;
      }
      if (this.cpu) {
        this.cpu.plan = null;
        this.cpu.pendingRef = null;
        this.cpu.puyoSoftDrop = false;
        this.cpu.tetrisSoftDrop = false;
        this.cpu.lastPuyoRef = null;
      }

      const onSelfAttack = (fromStyle, amount, label) => {
        if (this.ended || this.roundIntermission) return;
        if (window.skillsBigBang && typeof window.skillsBigBang.onAttackIntercept === 'function') {
          if (window.skillsBigBang.onAttackIntercept(true, fromStyle, amount, this)) return;
        }
        if (this.isSolo) return;
        const scaled = Math.max(1, Math.round(amount * this.selfAtkMult));
        sound.playSE('attack');
        spawnAttackOrb(true, fromStyle === 'tetris' ? scaled : scaled / 4, fromStyle === 'tetris' ? '#00f0ff' : '#ff2e93');
        if (this.isOnline) {
          net.send({ type: 'attack', fromStyle, amount: scaled, label });
        } else if (this.isCpu || this.isSpectate) {
          const targetStyle = this.getActiveStyle(false);
          const conv = this.convertAttack(fromStyle, targetStyle, scaled);
          this.getActiveBoard(false).receiveGarbage(conv);
        }
      };

      const onOppAttack = (fromStyle, amount) => {
        if (this.ended || this.roundIntermission) return;
        if (window.skillsBigBang && typeof window.skillsBigBang.onAttackIntercept === 'function') {
          if (window.skillsBigBang.onAttackIntercept(false, fromStyle, amount, this)) return;
        }
        const scaled = Math.max(1, Math.round(amount * this.oppAtkMult));
        if (this.isSpectate) sound.playSE('attack');
        spawnAttackOrb(false, fromStyle === 'tetris' ? scaled : scaled / 4, fromStyle === 'tetris' ? '#00f0ff' : '#ff2e93');
        const targetStyle = this.getActiveStyle(true);
        const conv = this.convertAttack(fromStyle, targetStyle, scaled);
        this.getActiveBoard(true).receiveGarbage(conv);
      };

      const statHook = (t, v) => this.recordStat(t, v);
      const oppStatHook = (t, v) => this.recordOppStat(t, v);
      const selfShakeHook = (m, d) => this.triggerShake(true, m, d);
      const oppShakeHook = (m, d) => this.triggerShake(false, m, d);
      const beforePuyoLock = (snap) => this.pushPuyoUndo(snap);

      const selfLocalAudio = !this.isSpectate;
      const tRng = this.seedStr ? createSeededRng(this.seedStr + '_t') : null;
      const pRng = this.seedStr ? createSeededRng(this.seedStr + '_p') : null;
      this.selfTetris = new TetrisBoard(selfLocalAudio, onSelfAttack, () => this.onSelfKO(), (st) => this.handleSwapCombo(true, st), statHook, selfShakeHook, tRng);
      this.selfPuyo = new PuyoBoard(selfLocalAudio, onSelfAttack, () => this.onSelfKO(), (st) => this.handleSwapCombo(true, st), statHook, selfShakeHook, beforePuyoLock, this.puyoColors, pRng);
      this.oppTetris = new TetrisBoard(false, onOppAttack, () => this.onOppKO(), null, oppStatHook, oppShakeHook);
      this.oppPuyo = new PuyoBoard(false, onOppAttack, () => this.onOppKO(), null, oppStatHook, oppShakeHook, null, this.puyoColors);
      if (this.soloSubType === 'cheese') {
        this.selfTetris.initCheeseRace(this.cheeseTarget || 10);
      }
      if (window.skillsBigBang && typeof window.skillsBigBang.onSetupRound === 'function') {
        window.skillsBigBang.onSetupRound(this);
      }
      this.updateUndoBtn();
    },

    setupMatch(opts) {
      this.active = false;
      this.paused = false;
      this.ended = false;
      this.countdownActive = true;
      this.roundIntermission = false;
      this.isOnline = !!opts.isOnline;
      this.isSolo = !!opts.isSolo;
      this.isCpu = !!opts.isCpu;
      this.isSpectate = !!opts.isSpectate;
      this.soloSubType = opts.soloSubType || null;
      this.seedStr = opts.seedStr || null;
      this.isDailySeed = !!opts.isDailySeed;
      this.towerFloor = opts.towerFloor || 0;
      this.cheeseTarget = opts.cheeseTarget || 10;
      this.rule = opts.rule || 'vs';
      this.rated = !!opts.rated;
      this.puyoColors = opts.puyoColors || 4;
      this.selfAtkMult = (opts.selfAtk || 100) / 100;
      this.oppAtkMult = (opts.oppAtk || 100) / 100;
      this.replayFrames = [];
      this.replayAccum = 0;
      this.replayMeta = {
        rule: this.rule, isSolo: this.isSolo, isSpectate: this.isSpectate,
        selfName: (opts.selfInfo && opts.selfInfo.name) || profile.name,
        oppName: (opts.oppInfo && opts.oppInfo.name) || 'OPPONENT',
        selfStyle: opts.selfStyle || 'tetris',
        oppStyle: opts.oppStyle || 'puyo',
        date: new Date().toISOString()
      };
      this.zeroGravity = false;
      this.targetWins = this.isSolo ? 1 : (opts.targetWins || 1);
      this.roundNum = 1;
      this.selfWins = 0;
      this.oppWins = 0;
      this.selfStyle = opts.selfStyle || 'tetris';
      this.oppStyle = opts.oppStyle || 'puyo';
      this.selfInfo = opts.selfInfo || { name: profile.name, rating: profile.rating };
      this.oppInfo = opts.oppInfo || { name: 'CPU', rating: 1500, style: this.oppStyle };
      this.myRematch = false;
      this.oppRematch = false;
      this.stats = { elapsedSec: 0, pieces: 0, attack: 0, maxChain: 0, maxRen: 0, tSpins: 0, allClears: 0, countered: 0 };
      this.oppStats = { pieces: 0, attack: 0, pps: 0, apm: 0 };
      this.leftCpu = this.isSpectate ? new CpuController(opts.leftDiff || 'impossible') : null;
      this.cpu = (this.isCpu || this.isSpectate) ? new CpuController(opts.cpuDiff || opts.rightDiff || 'normal') : null;

      sound.resetBgmSteps();
      sound.setBgmTrack(this.getActiveStyle(true));
      this.createBoardsForRound();

      showScreen('screenBattle');
      document.getElementById('arenaStage').classList.toggle('solo-mode', this.isSolo);
      document.getElementById('arenaStage').classList.toggle('spectate-mode', this.isSpectate);
      document.getElementById('touchPad').classList.toggle('hidden', this.isSpectate);
      document.getElementById('oppZone').style.display = this.isSolo ? 'none' : 'block';
      document.getElementById('selfZone').classList.remove('danger');
      document.getElementById('oppZone').classList.remove('danger');
      document.getElementById('btnPauseGame').style.display = this.isOnline ? 'none' : 'inline-flex';
      document.getElementById('btnRetryGame').style.display = this.isOnline ? 'none' : 'inline-flex';
      const canZeroG = this.soloSubType === 'endless_tetris' || this.soloSubType === 'endless_puyo';
      const zgBtn = document.getElementById('btnZeroGrav');
      zgBtn.style.display = canZeroG ? 'inline-flex' : 'none';
      zgBtn.textContent = '🪶 重力: ON';
      zgBtn.classList.remove('active');
      document.getElementById('swapBanner').classList.toggle('active', this.rule === 'swap');
      document.getElementById('swapBanner').classList.remove('warn');
      document.getElementById('swapTimerVal').textContent = '25.0s';

      const chBan = document.getElementById('challengeBanner');
      const isChallenge = this.soloSubType === 'sprint40' || this.soloSubType === 'ultra2m' || this.soloSubType === 'cheese' || this.soloSubType === 'daily_puyo2m';
      chBan.classList.toggle('active', isChallenge);
      chBan.classList.remove('warn');

      const hideStamps = this.isSolo || this.isSpectate;
      document.getElementById('battleStampBar').classList.toggle('hidden', hideStamps);
      document.getElementById('resultStampBar').classList.toggle('hidden', hideStamps);

      let modeLabel = '';
      if (this.towerFloor > 0) modeLabel = `🗼 CPU TOWER ${this.towerFloor}F / 10F`;
      else if (this.isDailySeed) modeLabel = `📅 DAILY SEED (${this.seedStr || ''})`;
      else if (this.soloSubType === 'sprint40') modeLabel = '40L SPRINT';
      else if (this.soloSubType === 'ultra2m') modeLabel = '2MIN ULTRA';
      else if (this.soloSubType === 'daily_puyo2m') modeLabel = '2MIN PUYO';
      else if (this.soloSubType === 'cheese') modeLabel = `CHEESE ${this.cheeseTarget || 10}L`;
      else if (this.soloSubType === 'bigbang_solo') modeLabel = `💥 BIG BANG SOLO (${this.selfStyle.toUpperCase()})`;
      else if (this.isSolo) modeLabel = this.rule === 'swap' ? 'SOLO SWAP' : `SOLO ${this.selfStyle.toUpperCase()}`;
      else if (this.isSpectate) modeLabel = `AI SPECTATE (${this.rule.toUpperCase()} / FT${this.targetWins})`;
      else modeLabel = `${this.rule === 'bigbang' ? '💥 BIG BANG' : (this.rule === 'skill' ? '⚡ SKILL' : this.rule.toUpperCase())} FT${this.targetWins} ${this.rated ? 'RANKED' : (this.isCpu ? 'VS CPU' : 'FREE')}`;
      document.getElementById('battleModeTag').textContent = modeLabel;

      const eloEl = document.getElementById('battleEloInfo');
      if (this.rated && !this.isSolo && !this.isCpu && !this.isSpectate) {
        const baseRate = this.rule === 'skill' ? (profile.skillRating || 1500) : profile.rating;
        const prev = calcEloPreview(baseRate, this.oppInfo.rating);
        eloEl.textContent = this.targetWins === 2
          ? `予想: 2-0:+${prev.win20} / 2-1:+${prev.win21} | 1-2:${prev.lose12} / 0-2:${prev.lose02}`
          : `予想変動: WIN +${prev.winDelta} / LOSE ${prev.loseDelta}`;
      } else if (this.isSpectate) {
        eloEl.textContent = 'AI vs AI 観戦中';
      } else {
        eloEl.textContent = this.isSolo ? 'ソロモード' : 'レート変動なし';
      }

      this.updateHUD();
      this.render();
    },

    getSelfPpsApm() {
      const sec = Math.max(0.5, this.stats.elapsedSec);
      return { pps: this.stats.pieces / sec, apm: (this.stats.attack / sec) * 60 };
    },

    renderWinDots(wins, target) {
      if (target <= 1 || this.isSolo) return '';
      let s = '';
      for (let i = 0; i < target; i++) s += i < wins ? '●' : '○';
      return s;
    },

    updateHUD() {
      const myRank = getRankTier(this.selfInfo.rating);
      document.getElementById('selfNameHud').textContent = this.selfInfo.name;
      setTitleBadgeEl('selfTitleHud', this.isSpectate ? '' : (this.selfInfo.title || profile.activeTitle));
      setPlayerIdBadgeEl('selfPidHud', this.isSpectate ? null : (this.selfInfo.playerNo ?? profile.playerNo), false, true);
      document.getElementById('selfWinDots').textContent = this.renderWinDots(this.selfWins, this.targetWins);
      const sr = document.getElementById('selfRankHud');
      sr.textContent = myRank.name; sr.className = `rank-badge ${myRank.cls}`;
      document.getElementById('selfRatingHud').textContent = `R ${this.selfInfo.rating}`;
      const mySt = this.getActiveStyle(true);
      const ss = document.getElementById('selfStyleHud');
      ss.textContent = mySt === 'tetris' ? 'TETRIS' : 'PUYO';
      ss.className = 'style-pill' + (mySt === 'puyo' ? ' puyo' : '');
      const sAtkPct = Math.round(this.selfAtkMult * 100);
      const sAtkEl = document.getElementById('selfAtkBadge');
      sAtkEl.textContent = `ATK ${sAtkPct}%`;
      sAtkEl.classList.toggle('active', sAtkPct !== 100 && !this.isSolo);
      const tHard = document.getElementById('touchBtnHard');
      const tHold = document.getElementById('touchBtnHold');
      const tRot180 = document.getElementById('touchBtnRot180');
      if (tHard) tHard.classList.toggle('disabled', mySt === 'puyo' || this.isSpectate);
      if (tHold) tHold.classList.toggle('disabled', mySt === 'puyo' || this.isSpectate);
      if (tRot180) tRot180.classList.toggle('disabled', mySt === 'puyo' || this.isSpectate);
      const myB = this.getActiveBoard(true);
      document.getElementById('selfScoreHud').textContent = (myB ? myB.score : 0).toLocaleString();

      const { pps, apm } = this.getSelfPpsApm();
      document.getElementById('selfPpsHud').textContent = `PPS ${pps.toFixed(2)}`;
      document.getElementById('selfApmHud').textContent = `APM ${apm.toFixed(1)}`;

      if (this.soloSubType === 'sprint40') {
        const rem = Math.max(0, 40 - this.selfTetris.lines);
        document.getElementById('challengeBanner').textContent =
          `⏱ 残り ${rem} LINES | ${formatSprintTime(this.stats.elapsedSec * 1000)}`;
      } else if (this.soloSubType === 'ultra2m' || this.soloSubType === 'daily_puyo2m') {
        const rem = Math.max(0, this.ultraRemaining);
        const m = Math.floor(rem / 60);
        const s = (rem % 60).toFixed(1).padStart(4, '0');
        const ch = document.getElementById('challengeBanner');
        const scVal = this.soloSubType === 'daily_puyo2m' ? (this.selfPuyo ? this.selfPuyo.score : 0) : this.selfTetris.score;
        ch.textContent = `${this.isDailySeed ? '📅 ' : '⚡ '}残り 0${m}:${s} | SCORE ${scVal.toLocaleString()}`;
        ch.classList.toggle('warn', rem <= 10.0 && rem > 0);
      } else if (this.soloSubType === 'cheese') {
        const rem = this.selfTetris.getTotalCheeseRemaining();
        document.getElementById('challengeBanner').textContent =
          `🧀 残り ${rem} / ${this.cheeseTarget || 10} LINES | ${formatSprintTime(this.stats.elapsedSec * 1000)}`;
      }

      if (!this.isSolo) {
        const oRank = getRankTier(this.oppInfo.rating);
        document.getElementById('oppNameHud').textContent = this.oppInfo.name;
        setTitleBadgeEl('oppTitleHud', this.oppInfo.title || '');
        setPlayerIdBadgeEl('oppPidHud', this.oppInfo.playerNo || null, false, true);
        document.getElementById('oppWinDots').textContent = this.renderWinDots(this.oppWins, this.targetWins);
        const or = document.getElementById('oppRankHud');
        or.textContent = oRank.name; or.className = `rank-badge ${oRank.cls}`;
        document.getElementById('oppRatingHud').textContent = `R ${this.oppInfo.rating}`;
        const opSt = this.getActiveStyle(false);
        const os = document.getElementById('oppStyleHud');
        os.textContent = opSt === 'tetris' ? 'TETRIS' : 'PUYO';
        os.className = 'style-pill' + (opSt === 'puyo' ? ' puyo' : '');
        const oAtkPct = Math.round(this.oppAtkMult * 100);
        const oAtkEl = document.getElementById('oppAtkBadge');
        oAtkEl.textContent = `ATK ${oAtkPct}%`;
        oAtkEl.classList.toggle('active', oAtkPct !== 100);
        const opB = this.getActiveBoard(false);
        document.getElementById('oppScoreHud').textContent = (opB ? opB.score : 0).toLocaleString();

        let oppPps = this.oppStats.pps;
        let oppApm = this.oppStats.apm;
        if (this.isCpu || this.isSpectate) {
          const sec = Math.max(0.5, this.stats.elapsedSec);
          oppPps = this.oppStats.pieces / sec;
          oppApm = (this.oppStats.attack / sec) * 60;
        }
        document.getElementById('oppPpsHud').textContent = `PPS ${oppPps.toFixed(2)}`;
        document.getElementById('oppApmHud').textContent = `APM ${oppApm.toFixed(1)}`;
      }
    },

    onSelfKO() {
      if (this.ended || this.roundIntermission) return;
      if (window.skillsBigBang && typeof window.skillsBigBang.onKOIntercept === 'function') {
        if (window.skillsBigBang.onKOIntercept(true, this)) return;
      }
      if (this.isOnline) net.send({ type: 'ko' });
      if (this.isSolo) {
        if (this.soloSubType === 'sprint40' || this.soloSubType === 'ultra2m' || this.soloSubType === 'cheese' || this.soloSubType === 'daily_puyo2m') {
          this.finishChallenge(false);
        } else {
          this.finishMatch(false, 'ゲームオーバー！');
        }
        return;
      }
      this.onRoundEnd(false, this.isSpectate ? `${this.oppInfo.name} のラウンド勝利！` : 'K.O.されました...');
    },

    onOppKO() {
      if (this.ended || this.roundIntermission) return;
      if (window.skillsBigBang && typeof window.skillsBigBang.onKOIntercept === 'function') {
        if (window.skillsBigBang.onKOIntercept(false, this)) return;
      }
      this.onRoundEnd(true, this.isSpectate ? `${this.selfInfo.name} のラウンド勝利！` : '相手をK.O.しました！');
    },

    onRoundEnd(selfWon, reasonText) {
      if (this.ended || this.roundIntermission) return;
      if (selfWon) this.selfWins++;
      else this.oppWins++;
      this.updateHUD();

      if (this.selfWins >= this.targetWins || this.oppWins >= this.targetWins) {
        const finalWon = this.selfWins >= this.targetWins;
        const scoreSuffix = this.targetWins > 1 ? ` (${this.selfWins} - ${this.oppWins})` : '';
        this.finishMatch(finalWon, reasonText + scoreSuffix);
        return;
      }

      this.active = false;
      this.roundIntermission = true;
      sound.playSE(selfWon ? 'win' : 'lose');

      const ov = document.getElementById('overlayRound');
      const rt = document.getElementById('roundTitle');
      if (this.isSpectate) {
        rt.textContent = `ROUND ${this.roundNum} — ${selfWon ? 'LEFT' : 'RIGHT'} WIN!`;
        rt.className = 'result-title win';
      } else {
        rt.textContent = selfWon ? `ROUND ${this.roundNum} WIN!` : `ROUND ${this.roundNum} LOSE...`;
        rt.className = 'result-title ' + (selfWon ? 'win' : 'lose');
      }
      document.getElementById('roundScoreText').textContent = `${this.selfWins} - ${this.oppWins}`;
      document.getElementById('roundSubText').textContent = `ROUND ${this.roundNum + 1} を準備中...`;
      ov.classList.add('active');

      setTimeout(() => {
        ov.classList.remove('active');
        if (this.ended) return;
        this.roundNum++;
        this.roundIntermission = false;
        this.countdownActive = true;
        this.createBoardsForRound();
        this.updateHUD();
        this.render();
        this.startCountdown();
      }, 2100);
    },

    finishChallenge(cleared) {
      if (this.ended) return;
      this.ended = true;
      this.active = false;
      this.countdownActive = false;
      sound.stopBGM();
      document.getElementById('selfZone').classList.remove('danger');

      let isNewRecord = false;
      let titleText = 'GAME OVER';
      let subText = '';

      addDailyProgress('play2', 1);
      if (!this.isSpectate) {
        const totalPlays = addStatTotal('totalPlays', 1);
        unlockAchievement('first_play');
        if (totalPlays >= 10) unlockAchievement('play10');
      }
      if (this.soloSubType === 'sprint40') {
        if (cleared) {
          const ms = Math.round(this.stats.elapsedSec * 1000);
          titleText = '40 LINES CLEAR!';
          subText = `クリアタイム: ${formatSprintTime(ms)}`;
          addDailyProgress('challenge1', 1);
          unlockAchievement('sprint_clear');
          if (ms < 90000) unlockAchievement('sprint90');
          if (ms < 60000) unlockAchievement('sprint60');
          if (ms < 40000) unlockAchievement('sprint40');
          if (profile.records.bestSprintMs === null || ms < profile.records.bestSprintMs) {
            profile.records.bestSprintMs = ms;
            isNewRecord = true;
            saveProfile(profile);
          }
          sound.playSE(isNewRecord ? 'rankUp' : 'win');
        } else {
          titleText = 'FAILED';
          subText = `到達ライン: ${this.selfTetris.lines} / 40`;
          sound.playSE('lose');
        }
      } else if (this.soloSubType === 'ultra2m') {
        const sc = this.selfTetris.score;
        if (cleared) addDailyProgress('challenge1', 1);
        if (sc >= 10000) unlockAchievement('ultra10k');
        if (sc >= 30000) unlockAchievement('ultra30k');
        if (sc >= 60000) unlockAchievement('ultra60k');
        titleText = cleared ? 'TIME UP!' : 'GAME OVER';
        subText = `最終スコア: ${sc.toLocaleString()}`;
        if (sc > (profile.records.bestUltraScore || 0)) {
          profile.records.bestUltraScore = sc;
          isNewRecord = true;
          saveProfile(profile);
        }
        sound.playSE(isNewRecord ? 'rankUp' : (cleared ? 'win' : 'lose'));
      } else if (this.soloSubType === 'cheese') {
        const target = this.cheeseTarget || 10;
        if (cleared) {
          const ms = Math.round(this.stats.elapsedSec * 1000);
          titleText = `CHEESE ${target}L CLEAR!`;
          subText = `クリアタイム: ${formatSprintTime(ms)}`;
          addDailyProgress('challenge1', 1);
          if (target === 10) unlockAchievement('cheese10');
          if (target === 20) unlockAchievement('cheese20');
          const recKey = target === 20 ? 'bestCheese20Ms' : 'bestCheese10Ms';
          if (profile.records[recKey] === null || profile.records[recKey] === undefined || ms < profile.records[recKey]) {
            profile.records[recKey] = ms;
            isNewRecord = true;
            saveProfile(profile);
          }
          sound.playSE(isNewRecord ? 'rankUp' : 'win');
        } else {
          titleText = 'FAILED';
          subText = `残りチーズ: ${this.selfTetris.getTotalCheeseRemaining()} / ${target} LINES`;
          sound.playSE('lose');
        }
      } else if (this.soloSubType === 'daily_puyo2m') {
        const sc = this.selfPuyo ? this.selfPuyo.score : 0;
        if (cleared) addDailyProgress('challenge1', 1);
        titleText = cleared ? 'TIME UP!' : 'GAME OVER';
        subText = `最終スコア: ${sc.toLocaleString()}`;
        sound.playSE(cleared ? 'win' : 'lose');
      }

      const titleEl = document.getElementById('resTitle');
      titleEl.textContent = titleText;
      titleEl.className = 'result-title ' + (cleared ? 'win' : 'lose');
      document.getElementById('resSub').textContent = subText;

      let earnedCoins = 0;
      if (this.soloSubType === 'sprint40') {
        if (cleared) earnedCoins = 60 + (isNewRecord ? 40 : 0);
        else if (this.selfTetris.lines >= 10) earnedCoins = 10;
      } else if (this.soloSubType === 'ultra2m') {
        if (cleared) earnedCoins = 50 + (isNewRecord ? 30 : 0);
        else earnedCoins = 10;
      } else if (this.soloSubType === 'cheese') {
        if (cleared) earnedCoins = (this.cheeseTarget === 20 ? 80 : 40);
      }
      if (earnedCoins > 0) {
        profile.coins = (profile.coins || 0) + earnedCoins;
        saveProfile(profile);
        renderProfileUI();
        setTimeout(() => sound.playSE('coinGet'), 350);
      }

      const badgesEl = document.getElementById('resSpecialBadges');
      badgesEl.innerHTML = (isNewRecord ? '<span class="result-special">🏆 NEW RECORD!</span>' : '') +
        (earnedCoins > 0 ? `<span class="result-special" style="background:linear-gradient(135deg,#eab308,#f59e0b);color:#1c1917;">🪙 +${earnedCoins} COINS GET!</span>` : '');
      document.getElementById('resRatingBox').style.display = 'none';

      if (!this.isSpectate) {
        const sc = this.rule === 'swap' ? (this.selfTetris.score + this.selfPuyo.score) : this.getActiveBoard(true).score;
        if (sc > (profile.records.bestEndlessScore || 0)) {
          profile.records.bestEndlessScore = sc;
          saveProfile(profile);
        }
        if (this.isOnline && net.conn && net.conn.open) {
          net.send({ type: 'lbSync', lbRecord: buildPublicRecord() });
        }
        syncCloudNow(true, false);
      }
      saveLastReplaySnapshot();
      this.populateResultStats();
      document.getElementById('resRematchStatus').textContent = '';
      if (!this.isSpectate) {
        const chXp = (cleared ? 65 : 25) + Math.min(40, Math.floor((this.stats.pieces || 0) / 3));
        grantXP(chXp);
      }
      const nextBtn = document.getElementById('btnNextTowerFloor');
      if (nextBtn) nextBtn.style.display = 'none';
      const seedBadge = document.getElementById('resSeedBadge');
      if (seedBadge) seedBadge.style.display = 'none';
      if (window.extras && typeof window.extras.onFinishChallenge === 'function') {
        window.extras.onFinishChallenge(this, cleared);
      }
      document.getElementById('btnRematch').disabled = false;
      document.getElementById('overlayResult').classList.add('active');
    },

    receiveRemoteAttack(msg) {
      if (this.rule === 'bigbang') return;
      if (this.rule === 'skill' && window.skillsBigBang && typeof window.skillsBigBang.onAttackIntercept === 'function') {
        window.skillsBigBang.onAttackIntercept(false, msg.fromStyle, msg.amount, this);
      }
      const targetStyle = this.getActiveStyle(true);
      const conv = this.convertAttack(msg.fromStyle, targetStyle, msg.amount);
      spawnAttackOrb(false, msg.fromStyle === 'tetris' ? msg.amount : msg.amount / 4, msg.fromStyle === 'tetris' ? '#00f0ff' : '#ff2e93');
      this.getActiveBoard(true).receiveGarbage(conv);
    },

    applyRemoteState(msg) {
      if (msg.t) this.oppTetris.applyRemote(msg.t);
      if (msg.p) this.oppPuyo.applyRemote(msg.p);
      if (typeof msg.pps === 'number') this.oppStats.pps = msg.pps;
      if (typeof msg.apm === 'number') this.oppStats.apm = msg.apm;
      if (window.skillsBigBang && typeof window.skillsBigBang.onApplyRemoteState === 'function') {
        window.skillsBigBang.onApplyRemoteState(msg, this);
      }

      if (this.rule === 'swap' && !net.isHost && typeof msg.swapTimer === 'number') {
        if (msg.swapSide && msg.swapSide !== this.activeSwapSide) {
          this.applySyncedSwap(msg.swapSide, msg.swapTimer);
        } else if (Math.abs(this.swapTimer - msg.swapTimer) > 0.25) {
          this.swapTimer = msg.swapTimer;
          this.lastSwapSecInt = Math.ceil(this.swapTimer);
        }
      }
    },

    startCountdown(onGo = null) {
      const ov = document.getElementById('overlayCountdown');
      const txt = document.getElementById('countdownText');
      ov.classList.add('active');
      const seq = ['3', '2', '1', 'GO!'];
      let idx = 0;
      const step = () => {
        if (!this.countdownActive) { ov.classList.remove('active'); return; }
        txt.textContent = seq[idx];
        txt.style.animation = 'none';
        void txt.offsetWidth;
        txt.style.animation = 'popIn 0.45s ease-out';
        sound.playSE(idx === 3 ? 'go' : 'countdown');
        idx++;
        if (idx < seq.length) setTimeout(step, 650);
        else {
          setTimeout(() => {
            ov.classList.remove('active');
            this.countdownActive = false;
            if (typeof onGo === 'function') {
              onGo();
            } else {
              this.active = true;
            }
            sound.fastMode = false;
            sound.startBGM();
          }, 450);
        }
      };
      step();
    },

    update(dt) {
      if (!this.active || this.paused || this.ended || this.roundIntermission) return;
      this.stats.elapsedSec += dt;

      if (this.soloSubType === 'ultra2m' || this.soloSubType === 'daily_puyo2m') {
        this.ultraRemaining -= dt;
        if (this.ultraRemaining <= 0) {
          this.ultraRemaining = 0;
          this.updateHUD();
          this.finishChallenge(true);
          return;
        }
      }

      if (window.skillsBigBang && typeof window.skillsBigBang.onUpdate === 'function') {
        if (window.skillsBigBang.onUpdate(dt, this)) {
          this.updateHUD();
          this.render();
          return;
        }
      }

      if (this.selfShake.time > 0) {
        this.selfShake.time = Math.max(0, this.selfShake.time - dt);
        if (this.selfShake.time === 0) this.selfShake.mag = 0;
      }
      if (this.oppShake.time > 0) {
        this.oppShake.time = Math.max(0, this.oppShake.time - dt);
        if (this.oppShake.time === 0) this.oppShake.mag = 0;
      }

      let swapUrgent = false;
      if (this.rule === 'swap') {
        this.swapTimer = Math.max(0, this.swapTimer - dt);
        const secInt = Math.ceil(this.swapTimer);
        const banner = document.getElementById('swapBanner');
        document.getElementById('swapTimerVal').textContent = this.swapTimer.toFixed(1) + 's';
        if (this.swapTimer <= 5.0 && this.swapTimer > 0) {
          banner.classList.add('warn');
          swapUrgent = true;
          if (secInt < this.lastSwapSecInt) sound.playSE('swapWarn');
        } else {
          banner.classList.remove('warn');
        }
        this.lastSwapSecInt = secInt;

        if (this.swapTimer <= 0 && (!this.isOnline || net.isHost)) {
          const nextSide = this.activeSwapSide === 'tetris' ? 'puyo' : 'tetris';
          this.applySyncedSwap(nextSide, 25.0);
          if (this.isOnline && net.isHost) {
            net.send({ type: 'swapSwitch', side: nextSide, timer: 25.0 });
          }
        }
      }

      const selfBoard = this.getActiveBoard(true);
      const oppBoard = this.isSolo ? null : this.getActiveBoard(false);
      const selfDanger = selfBoard && !selfBoard.dead && selfBoard.isInDanger();
      const oppDanger = oppBoard && !oppBoard.dead && oppBoard.isInDanger();

      document.getElementById('selfZone').classList.toggle('danger', !!selfDanger);
      if (!this.isSolo) document.getElementById('oppZone').classList.toggle('danger', !!oppDanger);

      sound.fastMode = !!(selfDanger || swapUrgent || ((this.soloSubType === 'ultra2m' || this.soloSubType === 'daily_puyo2m') && this.ultraRemaining <= 10));
      if (selfDanger && !this.isSpectate) {
        this.dangerBeepTimer += dt;
        if (this.dangerBeepTimer >= 1.1) {
          this.dangerBeepTimer = 0;
          sound.playSE('dangerBeep');
        }
      } else {
        this.dangerBeepTimer = 0;
      }

      const curLeftSt = this.getActiveStyle(true);
      const curOppSt = this.getActiveStyle(false);
      if (this.isSpectate) {
        this.leftCpu.update(dt, curLeftSt, this.selfTetris, this.selfPuyo, curOppSt, this.oppTetris, this.oppPuyo);
        if (curLeftSt === 'tetris') this.selfTetris.update(dt, !!this.leftCpu.tetrisSoftDrop);
        else this.selfPuyo.update(dt, !!this.leftCpu.puyoSoftDrop);
      } else {
        input.update(dt);
        const softHeld = input.isActionDown('down');
        if (curLeftSt === 'tetris') this.selfTetris.update(dt, softHeld);
        else this.selfPuyo.update(dt, softHeld);
      }

      if (this.isCpu || this.isSpectate) {
        this.cpu.update(dt, curOppSt, this.oppTetris, this.oppPuyo, curLeftSt, this.selfTetris, this.selfPuyo);
        if (curOppSt === 'tetris') this.oppTetris.update(dt, !!this.cpu.tetrisSoftDrop);
        else this.oppPuyo.update(dt, !!this.cpu.puyoSoftDrop);
      }

      if (this.isOnline) {
        this.syncTimer += dt;
        if (this.syncTimer >= 0.07) {
          this.syncTimer = 0;
          const { pps, apm } = this.getSelfPpsApm();
          const payload = {
            type: 'state',
            t: (this.rule === 'swap' || this.selfStyle === 'tetris') ? this.selfTetris.serialize() : null,
            p: (this.rule === 'swap' || this.selfStyle === 'puyo') ? this.selfPuyo.serialize() : null,
            pps: Math.round(pps * 100) / 100,
            apm: Math.round(apm * 10) / 10
          };
          if (this.rule === 'swap' && net.isHost) {
            payload.swapTimer = Math.round(this.swapTimer * 100) / 100;
            payload.swapSide = this.activeSwapSide;
          }
          if (window.skillsBigBang && typeof window.skillsBigBang.onBuildSyncPayload === 'function') {
            window.skillsBigBang.onBuildSyncPayload(payload);
          }
          net.send(payload);
        }
      }

      this.replayAccum += dt;
      if (this.replayAccum >= 0.15 && this.replayFrames.length < 1200) {
        this.replayAccum -= 0.15;
        const cloneS = (obj) => obj ? JSON.parse(JSON.stringify(obj)) : null;
        this.replayFrames.push({
          t: Math.round(this.stats.elapsedSec * 100) / 100,
          swapSide: this.activeSwapSide,
          st: (this.rule === 'swap' || this.selfStyle === 'tetris') ? cloneS(this.selfTetris.serialize()) : null,
          sp: (this.rule === 'swap' || this.selfStyle === 'puyo') ? cloneS(this.selfPuyo.serialize()) : null,
          ot: (!this.isSolo && (this.rule === 'swap' || this.oppStyle === 'tetris')) ? cloneS(this.oppTetris.serialize()) : null,
          op: (!this.isSolo && (this.rule === 'swap' || this.oppStyle === 'puyo')) ? cloneS(this.oppPuyo.serialize()) : null
        });
      }

      this.updateHUD();
      this.render();
    },

    render() {
      const selfCanvas = document.getElementById('selfCanvas');
      renderPlayerCanvas(selfCanvas, this.getActiveStyle(true), this.selfTetris, this.selfPuyo, this.rule === 'swap', !this.isSpectate, this.selfShake);
      if (!this.isSolo) {
        const oppCanvas = document.getElementById('oppCanvas');
        renderPlayerCanvas(oppCanvas, this.getActiveStyle(false), this.oppTetris, this.oppPuyo, this.rule === 'swap', false, this.oppShake);
      }
    },

    populateResultStats() {
      const sec = Math.max(0.5, this.stats.elapsedSec);
      const pps = (this.stats.pieces / sec).toFixed(2);
      const apm = ((this.stats.attack / sec) * 60).toFixed(1);
      const statItems = [
        ['PPS', pps],
        ['APM', apm],
        ['最大連鎖', `${this.stats.maxChain}連鎖`],
        ['最大REN', `${this.stats.maxRen} REN`],
        ['T-Spin', `${this.stats.tSpins}回`],
        ['全消し', `${this.stats.allClears}回`],
        ['相殺数', `${Math.round(this.stats.countered * 10) / 10}`],
        ['対戦時間', `${Math.floor(sec)}秒`]
      ];
      document.getElementById('resStatsGrid').innerHTML = statItems.map(([k, v]) =>
        `<div class="res-stat-cell"><div class="res-stat-k">${k}</div><div class="res-stat-v">${v}</div></div>`
      ).join('');
      const sc = this.rule === 'swap'
        ? (this.selfTetris.score + this.selfPuyo.score)
        : this.getActiveBoard(true).score;
      document.getElementById('resStatsSummary').textContent = `TOTAL SCORE: ${sc.toLocaleString()}`;
      const playRepBtn = document.getElementById('btnPlayReplay');
      const saveRepBtn = document.getElementById('btnSaveReplay');
      if (playRepBtn) playRepBtn.style.display = '';
      if (saveRepBtn) saveRepBtn.style.display = '';
    },

    finishMatch(won, reasonText, isDisconnectForfeit = false) {
      if (this.ended) return;
      this.ended = true;
      this.active = false;
      this.countdownActive = false;
      this.roundIntermission = false;
      document.getElementById('overlayRound').classList.remove('active');
      sound.stopBGM();
      document.getElementById('selfZone').classList.remove('danger');
      document.getElementById('oppZone').classList.remove('danger');

      const isSkillRanked = (this.rule === 'skill' && this.isOnline && this.rated);
      const oldRating = isSkillRanked ? (profile.skillRating || 1500) : profile.rating;
      const oldRank = getRankTier(oldRating);
      let delta = 0, newRating = oldRating, isUpset = false;

      const scoreTag = this.targetWins > 1 ? `${this.selfWins}-${this.oppWins}` : '';
      if (this.isOnline && this.rated) {
        const prev = calcEloPreview(oldRating, this.oppInfo.rating);
        if (this.targetWins === 2 && !isDisconnectForfeit) {
          const isStraight = (this.selfWins === 2 && this.oppWins === 0) || (this.selfWins === 0 && this.oppWins === 2);
          delta = won ? (isStraight ? prev.win20 : prev.win21) : (isStraight ? prev.lose02 : prev.lose12);
        } else {
          delta = won ? prev.winDelta : prev.loseDelta;
        }
        newRating = Math.max(0, oldRating + delta);
        if (isSkillRanked) {
          profile.skillRating = newRating;
          if (newRating > (profile.maxSkillRating || 1500)) profile.maxSkillRating = newRating;
          if (won) {
            profile.skillWins = (profile.skillWins || 0) + 1;
            if (this.oppInfo.rating - oldRating >= 100) isUpset = true;
          } else {
            profile.skillLosses = (profile.skillLosses || 0) + 1;
          }
        } else {
          profile.rating = newRating;
          if (newRating > profile.maxRating) profile.maxRating = newRating;
          if (won) {
            profile.wins++; profile.streak++;
            if (profile.streak > profile.bestStreak) profile.bestStreak = profile.streak;
            if (this.oppInfo.rating - oldRating >= 100) isUpset = true;
          } else {
            profile.losses++; profile.streak = 0;
          }
        }
        profile.history.unshift({
          oppName: this.oppInfo.name, oppRating: this.oppInfo.rating,
          mode: `${this.rule.toUpperCase()} FT${this.targetWins}${scoreTag ? ' (' + scoreTag + ')' : ''}`,
          myStyle: this.rule === 'swap' ? 'SWAP' : this.selfStyle.toUpperCase(),
          oppStyle: this.rule === 'swap' ? 'SWAP' : this.oppStyle.toUpperCase(),
          result: won ? 'WIN' : 'LOSE', delta, rated: true, ts: Date.now()
        });
        profile.history = profile.history.slice(0, 10);
        saveProfile(profile);
        renderProfileUI();
      } else if (this.isOnline && !this.rated) {
        profile.history.unshift({
          oppName: this.oppInfo.name, oppRating: this.oppInfo.rating,
          mode: `${this.rule.toUpperCase()} FT${this.targetWins}${scoreTag ? ' (' + scoreTag + ')' : ''} FREE`,
          myStyle: this.rule === 'swap' ? 'SWAP' : this.selfStyle.toUpperCase(),
          oppStyle: this.rule === 'swap' ? 'SWAP' : this.oppStyle.toUpperCase(),
          result: won ? 'WIN' : 'LOSE', delta: 0, rated: false, ts: Date.now()
        });
        profile.history = profile.history.slice(0, 10);
        saveProfile(profile);
        renderProfileUI();
      }

      const newRank = getRankTier(newRating);
      const rankChanged = newRank.idx !== oldRank.idx;

      if (isUpset) sound.playSE('upset');
      else if (rankChanged && newRank.idx > oldRank.idx) sound.playSE('rankUp');
      else sound.playSE(won ? 'win' : 'lose');

      const titleEl = document.getElementById('resTitle');
      if (this.isSolo) {
        if (this.soloSubType === 'bigbang_solo') {
          titleEl.textContent = 'BIG BANG FINISH!'; titleEl.className = 'result-title win';
        } else {
          titleEl.textContent = 'GAME OVER'; titleEl.className = 'result-title lose';
        }
      } else if (this.isSpectate) {
        titleEl.textContent = won ? `${this.selfInfo.name} WIN!` : `${this.oppInfo.name} WIN!`;
        titleEl.className = 'result-title win';
      } else {
        titleEl.textContent = won ? 'VICTORY!' : 'DEFEAT';
        titleEl.className = 'result-title ' + (won ? 'win' : 'lose');
      }
      document.getElementById('resSub').textContent = reasonText;

      let earnedCoins = 0;
      if (!this.isSpectate) {
        addDailyProgress('play2', 1);
        const totalPlays = addStatTotal('totalPlays', 1);
        unlockAchievement('first_play');
        if (totalPlays >= 10) unlockAchievement('play10');
        if (this.isOnline) {
          earnedCoins = 30 + (won ? 70 : 0) + (isUpset ? 50 : 0);
          if (this.rated) {
            if (newRating >= 1650) unlockAchievement('rank_plat');
            if (newRating >= 1800) unlockAchievement('rank_dia');
            if (newRating >= 2000) unlockAchievement('rank_master');
          }
          if (won) {
            addDailyProgress('win1', 1);
            addWeeklyProgress('w_wins10', 1);
            const totalWins = addStatTotal('totalWins', 1);
            if (totalWins >= 50) unlockAchievement('wins50');
            unlockAchievement('first_win');
            if (isUpset) unlockAchievement('upset_win');
            if (this.rated) {
              if ((profile.streak || 0) >= 3) unlockAchievement('streak3');
              if ((profile.streak || 0) >= 5) unlockAchievement('streak5');
            }
          }
        } else if (this.isCpu) {
          const diff = (this.cpu && this.cpu.difficulty) || 'normal';
          const cpuRewards = { easy: 25, normal: 45, hard: 80, impossible: 180 };
          earnedCoins = won ? (cpuRewards[diff] || 45) : 15;
          if (won) {
            addDailyProgress('win1', 1);
            addWeeklyProgress('w_wins10', 1);
            const totalWins = addStatTotal('totalWins', 1);
            if (totalWins >= 50) unlockAchievement('wins50');
            unlockAchievement('first_win');
            if ((this.puyoColors || 4) >= 5 && (this.rule === 'swap' || this.selfStyle === 'puyo')) {
              unlockAchievement('puyo5_win');
            }
            const isFairImpWin = (
              diff === 'impossible' &&
              this.targetWins >= 2 &&
              this.selfAtkMult <= 1.001 &&
              this.oppAtkMult >= 0.999 &&
              (this.puyoColors || 4) >= 4
            );
            const isHellImpWin = (
              isFairImpWin &&
              this.selfAtkMult <= 0.501 &&
              this.oppAtkMult >= 1.999
            );
            if (isFairImpWin) {
              unlockAchievement('beat_imp');
              if (this.rule === 'swap') unlockAchievement('beat_imp_swap');
              else if (this.selfStyle === 'tetris') unlockAchievement('beat_imp_tetris');
              else if (this.selfStyle === 'puyo') unlockAchievement('beat_imp_puyo');
            }
            if (isHellImpWin) {
              if (this.rule === 'swap') unlockAchievement('beat_imp_hell_swap');
              else if (this.selfStyle === 'tetris') unlockAchievement('beat_imp_hell_tetris');
              else if (this.selfStyle === 'puyo') unlockAchievement('beat_imp_hell_puyo');
            }
          }
        } else if (this.isSolo) {
          const sc = this.rule === 'swap' ? (this.selfTetris.score + this.selfPuyo.score) : this.getActiveBoard(true).score;
          earnedCoins = Math.min(50, Math.floor(sc / 800));
          if (earnedCoins === 0 && this.stats.pieces >= 10) earnedCoins = 5;
        }
      }
      if (earnedCoins > 0) {
        profile.coins = (profile.coins || 0) + earnedCoins;
        saveProfile(profile);
        renderProfileUI();
        setTimeout(() => sound.playSE('coinGet'), 380);
      }

      const badgesEl = document.getElementById('resSpecialBadges');
      badgesEl.innerHTML = '';
      if (isUpset) badgesEl.innerHTML += '<span class="result-special">🔥 UPSET! 格上撃破!</span>';
      if (rankChanged) {
        const txt = newRank.idx > oldRank.idx ? `⬆ RANK UP! (${newRank.name})` : `⬇ RANK DOWN (${newRank.name})`;
        badgesEl.innerHTML += `<span class="result-special" style="background:linear-gradient(135deg,#38bdf8,#a855f7);">${txt}</span>`;
      }
      if (earnedCoins > 0) {
        badgesEl.innerHTML += `<span class="result-special" style="background:linear-gradient(135deg,#eab308,#f59e0b);color:#1c1917;">🪙 +${earnedCoins} COINS GET!</span>`;
      }

      const rBox = document.getElementById('resRatingBox');
      if (this.isOnline && this.rated) {
        rBox.style.display = 'block';
        const deltaEl = document.getElementById('resRatingDelta');
        deltaEl.textContent = (delta >= 0 ? '+' : '') + delta;
        deltaEl.style.color = delta >= 0 ? '#4ade80' : '#f87171';
        const rb = document.getElementById('resRankBadge');
        rb.textContent = newRank.name; rb.className = `rank-badge ${newRank.cls}`;
        animateNumber(document.getElementById('resRatingNum'), oldRating, newRating, 900);
      } else {
        rBox.style.display = 'none';
      }

      if (!this.isSpectate) {
        const sc = this.rule === 'swap'
          ? (this.selfTetris.score + this.selfPuyo.score)
          : this.getActiveBoard(true).score;
        if (sc > (profile.records.bestEndlessScore || 0)) {
          profile.records.bestEndlessScore = sc;
          saveProfile(profile);
        }
      }
      if (this.isOnline) {
        net.send({ type: 'lbSync', lbRecord: buildPublicRecord() });
      }
      if (!this.isSpectate) syncCloudNow(true, false);
      saveLastReplaySnapshot();
      this.populateResultStats();
      document.getElementById('resRematchStatus').textContent = '';
      if (!this.isSpectate) {
        const baseXp = this.isSolo ? 25 : (won ? 75 : 30);
        const bonusXp = Math.min(60, (this.stats.maxChain || 0) * 6 + (this.stats.tSpins || 0) * 8 + Math.floor((this.stats.attack || 0) * 1.5));
        grantXP(baseXp + bonusXp);
      }
      const nextBtn = document.getElementById('btnNextTowerFloor');
      if (nextBtn) nextBtn.style.display = 'none';
      const seedBadge = document.getElementById('resSeedBadge');
      if (seedBadge) seedBadge.style.display = 'none';
      if (window.extras && typeof window.extras.onFinishMatch === 'function') {
        window.extras.onFinishMatch(this, won);
      }
      document.getElementById('btnRematch').disabled = false;
      document.getElementById('overlayResult').classList.add('active');
    }
  };

  function animateNumber(el, from, to, ms) {
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function startOnlineMatch(rule, rated, myStyle, oppInfo, targetWins = 2, puyoColors = 4, selfAtk = 100, oppAtk = 100) {
    document.getElementById('rankedSearchBox').classList.remove('active');
    document.getElementById('roomWaitBox').classList.remove('active');
    document.getElementById('overlayResult').classList.remove('active');
    sound.playSE('matchFound');

    const myRate = rule === 'skill' ? (profile.skillRating || 1500) : profile.rating;
    const myInfo = { name: profile.name, playerNo: profile.playerNo || null, rating: myRate, title: profile.activeTitle };
    battle.setupMatch({
      isOnline: true, isSolo: false, isCpu: false, isSpectate: false,
      rule, rated, targetWins, puyoColors, selfAtk, oppAtk,
      selfStyle: myStyle, oppStyle: oppInfo.style || 'tetris',
      selfInfo: myInfo,
      oppInfo
    });
    showVSMatchup(rule, rated, myStyle, oppInfo, targetWins, false, myInfo, () => battle.startCountdown());
  }

  function showVSMatchup(rule, rated, myStyle, oppInfo, targetWins, isSpectate, leftInfo, onDone) {
    const ov = document.getElementById('overlayVS');
    const ftTxt = targetWins > 1 ? `FT${targetWins}` : '1本勝負';
    document.getElementById('vsModeLabel').textContent =
      `${isSpectate ? 'AI SPECTATE' : (rated ? 'RANKED MATCH' : 'BATTLE')} — ${rule.toUpperCase()} (${ftTxt})`;

    document.getElementById('vsP1Tag').textContent = isSpectate ? 'LEFT CPU (P1)' : 'PLAYER 1 (YOU)';
    document.getElementById('vsP2Tag').textContent = isSpectate ? 'RIGHT CPU (P2)' : 'PLAYER 2';

    const myRank = getRankTier(leftInfo.rating);
    const opRank = getRankTier(oppInfo.rating);
    document.getElementById('vsP1Name').textContent = leftInfo.name;
    setTitleBadgeEl('vsP1Title', isSpectate ? '' : (leftInfo.title || ''));
    setPlayerIdBadgeEl('vsP1Pid', isSpectate ? null : (leftInfo.playerNo || null), false, true);
    document.getElementById('vsP1Rank').textContent = myRank.name;
    document.getElementById('vsP1Rank').className = `rank-badge ${myRank.cls}`;
    document.getElementById('vsP1Rating').textContent = `R ${leftInfo.rating}`;
    const s1 = document.getElementById('vsP1Style');
    s1.textContent = rule === 'swap' ? 'SWAP' : myStyle.toUpperCase();
    s1.className = 'style-pill' + (rule !== 'swap' && myStyle === 'puyo' ? ' puyo' : '');

    document.getElementById('vsP2Name').textContent = oppInfo.name;
    setTitleBadgeEl('vsP2Title', isSpectate ? '' : (oppInfo.title || ''));
    setPlayerIdBadgeEl('vsP2Pid', isSpectate ? null : (oppInfo.playerNo || null), false, true);
    document.getElementById('vsP2Rank').textContent = opRank.name;
    document.getElementById('vsP2Rank').className = `rank-badge ${opRank.cls}`;
    document.getElementById('vsP2Rating').textContent = `R ${oppInfo.rating}`;
    const s2 = document.getElementById('vsP2Style');
    const opSt = oppInfo.style || 'tetris';
    s2.textContent = rule === 'swap' ? 'SWAP' : opSt.toUpperCase();
    s2.className = 'style-pill' + (rule !== 'swap' && opSt === 'puyo' ? ' puyo' : '');

    const prev = calcEloPreview(leftInfo.rating, oppInfo.rating);
    const diffSign = prev.diff >= 0 ? '+' : '';
    if (rated && !isSpectate) {
      document.getElementById('vsDiffText').textContent = `相手レート差 ${diffSign}${prev.diff}`;
      if (targetWins === 2) {
        document.getElementById('vsWinDelta').textContent = `WIN: +${prev.win20}(2-0) / +${prev.win21}(2-1)`;
        document.getElementById('vsLoseDelta').textContent = `LOSE: ${prev.lose12}(1-2) / ${prev.lose02}(0-2)`;
      } else {
        document.getElementById('vsWinDelta').textContent = `WIN: +${prev.winDelta}`;
        document.getElementById('vsLoseDelta').textContent = `LOSE: ${prev.loseDelta}`;
      }
      document.getElementById('vsWinDelta').style.display = 'inline';
      document.getElementById('vsLoseDelta').style.display = 'inline';
    } else {
      document.getElementById('vsDiffText').textContent = isSpectate ? `AI vs AI 観戦 (${ftTxt})` : `FREE MATCH (${ftTxt})`;
      document.getElementById('vsWinDelta').style.display = 'none';
      document.getElementById('vsLoseDelta').style.display = 'none';
    }

    ov.classList.add('active');
    setTimeout(() => { ov.classList.remove('active'); onDone(); }, 2300);
  }

  /* =========================================================================
     10. INPUT HANDLER (CUSTOM KEY CONFIG + GAMEPAD API + DAS/ARR)
     ========================================================================= */
  let listeningKeyAction = null;

  const input = {
    keys: new Set(),
    padHeld: new Set(),
    touchHeld: new Set(),
    padPrev: {},
    horizDir: 0,
    dasTimer: 0,
    arrTimer: 0,

    getActionForKey(code) {
      const k = profile.settings.keys || DEFAULT_KEYS;
      for (const act of Object.keys(DEFAULT_KEYS)) {
        if (k[act] === code) return act;
      }
      const boundSet = new Set(Object.values(k));
      if (!boundSet.has(code)) {
        if (code === 'Space') return 'hard';
        if (code === 'KeyD') return 'cw';
        if (code === 'KeyA' || code === 'ControlLeft' || code === 'ControlRight') return 'ccw';
        if (code === 'ShiftLeft' || code === 'ShiftRight') return 'hold';
        if (code === 'Escape') return 'pause';
      }
      return null;
    },

    isActionDown(act) {
      if (this.padHeld.has(act) || this.touchHeld.has(act)) return true;
      for (const code of this.keys) {
        if (this.getActionForKey(code) === act) return true;
      }
      return false;
    },

    triggerActionPress(act) {
      if (typeof br99 !== 'undefined' && br99.isOpen) {
        if (act === 'pause') {
          if (!br99.isOnline && (br99.active || br99.paused) && !br99.ended) br99.togglePause();
          return;
        }
        if (act === 'retry') {
          if (!br99.isOnline) br99.startSolo();
          return;
        }
        if (!br99.active || br99.paused || br99.ended || !br99.selfBoard) return;
        if (act === 'left') { this.horizDir = -1; this.dasTimer = 0; this.arrTimer = 0; br99.selfBoard.move(-1, 0); }
        else if (act === 'right') { this.horizDir = 1; this.dasTimer = 0; this.arrTimer = 0; br99.selfBoard.move(1, 0); }
        else if (act === 'hard') { br99.selfBoard.hardDrop(); }
        else if (act === 'cw') { br99.selfBoard.rotate(1); }
        else if (act === 'ccw') { br99.selfBoard.rotate(-1); }
        else if (act === 'rot180') { br99.selfBoard.rotate180(); }
        else if (act === 'hold') { br99.selfBoard.doHold(); }
        return;
      }
      if (act === 'pause') {
        if ((battle.active || battle.paused) && !battle.isOnline && !battle.ended) togglePause();
        return;
      }
      if (act === 'retry') {
        if (!battle.isOnline && document.getElementById('screenBattle').classList.contains('active')) {
          quickRetryMatch();
        }
        return;
      }
      if (!battle.active || battle.paused || battle.ended || battle.isSpectate) return;
      if (act === 'undo') {
        battle.doPuyoUndo();
        return;
      }
      const board = battle.getActiveBoard(true);
      const style = battle.getActiveStyle(true);
      if (!board) return;

      if (act === 'left') {
        this.horizDir = -1; this.dasTimer = 0; this.arrTimer = 0;
        board.move(-1, 0);
      } else if (act === 'right') {
        this.horizDir = 1; this.dasTimer = 0; this.arrTimer = 0;
        board.move(1, 0);
      } else if (act === 'hard') {
        if (style === 'tetris') board.hardDrop();
      } else if (act === 'cw') {
        board.rotate(1);
      } else if (act === 'ccw') {
        board.rotate(-1);
      } else if (act === 'rot180') {
        if (style === 'tetris') board.rotate180();
      } else if (act === 'hold') {
        if (style === 'tetris') board.doHold();
      }
    },

    onKeyDown(e) {
      if (listeningKeyAction) {
        e.preventDefault();
        if (e.code === 'Escape') {
          listeningKeyAction = null;
          renderKeybindUI();
          return;
        }
        profile.settings.keys[listeningKeyAction] = e.code;
        saveProfile(profile);
        listeningKeyAction = null;
        renderKeybindUI();
        renderKeyGuides();
        sound.playSE('rotate');
        return;
      }

      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      sound.unlock();
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace'].includes(code)) {
        e.preventDefault();
      }

      if (code === 'Escape' && document.getElementById('overlayAuth').classList.contains('active')) {
        document.getElementById('overlayAuth').classList.remove('active');
        return;
      }
      if (code === 'Escape' && document.getElementById('overlayHandling').classList.contains('active')) {
        if (sound.isPreviewBgm) sound.stopBGM();
        document.getElementById('overlayHandling').classList.remove('active');
        return;
      }

      if (typeof br99 !== 'undefined' && br99.isOpen && br99.active && !br99.paused && !br99.ended) {
        if (code === 'Digit1' || code === 'Numpad1') { br99.setTactic('random'); return; }
        if (code === 'Digit2' || code === 'Numpad2') { br99.setTactic('ko'); return; }
        if (code === 'Digit3' || code === 'Numpad3') { br99.setTactic('badges'); return; }
        if (code === 'Digit4' || code === 'Numpad4') { br99.setTactic('attackers'); return; }
      }
      if (this.keys.has(code)) return;
      this.keys.add(code);
      if (battle.active && !battle.paused && !battle.ended && battle.rule === 'skill' && !battle.isSpectate && window.skillsBigBang) {
        if (code === 'Digit1') { window.skillsBigBang.tryUseSelfSkill(0, battle); return; }
        if (code === 'Digit2') { window.skillsBigBang.tryUseSelfSkill(1, battle); return; }
        if (code === 'Digit3') { window.skillsBigBang.tryUseSelfSkill(2, battle); return; }
      }
      const act = this.getActionForKey(code);
      if (act) this.triggerActionPress(act);
    },

    onKeyUp(e) {
      const code = e.code;
      const act = this.getActionForKey(code);
      this.keys.delete(code);
      if (act === 'left' && this.horizDir === -1) {
        this.horizDir = this.isActionDown('right') ? 1 : 0;
        this.dasTimer = 0; this.arrTimer = 0;
      } else if (act === 'right' && this.horizDir === 1) {
        this.horizDir = this.isActionDown('left') ? -1 : 0;
        this.dasTimer = 0; this.arrTimer = 0;
      }
    },

    pollGamepad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
      }
      document.getElementById('padBadge').classList.toggle('active', !!gp);
      if (!gp) {
        this.padHeld.clear();
        return;
      }

      const btn = (idx) => !!(gp.buttons[idx] && gp.buttons[idx].pressed);
      const axX = gp.axes[0] || 0;
      const axY = gp.axes[1] || 0;

      const cur = {
        left: btn(14) || axX < -0.45,
        right: btn(15) || axX > 0.45,
        down: btn(13) || axY > 0.5,
        hard: btn(12),
        cw: btn(0),
        ccw: btn(1),
        rot180: btn(2) || btn(3),
        hold: btn(4) || btn(5),
        pause: btn(9)
      };

      for (const act of Object.keys(cur)) {
        const nowOn = cur[act];
        const prevOn = !!this.padPrev[act];
        if (nowOn) this.padHeld.add(act);
        else this.padHeld.delete(act);

        if (nowOn && !prevOn) {
          sound.unlock();
          this.triggerActionPress(act);
        } else if (!nowOn && prevOn) {
          if (act === 'left' && this.horizDir === -1) {
            this.horizDir = this.isActionDown('right') ? 1 : 0;
            this.dasTimer = 0; this.arrTimer = 0;
          } else if (act === 'right' && this.horizDir === 1) {
            this.horizDir = this.isActionDown('left') ? -1 : 0;
            this.dasTimer = 0; this.arrTimer = 0;
          }
        }
        this.padPrev[act] = nowOn;
      }
    },

    update(dt) {
      if (this.horizDir === 0) return;
      const board = (typeof br99 !== 'undefined' && br99.isOpen) ? br99.selfBoard : battle.getActiveBoard(true);
      if (!board) return;
      const dasSec = (profile.settings.das ?? 150) / 1000;
      const arrMs = profile.settings.arr ?? 35;

      this.dasTimer += dt;
      if (this.dasTimer >= dasSec) {
        if (arrMs === 0) {
          while (board.move(this.horizDir, 0)) {}
        } else {
          const arrSec = arrMs / 1000;
          this.arrTimer += dt;
          while (this.arrTimer >= arrSec) {
            this.arrTimer -= arrSec;
            if (!board.move(this.horizDir, 0)) break;
          }
        }
      }
    }
  };

  window.addEventListener('keydown', (e) => input.onKeyDown(e));
  window.addEventListener('keyup', (e) => input.onKeyUp(e));

  /* =========================================================================
     11. UI WIRING, SETTINGS MODAL, KEY GUIDES & MAIN LOOP
     ========================================================================= */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function setupSegGroup(id, onChange) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.unlock();
        el.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onChange) onChange(btn.dataset.val);
      });
    });
  }

  function getSegVal(id) {
    const active = document.querySelector(`#${id} .seg-btn.active`);
    return active ? active.dataset.val : null;
  }

  function renderKeyGuides() {
    const k = profile.settings.keys || DEFAULT_KEYS;
    const html = [
      `<span><span class="kbd">${formatKeyCode(k.left)}</span><span class="kbd">${formatKeyCode(k.right)}</span> 移動</span>`,
      `<span><span class="kbd">${formatKeyCode(k.down)}</span> ソフトドロップ</span>`,
      `<span><span class="kbd">${formatKeyCode(k.hard)}</span> ハードドロップ(テトリス)</span>`,
      `<span><span class="kbd">${formatKeyCode(k.cw)}</span> 右回転</span>`,
      `<span><span class="kbd">${formatKeyCode(k.ccw)}</span> 左回転</span>`,
      `<span><span class="kbd">${formatKeyCode(k.rot180)}</span> 180°回転</span>`,
      `<span><span class="kbd">${formatKeyCode(k.hold)}</span> ホールド</span>`,
      `<span><span class="kbd">${formatKeyCode(k.undo)}</span> 1手戻す(ぷよ練習)</span>`,
      `<span><span class="kbd">${formatKeyCode(k.retry)}</span> リトライ</span>`,
      `<span><span class="kbd">${formatKeyCode(k.pause)}</span> ポーズ</span>`
    ].join('');
    document.getElementById('lobbyKeyGuide').innerHTML = html;
    document.getElementById('battleKeyGuide').innerHTML = html;
  }

  function renderKeybindUI() {
    const list = document.getElementById('keybindList');
    const k = profile.settings.keys || DEFAULT_KEYS;
    list.innerHTML = '';
    for (const act of Object.keys(DEFAULT_KEYS)) {
      const row = document.createElement('div');
      row.className = 'keybind-row';
      const lbl = document.createElement('span');
      lbl.textContent = KEY_LABELS[act];
      const btn = document.createElement('button');
      btn.className = 'keybind-btn' + (listeningKeyAction === act ? ' listening' : '');
      btn.textContent = listeningKeyAction === act ? 'キー入力待ち...' : formatKeyCode(k[act]);
      btn.addEventListener('click', () => {
        listeningKeyAction = (listeningKeyAction === act) ? null : act;
        renderKeybindUI();
      });
      row.appendChild(lbl);
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  function syncSettingsUI() {
    const das = profile.settings.das ?? 150;
    const arr = profile.settings.arr ?? 35;
    const rawSdf = String(profile.settings.sdf ?? '20');
    const sdf = rawSdf === 'inf' ? '40' : rawSdf;
    const bgmVol = profile.settings.bgmVol ?? 70;
    const seVol = profile.settings.seVol ?? 80;

    document.getElementById('rangeDas').value = das;
    document.getElementById('valDas').textContent = `${das} ms`;
    document.getElementById('rangeArr').value = arr;
    document.getElementById('valArr').textContent = arr === 0 ? '0 ms (瞬間移動)' : `${arr} ms`;
    document.getElementById('valSdf').textContent = `${sdf}x`;
    document.querySelectorAll('#sdfGroup .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === sdf));

    document.getElementById('rangeBgmVol').value = bgmVol;
    document.getElementById('valBgmVol').textContent = `${bgmVol}%`;
    document.getElementById('rangeSeVol').value = seVol;
    document.getElementById('valSeVol').textContent = `${seVol}%`;
    const bgmMode = profile.settings.bgmMode || 'auto';
    document.querySelectorAll('#bgmModeGroup .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === bgmMode));

    const cbVal = profile.settings.colorblind ? '1' : '0';
    document.querySelectorAll('#cbGroup .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === cbVal));

    renderKeybindUI();
    renderKeyGuides();
  }

  function updateSoloRecordBanner() {
    const val = getSegVal('soloTypeGroup');
    const banner = document.getElementById('soloRecordBanner');
    if (val === 'sprint40') {
      const best = profile.records.bestSprintMs;
      banner.textContent = best !== null
        ? `🏆 40ライン 自己ベストタイム: ${formatSprintTime(best)}`
        : '⏱ 40ラインを最速で消去しよう！（まだ記録なし）';
      banner.classList.add('active');
    } else if (val === 'ultra2m') {
      const best = profile.records.bestUltraScore || 0;
      banner.textContent = best > 0
        ? `🏆 2分間ウルトラ 自己ベストスコア: ${best.toLocaleString()}`
        : '⚡ 2分間でハイスコアを目指そう！（まだ記録なし）';
      banner.classList.add('active');
    } else if (val === 'cheese') {
      const b10 = profile.records.bestCheese10Ms;
      const b20 = profile.records.bestCheese20Ms;
      const t10 = b10 !== null && b10 !== undefined ? formatSprintTime(b10) : '未記録';
      const t20 = b20 !== null && b20 !== undefined ? formatSprintTime(b20) : '未記録';
      banner.textContent = `🧀 チーズレース自己ベスト — 10L: ${t10} / 20L: ${t20}`;
      banner.classList.add('active');
    } else if (val === 'bigbang_solo') {
      const bSc = (profile.records && profile.records.bestBigBangScore) || 0;
      const bCl = (profile.records && profile.records.bestBigBangClears) || 0;
      banner.textContent = bSc > 0
        ? `💥 ビッグバン練習 自己ベスト — チャージ: ${bSc.toLocaleString()} / 連続クリア: ${bCl}回`
        : '💥 60秒間のフィーバー連鎖＆ラッキーアタック連続クリアに挑戦しよう！';
      banner.classList.add('active');
    } else if (val === 'endless_puyo') {
      banner.textContent = '↩ とことんぷよぷよでは最大20手まで「1手戻し（Undo）」で連鎖練習ができます！';
      banner.classList.add('active');
    } else if (window.extras && typeof window.extras.updateSoloBanner === 'function' && window.extras.updateSoloBanner(val, banner)) {
      banner.classList.add('active');
    } else {
      banner.classList.remove('active');
    }
  }

  function renderProfileUI() {
    if (typeof updateBr99RecordBanner === 'function') updateBr99RecordBanner();
    document.getElementById('inputPlayerName').value = profile.name;
    document.getElementById('profRating').textContent = profile.rating;
    document.getElementById('profMaxRating').textContent = profile.maxRating;
    const rank = getRankTier(profile.rating);
    const rb = document.getElementById('profRankBadge');
    rb.textContent = rank.name; rb.className = `rank-badge ${rank.cls}`;
    document.getElementById('profWL').textContent = `${profile.wins}W - ${profile.losses}L`;
    const skRateEl = document.getElementById('profSkillRating');
    if (skRateEl) {
      const skR = profile.skillRating || 1500;
      skRateEl.textContent = skR;
      const skRank = getRankTier(skR);
      const skRb = document.getElementById('profSkillRankBadge');
      if (skRb) { skRb.textContent = skRank.name; skRb.className = `rank-badge ${skRank.cls}`; }
      const skWl = document.getElementById('profSkillWL');
      if (skWl) skWl.textContent = `${profile.skillWins || 0}W-${profile.skillLosses || 0}L`;
    }
    const total = profile.wins + profile.losses;
    document.getElementById('profWinRate').textContent = total > 0 ? `${Math.round(profile.wins / total * 100)}%` : '0%';
    document.getElementById('profStreak').textContent = `${profile.streak}連勝`;

    document.querySelectorAll('#favStyleGroup .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.val === profile.favStyle);
    });

    const histEl = document.getElementById('historyList');
    if (profile.history.length === 0) {
      histEl.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim);padding:10px;text-align:center;">まだ対戦履歴がありません</div>';
    } else {
      histEl.innerHTML = profile.history.map(h => {
        const dCls = h.delta > 0 ? 'delta-pos' : (h.delta < 0 ? 'delta-neg' : 'delta-zero');
        const dTxt = h.rated ? ((h.delta >= 0 ? '+' : '') + h.delta) : 'FREE';
        return `<div class="history-item ${h.result}">
          <div>
            <strong>${escapeHtml(h.oppName)}</strong>
            <span style="color:var(--text-dim);font-size:0.72rem;">(R${h.oppRating})</span>
            <div style="font-size:0.7rem;color:var(--text-dim);">${h.mode} | ${h.myStyle} vs ${h.oppStyle}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:900;color:${h.result === 'WIN' ? '#4ade80' : '#f87171'};">${h.result}</div>
            <div class="${dCls}">${dTxt}</div>
          </div>
        </div>`;
      }).join('');
    }
    ensureDailyMissions();
    setTitleBadgeEl('profTitleBadge', profile.activeTitle);
    const cTxt = `🪙 ${(profile.coins || 0).toLocaleString()}`;
    ['topCoinPill', 'shopCoinPill', 'achCoinPill', 'skillModalCoinPill'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = cTxt;
    });
    applyTheme(profile.activeTheme || 'neon');
    updateTopToggleButtons();
    syncSettingsUI();
    updateSoloRecordBanner();
    const lvVal = profile.level || 1;
    const xpVal = profile.xp || 0;
    const needXp = getXpForNextLevel(lvVal);
    const lvPct = lvVal >= 100 ? 100 : Math.min(100, Math.round((xpVal / needXp) * 100));
    const lvEl = document.getElementById('profLevelBadge');
    if (lvEl) lvEl.textContent = `Lv.${lvVal}`;
    const prEl = document.getElementById('profPrestigeBadge');
    if (prEl) {
      if ((profile.prestige || 0) > 0) {
        prEl.textContent = `★${profile.prestige}`;
        prEl.style.display = 'inline-flex';
      } else {
        prEl.style.display = 'none';
      }
    }
    const xpTxt = document.getElementById('profXpText');
    if (xpTxt) xpTxt.textContent = lvVal >= 100 ? 'MAX LEVEL!' : `${xpVal} / ${needXp} XP`;
    const xpBar = document.getElementById('profXpFill');
    if (xpBar) xpBar.style.width = `${lvPct}%`;
    const prestBtn = document.getElementById('btnPrestige');
    if (prestBtn) prestBtn.style.display = lvVal >= 100 ? 'inline-flex' : 'none';
    setPlayerIdBadgeEl('profPlayerIdBadge', profile.playerNo, true, false);
    const joinEl = document.getElementById('profJoinedAt');
    if (joinEl) {
      const jm = formatJoinedMonth(profile.joinedAt);
      joinEl.textContent = jm;
      joinEl.style.display = jm ? 'inline' : 'none';
    }
    if (window.extras && typeof window.extras.renderExtraProfileUI === 'function') {
      window.extras.renderExtraProfileUI();
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }

  function updateTopToggleButtons() {
    const bgmBtn = document.getElementById('btnBgmToggle');
    bgmBtn.textContent = profile.settings.bgm ? '🎵 BGM: ON' : '🎵 BGM: OFF';
    bgmBtn.classList.toggle('active', profile.settings.bgm);
    bgmBtn.classList.toggle('off', !profile.settings.bgm);

    const seBtn = document.getElementById('btnSeToggle');
    seBtn.textContent = profile.settings.se ? '🔊 SE: ON' : '🔊 SE: OFF';
    seBtn.classList.toggle('active', profile.settings.se);
    seBtn.classList.toggle('off', !profile.settings.se);
  }

  function togglePause() {
    if (typeof br99 !== 'undefined' && br99.isOpen) {
      br99.togglePause();
      return;
    }
    battle.paused = !battle.paused;
    document.getElementById('overlayPause').classList.toggle('active', battle.paused);
  }

  function returnToLobby() {
    battle.soloSubType = null;
    battle.zeroGravity = false;
    if (typeof br99 !== 'undefined' && br99.isOpen) { br99.exitToLobby(); }

    battle.active = false;
    battle.paused = false;
    battle.ended = true;
    battle.countdownActive = false;
    battle.roundIntermission = false;
    sound.stopBGM();
    net.cleanup();
    if (window.skillsBigBang) {
      if (window.skillsBigBang.bbState) window.skillsBigBang.bbState.active = false;
      if (window.skillsBigBang.skState) window.skillsBigBang.skState.active = false;
    }
    const cutinEl = document.getElementById('skillCutinBanner');
    if (cutinEl) cutinEl.classList.remove('active');
    const specialHudEl = document.getElementById('specialModeHud');
    if (specialHudEl) specialHudEl.classList.remove('active');
    const clashEl = document.getElementById('overlayBigBangClash');
    if (clashEl) clashEl.classList.remove('active');
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
    showScreen('screenLobby');
    renderProfileUI();
  }

  // Settings Modal Events
  document.querySelectorAll('#overlayHandling .set-tab[data-settab]').forEach(tab => {
    tab.addEventListener('click', () => {
      listeningKeyAction = null;
      document.querySelectorAll('#overlayHandling .set-tab[data-settab]').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#overlayHandling .set-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPane = document.getElementById('setpane-' + tab.dataset.settab);
      if (targetPane) targetPane.classList.add('active');
      renderKeybindUI();
    });
  });

  document.getElementById('btnHandlingModal').addEventListener('click', () => {
    sound.unlock();
    listeningKeyAction = null;
    syncSettingsUI();
    document.getElementById('overlayHandling').classList.add('active');
  });
  document.getElementById('btnCloseHandling').addEventListener('click', () => {
    listeningKeyAction = null;
    if (sound.isPreviewBgm) sound.stopBGM();
    saveProfile(profile);
    document.getElementById('overlayHandling').classList.remove('active');
    showToast('設定を保存しました');
  });
  setupSegGroup('bgmModeGroup', (val) => {
    profile.settings.bgmMode = val;
    saveProfile(profile);
    if (battle.active && !sound.isPreviewBgm) {
      sound.setBgmTrack(battle.getActiveStyle(true));
    }
  });
  document.getElementById('btnTestBgmTetris').addEventListener('click', () => {
    sound.startPreviewBGM('tetris');
    showToast('🎵 テトリスBGMを試聴中');
  });
  document.getElementById('btnTestBgmPuyo').addEventListener('click', () => {
    sound.startPreviewBGM('puyo');
    showToast('🎵 ぷよぷよBGMを試聴中');
  });
  document.getElementById('btnTestBgmStop').addEventListener('click', () => {
    sound.stopBGM();
    showToast('⏹ BGM試聴を停止しました');
  });
  document.getElementById('btnTestSeTetris').addEventListener('click', () => {
    sound.unlock();
    sound.playSE('tetris');
  });
  document.getElementById('btnTestSeChain').addEventListener('click', () => {
    sound.unlock();
    sound.playSE('puyoPop', 4);
  });
  document.getElementById('btnTestSeAllClear').addEventListener('click', () => {
    sound.unlock();
    sound.playSE('perfect');
  });
  document.getElementById('rangeDas').addEventListener('input', (e) => {
    profile.settings.das = parseInt(e.target.value, 10); syncSettingsUI();
  });
  document.getElementById('rangeArr').addEventListener('input', (e) => {
    profile.settings.arr = parseInt(e.target.value, 10); syncSettingsUI();
  });
  setupSegGroup('sdfGroup', (val) => { profile.settings.sdf = val; syncSettingsUI(); });
  setupSegGroup('cbGroup', (val) => {
    profile.settings.colorblind = val === '1';
    saveProfile(profile);
    syncSettingsUI();
  });

  // Shop UI (Themes & Block/Puyo Skins)
  let currentShopTab = 'themes';
  document.querySelectorAll('[data-shoptab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-shoptab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentShopTab = tab.dataset.shoptab;
      renderShopUI();
    });
  });

  function renderShopUI() {
    const grid = document.getElementById('shopGrid');
    const coins = profile.coins || 0;
    document.getElementById('shopCoinPill').textContent = `🪙 ${coins.toLocaleString()}`;
    const tab = currentShopTab;
    const isSkins = tab === 'skins';
    const isFx = tab === 'effects';
    const isSe = tab === 'sepacks';
    const catalog = isSkins ? Object.values(SKINS) : (isFx ? Object.values(EFFECTS) : (isSe ? Object.values(SE_PACKS) : Object.values(THEMES)));
    const owned = new Set(
      isSkins ? (profile.ownedSkins || ['classic'])
        : (isFx ? (profile.ownedEffects || ['default'])
        : (isSe ? (profile.ownedSePacks || ['chiptune']) : (profile.ownedThemes || ['neon'])))
    );
    const activeId = isSkins ? (profile.activeSkin || 'classic')
      : (isFx ? (profile.activeEffect || 'default')
      : (isSe ? (profile.activeSePack || 'chiptune') : (profile.activeTheme || 'neon')));
    const kindLabel = isSkins ? 'スキン' : (isFx ? 'エフェクト' : (isSe ? 'SEパック' : 'テーマ'));
    grid.innerHTML = '';

    catalog.forEach(item => {
      const isOwned = owned.has(item.id);
      const isEq = activeId === item.id;
      const card = document.createElement('div');
      card.className = 'theme-card' + (isEq ? ' equipped' : '');

      const swatchesHtml = item.swatches.map(c => `<span class="theme-swatch" style="background:${c};"></span>`).join('');
      const priceLabel = isOwned ? (isEq ? '装備中' : '所持済') : `🪙 ${item.price}`;

      card.innerHTML = `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <strong style="font-size:0.86rem;color:var(--text-main);">${item.name}</strong>
            <span style="font-size:0.74rem;font-weight:800;color:${isEq ? 'var(--cyan)' : '#fde047'};">${priceLabel}</span>
          </div>
          <div class="theme-swatches">${swatchesHtml}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);line-height:1.35;">${item.desc}</div>
        </div>
      `;

      const actionBtn = document.createElement('button');
      actionBtn.style.cssText = 'width:100%;padding:7px;font-size:0.78rem;';
      if (isEq) {
        actionBtn.className = 'btn btn-ghost';
        actionBtn.textContent = '✓ 装備中';
        actionBtn.disabled = true;
      } else if (isOwned) {
        actionBtn.className = 'btn btn-primary';
        actionBtn.textContent = '装備する';
        actionBtn.addEventListener('click', () => {
          sound.unlock();
          if (isSkins) profile.activeSkin = item.id;
          else if (isFx) profile.activeEffect = item.id;
          else if (isSe) profile.activeSePack = item.id;
          else { profile.activeTheme = item.id; applyTheme(item.id); }
          saveProfile(profile);
          if (isSe) sound.playSE('tetris');
          else sound.playSE('rotate');
          if (isFx) spawnClearEffect(true, 2, item.swatches[0], card.getBoundingClientRect());
          renderShopUI();
          showToast(`${kindLabel}「${item.name}」を装備しました`);
        });
      } else {
        const canAfford = coins >= item.price;
        actionBtn.className = canAfford ? 'btn btn-green' : 'btn btn-ghost';
        actionBtn.textContent = canAfford ? `🛒 購入する (🪙 ${item.price})` : `コイン不足 (🪙 ${item.price})`;
        actionBtn.disabled = !canAfford;
        actionBtn.addEventListener('click', () => {
          if ((profile.coins || 0) < item.price) return;
          sound.unlock();
          profile.coins -= item.price;
          if (isSkins) {
            profile.ownedSkins = Array.from(new Set([...(profile.ownedSkins || ['classic']), item.id]));
            profile.activeSkin = item.id;
          } else if (isFx) {
            profile.ownedEffects = Array.from(new Set([...(profile.ownedEffects || ['default']), item.id]));
            profile.activeEffect = item.id;
          } else if (isSe) {
            profile.ownedSePacks = Array.from(new Set([...(profile.ownedSePacks || ['chiptune']), item.id]));
            profile.activeSePack = item.id;
          } else {
            profile.ownedThemes = Array.from(new Set([...(profile.ownedThemes || ['neon']), item.id]));
            profile.activeTheme = item.id;
            applyTheme(item.id);
          }
          saveProfile(profile);
          unlockAchievement('first_shop');
          if ((profile.ownedThemes || []).length >= 5) unlockAchievement('themes5');
          if ((profile.ownedSkins || []).length >= Object.keys(SKINS).length) unlockAchievement('skins_all');
          if (isFx && item.id !== 'default') unlockAchievement('buy_effect');
          if (isSe && item.id !== 'chiptune') unlockAchievement('buy_sepack');
          renderProfileUI();
          renderShopUI();
          sound.playSE(isSe ? 'tetris' : 'shopBuy');
          if (isFx) spawnClearEffect(true, 2, item.swatches[0], card.getBoundingClientRect());
          showToast(`${kindLabel}「${item.name}」を購入＆装備しました！`);
        });
      }
      card.appendChild(actionBtn);
      grid.appendChild(card);
    });
  }

  document.getElementById('btnShopModal').addEventListener('click', () => {
    sound.unlock(); renderShopUI();
    document.getElementById('overlayShop').classList.add('active');
  });
  document.getElementById('btnCloseShop').addEventListener('click', () => {
    document.getElementById('overlayShop').classList.remove('active');
  });

  // Achievements & Daily Missions Modal
  let currentAchTab = 'ach';
  let currentAchCat = 'all';
  document.querySelectorAll('[data-achtab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-achtab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentAchTab = tab.dataset.achtab;
      renderAchModalUI();
    });
  });

  function renderAchModalUI() {
    ensureDailyMissions();
    const list = document.getElementById('achModalList');
    document.getElementById('achCoinPill').textContent = `🪙 ${(profile.coins || 0).toLocaleString()}`;
    list.innerHTML = '';

    if (currentAchTab === 'ach') {
      if (fbUser && SPECIAL_REN_UIDS.has(fbUser.uid)) {
        const isEqRen = profile.activeTitle === 'special_ren';
        const renCard = document.createElement('div');
        renCard.className = 'ach-card ' + (isEqRen ? 'equipped' : 'unlocked');
        renCard.innerHTML = `
          <div>
            <div style="font-size:0.86rem;font-weight:900;color:var(--text-main);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              🖤 特別限定称号《REN》
              <span class="title-badge active title-special-ren">《REN》</span>
            </div>
            <div style="font-size:0.74rem;color:var(--text-dim);margin-top:2px;">特定ユーザー専用の漆黒スペシャル称号</div>
          </div>
        `;
        const renBtn = document.createElement('button');
        renBtn.style.cssText = 'padding:6px 10px;font-size:0.74rem;white-space:nowrap;';
        if (isEqRen) {
          renBtn.className = 'btn btn-danger'; renBtn.textContent = '外す';
          renBtn.addEventListener('click', () => {
            profile.activeTitle = ''; saveProfile(profile); renderProfileUI(); renderAchModalUI();
          });
        } else {
          renBtn.className = 'btn btn-primary'; renBtn.textContent = '称号を装備';
          renBtn.addEventListener('click', () => {
            sound.unlock(); sound.playSE('rotate');
            profile.activeTitle = 'special_ren'; saveProfile(profile); renderProfileUI(); renderAchModalUI();
            showToast('称号《REN》を装備しました');
          });
        }
        renCard.appendChild(renBtn);
        list.appendChild(renCard);
      }

      if (fbUser && ADMIN_UIDS.has(fbUser.uid)) {
        const isEqAdm = profile.activeTitle === 'admin';
        const admCard = document.createElement('div');
        admCard.className = 'ach-card ' + (isEqAdm ? 'equipped' : 'unlocked');
        admCard.innerHTML = `
          <div>
            <div style="font-size:0.86rem;font-weight:900;color:var(--cyan);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              👑 管理者限定称号
              <span class="title-badge active title-admin-rainbow">《ADMIN》</span>
            </div>
            <div style="font-size:0.74rem;color:var(--text-dim);margin-top:2px;">開発者・管理者アカウント専用の特別称号</div>
          </div>
        `;
        const admBtn = document.createElement('button');
        admBtn.style.cssText = 'padding:6px 10px;font-size:0.74rem;white-space:nowrap;';
        if (isEqAdm) {
          admBtn.className = 'btn btn-danger'; admBtn.textContent = '外す';
          admBtn.addEventListener('click', () => {
            profile.activeTitle = ''; saveProfile(profile); renderProfileUI(); renderAchModalUI();
          });
        } else {
          admBtn.className = 'btn btn-primary'; admBtn.textContent = '称号を装備';
          admBtn.addEventListener('click', () => {
            sound.unlock(); sound.playSE('rotate');
            profile.activeTitle = 'admin'; saveProfile(profile); renderProfileUI(); renderAchModalUI();
            showToast('称号《ADMIN》を装備しました');
          });
        }
        admCard.appendChild(admBtn);
        list.appendChild(admCard);
      }

      const unlocked = new Set(profile.achievements || []);
      const totalCount = ACHIEVEMENTS.length;
      const unlockedCount = ACHIEVEMENTS.filter(a => unlocked.has(a.id)).length;
      const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

      // 達成率サマリー＆プログレスバー
      const summaryBox = document.createElement('div');
      summaryBox.style.cssText = 'background:var(--card-sub-bg);border:1px solid var(--border-glow);border-radius:10px;padding:10px 12px;margin-bottom:8px;';
      summaryBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;font-weight:800;color:var(--text-main);">
          <span>🏅 達成状況: ${unlockedCount} / ${totalCount} (${pct}%)</span>
          <span style="font-size:0.72rem;color:var(--text-dim);">所持称号: ${unlockedCount}種</span>
        </div>
        <div class="prog-track" style="margin-top:6px;"><div class="prog-fill" style="width:${pct}%;"></div></div>
      `;
      list.appendChild(summaryBox);

      // カテゴリ絞り込みボタン
      const filterBar = document.createElement('div');
      filterBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;';
      const catLabelMap = {};
      ACH_CATEGORIES.forEach(c => { catLabelMap[c.id] = c.label; });
      ACH_CATEGORIES.forEach(cat => {
        const catItems = cat.id === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => a.cat === cat.id);
        const catUnl = catItems.filter(a => unlocked.has(a.id)).length;
        const fBtn = document.createElement('button');
        const active = currentAchCat === cat.id;
        fBtn.className = active ? 'btn btn-primary' : 'btn btn-ghost';
        fBtn.style.cssText = 'padding:5px 10px;font-size:0.72rem;border-radius:999px;';
        fBtn.textContent = `${cat.label} (${catUnl}/${catItems.length})`;
        fBtn.addEventListener('click', () => {
          currentAchCat = cat.id;
          renderAchModalUI();
        });
        filterBar.appendChild(fBtn);
      });
      list.appendChild(filterBar);

      const filtered = currentAchCat === 'all'
        ? ACHIEVEMENTS.slice()
        : ACHIEVEMENTS.filter(a => a.cat === currentAchCat);
      filtered.sort((a, b) => {
        const score = (x) => (profile.activeTitle === x.id ? 2 : (unlocked.has(x.id) ? 1 : 0));
        return score(b) - score(a);
      });

      filtered.forEach(a => {
        const isUnl = unlocked.has(a.id);
        const isEq = profile.activeTitle === a.id;
        const card = document.createElement('div');
        card.className = 'ach-card' + (isEq ? ' equipped' : (isUnl ? ' unlocked' : ''));
        const catTag = currentAchCat === 'all' && catLabelMap[a.cat]
          ? `<span style="font-size:0.65rem;padding:1px 6px;border-radius:999px;background:rgba(148,163,184,0.18);color:var(--text-dim);margin-left:6px;">${catLabelMap[a.cat]}</span>`
          : '';
        card.innerHTML = `
          <div>
            <div style="font-size:0.86rem;font-weight:900;color:${isUnl ? 'var(--text-main)' : 'var(--text-dim)'};">
              ${isUnl ? '🏅' : '🔒'} ${a.name}${catTag}
              <span style="font-size:0.72rem;color:#fde047;margin-left:6px;">称号:《${a.title}》 / +${a.coins}🪙</span>
            </div>
            <div style="font-size:0.74rem;color:var(--text-dim);margin-top:2px;">${a.desc}</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.style.cssText = 'padding:6px 10px;font-size:0.74rem;white-space:nowrap;';
        if (!isUnl) {
          btn.className = 'btn btn-ghost'; btn.textContent = '未解除'; btn.disabled = true;
        } else if (isEq) {
          btn.className = 'btn btn-danger'; btn.textContent = '外す';
          btn.addEventListener('click', () => {
            profile.activeTitle = ''; saveProfile(profile); renderProfileUI(); renderAchModalUI();
          });
        } else {
          btn.className = 'btn btn-primary'; btn.textContent = '称号を装備';
          btn.addEventListener('click', () => {
            sound.unlock(); sound.playSE('rotate');
            profile.activeTitle = a.id; saveProfile(profile); renderProfileUI(); renderAchModalUI();
            showToast(`称号《${a.title}》を装備しました`);
          });
        }
        card.appendChild(btn);
        list.appendChild(card);
      });
    } else if (currentAchTab === 'weekly') {
      ensureWeeklyMissions();
      const hdr = document.createElement('div');
      hdr.style.cssText = 'font-size:0.74rem;color:var(--text-dim);margin-bottom:8px;padding:6px 10px;border-radius:8px;background:var(--card-sub-bg);border:1px solid var(--border-glow);';
      hdr.textContent = `📆 対象週: ${profile.weekly.weekKey}（毎週月曜リセット・大型報酬）`;
      list.appendChild(hdr);
      profile.weekly.missions.forEach(m => {
        const def = WEEKLY_POOL.find(d => d.id === m.id);
        if (!def) return;
        const pct = Math.min(100, Math.round((m.progress / def.goal) * 100));
        const done = m.progress >= def.goal;
        const card = document.createElement('div');
        card.className = 'ach-card' + (done ? ' unlocked' : '');
        card.innerHTML = `
          <div style="flex:1;">
            <div style="font-size:0.86rem;font-weight:800;color:var(--text-main);">
              📆 ${def.name}
              <span style="font-size:0.74rem;color:#fde047;margin-left:6px;">+${def.coins}🪙 / +${def.xp}XP</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">進捗: ${m.progress} / ${def.goal}</div>
            <div class="prog-track"><div class="prog-fill" style="width:${pct}%;"></div></div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.style.cssText = 'padding:7px 11px;font-size:0.76rem;white-space:nowrap;';
        if (m.claimed) {
          btn.className = 'btn btn-ghost'; btn.textContent = '✅ 受取済'; btn.disabled = true;
        } else if (done) {
          btn.className = 'btn btn-green'; btn.textContent = '報酬受取';
          btn.addEventListener('click', () => {
            sound.unlock(); sound.playSE('coinGet');
            m.claimed = true;
            profile.coins = (profile.coins || 0) + def.coins;
            saveProfile(profile);
            grantXP(def.xp);
            unlockAchievement('weekly_done');
            renderProfileUI();
            renderAchModalUI();
            showToast(`📆 ウィークリー報酬 +${def.coins}🪙 / +${def.xp}XP を獲得！`);
          });
        } else {
          btn.className = 'btn btn-ghost'; btn.textContent = '進行中'; btn.disabled = true;
        }
        card.appendChild(btn);
        list.appendChild(card);
      });
    } else {
      profile.daily.missions.forEach(m => {
        const def = DAILY_POOL.find(d => d.id === m.id);
        if (!def) return;
        const pct = Math.min(100, Math.round((m.progress / def.goal) * 100));
        const done = m.progress >= def.goal;
        const card = document.createElement('div');
        card.className = 'ach-card' + (done ? ' unlocked' : '');
        card.innerHTML = `
          <div style="flex:1;">
            <div style="font-size:0.86rem;font-weight:800;color:var(--text-main);">
              📅 ${def.name}
              <span style="font-size:0.74rem;color:#fde047;margin-left:6px;">+${def.coins}🪙</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">進捗: ${m.progress} / ${def.goal}</div>
            <div class="prog-track"><div class="prog-fill" style="width:${pct}%;"></div></div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.style.cssText = 'padding:7px 11px;font-size:0.76rem;white-space:nowrap;';
        if (m.claimed) {
          btn.className = 'btn btn-ghost'; btn.textContent = '✅ 受取済'; btn.disabled = true;
        } else if (done) {
          btn.className = 'btn btn-green'; btn.textContent = `🪙 受取る`;
          btn.addEventListener('click', () => {
            sound.unlock();
            m.claimed = true;
            profile.coins = (profile.coins || 0) + def.coins;
            saveProfile(profile);
            sound.playSE('coinGet');
            renderProfileUI();
            renderAchModalUI();
            showToast(`デイリー報酬 +${def.coins}🪙 を受け取りました！`);
          });
        } else {
          btn.className = 'btn btn-ghost'; btn.textContent = '進行中'; btn.disabled = true;
        }
        card.appendChild(btn);
        list.appendChild(card);
      });
    }
  }

  document.getElementById('btnAchModal').addEventListener('click', () => {
    sound.unlock(); renderAchModalUI();
    document.getElementById('overlayAch').classList.add('active');
  });
  document.getElementById('btnCloseAch').addEventListener('click', () => {
    document.getElementById('overlayAch').classList.remove('active');
  });

  // Real-Players-Only Leaderboard Modal
  let currentLbTab = 'rating';
  document.querySelectorAll('[data-lbtab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-lbtab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentLbTab = tab.dataset.lbtab;
      renderLeaderboardUI();
    });
  });

  function renderLeaderboardUI() {
    const selfRec = { ...buildPublicRecord(), uid: fbUser ? fbUser.uid : '', isSelf: true };
    let entries;
    const srcNote = document.getElementById('lbSourceNote');
    if (fbReady && Array.isArray(fbLeaderboardCache)) {
      const others = fbLeaderboardCache
        .filter(p => !(fbUser && p.uid === fbUser.uid) && !(p.deviceId && p.deviceId === DEVICE_ID))
        .map(p => ({ ...p, isSelf: false }));
      entries = [selfRec, ...others];
      if (srcNote) srcNote.textContent = '🌐 全国リアルタイムランキング（Cloud Firestore 上位50件・ログイン中の試合結果が自動反映されます）';
    } else {
      entries = [selfRec, ...remoteLeaderboard.map(p => ({ ...p, isSelf: false }))];
      if (srcNote) srcNote.textContent = 'オンライン対戦（ランクマッチ・ルーム対戦）を行うと、対戦したプレイヤーの記録が自動で追加されます。';
    }

    if (currentLbTab === 'rating') {
      entries.sort((a, b) => (b.rating - a.rating) || (b.wins - a.wins));
    } else if (currentLbTab === 'skill') {
      entries.sort((a, b) => ((b.skillRating || 1500) - (a.skillRating || 1500)) || ((b.skillWins || 0) - (a.skillWins || 0)));
    } else if (currentLbTab === 'sprint') {
      entries.sort((a, b) => {
        const aHas = typeof a.bestSprintMs === 'number' && a.bestSprintMs > 0;
        const bHas = typeof b.bestSprintMs === 'number' && b.bestSprintMs > 0;
        if (aHas && bHas) return a.bestSprintMs - b.bestSprintMs;
        if (aHas) return -1;
        if (bHas) return 1;
        return b.rating - a.rating;
      });
    } else if (currentLbTab === 'ultra') {
      entries.sort((a, b) => (b.bestUltraScore - a.bestUltraScore) || (b.rating - a.rating));
    } else if (currentLbTab === 'cheese') {
      entries.sort((a, b) => {
        const a10 = typeof a.bestCheese10Ms === 'number' && a.bestCheese10Ms > 0;
        const b10 = typeof b.bestCheese10Ms === 'number' && b.bestCheese10Ms > 0;
        if (a10 && b10) return a.bestCheese10Ms - b.bestCheese10Ms;
        if (a10) return -1;
        if (b10) return 1;
        const a20 = typeof a.bestCheese20Ms === 'number' && a.bestCheese20Ms > 0;
        const b20 = typeof b.bestCheese20Ms === 'number' && b.bestCheese20Ms > 0;
        if (a20 && b20) return a.bestCheese20Ms - b.bestCheese20Ms;
        if (a20) return -1;
        if (b20) return 1;
        return b.rating - a.rating;
      });
    } else if (currentLbTab === 'br99') {
      entries.sort((a, b) => {
        const wDiff = (b.br99Wins || 0) - (a.br99Wins || 0);
        if (wDiff !== 0) return wDiff;
        const aR = (typeof a.bestBr99Rank === 'number' && a.bestBr99Rank >= 1) ? a.bestBr99Rank : 999;
        const bR = (typeof b.bestBr99Rank === 'number' && b.bestBr99Rank >= 1) ? b.bestBr99Rank : 999;
        if (aR !== bR) return aR - bR;
        return b.rating - a.rating;
      });
    } else {
      entries.sort((a, b) => (b.maxChain - a.maxChain) || (b.bestEndlessScore - a.bestEndlessScore));
    }

    document.getElementById('lbCountText').textContent = `登録: ${entries.length}人`;
    const listEl = document.getElementById('lbList');
    listEl.innerHTML = '';

    let myRankPos = 1;
    entries.forEach((p, idx) => {
      const pos = idx + 1;
      if (p.isSelf) myRankPos = pos;
      const medal = pos === 1 ? '🥇' : (pos === 2 ? '🥈' : (pos === 3 ? '🥉' : `#${pos}`));
      const rCls = pos <= 3 ? ` rank${pos}` : '';
      const selfCls = p.isSelf ? ' is-self' : '';
      const tier = getRankTier(currentLbTab === 'skill' ? (p.skillRating || 1500) : p.rating);
      const titleTxt = getTitleName(p.title);
      const titleExtraCls = getTitleBadgeClass(p.title);

      let metricHtml = '';
      if (currentLbTab === 'rating') {
        metricHtml = `<div style="font-family:monospace;font-size:1.05rem;font-weight:900;color:var(--text-main);">R ${p.rating}</div>
          <div style="font-size:0.7rem;color:var(--text-dim);">${p.wins}W - ${p.losses}L</div>`;
      } else if (currentLbTab === 'skill') {
        metricHtml = `<div style="font-family:monospace;font-size:1.05rem;font-weight:900;color:#c084fc;">⚡ R ${p.skillRating || 1500}</div>
          <div style="font-size:0.7rem;color:var(--text-dim);">${p.skillWins || 0}W - ${p.skillLosses || 0}L</div>`;
      } else if (currentLbTab === 'sprint') {
        const tStr = (typeof p.bestSprintMs === 'number' && p.bestSprintMs > 0) ? formatSprintTime(p.bestSprintMs) : '--:--.--';
        metricHtml = `<div style="font-family:monospace;font-size:1.02rem;font-weight:900;color:#38bdf8;">${tStr}</div>
          <div style="font-size:0.68rem;color:var(--text-dim);">40L SPRINT</div>`;
      } else if (currentLbTab === 'ultra') {
        metricHtml = `<div style="font-family:monospace;font-size:1.02rem;font-weight:900;color:#fde047;">${(p.bestUltraScore || 0).toLocaleString()}</div>
          <div style="font-size:0.68rem;color:var(--text-dim);">2MIN ULTRA</div>`;
      } else if (currentLbTab === 'cheese') {
        const t10 = (typeof p.bestCheese10Ms === 'number' && p.bestCheese10Ms > 0) ? formatSprintTime(p.bestCheese10Ms) : '--:--.--';
        const t20 = (typeof p.bestCheese20Ms === 'number' && p.bestCheese20Ms > 0) ? formatSprintTime(p.bestCheese20Ms) : '--:--.--';
        metricHtml = `<div style="font-family:monospace;font-size:1.02rem;font-weight:900;color:var(--gold);">10L ${t10}</div>
          <div style="font-size:0.68rem;color:var(--text-dim);">20L ${t20}</div>`;
      } else if (currentLbTab === 'br99') {
        const bRank = (typeof p.bestBr99Rank === 'number' && p.bestBr99Rank >= 1) ? `#${p.bestBr99Rank}` : '--';
        metricHtml = `<div style="font-family:monospace;font-size:1.02rem;font-weight:900;color:var(--gold);">👑 ${p.br99Wins || 0}勝</div>
          <div style="font-size:0.68rem;color:var(--text-dim);">最高 ${bRank} / 99</div>`;
      } else {
        metricHtml = `<div style="font-family:monospace;font-size:1rem;font-weight:900;color:#f472b6;">${p.maxChain || 0}連鎖</div>
          <div style="font-size:0.7rem;color:var(--gold);">MAX ${(p.bestEndlessScore || 0).toLocaleString()}</div>`;
      }

      const row = document.createElement('div');
      row.className = `lb-row${rCls}${selfCls}`;
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <div class="lb-rank-num">${medal}</div>
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
              <strong style="font-size:0.9rem;color:var(--text-main);">${escapeHtml(p.name)}</strong>
              ${renderPlayerIdBadgeHtml(p.playerNo, false, true)}
              <span class="lb-tag${p.isSelf ? '' : ' online'}">${p.isSelf ? 'YOU' : 'ONLINE'}</span>
              ${titleTxt ? `<span class="title-badge active ${titleExtraCls}">《${escapeHtml(titleTxt)}》</span>` : ''}
              <span class="rank-badge ${tier.cls}">${tier.name}</span>
            </div>
          </div>
        </div>
        <div style="text-align:right;white-space:nowrap;">${metricHtml}</div>
      `;
      listEl.appendChild(row);
    });

    const catLabel = { rating: 'レート', skill: 'スキルレート', sprint: '40ライン', ultra: '2分間ウルトラ', cheese: 'チーズレース', br99: 'TETRIS 99', chain: '最大連鎖 / スコア' }[currentLbTab];
    document.getElementById('lbSummaryBar').innerHTML =
      `<span>あなたの順位（${catLabel}）: <strong style="color:var(--cyan);font-family:monospace;">#${myRankPos} / ${entries.length}</strong></span>` +
      `<span style="font-size:0.74rem;color:var(--text-dim);">実プレイヤーのみ集計</span>`;
  }

  document.getElementById('btnLeaderboardModal').addEventListener('click', () => {
    sound.unlock();
    renderLeaderboardUI();
    document.getElementById('overlayLeaderboard').classList.add('active');
    if (fbReady && fbDb) {
      fetchCloudLeaderboard().then(() => renderLeaderboardUI());
    }
  });
  document.getElementById('btnCloseLeaderboard').addEventListener('click', () => {
    document.getElementById('overlayLeaderboard').classList.remove('active');
  });
  document.getElementById('presetStd').addEventListener('click', () => {
    profile.settings.das = 150; profile.settings.arr = 35; profile.settings.sdf = '20';
    saveProfile(profile); syncSettingsUI();
  });
  document.getElementById('presetFast').addEventListener('click', () => {
    profile.settings.das = 110; profile.settings.arr = 10; profile.settings.sdf = '40';
    saveProfile(profile); syncSettingsUI();
  });
  document.getElementById('presetUltra').addEventListener('click', () => {
    profile.settings.das = 85; profile.settings.arr = 0; profile.settings.sdf = '40';
    saveProfile(profile); syncSettingsUI();
  });
  document.getElementById('btnResetKeys').addEventListener('click', () => {
    listeningKeyAction = null;
    profile.settings.keys = { ...DEFAULT_KEYS };
    saveProfile(profile);
    syncSettingsUI();
    showToast('キー設定をデフォルトに戻しました');
  });
  document.getElementById('rangeBgmVol').addEventListener('input', (e) => {
    profile.settings.bgmVol = parseInt(e.target.value, 10);
    saveProfile(profile); syncSettingsUI();
  });
  document.getElementById('rangeSeVol').addEventListener('input', (e) => {
    profile.settings.seVol = parseInt(e.target.value, 10);
    saveProfile(profile); syncSettingsUI();
    sound.playSE('move');
  });

  // Stealth 7-tap Admin Trigger on #brandHomeBtn (Firebase Admin UID gated)
  const ADMIN_UIDS = new Set(['0XPmX9UXTkUkEZ186zu1nMZjdUB3']);
  let admTapTimes = [];

  function refreshAdmBattleControls() {
    const online = battle.isOnline;
    const inBattle = document.getElementById('screenBattle').classList.contains('active') && !battle.ended;
    const note = document.getElementById('admBattleNote');
    note.textContent = online ? '(オンライン対戦中は無効)' : (inBattle ? '(オフライン試合中: 有効)' : '(オフライン試合開始後に有効)');
    ['admGarbSelf', 'admGarbOpp', 'admSwap55', 'admForceWin', 'admForceKO', 'admPuyoStair'].forEach(id => {
      document.getElementById(id).disabled = online || !inBattle;
    });
    document.querySelectorAll('[data-adm-queue]').forEach(b => {
      b.disabled = online;
      b.classList.toggle('active', b.dataset.admQueue === admQueueMode);
    });
  }

  document.getElementById('brandHomeBtn').addEventListener('click', () => {
    if (!fbUser || !ADMIN_UIDS.has(fbUser.uid)) {
      admTapTimes = [];
      return;
    }
    const now = performance.now();
    admTapTimes.push(now);
    admTapTimes = admTapTimes.filter(t => now - t <= 2500);
    if (admTapTimes.length >= 7) {
      admTapTimes = [];
      document.getElementById('admResetConfirmRow').style.display = 'none';
      document.getElementById('admRateInput').value = profile.rating;
      refreshAdmBattleControls();
      document.getElementById('overlayAdmPanel').classList.add('active');
    }
  });
  document.getElementById('btnAdmClose').addEventListener('click', () => {
    document.getElementById('overlayAdmPanel').classList.remove('active');
  });

  document.getElementById('admCoin1k').addEventListener('click', () => {
    profile.coins = (profile.coins || 0) + 1000; saveProfile(profile); renderProfileUI();
  });
  document.getElementById('admCoin10k').addEventListener('click', () => {
    profile.coins = (profile.coins || 0) + 10000; saveProfile(profile); renderProfileUI();
  });
  document.getElementById('admCoin0').addEventListener('click', () => {
    profile.coins = 0; saveProfile(profile); renderProfileUI();
  });
  document.getElementById('admUnlockShop').addEventListener('click', () => {
    profile.ownedThemes = Object.keys(THEMES);
    profile.ownedSkins = Object.keys(SKINS);
    profile.ownedEffects = Object.keys(EFFECTS);
    profile.ownedSePacks = Object.keys(SE_PACKS);
    saveProfile(profile); renderProfileUI();
  });
  document.getElementById('admUnlockAch').addEventListener('click', () => {
    profile.achievements = ACHIEVEMENTS.map(a => a.id);
    saveProfile(profile); renderProfileUI();
  });
  document.getElementById('admDailyComplete').addEventListener('click', () => {
    ensureDailyMissions();
    profile.daily.missions.forEach(m => {
      const def = DAILY_POOL.find(d => d.id === m.id);
      if (def) m.progress = def.goal;
    });
    saveProfile(profile); updateDailyNotifDot(); renderProfileUI();
  });
  document.getElementById('admDailyReset').addEventListener('click', () => {
    profile.daily = { date: '', missions: [] };
    ensureDailyMissions(); renderProfileUI();
  });

  document.querySelectorAll('[data-adm-rate]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = parseInt(btn.dataset.admRate, 10);
      profile.rating = r;
      if (r > profile.maxRating) profile.maxRating = r;
      document.getElementById('admRateInput').value = r;
      saveProfile(profile); renderProfileUI();
    });
  });
  document.getElementById('admRateApply').addEventListener('click', () => {
    const r = Math.max(0, parseInt(document.getElementById('admRateInput').value, 10) || 0);
    profile.rating = r;
    if (r > profile.maxRating) profile.maxRating = r;
    saveProfile(profile); renderProfileUI();
  });
  document.getElementById('admResetAll').addEventListener('click', () => {
    document.getElementById('admResetConfirmRow').style.display = 'flex';
  });
  document.getElementById('admResetNo').addEventListener('click', () => {
    document.getElementById('admResetConfirmRow').style.display = 'none';
  });
  document.getElementById('admResetYes').addEventListener('click', () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { localStorage.removeItem(LEADERBOARD_KEY); } catch (e) {}
    remoteLeaderboard = [];
    admQueueMode = 'normal';
    profile = loadProfile();
    saveProfile(profile);
    document.getElementById('admResetConfirmRow').style.display = 'none';
    document.getElementById('overlayAdmPanel').classList.remove('active');
    renderProfileUI();
  });

  document.getElementById('admGarbSelf').addEventListener('click', () => {
    if (battle.isOnline || !battle.selfTetris) return;
    const st = battle.getActiveStyle(true);
    battle.getActiveBoard(true).receiveGarbage(st === 'tetris' ? 4 : 30);
    battle.render();
  });
  document.getElementById('admGarbOpp').addEventListener('click', () => {
    if (battle.isOnline || battle.isSolo || !battle.oppTetris) return;
    const st = battle.getActiveStyle(false);
    battle.getActiveBoard(false).receiveGarbage(st === 'tetris' ? 4 : 30);
    battle.render();
  });
  document.getElementById('admSwap55').addEventListener('click', () => {
    if (battle.isOnline || battle.rule !== 'swap') return;
    battle.swapTimer = 5.5;
    battle.lastSwapSecInt = 6;
    document.getElementById('swapTimerVal').textContent = '5.5s';
  });
  document.getElementById('admForceWin').addEventListener('click', () => {
    if (battle.isOnline || battle.ended) return;
    document.getElementById('overlayAdmPanel').classList.remove('active');
    if (battle.isSolo) {
      if (battle.soloSubType === 'sprint40' || battle.soloSubType === 'ultra2m' || battle.soloSubType === 'cheese') battle.finishChallenge(true);
      else battle.finishMatch(true, 'クリア');
    } else {
      battle.onRoundEnd(true, '勝利');
    }
  });
  document.getElementById('admForceKO').addEventListener('click', () => {
    if (battle.isOnline || battle.ended) return;
    document.getElementById('overlayAdmPanel').classList.remove('active');
    battle.onSelfKO();
  });
  document.getElementById('admPuyoStair').addEventListener('click', () => {
    if (battle.isOnline || !battle.selfPuyo) return;
    const g = Array.from({ length: 13 }, () => Array(6).fill(0));
    const C = [1, 2, 3, 4, 1, 2];
    g[12][0] = C[0]; g[11][0] = C[0];
    for (let c = 1; c <= 4; c++) {
      g[12][c] = C[c]; g[11][c] = C[c]; g[10][c] = C[c - 1]; g[9][c] = C[c];
    }
    g[12][5] = C[5]; g[11][5] = C[5]; g[10][5] = C[4]; g[9][5] = C[5]; g[8][5] = C[5];

    battle.selfPuyo.grid = g;
    battle.selfPuyo.phase = 'active';
    battle.selfPuyo.current = { x: 0, y: 1, rot: 0, axis: 1, child: 1 };
    battle.selfPuyo.popCells = [];
    battle.selfPuyo.chain = 0;
    document.getElementById('overlayAdmPanel').classList.remove('active');
    battle.render();
    showToast('6連鎖階段サンプルを配置しました（左端に落とすと発火！）');
  });

  document.querySelectorAll('[data-adm-queue]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (battle.isOnline) return;
      admQueueMode = btn.dataset.admQueue;
      if (battle.selfTetris && (admQueueMode === 'I' || admQueueMode === 'T')) {
        battle.selfTetris.queue = Array(7).fill(admQueueMode);
      }
      refreshAdmBattleControls();
      if (battle.active) battle.render();
    });
  });
  document.getElementById('btnBgmToggle').addEventListener('click', () => {
    sound.unlock(); profile.settings.bgm = !profile.settings.bgm; saveProfile(profile); updateTopToggleButtons();
  });
  document.getElementById('btnSeToggle').addEventListener('click', () => {
    sound.unlock(); profile.settings.se = !profile.settings.se; saveProfile(profile); updateTopToggleButtons();
  });
  document.getElementById('inputPlayerName').addEventListener('input', (e) => {
    profile.name = e.target.value.trim() || 'PLAYER'; saveProfile(profile);
  });
  setupSegGroup('favStyleGroup', (val) => { profile.favStyle = val; saveProfile(profile); });

  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.mode-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('pane-' + tab.dataset.tab).classList.add('active');
    });
  });

  setupSegGroup('onlineMatchKindGroup', (kind) => {
    const isFree = kind === 'free';
    const bbBtn = document.getElementById('btnRuleBigBangOnline');
    if (bbBtn) bbBtn.style.display = isFree ? 'inline-flex' : 'none';
    if (!isFree && getSegVal('rankedRuleGroup') === 'bigbang') {
      const vsBtn = document.querySelector('#rankedRuleGroup .seg-btn[data-val="vs"]');
      if (vsBtn) vsBtn.click();
    }
    const desc = document.getElementById('onlineMatchDesc');
    if (desc) {
      desc.textContent = isFree
        ? 'レート変動なしのフリーオンライン自動マッチング（VS / SWAP / BIG BANG / SKILL対応）。履歴・コイン・XP・ミッション進捗は通常通り反映されます。'
        : '相手とのレート差に応じてElo式（K=32）でレートが変動します。スキルバトルは別枠の「スキルバトルレート」が変動します。';
    }
    const findBtn = document.getElementById('btnFindRanked');
    if (findBtn) findBtn.textContent = isFree ? '🌐 フリーマッチ相手をさがす' : '🔍 ランクマッチ相手をさがす';
  });
  setupSegGroup('rankedRuleGroup', (val) => {
    document.getElementById('rankedStyleRow').style.display = val !== 'swap' ? 'block' : 'none';
  });
  setupSegGroup('rankedFtGroup');
  setupSegGroup('rankedStyleGroup');
  setupSegGroup('roomRuleGroup');
  setupSegGroup('roomFtGroup');
  setupSegGroup('roomPuyoColorGroup');
  setupSegGroup('roomHostAtkGroup');
  setupSegGroup('roomGuestAtkGroup');
  setupSegGroup('cpuSelfAtkGroup');
  setupSegGroup('cpuOppAtkGroup');
  setupSegGroup('soloPuyoColorGroup');
  setupSegGroup('roomMyStyleGroup', (val) => {
    net.myStyle = val;
    if (net.conn && net.conn.open) {
      net.send({ type: 'roomState', name: profile.name, rating: profile.rating, style: net.myStyle, ready: net.myReady });
    }
    updateRoomLobbyUI();
  });

  setupSegGroup('soloTypeGroup', (val) => {
    document.getElementById('cpuConfigBox').style.display = val === 'cpu' ? 'block' : 'none';
    document.getElementById('spectateConfigBox').style.display = val === 'spectate' ? 'block' : 'none';
    document.getElementById('cheeseConfigRow').style.display = val === 'cheese' ? 'block' : 'none';
    const towerRow = document.getElementById('towerConfigRow');
    if (towerRow) towerRow.style.display = val === 'cpu_tower' ? 'block' : 'none';
    const bbRow = document.getElementById('bigbangSoloStyleRow');
    if (bbRow) bbRow.style.display = val === 'bigbang_solo' ? 'block' : 'none';
    const showPuyoCols = ['cpu', 'spectate', 'endless_puyo', 'endless_swap'].includes(val);
    document.getElementById('soloPuyoColorRow').style.display = showPuyoCols ? 'block' : 'none';
    updateSoloRecordBanner();
  });
  setupSegGroup('bigbangSoloStyleGroup');
  setupSegGroup('cheeseLinesGroup');
  setupSegGroup('cpuRuleGroup', (val) => {
    document.getElementById('cpuMyStyleWrap').style.display = val !== 'swap' ? 'block' : 'none';
    document.getElementById('cpuOppStyleWrap').style.display = val !== 'swap' ? 'block' : 'none';
  });
  setupSegGroup('cpuFtGroup');
  setupSegGroup('cpuMyStyleGroup');
  setupSegGroup('cpuOppStyleGroup');
  setupSegGroup('cpuDiffGroup');

  setupSegGroup('specRuleGroup', (val) => {
    document.getElementById('specLeftStyleWrap').style.display = val === 'vs' ? 'block' : 'none';
    document.getElementById('specRightStyleWrap').style.display = val === 'vs' ? 'block' : 'none';
  });
  setupSegGroup('specFtGroup');
  setupSegGroup('specLeftStyleGroup');
  setupSegGroup('specLeftDiffGroup');
  setupSegGroup('specRightStyleGroup');
  setupSegGroup('specRightDiffGroup');

  document.getElementById('btnFindRanked').addEventListener('click', () => {
    sound.unlock();
    const isFree = getSegVal('onlineMatchKindGroup') === 'free';
    net.startRankedSearch(
      getSegVal('rankedRuleGroup'),
      getSegVal('rankedStyleGroup'),
      parseInt(getSegVal('rankedFtGroup'), 10) || 2,
      isFree
    );
  });
  document.getElementById('btnCancelRanked').addEventListener('click', () => {
    net.cleanup(); showToast('マッチング検索をキャンセルしました');
  });

  document.getElementById('btnCreateRoom').addEventListener('click', () => {
    sound.unlock();
    net.createRoom(
      getSegVal('roomRuleGroup'),
      parseInt(getSegVal('roomFtGroup'), 10) || 2,
      parseInt(getSegVal('roomPuyoColorGroup'), 10) || 4,
      parseInt(getSegVal('roomHostAtkGroup'), 10) || 100,
      parseInt(getSegVal('roomGuestAtkGroup'), 10) || 100
    );
  });
  document.getElementById('btnJoinRoom').addEventListener('click', () => {
    sound.unlock(); net.joinRoom(document.getElementById('inputRoomId').value);
  });
  document.getElementById('btnCopyRoomCode').addEventListener('click', () => {
    copyToClipboard(document.getElementById('roomCodeDisplay').textContent);
  });
  document.getElementById('btnCopyInviteUrl').addEventListener('click', () => {
    const code = document.getElementById('roomCodeDisplay').textContent.trim();
    if (!code || code === 'PT-0000') return;
    const url = location.href.split('?')[0] + '?room=' + encodeURIComponent(code);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast('招待リンクをコピーしました！')).catch(() => copyToClipboard(url));
    } else {
      copyToClipboard(url);
    }
  });
  document.getElementById('btnLeaveRoom').addEventListener('click', () => net.cleanup());
  document.getElementById('btnRoomReady').addEventListener('click', () => {
    net.myReady = !net.myReady;
    net.send({ type: 'roomState', name: profile.name, rating: profile.rating, style: net.myStyle, ready: net.myReady });
    updateRoomLobbyUI();
    if (net.isHost && net.myReady && net.oppReady) {
      net.send({ type: 'roomStart', targetWins: net.targetWins, puyoColors: net.puyoColors, hostAtk: net.hostAtk, guestAtk: net.guestAtk });
      startOnlineMatch(net.rule, net.rated, net.myStyle, net.oppInfo, net.targetWins, net.puyoColors, net.hostAtk, net.guestAtk);
    }
  });

  const DIFF_RATINGS = { easy: 1300, normal: 1550, hard: 1850, impossible: 2400 };
  let lastSoloOpts = null;

  document.getElementById('btnStartSolo').addEventListener('click', () => {
    sound.unlock();
    const sType = getSegVal('soloTypeGroup');
    if (sType === 'puyo_editor') {
      puyoEditor.openEditor();
      return;
    }
    if (window.extras && typeof window.extras.handleStartSolo === 'function' && window.extras.handleStartSolo(sType)) {
      return;
    }
    const puyoCols = parseInt(getSegVal('soloPuyoColorGroup'), 10) || 4;
    if (sType === 'cpu') {
      const rule = getSegVal('cpuRuleGroup');
      const ft = parseInt(getSegVal('cpuFtGroup'), 10) || 1;
      const mySt = getSegVal('cpuMyStyleGroup');
      const opSt = getSegVal('cpuOppStyleGroup');
      const diff = getSegVal('cpuDiffGroup');
      const selfAtk = parseInt(getSegVal('cpuSelfAtkGroup'), 10) || 100;
      const oppAtk = parseInt(getSegVal('cpuOppAtkGroup'), 10) || 100;
      const cpuName = diff === 'impossible' ? 'CPU IMPOSSIBLE' : `CPU (${diff.toUpperCase()})`;
      lastSoloOpts = {
        isOnline: false, isSolo: false, isCpu: true, isSpectate: false,
        rule, rated: false, targetWins: ft, puyoColors: puyoCols, selfAtk, oppAtk,
        selfStyle: mySt, oppStyle: opSt, cpuDiff: diff,
        selfInfo: { name: profile.name, rating: profile.rating, title: profile.activeTitle },
        oppInfo: { name: cpuName, rating: DIFF_RATINGS[diff] || 1550, style: opSt, title: '' }
      };
      battle.setupMatch(lastSoloOpts);
      showVSMatchup(rule, false, mySt, lastSoloOpts.oppInfo, ft, false, lastSoloOpts.selfInfo, () => battle.startCountdown());
    } else if (sType === 'spectate') {
      const rule = getSegVal('specRuleGroup');
      const ft = parseInt(getSegVal('specFtGroup'), 10) || 2;
      const lSt = getSegVal('specLeftStyleGroup');
      const rSt = getSegVal('specRightStyleGroup');
      const lDiff = getSegVal('specLeftDiffGroup');
      const rDiff = getSegVal('specRightDiffGroup');
      const lName = lDiff === 'impossible' ? 'AI-1 IMPOSSIBLE' : `AI-1 (${lDiff.toUpperCase()})`;
      const rName = rDiff === 'impossible' ? 'AI-2 IMPOSSIBLE' : `AI-2 (${rDiff.toUpperCase()})`;
      lastSoloOpts = {
        isOnline: false, isSolo: false, isCpu: false, isSpectate: true,
        rule, rated: false, targetWins: ft, puyoColors: puyoCols,
        selfStyle: lSt, oppStyle: rSt, leftDiff: lDiff, rightDiff: rDiff,
        selfInfo: { name: lName, rating: DIFF_RATINGS[lDiff] || 1550, title: '' },
        oppInfo: { name: rName, rating: DIFF_RATINGS[rDiff] || 1550, style: rSt, title: '' }
      };
      battle.setupMatch(lastSoloOpts);
      showVSMatchup(rule, false, lSt, lastSoloOpts.oppInfo, ft, true, lastSoloOpts.selfInfo, () => battle.startCountdown());
    } else if (sType === 'bigbang_solo') {
      const st = getSegVal('bigbangSoloStyleGroup') || 'tetris';
      lastSoloOpts = {
        isOnline: false, isSolo: true, isCpu: false, isSpectate: false,
        soloSubType: 'bigbang_solo', puyoColors: 4,
        rule: 'bigbang', rated: false, targetWins: 1,
        selfStyle: st, oppStyle: st,
        selfInfo: { name: profile.name, rating: profile.rating, title: profile.activeTitle }
      };
      battle.setupMatch(lastSoloOpts);
      battle.startCountdown();
    } else {
      const isSwap = sType === 'endless_swap';
      const st = sType === 'endless_puyo' ? 'puyo' : 'tetris';
      const cheeseTarget = sType === 'cheese' ? (parseInt(getSegVal('cheeseLinesGroup'), 10) || 10) : 10;
      lastSoloOpts = {
        isOnline: false, isSolo: true, isCpu: false, isSpectate: false,
        soloSubType: sType, cheeseTarget, puyoColors: puyoCols,
        rule: isSwap ? 'swap' : 'vs', rated: false, targetWins: 1,
        selfStyle: st, oppStyle: st,
        selfInfo: { name: profile.name, rating: profile.rating, title: profile.activeTitle }
      };
      battle.setupMatch(lastSoloOpts);
      battle.startCountdown();
    }
  });

  document.getElementById('btnZeroGrav').addEventListener('click', () => {
    sound.unlock();
    battle.zeroGravity = !battle.zeroGravity;
    const btn = document.getElementById('btnZeroGrav');
    btn.textContent = battle.zeroGravity ? '🪶 重力: OFF (無重力)' : '🪶 重力: ON';
    btn.classList.toggle('active', battle.zeroGravity);
    sound.playSE('rotate');
  });
  document.getElementById('btnPuyoUndo').addEventListener('click', () => {
    sound.unlock();
    battle.doPuyoUndo();
  });
  function quickRetryMatch() {
    if (typeof br99 !== 'undefined' && br99.isOpen) {
      if (br99.isOnline) return;
      sound.unlock();
      sound.stopBGM();
      document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
      br99.startSolo();
      return;
    }
    if (battle.isOnline || !lastSoloOpts) return;
    sound.unlock();
    sound.stopBGM();
    battle.active = false;
    battle.paused = false;
    battle.ended = false;
    battle.countdownActive = false;
    battle.roundIntermission = false;
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
    battle.setupMatch(lastSoloOpts);
    battle.startCountdown();
  }

  document.getElementById('btnRetryGame').addEventListener('click', () => quickRetryMatch());
  document.getElementById('btnRetryFromPause').addEventListener('click', () => quickRetryMatch());
  document.getElementById('btnPauseGame').addEventListener('click', () => {
    if ((battle.active || battle.paused) && !battle.isOnline && !battle.ended) togglePause();
  });
  document.getElementById('btnResumePause').addEventListener('click', () => togglePause());
  document.getElementById('btnQuitFromPause').addEventListener('click', () => returnToLobby());
  document.getElementById('btnQuitBattle').addEventListener('click', () => returnToLobby());
  document.getElementById('btnBackLobby').addEventListener('click', () => returnToLobby());

  document.getElementById('btnRematch').addEventListener('click', () => {
    sound.unlock();
    if (typeof br99 !== 'undefined' && br99.isOpen) {
      document.getElementById('overlayResult').classList.remove('active');
      if (br99.isOnline) {
        br99.exitToLobby();
        document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'br99'));
        document.querySelectorAll('.mode-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-br99'));
      } else {
        br99.startSolo();
      }
      return;
    }
    if (battle.isOnline) {
      if (!net.conn || !net.conn.open) {
        showToast('相手との接続が切れています。ロビーへ戻ります。');
        returnToLobby();
        return;
      }
      battle.myRematch = true;
      document.getElementById('btnRematch').disabled = true;
      net.send({ type: 'rematchReq', rating: net.rule === 'skill' ? (profile.skillRating || 1500) : profile.rating });
      if (battle.oppRematch) {
        startOnlineMatch(net.rule, net.rated, net.myStyle, battle.oppInfo, net.targetWins, net.puyoColors, net.isHost ? net.hostAtk : net.guestAtk, net.isHost ? net.guestAtk : net.hostAtk);
      } else {
        document.getElementById('resRematchStatus').textContent = '相手の再戦承諾を待っています...';
      }
    } else if (battle.towerFloor > 0 && window.extras && typeof window.extras.startTowerRun === 'function') {
      document.getElementById('overlayResult').classList.remove('active');
      window.extras.startTowerRun(battle.selfStyle);
    } else if (lastSoloOpts) {
      document.getElementById('overlayResult').classList.remove('active');
      battle.setupMatch(lastSoloOpts);
      if (lastSoloOpts.isCpu || lastSoloOpts.isSpectate) {
        showVSMatchup(
          lastSoloOpts.rule, false, lastSoloOpts.selfStyle, lastSoloOpts.oppInfo,
          lastSoloOpts.targetWins || 1, !!lastSoloOpts.isSpectate, lastSoloOpts.selfInfo,
          () => battle.startCountdown()
        );
      } else {
        battle.startCountdown();
      }
    }
  });

  document.querySelectorAll('#touchPad .touch-btn').forEach(btn => {
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
      if (!battle.active || battle.paused || battle.ended || battle.isSpectate) return;
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

  /* =========================================================================
     12. REPLAY PLAYER (PLAY / PAUSE / SPEED / SEEK / JSON SAVE & LOAD)
     ========================================================================= */
  let lastReplayData = null;
  const replayPlayer = {
    open: false,
    playing: false,
    speed: 1,
    frameIdx: 0,
    accum: 0,
    data: null,
    st: new TetrisBoard(false, null, null, null, null, null),
    sp: new PuyoBoard(false, null, null, null, null, null, null, 5),
    ot: new TetrisBoard(false, null, null, null, null, null),
    op: new PuyoBoard(false, null, null, null, null, null, null, 5),

    loadAndOpen(repData) {
      if (!repData || !Array.isArray(repData.frames) || repData.frames.length === 0 || !repData.meta) {
        showToast('再生可能なリプレイデータがありません');
        return;
      }
      this.data = repData;
      this.open = true;
      this.playing = true;
      this.frameIdx = 0;
      this.accum = 0;
      const m = repData.meta;
      document.getElementById('repMetaText').textContent =
        `${m.selfName}${m.isSolo ? '' : ' vs ' + m.oppName} [${(m.rule || 'vs').toUpperCase()}]`;
      document.getElementById('repStage').classList.toggle('solo', !!m.isSolo);
      document.getElementById('repOppCanvas').style.display = m.isSolo ? 'none' : 'block';
      const seek = document.getElementById('repSeek');
      seek.max = Math.max(0, repData.frames.length - 1);
      seek.value = 0;
      document.getElementById('btnRepTogglePlay').textContent = '⏸ 一時停止';
      this.applyFrame(0);
      document.getElementById('overlayReplay').classList.add('active');
    },

    applyFrame(idx) {
      if (!this.data || !this.data.frames.length) return;
      this.frameIdx = Math.max(0, Math.min(this.data.frames.length - 1, idx));
      const f = this.data.frames[this.frameIdx];
      const m = this.data.meta;
      const isSwap = m.rule === 'swap';
      const selfStyle = isSwap ? (f.swapSide || 'tetris') : (m.selfStyle || 'tetris');
      const oppStyle = isSwap ? (f.swapSide || 'tetris') : (m.oppStyle || 'puyo');

      if (f.st) this.st.applyRemote(f.st);
      if (f.sp) this.sp.applyRemote(f.sp);
      if (f.ot) this.ot.applyRemote(f.ot);
      if (f.op) this.op.applyRemote(f.op);

      renderPlayerCanvas(document.getElementById('repSelfCanvas'), selfStyle, this.st, this.sp, isSwap, false, null);
      if (!m.isSolo) {
        renderPlayerCanvas(document.getElementById('repOppCanvas'), oppStyle, this.ot, this.op, isSwap, false, null);
      }

      document.getElementById('repSeek').value = this.frameIdx;
      const totalT = this.data.frames[this.data.frames.length - 1].t || 0;
      const curT = f.t || 0;
      const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
      document.getElementById('repTimeLabel').textContent = `${fmt(curT)} / ${fmt(totalT)}`;
    },

    update(dt) {
      if (!this.open || !this.playing || !this.data) return;
      this.accum += dt * this.speed;
      const step = 0.15;
      while (this.accum >= step) {
        this.accum -= step;
        if (this.frameIdx + 1 < this.data.frames.length) {
          this.applyFrame(this.frameIdx + 1);
        } else {
          this.playing = false;
          document.getElementById('btnRepTogglePlay').textContent = '▶ 再生';
          break;
        }
      }
    },

    close() {
      this.open = false;
      this.playing = false;
      document.getElementById('overlayReplay').classList.remove('active');
    }
  };

  function saveLastReplaySnapshot() {
    if (!battle.replayFrames || battle.replayFrames.length === 0) {
      lastReplayData = null;
      return;
    }
    lastReplayData = {
      version: 1,
      meta: { ...(battle.replayMeta || {}) },
      frames: battle.replayFrames
    };
  }

  document.getElementById('btnPlayReplay').addEventListener('click', () => {
    sound.unlock();
    if (!lastReplayData) { showToast('リプレイデータがありません'); return; }
    replayPlayer.loadAndOpen(lastReplayData);
  });

  document.getElementById('btnSaveReplay').addEventListener('click', () => {
    if (!lastReplayData) { showToast('保存できるリプレイデータがありません'); return; }
    const blob = new Blob([JSON.stringify(lastReplayData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `puyotet-replay-${ts}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('リプレイ(.json)を保存しました');
  });

  document.getElementById('btnLoadReplayFile').addEventListener('click', () => {
    document.getElementById('replayFileInput').click();
  });

  document.getElementById('replayFileInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.frames) || !parsed.meta) throw new Error('invalid');
        document.getElementById('overlayHandling').classList.remove('active');
        replayPlayer.loadAndOpen(parsed);
      } catch (err) {
        showToast('無効なリプレイファイルです');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btnCloseReplay').addEventListener('click', () => replayPlayer.close());
  document.getElementById('btnRepTogglePlay').addEventListener('click', () => {
    if (!replayPlayer.data) return;
    if (!replayPlayer.playing && replayPlayer.frameIdx >= replayPlayer.data.frames.length - 1) {
      replayPlayer.applyFrame(0);
    }
    replayPlayer.playing = !replayPlayer.playing;
    document.getElementById('btnRepTogglePlay').textContent = replayPlayer.playing ? '⏸ 一時停止' : '▶ 再生';
  });
  document.getElementById('repSeek').addEventListener('input', (e) => {
    replayPlayer.playing = false;
    document.getElementById('btnRepTogglePlay').textContent = '▶ 再生';
    replayPlayer.applyFrame(parseInt(e.target.value, 10) || 0);
  });
  setupSegGroup('repSpeedGroup', (val) => {
    replayPlayer.speed = parseFloat(val) || 1;
  });

  /* =========================================================================
     13. PUYO CHAIN RESEARCH EDITOR (CLICK/DRAG PALETTE, CHAIN SIM & PRESETS)
     ========================================================================= */
  const puyoEditor = {
    open: false,
    paintColor: 1,
    drawing: false,
    simulating: false,
    savedGrid: null,
    board: null,
    canvas: null,
    ctx: null,

    init() {
      this.canvas = document.getElementById('editorCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.board = new PuyoBoard(false, null, null, null, null, null, null, 5);
      this.board.current = null;
      this.board.phase = 'editor';

      document.querySelectorAll('#editorPalette .pal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          sound.unlock();
          document.querySelectorAll('#editorPalette .pal-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.paintColor = parseInt(btn.dataset.pcol, 10) || 0;
        });
      });

      const getCellFromEvent = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const px = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const py = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        const cell = 42, bx = 64, by = 14;
        const c = Math.floor((px - bx) / cell);
        const r = Math.floor((py - by) / cell) + 1;
        if (c >= 0 && c < 6 && r >= 1 && r < 13) return { c, r };
        return null;
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        if (!this.open || this.simulating) return;
        e.preventDefault();
        this.drawing = true;
        const hit = getCellFromEvent(e);
        if (hit) {
          this.board.grid[hit.r][hit.c] = this.paintColor;
          this.savedGrid = null;
          this.updateBadge(0, 0, 0);
          this.render();
        }
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.open || !this.drawing || this.simulating) return;
        const hit = getCellFromEvent(e);
        if (hit && this.board.grid[hit.r][hit.c] !== this.paintColor) {
          this.board.grid[hit.r][hit.c] = this.paintColor;
          this.savedGrid = null;
          this.render();
        }
      });

      const stopDraw = () => { this.drawing = false; };
      this.canvas.addEventListener('pointerup', stopDraw);
      this.canvas.addEventListener('pointercancel', stopDraw);
      this.canvas.addEventListener('pointerleave', stopDraw);

      document.getElementById('btnEdFire').addEventListener('click', () => {
        sound.unlock();
        if (!this.open) return;
        if (!this.savedGrid) {
          this.savedGrid = this.board.grid.map(r => r.slice());
        } else {
          this.board.grid = this.savedGrid.map(r => r.slice());
        }
        this.board.score = 0;
        this.board.nuisanceCarry = 0;
        this.board.chain = 0;
        this.board.popCells = [];
        this.board.phase = 'chigiri';
        this.board.phaseTimer = 0.05;
        this.simulating = true;
        this.updateBadge(0, 0, 0);
        sound.playSE('puyoChigiri');
        this.render();
      });

      document.getElementById('btnEdRestore').addEventListener('click', () => {
        sound.unlock();
        if (!this.open) return;
        this.simulating = false;
        this.board.popCells = [];
        this.board.phase = 'editor';
        if (this.savedGrid) {
          this.board.grid = this.savedGrid.map(r => r.slice());
          this.render();
          showToast('編集前の配置を復元しました');
        } else {
          this.render();
        }
      });

      document.getElementById('btnEdClear').addEventListener('click', () => {
        sound.unlock();
        this.simulating = false;
        this.savedGrid = null;
        this.board.grid = Array.from({ length: 13 }, () => Array(6).fill(0));
        this.board.popCells = [];
        this.board.chain = 0;
        this.board.score = 0;
        this.board.phase = 'editor';
        this.updateBadge(0, 0, 0);
        this.render();
      });

      document.getElementById('btnEdPresetStair').addEventListener('click', () => {
        sound.unlock();
        this.applyPreset('stair6');
      });
      document.getElementById('btnEdPresetGtr').addEventListener('click', () => {
        sound.unlock();
        this.applyPreset('gtr5');
      });
      document.getElementById('btnEdBackLobby').addEventListener('click', () => {
        this.close();
      });
    },

    applyPreset(kind) {
      this.simulating = false;
      this.board.popCells = [];
      this.board.chain = 0;
      this.board.score = 0;
      this.board.phase = 'editor';
      const g = Array.from({ length: 13 }, () => Array(6).fill(0));
      if (kind === 'stair6') {
        const C = [1, 2, 3, 4, 1, 2];
        g[12][0] = C[0]; g[11][0] = C[0]; g[10][0] = C[0];
        for (let c = 1; c <= 4; c++) {
          g[12][c] = C[c]; g[11][c] = C[c]; g[10][c] = C[c - 1]; g[9][c] = C[c];
        }
        g[12][5] = C[5]; g[11][5] = C[5]; g[10][5] = C[4]; g[9][5] = C[5]; g[8][5] = C[5];
        showToast('階段6連鎖を配置しました（「▶ 発火テスト」で発火！）');
      } else {
        g[12][0] = 2; g[12][1] = 2; g[12][2] = 2;
        g[11][0] = 2; g[11][1] = 1;
        g[10][0] = 1; g[10][1] = 1; g[10][2] = 1;
        g[9][1] = 3; g[9][2] = 3; g[9][3] = 3;
        g[8][2] = 4; g[8][3] = 4; g[8][4] = 4;
        g[7][3] = 2; g[7][4] = 2; g[7][5] = 2;
        showToast('GTR折り返し基礎（5連鎖）を配置しました');
      }
      this.board.grid = g;
      this.savedGrid = g.map(r => r.slice());
      this.updateBadge(0, 0, 0);
      this.render();
    },

    updateBadge(chain, score, ojama) {
      document.getElementById('edResultBadge').textContent =
        `連鎖: ${chain} | スコア: ${score.toLocaleString()} | おじゃま: ${ojama}`;
    },

    openEditor() {
      sound.stopBGM();
      net.cleanup();
      this.open = true;
      this.simulating = false;
      this.board.phase = 'editor';
      this.board.current = null;
      this.updateBadge(0, 0, 0);
      showScreen('screenEditor');
      this.render();
      unlockAchievement('open_editor');
    },

    close() {
      this.open = false;
      this.simulating = false;
      this.drawing = false;
      showScreen('screenLobby');
      renderProfileUI();
    },

    update(dt) {
      if (!this.open || !this.simulating) return;
      const b = this.board;
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          if (b.squish[r][c] > 0) b.squish[r][c] = Math.max(0, b.squish[r][c] - dt * 4.2);
        }
      }
      for (let i = b.popups.length - 1; i >= 0; i--) {
        b.popups[i].life -= dt;
        b.popups[i].yOffset -= dt * 26;
        if (b.popups[i].life <= 0) b.popups.splice(i, 1);
      }

      if (b.phase === 'chigiri' || b.phase === 'falling') {
        b.phaseTimer -= dt;
        if (b.phaseTimer <= 0) {
          if (b.applyGravityStep()) b.phaseTimer = 0.04;
          else { b.phase = 'check'; b.phaseTimer = 0.08; }
        }
      } else if (b.phase === 'check') {
        b.phaseTimer -= dt;
        if (b.phaseTimer <= 0) {
          const prevChain = b.chain;
          const prevScore = b.score;
          b.executeCheck();
          if (b.chain > prevChain) {
            const estOjama = Math.floor((b.score - prevScore) / 70);
            this.updateBadge(b.chain, b.score, estOjama);
          } else if (b.phase !== 'popping' && b.phase !== 'falling' && b.phase !== 'check') {
            this.simulating = false;
            b.phase = 'editor';
            const totalOjama = Math.floor(b.score / 70);
            this.updateBadge(b.chain, b.score, totalOjama);
          }
        }
      } else if (b.phase === 'popping') {
        b.phaseTimer -= dt;
        if (b.phaseTimer <= 0) {
          for (const [x, y] of b.popCells) b.grid[y][x] = 0;
          b.popCells = [];
          b.phase = 'falling';
          b.phaseTimer = 0.05;
        }
      }
      this.render();
    },

    render() {
      if (!this.ctx || !this.board) return;
      const ctx = this.ctx;
      const b = this.board;
      const W = this.canvas.width, H = this.canvas.height;
      const cell = 42, bx = 64, by = 14, bw = 6 * cell, bh = 12 * cell;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = activeThemeObj.canvasBg;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = activeThemeObj.fieldBg;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = activeThemeObj.gridLine;
      ctx.lineWidth = 1;
      for (let x = 0; x <= 6; x++) {
        ctx.beginPath(); ctx.moveTo(bx + x * cell, by); ctx.lineTo(bx + x * cell, by + bh); ctx.stroke();
      }
      for (let y = 0; y <= 12; y++) {
        ctx.beginPath(); ctx.moveTo(bx, by + y * cell); ctx.lineTo(bx + bw, by + y * cell); ctx.stroke();
      }

      const popSet = new Set(b.popCells.map(([x, y]) => `${x},${y}`));
      for (let r = 1; r < 13; r++) {
        for (let c = 0; c < 6; c++) {
          const col = b.grid[r][c];
          if (!col) continue;
          let mask = 0;
          if (col >= 1 && col <= 5) {
            if (r > 1 && b.grid[r - 1][c] === col) mask |= 1;
            if (c < 5 && b.grid[r][c + 1] === col) mask |= 2;
            if (r < 12 && b.grid[r + 1][c] === col) mask |= 4;
            if (c > 0 && b.grid[r][c - 1] === col) mask |= 8;
          }
          drawPuyoCell(ctx, bx + c * cell, by + (r - 1) * cell, cell, col, mask, popSet.has(`${c},${r}`), b.squish[r][c]);
        }
      }

      ctx.strokeStyle = activeThemeObj.puyoBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      for (const pop of b.popups) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, pop.life / pop.maxLife * 1.4);
        ctx.font = '900 24px sans-serif'; ctx.textAlign = 'center';
        ctx.shadowBlur = 14; ctx.shadowColor = pop.color;
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, bx + bw / 2, by + bh * 0.42 + pop.yOffset);
        ctx.restore();
      }
    }
  };

  function openPuyoEditor() {
    puyoEditor.openEditor();
  }


  /* =========================================================================
     15. INITIALIZATION & QUERY-PARAM AUTO-JOIN (?room= / ?br99=)
     ========================================================================= */
  initStampBars();
  puyoEditor.init();
  br99.initUI();
  renderProfileUI();

  // Account & Cloud Sync UI wiring
  let authModeTab = 'login';
  function renderAuthModalUI() {
    const unconf = document.getElementById('authUnconfiguredBanner');
    const outView = document.getElementById('authLoggedOutView');
    const inView = document.getElementById('authLoggedInView');
    const errEl = document.getElementById('authErrorMsg');
    if (errEl) errEl.textContent = '';

    if (!fbReady) {
      if (unconf) unconf.style.display = 'block';
      if (outView) outView.style.display = 'block';
      if (inView) inView.style.display = 'none';
      setCloudBadgeState(null);
      return;
    }
    if (unconf) unconf.style.display = 'none';

    if (fbUser) {
      if (outView) outView.style.display = 'none';
      if (inView) inView.style.display = 'block';
      document.getElementById('authSignedName').textContent = `${profile.name}（${getAuthAccountDisplayName(fbUser)}）`;
      const isIdPass = !!(fbUser.email && fbUser.email.endsWith('@puyotet.local'));
      document.getElementById('authSignedMethod').textContent =
        isIdPass ? 'ログイン方式: ID＋パスワード' : 'ログイン方式: Googleアカウント';
      document.getElementById('authSignedUid').textContent = `UID: ${fbUser.uid}`;
      setPlayerIdBadgeEl('authSignedPlayerId', profile.playerNo, true, false);
      const authJoin = document.getElementById('authSignedJoinedAt');
      if (authJoin) authJoin.textContent = formatJoinedMonth(profile.joinedAt);
      setCloudBadgeState('synced');
    } else {
      if (outView) outView.style.display = 'block';
      if (inView) inView.style.display = 'none';
      document.getElementById('authTabLogin').classList.toggle('active', authModeTab === 'login');
      document.getElementById('authTabRegister').classList.toggle('active', authModeTab === 'register');
      document.getElementById('authFormHeading').textContent = authModeTab === 'register'
        ? '新規アカウント作成（メール不要・ゲスト戦績引継）'
        : 'ID＋パスワードでログイン（メール不要）';
      document.getElementById('btnAuthSubmit').textContent = authModeTab === 'register'
        ? '✨ 新規登録してクラウド保存を開始'
        : '🔑 ログインする';
      setCloudBadgeState(null);
    }
  }

  function openAuthModal() {
    sound.unlock();
    renderAuthModalUI();
    document.getElementById('overlayAuth').classList.add('active');
  }

  document.getElementById('btnAuthModal').addEventListener('click', openAuthModal);
  document.getElementById('cloudSyncBadge').addEventListener('click', openAuthModal);
  document.getElementById('btnCloseAuth').addEventListener('click', () => {
    document.getElementById('overlayAuth').classList.remove('active');
  });

  document.querySelectorAll('[data-authtab]').forEach(tab => {
    tab.addEventListener('click', () => {
      authModeTab = tab.dataset.authtab;
      renderAuthModalUI();
    });
  });

  document.getElementById('btnAuthSubmit').addEventListener('click', async () => {
    const errEl = document.getElementById('authErrorMsg');
    errEl.textContent = '';
    if (!fbReady || !fbAuth) {
      errEl.textContent = 'Firebase未設定のためゲストモードのみ利用可能です。';
      return;
    }
    const rawId = (document.getElementById('authUserId').value || '').trim().toLowerCase();
    const pw = document.getElementById('authPassword').value || '';
    if (!/^[a-z0-9_]{3,20}$/.test(rawId)) {
      errEl.textContent = 'ユーザーIDは半角英数字とアンダースコア（_）3〜20文字で入力してください。';
      return;
    }
    if (pw.length < 6) {
      errEl.textContent = 'パスワードは6文字以上で入力してください。';
      return;
    }
    const virtualEmail = `${rawId}@puyotet.local`;
    const btn = document.getElementById('btnAuthSubmit');
    btn.disabled = true;
    try {
      let cred;
      if (authModeTab === 'register') {
        cred = await fbAuth.createUserWithEmailAndPassword(virtualEmail, pw);
        if (cred.user && !cred.user.displayName) {
          await cred.user.updateProfile({ displayName: rawId }).catch(() => {});
        }
      } else {
        cred = await fbAuth.signInWithEmailAndPassword(virtualEmail, pw);
      }
      if (cred && cred.user) {
        fbUser = cred.user;
      }
      document.getElementById('authPassword').value = '';
      document.getElementById('overlayAuth').classList.remove('active');
      renderAuthModalUI();
    } catch (e) {
      errEl.textContent = formatFirebaseAuthError(e);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btnAuthGoogle').addEventListener('click', async () => {
    const errEl = document.getElementById('authErrorMsg');
    errEl.textContent = '';
    if (!fbReady || !fbAuth) {
      errEl.textContent = 'Firebase未設定のためGoogleログインは利用できません。';
      return;
    }
    const btn = document.getElementById('btnAuthGoogle');
    btn.disabled = true;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await fbAuth.signInWithPopup(provider);
      if (cred && cred.user) {
        fbUser = cred.user;
      }
      document.getElementById('overlayAuth').classList.remove('active');
      renderAuthModalUI();
    } catch (e) {
      errEl.textContent = formatFirebaseAuthError(e);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btnAuthSyncNow').addEventListener('click', async () => {
    const btn = document.getElementById('btnAuthSyncNow');
    btn.disabled = true;
    await syncCloudNow(true, true);
    btn.disabled = false;
  });

  document.getElementById('btnAuthLogout').addEventListener('click', async () => {
    if (!fbReady || !fbAuth) return;
    await syncCloudNow(true, false);
    await fbAuth.signOut().catch(() => {});
    fbUser = null;
    setCloudBadgeState(null);
    renderAuthModalUI();
    showToast('ログアウトしました（ローカルデータは保持されています）');
  });

  if (fbReady && fbAuth) {
    fbAuth.onAuthStateChanged(async (user) => {
      fbUser = user || null;
      if (user) {
        await loadOrMigrateCloudProfile(user);
      } else {
        setCloudBadgeState(null);
      }
      if (document.getElementById('overlayAuth').classList.contains('active')) {
        renderAuthModalUI();
      }
    });
    fetchCloudLeaderboard();
  }

  // Handle URL query params (?room=PT-XXXX or ?br99=BR-XXXX)
  try {
    const params = new URLSearchParams(window.location.search);
    const inviteRoom = params.get('room');
    const inviteBr99 = params.get('br99');
    if (inviteBr99) {
      const code = inviteBr99.trim().toUpperCase();
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'br99'));
      document.querySelectorAll('.mode-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-br99'));
      document.getElementById('inputBr99RoomId').value = code;
      try { window.history.replaceState({}, document.title, window.location.pathname + window.location.hash); } catch (e) {}
      setTimeout(() => { if (typeof br99 !== 'undefined') br99.openOnlineLobby('room', code); }, 250);
    } else if (inviteRoom) {
      const code = inviteRoom.trim().toUpperCase();
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'room'));
      document.querySelectorAll('.mode-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-room'));
      document.getElementById('inputRoomId').value = code;
      try { window.history.replaceState({}, document.title, window.location.pathname + window.location.hash); } catch (e) {}
      setTimeout(() => net.joinRoom(code), 250);
    }
  } catch (e) {}

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    input.pollGamepad();
    if (br99.isOpen) br99.update(dt);
    else battle.update(dt);
    replayPlayer.update(dt);
    puyoEditor.update(dt);
    updateAndDrawFX(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);