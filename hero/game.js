'use strict';

/* ============================================================
   幽靈勇者 · 合成放置 RPG · game.js · v2
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const CFG = {
  SAVE_KEY: 'ghostMerge_v3',
  INV_COLS: 5,
  INV_ROWS: 4,
  INV_SIZE: 20,
  KILLS_PER_STAGE: 5,
  TIER_MAX: 15,
  MAX_OFFLINE_HOURS: 12,
  SUMMON_COST: 100,
  SUMMON10_COST: 900,
  AUTO_SAVE_INTERVAL: 10000,
  AUTO_POTION_THRESHOLD: 0.30,
  EMERGENCY_POTION_THRESHOLD: 0.10,
};

// ─────────────────────────────────────────────────────────────
// 裝備類型 (5 種對應 5 個裝備欄)
// ─────────────────────────────────────────────────────────────
const ITEM_TYPES = {
  weapon:    { name: '武器', slotName: '武器', icons: ['🗡️', '⚔️', '🔱', '✨', '💫'], stats: { ATK: 10 } },
  helmet:    { name: '頭盔', slotName: '頭盔', icons: ['⛑️', '🎩', '👑', '💎', '🌟'], stats: { HP: 60, DEF: 2 } },
  armor:     { name: '護甲', slotName: '護甲', icons: ['🎽', '🦺', '🥋', '👘', '🪖'], stats: { HP: 40, DEF: 5 } },
  boots:     { name: '靴',   slotName: '靴',   icons: ['👞', '👢', '👟', '🥾', '👻'], stats: { SPD: 0.10, HP: 20 } },
  accessory: { name: '飾品', slotName: '飾品', icons: ['💍', '📿', '🔮', '🌙', '⭐'], stats: { CRIT: 0.025, ATK: 3 } },
};

const SLOT_ORDER = ['weapon', 'helmet', 'armor', 'boots', 'accessory'];

// ─────────────────────────────────────────────────────────────
// 主角職業
// ─────────────────────────────────────────────────────────────
const CLASSES = {
  knight: {
    name: '幽幽 · 騎士', icon: '⚔', desc: '平衡型 · 基準屬性',
    cost: 0,
    mul: { HP: 1.0, ATK: 1.0, DEF: 1.0, SPD: 1.0, CRIT: 1.0 },
    body: '#F6F7FF', shadow: '#C8C9FF',
    hat: '#5a3a8a', hatDark: '#3a1a5a', star: '#FFE08A',
    glow: '#8B8DFF', flame: '#7a6aff', eye: '#1a1a2e',
  },
  mage: {
    name: '幽幽 · 法師', icon: '🔥', desc: 'ATK +50% · CRIT +10% · HP -20%',
    cost: 30,
    mul: { HP: 0.8, ATK: 1.5, DEF: 0.8, SPD: 1.0, CRIT: 1.1, CRITBONUS: 0.10 },
    body: '#F2EAFF', shadow: '#C8B0FF',
    hat: '#a83040', hatDark: '#681020', star: '#FFE08A',
    glow: '#ff7090', flame: '#ff5060', eye: '#2a1a2e',
  },
  assassin: {
    name: '幽幽 · 刺客', icon: '🗡', desc: 'SPD +60% · CRIT +15% · HP -25%',
    cost: 50,
    mul: { HP: 0.75, ATK: 1.1, DEF: 0.7, SPD: 1.6, CRIT: 1.15, CRITBONUS: 0.15 },
    body: '#E8E8F0', shadow: '#A8A8B8',
    hat: '#1a1a2e', hatDark: '#0a0a1a', star: '#c0c0e0',
    glow: '#6a5aff', flame: '#9060ff', eye: '#1a0a2e',
  },
  paladin: {
    name: '幽幽 · 牧師', icon: '🛡', desc: 'HP +50% · DEF +80% · 補血+50%',
    cost: 80,
    mul: { HP: 1.5, ATK: 0.8, DEF: 1.8, SPD: 0.9, CRIT: 1.0, HEALBONUS: 0.5 },
    body: '#FFF8E8', shadow: '#FFE090',
    hat: '#e8e8ff', hatDark: '#a8a8d0', star: '#FFD700',
    glow: '#FFD700', flame: '#fff0a0', eye: '#2a1e0e',
  },
};
const CLASS_IDS = Object.keys(CLASSES);

const RARITY = {
  common:    { name: '普通', color: '#8090a0', dropWeight: 60 },
  rare:      { name: '稀有', color: '#3aff8a', dropWeight: 25 },
  epic:      { name: '精良', color: '#4a8aff', dropWeight: 10 },
  legendary: { name: '史詩', color: '#9a6af7', dropWeight: 4 },
  mythic:    { name: '傳奇', color: '#ffd700', dropWeight: 1 },
};

function tierToRarity(t) {
  if (t >= 13) return 'mythic';
  if (t >= 10) return 'legendary';
  if (t >= 7)  return 'epic';
  if (t >= 4)  return 'rare';
  return 'common';
}

function tierMul(t) { return Math.pow(1.55, t - 1); }

function itemStats(item) {
  const base = ITEM_TYPES[item.type].stats;
  const m = tierMul(item.tier);
  const out = {};
  for (const k in base) out[k] = base[k] * m;
  return out;
}

function itemIcon(item) {
  const arr = ITEM_TYPES[item.type].icons;
  const idx = Math.min(Math.floor((item.tier - 1) / 3), arr.length - 1);
  return arr[idx];
}

function itemPower(item) {
  // 給 auto-equip 用：簡化的「強度」分數
  return tierMul(item.tier);
}

function itemDescription(item) {
  const stats = itemStats(item);
  const lines = [];
  for (const [k, v] of Object.entries(stats)) {
    const label = ({ ATK: '攻擊', DEF: '防禦', HP: '生命', SPD: '速度', CRIT: '暴擊' })[k];
    const val = k === 'SPD' ? '+' + v.toFixed(2) : (k === 'CRIT' ? '+' + (v * 100).toFixed(1) + '%' : '+' + Math.round(v));
    lines.push(`${label} ${val}`);
  }
  return `${ITEM_TYPES[item.type].name} T${item.tier}\n${lines.join(' · ')}`;
}

// ─────────────────────────────────────────────────────────────
// 補血藥水
// ─────────────────────────────────────────────────────────────
const POTIONS = {
  hpSmall:  { name: '小補血藥', icon: '🧪', heal: 0.30, cost: 80 },
  hpMedium: { name: '中補血藥', icon: '⚗️', heal: 0.60, cost: 350 },
  hpLarge:  { name: '大補血藥', icon: '🍶', heal: 1.00, cost: 1200 },
};

// ─────────────────────────────────────────────────────────────
// 技能系統
// ─────────────────────────────────────────────────────────────
// 技能皆 per-member：cast(member, stats, lv)。member.px/py = 該鬼魂畫面座標
const SKILLS = {
  soulSlash: {
    name: '靈魂斬', icon: '🔥', cls: 'knight', baseCD: 5,
    desc: lv => `造成 ${(150 + lv * 50)}% 攻擊力傷害，必定暴擊`,
    upgradeCost: lv => 5 + lv * 3,
    cast(m, stats, lv) {
      const dmg = Math.round(stats.ATK * (1.5 + lv * 0.5) * 1.5);
      dealEnemyDamage(dmg, true);
      const c = RT.battleCanvasSize || { w: 380, h: 170 };
      RT.skillFx.push({ kind: 'slash', x: c.w * 0.72, y: c.h * 0.5, t: 0.4 });
      for (let i = 0; i < 12; i++) spawnSlashParticle(c.w * 0.72 + (Math.random() - 0.5) * 30, c.h * 0.5);
      if (typeof SOUND !== 'undefined') SOUND.skillSlash();
    },
  },
  whirlwind: {
    name: '幽冥旋風', icon: '🌀', cls: 'assassin', baseCD: 10,
    desc: lv => `5 次連擊各 ${50 + lv * 10}% 攻擊力傷害`,
    upgradeCost: lv => 10 + lv * 5,
    cast(m, stats, lv) {
      let count = 0;
      if (typeof SOUND !== 'undefined') SOUND.skillWind();
      const tick = () => {
        if (!RT.enemy || count >= 5) return;
        const dmg = Math.round(stats.ATK * (0.5 + lv * 0.1));
        dealEnemyDamage(dmg, false);
        const c = RT.battleCanvasSize || { w: 380, h: 170 };
        RT.skillFx.push({ kind: 'wind', x: c.w * 0.72 + (Math.random() - 0.5) * 40, y: c.h * 0.5 + (Math.random() - 0.5) * 20, t: 0.3 });
        count++;
        if (count < 5) setTimeout(() => { try { tick(); } catch (e) {} }, 130);
      };
      tick();
    },
  },
  drainLife: {
    name: '靈魂吸取', icon: '💚', cls: 'mage', baseCD: 12,
    desc: lv => `造成 ${(120 + lv * 30)}% 傷害並回復傷害量的 50% 給自己`,
    upgradeCost: lv => 15 + lv * 8,
    cast(m, stats, lv) {
      const dmg = Math.round(stats.ATK * (1.2 + lv * 0.3));
      dealEnemyDamage(dmg, false);
      const heal = Math.round(dmg * 0.5);
      if (m) { m.hp = Math.min(m.maxHP, m.hp + heal); }
      RT.particles.push({
        kind: 'dmg', x: (m ? m.px : 50), y: (m ? m.py - 28 : 60),
        vy: -1.5, life: 1.0, text: '+' + formatNum(heal), color: '#3aff8a', size: 13
      });
      const c = RT.battleCanvasSize || { w: 380, h: 170 };
      RT.skillFx.push({ kind: 'drain', x1: c.w * 0.72, y1: c.h * 0.5, x2: (m ? m.px : c.w * 0.2), y2: (m ? m.py : c.h * 0.55), t: 0.6 });
      if (typeof SOUND !== 'undefined') SOUND.skillDrain();
    },
  },
  ghostShield: {
    name: '幽靈護盾', icon: '🛡', cls: 'paladin', baseCD: 22,
    desc: lv => `全隊 ${(2.5 + lv * 0.4).toFixed(1)} 秒傷害免疫，並各回復 30% HP`,
    upgradeCost: lv => 20 + lv * 12,
    cast(m, stats, lv) {
      const dur = 2.5 + lv * 0.4;
      (RT.members || []).forEach(mm => {
        if (mm.downed) return;
        mm.shieldTime = dur;
        mm.hp = Math.min(mm.maxHP, mm.hp + mm.maxHP * 0.30);
        RT.skillFx.push({ kind: 'shield', x: mm.px, y: mm.py, t: 0.5 });
      });
      if (typeof SOUND !== 'undefined') SOUND.skillShield();
    },
  },
};
const SKILL_IDS = Object.keys(SKILLS);
// 職業 → 技能
const CLASS_SKILL = { knight: 'soulSlash', assassin: 'whirlwind', mage: 'drainLife', paladin: 'ghostShield' };

// ─────────────────────────────────────────────────────────────
// 怪物類型
// ─────────────────────────────────────────────────────────────
const ENEMY_TYPES = {
  warrior: {
    name: '戰士', mul: { hp: 1.0, atk: 1.0, spd: 1.0 }, size: 1.0,
    body: '#FFAEAE', shadow: '#C87878',
    hat: 'bandana', hatColor: '#c84040', hatDark: '#801020', accent: '#1a1a2e',
    eye: '#ff2020', eyeStyle: 'angry', mouth: 'fang',
    glow: '#ff6060',
  },
  swift: {
    name: '迅捷', mul: { hp: 0.6, atk: 0.9, spd: 1.6 }, size: 0.9,
    body: '#B8F0B8', shadow: '#70B870',
    hat: 'band', hatColor: '#40c060', hatDark: '#206040', accent: '#1a1a2e',
    eye: '#ffd040', eyeStyle: 'sharp', mouth: 'shout',
    glow: '#80ff80',
  },
  tank: {
    name: '堅固', mul: { hp: 2.0, atk: 0.8, spd: 0.6 }, size: 1.25,
    body: '#C0C8D0', shadow: '#808890',
    hat: 'helmet', hatColor: '#808890', hatDark: '#404850', accent: '#FFD700',
    eye: '#404060', eyeStyle: 'grim', mouth: 'flat',
    glow: '#a0a8c0',
  },
  mage: {
    name: '法師', mul: { hp: 0.7, atk: 1.4, spd: 0.85 }, size: 1.0,
    body: '#D8B0F0', shadow: '#9060C0',
    hat: 'wizard', hatColor: '#3a1a6a', hatDark: '#1a0a3a', accent: '#ff00ff',
    eye: '#e040ff', eyeStyle: 'evil', mouth: 'grin',
    glow: '#c060ff',
  },
};
const ENEMY_TYPE_IDS = Object.keys(ENEMY_TYPES);

// ─────────────────────────────────────────────────────────────
// 地城資料
// ─────────────────────────────────────────────────────────────
const DUNGEONS = [
  { id: 1, name: '幽冥森林', desc: '霧氣繚繞的死亡森林', enemies: ['迷霧史萊姆', '腐木野狼', '荊棘哥布林'], boss: '森林之主', color: '#3a6048', enemyColor: '#a0c890' },
  { id: 2, name: '骸骨墓地', desc: '亡者徘徊的禁忌之地', enemies: ['白骨戰士', '遊魂', '屍鬼'], boss: '亡靈領主', color: '#605a3a', enemyColor: '#e0dcb8' },
  { id: 3, name: '詛咒城堡', desc: '血色詛咒永不停息', enemies: ['黑暗騎士', '吸血蝙蝠', '幽靈僕從'], boss: '吸血伯爵', color: '#3a2848', enemyColor: '#d0a0c8' },
  { id: 4, name: '死靈深淵', desc: '無底深淵中的低語', enemies: ['深淵蠕蟲', '骨龍', '黑暗法師'], boss: '深淵之眼', color: '#28384a', enemyColor: '#a0c0e0' },
  { id: 5, name: '永夜之巔', desc: '世界盡頭的最終試煉', enemies: ['冰晶巨魔', '末日騎士', '虛無使者'], boss: '永夜之神', color: '#1a1a3a', enemyColor: '#c8c8ff' },
];

// ─────────────────────────────────────────────────────────────
// 狀態
// ─────────────────────────────────────────────────────────────
function emptyEquip() {
  return { weapon: null, helmet: null, armor: null, boots: null, accessory: null };
}

function newState() {
  const inv = Array(CFG.INV_SIZE).fill(null);
  const knightEq = emptyEquip();
  knightEq.weapon = { id: 1, type: 'weapon', tier: 1 };
  return {
    inventory: inv,
    roster: {
      knight:   { unlocked: true,  equipped: knightEq },
      mage:     { unlocked: false, equipped: emptyEquip() },
      assassin: { unlocked: false, equipped: emptyEquip() },
      paladin:  { unlocked: false, equipped: emptyEquip() },
    },
    party: ['knight'],     // 上陣鬼魂（最多 3）
    selected: 'knight',    // 背包/裝備 UI 選中的成員
    potions: { hpSmall: 3, hpMedium: 0, hpLarge: 0 },
    skillLevels: { soulSlash: 1, whirlwind: 0, drainLife: 0, ghostShield: 0 },
    level: 1,
    exp: 0,
    gold: 50,
    crystal: 0,
    dungeon: 1,
    stage: 1,
    stageKills: 0,
    maxDungeon: 1,
    maxStage: 1,
    starLevel: 1,
    totalKills: 0,
    totalSummons: 0,
    lastSave: Date.now(),
    _itemIdCounter: 2,
  };
}

const PARTY_MAX = 3;

let S = newState();
let RT = {
  members: [],           // 執行期上陣成員 [{id,hp,maxHP,...}]
  enemy: null,
  enemySpawnDelay: 0,
  exploring: false,
  exploreT: 0,
  shake: 0,
  flash: 0,
  particles: [],
  rewards: [],
  skillFx: [],
  fireflies: null,
  cachedStats: {},       // per-member 屬性快取，key=memberId
  lastTime: 0,
  battleCtx: null,
  bgCtx: null,
};

// 星級倍率：怪物與獎勵隨星級指數成長
function starMul() { return Math.pow(2.4, (S.starLevel || 1) - 1); }
function starRewardMul() { return Math.pow(3, (S.starLevel || 1) - 1); }

function nextItemId() { return S._itemIdCounter++; }

// ─────────────────────────────────────────────────────────────
// 等級系統
// ─────────────────────────────────────────────────────────────
function expForLevel(lv) {
  return Math.round(60 * Math.pow(1.55, lv - 1));
}

function gainExp(amount) {
  S.exp += amount;
  let leveled = false;
  while (S.exp >= expForLevel(S.level)) {
    S.exp -= expForLevel(S.level);
    S.level++;
    leveled = true;
    showToast('✨ 等級提升！Lv.' + S.level, 'success');
  }
  if (leveled && typeof SOUND !== 'undefined') SOUND.levelUp();
  invalidateStats();
}

function levelBonus() {
  // 每等級給（降低 HP 成長）：+2 ATK, +5 HP, +0.2 DEF
  const lv = S.level - 1;
  return { ATK: 2 * lv, HP: 5 * lv, DEF: 0.2 * lv };
}

// ── 隊伍/裝備存取 helpers（以選中成員為操作對象）──
function memberEquip(id) { return S.roster[id] ? S.roster[id].equipped : null; }
function selEquip() { return memberEquip(S.selected) || emptyEquip(); }

// ─────────────────────────────────────────────────────────────
// 召喚 / 掉落
// ─────────────────────────────────────────────────────────────
function rollSummon(luckBoost) {
  luckBoost = luckBoost || 0;
  const types = SLOT_ORDER;
  const type = types[Math.floor(Math.random() * types.length)];

  let totalW = 0;
  const weights = {};
  for (const [k, v] of Object.entries(RARITY)) {
    let w = v.dropWeight;
    if (luckBoost > 0) {
      if (k === 'common') w = Math.max(1, w - luckBoost * 20);
      else if (k === 'rare') w += luckBoost * 8;
      else if (k === 'epic') w += luckBoost * 5;
    }
    weights[k] = w;
    totalW += w;
  }

  let r = Math.random() * totalW;
  let rarity = 'common';
  for (const [k, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) { rarity = k; break; }
  }

  let tier;
  if (rarity === 'common') tier = 1 + Math.floor(Math.random() * 3);
  else if (rarity === 'rare') tier = 4 + Math.floor(Math.random() * 3);
  else if (rarity === 'epic') tier = 7 + Math.floor(Math.random() * 3);
  else if (rarity === 'legendary') tier = 10 + Math.floor(Math.random() * 3);
  else tier = 13 + Math.floor(Math.random() * 3);

  return { id: nextItemId(), type, tier };
}

function rollBossDrop() {
  const luck = 2 + Math.floor(S.dungeon / 2);
  let item = rollSummon(luck);
  while (item.tier < 5) item = rollSummon(luck);
  return item;
}

// ─────────────────────────────────────────────────────────────
// 背包 / 裝備欄
// ─────────────────────────────────────────────────────────────
function findEmptySlot() {
  return S.inventory.findIndex(s => s === null);
}

function addItem(item) {
  const idx = findEmptySlot();
  if (idx === -1) return -1;
  S.inventory[idx] = item;
  return idx;
}

function equipFromInv(invIdx, memberId) {
  const item = S.inventory[invIdx];
  if (!item) return false;
  const id = memberId || S.selected;
  const eq = memberEquip(id);
  if (!eq) return false;
  const slot = item.type;
  const old = eq[slot];
  eq[slot] = item;
  S.inventory[invIdx] = old; // 舊裝備放回背包格
  invalidateStats(id);
  if (typeof SOUND !== 'undefined') SOUND.equip();
  return true;
}

function unequip(slot, memberId) {
  const id = memberId || S.selected;
  const eq = memberEquip(id);
  if (!eq) return false;
  const item = eq[slot];
  if (!item) return false;
  const idx = findEmptySlot();
  if (idx === -1) {
    showToast('背包已滿', 'warn');
    if (typeof SOUND !== 'undefined') SOUND.error();
    return false;
  }
  S.inventory[idx] = item;
  eq[slot] = null;
  invalidateStats(id);
  if (typeof SOUND !== 'undefined') SOUND.unequip();
  return true;
}

function autoEquipBest(memberId) {
  const id = memberId || S.selected;
  const eq = memberEquip(id);
  if (!eq) return 0;
  let changed = 0;
  for (const slot of SLOT_ORDER) {
    const cur = eq[slot];
    let bestIdx = -1, bestPow = cur ? itemPower(cur) : -1;
    for (let i = 0; i < CFG.INV_SIZE; i++) {
      const it = S.inventory[i];
      if (!it || it.type !== slot) continue;
      const p = itemPower(it);
      if (p > bestPow) { bestPow = p; bestIdx = i; }
    }
    if (bestIdx >= 0) { equipFromInv(bestIdx, id); changed++; }
  }
  return changed;
}

function mergeAt(srcIdx, dstIdx) {
  if (srcIdx === dstIdx) return false;
  const a = S.inventory[srcIdx];
  const b = S.inventory[dstIdx];
  if (!a || !b) return false;
  if (a.type !== b.type || a.tier !== b.tier) return false;
  if (a.tier >= CFG.TIER_MAX) return false;
  S.inventory[srcIdx] = null;
  S.inventory[dstIdx] = { id: nextItemId(), type: a.type, tier: a.tier + 1 };
  invalidateStats();
  if (typeof SOUND !== 'undefined') SOUND.merge();
  return true;
}

function swapSlots(a, b) {
  const t = S.inventory[a];
  S.inventory[a] = S.inventory[b];
  S.inventory[b] = t;
  invalidateStats();
}

function autoMerge() {
  let merged = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let tier = 1; tier < CFG.TIER_MAX; tier++) {
      for (const type of SLOT_ORDER) {
        const indices = [];
        for (let i = 0; i < CFG.INV_SIZE; i++) {
          const it = S.inventory[i];
          if (it && it.type === type && it.tier === tier) indices.push(i);
        }
        for (let i = 0; i + 1 < indices.length; i += 2) {
          mergeAt(indices[i], indices[i + 1]);
          merged++;
          changed = true;
        }
      }
    }
  }
  return merged;
}

// 找另一個同型同階可合成的格子；回傳新格 index 或 -1
function findMergePartner(idx) {
  const a = S.inventory[idx];
  if (!a || a.tier >= CFG.TIER_MAX) return -1;
  for (let i = 0; i < CFG.INV_SIZE; i++) {
    if (i === idx) continue;
    const b = S.inventory[i];
    if (b && b.type === a.type && b.tier === a.tier) return i;
  }
  return -1;
}

// 一鍵把某格不斷與同階合成（盡量升到最高）
function mergeOne(idx) {
  let cur = idx, did = false;
  while (true) {
    const partner = findMergePartner(cur);
    if (partner < 0) break;
    // mergeAt 把 src 清空、dst 升階
    mergeAt(cur, partner);
    cur = partner;       // 升階後的格子
    did = true;
  }
  return did ? cur : -1;
}

function sortInventory() {
  const items = S.inventory.filter(x => x);
  items.sort((a, b) => {
    const ta = SLOT_ORDER.indexOf(a.type);
    const tb = SLOT_ORDER.indexOf(b.type);
    if (ta !== tb) return ta - tb;
    return b.tier - a.tier;
  });
  S.inventory.fill(null);
  for (let i = 0; i < items.length; i++) S.inventory[i] = items[i];
  invalidateStats();
}

function itemSellPrice(item) {
  if (!item) return 0;
  return Math.round(15 * Math.pow(1.65, item.tier - 1));
}

function sellAt(invIdx) {
  const item = S.inventory[invIdx];
  if (!item) return 0;
  const price = itemSellPrice(item);
  S.gold += price;
  S.inventory[invIdx] = null;
  if (typeof SOUND !== 'undefined') SOUND.coin();
  return price;
}

function sellLowTier() {
  // 賣掉所有 tier 1-3 普通裝備
  let gold = 0, count = 0;
  for (let i = 0; i < CFG.INV_SIZE; i++) {
    const it = S.inventory[i];
    if (it && it.tier <= 3) {
      gold += itemSellPrice(it);
      S.inventory[i] = null;
      count++;
    }
  }
  S.gold += gold;
  return { gold, count };
}

// ─────────────────────────────────────────────────────────────
// 屬性計算
// ─────────────────────────────────────────────────────────────
// 單一成員屬性（降低 HP 基數：100→55）
function computeMemberStats(id) {
  const lb = levelBonus();
  const cls = CLASSES[id] || CLASSES.knight;
  const m = cls.mul;
  const eq = memberEquip(id) || emptyEquip();
  let base = { HP: 55 + lb.HP, ATK: 5 + lb.ATK, DEF: 0 + lb.DEF, SPD: 1.0, CRIT: 0.05 };
  for (const slot of SLOT_ORDER) {
    const item = eq[slot];
    if (!item) continue;
    const st = itemStats(item);
    for (const k in st) base[k] = (base[k] || 0) + st[k];
  }
  base.HP *= m.HP;
  base.ATK *= m.ATK;
  base.DEF *= m.DEF;
  base.SPD *= m.SPD;
  base.CRIT = base.CRIT * m.CRIT + (m.CRITBONUS || 0);
  if (base.SPD > 5) base.SPD = 5;
  if (base.CRIT > 1) base.CRIT = 1;
  base.DPS = base.ATK * base.SPD * (1 + base.CRIT * 0.6);
  return base;
}

function getMemberStats(id) {
  if (!RT.cachedStats[id]) RT.cachedStats[id] = computeMemberStats(id);
  return RT.cachedStats[id];
}

function invalidateStats(id) {
  if (id) delete RT.cachedStats[id];
  else RT.cachedStats = {};
}

// 全隊合計（給離線收益/顯示用）
function partyDPS() {
  return S.party.reduce((s, id) => s + getMemberStats(id).DPS, 0);
}

// ── 隊伍管理 ──
function unlockMember(id) {
  if (!CLASSES[id] || S.roster[id].unlocked) return false;
  const cost = CLASSES[id].cost;
  if (S.crystal < cost) {
    showToast(`需要 ${cost} 靈晶解鎖`, 'warn');
    if (typeof SOUND !== 'undefined') SOUND.error();
    return false;
  }
  S.crystal -= cost;
  S.roster[id].unlocked = true;
  // 啟用該職業技能
  const skId = CLASS_SKILL[id];
  if (skId && !S.skillLevels[skId]) S.skillLevels[skId] = 1;
  showToast(`🎉 解鎖鬼魂：${CLASSES[id].name}`, 'success');
  if (typeof SOUND !== 'undefined') SOUND.levelUp();
  // 隊伍有空位自動上陣
  if (S.party.length < PARTY_MAX) addToParty(id);
  return true;
}

function addToParty(id) {
  if (!S.roster[id] || !S.roster[id].unlocked) return false;
  if (S.party.includes(id)) return false;
  if (S.party.length >= PARTY_MAX) { showToast('隊伍已滿（最多 3 隻）', 'warn'); return false; }
  S.party.push(id);
  syncMembers();
  return true;
}

function removeFromParty(id) {
  if (S.party.length <= 1) { showToast('至少需保留 1 隻上陣', 'warn'); return false; }
  S.party = S.party.filter(x => x !== id);
  if (S.selected === id) S.selected = S.party[0];
  syncMembers();
  return true;
}

// 依 S.party 重建 RT.members（保留現有 hp 比例）
function syncMembers() {
  const prev = {};
  (RT.members || []).forEach(m => prev[m.id] = m);
  RT.members = S.party.map((id, i) => {
    const st = getMemberStats(id);
    const old = prev[id];
    const ratio = old && old.maxHP ? (old.hp / old.maxHP) : 1;
    return {
      id, slot: i,
      hp: old ? Math.min(st.HP, st.HP * ratio) : st.HP,
      maxHP: st.HP,
      atkCooldown: old ? old.atkCooldown : (0.3 + i * 0.15),
      hurtTime: 0, attackAnim: old ? old.attackAnim : 0,
      shieldTime: old ? old.shieldTime : 0,
      walkPhase: i * 1.3,
      downed: false, downTimer: 0,
      skillCD: old ? old.skillCD : {},
      px: 0, py: 0,
    };
  });
}

function getStats() { return getMemberStats(S.party[0] || 'knight'); } // 相容舊呼叫

// ─────────────────────────────────────────────────────────────
// 補血藥
// ─────────────────────────────────────────────────────────────
// 補血：對血量最低（且未滿、未倒地）的成員使用
function lowestMember() {
  let best = null, bestPct = 1;
  (RT.members || []).forEach(m => {
    if (m.downed) return;
    const pct = m.hp / m.maxHP;
    if (pct < bestPct) { bestPct = pct; best = m; }
  });
  return best;
}

function usePotion(kind) {
  if (!S.potions[kind] || S.potions[kind] <= 0) return false;
  const m = lowestMember();
  if (!m || m.hp >= m.maxHP) return false;
  S.potions[kind]--;
  const heal = Math.round(m.maxHP * POTIONS[kind].heal);
  m.hp = Math.min(m.maxHP, m.hp + heal);
  RT.particles.push({
    kind: 'dmg', x: m.px || 60, y: (m.py || 70) - 28,
    vy: -1.5, life: 1.0, text: '+' + formatNum(heal), color: '#3aff8a', size: 13
  });
  if (typeof SOUND !== 'undefined') SOUND.potion();
  return true;
}

function autoUsePotion() {
  const m = lowestMember();
  if (!m || m.hp >= m.maxHP) return;
  const pct = m.hp / m.maxHP;
  if (pct < CFG.EMERGENCY_POTION_THRESHOLD) {
    if (usePotion('hpLarge')) return;
    if (usePotion('hpMedium')) return;
    if (usePotion('hpSmall')) return;
  } else if (pct < CFG.AUTO_POTION_THRESHOLD) {
    if (usePotion('hpSmall')) return;
    if (usePotion('hpMedium')) return;
    if (usePotion('hpLarge')) return;
  }
}

// ─────────────────────────────────────────────────────────────
// 技能
// ─────────────────────────────────────────────────────────────
// 每隻上陣成員自動施放其職業技能
function tryAutoCast(dt) {
  for (const m of RT.members) {
    if (m.downed) continue;
    const skId = CLASS_SKILL[m.id];
    const lv = S.skillLevels[skId] || 0;
    if (!lv) continue;
    if (!m.skillCD) m.skillCD = {};
    if (m.skillCD[skId] === undefined) m.skillCD[skId] = SKILLS[skId].baseCD;
    m.skillCD[skId] -= dt;
    if (m.skillCD[skId] <= 0 && RT.enemy && RT.enemy.hp > 0 && RT.enemy.approachT >= 1) {
      m.skillCD[skId] = SKILLS[skId].baseCD;
      try { SKILLS[skId].cast(m, getMemberStats(m.id), lv); } catch (e) {}
      m.attackAnim = 0.32;
    }
  }
}

function upgradeSkill(id) {
  const lv = S.skillLevels[id];
  if (!lv) return false;
  if (lv >= 10) return false;
  const cost = SKILLS[id].upgradeCost(lv);
  if (S.crystal < cost) {
    showToast('靈晶不足（需 ' + cost + '）', 'warn');
    return false;
  }
  S.crystal -= cost;
  S.skillLevels[id]++;
  showToast('🌟 ' + SKILLS[id].name + ' 升至 Lv.' + S.skillLevels[id], 'success');
  return true;
}

// ─────────────────────────────────────────────────────────────
// 戰鬥
// ─────────────────────────────────────────────────────────────
function enemyHPFor(dungeon, stage, isBoss, mulOverride) {
  const stageMul = Math.pow(1.32, stage - 1);
  const dungMul = Math.pow(4.5, dungeon - 1);
  const typeMul = mulOverride && mulOverride.hp ? mulOverride.hp : 1;
  let hp = 80 * stageMul * dungMul * typeMul * starMul();
  if (isBoss) hp *= 18;
  return Math.round(hp);
}

function enemyATKFor(dungeon, stage, isBoss, mulOverride) {
  const stageMul = Math.pow(1.28, stage - 1);
  const dungMul = Math.pow(3.2, dungeon - 1);
  const typeMul = mulOverride && mulOverride.atk ? mulOverride.atk : 1;
  let atk = 4 * stageMul * dungMul * typeMul * starMul();
  if (isBoss) atk *= 1.7;
  return atk;
}

function enemySPDFor(dungeon, isBoss, mulOverride) {
  const base = 0.7 + dungeon * 0.03;
  const typeMul = mulOverride && mulOverride.spd ? mulOverride.spd : 1;
  return base * typeMul * (isBoss ? 1.2 : 1);
}

function enemyExpFor(dungeon, stage, isBoss) {
  return Math.round((isBoss ? 40 : 6) * Math.pow(1.22, stage - 1) * Math.pow(1.7, dungeon - 1));
}

function spawnEnemy() {
  const dg = DUNGEONS[S.dungeon - 1];
  const isBoss = S.stage === 10;
  // 隨機怪物類型；BOSS 用 tank 樣式但放大
  const typeId = isBoss ? 'tank' : ENEMY_TYPE_IDS[Math.floor(Math.random() * ENEMY_TYPE_IDS.length)];
  const type = ENEMY_TYPES[typeId];
  const name = isBoss ? dg.boss : (type.name + dg.enemies[Math.floor(Math.random() * dg.enemies.length)]);
  const hp = enemyHPFor(S.dungeon, S.stage, isBoss, type.mul);
  const atk = enemyATKFor(S.dungeon, S.stage, isBoss, type.mul);
  const spd = enemySPDFor(S.dungeon, isBoss, type.mul);
  RT.enemy = {
    name, isBoss, typeId,
    type, // 引用
    hp, maxHp: hp,
    atk, spd,
    atkCooldown: 1 / spd,
    hurtTime: 0,
    attackAnim: 0,
    approachT: 0,       // 0→1 從右側滑入
    bobPhase: Math.random() * Math.PI,
    color: type.color,
    dungeonColor: dg.enemyColor,
  };
  if (typeof SOUND !== 'undefined') {
    if (isBoss) SOUND.bossAppear();
    SOUND.setIntense(isBoss);
  }
}

function spawnReward(text, color) {
  RT.rewards.push({
    text, color,
    x: 30 + Math.random() * 40,
    y: 80 + Math.random() * 20,
    vy: -1.5,
    life: 1.2,
  });
}

function spawnHitNum(x, y, dmg, crit, isHero) {
  RT.particles.push({
    kind: 'dmg', x, y, vy: -2, life: 1.0,
    text: (isHero ? '' : '-') + formatNum(Math.round(dmg)),
    color: crit ? '#ffd700' : (isHero ? '#ff6060' : '#ffffff'),
    size: crit ? 16 : 12,
  });
}

function spawnSlashParticle(x, y) {
  for (let i = 0; i < 4; i++) {
    RT.particles.push({
      kind: 'spark', x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 3 - 0.5,
      life: 0.5, color: 'rgba(126,184,247,1)', size: Math.random() * 2 + 1,
    });
  }
}

function spawnDeathFx(x, y, color) {
  // 爆散火花
  for (let i = 0; i < 18; i++) {
    const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
    const sp = 2 + Math.random() * 4;
    RT.particles.push({
      kind: 'spark', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
      life: 0.8, color: color || 'rgba(255,255,220,1)', size: Math.random() * 3 + 1.5,
    });
  }
  // 靈魂飄散（向上的小幽靈魂）
  for (let i = 0; i < 5; i++) {
    RT.particles.push({
      kind: 'soul', x: x + (Math.random() - 0.5) * 20, y,
      vx: (Math.random() - 0.5) * 1.5, vy: -1.5 - Math.random(),
      life: 1.2, color: 'rgba(200,220,255,0.9)', size: 3 + Math.random() * 2,
    });
  }
  RT.skillFx.push({ kind: 'ring', x, y, t: 0.4, max: 0.4, color: color || '#ffe0a0', r0: 6, r1: 38 });
}

// 命中衝擊環 + 火花
function spawnImpact(x, y, color, crit) {
  RT.skillFx.push({ kind: 'ring', x, y, t: 0.28, max: 0.28, color: color, r0: 4, r1: crit ? 34 : 22 });
  const n = crit ? 10 : 5;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const sp = 2 + Math.random() * (crit ? 4 : 2.5);
    RT.particles.push({
      kind: 'spark', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5,
      life: 0.45, color, size: Math.random() * 2 + 1,
    });
  }
}

function dealEnemyDamage(dmg, crit) {
  if (!RT.enemy || RT.enemy.hp <= 0) return;
  RT.enemy.hp = Math.max(0, RT.enemy.hp - dmg);
  RT.enemy.hurtTime = 0.18;
  const c = RT.battleCanvasSize || { w: 380, h: 170 };
  const ix = c.w * 0.72, iy = c.h * 0.5;
  spawnHitNum(ix + (Math.random() - 0.5) * 30, c.h * 0.4, dmg, crit, false);
  spawnImpact(ix, iy, crit ? '#ffd700' : '#ffffff', crit);
  RT.shake = Math.max(RT.shake, crit ? 0.22 : 0.08);
  if (typeof SOUND !== 'undefined') {
    if (crit) SOUND.crit();
    else SOUND.attack();
  }
  if (RT.enemy.hp <= 0) onEnemyKilled();
}

// 敵人攻擊隨機一名未倒地成員
function dealHeroDamage(dmg) {
  const alive = RT.members.filter(m => !m.downed);
  if (!alive.length) return;
  const m = alive[Math.floor(Math.random() * alive.length)];
  if (m.shieldTime > 0) {
    RT.particles.push({ kind: 'dmg', x: m.px, y: m.py - 26, vy: -1.5, life: 0.8, text: '無敵', color: '#9a6af7', size: 11 });
    return;
  }
  const stats = getMemberStats(m.id);
  const reduced = Math.max(1, Math.round(dmg * (100 / (100 + stats.DEF))));
  m.hp = Math.max(0, m.hp - reduced);
  m.hurtTime = 0.28;
  spawnHitNum(m.px + (Math.random() - 0.5) * 16, m.py - 16, reduced, false, true);
  spawnImpact(m.px + 4, m.py, '#ff6060', false);
  RT.shake = Math.max(RT.shake, 0.12);
  if (typeof SOUND !== 'undefined') SOUND.hit();
  if (m.hp <= 0) {
    m.downed = true; m.downTimer = 5;
    showToast('💀 ' + CLASSES[m.id].name + ' 倒下了！5 秒後復活', 'warn');
    if (RT.members.every(mm => mm.downed)) onPartyWipe();
  }
}

function onPartyWipe() {
  S.stageKills = 0;
  RT.enemy = null;
  RT.enemySpawnDelay = 1.5;
  RT.members.forEach(m => { m.downed = false; m.downTimer = 0; m.hp = m.maxHP; });
  const penalty = Math.floor(S.gold * 0.03);
  S.gold = Math.max(0, S.gold - penalty);
  showToast(penalty > 0 ? ('💀 全隊覆滅！失去 ' + formatNum(penalty) + ' 靈幣') : '💀 全隊覆滅！重新挑戰', 'error');
  if (typeof SOUND !== 'undefined') SOUND.heroDie();
}

function onEnemyKilled() {
  const stageMul = Math.pow(1.20, S.stage - 1);
  const dungMul = Math.pow(2.4, S.dungeon - 1);
  const isBoss = RT.enemy.isBoss;

  const goldDrop = Math.round(8 * stageMul * dungMul * starRewardMul() * (isBoss ? 12 : 1));
  S.gold += goldDrop;
  S.totalKills++;
  S.stageKills++;

  // 經驗
  gainExp(enemyExpFor(S.dungeon, S.stage, isBoss));

  spawnReward('💰 +' + formatNum(goldDrop), '#ffd700');
  if (typeof SOUND !== 'undefined') {
    if (isBoss) SOUND.bossDie();
    else SOUND.enemyDie();
    setTimeout(() => SOUND.coin(), 80);
  }

  // 裝備掉落
  const dropChance = isBoss ? 1.0 : 0.10 + S.dungeon * 0.015;
  if (Math.random() < dropChance) {
    const item = isBoss ? rollBossDrop() : rollSummon(Math.floor(S.dungeon / 2));
    const slotIdx = addItem(item);
    if (slotIdx >= 0) {
      spawnReward('🎁 ' + ITEM_TYPES[item.type].name + ' T' + item.tier,
                  RARITY[tierToRarity(item.tier)].color);
      if (typeof SOUND !== 'undefined') {
        const r = tierToRarity(item.tier);
        if (r === 'mythic' || r === 'legendary') setTimeout(() => SOUND.legendaryDrop(), 200);
        else if (r === 'epic' || r === 'rare') setTimeout(() => SOUND.rareDrop(), 200);
      }
    } else {
      const bonus = Math.round(goldDrop * 0.5);
      S.gold += bonus;
      spawnReward('💰 +' + formatNum(bonus) + ' 背包滿', '#ff8080');
    }
  }

  // 補血藥掉落（5% 機率掉小補血藥）
  if (Math.random() < 0.05 && !isBoss) {
    S.potions.hpSmall++;
    spawnReward('🧪 +1', '#3aff8a');
  }

  if (isBoss) {
    const crystalDrop = Math.round((5 + S.dungeon * 3) * Math.sqrt(starRewardMul()));
    S.crystal += crystalDrop;
    spawnReward('💎 +' + crystalDrop, '#9a6af7');
    // BOSS 給 1 個中補血藥
    S.potions.hpMedium++;
    spawnReward('⚗️ +1', '#3aff8a');
    if (typeof SOUND !== 'undefined') setTimeout(() => SOUND.crystal(), 300);
  }

  const c = RT.battleCanvasSize || { w: 380, h: 170 };
  spawnDeathFx(c.w * 0.72, c.h * 0.5, RT.enemy.type ? RT.enemy.type.glow : '#ffe0a0');
  RT.shake = Math.max(RT.shake, isBoss ? 0.5 : 0.15);
  if (isBoss) RT.flash = 0.3;

  if (isBoss || S.stageKills >= CFG.KILLS_PER_STAGE) {
    advanceStage();
  } else {
    RT.enemy = null;
    RT.enemySpawnDelay = 0.5;
  }
}

function advanceStage() {
  S.stageKills = 0;
  if (S.stage === 10) {
    if (S.dungeon < DUNGEONS.length) {
      S.dungeon++;
      S.stage = 1;
      if (S.dungeon > S.maxDungeon) {
        S.maxDungeon = S.dungeon;
        S.maxStage = 1;
      }
      showToast('✨ 解鎖新地城：' + DUNGEONS[S.dungeon - 1].name, 'success');
    } else {
      // 通關全地城 → 星級提升，世界重置變更難
      S.starLevel = (S.starLevel || 1) + 1;
      S.dungeon = 1;
      S.stage = 1;
      invalidateStats();
      showToast('⭐ 星級提升！世界 ' + S.starLevel + ' 星 · 怪物更強、獎勵更豐厚！', 'success');
      if (typeof SOUND !== 'undefined') { SOUND.levelUp(); setTimeout(() => SOUND.crystal(), 300); }
      RT.enemy = null;
      RT.enemySpawnDelay = 1.2;
      return;
    }
  } else {
    S.stage++;
    if (S.dungeon === S.maxDungeon && S.stage > S.maxStage) {
      S.maxStage = S.stage;
    }
  }
  RT.enemy = null;
  RT.enemySpawnDelay = 0.8;
}

function updateBattle(dt) {
  // 成員數與 party 不一致就重建
  if (!RT.members || RT.members.length !== S.party.length) syncMembers();

  // 全域動畫計時器
  if (RT.shake > 0) RT.shake = Math.max(0, RT.shake - dt);
  if (RT.flash > 0) RT.flash = Math.max(0, RT.flash - dt);

  // 每成員：刷新 maxHP、遞減計時器、倒地復活
  for (const m of RT.members) {
    const st = getMemberStats(m.id);
    m.maxHP = st.HP;
    if (m.hurtTime > 0) m.hurtTime = Math.max(0, m.hurtTime - dt);
    if (m.attackAnim > 0) m.attackAnim = Math.max(0, m.attackAnim - dt);
    if (m.shieldTime > 0) m.shieldTime = Math.max(0, m.shieldTime - dt);
    if (m.downed) {
      m.downTimer -= dt;
      if (m.downTimer <= 0) { m.downed = false; m.hp = m.maxHP * 0.5; }
    }
  }

  if (!RT.enemy) {
    // 探險（走路 + 緩慢回血）
    RT.exploring = true;
    RT.exploreT += dt;
    for (const m of RT.members) {
      m.walkPhase += dt * 9;
      if (!m.downed) m.hp = Math.min(m.maxHP, m.hp + m.maxHP * 0.03 * dt);
    }
    RT.enemySpawnDelay -= dt;
    if (RT.enemySpawnDelay <= 0) spawnEnemy();
    return;
  }
  RT.exploring = false;

  // 敵人入場
  if (RT.enemy.attackAnim > 0) RT.enemy.attackAnim = Math.max(0, RT.enemy.attackAnim - dt);
  if (RT.enemy.hurtTime > 0) RT.enemy.hurtTime = Math.max(0, RT.enemy.hurtTime - dt);
  RT.enemy.bobPhase += dt * 2;
  if (RT.enemy.approachT < 1) {
    RT.enemy.approachT = Math.min(1, RT.enemy.approachT + dt * 2.2);
    return;
  }

  autoUsePotion();
  tryAutoCast(dt);

  // 每成員普攻 + 緩慢回血
  for (const m of RT.members) {
    if (m.downed) continue;
    const st = getMemberStats(m.id);
    m.hp = Math.min(m.maxHP, m.hp + m.maxHP * 0.004 * dt);
    m.atkCooldown -= dt;
    if (m.atkCooldown <= 0) {
      m.atkCooldown = 1 / st.SPD;
      m.attackAnim = 0.32;
      const crit = Math.random() < st.CRIT;
      const dmg = Math.max(1, Math.round(st.ATK * (crit ? 1.6 : 1) * (0.9 + Math.random() * 0.2)));
      setTimeout(() => { try { dealEnemyDamage(dmg, crit); } catch (e) {} }, 130);
    }
  }

  // 敵人攻擊（技能可能已同步擊殺敵人 → 先確認還在）
  if (!RT.enemy) return;
  RT.enemy.atkCooldown -= dt;
  if (RT.enemy.atkCooldown <= 0) {
    RT.enemy.atkCooldown = 1 / RT.enemy.spd;
    RT.enemy.attackAnim = 0.34;
    const dmg = Math.max(1, RT.enemy.atk * (0.9 + Math.random() * 0.2));
    setTimeout(() => { try { if (RT.enemy && RT.enemy.approachT >= 1) dealHeroDamage(dmg); } catch (e) {} }, 150);
  }
}

// ─────────────────────────────────────────────────────────────
// 離線收益
// ─────────────────────────────────────────────────────────────
function calculateOfflineRewards(seconds) {
  if (seconds < 30) return null;
  const baseHP = enemyHPFor(S.dungeon, Math.min(S.stage, 9), false);
  const dps = partyDPS();
  const killsPerSec = Math.max(0.05, Math.min(2, dps / baseHP * 0.6));
  const totalKills = Math.floor(killsPerSec * seconds);
  const goldPerKill = 8 * Math.pow(1.20, S.stage - 1) * Math.pow(2.4, S.dungeon - 1);
  const goldEarned = Math.round(totalKills * goldPerKill);
  const expEarned = Math.round(totalKills * enemyExpFor(S.dungeon, Math.min(S.stage, 9), false));

  const drops = [];
  const dropExpected = totalKills * (0.10 + S.dungeon * 0.015);
  const dropCount = Math.min(8, Math.floor(dropExpected));
  for (let i = 0; i < dropCount; i++) drops.push(rollSummon(Math.floor(S.dungeon / 2)));
  const potionCount = Math.min(5, Math.floor(totalKills * 0.05));

  return { seconds, kills: totalKills, gold: goldEarned, exp: expEarned, drops, potions: potionCount };
}

function applyOfflineRewards(rw) {
  if (!rw) return;
  S.gold += rw.gold;
  S.totalKills += rw.kills;
  S.potions.hpSmall += rw.potions || 0;
  gainExp(rw.exp || 0);
  for (const d of rw.drops) {
    if (findEmptySlot() === -1) break;
    addItem(d);
  }
}

// ─────────────────────────────────────────────────────────────
// 存檔
// ─────────────────────────────────────────────────────────────
function save() {
  S.lastSave = Date.now();
  try { localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}

function load() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) {
      // 嘗試讀 v1 舊存檔
      const oldRaw = localStorage.getItem('ghostMerge_v1');
      if (oldRaw) {
        const old = JSON.parse(oldRaw);
        const ns = newState();
        // 遷移
        ns.gold = old.gold || 50;
        ns.crystal = old.crystal || 0;
        ns.dungeon = old.dungeon || 1;
        ns.stage = old.stage || 1;
        ns.maxDungeon = old.maxDungeon || 1;
        ns.totalKills = old.totalKills || 0;
        if (Array.isArray(old.inventory)) {
          old.inventory.forEach(it => {
            if (!it) return;
            // 舊版 shield 轉成 accessory
            if (it.type === 'shield') it.type = 'accessory';
            if (ITEM_TYPES[it.type]) {
              const idx = findEmptySlot.call({ S: ns });
              const empty = ns.inventory.findIndex(x => x === null);
              if (empty >= 0) ns.inventory[empty] = { id: ns._itemIdCounter++, type: it.type, tier: it.tier };
            }
          });
        }
        Object.assign(S, ns);
        return true;
      }
      return false;
    }
    const data = JSON.parse(raw);
    Object.assign(S, data);
    if (!S.potions) S.potions = newState().potions;
    if (!S.skillLevels) S.skillLevels = newState().skillLevels;
    if (S.level === undefined) S.level = 1;
    if (S.exp === undefined) S.exp = 0;
    if (!S.starLevel) S.starLevel = 1;
    if (!Array.isArray(S.inventory) || S.inventory.length !== CFG.INV_SIZE) {
      S.inventory = Array(CFG.INV_SIZE).fill(null);
    }
    // ── 結構正規化（相容單英雄舊存檔）──
    if (!S.roster) {
      const ns = newState();
      S.roster = ns.roster;
      if (S.equipped) S.roster.knight.equipped = S.equipped;           // 舊 equipped → 騎士
      if (S.unlockedClasses) for (const id in S.unlockedClasses) if (S.roster[id]) S.roster[id].unlocked = !!S.unlockedClasses[id];
    }
    // 確保每隻 roster 結構完整
    for (const id of CLASS_IDS) {
      if (!S.roster[id]) S.roster[id] = { unlocked: id === 'knight', equipped: emptyEquip() };
      if (!S.roster[id].equipped) S.roster[id].equipped = emptyEquip();
      for (const slot of SLOT_ORDER) if (!(slot in S.roster[id].equipped)) S.roster[id].equipped[slot] = null;
    }
    S.roster.knight.unlocked = true;
    if (!Array.isArray(S.party) || !S.party.length) {
      S.party = CLASS_IDS.filter(id => S.roster[id].unlocked).slice(0, PARTY_MAX);
      if (!S.party.length) S.party = ['knight'];
    }
    S.party = S.party.filter(id => S.roster[id] && S.roster[id].unlocked).slice(0, PARTY_MAX);
    if (!S.party.length) S.party = ['knight'];
    if (!S.selected || !S.party.includes(S.selected)) S.selected = S.party[0];
    // 啟用已解鎖職業技能
    for (const id of CLASS_IDS) if (S.roster[id].unlocked) { const sk = CLASS_SKILL[id]; if (sk && !S.skillLevels[sk]) S.skillLevels[sk] = 1; }
    delete S.equipped; delete S.heroClass; delete S.unlockedClasses;
    return true;
  } catch (e) { console.warn(e); return false; }
}

function resetGame() {
  localStorage.removeItem(CFG.SAVE_KEY);
  localStorage.removeItem('ghostMerge_v1');
  localStorage.removeItem('ghostMerge_v2');
  S = newState();
  RT.members = [];
  RT.enemy = null;
  RT.enemySpawnDelay = 0.3;
  invalidateStats();
  syncMembers();
  refreshAllUI();
}

// ─────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────
function formatNum(n) {
  if (n < 1000) return Math.floor(n).toString();
  if (n < 1e6) return (n / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'K';
  if (n < 1e9) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n < 1e12) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  return (n / 1e12).toFixed(2) + 'T';
}

function formatTime(s) {
  if (s < 60) return Math.floor(s) + ' 秒';
  if (s < 3600) return Math.floor(s / 60) + ' 分鐘';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h + ' 小時' + (m ? ' ' + m + ' 分' : '');
}

function showToast(msg, kind) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ─────────────────────────────────────────────────────────────
// UI 渲染
// ─────────────────────────────────────────────────────────────
function refreshAllUI() {
  refreshHUD();
  refreshStats();
  refreshInventory();
  refreshEquipment();
  refreshSkills();
  refreshPotions();
  refreshLevel();
  refreshEnemyInfo();
  refreshHeroInfo();
  refreshActions();
}

function refreshHUD() {
  document.getElementById('goldText').textContent = formatNum(S.gold);
  document.getElementById('crystalText').textContent = formatNum(S.crystal);
  const dg = DUNGEONS[S.dungeon - 1];
  document.getElementById('dungeonName').textContent = dg.name;
  document.getElementById('dungeonStage').textContent = S.dungeon + '-' + S.stage;
  const starEl = document.getElementById('starText');
  if (starEl) starEl.textContent = '⭐' + (S.starLevel || 1);
}

function refreshStats() {
  const s = getMemberStats(S.selected);   // 顯示選中成員
  document.getElementById('statATK').textContent = formatNum(s.ATK);
  document.getElementById('statDEF').textContent = formatNum(s.DEF);
  document.getElementById('statHP').textContent = formatNum(s.HP);
  document.getElementById('statSPD').textContent = s.SPD.toFixed(2);
  document.getElementById('statCRIT').textContent = (s.CRIT * 100).toFixed(0) + '%';
  document.getElementById('statDPS').textContent = formatNum(partyDPS()); // DPS 顯示全隊合計
}

function refreshLevel() {
  document.getElementById('levelText').textContent = 'Lv.' + S.level;
  const need = expForLevel(S.level);
  document.getElementById('expFill').style.width = (S.exp / need * 100) + '%';
  document.getElementById('expText').textContent = formatNum(S.exp) + ' / ' + formatNum(need);
}

function refreshSoundUI() {
  if (typeof SOUND === 'undefined') return;
  const muted = !SOUND.sfxEnabled && !SOUND.bgmEnabled;
  const muteBtn = document.getElementById('btnMute');
  if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';

  const sfxBtn = document.getElementById('btnToggleSfx');
  const bgmBtn = document.getElementById('btnToggleBgm');
  if (sfxBtn) sfxBtn.textContent = SOUND.sfxEnabled ? '🔊 音效 開' : '🔇 音效 關';
  if (bgmBtn) bgmBtn.textContent = SOUND.bgmEnabled ? '🎵 音樂 開' : '🔕 音樂 關';
  const sfxVol = document.getElementById('sfxVolume');
  const bgmVol = document.getElementById('bgmVolume');
  if (sfxVol) sfxVol.value = SOUND.sfxVolume;
  if (bgmVol) bgmVol.value = SOUND.bgmVolume;
}

function refreshEnemyInfo() {
  if (!RT.enemy) {
    document.getElementById('enemyName').textContent = '...';
    document.getElementById('enemyHPFill').style.width = '0%';
    document.getElementById('enemyHPText').textContent = '';
  } else {
    document.getElementById('enemyName').textContent = (RT.enemy.isBoss ? '👑 ' : '') + RT.enemy.name;
    const pct = (RT.enemy.hp / RT.enemy.maxHp) * 100;
    document.getElementById('enemyHPFill').style.width = pct + '%';
    document.getElementById('enemyHPText').textContent = formatNum(RT.enemy.hp) + ' / ' + formatNum(RT.enemy.maxHp);
  }
  const kt = document.getElementById('enemyKills');
  if (S.stage === 10) kt.textContent = '👑 BOSS 戰';
  else kt.textContent = '擊殺 ' + S.stageKills + ' / ' + CFG.KILLS_PER_STAGE;
}

// 戰鬥場景上方改顯示「隊伍列」：每隻成員頭像 + HP，可點選為選中成員
function refreshHeroInfo() {
  const bar = document.getElementById('partyBar');
  if (!bar) return;
  if (bar.children.length !== S.party.length) {
    bar.innerHTML = '';
    S.party.forEach(id => {
      const el = document.createElement('div');
      el.className = 'party-chip'; el.dataset.id = id;
      el.innerHTML = `<span class="pc-icon"></span><div class="pc-hpbar"><div class="pc-hpfill"></div></div>`;
      bar.appendChild(el);
    });
  }
  S.party.forEach((id, i) => {
    const el = bar.children[i];
    if (!el) return;
    el.dataset.id = id;
    el.classList.toggle('sel', S.selected === id);
    const cls = CLASSES[id];
    el.querySelector('.pc-icon').textContent = cls.icon;
    const m = RT.members.find(mm => mm.id === id);
    const pct = m ? Math.max(0, m.hp / m.maxHP) * 100 : 100;
    const fill = el.querySelector('.pc-hpfill');
    fill.style.width = pct + '%';
    el.classList.toggle('downed', !!(m && m.downed));
  });
}

// 編隊面板
function openClassModal() {
  const body = document.getElementById('classBody');
  body.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'team-hint';
  hint.textContent = `上陣 ${S.party.length}/${PARTY_MAX} 隻 · 點頭像選取以編輯其裝備`;
  body.appendChild(hint);
  for (const id of CLASS_IDS) {
    const cls = CLASSES[id];
    const r = S.roster[id];
    const unlocked = r.unlocked;
    const fielded = S.party.includes(id);
    const selected = S.selected === id;
    const st = unlocked ? getMemberStats(id) : null;
    const row = document.createElement('div');
    row.className = 'class-item' + (selected ? ' current' : '') + (unlocked ? '' : ' locked');
    row.innerHTML = `
      <div class="class-icon">${cls.icon}</div>
      <div class="class-info">
        <div class="class-name">${cls.name} ${fielded ? '<span class="fielded-tag">上陣中</span>' : ''}</div>
        <div class="class-desc">${cls.desc}${st ? ` · ⚔${formatNum(st.ATK)} ❤${formatNum(st.HP)}` : ''}</div>
      </div>
      <div class="class-action"></div>
    `;
    const act = row.querySelector('.class-action');
    if (!unlocked) {
      const b = document.createElement('button');
      b.className = 'class-btn-unlock'; b.textContent = cls.cost + ' 💎';
      b.onclick = (e) => { e.stopPropagation(); if (unlockMember(id)) { refreshAllUI(); openClassModal(); } };
      act.appendChild(b);
    } else {
      const b = document.createElement('button');
      if (fielded) { b.className = 'class-btn-switch off'; b.textContent = '下陣'; b.onclick = (e) => { e.stopPropagation(); if (removeFromParty(id)) { refreshAllUI(); openClassModal(); } }; }
      else { b.className = 'class-btn-switch'; b.textContent = '上陣'; b.onclick = (e) => { e.stopPropagation(); if (addToParty(id)) { refreshAllUI(); openClassModal(); } }; }
      act.appendChild(b);
    }
    if (unlocked) {
      row.onclick = () => { S.selected = id; refreshAllUI(); openClassModal(); };
    }
    body.appendChild(row);
  }
  document.getElementById('classModal').classList.remove('hidden');
}

// 點背包道具 → 動作卡片（穿戴/合成/賣出），免拖曳
function openItemCard(idx) {
  const item = S.inventory[idx];
  if (!item) return;
  const modal = document.getElementById('itemCardModal');
  const body = document.getElementById('itemCardBody');
  const rar = tierToRarity(item.tier);
  const canMerge = findMergePartner(idx) >= 0 && item.tier < CFG.TIER_MAX;
  const price = itemSellPrice(item);
  const selName = (CLASSES[S.selected] || CLASSES.knight).name;
  body.innerHTML = `
    <div class="ic-head r-${rar}">
      <div class="ic-icon">${itemIcon(item)}</div>
      <div>
        <div class="ic-name" style="color:${RARITY[rar].color}">${RARITY[rar].name} ${ITEM_TYPES[item.type].name} T${item.tier}</div>
        <div class="ic-stats">${itemDescription(item).split('\n')[1] || ''}</div>
      </div>
    </div>
    <div class="ic-btns">
      <button class="ic-btn equip">⚔ 穿到 ${selName}</button>
      <button class="ic-btn merge" ${canMerge ? '' : 'disabled'}>✨ 合成升階${canMerge ? '' : '（無同階）'}</button>
      <button class="ic-btn sell">💰 賣出 +${formatNum(price)}</button>
    </div>`;
  body.querySelector('.equip').onclick = () => {
    if (equipFromInv(idx)) { showToast('⚔ ' + selName + ' 已穿戴', 'success'); refreshAllUI(); }
    modal.classList.add('hidden');
  };
  const mb = body.querySelector('.merge');
  if (canMerge) mb.onclick = () => {
    const res = mergeOne(idx);
    if (res >= 0) { showToast('✨ 合成成功', 'success'); refreshAllUI(); }
    modal.classList.add('hidden');
  };
  body.querySelector('.sell').onclick = () => {
    sellAt(idx); showToast('💰 賣出 +' + formatNum(price), 'success'); refreshAllUI();
    modal.classList.add('hidden');
  };
  modal.classList.remove('hidden');
}

function refreshActions() {
  document.getElementById('summonCost').textContent = formatNum(CFG.SUMMON_COST);
  document.getElementById('summonCost10').textContent = formatNum(CFG.SUMMON10_COST);
  document.getElementById('btnSummon').disabled = S.gold < CFG.SUMMON_COST;
  document.getElementById('btnSummon10').disabled = S.gold < CFG.SUMMON10_COST;
}

function makeItemSlot(item, container) {
  container.classList.remove('r-common', 'r-rare', 'r-epic', 'r-legendary', 'r-mythic', 'empty');
  container.innerHTML = '';
  if (!item) {
    container.classList.add('empty');
    return;
  }
  container.classList.add('r-' + tierToRarity(item.tier));
  const ic = document.createElement('div');
  ic.className = 'item-icon';
  ic.textContent = itemIcon(item);
  container.appendChild(ic);
  const tt = document.createElement('div');
  tt.className = 'item-tier';
  tt.textContent = 'T' + item.tier;
  container.appendChild(tt);
  container.title = itemDescription(item);
}

function refreshEquipment() {
  const row = document.getElementById('equipmentRow');
  const eq = selEquip();
  if (!row.children.length) {
    SLOT_ORDER.forEach(slot => {
      const el = document.createElement('div');
      el.className = 'eq-slot';
      el.dataset.slot = slot;
      el.title = ITEM_TYPES[slot].slotName;
      row.appendChild(el);
    });
  }
  SLOT_ORDER.forEach((slot, i) => {
    const el = row.children[i];
    makeItemSlot(eq[slot], el);
    el.classList.add('eq-slot');
    el.dataset.slot = slot;
    if (!eq[slot]) {
      el.innerHTML = `<div class="eq-placeholder">${ITEM_TYPES[slot].slotName}</div>`;
      el.title = '空：' + ITEM_TYPES[slot].slotName;
    } else {
      el.title = itemDescription(eq[slot]) + '\n（點擊卸下）';
    }
  });
  // 更新選中成員標題
  const lbl = document.getElementById('selMemberLabel');
  if (lbl) { const c = CLASSES[S.selected] || CLASSES.knight; lbl.textContent = c.icon + ' ' + c.name; }
}

function refreshInventory() {
  const grid = document.getElementById('inventoryGrid');
  if (grid.children.length !== CFG.INV_SIZE) {
    grid.innerHTML = '';
    for (let i = 0; i < CFG.INV_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot empty';
      slot.dataset.idx = i;
      grid.appendChild(slot);
    }
  }
  for (let i = 0; i < CFG.INV_SIZE; i++) {
    const el = grid.children[i];
    el.dataset.idx = i;
    makeItemSlot(S.inventory[i], el);
    if (S.inventory[i]) {
      el.title = itemDescription(S.inventory[i]) + `\n點一下：穿戴 / 合成 / 賣出`;
    }
  }
}

function refreshSkills() {
  const row = document.getElementById('skillRow');
  if (!row.children.length) {
    SKILL_IDS.forEach(id => {
      const el = document.createElement('div');
      el.className = 'skill-slot';
      el.dataset.id = id;
      el.innerHTML = `
        <div class="sk-icon">${SKILLS[id].icon}</div>
        <div class="sk-cd"><div class="sk-cd-fill"></div></div>
        <div class="sk-lv"></div>
        <div class="sk-cd-text"></div>
      `;
      row.appendChild(el);
    });
  }
  SKILL_IDS.forEach((id, i) => {
    const el = row.children[i];
    const lv = S.skillLevels[id] || 0;
    const skCls = SKILLS[id].cls;            // 此技能所屬職業
    const fielded = S.party.includes(skCls); // 該職業是否上陣
    // 取上陣中該職業成員的 CD
    const m = RT.members.find(mm => mm.id === skCls);
    const cd = (m && m.skillCD && m.skillCD[id] != null) ? m.skillCD[id] : 0;
    el.querySelector('.sk-icon').textContent = CLASSES[skCls].icon;
    const lvEl = el.querySelector('.sk-lv');
    const cdEl = el.querySelector('.sk-cd-fill');
    const cdTxt = el.querySelector('.sk-cd-text');
    if (!lv || !fielded) {
      el.classList.add('locked');
      lvEl.textContent = lv ? '未上陣' : '🔒';
      cdEl.style.height = '0%'; cdTxt.textContent = '';
      el.title = CLASSES[skCls].name + ' 的技能「' + SKILLS[id].name + '」' + (lv ? '（該鬼魂未上陣）' : '（未解鎖該鬼魂）');
    } else {
      el.classList.remove('locked');
      lvEl.textContent = 'Lv.' + lv;
      const total = SKILLS[id].baseCD;
      if (cd > 0) {
        cdEl.style.height = (cd / total * 100) + '%';
        cdTxt.textContent = cd.toFixed(1);
        el.classList.add('cooling');
      } else {
        cdEl.style.height = '0%'; cdTxt.textContent = '';
        el.classList.remove('cooling');
      }
      el.title = SKILLS[id].name + ' Lv.' + lv + '\n' + SKILLS[id].desc(lv) + '\nCD ' + total + 's';
    }
  });
}

function refreshPotions() {
  const row = document.getElementById('potionRow');
  if (!row.children.length) {
    ['hpSmall', 'hpMedium', 'hpLarge'].forEach(kind => {
      const el = document.createElement('div');
      el.className = 'potion-slot';
      el.dataset.kind = kind;
      el.innerHTML = `
        <div class="pt-icon">${POTIONS[kind].icon}</div>
        <div class="pt-count">0</div>
      `;
      row.appendChild(el);
    });
  }
  ['hpSmall', 'hpMedium', 'hpLarge'].forEach((kind, i) => {
    const el = row.children[i];
    const count = S.potions[kind] || 0;
    el.querySelector('.pt-count').textContent = count;
    el.classList.toggle('empty', count === 0);
    el.title = POTIONS[kind].name + ' x' + count + '\n回復 ' + (POTIONS[kind].heal * 100) + '% HP\n（HP 不足會自動使用）';
  });
}

// ─────────────────────────────────────────────────────────────
// 戰鬥畫面 Canvas
// ─────────────────────────────────────────────────────────────
function setupBattleCanvas() {
  const canvas = document.getElementById('battleCanvas');
  const dpr = window.devicePixelRatio || 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    RT.battleCanvasSize = { w: r.width, h: r.height };
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  RT.battleCtx = canvas.getContext('2d');
}

function hexToRgb(hex) {
  const m = (hex || '').match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!m) return { r: 246, g: 247, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function darken(hex, amt) {
  const c = hexToRgb(hex);
  return `rgb(${Math.floor(c.r * (1 - amt))},${Math.floor(c.g * (1 - amt))},${Math.floor(c.b * (1 - amt))})`;
}

// chibi 幽靈身體 (圓上 + 波浪底邊)
function drawGhostBody(ctx, cx, cy, w, h, color, shadowColor) {
  const halfW = w / 2;
  const bottomY = cy + h * 0.45;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, halfW, Math.PI, 0, false);
  ctx.lineTo(cx + halfW, bottomY);
  const waves = 5;
  const waveW = w / waves;
  for (let i = 0; i < waves; i++) {
    const peak = bottomY + ((i % 2 === 0) ? 6 : 4);
    const midX = cx + halfW - waveW * (i + 0.5);
    const endX = cx + halfW - waveW * (i + 1);
    ctx.quadraticCurveTo(midX, peak, endX, bottomY);
  }
  ctx.closePath();
  ctx.fill();
  // 內部陰影（左下）
  if (shadowColor) {
    ctx.save();
    ctx.fillStyle = shadowColor;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(cx - halfW * 0.35, cy + h * 0.15, halfW * 0.5, h * 0.3, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawStar(ctx, cx, cy, r, color, glowColor) {
  if (glowColor) { ctx.shadowColor = glowColor; ctx.shadowBlur = 6; }
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rd = i % 2 === 0 ? r : r * 0.4;
    const px = cx + Math.cos(a) * rd, py = cy + Math.sin(a) * rd;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawWitchHat(ctx, x, y, color, dark, starColor) {
  // 帽簷
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(x, y, 17, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // 帽尖（傾斜彎曲）
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 13, y);
  ctx.bezierCurveTo(x - 7, y - 7, x - 1, y - 17, x + 5, y - 23);
  ctx.bezierCurveTo(x + 12, y - 26, x + 15, y - 22, x + 12, y - 17);
  ctx.bezierCurveTo(x + 8, y - 9, x + 13, y - 3, x + 13, y);
  ctx.closePath();
  ctx.fill();
  // 帽底高光
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 16, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 星星
  drawStar(ctx, x + 9, y - 13, 3.5, starColor, starColor);
}

function drawBandana(ctx, x, y, color, dark) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 17, y + 2);
  ctx.quadraticCurveTo(x, y - 18, x + 17, y + 2);
  ctx.lineTo(x + 14, y + 6);
  ctx.lineTo(x - 14, y + 6);
  ctx.closePath();
  ctx.fill();
  // 結
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + 26, y + 6);
  ctx.lineTo(x + 18, y + 8);
  ctx.lineTo(x + 14, y + 4);
  ctx.closePath();
  ctx.fill();
  // 圓點裝飾
  ctx.fillStyle = dark;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(x + i * 6, y - 5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHeadband(ctx, x, y, color, dark) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 18, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(x - 18, y + 2, 36, 1.5);
  // 中央 V 字
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 3);
  ctx.lineTo(x, y + 1);
  ctx.lineTo(x + 5, y - 3);
  ctx.closePath();
  ctx.fill();
}

function drawHelmet(ctx, x, y, color, dark, accent) {
  // 半球
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y + 4, 17, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  // 帽簷
  ctx.fillStyle = dark;
  ctx.fillRect(x - 18, y + 4, 36, 4);
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(x - 7, y - 1, 4, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // 鉚釘
  ctx.fillStyle = accent;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(x + i * 10, y - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHalo(ctx, x, y, color, t) {
  const gi = (Math.sin(t * 2) + 1) / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color; ctx.shadowBlur = 12 + gi * 6;
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 17, 5.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 13, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHat(ctx, x, y, hatType, color, dark, accent, t) {
  if (hatType === 'wizard') drawWitchHat(ctx, x, y + 4, color, dark, accent);
  else if (hatType === 'bandana') drawBandana(ctx, x, y, color, dark);
  else if (hatType === 'band') drawHeadband(ctx, x, y, color, dark);
  else if (hatType === 'helmet') drawHelmet(ctx, x, y, color, dark, accent);
  else if (hatType === 'halo') drawHalo(ctx, x, y, color, t);
}

// 跟隨小火球（chibi 風格火焰）
function drawMagicFlame(ctx, x, y, color, t) {
  const flicker = Math.sin(t * 6) * 1.2;
  const c = hexToRgb(color);
  // 光暈
  const g = ctx.createRadialGradient(x, y, 1, x, y, 14);
  g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.7)`);
  g.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},0.3)`);
  g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - 14, y - 16, 28, 30);
  // 火焰形狀
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.bezierCurveTo(x - 5, y + 1, x - 5, y - 5, x - 1 + flicker, y - 9);
  ctx.bezierCurveTo(x - 1, y - 5, x + 2, y - 7, x + 2 + flicker, y - 10);
  ctx.bezierCurveTo(x + 5, y - 3, x + 4, y + 2, x, y + 4);
  ctx.closePath();
  ctx.fill();
  // 內部高光
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 1.2, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// 可愛臉 mood: 'happy' | 'hurt' | 'attack'
function drawCuteFace(ctx, x, y, eyeColor, showBlush, mood) {
  mood = mood || 'happy';
  // 腮紅（先畫在底層）
  if (showBlush) {
    ctx.fillStyle = 'rgba(255, 150, 175, 0.5)';
    ctx.beginPath(); ctx.ellipse(x - 12, y + 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 12, y + 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = eyeColor;
  if (mood === 'hurt') {
    // >_< 受傷瞇眼
    ctx.lineWidth = 1.8; ctx.strokeStyle = eyeColor; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 10, y - 5); ctx.lineTo(x - 4, y - 2); ctx.lineTo(x - 10, y + 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, y - 5); ctx.lineTo(x + 4, y - 2); ctx.lineTo(x + 10, y + 1); ctx.stroke();
    // 痛苦小嘴
    ctx.beginPath(); ctx.ellipse(x, y + 5, 2, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // 大圓黑眼
  ctx.beginPath(); ctx.ellipse(x - 7, y - 3, 4.2, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 7, y - 3, 4.2, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  // 白色高光
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(x - 5.5, y - 5, 1.3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 8.5, y - 5, 1.3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  // 嘴：攻擊時張大喊，平時開心
  ctx.fillStyle = eyeColor;
  const mh = mood === 'attack' ? 3.2 : 2.3;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, mood === 'attack' ? 2.6 : 3.2, mh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8da0';
  ctx.beginPath();
  ctx.ellipse(x, y + 4.5, 2, 1.3, 0, 0, Math.PI);
  ctx.fill();
}

// 邪惡臉
function drawEvilFace(ctx, x, y, eyeColor, eyeStyle, mouth, t) {
  ctx.save();
  ctx.shadowColor = eyeColor; ctx.shadowBlur = 5;
  ctx.fillStyle = eyeColor;
  if (eyeStyle === 'angry') {
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(x + i * 3, y - 4);
      ctx.lineTo(x + i * 12, y - 7);
      ctx.lineTo(x + i * 12, y - 2);
      ctx.lineTo(x + i * 3, y);
      ctx.closePath();
      ctx.fill();
    }
  } else if (eyeStyle === 'sharp') {
    ctx.beginPath();
    ctx.ellipse(x - 8, y - 3, 5.5, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 8, y - 3, 5.5, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (eyeStyle === 'grim') {
    ctx.fillRect(x - 13, y - 4, 8, 2);
    ctx.fillRect(x + 5, y - 4, 8, 2);
  } else if (eyeStyle === 'evil') {
    ctx.beginPath();
    ctx.ellipse(x - 7, y - 3, 4.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7, y - 3, 4.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - 7, y - 3, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 7, y - 3, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
  // 嘴
  if (mouth === 'fang') {
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 3);
    ctx.lineTo(x + 5, y + 3);
    ctx.lineTo(x + 3, y + 7);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x - 3, y + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 3);
    ctx.lineTo(x, y + 5.5);
    ctx.lineTo(x + 2, y + 3);
    ctx.closePath();
    ctx.fill();
  } else if (mouth === 'shout') {
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mouth === 'grin') {
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 3);
    ctx.quadraticCurveTo(x, y + 8, x + 5, y + 3);
    ctx.stroke();
    // 小尖牙
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 5); ctx.lineTo(x - 2, y + 7); ctx.lineTo(x - 1, y + 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 5); ctx.lineTo(x + 2, y + 7); ctx.lineTo(x + 1, y + 5);
    ctx.fill();
  } else if (mouth === 'flat') {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x - 5, y + 4, 10, 1.8);
  }
}

function drawMember(ctx, m, baseX, baseY, t, scale) {
  scale = scale || 0.9;
  const cls = CLASSES[m.id] || CLASSES.knight;
  const gi = (Math.sin(t * 2.5 + m.slot) + 1) / 2;
  const hurt = m.hurtTime > 0;
  const attacking = m.attackAnim > 0;
  const shielded = m.shieldTime > 0;
  const exploring = RT.exploring;
  const selected = (S.selected === m.id);

  m.px = baseX; m.py = baseY;

  // ── 倒地狀態 ──
  if (m.downed) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.translate(baseX, baseY + 14);
    ctx.scale(scale * 1.1, scale * 0.5);   // 壓扁躺平
    drawGhostBody(ctx, 0, -5, 42, 36, '#888', null);
    ctx.restore();
    // 復活倒數
    ctx.font = 'bold 11px Courier New';
    ctx.fillStyle = '#ff8080'; ctx.textAlign = 'center';
    ctx.fillText('💀' + Math.ceil(m.downTimer) + 's', baseX, baseY - 10);
    drawMemberHPBar(ctx, m, baseX, baseY - 32);
    return;
  }

  // ── 動畫 ──
  let bob, ax = 0, sx = 1, sy = 1, tilt = 0, mood = 'happy';
  if (exploring) {
    const wp = m.walkPhase;
    bob = -Math.abs(Math.sin(wp)) * 5;
    sx = 1 + Math.sin(wp * 2) * 0.05;
    sy = 1 - Math.sin(wp * 2) * 0.05;
    ax = Math.sin(wp) * 2; tilt = 0.1;
  } else {
    bob = Math.sin(t * 1.5 + m.slot) * 4;
    sx = 1 + Math.sin(t * 1.5 + m.slot) * 0.03;
    sy = 1 - Math.sin(t * 1.5 + m.slot) * 0.03;
  }
  if (attacking) {
    const p = 1 - m.attackAnim / 0.32;
    let lunge;
    if (p < 0.28) lunge = -(p / 0.28) * 9;
    else if (p < 0.5) lunge = ((p - 0.28) / 0.22) * 47 - 9;
    else lunge = (1 - (p - 0.5) / 0.5) * 38;
    ax += lunge;
    if (p > 0.28 && p < 0.5) { sx *= 1.08; sy *= 0.96; }
    mood = 'attack';
  }
  let alpha = 1;
  if (hurt) {
    const hpf = m.hurtTime / 0.28;
    ax -= hpf * 11;
    alpha = 0.55 + 0.45 * Math.abs(Math.sin(m.hurtTime * 45));
    sx *= 1 - hpf * 0.08; sy *= 1 + hpf * 0.08;
    mood = 'hurt';
  }

  const cx = baseX + ax * scale;
  const cy = baseY + bob * scale;

  // 護盾
  if (shielded) {
    const sg = ctx.createRadialGradient(cx, cy, 18, cx, cy, 48 * scale);
    sg.addColorStop(0, 'rgba(154,106,247,0)');
    sg.addColorStop(0.7, 'rgba(154,106,247,0.45)');
    sg.addColorStop(1, 'rgba(154,106,247,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(cx - 50, cy - 50, 100, 100);
    ctx.strokeStyle = `rgba(190,150,255,${0.7 + gi * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 36 * scale + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // 靈光（選中時更亮 + 腳下圈）
  const glowC = hexToRgb(cls.glow);
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46 * scale);
  g.addColorStop(0, `rgba(${glowC.r},${glowC.g},${glowC.b},${(selected ? 0.4 : 0.24) + gi * 0.1})`);
  g.addColorStop(1, `rgba(${glowC.r},${glowC.g},${glowC.b},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(cx - 48, cy - 48, 96, 96);
  if (selected) {
    ctx.strokeStyle = `rgba(255,224,138,${0.5 + gi * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(baseX, baseY + 28 * scale, 18 * scale, 4, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // 影子
  const shScale = (1 - (-bob) * 0.02) * scale;
  ctx.fillStyle = `rgba(0,0,0,${0.3 * shScale})`;
  ctx.beginPath();
  ctx.ellipse(baseX + ax * 0.5 * scale, baseY + 28 * scale, 15 * shScale, 3.2 * shScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // 本體
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.scale(sx * scale, sy * scale);
  ctx.globalAlpha = alpha;
  drawGhostBody(ctx, 0, -5, 42, 36, cls.body, cls.shadow);
  if (hurt) {
    ctx.save();
    ctx.globalAlpha = (m.hurtTime / 0.28) * 0.5;
    drawGhostBody(ctx, 0, -5, 42, 36, '#ffffff', null);
    ctx.restore();
  }
  ctx.fillStyle = cls.body;
  const handF = attacking ? 4 : 0;
  ctx.beginPath(); ctx.ellipse(-18, 7, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(18 + handF, 7 - handF * 0.5, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  const hatType = m.id === 'paladin' ? 'halo' : 'wizard';
  drawHat(ctx, 0, -22, hatType, cls.hat, cls.hatDark, cls.star, t);
  drawCuteFace(ctx, 0, -4, cls.eye, true, mood);
  ctx.restore();

  // 攻擊弧光
  if (attacking) {
    const p = 1 - m.attackAnim / 0.32;
    if (p > 0.25 && p < 0.7) drawWeaponSlash(ctx, cx + 6, cy, (p - 0.25) / 0.45, m.id, cls);
  }

  // 血條
  drawMemberHPBar(ctx, m, baseX, baseY - 30 * scale);
}

function drawMemberHPBar(ctx, m, x, y) {
  const w = 34, h = 4;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#1a0c0c';
  ctx.fillRect(x - w / 2, y, w, h);
  const pct = Math.max(0, m.hp / m.maxHP);
  const col = pct > 0.5 ? '#4aff8a' : (pct > 0.25 ? '#ffd24a' : '#ff5050');
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y, w * pct, h);
}

// p: 0→1 弧光進度
function drawWeaponSlash(ctx, x, y, p, classId, cls) {
  const fade = Math.sin(p * Math.PI);  // 中段最亮
  if (classId === 'mage') {
    // 法師：飛行火球 + 拖尾
    const dist = p * 64;
    const fx = x + 18 + dist;
    for (let i = 0; i < 4; i++) {
      const tx = fx - i * 7;
      const r = (10 - i * 2) * fade;
      const fr = ctx.createRadialGradient(tx, y, 1, tx, y, r);
      fr.addColorStop(0, `rgba(255,230,160,${fade * (1 - i * 0.2)})`);
      fr.addColorStop(0.5, `rgba(255,110,90,${fade * 0.6 * (1 - i * 0.2)})`);
      fr.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.fillStyle = fr;
      ctx.beginPath(); ctx.arc(tx, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (classId === 'assassin') {
    // 刺客：交叉雙斬
    ctx.save();
    ctx.strokeStyle = `rgba(180,130,255,${fade})`;
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.shadowColor = '#a060ff'; ctx.shadowBlur = 14;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(x + 16, y - i * 16);
      ctx.quadraticCurveTo(x + 44, y, x + 30, y + i * 18);
      ctx.stroke();
    }
    ctx.restore();
  } else if (classId === 'paladin') {
    // 牧師：聖光大弧
    ctx.save();
    ctx.strokeStyle = `rgba(255,240,150,${fade})`;
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.shadowColor = '#fff0a0'; ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x + 18, y, 30, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.restore();
  } else {
    // 騎士：新月斬（漸層填充弧）
    ctx.save();
    ctx.translate(x + 20, y);
    ctx.rotate((p - 0.5) * 1.4);
    const grad = ctx.createLinearGradient(-30, -30, 30, 30);
    grad.addColorStop(0, `rgba(220,210,255,0)`);
    grad.addColorStop(0.5, `rgba(190,180,255,${fade})`);
    grad.addColorStop(1, `rgba(150,130,255,0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.shadowColor = cls.flame || '#7a6aff'; ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 28, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, x, y, t, enemy) {
  if (!enemy) return;
  const type = enemy.type || ENEMY_TYPES.warrior;
  const isBoss = enemy.isBoss;
  const scale = (isBoss ? 1.7 : 1) * type.size;
  const bob = Math.sin(enemy.bobPhase) * 4;
  const hurt = enemy.hurtTime > 0;
  const baseX = x;

  // ── 動畫位移 ──
  let alpha = 1, sqx = 1, sqy = 1;
  const approach = enemy.approachT == null ? 1 : enemy.approachT;
  if (approach < 1) {
    // 從右側滑入 + 淡入
    x += (1 - approach) * 90;
    alpha = approach;
    sqy = 1 + Math.sin(approach * Math.PI) * 0.06;
  }
  // 攻擊突進（朝左）
  if (enemy.attackAnim > 0) {
    const p = 1 - enemy.attackAnim / 0.34;
    let lunge;
    if (p < 0.3) lunge = (p / 0.3) * 7;            // 前搖後拉（右）
    else if (p < 0.5) lunge = -((p - 0.3) / 0.2) * 38 + 7; // 撲擊（左）
    else lunge = -(1 - (p - 0.5) / 0.5) * 30;       // 回收
    x += lunge;
    if (p > 0.3 && p < 0.5) { sqx *= 1.08; sqy *= 0.94; }
  }
  // 受傷擊退（朝右）
  if (hurt) {
    const hpf = enemy.hurtTime / 0.18;
    x += hpf * 12;
    alpha = 0.6 + 0.4 * Math.abs(Math.sin(enemy.hurtTime * 50));
    sqx *= 1 - hpf * 0.08; sqy *= 1 + hpf * 0.08;
  }
  y += bob;

  // BOSS 紅色光環
  if (isBoss) {
    const ag = ctx.createRadialGradient(x, y, 15, x, y, 95);
    ag.addColorStop(0, 'rgba(255,40,40,0.32)');
    ag.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = ag;
    ctx.fillRect(x - 95, y - 95, 190, 190);
  }

  // 類型靈光
  const glowC = hexToRgb(type.glow);
  const eg = ctx.createRadialGradient(x, y, 4, x, y, 55 * scale);
  eg.addColorStop(0, `rgba(${glowC.r},${glowC.g},${glowC.b},${0.32 * alpha})`);
  eg.addColorStop(1, `rgba(${glowC.r},${glowC.g},${glowC.b},0)`);
  ctx.fillStyle = eg;
  ctx.fillRect(x - 60 * scale, y - 60 * scale, 120 * scale, 120 * scale);

  // 邪靈漂浮粒子
  if (approach >= 1 && Math.random() < 0.06) {
    RT.particles.push({
      kind: 'wisp', x: x + (Math.random() - 0.5) * 40 * scale,
      y: y + (Math.random() - 0.5) * 25,
      vx: (Math.random() - 0.5) * 0.4, vy: -0.5,
      life: 1.2, color: type.glow, size: 1.5,
    });
  }

  // 影子（world 座標）
  ctx.fillStyle = `rgba(0,0,0,${0.4 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(baseX, y + 30 * scale - bob, 18 * scale, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 本體（擠壓拉伸 + 淡入）──
  ctx.save();
  ctx.globalAlpha = alpha;
  if (sqx !== 1 || sqy !== 1) {
    ctx.translate(x, y);
    ctx.scale(sqx, sqy);
    ctx.translate(-x, -y);
  }

  // chibi 邪惡幽靈身體
  drawGhostBody(ctx, x, y - 5 * scale, 42 * scale, 36 * scale, type.body, type.shadow);

  // 小手（爪子感）
  ctx.fillStyle = type.body;
  ctx.beginPath();
  ctx.ellipse(x - 18 * scale, y + 7 * scale, 4 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 18 * scale, y + 7 * scale, 4 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // 爪子小尖
  ctx.fillStyle = type.shadow;
  for (let s = -1; s <= 1; s += 2) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + s * 18 * scale + i * 1.2, y + 10 * scale);
      ctx.lineTo(x + s * 18 * scale + i * 1.2, y + 12 * scale);
      ctx.lineTo(x + s * 18 * scale + i * 1.2 + 0.8, y + 12 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 帽子/頭飾 (依類型)
  ctx.save();
  if (scale !== 1) {
    ctx.translate(x, y - 22 * scale);
    ctx.scale(scale, scale);
    drawHat(ctx, 0, 0, type.hat, type.hatColor, type.hatDark, type.accent, t);
  } else {
    drawHat(ctx, x, y - 22, type.hat, type.hatColor, type.hatDark, type.accent, t);
  }
  ctx.restore();

  // BOSS 王冠 + 雙角
  if (isBoss) {
    // 角
    ctx.fillStyle = '#2a1818';
    ctx.beginPath();
    ctx.moveTo(x - 14 * scale, y - 30 * scale);
    ctx.lineTo(x - 22 * scale, y - 48 * scale);
    ctx.lineTo(x - 10 * scale, y - 34 * scale);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 14 * scale, y - 30 * scale);
    ctx.lineTo(x + 22 * scale, y - 48 * scale);
    ctx.lineTo(x + 10 * scale, y - 34 * scale);
    ctx.closePath(); ctx.fill();
    // 王冠
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x - 12 * scale, y - 30 * scale);
    ctx.lineTo(x - 12 * scale, y - 38 * scale);
    ctx.lineTo(x - 6 * scale, y - 33 * scale);
    ctx.lineTo(x, y - 42 * scale);
    ctx.lineTo(x + 6 * scale, y - 33 * scale);
    ctx.lineTo(x + 12 * scale, y - 38 * scale);
    ctx.lineTo(x + 12 * scale, y - 30 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // 王冠寶石
    ctx.fillStyle = '#ff2020';
    ctx.beginPath();
    ctx.arc(x, y - 36 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // 邪惡臉 (BOSS 用紅眼)
  const eyeC = isBoss ? '#ff2020' : type.eye;
  ctx.save();
  if (scale !== 1) {
    ctx.translate(x, y - 4 * scale);
    ctx.scale(scale, scale);
    drawEvilFace(ctx, 0, 0, eyeC, type.eyeStyle, type.mouth, t);
  } else {
    drawEvilFace(ctx, x, y - 4, eyeC, type.eyeStyle, type.mouth, t);
  }
  ctx.restore();

  ctx.restore();
}

function drawSkillFx(ctx, fx, dt) {
  fx.t -= dt;
  if (fx.kind === 'slash') {
    const p = 1 - fx.t / 0.4;
    ctx.save();
    ctx.translate(fx.x, fx.y);
    ctx.rotate(p * Math.PI);
    ctx.strokeStyle = `rgba(255,180,80,${Math.max(0, fx.t / 0.4)})`;
    ctx.lineWidth = 6;
    ctx.shadowColor = '#ff8a30';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 30, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  } else if (fx.kind === 'wind') {
    const p = 1 - fx.t / 0.3;
    ctx.save();
    ctx.translate(fx.x, fx.y);
    ctx.rotate(p * Math.PI * 2);
    ctx.strokeStyle = `rgba(180,255,200,${Math.max(0, fx.t / 0.3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  } else if (fx.kind === 'drain') {
    const p = 1 - fx.t / 0.6;
    ctx.strokeStyle = `rgba(80,255,140,${Math.max(0, fx.t / 0.6)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#3aff8a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    const mx = fx.x1 + (fx.x2 - fx.x1) * p;
    const my = fx.y1 + (fx.y2 - fx.y1) * p - 20;
    ctx.moveTo(fx.x1, fx.y1);
    ctx.quadraticCurveTo(mx, my, fx.x2, fx.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (fx.kind === 'shield') {
    const p = 1 - fx.t / 0.5;
    ctx.strokeStyle = `rgba(180,140,255,${Math.max(0, fx.t / 0.5)})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#9a6af7';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 20 + p * 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (fx.kind === 'ring') {
    // 命中衝擊環
    const p = 1 - fx.t / fx.max;
    const r = fx.r0 + (fx.r1 - fx.r0) * p;
    const a = (1 - p) * 0.9;
    const c = hexToRgb(fx.color);
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
    ctx.lineWidth = 3 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // 內層白閃
    if (p < 0.4) {
      ctx.fillStyle = `rgba(255,255,255,${(0.4 - p) * 1.2})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r0 * (1 - p * 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return fx.t > 0;
}

// 地城主題裝飾配色
const DUNGEON_THEME = [
  { far: '#16302a', mid: '#1d3d32', deco: 'tree',  fog: 'rgba(120,200,160,0.05)', ground: '#0d1a16', fire: '#ff9030' },
  { far: '#2e2a18', mid: '#3a3420', deco: 'grave', fog: 'rgba(200,190,140,0.05)', ground: '#1a160d', fire: '#ffb040' },
  { far: '#2a1830', mid: '#3a2042', deco: 'pillar',fog: 'rgba(200,120,200,0.05)', ground: '#170d1a', fire: '#ff5080' },
  { far: '#16243a', mid: '#1d2f4a', deco: 'crystal',fog: 'rgba(120,180,240,0.05)', ground: '#0d141f', fire: '#40a0ff' },
  { far: '#1a1a3a', mid: '#22224a', deco: 'snow',  fog: 'rgba(200,200,255,0.06)', ground: '#10101f', fire: '#80c0ff' },
];

function drawSceneDeco(ctx, kind, x, baseY, h, sway, col) {
  ctx.fillStyle = col;
  if (kind === 'tree') {
    ctx.fillRect(x - 1.5, baseY - h, 3, h);
    ctx.beginPath();
    ctx.moveTo(x - 9, baseY - h + 6);
    ctx.lineTo(x + sway, baseY - h - 10);
    ctx.lineTo(x + 9, baseY - h + 6);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 7, baseY - h - 2);
    ctx.lineTo(x + sway * 0.7, baseY - h - 16);
    ctx.lineTo(x + 7, baseY - h - 2);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'grave') {
    ctx.fillRect(x - 5, baseY - h, 10, h);
    ctx.beginPath(); ctx.arc(x, baseY - h, 5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 1, baseY - h * 0.7, 2, h * 0.5);
    ctx.fillRect(x - 4, baseY - h * 0.5, 8, 2);
  } else if (kind === 'pillar') {
    ctx.fillRect(x - 4, baseY - h, 8, h);
    ctx.fillRect(x - 6, baseY - h, 12, 4);
    ctx.fillRect(x - 6, baseY - 3, 12, 3);
  } else if (kind === 'crystal') {
    ctx.beginPath();
    ctx.moveTo(x, baseY - h);
    ctx.lineTo(x + 6, baseY - h * 0.5);
    ctx.lineTo(x + 3, baseY);
    ctx.lineTo(x - 3, baseY);
    ctx.lineTo(x - 6, baseY - h * 0.5);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'snow') {
    ctx.fillRect(x - 2, baseY - h, 4, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(x, baseY - h, 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBattleScene(t, dt) {
  const ctx = RT.battleCtx;
  if (!ctx) return;
  const sz = RT.battleCanvasSize;
  if (!sz) return;
  const W = sz.w, H = sz.h;
  const dg = DUNGEONS[S.dungeon - 1];
  const th = DUNGEON_THEME[(S.dungeon - 1) % DUNGEON_THEME.length];

  ctx.save();
  // 螢幕震動
  if (RT.shake > 0) {
    const s = RT.shake * 14;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  // 天空漸層
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#05060e');
  bg.addColorStop(0.55, th.far);
  bg.addColorStop(1, th.mid);
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  // 月亮光暈
  const mg = ctx.createRadialGradient(W * 0.82, H * 0.22, 4, W * 0.82, H * 0.22, 50);
  mg.addColorStop(0, 'rgba(200,210,255,0.35)');
  mg.addColorStop(1, 'rgba(200,210,255,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(W * 0.82 - 50, H * 0.22 - 50, 100, 100);
  ctx.fillStyle = 'rgba(230,235,255,0.85)';
  ctx.beginPath(); ctx.arc(W * 0.82, H * 0.22, 13, 0, Math.PI * 2); ctx.fill();

  // 遠景剪影（深）
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 7; i++) {
    const sx = (i * W / 6.5) - 10 + Math.sin(t * 0.15 + i) * 2;
    drawSceneDeco(ctx, th.deco, sx, H - 26, 26 + (i % 3) * 8, Math.sin(t * 0.3 + i) * 2, 'rgba(0,0,0,0.4)');
  }
  // 中景剪影（較亮）
  for (let i = 0; i < 5; i++) {
    const sx = (i * W / 4.5) + 20 + Math.sin(t * 0.25 + i) * 3;
    drawSceneDeco(ctx, th.deco, sx, H - 24, 40 + (i % 2) * 14, Math.sin(t * 0.4 + i) * 3, 'rgba(0,0,0,0.55)');
  }

  // 地板（透視）
  const gg = ctx.createLinearGradient(0, H - 30, 0, H);
  gg.addColorStop(0, th.ground);
  gg.addColorStop(1, '#05080e');
  ctx.fillStyle = gg;
  ctx.fillRect(0, H - 30, W, 30);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = -H; x < W; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, H - 30);
    ctx.lineTo(x + 30, H);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath(); ctx.moveTo(0, H - 20); ctx.lineTo(W, H - 20); ctx.stroke();

  // 火炬
  [22, W - 22].forEach(tx => {
    const fl = 0.6 + Math.sin(t * 7 + tx) * 0.25;
    const fc = hexToRgb(th.fire);
    const fg = ctx.createRadialGradient(tx, H - 60, 2, tx, H - 60, 26);
    fg.addColorStop(0, `rgba(${fc.r},${fc.g},${fc.b},${fl})`);
    fg.addColorStop(0.5, `rgba(${fc.r},${fc.g},${fc.b},${fl * 0.4})`);
    fg.addColorStop(1, `rgba(${fc.r},${fc.g},${fc.b},0)`);
    ctx.fillStyle = fg;
    ctx.fillRect(tx - 26, H - 86, 52, 52);
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(tx - 2, H - 54, 4, 18);
    // 火苗
    ctx.fillStyle = th.fire;
    ctx.beginPath();
    ctx.moveTo(tx, H - 68 - Math.sin(t * 8) * 3);
    ctx.quadraticCurveTo(tx - 4, H - 58, tx, H - 54);
    ctx.quadraticCurveTo(tx + 4, H - 58, tx, H - 68 - Math.sin(t * 8) * 3);
    ctx.fill();
  });

  // 飄霧（兩層）
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = th.fog;
    const off = (t * (8 + layer * 6)) % (W + 80);
    for (let i = -1; i < W / 70 + 1; i++) {
      const fx = i * 70 - off + layer * 35;
      ctx.beginPath();
      ctx.ellipse(fx, H - 18 - layer * 8, 40, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 螢火蟲
  if (!RT.fireflies) {
    RT.fireflies = Array.from({ length: 9 }, () => ({
      x: Math.random(), y: Math.random() * 0.7 + 0.1,
      ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.4,
    }));
  }
  RT.fireflies.forEach(f => {
    const fx = (f.x * W + Math.sin(t * f.sp + f.ph) * 20);
    const fy = f.y * H + Math.cos(t * f.sp * 0.8 + f.ph) * 12;
    const a = 0.4 + Math.sin(t * 3 + f.ph) * 0.35;
    ctx.fillStyle = `rgba(180,255,180,${Math.max(0, a)})`;
    ctx.shadowColor = '#a0ffa0'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI * 2); ctx.fill();
  });
  ctx.shadowBlur = 0;

  // 隊伍（3 隻站位：前排 1 + 後排 2，後排先畫）
  if (!RT.members || RT.members.length !== S.party.length) syncMembers();
  const POS = [
    { x: 0.28, y: 0.60, s: 0.95 },   // 前
    { x: 0.13, y: 0.50, s: 0.82 },   // 後上
    { x: 0.14, y: 0.72, s: 0.82 },   // 後下
  ];
  // 後排先畫（z 序）
  const order = RT.members.map((m, i) => i).sort((a, b) => (POS[b]?.y || 0.6) - (POS[a]?.y || 0.6));
  // 先畫 y 較小（後方）→ 這裡用 slot 對應 POS；簡單依 index 畫，前排 index0 最後畫
  for (let i = RT.members.length - 1; i >= 0; i--) {
    const m = RT.members[i];
    const pos = POS[i] || POS[0];
    drawMember(ctx, m, W * pos.x, H * pos.y, t, pos.s);
  }
  if (RT.enemy) drawEnemy(ctx, W * 0.78, H * 0.5, t, RT.enemy);

  // 技能特效
  for (let i = RT.skillFx.length - 1; i >= 0; i--) {
    if (!drawSkillFx(ctx, RT.skillFx[i], dt || 0.016)) RT.skillFx.splice(i, 1);
  }

  // 粒子
  for (let i = RT.particles.length - 1; i >= 0; i--) {
    const p = RT.particles[i];
    if (p.kind === 'dmg') {
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) { RT.particles.splice(i, 1); continue; }
      ctx.font = `bold ${p.size}px Courier New`;
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    } else if (p.kind === 'soul') {
      p.x += p.vx + Math.sin(p.y * 0.2) * 0.3; p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) { RT.particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life) * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y - p.size, p.size, Math.PI, 0);
      ctx.lineTo(p.x + p.size, p.y + p.size);
      ctx.lineTo(p.x - p.size, p.y + p.size);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.04;
      if (p.life <= 0) { RT.particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  // 浮動獎勵
  for (let i = RT.rewards.length - 1; i >= 0; i--) {
    const r = RT.rewards[i];
    r.y += r.vy; r.life -= 0.02;
    if (r.life <= 0) { RT.rewards.splice(i, 1); continue; }
    ctx.font = 'bold 11px Courier New';
    ctx.globalAlpha = Math.min(1, r.life);
    ctx.textAlign = 'left';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(r.text, r.x, r.y);
    ctx.fillStyle = r.color;
    ctx.fillText(r.text, r.x, r.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // BOSS 擊殺白閃
  if (RT.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${RT.flash * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ─────────────────────────────────────────────────────────────
// 背景星空
// ─────────────────────────────────────────────────────────────
function setupBgCanvas() {
  const c = document.getElementById('bgCanvas');
  function resize() { c.width = innerWidth; c.height = innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  RT.bgCtx = c.getContext('2d');
  RT.stars = Array.from({ length: 180 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.3 + 0.2,
    a: Math.random(),
    da: (Math.random() - 0.5) * 0.012,
  }));
}

function drawBg() {
  const ctx = RT.bgCtx;
  if (!ctx) return;
  const c = ctx.canvas;
  ctx.clearRect(0, 0, c.width, c.height);
  RT.stars.forEach(s => {
    s.a = Math.max(0.05, Math.min(1, s.a + s.da));
    if (s.a <= 0.05 || s.a >= 1) s.da *= -1;
    ctx.beginPath();
    ctx.arc(s.x * c.width, s.y * c.height, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,210,255,${s.a})`;
    ctx.fill();
  });
}

// ─────────────────────────────────────────────────────────────
// 互動 (拖曳合成、雙擊穿戴、點裝備卸下)
// ─────────────────────────────────────────────────────────────
function setupInventoryInput() {
  const grid = document.getElementById('inventoryGrid');
  const ghost = document.getElementById('dragGhost');
  let touchStartIdx = -1;
  let touchStartXY = null;
  let dragging = false;
  let lastTap = 0, lastTapIdx = -1;
  let longPressTimer = null;
  let longPressTriggered = false;

  function evtXY(e) {
    return {
      x: e.touches ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : e.clientX),
      y: e.touches ? e.touches[0].clientY : (e.changedTouches ? e.changedTouches[0].clientY : e.clientY),
    };
  }
  function getIdxFromEvent(e) {
    const { x, y } = evtXY(e);
    const el = document.elementFromPoint(x, y);
    if (!el) return -1;
    const slot = el.closest('.slot');
    if (!slot) return -1;
    return parseInt(slot.dataset.idx);
  }
  function isOverTrash(e) {
    const { x, y } = evtXY(e);
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest('#btnTrash'));
  }

  function clearHighlight() {
    document.querySelectorAll('.slot.dragover, .slot.merge-target').forEach(s => {
      s.classList.remove('dragover', 'merge-target');
    });
  }

  function highlight(idx) {
    clearHighlight();
    if (idx < 0 || touchStartIdx < 0) return;
    if (idx === touchStartIdx) return;
    const src = S.inventory[touchStartIdx];
    const dst = S.inventory[idx];
    const target = grid.children[idx];
    if (!target) return;
    if (src && dst && src.type === dst.type && src.tier === dst.tier && src.tier < CFG.TIER_MAX) {
      target.classList.add('merge-target');
    } else {
      target.classList.add('dragover');
    }
  }

  function startDrag(e) {
    const idx = getIdxFromEvent(e);
    if (idx < 0) return;
    if (!S.inventory[idx]) return;
    touchStartIdx = idx;
    touchStartXY = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    dragging = false;
    longPressTriggered = false;
    grid.children[idx].classList.add('dragging');
  }

  function moveDrag(e) {
    if (touchStartIdx < 0) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    if (!dragging) {
      const dx = x - touchStartXY.x;
      const dy = y - touchStartXY.y;
      if (Math.hypot(dx, dy) > 10) {
        dragging = true;
        const item = S.inventory[touchStartIdx];
        ghost.classList.remove('hidden');
        ghost.textContent = itemIcon(item);
        const rar = tierToRarity(item.tier);
        ghost.style.borderColor = RARITY[rar].color;
        ghost.style.boxShadow = `0 0 12px ${RARITY[rar].color}`;
      }
    }
    if (dragging) {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      ghost.style.left = x + 'px';
      ghost.style.top = y + 'px';
      const overIdx = getIdxFromEvent(e);
      highlight(overIdx);
      const trashEl = document.getElementById('btnTrash');
      if (trashEl) trashEl.classList.toggle('trash-hover', isOverTrash(e));
    }
    if (e.cancelable) e.preventDefault();
  }

  function endDrag(e) {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (touchStartIdx < 0) return;
    if (longPressTriggered) {
      // 長按已處理
      Array.from(grid.children).forEach(c => c.classList.remove('dragging'));
      ghost.classList.add('hidden');
      clearHighlight();
      touchStartIdx = -1;
      dragging = false;
      longPressTriggered = false;
      return;
    }
    if (dragging) {
      // 拖到垃圾桶 → 立即賣出
      if (isOverTrash(e)) {
        const item = S.inventory[touchStartIdx];
        if (item) {
          const price = itemSellPrice(item);
          sellAt(touchStartIdx);
          showToast(`🗑 賣出 +${formatNum(price)} 靈幣`, 'success');
          refreshAllUI();
        }
        document.getElementById('btnTrash')?.classList.remove('trash-hover');
        ghost.classList.add('hidden');
        clearHighlight();
        Array.from(grid.children).forEach(c => c.classList.remove('dragging'));
        touchStartIdx = -1; dragging = false;
        return;
      }
      const dstIdx = getIdxFromEvent(e);
      if (dstIdx >= 0 && dstIdx !== touchStartIdx) {
        const src = S.inventory[touchStartIdx];
        const dst = S.inventory[dstIdx];
        if (src && dst && src.type === dst.type && src.tier === dst.tier && src.tier < CFG.TIER_MAX) {
          mergeAt(touchStartIdx, dstIdx);
          grid.children[dstIdx].classList.add('merge-anim');
          setTimeout(() => grid.children[dstIdx]?.classList.remove('merge-anim'), 500);
          showToast('✨ 合成 ' + ITEM_TYPES[src.type].name + ' T' + (src.tier + 1), 'success');
        } else {
          swapSlots(touchStartIdx, dstIdx);
        }
        refreshInventory();
        refreshStats();
      }
    } else {
      // 點擊 → 開道具動作卡片（穿戴/合成/賣出）
      openItemCard(touchStartIdx);
    }
    ghost.classList.add('hidden');
    clearHighlight();
    Array.from(grid.children).forEach(c => c.classList.remove('dragging'));
    touchStartIdx = -1;
    dragging = false;
  }

  grid.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);
  grid.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('touchmove', moveDrag, { passive: false });
  window.addEventListener('touchend', endDrag);
  window.addEventListener('touchcancel', endDrag);

  // 裝備欄點擊 = 卸下
  document.getElementById('equipmentRow').addEventListener('click', e => {
    const sl = e.target.closest('.eq-slot');
    if (!sl) return;
    if (unequip(sl.dataset.slot)) {
      showToast('已卸下', 'success');
      refreshAllUI();
    }
  });

  // 點補血藥 = 手動使用
  document.getElementById('potionRow').addEventListener('click', e => {
    const sl = e.target.closest('.potion-slot');
    if (!sl) return;
    if (usePotion(sl.dataset.kind)) {
      refreshPotions();
      refreshHeroInfo();
    } else {
      showToast('HP 已滿或藥水不足', 'warn');
    }
  });

  // 點技能 = 顯示資訊
  document.getElementById('skillRow').addEventListener('click', e => {
    const sl = e.target.closest('.skill-slot');
    if (!sl) return;
    const id = sl.dataset.id;
    const lv = S.skillLevels[id];
    if (!lv) {
      showToast('需先解鎖 ' + CLASSES[SKILLS[id].cls].name + ' 鬼魂', 'warn');
      return;
    }
    if (lv >= 10) {
      showToast(SKILLS[id].name + ' 已滿級', 'warn');
      return;
    }
    const cost = SKILLS[id].upgradeCost(lv);
    if (confirm(`升級 ${SKILLS[id].name} 至 Lv.${lv + 1}？\n花費 ${cost} 靈晶`)) {
      upgradeSkill(id);
      refreshSkills();
      refreshHUD();
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 召喚動畫
// ─────────────────────────────────────────────────────────────
function showSummonAnimation(items) {
  const overlay = document.getElementById('summonOverlay');
  const stage = overlay.querySelector('.summon-stage');
  stage.innerHTML = '';

  const orb = document.createElement('div');
  orb.className = 'summon-orb';
  stage.appendChild(orb);

  overlay.classList.remove('hidden');

  setTimeout(() => {
    stage.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'summon-results';
    items.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'summon-card r-' + tierToRarity(item.tier);
      card.style.animationDelay = (i * 0.08) + 's';
      card.textContent = itemIcon(item);
      const t = document.createElement('div');
      t.className = 't';
      t.textContent = 'T' + item.tier;
      card.appendChild(t);
      grid.appendChild(card);
    });
    stage.appendChild(grid);
    const tap = document.createElement('div');
    tap.className = 'summon-tap';
    tap.textContent = '點擊任意處關閉';
    stage.appendChild(tap);
  }, 900);

  overlay.onclick = () => {
    overlay.classList.add('hidden');
    overlay.onclick = null;
    refreshAllUI();
  };
}

function doSummon(times) {
  const cost = times === 1 ? CFG.SUMMON_COST : CFG.SUMMON10_COST;
  if (S.gold < cost) { showToast('靈幣不足', 'warn'); if (typeof SOUND !== 'undefined') SOUND.error(); return; }
  if (findEmptySlot() === -1) { showToast('背包已滿，請先合成', 'warn'); if (typeof SOUND !== 'undefined') SOUND.error(); return; }
  S.gold -= cost;
  const items = [];
  let bestRarity = 'common';
  const rarOrder = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  for (let i = 0; i < times; i++) {
    if (findEmptySlot() === -1) break;
    const item = rollSummon(times === 10 ? 1 : 0);
    addItem(item);
    items.push(item);
    S.totalSummons++;
    const r = tierToRarity(item.tier);
    if (rarOrder.indexOf(r) > rarOrder.indexOf(bestRarity)) bestRarity = r;
  }
  if (typeof SOUND !== 'undefined') {
    SOUND.summon();
    if (bestRarity === 'mythic' || bestRarity === 'legendary') {
      setTimeout(() => SOUND.legendaryDrop(), 900);
    } else if (bestRarity === 'epic' || bestRarity === 'rare') {
      setTimeout(() => SOUND.rareDrop(), 900);
    }
  }
  showSummonAnimation(items);
}

// ─────────────────────────────────────────────────────────────
// 地城選單
// ─────────────────────────────────────────────────────────────
function openDungeonModal() {
  const list = document.getElementById('dungeonList');
  list.innerHTML = '';
  DUNGEONS.forEach((d, i) => {
    const idx = i + 1;
    const unlocked = idx <= S.maxDungeon;
    const current = idx === S.dungeon;
    const item = document.createElement('div');
    item.className = 'dungeon-item' + (current ? ' current' : '') + (unlocked ? '' : ' locked');
    item.innerHTML = `
      <div>
        <div class="d-name">${unlocked ? '' : '🔒 '}${d.name}</div>
        <div class="d-meta">${d.desc}</div>
      </div>
      <div class="d-badge">${current ? '當前' : (idx < S.maxDungeon ? '已通關' : (unlocked ? '可挑戰' : '未解鎖'))}</div>
    `;
    if (unlocked && !current) {
      item.onclick = () => {
        S.dungeon = idx;
        S.stage = idx < S.maxDungeon ? 10 : S.maxStage;
        S.stageKills = 0;
        RT.enemy = null;
        RT.enemySpawnDelay = 0.4;
        refreshHUD();
        refreshEnemyInfo();
        document.getElementById('dungeonModal').classList.add('hidden');
        showToast('進入：' + d.name, 'success');
      };
    }
    list.appendChild(item);
  });
  document.getElementById('dungeonModal').classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
// 商店
// ─────────────────────────────────────────────────────────────
function openShop() {
  const modal = document.getElementById('shopModal');
  const body = document.getElementById('shopBody');
  body.innerHTML = '';

  // 補血藥
  const potionSection = document.createElement('div');
  potionSection.className = 'shop-section';
  potionSection.innerHTML = '<div class="shop-title">🧪 補血藥水</div>';
  for (const [kind, p] of Object.entries(POTIONS)) {
    const row = document.createElement('div');
    row.className = 'shop-row';
    row.innerHTML = `
      <div class="shop-info">
        <span class="shop-icon">${p.icon}</span>
        <div>
          <div class="shop-name">${p.name}</div>
          <div class="shop-desc">回復 ${p.heal * 100}% HP · 持有 ${S.potions[kind]}</div>
        </div>
      </div>
      <button class="shop-btn" ${S.gold < p.cost ? 'disabled' : ''}>${p.cost} 💰</button>
    `;
    row.querySelector('.shop-btn').onclick = () => {
      if (S.gold < p.cost) return;
      S.gold -= p.cost;
      S.potions[kind]++;
      refreshHUD();
      refreshPotions();
      openShop(); // 重新渲染
    };
    potionSection.appendChild(row);
  }
  body.appendChild(potionSection);

  // 技能升級
  const skillSection = document.createElement('div');
  skillSection.className = 'shop-section';
  skillSection.innerHTML = '<div class="shop-title">⚡ 技能升級（消耗 💎 靈晶）</div>';
  for (const id of SKILL_IDS) {
    const lv = S.skillLevels[id];
    const sk = SKILLS[id];
    const row = document.createElement('div');
    row.className = 'shop-row';
    if (!lv) {
      row.innerHTML = `
        <div class="shop-info">
          <span class="shop-icon">${sk.icon}</span>
          <div>
            <div class="shop-name">${sk.name}</div>
            <div class="shop-desc">🔒 解鎖 ${CLASSES[sk.cls].name} 鬼魂後可用</div>
          </div>
        </div>
        <button class="shop-btn" disabled>未解鎖</button>
      `;
    } else if (lv >= 10) {
      row.innerHTML = `
        <div class="shop-info">
          <span class="shop-icon">${sk.icon}</span>
          <div>
            <div class="shop-name">${sk.name} Lv.${lv}</div>
            <div class="shop-desc">${sk.desc(lv)}</div>
          </div>
        </div>
        <button class="shop-btn" disabled>已滿級</button>
      `;
    } else {
      const cost = sk.upgradeCost(lv);
      row.innerHTML = `
        <div class="shop-info">
          <span class="shop-icon">${sk.icon}</span>
          <div>
            <div class="shop-name">${sk.name} Lv.${lv}</div>
            <div class="shop-desc">${sk.desc(lv)}</div>
          </div>
        </div>
        <button class="shop-btn" ${S.crystal < cost ? 'disabled' : ''}>${cost} 💎</button>
      `;
      row.querySelector('.shop-btn').onclick = () => {
        if (upgradeSkill(id)) {
          refreshHUD();
          refreshSkills();
          openShop();
        }
      };
    }
    skillSection.appendChild(row);
  }
  body.appendChild(skillSection);

  modal.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
// 離線獎勵彈窗
// ─────────────────────────────────────────────────────────────
function showOfflineModal(rw) {
  const modal = document.getElementById('offlineModal');
  document.getElementById('offlineTime').textContent = '離線 ' + formatTime(rw.seconds);
  document.getElementById('offlineGold').textContent = '+' + formatNum(rw.gold);
  document.getElementById('offlineKills').textContent = '+' + formatNum(rw.kills);
  document.getElementById('offlineExp').textContent = '+' + formatNum(rw.exp || 0);
  const dropsRow = document.getElementById('offlineDropsRow');
  const dropsText = document.getElementById('offlineDrops');
  if (rw.drops.length || rw.potions) {
    const parts = rw.drops.map(d => itemIcon(d) + 'T' + d.tier);
    if (rw.potions) parts.push('🧪×' + rw.potions);
    dropsText.innerHTML = parts.join(' ');
    dropsRow.style.display = '';
  } else {
    dropsRow.style.display = 'none';
  }
  modal.classList.remove('hidden');
  document.getElementById('btnClaimOffline').onclick = () => {
    applyOfflineRewards(rw);
    modal.classList.add('hidden');
    refreshAllUI();
  };
}

// ─────────────────────────────────────────────────────────────
// 事件綁定
// ─────────────────────────────────────────────────────────────
function bindUI() {
  const sfx = () => { if (typeof SOUND !== 'undefined') SOUND.button(); };
  document.getElementById('btnSummon').onclick = () => { sfx(); doSummon(1); };
  document.getElementById('btnSummon10').onclick = () => { sfx(); doSummon(10); };
  document.getElementById('btnDungeon').onclick = () => { sfx(); openDungeonModal(); };
  document.getElementById('btnShop').onclick = () => { sfx(); openShop(); };
  document.getElementById('btnTeam').onclick = () => { sfx(); openClassModal(); };
  // 隊伍列點選 → 設為選中成員
  document.getElementById('partyBar').addEventListener('click', e => {
    const chip = e.target.closest('.party-chip');
    if (!chip) return;
    sfx();
    S.selected = chip.dataset.id;
    refreshAllUI();
  });
  document.getElementById('btnMenu').onclick = () => {
    sfx();
    document.getElementById('menuModal').classList.remove('hidden');
    refreshSoundUI();
  };
  document.getElementById('btnSave').onclick = () => {
    save();
    showToast('已存檔', 'success');
    document.getElementById('menuModal').classList.add('hidden');
  };
  document.getElementById('btnReset').onclick = () => {
    if (confirm('確定要重置遊戲嗎？所有進度將消失。')) {
      resetGame();
      document.getElementById('menuModal').classList.add('hidden');
      showToast('遊戲已重置', 'warn');
    }
  };
  document.getElementById('btnAutoMerge').onclick = () => {
    sfx();
    const n = autoMerge();
    if (n > 0) { refreshAllUI(); showToast(`✨ 合成 ${n} 次`, 'success'); }
    else showToast('沒有可合成的裝備', 'warn');
  };
  document.getElementById('btnAutoEquip').onclick = () => {
    sfx();
    const n = autoEquipBest();
    if (n > 0) { refreshAllUI(); showToast(`⚔ 已穿戴 ${n} 件最佳裝備`, 'success'); }
    else showToast('沒有更好的裝備可穿戴', 'warn');
  };
  document.getElementById('btnSort').onclick = () => {
    sfx();
    sortInventory();
    refreshInventory();
    showToast('🗂 已整理背包', 'success');
  };
  document.getElementById('btnTrash').onclick = () => {
    sfx();
    const r = sellLowTier();
    if (r.count > 0) {
      refreshAllUI();
      showToast(`🗑 賣出 ${r.count} 件 +${formatNum(r.gold)} 靈幣`, 'success');
      if (typeof SOUND !== 'undefined') SOUND.coin();
    } else showToast('沒有 T1-T3 可賣（可拖裝備到垃圾桶單賣）', 'warn');
  };
  // 音量控制
  document.getElementById('btnToggleSfx').onclick = () => {
    SOUND.toggleSfx();
    refreshSoundUI();
  };
  document.getElementById('btnToggleBgm').onclick = () => {
    SOUND.toggleBgm();
    refreshSoundUI();
  };
  document.getElementById('sfxVolume').oninput = e => {
    SOUND.setSfxVolume(parseFloat(e.target.value));
  };
  document.getElementById('bgmVolume').oninput = e => {
    SOUND.setBgmVolume(parseFloat(e.target.value));
  };
  // HUD 快速靜音
  document.getElementById('btnMute').onclick = () => {
    const newState = !SOUND.sfxEnabled || !SOUND.bgmEnabled;
    // 同時切換 BGM 和 SFX
    if (newState) {
      // 開啟（兩個都打開）
      if (!SOUND.sfxEnabled) SOUND.toggleSfx();
      if (!SOUND.bgmEnabled) SOUND.toggleBgm();
    } else {
      if (SOUND.sfxEnabled) SOUND.toggleSfx();
      if (SOUND.bgmEnabled) SOUND.toggleBgm();
    }
    refreshSoundUI();
  };
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.onclick = () => {
      document.getElementById(btn.dataset.close).classList.add('hidden');
    };
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.add('hidden');
    });
  });

  // 道具卡片點背景關閉
  const icm = document.getElementById('itemCardModal');
  if (icm) icm.addEventListener('click', e => { if (e.target === icm) icm.classList.add('hidden'); });
}

// ─────────────────────────────────────────────────────────────
// 主迴圈
// ─────────────────────────────────────────────────────────────
let _uiTickAccum = 0;
let _loopErrCount = 0;
function loop(ts) {
  // 一律先排下一幀，確保任何單幀錯誤都不會讓遊戲「突然停下來」
  requestAnimationFrame(loop);

  if (!RT.lastTime) RT.lastTime = ts;
  let dt = (ts - RT.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0.016;
  if (dt > 0.2) dt = 0.2;        // 切回分頁/卡頓時鉗制
  RT.lastTime = ts;

  try {
    updateBattle(dt);
    drawBg();
    drawBattleScene(ts / 1000, dt);

    _uiTickAccum += dt;
    if (_uiTickAccum > 0.1) {
      _uiTickAccum = 0;
      refreshHUD();
      refreshStats();
      refreshLevel();
      refreshEnemyInfo();
      refreshHeroInfo();
      refreshActions();
      refreshSkills();
      refreshPotions();
    }
  } catch (err) {
    _loopErrCount++;
    if (_loopErrCount <= 5) console.error('[loop error]', err);
    // 嘗試自我修復：清除可能損壞的暫態
    RT.particles = RT.particles || [];
    RT.skillFx = RT.skillFx || [];
    RT.rewards = RT.rewards || [];
  }
}

// ─────────────────────────────────────────────────────────────
// 初始化
// ─────────────────────────────────────────────────────────────
function init() {
  const loaded = load();

  setupBgCanvas();
  setupBattleCanvas();
  bindUI();
  setupInventoryInput();

  syncMembers();  // 建立上陣成員（滿血）

  refreshAllUI();
  refreshSoundUI();

  if (loaded && S.lastSave) {
    const offlineSec = Math.min((Date.now() - S.lastSave) / 1000, CFG.MAX_OFFLINE_HOURS * 3600);
    if (offlineSec > 30) {
      const rw = calculateOfflineRewards(offlineSec);
      if (rw) setTimeout(() => showOfflineModal(rw), 400);
    }
  }

  setInterval(save, CFG.AUTO_SAVE_INTERVAL);
  window.addEventListener('beforeunload', save);
  window.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  RT.enemySpawnDelay = 0.4;
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', init);
