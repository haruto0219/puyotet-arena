'use strict';

/* =========================================================================
   SKILLS_BIGBANG.JS — BIG BANG MODE (60s CHARGE + CLASH + SOLO),
   SKILL BATTLE (PPT2-STYLE HP/MP + 3-SLOT DECK + CPU AI + ONLINE SYNC),
   50 SKILLS CATALOG (N:15 / R:15 / SR:10 / SSR:7 / UR:3) & GACHA MODAL
   ========================================================================= */
(function () {
  // -------------------------------------------------------------------------
  // 1. 50 SKILL DEFINITIONS (STRICTLY 15 N + 15 R + 10 SR + 7 SSR + 3 UR = 50)
  // -------------------------------------------------------------------------
  const RARITY_META = {
    N:   { label: 'N',   color: '#94a3b8', bg: 'rgba(148,163,184,0.16)', rate: 0.50, order: 1 },
    R:   { label: 'R',   color: '#38bdf8', bg: 'rgba(56,189,248,0.18)',  rate: 0.30, order: 2 },
    SR:  { label: 'SR',  color: '#c084fc', bg: 'rgba(192,132,252,0.20)', rate: 0.13, order: 3 },
    SSR: { label: 'SSR', color: '#fbbf24', bg: 'rgba(251,191,36,0.22)',  rate: 0.055, order: 4 },
    UR:  { label: 'UR',  color: '#f43f5e', bg: 'rgba(244,63,94,0.24)',   rate: 0.015, order: 5 }
  };

  const SKILLS = [
    // === N (15種) ===
    { id: 'sk_n01', name: 'あかへんか・小', rarity: 'N', icon: '🔴', cat: 'color', mp: 20, cd: 9,  hp: 40, atk: 8,  def: 6,  mpr: 0.3, effect: 'color_change', targetColor: 1, power: 1, desc: '盤面の1色を赤ぷよに変換（テトリスは下段1行の穴を1つ埋める）' },
    { id: 'sk_n02', name: 'あおへんか・小', rarity: 'N', icon: '🔵', cat: 'color', mp: 20, cd: 9,  hp: 45, atk: 7,  def: 7,  mpr: 0.3, effect: 'color_change', targetColor: 2, power: 1, desc: '盤面の1色を青ぷよに変換（テトリスは下段1行の穴を1つ埋める）' },
    { id: 'sk_n03', name: 'みどりへんか・小', rarity: 'N', icon: '🟢', cat: 'color', mp: 20, cd: 9, hp: 50, atk: 6,  def: 8,  mpr: 0.3, effect: 'color_change', targetColor: 3, power: 1, desc: '盤面の1色を緑ぷよに変換（テトリスは下段1行の穴を1つ埋める）' },
    { id: 'sk_n04', name: 'きいろへんか・小', rarity: 'N', icon: '🟡', cat: 'color', mp: 20, cd: 9, hp: 40, atk: 9,  def: 5,  mpr: 0.4, effect: 'color_change', targetColor: 4, power: 1, desc: '盤面の1色を黄ぷよに変換（テトリスは下段1行の穴を1つ埋める）' },
    { id: 'sk_n05', name: 'ボトムスイープ', rarity: 'N', icon: '🧹', cat: 'clear', mp: 22, cd: 10, hp: 50, atk: 6,  def: 8,  mpr: 0.2, effect: 'clear_rows', power: 2, desc: '盤面の最下段2ラインを即座に消去する' },
    { id: 'sk_n06', name: 'プチヒール', rarity: 'N', icon: '💚', cat: 'heal',  mp: 22, cd: 10, hp: 65, atk: 4,  def: 10, mpr: 0.3, effect: 'heal_hp', power: 110, desc: '自分のHPを110回復する（Lv上昇で回復量UP）' },
    { id: 'sk_n07', name: 'マナスパーク', rarity: 'N', icon: '💧', cat: 'heal',  mp: 10, cd: 12, hp: 35, atk: 6,  def: 6,  mpr: 0.7, effect: 'charge_mp', power: 28, desc: '自分のMPを即座に28回復する' },
    { id: 'sk_n08', name: 'アイアンガード', rarity: 'N', icon: '🛡️', cat: 'buff', mp: 20, cd: 11, hp: 60, atk: 4,  def: 12, mpr: 0.2, effect: 'shield', power: 120, desc: '120ダメージを防ぐ防御シールドを展開する' },
    { id: 'sk_n09', name: 'パワーアップ・小', rarity: 'N', icon: '⚔️', cat: 'buff', mp: 22, cd: 12, hp: 40, atk: 12, def: 5,  mpr: 0.2, effect: 'atk_up', power: 0.20, dur: 10, desc: '10秒間、自分の攻撃力+20%' },
    { id: 'sk_n10', name: 'ガードアップ・小', rarity: 'N', icon: '🧱', cat: 'buff', mp: 22, cd: 12, hp: 55, atk: 5,  def: 12, mpr: 0.2, effect: 'def_up', power: 0.20, dur: 10, desc: '10秒間、受けるダメージを20%軽減' },
    { id: 'sk_n11', name: 'おじゃま浄化・小', rarity: 'N', icon: '✨', cat: 'clear', mp: 24, cd: 10, hp: 50, atk: 7,  def: 9,  mpr: 0.3, effect: 'purge_ojama', power: 6, desc: '盤面のおじゃまぷよ6個（またはテトリスおじゃま2行）を消去' },
    { id: 'sk_n12', name: 'フェザーフォール', rarity: 'N', icon: '🪶', cat: 'buff', mp: 18, cd: 11, hp: 45, atk: 5,  def: 8,  mpr: 0.4, effect: 'grav_down', power: 0.45, dur: 9, desc: '9秒間、自分の落下速度を大幅に緩やかにする' },
    { id: 'sk_n13', name: 'グラビティプレス', rarity: 'N', icon: '⬇️', cat: 'debuff', mp: 24, cd: 12, hp: 40, atk: 10, def: 6, mpr: 0.3, effect: 'opp_grav_up', power: 2.2, dur: 7, desc: '7秒間、相手の落下速度を2.2倍に加速する' },
    { id: 'sk_n14', name: 'Iミノコール', rarity: 'N', icon: '🟦', cat: 'clear', mp: 18, cd: 9,  hp: 45, atk: 9,  def: 6,  mpr: 0.3, effect: 'summon_mino', mino: 'I', power: 2, desc: 'NEXT先頭2個をIミノに変更（ぷよは同色ゾロ目ツモ2連続）' },
    { id: 'sk_n15', name: 'マジックボルト', rarity: 'N', icon: '⚡', cat: 'attack', mp: 25, cd: 10, hp: 35, atk: 13, def: 5,  mpr: 0.3, effect: 'direct_dmg', power: 95, desc: '相手のHPに95の直接ダメージを与える' },

    // === R (15種) ===
    { id: 'sk_r01', name: 'クリムゾンシフト', rarity: 'R', icon: '🔥', cat: 'color', mp: 28, cd: 11, hp: 75, atk: 15, def: 10, mpr: 0.5, effect: 'color_change', targetColor: 1, power: 2, desc: '盤面の2色を赤ぷよへ統一（テトリスは下段2行の穴を修復）' },
    { id: 'sk_r02', name: 'アクアシフト', rarity: 'R', icon: '🌊', cat: 'color', mp: 28, cd: 11, hp: 85, atk: 13, def: 12, mpr: 0.5, effect: 'color_change', targetColor: 2, power: 2, desc: '盤面の2色を青ぷよへ統一（テトリスは下段2行の穴を修復）' },
    { id: 'sk_r03', name: 'エメラルドシフト', rarity: 'R', icon: '🍃', cat: 'color', mp: 28, cd: 11, hp: 90, atk: 12, def: 14, mpr: 0.5, effect: 'color_change', targetColor: 3, power: 2, desc: '盤面の2色を緑ぷよへ統一（テトリスは下段2行の穴を修復）' },
    { id: 'sk_r04', name: 'サンダーシフト', rarity: 'R', icon: '🌟', cat: 'color', mp: 28, cd: 11, hp: 75, atk: 16, def: 9,  mpr: 0.6, effect: 'color_change', targetColor: 4, power: 2, desc: '盤面の2色を黄ぷよへ統一（テトリスは下段2行の穴を修復）' },
    { id: 'sk_r05', name: 'グラウンドブレイク', rarity: 'R', icon: '💥', cat: 'clear', mp: 30, cd: 12, hp: 85, atk: 14, def: 12, mpr: 0.4, effect: 'clear_rows', power: 3, desc: '盤面の最下段3ラインを一掃し攻撃力に変換する' },
    { id: 'sk_r06', name: 'キュアライト', rarity: 'R', icon: '💖', cat: 'heal',  mp: 30, cd: 12, hp: 110, atk: 8, def: 16, mpr: 0.5, effect: 'heal_hp', power: 185, desc: '自分のHPを185回復する' },
    { id: 'sk_r07', name: 'エーテルフロー', rarity: 'R', icon: '💎', cat: 'heal',  mp: 12, cd: 14, hp: 70, atk: 11, def: 10, mpr: 1.0, effect: 'charge_mp', power: 42, desc: '自分のMPを即座に42回復する' },
    { id: 'sk_r08', name: 'イージスウォール', rarity: 'R', icon: '🔰', cat: 'buff', mp: 28, cd: 13, hp: 105, atk: 8, def: 18, mpr: 0.4, effect: 'shield', power: 210, desc: '210ダメージを防ぐ強固なシールドを展開する' },
    { id: 'sk_r09', name: 'バーサークオーラ', rarity: 'R', icon: '😡', cat: 'buff', mp: 30, cd: 14, hp: 70, atk: 20, def: 8,  mpr: 0.4, effect: 'atk_up', power: 0.35, dur: 12, desc: '12秒間、自分の攻撃力+35%' },
    { id: 'sk_r10', name: 'フォートレス', rarity: 'R', icon: '🏰', cat: 'buff', mp: 30, cd: 14, hp: 100, atk: 9, def: 20, mpr: 0.4, effect: 'def_up', power: 0.35, dur: 12, desc: '12秒間、受けるダメージを35%軽減' },
    { id: 'sk_r11', name: 'おじゃま相殺波', rarity: 'R', icon: '🌀', cat: 'clear', mp: 26, cd: 11, hp: 85, atk: 12, def: 15, mpr: 0.5, effect: 'cancel_garbage', power: 8, desc: '保留中のおじゃま予告を最大8ライン（ぷよ32個）相殺する' },
    { id: 'sk_r12', name: 'Tミノ召喚', rarity: 'R', icon: '🟪', cat: 'clear', mp: 24, cd: 11, hp: 75, atk: 17, def: 10, mpr: 0.5, effect: 'summon_mino', mino: 'T', power: 3, desc: 'NEXT先頭3個をTミノに変更（ぷよは同色ゾロ目ツモ3連続）' },
    { id: 'sk_r13', name: 'マナドレイン', rarity: 'R', icon: '🦇', cat: 'debuff', mp: 25, cd: 13, hp: 80, atk: 14, def: 11, mpr: 0.7, effect: 'mp_drain', power: 26, desc: '相手のMPを26奪い、自分のMPを回復する' },
    { id: 'sk_r14', name: 'ヘビーグラビティ', rarity: 'R', icon: '⚓', cat: 'debuff', mp: 30, cd: 14, hp: 75, atk: 16, def: 11, mpr: 0.5, effect: 'opp_grav_up', power: 3.2, dur: 9, desc: '9秒間、相手の落下速度を3.2倍に加速する' },
    { id: 'sk_r15', name: 'おじゃまバラージ', rarity: 'R', icon: '☄️', cat: 'attack', mp: 32, cd: 12, hp: 70, atk: 18, def: 9,  mpr: 0.4, effect: 'mega_garbage', power: 3, desc: '相手におじゃま3ライン（ぷよ12個）＋直接ダメージ60を送る' },

    // === SR (10種) ===
    { id: 'sk_sr01', name: 'プリズムチェンジ', rarity: 'SR', icon: '🌈', cat: 'color', mp: 38, cd: 14, hp: 130, atk: 24, def: 18, mpr: 0.8, effect: 'color_change', targetColor: 0, power: 3, desc: '盤面のぷよを2色に集約し大連鎖を誘発（テトリスは下段3行を整理）' },
    { id: 'sk_sr02', name: 'アビスイレイサー', rarity: 'SR', icon: '🌌', cat: 'clear', mp: 38, cd: 14, hp: 135, atk: 22, def: 20, mpr: 0.7, effect: 'clear_rows', power: 4, desc: '盤面の最下段4ラインを消滅させ、特大ボーナス攻撃を放つ' },
    { id: 'sk_sr03', name: 'ホーリーピュリファイ', rarity: 'SR', icon: '🕊️', cat: 'clear', mp: 35, cd: 13, hp: 145, atk: 18, def: 24, mpr: 0.8, effect: 'purge_ojama', power: 99, desc: '盤面と予告のおじゃまを全て完全浄化し、HPを100回復する' },
    { id: 'sk_sr04', name: 'リジェネレーション', rarity: 'SR', icon: '🌸', cat: 'heal',  mp: 38, cd: 15, hp: 170, atk: 14, def: 26, mpr: 0.8, effect: 'heal_hp', power: 290, desc: '自分のHPを290回復し、さらに防御シールド80を付与' },
    { id: 'sk_sr05', name: 'タイムディレーション', rarity: 'SR', icon: '⏳', cat: 'buff', mp: 32, cd: 15, hp: 125, atk: 20, def: 22, mpr: 1.0, effect: 'grav_down', power: 0.25, dur: 12, desc: '12秒間、自分の落下速度を1/4にスロー化＆MP回復+15' },
    { id: 'sk_sr06', name: 'ドラゴニックレイジ', rarity: 'SR', icon: '🐉', cat: 'buff', mp: 38, cd: 16, hp: 120, atk: 32, def: 14, mpr: 0.7, effect: 'atk_up', power: 0.55, dur: 14, desc: '14秒間、自分の攻撃力+55%' },
    { id: 'sk_sr07', name: 'アブソリュートガード', rarity: 'SR', icon: '💠', cat: 'buff', mp: 38, cd: 16, hp: 160, atk: 14, def: 32, mpr: 0.7, effect: 'shield', power: 340, desc: '340ダメージを吸収する絶対防御バリアを展開する' },
    { id: 'sk_sr08', name: 'ソウルサイフォン', rarity: 'SR', icon: '👻', cat: 'debuff', mp: 34, cd: 15, hp: 125, atk: 25, def: 18, mpr: 1.1, effect: 'mp_drain', power: 40, desc: '相手のMPを40奪い、さらにHPに110直接ダメージ' },
    { id: 'sk_sr09', name: 'メテオストライク', rarity: 'SR', icon: '🌠', cat: 'attack', mp: 42, cd: 15, hp: 115, atk: 30, def: 15, mpr: 0.7, effect: 'direct_dmg', power: 220, desc: '相手のHPに220の強烈な直接ダメージを与える' },
    { id: 'sk_sr10', name: 'カオスストーム', rarity: 'SR', icon: '🌪️', cat: 'attack', mp: 42, cd: 15, hp: 120, atk: 28, def: 16, mpr: 0.7, effect: 'mega_garbage', power: 5, desc: '相手におじゃま5ライン（ぷよ20個）＋直接ダメージ100を送る' },

    // === SSR (7種) ===
    { id: 'sk_ssr01', name: 'ばよえ〜ん・極', rarity: 'SSR', icon: '💫', cat: 'color', mp: 48, cd: 18, hp: 190, atk: 36, def: 28, mpr: 1.1, effect: 'all_clear_support', power: 1, desc: '盤面を全消し寸前の連鎖・PC形に整え、攻撃力+30%（10秒）' },
    { id: 'sk_ssr02', name: 'スターライトヒール', rarity: 'SSR', icon: '⭐', cat: 'heal',  mp: 46, cd: 18, hp: 230, atk: 22, def: 36, mpr: 1.2, effect: 'heal_hp', power: 420, desc: 'HPを420大回復し、保留おじゃまを全相殺する' },
    { id: 'sk_ssr03', name: 'セレスティアルイージス', rarity: 'SSR', icon: '👼', cat: 'buff', mp: 45, cd: 18, hp: 220, atk: 24, def: 40, mpr: 1.1, effect: 'shield', power: 480, desc: '480ダメージ吸収シールド＋12秒間防御力+40%' },
    { id: 'sk_ssr04', name: 'オーバーロード', rarity: 'SSR', icon: '🔱', cat: 'buff', mp: 46, cd: 18, hp: 175, atk: 44, def: 22, mpr: 1.1, effect: 'atk_up', power: 0.75, dur: 15, desc: '15秒間、攻撃力+75%＆NEXT先頭3個を最適ミノ/ゾロ目に' },
    { id: 'sk_ssr05', name: 'ブラックホール', rarity: 'SSR', icon: '🕳️', cat: 'debuff', mp: 48, cd: 19, hp: 185, atk: 38, def: 26, mpr: 1.2, effect: 'opp_grav_up', power: 5.0, dur: 11, desc: '11秒間相手の重力5倍＆MP35奪取＆おじゃま3ライン送信' },
    { id: 'sk_ssr06', name: 'スーパーノヴァ', rarity: 'SSR', icon: '☀️', cat: 'attack', mp: 52, cd: 19, hp: 170, atk: 45, def: 22, mpr: 1.0, effect: 'direct_dmg', power: 340, desc: '相手のHPに340の超直接ダメージ＋おじゃま3ライン送信' },
    { id: 'sk_ssr07', name: 'ディメンションクリア', rarity: 'SSR', icon: '🌀', cat: 'clear', mp: 45, cd: 17, hp: 200, atk: 34, def: 30, mpr: 1.2, effect: 'clear_rows', power: 6, desc: '盤面下段6ラインを異次元消去＋HP150回復＋おじゃま全相殺' },

    // === UR (3種) ===
    { id: 'sk_ur01', name: '神話創世・ビッグバン', rarity: 'UR', icon: '💥', cat: 'attack', mp: 60, cd: 22, hp: 260, atk: 60, def: 38, mpr: 1.5, effect: 'direct_dmg', power: 460, desc: '【UR】相手HPに460直接ダメージ＋おじゃま6ライン＋10秒間攻撃力+60%' },
    { id: 'sk_ur02', name: '時空超越・クロノス', rarity: 'UR', icon: '👑', cat: 'buff',   mp: 55, cd: 22, hp: 300, atk: 46, def: 50, mpr: 1.8, effect: 'all_clear_support', power: 2, desc: '【UR】盤面全浄化＋HP350回復＋シールド350＋相手MP45吸収' },
    { id: 'sk_ur03', name: '終焉のアルテマチェイン', rarity: 'UR', icon: '🌌', cat: 'color', mp: 58, cd: 22, hp: 270, atk: 58, def: 42, mpr: 1.6, effect: 'color_change', targetColor: 0, power: 4, desc: '【UR】盤面を究極連鎖/PC形へ再構築＋直接ダメージ280＋防御+40%' }
  ];

  const SKILL_MAP = {};
  SKILLS.forEach(s => { SKILL_MAP[s.id] = s; });

  const STARTER_SKILLS = { sk_n01: 1, sk_n06: 1, sk_n15: 1 };
  const STARTER_EQUIPPED = ['sk_n01', 'sk_n06', 'sk_n15'];
  const GACHA_COST_1 = 500;
  const GACHA_COST_10 = 4500;
  const MAX_SKILL_LV = 5;
  const MAX_LV_REFUND = 150;

  function getSkillLevel(skillId) {
    if (!profile || !profile.ownedSkills) return 0;
    const lv = profile.ownedSkills[skillId];
    return (typeof lv === 'number' && lv >= 1) ? Math.min(MAX_SKILL_LV, Math.floor(lv)) : 0;
  }

  function getSkillScaledStats(skillId, lv = 1) {
    const def = SKILL_MAP[skillId];
    if (!def) return { hp: 0, atk: 0, def: 0, mpr: 0, mult: 1 };
    const L = Math.max(1, Math.min(MAX_SKILL_LV, lv || 1));
    const mult = 1 + (L - 1) * 0.20;
    return {
      hp: Math.round(def.hp * mult),
      atk: Math.round(def.atk * mult),
      def: Math.round(def.def * mult),
      mpr: Math.round(def.mpr * mult * 10) / 10,
      mult
    };
  }

  function computeTeamStats(equippedIds, ownedMap) {
    let hp = 1000, atk = 100, def = 100, mpr = 2.6;
    const list = Array.isArray(equippedIds) ? equippedIds.slice(0, 3) : [];
    for (const id of list) {
      if (!id || !SKILL_MAP[id]) continue;
      const lv = (ownedMap && ownedMap[id]) ? ownedMap[id] : 1;
      const st = getSkillScaledStats(id, lv);
      hp += st.hp;
      atk += st.atk;
      def += st.def;
      mpr += st.mpr;
    }
    return { hp, atk, def, mpr: Math.round(mpr * 10) / 10 };
  }

  function ensurePlayerSkillsInitialized() {
    if (!profile) return;
    if (!profile.ownedSkills || typeof profile.ownedSkills !== 'object' || Object.keys(profile.ownedSkills).length === 0) {
      profile.ownedSkills = { ...STARTER_SKILLS };
    }
    if (!Array.isArray(profile.equippedSkills) || profile.equippedSkills.length === 0) {
      const owned = Object.keys(profile.ownedSkills).filter(id => SKILL_MAP[id]);
      profile.equippedSkills = owned.slice(0, 3);
    }
  }

  // -------------------------------------------------------------------------
  // 2. GACHA ENGINE (500 / 4500 COINS, 10-PULL R+ GUARANTEE, LV UP / REFUND)
  // -------------------------------------------------------------------------
  function rollSingleRarity(guaranteeRPlus = false) {
    const r = Math.random();
    if (guaranteeRPlus) {
      // Normalized R / SR / SSR / UR (total 0.50 -> scaled to 1.0)
      if (r < 0.03) return 'UR';
      if (r < 0.14) return 'SSR';
      if (r < 0.40) return 'SR';
      return 'R';
    }
    if (r < 0.015) return 'UR';
    if (r < 0.070) return 'SSR';
    if (r < 0.200) return 'SR';
    if (r < 0.500) return 'R';
    return 'N';
  }

  function pullGacha(count) {
    ensurePlayerSkillsInitialized();
    const cost = count === 10 ? GACHA_COST_10 : GACHA_COST_1;
    if ((profile.coins || 0) < cost) {
      if (typeof showToast === 'function') showToast(`コインが足りません（必要: ${cost.toLocaleString()}🪙）`);
      return null;
    }
    profile.coins -= cost;
    profile.skillGachaCount = (profile.skillGachaCount || 0) + count;

    const results = [];
    let totalRefund = 0;
    for (let i = 0; i < count; i++) {
      const isLast10 = (count === 10 && i === 9);
      const rarity = rollSingleRarity(isLast10);
      const pool = SKILLS.filter(s => s.rarity === rarity);
      const picked = pool[Math.floor(Math.random() * pool.length)] || SKILLS[0];
      const prevLv = profile.ownedSkills[picked.id] || 0;
      let status = 'new';
      let newLv = 1;
      let refund = 0;
      if (prevLv === 0) {
        profile.ownedSkills[picked.id] = 1;
        status = 'new';
        newLv = 1;
      } else if (prevLv < MAX_SKILL_LV) {
        newLv = prevLv + 1;
        profile.ownedSkills[picked.id] = newLv;
        status = 'lvup';
      } else {
        newLv = MAX_SKILL_LV;
        status = 'refund';
        refund = MAX_LV_REFUND;
        totalRefund += refund;
      }
      results.push({ skill: picked, status, prevLv, newLv, refund });
    }
    if (totalRefund > 0) profile.coins += totalRefund;

    saveProfile(profile);
    if (typeof renderProfileUI === 'function') renderProfileUI();
    if (typeof sound !== 'undefined') {
      const hasHigh = results.some(x => x.skill.rarity === 'UR' || x.skill.rarity === 'SSR');
      sound.playSE(hasHigh ? 'rankUp' : 'coinGet');
    }
    return { results, cost, totalRefund };
  }

  // -------------------------------------------------------------------------
  // 3. BIG BANG TEMPLATES — PUYO FEVER CHAIN SEEDS (Lv3..Lv12) & TETRIS LUCKY ATTACK
  // -------------------------------------------------------------------------
  function makePuyoGridFromRows(rowsFromBottom) {
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

  // Procedural guaranteed staircase + return-fold chain seed generator for 3..12+ chains!
  // Builds a clean, verified multi-chain structure where dropping the trigger pair on col 0 ignites N chains.
  function buildPuyoChainSeed(targetChains) {
    const nChains = Math.max(3, Math.min(10, targetChains));
    const g = Array.from({ length: 13 }, () => Array(6).fill(0));
    const palette = [1, 2, 3, 4];
    const offset = Math.floor(Math.random() * 4);
    const rotCol = (idx) => palette[((idx + offset) % 4 + 4) % 4];

    // Bottom tier colors (cols 0..bottomCount-1), strictly cyclic 4 colors so adjacent cols never match
    const bottomCount = Math.min(6, nChains);
    const bot = [];
    for (let c = 0; c < bottomCount; c++) {
      bot[c] = rotCol(c);
      g[12][c] = bot[c];
      g[11][c] = bot[c];
      if (c > 0) {
        g[10][c] = bot[c - 1];
        g[9][c] = bot[c];
        g[8][c] = bot[c];
      }
    }

    if (nChains > 6) {
      // Upper tier (chains 7..10) folding R->L across cols 5..1 with guaranteed collision-free colors!
      // Col 5 gets 1 extra bot[5] at row 7 so col 5 drops by 6 rows while cols 1..4 drop by 5 rows.
      // For each upper chain k = 0..(extra-1):
      //   Main 3-stack sits at col c = (5 - k), rows 6, 5, 4.
      //   1 connector sits at col (c - 1), row 7 (which drops 5 rows to row 12 and meets col c row 12!).
      // Constraints for upper[k] so ZERO cells touch any same-color cell at t=0 or during chains 1..6:
      //   - upper[k] !== bot[c]       (col c row 6 sits on col c row 7/8)
      //   - upper[k] !== bot[c - 1]   (col c-1 row 7 sits directly on col c-1 row 8!)
      //   - if k > 0: upper[k] !== upper[k - 1] (col c row 6,5,4 sits next to col c+1 row 6,5,4)
      //   - if k === 1: upper[1] !== bot[5] (col 4 row 7 is upper[0], col 4 row 6 sits next to col 5 row 6 = upper[0])
      // Note: 3 forbidden colors max out of 4 palette colors -> ALWAYS at least 1 valid color!
      const extra = nChains - 6; // 1..4 (chains 7..10)
      g[7][5] = bot[5];
      const upper = [];
      for (let k = 0; k < extra; k++) {
        const c = 5 - k; // 5, 4, 3, 2
        // Reverse-cyclic color assignment: rotCol(3 - k) guarantees chosen !== bot[c-1], bot[c], bot[c+1], upper[k-1]
        const chosen = rotCol(3 - k);
        upper[k] = chosen;
        g[6][c] = chosen;
        g[5][c] = chosen;
        g[4][c] = chosen;
        g[7][c - 1] = chosen;
      }
    }

    return {
      grid: g,
      triggerPairs: [
        { axis: bot[0], child: bot[0] },
        { axis: bot[0], child: bot[1] }
      ],
      chains: nChains,
      hint: `左端に落として ${nChains}連鎖発火！`
    };
  }

  // Tetris Lucky Attack Templates (guaranteed 1-3 piece Tetris / TSD / Perfect Clear!)
  function makeTetrisGridFromRows(rowsFromBottom) {
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

  const LUCKY_ATTACK_TEMPLATES = [
    {
      name: '1手パーフェクトクリア',
      queue: ['I', 'O', 'T', 'J', 'L', 'S', 'Z'],
      rows: [
        'JJJ....LLL'
      ]
    },
    {
      name: '4ライン全消し TETRIS!',
      queue: ['I', 'I', 'O', 'T', 'J', 'L', 'S'],
      rows: [
        'JJJJJJJJJ.',
        'LLLLLLLLL.',
        'SSSSSSSSS.',
        'ZZZZZZZZZ.'
      ]
    },
    {
      name: '2手PC (O＋I)',
      queue: ['O', 'I', 'T', 'J', 'L', 'S', 'Z'],
      rows: [
        'TT..TTTTTT',
        'TT......TT'
      ]
    },
    {
      name: 'T-Spin Double → PC!',
      queue: ['T', 'I', 'O', 'J', 'L', 'S', 'Z'],
      rows: [
        'JJJ....LLL',
        'JJJJ...LLL',
        'JJJJJ.LLLL'
      ]
    },
    {
      name: '2手PC (J＋L)',
      queue: ['J', 'L', 'I', 'O', 'T', 'S', 'Z'],
      rows: [
        'SS......ZZ',
        'SSSS..ZZZZ'
      ]
    },
    {
      name: 'ダブルTETRIS (8ライン全消し)',
      queue: ['I', 'I', 'O', 'T', 'J', 'L', 'S'],
      rows: [
        'JJJJJJJJJ.',
        'LLLLLLLLL.',
        'SSSSSSSSS.',
        'ZZZZZZZZZ.',
        'JJJJJJJJJ.',
        'LLLLLLLLL.',
        'SSSSSSSSS.',
        'ZZZZZZZZZ.'
      ]
    },
    {
      name: '3連続REN → 全消し!',
      queue: ['I', 'O', 'I', 'T', 'J', 'L', 'S'],
      rows: [
        'JJJ....LLL',
        'JJJJ..LLLL',
        'JJJJ..LLLL',
        'JJJ....LLL'
      ]
    },
    {
      name: '左右対称 2手PC (O＋O)',
      queue: ['O', 'O', 'I', 'T', 'J', 'L', 'S'],
      rows: [
        'JJ..TT..LL',
        'JJ..TT..LL'
      ]
    },
    {
      name: '中央縦穴 TETRIS PC!',
      queue: ['I', 'O', 'T', 'J', 'L', 'S', 'Z'],
      rows: [
        'JJJJ.LLLLL',
        'SSSS.ZZZZZ',
        'TTTT.OOOOO',
        'JJJJ.LLLLL'
      ]
    },
    {
      name: 'T-Spin＋TETRIS コンボ!',
      queue: ['T', 'I', 'O', 'J', 'L', 'S', 'Z'],
      rows: [
        'JJJJ...LLL',
        'JJJJJ.LLLL',
        'SSSSSSSSS.',
        'ZZZZZZZZZ.',
        'JJJJJJJJJ.',
        'LLLLLLLLL.'
      ]
    }
  ];

  // -------------------------------------------------------------------------
  // 4. BATTLE RUNTIME STATE (BIG BANG & SKILL BATTLE)
  // -------------------------------------------------------------------------
  const bbState = {
    active: false,
    isSolo: false,
    phase: 'charge', // 'charge' | 'clash'
    chargeTimer: 60.0,
    clashTimer: 0,
    selfHp: 1000,
    selfMaxHp: 1000,
    oppHp: 1000,
    oppMaxHp: 1000,
    selfCharge: 0,
    oppCharge: 0,
    selfLevel: 3,
    oppLevel: 3,
    selfClears: 0,
    oppClears: 0,
    selfTemplateIdx: 0,
    oppTemplateIdx: 0,
    selfPendingNext: false,
    oppPendingNext: false,
    lastSecInt: 60
  };

  const skState = {
    active: false,
    selfHp: 1000,
    selfMaxHp: 1000,
    selfMp: 30,
    selfMaxMp: 100,
    selfShield: 0,
    selfStats: { hp: 1000, atk: 100, def: 100, mpr: 2.6 },
    selfBuffs: { atkBonus: 0, atkTimer: 0, defBonus: 0, defTimer: 0, gravMult: 1, gravTimer: 0 },
    selfSkills: [], // [{ id, lv, cd: 0 }]

    oppHp: 1000,
    oppMaxHp: 1000,
    oppMp: 30,
    oppMaxMp: 100,
    oppShield: 0,
    oppStats: { hp: 1000, atk: 100, def: 100, mpr: 2.6 },
    oppBuffs: { atkBonus: 0, atkTimer: 0, defBonus: 0, defTimer: 0, gravMult: 1, gravTimer: 0 },
    oppSkills: [],
    cpuThinkTimer: 1.5,
    cutinTimer: 0
  };

  function pickCpuSkills(diff) {
    const pools = {
      easy:       SKILLS.filter(s => s.rarity === 'N'),
      normal:     SKILLS.filter(s => s.rarity === 'N' || s.rarity === 'R'),
      hard:       SKILLS.filter(s => s.rarity === 'R' || s.rarity === 'SR'),
      impossible: SKILLS.filter(s => s.rarity === 'SR' || s.rarity === 'SSR' || s.rarity === 'UR')
    };
    const lvMap = { easy: 1, normal: 2, hard: 3, impossible: 5 };
    const pool = (pools[diff] || pools.normal).slice();
    const chosen = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const s = pool.splice(idx, 1)[0];
      chosen.push({ id: s.id, lv: lvMap[diff] || 2, cd: 2 + i * 1.5 });
    }
    return chosen;
  }

  function loadBigBangBoard(b, isSelf, isResetPenalty = false) {
    if (!b) return;
    const style = b instanceof TetrisBoard ? 'tetris' : 'puyo';
    if (style === 'puyo') {
      if (isResetPenalty) {
        if (isSelf) bbState.selfLevel = Math.max(3, bbState.selfLevel - 1);
        else bbState.oppLevel = Math.max(3, bbState.oppLevel - 1);
      }
      const lv = isSelf ? bbState.selfLevel : bbState.oppLevel;
      const seed = buildPuyoChainSeed(lv);
      b.grid = seed.grid;
      b.dead = false;
      b.phase = 'active';
      b.chain = 0;
      b.popCells = [];
      b.pendingGarbage = 0;
      b.gravTimer = 0;
      b.lockTimer = 0;
      b.current = { x: 2, y: 1, rot: 0, axis: seed.triggerPairs[0].axis, child: seed.triggerPairs[0].child };
      b.queue = [
        [seed.triggerPairs[1].axis, seed.triggerPairs[1].child],
        b.randPair(), b.randPair(), b.randPair(), b.randPair()
      ];
      b.addPopup(`${seed.chains}連鎖のタネ!`, '#fde047');
    } else {
      const idx = isSelf ? bbState.selfTemplateIdx : bbState.oppTemplateIdx;
      const tpl = LUCKY_ATTACK_TEMPLATES[idx % LUCKY_ATTACK_TEMPLATES.length];
      b.grid = makeTetrisGridFromRows(tpl.rows);
      b.dead = false;
      b.pendingGarbage = 0;
      b.garbageQueue = [];
      b.gravTimer = 0;
      b.lockTimer = 0;
      b.combo = -1;
      b.queue = tpl.queue.slice();
      b.current = null;
      b.spawnNext();
      b.addPopup(`LUCKY: ${tpl.name}`, '#00f0ff');
    }
  }

  // -------------------------------------------------------------------------
  // 5. SKILL EXECUTION ENGINE (ALL 50 SKILLS WORK LIVE IN BATTLE)
  // -------------------------------------------------------------------------
  function showSkillCutin(isSelf, skill, lv) {
    const el = document.getElementById('skillCutinBanner');
    if (!el) return;
    const rar = RARITY_META[skill.rarity] || RARITY_META.N;
    el.innerHTML = `
      <span class="sk-cutin-rar" style="background:${rar.bg};color:${rar.color};border-color:${rar.color};">${skill.rarity} Lv.${lv}</span>
      <span class="sk-cutin-icon">${skill.icon}</span>
      <span class="sk-cutin-name">${skill.name}</span>
      <span class="sk-cutin-who">${isSelf ? 'YOU' : 'OPPONENT'}</span>
    `;
    el.className = 'skill-cutin-banner active ' + (isSelf ? 'self' : 'opp');
    skState.cutinTimer = 2.0;
  }

  function applyDamageToSide(targetIsSelf, rawDmg, battleRef) {
    if (!skState.active || rawDmg <= 0) return 0;
    const defStat = targetIsSelf ? skState.selfStats.def : skState.oppStats.def;
    const buffs = targetIsSelf ? skState.selfBuffs : skState.oppBuffs;
    const defMult = Math.max(0.35, 100 / Math.max(60, defStat)) * Math.max(0.35, 1 - (buffs.defBonus || 0));
    let dmg = Math.max(5, Math.round(rawDmg * defMult));

    // Absorb with shield first
    if (targetIsSelf) {
      if (skState.selfShield > 0) {
        const abs = Math.min(skState.selfShield, dmg);
        skState.selfShield -= abs;
        dmg -= abs;
      }
      skState.selfHp = Math.max(0, skState.selfHp - dmg);
      if (dmg > 0) battleRef.triggerShake(true, Math.min(10, 3 + dmg / 60), 0.22);
      if (skState.selfHp <= 0 && !battleRef.ended && !battleRef.roundIntermission) {
        if (battleRef.isOnline && typeof net !== 'undefined') net.send({ type: 'ko' });
        battleRef.onRoundEnd(false, 'HPが0になりました...');
      }
    } else {
      if (skState.oppShield > 0) {
        const abs = Math.min(skState.oppShield, dmg);
        skState.oppShield -= abs;
        dmg -= abs;
      }
      skState.oppHp = Math.max(0, skState.oppHp - dmg);
      if (dmg > 0) battleRef.triggerShake(false, Math.min(10, 3 + dmg / 60), 0.22);
      if (skState.oppHp <= 0 && !battleRef.ended && !battleRef.roundIntermission) {
        if (!battleRef.isOnline) {
          battleRef.onRoundEnd(true, '相手のHPを0にしました！');
        }
      }
    }
    return dmg;
  }

  function applyBoardColorChange(board, targetColor, power) {
    if (!board) return;
    if (board instanceof PuyoBoard) {
      // Find color counts on board
      const counts = {};
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          const v = board.grid[r][c];
          if (v >= 1 && v <= 5) counts[v] = (counts[v] || 0) + 1;
        }
      }
      const colors = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a]);
      if (colors.length === 0) return;
      const dest = (targetColor >= 1 && targetColor <= 4) ? targetColor : colors[0];
      const toConvert = colors.filter(c => c !== dest).slice(0, Math.max(1, power));
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          if (toConvert.includes(board.grid[r][c])) {
            board.grid[r][c] = dest;
            board.triggerSquish(c, r);
          }
        }
      }
      if (board.phase === 'active' && board.findPopGroups().length > 0) {
        if (board.current) {
          board.queue.unshift([board.current.axis, board.current.child]);
          board.current = null;
        }
        board.phase = 'check';
        board.phaseTimer = 0.08;
      }
      board.addPopup('COLOR CHANGE!', '#fde047');
    } else if (board instanceof TetrisBoard) {
      // Fill holes in bottom N rows and clear any completed rows
      const maxRows = Math.min(6, Math.max(1, power));
      let filled = 0;
      for (let r = board.rows - 1; r >= board.rows - maxRows && r >= 2; r--) {
        const hasAny = board.grid[r].some(cell => cell !== null);
        if (!hasAny) continue;
        for (let c = 0; c < board.cols; c++) {
          if (board.grid[r][c] === null) {
            board.grid[r][c] = 'I';
            filled++;
            if (power === 1) break;
          }
        }
      }
      // Clear full rows
      let cleared = 0;
      for (let r = board.rows - 1; r >= 0; r--) {
        if (board.grid[r].every(cell => cell !== null)) {
          board.clearFlash.push({ row: r, alpha: 1 });
          board.grid.splice(r, 1);
          board.grid.unshift(Array(board.cols).fill(null));
          cleared++;
          r++;
        }
      }
      board.addPopup(cleared > 0 ? `SHIFT CLEAR x${cleared}!` : 'BOARD SHIFT!', '#00f0ff');
    }
  }

  function applyBoardClearRows(board, rowCount) {
    if (!board) return;
    const n = Math.min(8, Math.max(1, rowCount));
    if (board instanceof TetrisBoard) {
      for (let i = 0; i < n; i++) {
        board.clearFlash.push({ row: board.rows - 1 - i, alpha: 1 });
        board.grid.pop();
        board.grid.unshift(Array(board.cols).fill(null));
      }
      board.addPopup(`ERASE ${n}L!`, '#38bdf8');
    } else if (board instanceof PuyoBoard) {
      for (let i = 0; i < n; i++) {
        board.grid.pop();
        board.grid.unshift(Array(board.cols).fill(0));
      }
      board.addPopup(`ERASE ${n}段!`, '#f472b6');
    }
  }

  function applyPurgeOjama(board, power) {
    if (!board) return;
    if (board instanceof PuyoBoard) {
      let rem = power;
      for (let r = board.rows - 1; r >= 0 && rem > 0; r--) {
        for (let c = 0; c < board.cols && rem > 0; c++) {
          if (board.grid[r][c] === 9) {
            board.grid[r][c] = 0;
            rem--;
          }
        }
      }
      if (power >= 90) board.pendingGarbage = 0;
      if (board.phase === 'active') {
        const needsFall = board.hasFloatingPuyo();
        const needsPop = !needsFall && board.findPopGroups().length > 0;
        if (needsFall || needsPop) {
          if (board.current) {
            board.queue.unshift([board.current.axis, board.current.child]);
            board.current = null;
          }
          board.phase = needsFall ? 'falling' : 'check';
          board.phaseTimer = 0.05;
        }
      }
      board.addPopup('OJAMA PURGE!', '#4ade80');
    } else if (board instanceof TetrisBoard) {
      let rowsPurged = 0;
      const limit = power >= 90 ? 20 : Math.max(2, Math.floor(power / 3));
      for (let r = board.rows - 1; r >= 0 && rowsPurged < limit; r--) {
        if (board.grid[r].includes('G')) {
          board.grid.splice(r, 1);
          board.grid.unshift(Array(board.cols).fill(null));
          rowsPurged++;
          r++;
        }
      }
      if (power >= 90) {
        board.garbageQueue = [];
        board.pendingGarbage = 0;
      }
      board.addPopup('GARBAGE PURGE!', '#4ade80');
    }
  }

  function applySummonMino(board, mino, count) {
    if (!board) return;
    if (board instanceof TetrisBoard) {
      for (let i = 0; i < count; i++) board.queue[i] = mino || 'I';
      board.addPopup(`NEXT ${mino || 'I'} x${count}!`, '#00f0ff');
    } else if (board instanceof PuyoBoard) {
      const c = 1 + Math.floor(Math.random() * Math.min(4, board.numColors || 4));
      for (let i = 0; i < count && i < board.queue.length; i++) {
        board.queue[i] = [c, c];
      }
      board.addPopup(`ゾロ目 x${count}!`, '#f472b6');
    }
  }

  function executeSkillEffect(isSelf, skillId, lv, battleRef, fromRemote = false) {
    const skill = SKILL_MAP[skillId];
    if (!skill || !battleRef || !skState.active) return;
    const st = getSkillScaledStats(skillId, lv);
    const myBoard = battleRef.getActiveBoard(isSelf);
    const oppBoard = battleRef.getActiveBoard(!isSelf);
    const myBuffs = isSelf ? skState.selfBuffs : skState.oppBuffs;
    const oppBuffs = isSelf ? skState.oppBuffs : skState.selfBuffs;
    const atkRatio = (isSelf ? skState.selfStats.atk : skState.oppStats.atk) / 100 * (1 + (myBuffs.atkBonus || 0));

    showSkillCutin(isSelf, skill, lv);
    if (typeof sound !== 'undefined') sound.playSE(skill.rarity === 'UR' || skill.rarity === 'SSR' ? 'perfect' : 'swapCombo');
    if (typeof spawnClearEffect === 'function') spawnClearEffect(isSelf, skill.rarity === 'UR' ? 3 : 2, RARITY_META[skill.rarity].color);

    const eff = skill.effect;
    const pow = skill.power || 1;
    const scaledPow = Math.round(pow * st.mult);

    if (eff === 'color_change') {
      applyBoardColorChange(myBoard, skill.targetColor || 0, pow);
      if (skill.id === 'sk_ur03') {
        applyDamageToSide(!isSelf, Math.round(280 * st.mult * atkRatio), battleRef);
        myBuffs.defBonus = Math.max(myBuffs.defBonus, 0.40);
        myBuffs.defTimer = Math.max(myBuffs.defTimer, 12);
      }
    } else if (eff === 'clear_rows') {
      applyBoardClearRows(myBoard, pow);
      if (skill.id === 'sk_ssr07') {
        if (isSelf) skState.selfHp = Math.min(skState.selfMaxHp, skState.selfHp + Math.round(150 * st.mult));
        else skState.oppHp = Math.min(skState.oppMaxHp, skState.oppHp + Math.round(150 * st.mult));
        if (myBoard instanceof TetrisBoard) { myBoard.garbageQueue = []; myBoard.pendingGarbage = 0; }
        else if (myBoard) myBoard.pendingGarbage = 0;
      }
    } else if (eff === 'purge_ojama') {
      applyPurgeOjama(myBoard, pow);
      if (skill.id === 'sk_sr03') {
        if (isSelf) skState.selfHp = Math.min(skState.selfMaxHp, skState.selfHp + Math.round(100 * st.mult));
        else skState.oppHp = Math.min(skState.oppMaxHp, skState.oppHp + Math.round(100 * st.mult));
      }
    } else if (eff === 'heal_hp') {
      const heal = Math.round(pow * st.mult);
      if (isSelf) skState.selfHp = Math.min(skState.selfMaxHp, skState.selfHp + heal);
      else skState.oppHp = Math.min(skState.oppMaxHp, skState.oppHp + heal);
      if (myBoard) myBoard.addPopup(`+${heal} HP!`, '#4ade80');
      if (skill.id === 'sk_sr04') {
        if (isSelf) skState.selfShield += Math.round(80 * st.mult);
        else skState.oppShield += Math.round(80 * st.mult);
      }
      if (skill.id === 'sk_ssr02' && myBoard) {
        if (myBoard instanceof TetrisBoard) { myBoard.garbageQueue = []; myBoard.pendingGarbage = 0; }
        else myBoard.pendingGarbage = 0;
      }
    } else if (eff === 'charge_mp') {
      const gain = Math.round(pow * st.mult);
      if (isSelf) skState.selfMp = Math.min(skState.selfMaxMp, skState.selfMp + gain);
      else skState.oppMp = Math.min(skState.oppMaxMp, skState.oppMp + gain);
      if (myBoard) myBoard.addPopup(`+${gain} MP!`, '#38bdf8');
    } else if (eff === 'shield') {
      const sh = Math.round(pow * st.mult);
      if (isSelf) skState.selfShield += sh;
      else skState.oppShield += sh;
      if (myBoard) myBoard.addPopup(`SHIELD +${sh}`, '#60a5fa');
      if (skill.id === 'sk_ssr03') {
        myBuffs.defBonus = Math.max(myBuffs.defBonus, 0.40);
        myBuffs.defTimer = Math.max(myBuffs.defTimer, 12);
      }
    } else if (eff === 'atk_up') {
      myBuffs.atkBonus = Math.max(myBuffs.atkBonus, pow * (1 + (lv - 1) * 0.1));
      myBuffs.atkTimer = Math.max(myBuffs.atkTimer, skill.dur || 10);
      if (myBoard) myBoard.addPopup(`ATK UP!`, '#f87171');
      if (skill.id === 'sk_ssr04') applySummonMino(myBoard, 'I', 3);
    } else if (eff === 'def_up') {
      myBuffs.defBonus = Math.max(myBuffs.defBonus, pow * (1 + (lv - 1) * 0.1));
      myBuffs.defTimer = Math.max(myBuffs.defTimer, skill.dur || 10);
      if (myBoard) myBoard.addPopup(`DEF UP!`, '#60a5fa');
    } else if (eff === 'grav_down') {
      myBuffs.gravMult = pow;
      myBuffs.gravTimer = Math.max(myBuffs.gravTimer, skill.dur || 10);
      if (myBoard) myBoard.addPopup(`SLOW GRAV!`, '#a855f7');
      if (skill.id === 'sk_sr05') {
        if (isSelf) skState.selfMp = Math.min(skState.selfMaxMp, skState.selfMp + 15);
        else skState.oppMp = Math.min(skState.oppMaxMp, skState.oppMp + 15);
      }
    } else if (eff === 'opp_grav_up') {
      oppBuffs.gravMult = pow;
      oppBuffs.gravTimer = Math.max(oppBuffs.gravTimer, skill.dur || 8);
      if (oppBoard) oppBoard.addPopup(`HEAVY GRAV!`, '#ef4444');
      if (skill.id === 'sk_ssr05') {
        if (isSelf) {
          const drain = Math.min(skState.oppMp, 35);
          skState.oppMp -= drain;
          skState.selfMp = Math.min(skState.selfMaxMp, skState.selfMp + drain);
        } else {
          const drain = Math.min(skState.selfMp, 35);
          skState.selfMp -= drain;
          skState.oppMp = Math.min(skState.oppMaxMp, skState.oppMp + drain);
        }
        if (oppBoard && (!battleRef.isOnline || fromRemote)) {
          const gAmt = oppBoard instanceof PuyoBoard ? 12 : 3;
          oppBoard.receiveGarbage(gAmt);
        }
      }
    } else if (eff === 'cancel_garbage') {
      if (myBoard instanceof TetrisBoard) {
        let left = Math.round(pow * st.mult);
        while (left > 0 && myBoard.garbageQueue.length > 0) {
          const g = myBoard.garbageQueue[0];
          const take = Math.min(g.lines, left);
          g.lines -= take; left -= take;
          if (g.lines <= 0.001) myBoard.garbageQueue.shift();
        }
        myBoard.syncPendingGarbage();
      } else if (myBoard instanceof PuyoBoard) {
        myBoard.pendingGarbage = Math.max(0, myBoard.pendingGarbage - Math.round(pow * 4 * st.mult));
      }
      if (myBoard) myBoard.addPopup('COUNTER WAVE!', '#4ade80');
    } else if (eff === 'summon_mino') {
      applySummonMino(myBoard, skill.mino || 'I', pow);
    } else if (eff === 'mp_drain') {
      const amt = Math.round(pow * st.mult);
      if (isSelf) {
        const take = Math.min(skState.oppMp, amt);
        skState.oppMp -= take;
        skState.selfMp = Math.min(skState.selfMaxMp, skState.selfMp + take);
      } else {
        const take = Math.min(skState.selfMp, amt);
        skState.selfMp -= take;
        skState.oppMp = Math.min(skState.oppMaxMp, skState.oppMp + take);
      }
      if (myBoard) myBoard.addPopup(`MP DRAIN!`, '#c084fc');
      if (skill.id === 'sk_sr08') {
        applyDamageToSide(!isSelf, Math.round(110 * st.mult * atkRatio), battleRef);
      }
    } else if (eff === 'direct_dmg') {
      const dmg = Math.round(pow * st.mult * atkRatio);
      const dealt = applyDamageToSide(!isSelf, dmg, battleRef);
      if (oppBoard) oppBoard.addPopup(`-${dealt} HP!`, '#ef4444');
      if (skill.id === 'sk_ssr06' && oppBoard && (!battleRef.isOnline || fromRemote)) {
        oppBoard.receiveGarbage(oppBoard instanceof PuyoBoard ? 12 : 3);
      }
      if (skill.id === 'sk_ur01') {
        if (oppBoard && (!battleRef.isOnline || fromRemote)) {
          oppBoard.receiveGarbage(oppBoard instanceof PuyoBoard ? 24 : 6);
        }
        myBuffs.atkBonus = Math.max(myBuffs.atkBonus, 0.60);
        myBuffs.atkTimer = Math.max(myBuffs.atkTimer, 10);
      }
    } else if (eff === 'mega_garbage') {
      const gLines = Math.max(1, Math.round(pow * (1 + (lv - 1) * 0.15)));
      if (oppBoard && (!battleRef.isOnline || fromRemote)) {
        oppBoard.receiveGarbage(oppBoard instanceof PuyoBoard ? gLines * 4 : gLines);
      }
      const bonusDmg = skill.id === 'sk_sr10' ? 100 : 60;
      const dealt = applyDamageToSide(!isSelf, Math.round(bonusDmg * st.mult * atkRatio), battleRef);
      if (oppBoard) oppBoard.addPopup(`BARRAGE -${dealt}!`, '#f97316');
    } else if (eff === 'all_clear_support') {
      if (skill.id === 'sk_ur02') {
        applyPurgeOjama(myBoard, 99);
        const heal = Math.round(350 * st.mult);
        const sh = Math.round(350 * st.mult);
        if (isSelf) {
          skState.selfHp = Math.min(skState.selfMaxHp, skState.selfHp + heal);
          skState.selfShield += sh;
          const dr = Math.min(skState.oppMp, 45);
          skState.oppMp -= dr;
          skState.selfMp = Math.min(skState.selfMaxMp, skState.selfMp + dr);
        } else {
          skState.oppHp = Math.min(skState.oppMaxHp, skState.oppHp + heal);
          skState.oppShield += sh;
          const dr = Math.min(skState.selfMp, 45);
          skState.selfMp -= dr;
          skState.oppMp = Math.min(skState.oppMaxMp, skState.oppMp + dr);
        }
        if (myBoard) myBoard.addPopup('CHRONOS!', '#fde047');
      } else {
        // sk_ssr01: clear lower 4 rows + atk up
        applyBoardClearRows(myBoard, 4);
        myBuffs.atkBonus = Math.max(myBuffs.atkBonus, 0.30);
        myBuffs.atkTimer = Math.max(myBuffs.atkTimer, 10);
        if (myBoard) myBoard.addPopup('BAYOEN!', '#fde047');
      }
    }

    if (isSelf && battleRef.isOnline && !fromRemote && typeof net !== 'undefined') {
      net.send({ type: 'skillUse', skillId, lv });
    }
    updateSpecialHudDOM(battleRef);
  }

  function tryUseSelfSkill(slotIdx, battleRef) {
    if (!skState.active || !battleRef || !battleRef.active || battleRef.paused || battleRef.ended || battleRef.isSpectate) return false;
    const slot = skState.selfSkills[slotIdx];
    if (!slot) return false;
    const def = SKILL_MAP[slot.id];
    if (!def) return false;
    if (slot.cd > 0 || skState.selfMp < def.mp) return false;
    skState.selfMp = Math.max(0, skState.selfMp - def.mp);
    slot.cd = def.cd;
    executeSkillEffect(true, slot.id, slot.lv, battleRef, false);
    return true;
  }

  // -------------------------------------------------------------------------
  // 6. BIG BANG CLASH RESOLUTION
  // -------------------------------------------------------------------------
  function startBigBangClash(battleRef, syncedOppCharge = null) {
    if (!bbState.active || bbState.phase === 'clash') return;
    if (typeof syncedOppCharge === 'number') bbState.oppCharge = syncedOppCharge;

    if (bbState.isSolo) {
      // Solo Big Bang Practice finishes after 60s
      finishBigBangSolo(battleRef);
      return;
    }

    bbState.phase = 'clash';
    bbState.clashTimer = 3.2;

    if (battleRef.isOnline && typeof net !== 'undefined' && net.isHost) {
      net.send({
        type: 'bigbangClash',
        hostCharge: bbState.selfCharge,
        guestCharge: bbState.oppCharge
      });
    }

    const sCh = Math.round(bbState.selfCharge);
    const oCh = Math.round(bbState.oppCharge);
    const diff = Math.abs(sCh - oCh);
    const dmg = diff > 0 ? Math.max(80, Math.round(diff * 1.15)) : 0;
    let winner = 'draw';
    if (sCh > oCh) {
      winner = 'self';
      bbState.oppHp = Math.max(0, bbState.oppHp - dmg);
      battleRef.triggerShake(false, 11, 0.4);
    } else if (oCh > sCh) {
      winner = 'opp';
      bbState.selfHp = Math.max(0, bbState.selfHp - dmg);
      battleRef.triggerShake(true, 11, 0.4);
    }

    if (typeof sound !== 'undefined') sound.playSE(winner === 'self' ? 'perfect' : (winner === 'opp' ? 'garbageFall' : 'counter'));

    const ov = document.getElementById('overlayBigBangClash');
    if (ov) {
      document.getElementById('bbClashSelfVal').textContent = sCh.toLocaleString();
      document.getElementById('bbClashOppVal').textContent = oCh.toLocaleString();
      const resEl = document.getElementById('bbClashResult');
      if (winner === 'self') {
        resEl.textContent = `💥 CRASH! 相手に ${dmg} ダメージ！`;
        resEl.style.color = '#4ade80';
      } else if (winner === 'opp') {
        resEl.textContent = `💥 CRASH! 自分に ${dmg} ダメージ！`;
        resEl.style.color = '#f87171';
      } else {
        resEl.textContent = `⚡ 完全相殺！ DRAW`;
        resEl.style.color = '#fde047';
      }
      ov.classList.add('active');
    }
    updateSpecialHudDOM(battleRef);
  }

  function finishBigBangSolo(battleRef) {
    if (battleRef.ended) return;
    const sc = Math.round(bbState.selfCharge);
    const clears = bbState.selfClears;
    let isNewRec = false;
    if (!profile.records) profile.records = {};
    if (sc > (profile.records.bestBigBangScore || 0)) {
      profile.records.bestBigBangScore = sc;
      isNewRec = true;
    }
    if (clears > (profile.records.bestBigBangClears || 0)) {
      profile.records.bestBigBangClears = clears;
    }
    saveProfile(profile);
    battleRef.finishMatch(true, `💥 BIG BANG 60秒終了！ チャージ: ${sc.toLocaleString()} / 連続クリア: ${clears}回${isNewRec ? ' (NEW RECORD!)' : ''}`);
  }

  // -------------------------------------------------------------------------
  // 7. BATTLE HUD RENDERING FOR BIG BANG & SKILL BATTLE
  // -------------------------------------------------------------------------
  function updateSpecialHudDOM(battleRef) {
    const strip = document.getElementById('specialModeHud');
    if (!strip) return;
    const show = bbState.active || skState.active;
    strip.classList.toggle('active', show);
    if (!show) return;

    const bbBar = document.getElementById('bbHudWrap');
    const skBar = document.getElementById('skHudWrap');
    if (bbBar) bbBar.style.display = bbState.active ? 'flex' : 'none';
    if (skBar) skBar.style.display = skState.active ? 'flex' : 'none';

    if (bbState.active) {
      const sPct = Math.max(0, Math.min(100, (bbState.selfHp / bbState.selfMaxHp) * 100));
      const oPct = Math.max(0, Math.min(100, (bbState.oppHp / bbState.oppMaxHp) * 100));
      document.getElementById('bbSelfHpFill').style.width = `${sPct}%`;
      document.getElementById('bbSelfHpTxt').textContent = bbState.isSolo
        ? `クリア: ${bbState.selfClears}回`
        : `HP ${Math.ceil(bbState.selfHp)} / ${bbState.selfMaxHp}`;
      document.getElementById('bbSelfChargeTxt').textContent = `💥 ${Math.round(bbState.selfCharge).toLocaleString()}`;

      const oppBox = document.getElementById('bbOppHudSide');
      if (oppBox) oppBox.style.display = bbState.isSolo ? 'none' : 'flex';
      if (!bbState.isSolo) {
        document.getElementById('bbOppHpFill').style.width = `${oPct}%`;
        document.getElementById('bbOppHpTxt').textContent = `HP ${Math.ceil(bbState.oppHp)} / ${bbState.oppMaxHp}`;
        document.getElementById('bbOppChargeTxt').textContent = `💥 ${Math.round(bbState.oppCharge).toLocaleString()}`;
      }
      const tEl = document.getElementById('bbTimerVal');
      tEl.textContent = bbState.phase === 'clash' ? 'CLASH!' : `${bbState.chargeTimer.toFixed(1)}s`;
      tEl.classList.toggle('warn', bbState.chargeTimer <= 10 && bbState.phase === 'charge');
    }

    if (skState.active) {
      const sHpPct = Math.max(0, Math.min(100, (skState.selfHp / skState.selfMaxHp) * 100));
      const sMpPct = Math.max(0, Math.min(100, (skState.selfMp / skState.selfMaxMp) * 100));
      const oHpPct = Math.max(0, Math.min(100, (skState.oppHp / skState.oppMaxHp) * 100));
      const oMpPct = Math.max(0, Math.min(100, (skState.oppMp / skState.oppMaxMp) * 100));

      document.getElementById('skSelfHpFill').style.width = `${sHpPct}%`;
      document.getElementById('skSelfHpTxt').textContent = `HP ${Math.ceil(skState.selfHp)}/${skState.selfMaxHp}` + (skState.selfShield > 0 ? ` (+${Math.ceil(skState.selfShield)}🛡)` : '');
      document.getElementById('skSelfMpFill').style.width = `${sMpPct}%`;
      document.getElementById('skSelfMpTxt').textContent = `MP ${Math.floor(skState.selfMp)}/${skState.selfMaxMp}`;

      document.getElementById('skOppHpFill').style.width = `${oHpPct}%`;
      document.getElementById('skOppHpTxt').textContent = `HP ${Math.ceil(skState.oppHp)}/${skState.oppMaxHp}` + (skState.oppShield > 0 ? ` (+${Math.ceil(skState.oppShield)}🛡)` : '');
      document.getElementById('skOppMpFill').style.width = `${oMpPct}%`;
      document.getElementById('skOppMpTxt').textContent = `MP ${Math.floor(skState.oppMp)}/${skState.oppMaxMp}`;

      // Update 3 skill buttons
      for (let i = 0; i < 3; i++) {
        const btn = document.getElementById(`skBtn${i}`);
        if (!btn) continue;
        const slot = skState.selfSkills[i];
        if (!slot || !SKILL_MAP[slot.id]) {
          btn.style.display = 'none';
          continue;
        }
        btn.style.display = 'flex';
        const def = SKILL_MAP[slot.id];
        const ready = slot.cd <= 0 && skState.selfMp >= def.mp && battleRef && battleRef.active && !battleRef.isSpectate;
        btn.classList.toggle('ready', ready);
        btn.disabled = !ready;
        const rar = RARITY_META[def.rarity];
        btn.style.borderColor = ready ? rar.color : 'rgba(148,163,184,0.25)';
        btn.innerHTML = `
          <span class="sk-btn-key">${i + 1}</span>
          <span class="sk-btn-icon">${def.icon}</span>
          <span class="sk-btn-meta">
            <strong class="sk-btn-name">${def.name}</strong>
            <small class="sk-btn-sub">${slot.cd > 0 ? `CD ${slot.cd.toFixed(1)}s` : `MP ${def.mp} / Lv.${slot.lv}`}</small>
          </span>
        `;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 8. BATTLE LIFECYCLE HOOKS (CALLED FROM MAIN.JS)
  // -------------------------------------------------------------------------
  function onSetupRound(battleRef) {
    bbState.active = false;
    skState.active = false;
    const clashOv = document.getElementById('overlayBigBangClash');
    if (clashOv) clashOv.classList.remove('active');
    const cutEl = document.getElementById('skillCutinBanner');
    if (cutEl) cutEl.classList.remove('active');

    if (battleRef.rule === 'bigbang' || battleRef.soloSubType === 'bigbang_solo') {
      bbState.active = true;
      bbState.isSolo = !!battleRef.isSolo;
      bbState.phase = 'charge';
      bbState.chargeTimer = 60.0;
      bbState.clashTimer = 0;
      bbState.selfHp = 1000;
      bbState.selfMaxHp = 1000;
      bbState.oppHp = 1000;
      bbState.oppMaxHp = 1000;
      bbState.selfCharge = 0;
      bbState.oppCharge = 0;
      bbState.selfLevel = 3;
      bbState.oppLevel = 3;
      bbState.selfClears = 0;
      bbState.oppClears = 0;
      bbState.selfTemplateIdx = Math.floor(Math.random() * LUCKY_ATTACK_TEMPLATES.length);
      bbState.oppTemplateIdx = Math.floor(Math.random() * LUCKY_ATTACK_TEMPLATES.length);
      bbState.selfPendingNext = false;
      bbState.oppPendingNext = false;
      bbState.lastSecInt = 60;

      loadBigBangBoard(battleRef.getActiveBoard(true), true, false);
      if (!bbState.isSolo) loadBigBangBoard(battleRef.getActiveBoard(false), false, false);
    } else if (battleRef.rule === 'skill') {
      ensurePlayerSkillsInitialized();
      skState.active = true;
      const myEq = Array.isArray(profile.equippedSkills) ? profile.equippedSkills.slice(0, 3) : STARTER_EQUIPPED.slice();
      skState.selfStats = computeTeamStats(myEq, profile.ownedSkills);
      skState.selfMaxHp = skState.selfStats.hp;
      skState.selfHp = skState.selfMaxHp;
      skState.selfMaxMp = 100;
      skState.selfMp = 30;
      skState.selfShield = 0;
      skState.selfBuffs = { atkBonus: 0, atkTimer: 0, defBonus: 0, defTimer: 0, gravMult: 1, gravTimer: 0 };
      skState.selfSkills = myEq.filter(id => SKILL_MAP[id]).map(id => ({ id, lv: getSkillLevel(id) || 1, cd: 0 }));

      // Opponent skills & stats
      if (battleRef.isCpu || battleRef.isSpectate) {
        const diff = (battleRef.cpu && battleRef.cpu.difficulty) || 'normal';
        skState.oppSkills = pickCpuSkills(diff);
        const oppOwned = {};
        skState.oppSkills.forEach(s => { oppOwned[s.id] = s.lv; });
        skState.oppStats = computeTeamStats(skState.oppSkills.map(s => s.id), oppOwned);
      } else {
        const oEq = (battleRef.oppInfo && Array.isArray(battleRef.oppInfo.equippedSkills)) ? battleRef.oppInfo.equippedSkills : STARTER_EQUIPPED;
        const oOwned = (battleRef.oppInfo && battleRef.oppInfo.ownedSkills) ? battleRef.oppInfo.ownedSkills : STARTER_SKILLS;
        skState.oppSkills = oEq.filter(id => SKILL_MAP[id]).map(id => ({ id, lv: oOwned[id] || 1, cd: 0 }));
        skState.oppStats = computeTeamStats(oEq, oOwned);
      }
      skState.oppMaxHp = skState.oppStats.hp;
      skState.oppHp = skState.oppMaxHp;
      skState.oppMaxMp = 100;
      skState.oppMp = 30;
      skState.oppShield = 0;
      skState.oppBuffs = { atkBonus: 0, atkTimer: 0, defBonus: 0, defTimer: 0, gravMult: 1, gravTimer: 0 };
      skState.cpuThinkTimer = 2.5;
      skState.cutinTimer = 0;
    }

    updateSpecialHudDOM(battleRef);
  }

  function onUpdate(dt, battleRef) {
    if (skState.cutinTimer > 0) {
      skState.cutinTimer -= dt;
      if (skState.cutinTimer <= 0) {
        const el = document.getElementById('skillCutinBanner');
        if (el) el.classList.remove('active');
      }
    }

    if (bbState.active) {
      if (bbState.phase === 'charge') {
        bbState.chargeTimer = Math.max(0, bbState.chargeTimer - dt);
        const secInt = Math.ceil(bbState.chargeTimer);
        if (bbState.chargeTimer <= 5.0 && bbState.chargeTimer > 0 && secInt < bbState.lastSecInt) {
          if (typeof sound !== 'undefined') sound.playSE('swapWarn');
        }
        bbState.lastSecInt = secInt;

        // Check if Puyo board finished a chain and is ready for next seed
        const checkBoardAdvance = (isSelf) => {
          const b = battleRef.getActiveBoard(isSelf);
          if (!b) return;
          const pending = isSelf ? bbState.selfPendingNext : bbState.oppPendingNext;
          if (b instanceof PuyoBoard) {
            if (pending && b.phase === 'active' && b.chain === 0) {
              if (isSelf) {
                bbState.selfPendingNext = false;
                bbState.selfLevel = Math.min(12, bbState.selfLevel + 1);
                bbState.selfClears++;
              } else {
                bbState.oppPendingNext = false;
                bbState.oppLevel = Math.min(12, bbState.oppLevel + 1);
                bbState.oppClears++;
              }
              loadBigBangBoard(b, isSelf, false);
            }
          } else if (b instanceof TetrisBoard) {
            // Count non-null blocks
            let blocks = 0;
            for (let r = 0; r < b.rows; r++) {
              for (let c = 0; c < b.cols; c++) if (b.grid[r][c] !== null) blocks++;
            }
            if (pending || blocks === 0) {
              if (isSelf) {
                bbState.selfPendingNext = false;
                bbState.selfTemplateIdx++;
                bbState.selfClears++;
              } else {
                bbState.oppPendingNext = false;
                bbState.oppTemplateIdx++;
                bbState.oppClears++;
              }
              loadBigBangBoard(b, isSelf, false);
            }
          }
        };
        checkBoardAdvance(true);
        if (!bbState.isSolo && !battleRef.isOnline) checkBoardAdvance(false);

        if (bbState.chargeTimer <= 0 && (!battleRef.isOnline || (typeof net !== 'undefined' && net.isHost))) {
          startBigBangClash(battleRef);
        }
      } else if (bbState.phase === 'clash') {
        bbState.clashTimer -= dt;
        if (bbState.clashTimer <= 0) {
          const ov = document.getElementById('overlayBigBangClash');
          if (ov) ov.classList.remove('active');
          if (bbState.oppHp <= 0) {
            battleRef.onRoundEnd(true, '💥 BIG BANG K.O.！相手のHPを0にしました！');
            return true;
          }
          if (bbState.selfHp <= 0) {
            battleRef.onRoundEnd(false, '💥 BIG BANG K.O.！HPが0になりました...');
            return true;
          }
          // Next 60s charge round
          bbState.phase = 'charge';
          bbState.chargeTimer = 60.0;
          bbState.lastSecInt = 60;
          bbState.selfCharge = 0;
          bbState.oppCharge = 0;
          loadBigBangBoard(battleRef.getActiveBoard(true), true, false);
          if (!bbState.isSolo) loadBigBangBoard(battleRef.getActiveBoard(false), false, false);
        }
        updateSpecialHudDOM(battleRef);
        return true; // Pause board physics during clash animation
      }
      updateSpecialHudDOM(battleRef);
      return false;
    }

    if (skState.active) {
      // MP passive regen
      skState.selfMp = Math.min(skState.selfMaxMp, skState.selfMp + skState.selfStats.mpr * dt);
      skState.oppMp = Math.min(skState.oppMaxMp, skState.oppMp + skState.oppStats.mpr * dt);

      // Cooldowns
      skState.selfSkills.forEach(s => { if (s.cd > 0) s.cd = Math.max(0, s.cd - dt); });
      skState.oppSkills.forEach(s => { if (s.cd > 0) s.cd = Math.max(0, s.cd - dt); });

      // Buff timers & board gravMult sync
      const tickBuffs = (buffs, board) => {
        if (buffs.atkTimer > 0) { buffs.atkTimer -= dt; if (buffs.atkTimer <= 0) { buffs.atkTimer = 0; buffs.atkBonus = 0; } }
        if (buffs.defTimer > 0) { buffs.defTimer -= dt; if (buffs.defTimer <= 0) { buffs.defTimer = 0; buffs.defBonus = 0; } }
        if (buffs.gravTimer > 0) { buffs.gravTimer -= dt; if (buffs.gravTimer <= 0) { buffs.gravTimer = 0; buffs.gravMult = 1; } }
        if (board) board.gravMult = buffs.gravMult || 1;
      };
      tickBuffs(skState.selfBuffs, battleRef.getActiveBoard(true));
      tickBuffs(skState.oppBuffs, battleRef.getActiveBoard(false));

      // CPU Skill AI
      if ((battleRef.isCpu || battleRef.isSpectate) && !battleRef.ended) {
        skState.cpuThinkTimer -= dt;
        if (skState.cpuThinkTimer <= 0) {
          skState.cpuThinkTimer = 2.2 + Math.random() * 2.0;
          const usable = skState.oppSkills.filter(s => s.cd <= 0 && SKILL_MAP[s.id] && skState.oppMp >= SKILL_MAP[s.id].mp);
          if (usable.length > 0) {
            // Prefer heal if HP < 60%, otherwise pick randomly
            let pick = usable.find(s => SKILL_MAP[s.id].cat === 'heal' && skState.oppHp < skState.oppMaxHp * 0.65);
            if (!pick) pick = usable[Math.floor(Math.random() * usable.length)];
            const def = SKILL_MAP[pick.id];
            skState.oppMp = Math.max(0, skState.oppMp - def.mp);
            pick.cd = def.cd;
            executeSkillEffect(false, pick.id, pick.lv, battleRef, false);
          }
        }
      }

      updateSpecialHudDOM(battleRef);
    }
    return false;
  }

  // Intercept attack events in Big Bang & Skill Battle
  // Returns true if attack was fully handled (Big Bang), false to also allow normal garbage (Skill Battle)
  function onAttackIntercept(isSelf, fromStyle, amount, battleRef) {
    if (bbState.active) {
      // Convert attack into Charge Power (no garbage sent during charge!)
      const gain = fromStyle === 'puyo' ? Math.round(amount * 14 + 35) : Math.round(amount * 48 + 30);
      if (isSelf) {
        bbState.selfCharge += gain;
        bbState.selfPendingNext = true;
        const b = battleRef.getActiveBoard(true);
        if (b) b.addPopup(`CHARGE +${gain}!`, '#fde047');
        if (typeof sound !== 'undefined') sound.playSE('attack');
      } else {
        bbState.oppCharge += gain;
        bbState.oppPendingNext = true;
      }
      updateSpecialHudDOM(battleRef);
      return true;
    }

    if (skState.active) {
      // Gain MP on clear/attack + deal HP damage!
      const mpGain = Math.min(18, fromStyle === 'puyo' ? Math.round(amount * 0.7 + 4) : Math.round(amount * 2.5 + 4));
      if (isSelf) {
        skState.selfMp = Math.min(skState.selfMaxMp, skState.selfMp + mpGain);
        const atkMult = (skState.selfStats.atk / 100) * (1 + (skState.selfBuffs.atkBonus || 0));
        const rawDmg = (fromStyle === 'puyo' ? amount * 6.5 : amount * 26) * atkMult * battleRef.selfAtkMult;
        applyDamageToSide(false, rawDmg, battleRef);
      } else {
        skState.oppMp = Math.min(skState.oppMaxMp, skState.oppMp + mpGain);
        const atkMult = (skState.oppStats.atk / 100) * (1 + (skState.oppBuffs.atkBonus || 0));
        const rawDmg = (fromStyle === 'puyo' ? amount * 6.5 : amount * 26) * atkMult * battleRef.oppAtkMult;
        applyDamageToSide(true, rawDmg, battleRef);
      }
      updateSpecialHudDOM(battleRef);
      return false; // Also send normal garbage!
    }
    return false;
  }

  // Intercept KO (top-out) in Big Bang (reset seed) & Skill Battle (heavy HP penalty + auto-revive)
  function onKOIntercept(isSelf, battleRef) {
    if (bbState.active) {
      const b = battleRef.getActiveBoard(isSelf);
      loadBigBangBoard(b, isSelf, true);
      if (b) b.addPopup('NEXT SEED!', '#fbbf24');
      return true; // Never instant-KO on top-out in Big Bang
    }

    if (skState.active) {
      const maxHp = isSelf ? skState.selfMaxHp : skState.oppMaxHp;
      const pen = Math.round(maxHp * 0.25);
      const dealt = applyDamageToSide(isSelf, pen, battleRef);
      const hpNow = isSelf ? skState.selfHp : skState.oppHp;
      if (hpNow > 0) {
        // Reset board & auto-revive!
        const b = battleRef.getActiveBoard(isSelf);
        if (b) {
          b.reset();
          b.addPopup(`REVIVE! -${dealt} HP`, '#f87171');
        }
        if (typeof sound !== 'undefined') sound.playSE('garbageFall');
        updateSpecialHudDOM(battleRef);
        return true; // Intercepted — match continues!
      }
      return true; // applyDamageToSide already triggered onRoundEnd
    }
    return false;
  }

  function onBuildSyncPayload(payload) {
    if (bbState.active) {
      payload.bbCharge = Math.round(bbState.selfCharge);
      payload.bbHp = Math.round(bbState.selfHp);
      payload.bbTimer = Math.round(bbState.chargeTimer * 10) / 10;
    }
    if (skState.active) {
      payload.skHp = Math.round(skState.selfHp);
      payload.skMp = Math.round(skState.selfMp);
      payload.skShield = Math.round(skState.selfShield);
    }
  }

  function onApplyRemoteState(msg, battleRef) {
    if (bbState.active) {
      if (typeof msg.bbCharge === 'number') bbState.oppCharge = msg.bbCharge;
      if (typeof msg.bbHp === 'number') bbState.oppHp = msg.bbHp;
      if (typeof msg.bbTimer === 'number' && typeof net !== 'undefined' && !net.isHost && bbState.phase === 'charge') {
        if (Math.abs(bbState.chargeTimer - msg.bbTimer) > 0.35) bbState.chargeTimer = msg.bbTimer;
      }
      updateSpecialHudDOM(battleRef);
    }
    if (skState.active) {
      if (typeof msg.skHp === 'number') skState.oppHp = msg.skHp;
      if (typeof msg.skMp === 'number') skState.oppMp = msg.skMp;
      if (typeof msg.skShield === 'number') skState.oppShield = msg.skShield;
      updateSpecialHudDOM(battleRef);
    }
  }

  function onRemoteMessage(msg, battleRef) {
    if (!msg || !msg.type) return false;
    if (msg.type === 'skillUse' && skState.active && battleRef.active) {
      executeSkillEffect(false, msg.skillId, msg.lv || 1, battleRef, true);
      return true;
    }
    if (msg.type === 'bigbangClash' && bbState.active && battleRef.active) {
      // Guest receives host's clash resolution (hostCharge = opponent's charge, guestCharge = self charge)
      bbState.oppCharge = typeof msg.hostCharge === 'number' ? msg.hostCharge : bbState.oppCharge;
      startBigBangClash(battleRef, bbState.oppCharge);
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // 9. SKILL GACHA / DECK BUILDER / ENCYCLOPEDIA MODAL UI
  // -------------------------------------------------------------------------
  let currentSkillModalTab = 'gacha';
  let currentDexFilter = 'ALL';
  let lastGachaResults = null;

  function openSkillModal(tab = 'gacha') {
    ensurePlayerSkillsInitialized();
    currentSkillModalTab = tab;
    renderSkillModalUI();
    const ov = document.getElementById('overlaySkillModal');
    if (ov) ov.classList.add('active');
  }

  function renderSkillModalUI() {
    ensurePlayerSkillsInitialized();
    const coinPill = document.getElementById('skillModalCoinPill');
    if (coinPill) coinPill.textContent = `🪙 ${(profile.coins || 0).toLocaleString()}`;

    const ownedCount = Object.keys(profile.ownedSkills || {}).filter(id => SKILL_MAP[id] && profile.ownedSkills[id] >= 1).length;
    const dexTab = document.querySelector('[data-skilltab="dex"]');
    if (dexTab) dexTab.textContent = `📖 図鑑 (${ownedCount}/50)`;

    document.querySelectorAll('[data-skilltab]').forEach(t => {
      t.classList.toggle('active', t.dataset.skilltab === currentSkillModalTab);
    });

    const body = document.getElementById('skillModalBody');
    if (!body) return;
    body.innerHTML = '';

    if (currentSkillModalTab === 'gacha') {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="gacha-banner">
          <div style="font-size:1.05rem;font-weight:900;color:#fde047;">🎰 PUYOTET スキルガチャ（全50種）</div>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-top:4px;">
            排出率: UR 1.5% / SSR 5.5% / SR 13% / R 30% / N 50%　※10連はR以上1枠確定！<br>
            被りスキルはLv+1強化（最大Lv.5）、Lv.5上限の被りは +${MAX_LV_REFUND}🪙 還元！
          </div>
          <div class="gacha-btn-row">
            <button class="btn btn-primary" id="btnGachaPull1">🎲 1連ガチャ (${GACHA_COST_1}🪙)</button>
            <button class="btn btn-gold" id="btnGachaPull10">✨ 10連ガチャ (${GACHA_COST_10.toLocaleString()}🪙)</button>
          </div>
          <div style="font-size:0.7rem;color:var(--text-dim);margin-top:6px;">累計ガチャ回数: ${profile.skillGachaCount || 0}回 ／ 所持スキル: ${ownedCount} / 50</div>
        </div>
        <div id="gachaResultArea" class="gacha-result-grid"></div>
      `;
      body.appendChild(wrap);

      wrap.querySelector('#btnGachaPull1').addEventListener('click', () => {
        if (typeof sound !== 'undefined') sound.unlock();
        const res = pullGacha(1);
        if (res) { lastGachaResults = res; renderSkillModalUI(); }
      });
      wrap.querySelector('#btnGachaPull10').addEventListener('click', () => {
        if (typeof sound !== 'undefined') sound.unlock();
        const res = pullGacha(10);
        if (res) { lastGachaResults = res; renderSkillModalUI(); }
      });

      const resArea = wrap.querySelector('#gachaResultArea');
      if (lastGachaResults && lastGachaResults.results) {
        resArea.innerHTML = lastGachaResults.results.map(item => {
          const s = item.skill;
          const rar = RARITY_META[s.rarity];
          const badge = item.status === 'new'
            ? '<span class="gacha-tag new">NEW!</span>'
            : (item.status === 'lvup'
              ? `<span class="gacha-tag lvup">Lv.${item.newLv} UP!</span>`
              : `<span class="gacha-tag refund">MAX +${item.refund}🪙</span>`);
          return `
            <div class="gacha-card rar-${s.rarity}" style="border-color:${rar.color};">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                <span class="sk-rar-pill" style="background:${rar.bg};color:${rar.color};">${s.rarity}</span>
                ${badge}
              </div>
              <div style="font-size:1.5rem;margin:4px 0;">${s.icon}</div>
              <div style="font-size:0.76rem;font-weight:900;color:var(--text-main);">${s.name}</div>
              <div style="font-size:0.66rem;color:var(--text-dim);margin-top:2px;">MP ${s.mp} / CD ${s.cd}s</div>
            </div>
          `;
        }).join('');
      } else {
        resArea.innerHTML = '<div style="grid-column:1/-1;text-align:center;font-size:0.78rem;color:var(--text-dim);padding:18px;">ボタンを押してスキルを手に入れよう！</div>';
      }
    } else if (currentSkillModalTab === 'deck') {
      const eq = Array.isArray(profile.equippedSkills) ? profile.equippedSkills : [];
      const team = computeTeamStats(eq, profile.ownedSkills);

      const header = document.createElement('div');
      header.className = 'deck-summary-box';
      header.innerHTML = `
        <div style="font-size:0.78rem;font-weight:900;color:var(--cyan);margin-bottom:6px;">⚔️ 装備デッキ（最大3スロット・試合中 1 / 2 / 3 キーで発動）</div>
        <div class="deck-slots-row" id="deckSlotsRow"></div>
        <div class="deck-stats-row">
          <span>❤️ HP: <strong>${team.hp}</strong></span>
          <span>⚔️ ATK: <strong>${team.atk}%</strong></span>
          <span>🛡️ DEF: <strong>${team.def}%</strong></span>
          <span>💧 MP回復: <strong>${team.mpr}/s</strong></span>
        </div>
      `;
      body.appendChild(header);

      const slotsRow = header.querySelector('#deckSlotsRow');
      for (let i = 0; i < 3; i++) {
        const sid = eq[i];
        const s = sid ? SKILL_MAP[sid] : null;
        const slotEl = document.createElement('div');
        slotEl.className = 'deck-slot-card' + (s ? ' filled' : '');
        if (s) {
          const lv = getSkillLevel(s.id) || 1;
          const rar = RARITY_META[s.rarity];
          slotEl.style.borderColor = rar.color;
          slotEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.68rem;">
              <span style="color:var(--cyan);font-weight:900;">KEY [${i + 1}]</span>
              <span class="sk-rar-pill" style="background:${rar.bg};color:${rar.color};">${s.rarity} Lv.${lv}</span>
            </div>
            <div style="font-size:1.15rem;margin:3px 0;">${s.icon} <strong style="font-size:0.78rem;">${s.name}</strong></div>
            <div style="font-size:0.66rem;color:var(--text-dim);">MP ${s.mp} / CD ${s.cd}s</div>
            <button class="btn btn-danger" style="padding:3px 8px;font-size:0.68rem;margin-top:5px;width:100%;">外す</button>
          `;
          slotEl.querySelector('button').addEventListener('click', () => {
            profile.equippedSkills = eq.filter(x => x !== s.id);
            saveProfile(profile);
            renderSkillModalUI();
          });
        } else {
          slotEl.innerHTML = `<div style="font-size:0.72rem;color:var(--text-dim);padding:16px 4px;text-align:center;">SLOT ${i + 1}<br>(空き)</div>`;
        }
        slotsRow.appendChild(slotEl);
      }

      const ownedList = SKILLS.filter(s => getSkillLevel(s.id) >= 1)
        .sort((a, b) => (RARITY_META[b.rarity].order - RARITY_META[a.rarity].order) || a.id.localeCompare(b.id));

      const listEl = document.createElement('div');
      listEl.className = 'skill-owned-list';
      ownedList.forEach(s => {
        const lv = getSkillLevel(s.id);
        const st = getSkillScaledStats(s.id, lv);
        const isEq = eq.includes(s.id);
        const rar = RARITY_META[s.rarity];
        const card = document.createElement('div');
        card.className = 'skill-row-card' + (isEq ? ' equipped' : '');
        card.innerHTML = `
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span class="sk-rar-pill" style="background:${rar.bg};color:${rar.color};">${s.rarity}</span>
              <strong style="font-size:0.84rem;">${s.icon} ${s.name}</strong>
              <span style="font-size:0.7rem;color:#fde047;font-weight:800;">Lv.${lv}/${MAX_SKILL_LV}</span>
              <span style="font-size:0.68rem;color:var(--cyan);">MP ${s.mp} / CD ${s.cd}s</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">${s.desc}</div>
            <div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;">補正: HP+${st.hp} / ATK+${st.atk}% / DEF+${st.def}% / MP回復+${st.mpr}/s</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.style.cssText = 'padding:6px 10px;font-size:0.74rem;white-space:nowrap;';
        if (isEq) {
          btn.className = 'btn btn-danger';
          btn.textContent = '外す';
          btn.addEventListener('click', () => {
            profile.equippedSkills = eq.filter(x => x !== s.id);
            saveProfile(profile);
            renderSkillModalUI();
          });
        } else {
          btn.className = 'btn btn-primary';
          btn.textContent = eq.length >= 3 ? '枠満杯' : '装備';
          btn.disabled = eq.length >= 3;
          btn.addEventListener('click', () => {
            if (eq.length >= 3) return;
            profile.equippedSkills = [...eq, s.id];
            saveProfile(profile);
            if (typeof sound !== 'undefined') sound.playSE('rotate');
            renderSkillModalUI();
          });
        }
        card.appendChild(btn);
        listEl.appendChild(card);
      });
      body.appendChild(listEl);
    } else {
      // Encyclopedia (図鑑 xx / 50)
      const fBar = document.createElement('div');
      fBar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;';
      ['ALL', 'UR', 'SSR', 'SR', 'R', 'N'].forEach(rKey => {
        const b = document.createElement('button');
        b.className = currentDexFilter === rKey ? 'btn btn-primary' : 'btn btn-ghost';
        b.style.cssText = 'padding:4px 10px;font-size:0.72rem;border-radius:999px;';
        const sub = rKey === 'ALL' ? SKILLS : SKILLS.filter(s => s.rarity === rKey);
        const subOwned = sub.filter(s => getSkillLevel(s.id) >= 1).length;
        b.textContent = `${rKey} (${subOwned}/${sub.length})`;
        b.addEventListener('click', () => { currentDexFilter = rKey; renderSkillModalUI(); });
        fBar.appendChild(b);
      });
      body.appendChild(fBar);

      const items = (currentDexFilter === 'ALL' ? SKILLS : SKILLS.filter(s => s.rarity === currentDexFilter))
        .slice()
        .sort((a, b) => (RARITY_META[b.rarity].order - RARITY_META[a.rarity].order) || a.id.localeCompare(b.id));

      const grid = document.createElement('div');
      grid.className = 'skill-owned-list';
      items.forEach(s => {
        const lv = getSkillLevel(s.id);
        const owned = lv >= 1;
        const rar = RARITY_META[s.rarity];
        const st = getSkillScaledStats(s.id, owned ? lv : 1);
        const card = document.createElement('div');
        card.className = 'skill-row-card' + (owned ? '' : ' locked');
        card.innerHTML = `
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span class="sk-rar-pill" style="background:${rar.bg};color:${rar.color};">${s.rarity}</span>
              <strong style="font-size:0.84rem;color:${owned ? 'var(--text-main)' : 'var(--text-dim)'};">${owned ? s.icon : '🔒'} ${s.name}</strong>
              <span style="font-size:0.7rem;color:${owned ? '#fde047' : 'var(--text-dim)'};font-weight:800;">${owned ? `Lv.${lv}/${MAX_SKILL_LV}` : '未所持'}</span>
              <span style="font-size:0.68rem;color:var(--cyan);">MP ${s.mp} / CD ${s.cd}s</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">${s.desc}</div>
            <div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;">基礎補正: HP+${st.hp} / ATK+${st.atk}% / DEF+${st.def}% / MP回復+${st.mpr}/s</div>
          </div>
        `;
        grid.appendChild(card);
      });
      body.appendChild(grid);
    }
  }

  function unlockAllSkillsAdmin() {
    if (!profile) return;
    profile.ownedSkills = {};
    SKILLS.forEach(s => { profile.ownedSkills[s.id] = MAX_SKILL_LV; });
    if (!Array.isArray(profile.equippedSkills) || profile.equippedSkills.length === 0) {
      profile.equippedSkills = ['sk_ur01', 'sk_ur02', 'sk_ur03'];
    }
    saveProfile(profile);
    if (typeof renderProfileUI === 'function') renderProfileUI();
    if (typeof showToast === 'function') showToast('⚡ 全50スキル（Lv.5）を解放しました！');
  }

  // Wire up modal buttons on load
  document.querySelectorAll('[data-skilltab]').forEach(tab => {
    tab.addEventListener('click', () => {
      currentSkillModalTab = tab.dataset.skilltab;
      renderSkillModalUI();
    });
  });

  const btnOpenSkill = document.getElementById('btnSkillModal');
  if (btnOpenSkill) {
    btnOpenSkill.addEventListener('click', () => {
      if (typeof sound !== 'undefined') sound.unlock();
      openSkillModal('gacha');
    });
  }
  const btnCloseSkill = document.getElementById('btnCloseSkillModal');
  if (btnCloseSkill) {
    btnCloseSkill.addEventListener('click', () => {
      const ov = document.getElementById('overlaySkillModal');
      if (ov) ov.classList.remove('active');
    });
  }

  for (let i = 0; i < 3; i++) {
    const b = document.getElementById(`skBtn${i}`);
    if (b) {
      b.addEventListener('click', () => {
        if (typeof sound !== 'undefined') sound.unlock();
        if (typeof battle !== 'undefined') tryUseSelfSkill(i, battle);
      });
    }
  }

  const admSkillsBtn = document.getElementById('admUnlockAllSkills');
  if (admSkillsBtn) {
    admSkillsBtn.addEventListener('click', unlockAllSkillsAdmin);
  }

  // Expose public API
  window.skillsBigBang = {
    SKILLS,
    SKILL_MAP,
    RARITY_META,
    STARTER_SKILLS,
    STARTER_EQUIPPED,
    GACHA_COST_1,
    GACHA_COST_10,
    bbState,
    skState,
    ensurePlayerSkillsInitialized,
    computeTeamStats,
    pullGacha,
    openSkillModal,
    renderSkillModalUI,
    unlockAllSkillsAdmin,
    onSetupRound,
    onUpdate,
    onAttackIntercept,
    onKOIntercept,
    onBuildSyncPayload,
    onApplyRemoteState,
    onRemoteMessage,
    tryUseSelfSkill,
    updateSpecialHudDOM
  };
})();
