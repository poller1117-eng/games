'use strict';

/* ============================================================
   幽靈勇者 · 合成放置 RPG · game.js · v2
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const CFG = {
  SAVE_KEY: 'ghostMerge_v2',
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
const SKILLS = {
  soulSlash: {
    name: '靈魂斬', icon: '🔥', unlock: 1, baseCD: 5,
    desc: lv => `造成 ${(150 + lv * 50)}% 攻擊力傷害，必定暴擊`,
    upgradeCost: lv => 5 + lv * 3,
    cast(stats, lv) {
      const dmg = Math.round(stats.ATK * (1.5 + lv * 0.5) * 1.5);
      dealEnemyDamage(dmg, true);
      const c = RT.battleCanvasSize || { w: 380, h: 170 };
      RT.skillFx.push({ kind: 'slash', x: c.w * 0.72, y: c.h * 0.5, t: 0.4 });
      for (let i = 0; i < 12; i++) spawnSlashParticle(c.w * 0.72 + (Math.random()-0.5)*30, c.h * 0.5);
      if (typeof SOUND !== 'undefined') SOUND.skillSlash();
    },
  },
  whirlwind: {
    name: '幽冥旋風', icon: '🌀', unlock: 3, baseCD: 10,
    desc: lv => `5 次連擊各 ${50 + lv * 10}% 攻擊力傷害`,
    upgradeCost: lv => 10 + lv * 5,
    cast(stats, lv) {
      let count = 0;
      if (typeof SOUND !== 'undefined') SOUND.skillWind();
      const tick = () => {
        if (!RT.enemy || count >= 5) return;
        const dmg = Math.round(stats.ATK * (0.5 + lv * 0.1));
        dealEnemyDamage(dmg, false);
        const c = RT.battleCanvasSize || { w: 380, h: 170 };
        RT.skillFx.push({ kind: 'wind', x: c.w * 0.72 + (Math.random()-0.5)*40, y: c.h * 0.5 + (Math.random()-0.5)*20, t: 0.3 });
        count++;
        if (count < 5) setTimeout(tick, 130);
      };
      tick();
    },
  },
  drainLife: {
    name: '靈魂吸取', icon: '💚', unlock: 5, baseCD: 12,
    desc: lv => `造成 ${(120 + lv * 30)}% 傷害並回復傷害量的 50%`,
    upgradeCost: lv => 15 + lv * 8,
    cast(stats, lv) {
      const dmg = Math.round(stats.ATK * (1.2 + lv * 0.3));
      dealEnemyDamage(dmg, false);
      const heal = Math.round(dmg * 0.5);
      RT.hero.hp = Math.min(RT.hero.maxHP, RT.hero.hp + heal);
      RT.particles.push({
        kind: 'dmg', x: 50 + Math.random() * 30, y: 60,
        vy: -1.5, life: 1.0, text: '+' + formatNum(heal), color: '#3aff8a', size: 14
      });
      const c = RT.battleCanvasSize || { w: 380, h: 170 };
      RT.skillFx.push({ kind: 'drain', x1: c.w * 0.72, y1: c.h * 0.5, x2: c.w * 0.2, y2: c.h * 0.55, t: 0.6 });
      if (typeof SOUND !== 'undefined') SOUND.skillDrain();
    },
  },
  ghostShield: {
    name: '幽靈護盾', icon: '🛡', unlock: 8, baseCD: 25,
    desc: lv => `${(2.5 + lv * 0.4).toFixed(1)} 秒內傷害免疫並回復 30% HP`,
    upgradeCost: lv => 20 + lv * 12,
    cast(stats, lv) {
      RT.hero.shieldTime = 2.5 + lv * 0.4;
      RT.hero.hp = Math.min(RT.hero.maxHP, RT.hero.hp + RT.hero.maxHP * 0.30);
      const c = RT.battleCanvasSize || { w: 380, h: 170 };
      RT.skillFx.push({ kind: 'shield', x: c.w * 0.2, y: c.h * 0.55, t: 0.5 });
      if (typeof SOUND !== 'undefined') SOUND.skillShield();
    },
  },
};
const SKILL_IDS = Object.keys(SKILLS);

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
function newState() {
  const inv = Array(CFG.INV_SIZE).fill(null);
  return {
    inventory: inv,
    equipped: { weapon: { id: 1, type: 'weapon', tier: 1 }, helmet: null, armor: null, boots: null, accessory: null },
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
    totalKills: 0,
    totalSummons: 0,
    lastSave: Date.now(),
    _itemIdCounter: 2,
  };
}

let S = newState();
let RT = {
  hero: { hp: 100, maxHP: 100, atkCooldown: 1, hurtTime: 0, attackAnim: 0, shieldTime: 0 },
  enemy: null,
  enemySpawnDelay: 0,
  particles: [],
  rewards: [],
  skillFx: [],
  skillCooldowns: { soulSlash: 0, whirlwind: 0, drainLife: 0, ghostShield: 0 },
  cachedStats: null,
  lastTime: 0,
  battleCtx: null,
  bgCtx: null,
};

function nextItemId() { return S._itemIdCounter++; }

// ─────────────────────────────────────────────────────────────
// 等級系統
// ─────────────────────────────────────────────────────────────
function expForLevel(lv) {
  return Math.round(50 * Math.pow(1.45, lv - 1));
}

function gainExp(amount) {
  S.exp += amount;
  let leveled = false;
  while (S.exp >= expForLevel(S.level)) {
    S.exp -= expForLevel(S.level);
    S.level++;
    leveled = true;
    // 自動解鎖技能
    for (const id of SKILL_IDS) {
      const sk = SKILLS[id];
      if (sk.unlock === S.level && !S.skillLevels[id]) {
        S.skillLevels[id] = 1;
        showToast('🎉 學會技能：' + sk.name, 'success');
      }
    }
    showToast('✨ 等級提升！Lv.' + S.level, 'success');
  }
  if (leveled && typeof SOUND !== 'undefined') SOUND.levelUp();
  invalidateStats();
}

function levelBonus() {
  // 每等級給：+5 ATK, +25 HP, +0.5 DEF
  const lv = S.level - 1;
  return { ATK: 5 * lv, HP: 25 * lv, DEF: 0.5 * lv };
}

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

function equipFromInv(invIdx) {
  const item = S.inventory[invIdx];
  if (!item) return false;
  const slot = item.type;
  const old = S.equipped[slot];
  S.equipped[slot] = item;
  S.inventory[invIdx] = old; // 舊裝備放回背包格
  invalidateStats();
  if (typeof SOUND !== 'undefined') SOUND.equip();
  return true;
}

function unequip(slot) {
  const item = S.equipped[slot];
  if (!item) return false;
  const idx = findEmptySlot();
  if (idx === -1) {
    showToast('背包已滿', 'warn');
    if (typeof SOUND !== 'undefined') SOUND.error();
    return false;
  }
  S.inventory[idx] = item;
  S.equipped[slot] = null;
  invalidateStats();
  if (typeof SOUND !== 'undefined') SOUND.unequip();
  return true;
}

function autoEquipBest() {
  let changed = 0;
  for (const slot of SLOT_ORDER) {
    const cur = S.equipped[slot];
    let bestIdx = -1, bestPow = cur ? itemPower(cur) : -1;
    for (let i = 0; i < CFG.INV_SIZE; i++) {
      const it = S.inventory[i];
      if (!it || it.type !== slot) continue;
      const p = itemPower(it);
      if (p > bestPow) { bestPow = p; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      equipFromInv(bestIdx);
      changed++;
    }
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

function sellLowTier() {
  // 賣掉所有 tier 1-3 普通裝備
  let gold = 0, count = 0;
  for (let i = 0; i < CFG.INV_SIZE; i++) {
    const it = S.inventory[i];
    if (it && it.tier <= 3) {
      gold += Math.round(20 * tierMul(it.tier));
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
function computeStats() {
  const lb = levelBonus();
  const base = { HP: 100 + lb.HP, ATK: 5 + lb.ATK, DEF: 0 + lb.DEF, SPD: 1.0, CRIT: 0.05 };
  for (const slot of SLOT_ORDER) {
    const item = S.equipped[slot];
    if (!item) continue;
    const st = itemStats(item);
    for (const k in st) base[k] = (base[k] || 0) + st[k];
  }
  if (base.SPD > 5) base.SPD = 5;
  if (base.CRIT > 1) base.CRIT = 1;
  base.DPS = base.ATK * base.SPD * (1 + base.CRIT * 0.6);
  return base;
}

function getStats() {
  if (!RT.cachedStats) {
    RT.cachedStats = computeStats();
    const oldMax = RT.hero.maxHP || 100;
    const ratio = isNaN(RT.hero.hp / oldMax) ? 1 : RT.hero.hp / oldMax;
    RT.hero.maxHP = RT.cachedStats.HP;
    RT.hero.hp = Math.min(RT.hero.maxHP, RT.hero.maxHP * ratio);
    if (RT.hero.hp <= 0) RT.hero.hp = RT.hero.maxHP;
  }
  return RT.cachedStats;
}

function invalidateStats() { RT.cachedStats = null; }

// ─────────────────────────────────────────────────────────────
// 補血藥
// ─────────────────────────────────────────────────────────────
function usePotion(kind) {
  if (!S.potions[kind] || S.potions[kind] <= 0) return false;
  if (RT.hero.hp >= RT.hero.maxHP) return false;
  S.potions[kind]--;
  const heal = Math.round(RT.hero.maxHP * POTIONS[kind].heal);
  RT.hero.hp = Math.min(RT.hero.maxHP, RT.hero.hp + heal);
  RT.particles.push({
    kind: 'dmg', x: 50 + Math.random() * 30, y: 60,
    vy: -1.5, life: 1.0, text: '+' + formatNum(heal), color: '#3aff8a', size: 14
  });
  if (typeof SOUND !== 'undefined') SOUND.potion();
  return true;
}

function autoUsePotion() {
  if (RT.hero.hp >= RT.hero.maxHP) return;
  const pct = RT.hero.hp / RT.hero.maxHP;
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
function tryAutoCast() {
  if (!RT.enemy || RT.enemy.hp <= 0) return;
  for (const id of SKILL_IDS) {
    const lv = S.skillLevels[id];
    if (!lv) continue;
    if (RT.skillCooldowns[id] > 0) continue;
    const stats = getStats();
    SKILLS[id].cast(stats, lv);
    RT.skillCooldowns[id] = SKILLS[id].baseCD;
    break; // 一次只放一個
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
function enemyHPFor(dungeon, stage, isBoss) {
  const stageMul = Math.pow(1.20, stage - 1);
  const dungMul = Math.pow(3, dungeon - 1);
  let hp = 60 * stageMul * dungMul;
  if (isBoss) hp *= 10;
  return Math.round(hp);
}

function enemyATKFor(dungeon, stage, isBoss) {
  const stageMul = Math.pow(1.18, stage - 1);
  const dungMul = Math.pow(2.6, dungeon - 1);
  let atk = 3 * stageMul * dungMul;
  if (isBoss) atk *= 1.4;
  return atk;
}

function enemyExpFor(dungeon, stage, isBoss) {
  return Math.round((isBoss ? 50 : 8) * Math.pow(1.18, stage - 1) * Math.pow(1.8, dungeon - 1));
}

function spawnEnemy() {
  const dg = DUNGEONS[S.dungeon - 1];
  const isBoss = S.stage === 10;
  const name = isBoss ? dg.boss : dg.enemies[Math.floor(Math.random() * dg.enemies.length)];
  const hp = enemyHPFor(S.dungeon, S.stage, isBoss);
  const atk = enemyATKFor(S.dungeon, S.stage, isBoss);
  RT.enemy = {
    name, isBoss,
    hp, maxHp: hp,
    atk, spd: 0.7,
    atkCooldown: 1.4,
    hurtTime: 0,
    bobPhase: Math.random() * Math.PI,
    color: dg.enemyColor,
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

function spawnDeathFx(x, y) {
  for (let i = 0; i < 14; i++) {
    RT.particles.push({
      kind: 'spark', x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 4 - 1,
      life: 0.8, color: 'rgba(255,255,200,1)', size: Math.random() * 3 + 1,
    });
  }
}

function dealEnemyDamage(dmg, crit) {
  if (!RT.enemy || RT.enemy.hp <= 0) return;
  RT.enemy.hp = Math.max(0, RT.enemy.hp - dmg);
  RT.enemy.hurtTime = 0.15;
  const c = RT.battleCanvasSize || { w: 380, h: 170 };
  spawnHitNum(c.w * 0.72 + (Math.random() - 0.5) * 30, c.h * 0.45, dmg, crit, false);
  if (typeof SOUND !== 'undefined') {
    if (crit) SOUND.crit();
    else SOUND.attack();
  }
  if (RT.enemy.hp <= 0) onEnemyKilled();
}

function dealHeroDamage(dmg) {
  if (RT.hero.shieldTime > 0) {
    // 護盾擋下
    const c = RT.battleCanvasSize || { w: 380, h: 170 };
    RT.particles.push({
      kind: 'dmg', x: c.w * 0.2, y: c.h * 0.55, vy: -1.5, life: 0.8,
      text: '無敵', color: '#9a6af7', size: 12
    });
    return;
  }
  const stats = getStats();
  const reduced = Math.max(1, Math.round(dmg * (100 / (100 + stats.DEF))));
  RT.hero.hp = Math.max(0, RT.hero.hp - reduced);
  RT.hero.hurtTime = 0.18;
  const c = RT.battleCanvasSize || { w: 380, h: 170 };
  spawnHitNum(c.w * 0.2 + (Math.random() - 0.5) * 20, c.h * 0.55, reduced, false, true);
  if (typeof SOUND !== 'undefined') SOUND.hit();
  if (RT.hero.hp <= 0) onHeroDied();
}

function onEnemyKilled() {
  const stageMul = Math.pow(1.20, S.stage - 1);
  const dungMul = Math.pow(2.4, S.dungeon - 1);
  const isBoss = RT.enemy.isBoss;

  const goldDrop = Math.round(8 * stageMul * dungMul * (isBoss ? 12 : 1));
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
    const crystalDrop = 5 + S.dungeon * 3;
    S.crystal += crystalDrop;
    spawnReward('💎 +' + crystalDrop, '#9a6af7');
    // BOSS 給 1 個中補血藥
    S.potions.hpMedium++;
    spawnReward('⚗️ +1', '#3aff8a');
    if (typeof SOUND !== 'undefined') setTimeout(() => SOUND.crystal(), 300);
  }

  const c = RT.battleCanvasSize || { w: 380, h: 170 };
  spawnDeathFx(c.w * 0.72, c.h * 0.55);

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
      showToast('👑 已通關所有地城！繼續挑戰！', 'success');
      RT.enemySpawnDelay = 0.8;
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

function onHeroDied() {
  const stats = getStats();
  RT.hero.hp = stats.HP;
  RT.hero.maxHP = stats.HP;
  S.stageKills = 0;
  RT.enemy = null;
  RT.enemySpawnDelay = 1.2;
  const penalty = Math.floor(S.gold * 0.03);
  S.gold = Math.max(0, S.gold - penalty);
  if (penalty > 0) showToast('💀 陣亡！失去 ' + formatNum(penalty) + ' 靈幣', 'error');
  else showToast('💀 陣亡！重新挑戰', 'error');
  if (typeof SOUND !== 'undefined') SOUND.heroDie();
}

function updateBattle(dt) {
  const stats = getStats();
  RT.hero.maxHP = stats.HP;

  // CD 倒數
  for (const id of SKILL_IDS) {
    if (RT.skillCooldowns[id] > 0) RT.skillCooldowns[id] -= dt;
  }
  if (RT.hero.shieldTime > 0) RT.hero.shieldTime -= dt;

  if (!RT.enemy) {
    RT.enemySpawnDelay -= dt;
    if (RT.enemySpawnDelay <= 0) spawnEnemy();
    return;
  }

  // 自動補血
  autoUsePotion();

  // 回血
  RT.hero.hp = Math.min(RT.hero.maxHP, RT.hero.hp + stats.HP * 0.005 * dt);

  // 嘗試自動釋放技能
  tryAutoCast();

  // 普攻
  RT.hero.atkCooldown -= dt;
  if (RT.hero.atkCooldown <= 0) {
    RT.hero.atkCooldown = 1 / stats.SPD;
    RT.hero.attackAnim = 0.18;
    const crit = Math.random() < stats.CRIT;
    const dmg = Math.max(1, Math.round(stats.ATK * (crit ? 1.6 : 1) * (0.9 + Math.random() * 0.2)));
    dealEnemyDamage(dmg, crit);
    const c = RT.battleCanvasSize || { w: 380, h: 170 };
    spawnSlashParticle(c.w * 0.5 + Math.random() * 60, c.h * 0.5);
  }

  if (!RT.enemy) return;

  // 敵人攻擊
  RT.enemy.atkCooldown -= dt;
  if (RT.enemy.atkCooldown <= 0) {
    RT.enemy.atkCooldown = 1 / RT.enemy.spd;
    const dmg = Math.max(1, RT.enemy.atk * (0.9 + Math.random() * 0.2));
    dealHeroDamage(dmg);
  }

  if (RT.hero.hurtTime > 0) RT.hero.hurtTime -= dt;
  if (RT.hero.attackAnim > 0) RT.hero.attackAnim -= dt;
  if (RT.enemy && RT.enemy.hurtTime > 0) RT.enemy.hurtTime -= dt;
  RT.enemy && (RT.enemy.bobPhase += dt * 2);
}

// ─────────────────────────────────────────────────────────────
// 離線收益
// ─────────────────────────────────────────────────────────────
function calculateOfflineRewards(seconds) {
  if (seconds < 30) return null;
  const stats = computeStats();
  const baseHP = enemyHPFor(S.dungeon, Math.min(S.stage, 9), false);
  const dps = stats.DPS;
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
    // 補上可能缺少的欄位
    if (!S.equipped) S.equipped = newState().equipped;
    if (!S.potions) S.potions = newState().potions;
    if (!S.skillLevels) S.skillLevels = newState().skillLevels;
    if (S.level === undefined) S.level = 1;
    if (S.exp === undefined) S.exp = 0;
    if (!Array.isArray(S.inventory) || S.inventory.length !== CFG.INV_SIZE) {
      S.inventory = Array(CFG.INV_SIZE).fill(null);
    }
    return true;
  } catch (e) { console.warn(e); return false; }
}

function resetGame() {
  localStorage.removeItem(CFG.SAVE_KEY);
  localStorage.removeItem('ghostMerge_v1');
  S = newState();
  RT.hero.hp = 100;
  RT.hero.maxHP = 100;
  RT.enemy = null;
  RT.enemySpawnDelay = 0.3;
  for (const id of SKILL_IDS) RT.skillCooldowns[id] = 0;
  invalidateStats();
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
}

function refreshStats() {
  const s = getStats();
  document.getElementById('statATK').textContent = formatNum(s.ATK);
  document.getElementById('statDEF').textContent = formatNum(s.DEF);
  document.getElementById('statHP').textContent = formatNum(s.HP);
  document.getElementById('statSPD').textContent = s.SPD.toFixed(2);
  document.getElementById('statCRIT').textContent = (s.CRIT * 100).toFixed(0) + '%';
  document.getElementById('statDPS').textContent = formatNum(s.DPS);
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

function refreshHeroInfo() {
  const pct = (RT.hero.hp / RT.hero.maxHP) * 100;
  document.getElementById('heroHPFill').style.width = pct + '%';
  document.getElementById('heroHPText').textContent = formatNum(RT.hero.hp) + ' / ' + formatNum(RT.hero.maxHP);
  const shieldEl = document.getElementById('heroShield');
  if (RT.hero.shieldTime > 0) {
    shieldEl.classList.remove('hidden');
    shieldEl.textContent = '🛡 ' + RT.hero.shieldTime.toFixed(1) + 's';
  } else {
    shieldEl.classList.add('hidden');
  }
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
    makeItemSlot(S.equipped[slot], el);
    el.classList.add('eq-slot');
    el.dataset.slot = slot;
    if (!S.equipped[slot]) {
      el.innerHTML = `<div class="eq-placeholder">${ITEM_TYPES[slot].slotName}</div>`;
      el.title = '空：' + ITEM_TYPES[slot].slotName;
    } else {
      el.title = itemDescription(S.equipped[slot]) + '\n（點擊卸下）';
    }
  });
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
      el.title = itemDescription(S.inventory[i]) + '\n（雙擊穿戴）';
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
    const lv = S.skillLevels[id];
    const unlock = SKILLS[id].unlock;
    if (!lv) {
      el.classList.add('locked');
      el.querySelector('.sk-lv').textContent = '🔒 Lv' + unlock;
      el.title = SKILLS[id].name + '（' + unlock + ' 級解鎖）';
    } else {
      el.classList.remove('locked');
      el.querySelector('.sk-lv').textContent = 'Lv.' + lv;
      const cd = RT.skillCooldowns[id];
      const total = SKILLS[id].baseCD;
      const cdEl = el.querySelector('.sk-cd-fill');
      const cdTxt = el.querySelector('.sk-cd-text');
      if (cd > 0) {
        cdEl.style.height = (cd / total * 100) + '%';
        cdTxt.textContent = cd.toFixed(1);
        el.classList.add('cooling');
      } else {
        cdEl.style.height = '0%';
        cdTxt.textContent = '';
        el.classList.remove('cooling');
      }
      el.title = SKILLS[id].name + ' Lv.' + lv + '\n' + SKILLS[id].desc(lv) + '\nCD ' + SKILLS[id].baseCD + 's';
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

function drawHero(ctx, x, y, t, stats) {
  const bob = Math.sin(t * 1.8) * 4;
  const gi = (Math.sin(t * 2.5) + 1) / 2;
  const hurt = RT.hero.hurtTime > 0;
  const attacking = RT.hero.attackAnim > 0;
  const shielded = RT.hero.shieldTime > 0;
  y += bob;

  // 護盾光環
  if (shielded) {
    const sg = ctx.createRadialGradient(x, y, 20, x, y, 50);
    sg.addColorStop(0, 'rgba(154,106,247,0)');
    sg.addColorStop(0.7, 'rgba(154,106,247,0.4)');
    sg.addColorStop(1, 'rgba(154,106,247,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x - 50, y - 50, 100, 100);
    ctx.strokeStyle = `rgba(180,140,255,${0.6 + gi * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 38 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 靈光
  const g = ctx.createRadialGradient(x, y, 4, x, y, 50);
  g.addColorStop(0, `rgba(80,150,255,${0.25 + gi * 0.05})`);
  g.addColorStop(1, 'rgba(80,150,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 50, y - 50, 100, 100);

  if (Math.random() < 0.3) {
    RT.particles.push({
      kind: 'wisp', x: x + (Math.random() - 0.5) * 30,
      y: y + 20, vx: (Math.random() - 0.5) * 0.5, vy: -0.8,
      life: 1.0, color: 'rgba(126,184,247,0.6)', size: 1.5,
    });
  }

  ctx.save();
  if (attacking) ctx.translate(8, -2);
  if (hurt) ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(165,205,255,0.72)';
  ctx.beginPath();
  ctx.ellipse(x, y, 20, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(x - 12, y - 30, 24, 9);
  ctx.fillRect(x - 5, y - 36, 10, 7);
  ctx.fillStyle = '#a07020';
  ctx.fillRect(x - 12, y - 22, 24, 2);

  ctx.fillStyle = 'rgba(130,180,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 18);
  ctx.bezierCurveTo(
    x - 8, y + 30 + Math.sin(t * 2) * 4,
    x + 8, y + 30 + Math.cos(t * 2) * 4,
    x + 14, y + 18
  );
  ctx.fill();

  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 8 + gi * 5;
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.ellipse(x - 7, y - 5, 3, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 7, y - 5, 3, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (attacking) {
    const p = RT.hero.attackAnim / 0.18;
    ctx.strokeStyle = `rgba(220,240,255,${p})`;
    ctx.lineWidth = 4;
    ctx.shadowColor = '#7eb8f7';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(x + 24, y - 14);
    ctx.lineTo(x + 24 + (1 - p) * 70, y + 14 - (1 - p) * 25);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawEnemy(ctx, x, y, t, enemy) {
  if (!enemy) return;
  const bob = Math.sin(enemy.bobPhase) * 3;
  y += bob;
  const hurt = enemy.hurtTime > 0;
  const isBoss = enemy.isBoss;
  const scale = isBoss ? 1.5 : 1;

  ctx.save();
  if (hurt) {
    ctx.globalAlpha = 0.6;
    ctx.translate((Math.random() - 0.5) * 4, 0);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 32 * scale, 16 * scale, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const c = enemy.color || '#c8b468';
  const flash = hurt ? '#ffffff' : c;

  ctx.fillStyle = flash;
  ctx.beginPath();
  ctx.ellipse(x, y - 20 * scale, 14 * scale, 15 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isBoss ? '#ff2020' : '#101020';
  ctx.beginPath();
  ctx.ellipse(x - 5 * scale, y - 22 * scale, 3 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 5 * scale, y - 22 * scale, 3 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isBoss) {
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.moveTo(x - 12 * scale, y - 30 * scale);
    ctx.lineTo(x - 18 * scale, y - 45 * scale);
    ctx.lineTo(x - 8 * scale, y - 33 * scale);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 12 * scale, y - 30 * scale);
    ctx.lineTo(x + 18 * scale, y - 45 * scale);
    ctx.lineTo(x + 8 * scale, y - 33 * scale);
    ctx.fill();
  }

  ctx.fillStyle = flash;
  ctx.fillRect(x - 10 * scale, y - 6 * scale, 20 * scale, 22 * scale);
  ctx.fillRect(x - 19 * scale, y - 6 * scale, 9 * scale, 5 * scale);
  ctx.fillRect(x + 10 * scale, y - 6 * scale, 9 * scale, 5 * scale);
  ctx.fillRect(x - 9 * scale, y + 16 * scale, 6 * scale, 15 * scale);
  ctx.fillRect(x + 3 * scale, y + 16 * scale, 6 * scale, 15 * scale);

  ctx.fillStyle = '#808090';
  ctx.fillRect(x + 18 * scale, y - 22 * scale, 3 * scale, 30 * scale);
  ctx.fillRect(x + 12 * scale, y - 24 * scale, 14 * scale, 4 * scale);

  if (isBoss) {
    const ag = ctx.createRadialGradient(x, y, 10, x, y, 60);
    ag.addColorStop(0, 'rgba(255,80,80,0.15)');
    ag.addColorStop(1, 'rgba(255,80,80,0)');
    ctx.fillStyle = ag;
    ctx.fillRect(x - 60, y - 60, 120, 120);
  }

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
  }
  return fx.t > 0;
}

function drawBattleScene(t, dt) {
  const ctx = RT.battleCtx;
  if (!ctx) return;
  const sz = RT.battleCanvasSize;
  if (!sz) return;
  const W = sz.w, H = sz.h;

  const dg = DUNGEONS[S.dungeon - 1];
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#060810');
  bg.addColorStop(1, dg.color);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < 5; i++) {
    const sx = (i * W / 5) + Math.sin(t * 0.3 + i) * 4;
    const sh = 30 + (i % 2) * 12;
    ctx.fillRect(sx, H - 50 - sh, 8, sh);
  }

  ctx.fillStyle = '#0e1424';
  ctx.fillRect(0, H - 28, W, 28);
  ctx.strokeStyle = '#1e2848';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, H - 28);
    ctx.lineTo(x + 14, H);
    ctx.stroke();
  }

  const tWalls = [30, W - 30];
  tWalls.forEach(tx => {
    const fl = 0.6 + Math.sin(t * 6 + tx) * 0.2;
    const fg = ctx.createRadialGradient(tx, H - 65, 2, tx, H - 65, 22);
    fg.addColorStop(0, `rgba(255,170,60,${fl})`);
    fg.addColorStop(0.5, `rgba(255,80,0,${fl * 0.5})`);
    fg.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(tx - 22, H - 86, 44, 44);
    ctx.fillStyle = '#503018';
    ctx.fillRect(tx - 2, H - 56, 4, 16);
  });

  const stats = getStats();
  drawHero(ctx, W * 0.2, H * 0.55, t, stats);
  if (RT.enemy) drawEnemy(ctx, W * 0.78, H * 0.5, t, RT.enemy);

  // 技能特效
  for (let i = RT.skillFx.length - 1; i >= 0; i--) {
    if (!drawSkillFx(ctx, RT.skillFx[i], dt || 0.016)) RT.skillFx.splice(i, 1);
  }

  for (let i = RT.particles.length - 1; i >= 0; i--) {
    const p = RT.particles[i];
    if (p.kind === 'dmg') {
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) { RT.particles.splice(i, 1); continue; }
      ctx.font = `bold ${p.size}px Courier New`;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    } else {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.04;
      if (p.life <= 0) { RT.particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  for (let i = RT.rewards.length - 1; i >= 0; i--) {
    const r = RT.rewards[i];
    r.y += r.vy; r.life -= 0.02;
    if (r.life <= 0) { RT.rewards.splice(i, 1); continue; }
    ctx.font = 'bold 11px Courier New';
    ctx.globalAlpha = Math.min(1, r.life);
    ctx.fillStyle = r.color;
    ctx.textAlign = 'left';
    ctx.fillText(r.text, r.x, r.y);
    ctx.globalAlpha = 1;
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

  function getIdxFromEvent(e) {
    const x = e.touches ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
    const y = e.touches ? e.touches[0].clientY : (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
    const el = document.elementFromPoint(x, y);
    if (!el) return -1;
    const slot = el.closest('.slot');
    if (!slot) return -1;
    return parseInt(slot.dataset.idx);
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
      ghost.style.left = x + 'px';
      ghost.style.top = y + 'px';
      const overIdx = getIdxFromEvent(e);
      highlight(overIdx);
    }
    if (e.cancelable) e.preventDefault();
  }

  function endDrag(e) {
    if (touchStartIdx < 0) return;
    if (dragging) {
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
      // 沒拖曳 → 視為點擊：偵測雙擊穿戴
      const now = Date.now();
      if (lastTapIdx === touchStartIdx && now - lastTap < 350) {
        // 雙擊穿戴
        if (equipFromInv(touchStartIdx)) {
          showToast('⚔ 已穿戴', 'success');
          refreshAllUI();
        }
        lastTapIdx = -1;
      } else {
        lastTap = now;
        lastTapIdx = touchStartIdx;
      }
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
      showToast(SKILLS[id].name + ' 需要 ' + SKILLS[id].unlock + ' 級解鎖', 'warn');
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
            <div class="shop-desc">🔒 ${sk.unlock} 級自動解鎖</div>
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
  document.getElementById('btnSellLow').onclick = () => {
    sfx();
    if (!confirm('賣出所有 T1-T3 裝備？')) return;
    const r = sellLowTier();
    if (r.count > 0) {
      refreshAllUI();
      showToast(`💰 賣出 ${r.count} 件 +${formatNum(r.gold)}`, 'success');
      if (typeof SOUND !== 'undefined') SOUND.coin();
    } else showToast('沒有可賣的裝備', 'warn');
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

  // 點 HP 條手動補滿（戰鬥外或用大補血藥）
  document.getElementById('heroInfo').addEventListener('click', () => {
    if (usePotion('hpLarge') || usePotion('hpMedium') || usePotion('hpSmall')) {
      refreshPotions();
      refreshHeroInfo();
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 主迴圈
// ─────────────────────────────────────────────────────────────
let _uiTickAccum = 0;
function loop(ts) {
  if (!RT.lastTime) RT.lastTime = ts;
  let dt = (ts - RT.lastTime) / 1000;
  if (dt > 0.2) dt = 0.2;
  RT.lastTime = ts;

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

  requestAnimationFrame(loop);
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

  const stats = getStats();
  RT.hero.maxHP = stats.HP;
  RT.hero.hp = stats.HP;
  RT.hero.atkCooldown = 1 / stats.SPD;

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
