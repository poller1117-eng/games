/* ============ 遊戲資料 ============ */

const RARITY = {
  common:    { label: '普通', weight: 100, sellMul: 1,   color: '#c8c8d0' },
  uncommon:  { label: '優良', weight: 50,  sellMul: 2.5, color: '#4ade80' },
  rare:      { label: '珍貴', weight: 18,  sellMul: 6,   color: '#60a5fa' },
  epic:      { label: '史詩', weight: 5,   sellMul: 16,  color: '#c084fc' },
  legendary: { label: '傳說', weight: 1,   sellMul: 50,  color: '#fbbf24' },
  mythic:    { label: '神話', weight: 0.1, sellMul: 200, color: '#f87171' },
};

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic'];

/* ============ 鬼魂 ============ */
const GHOSTS = [
  {
    id: 'piaopiao',
    name: '飄飄',
    avatar: '👻',
    desc: '新手小白鬼，天真好奇',
    skill: '⭐ 偶爾帶回兩件物品 (+10% bonus drop)',
    baseStats: { luck: 5, speed: 5, courage: 5, sense: 5 },
    unlockCost: 0,
    bonusDropChance: 0.10,
  },
  {
    id: 'mingming',
    name: '冥冥',
    avatar: '🌚',
    desc: '暗影古靈，冷靜神秘',
    skill: '⭐ 黑暗地圖找稀有物機率 +25%',
    baseStats: { luck: 4, speed: 4, courage: 7, sense: 5 },
    unlockCost: 2000,
    rareBoost: 0.25,
  },
  {
    id: 'linlin',
    name: '燐燐',
    avatar: '🔥',
    desc: '磷火幽靈，暴躁熱情',
    skill: '⭐ 帶回的鍛造素材數量 +50%',
    baseStats: { luck: 5, speed: 7, courage: 5, sense: 3 },
    unlockCost: 5000,
    materialBoost: 0.5,
  },
];

/* ============ 物品 ============ */
const ITEMS = {
  // ---- 素材 ----
  ling_stone:    { name: '靈石',   icon: '💎', type: 'material', baseValue: 10, flavor: '凝聚陰氣的結晶。' },
  ghost_bone:    { name: '幽骨',   icon: '🦴', type: 'material', baseValue: 15, flavor: '不知是誰的骨頭。' },
  soul_fire:     { name: '魂火',   icon: '🕯️', type: 'material', baseValue: 25, flavor: '永不熄滅的鬼火。' },
  dark_crystal:  { name: '冥晶',   icon: '🔮', type: 'material', baseValue: 60, flavor: '映照彼岸的水晶。' },
  spider_silk:   { name: '蛛絲',   icon: '🕸️', type: 'material', baseValue: 8,  flavor: '黏黏的，有種感覺。' },
  moon_dust:     { name: '月光塵', icon: '✨', type: 'material', baseValue: 40, flavor: '月光的殘渣。' },

  // ---- 消耗品 ----
  yin_pill:      { name: '陰氣丹', icon: '💊', type: 'consumable', baseValue: 30, flavor: '吃了精神百倍（如果你還有命的話）。', effect: 'speedup' },
  ghost_talisman:{ name: '鬼符',   icon: '📜', type: 'consumable', baseValue: 50, flavor: '據說能招來好運。', effect: 'luck' },
  memory_shard:  { name: '記憶碎片', icon: '🌀', type: 'consumable', baseValue: 120, flavor: '前世的零碎片段。' },

  // ---- 裝備：頭飾 ----
  paper_hat:     { name: '紙糊帽',     icon: '🎩', type: 'equipment', slot: 'head',      baseValue: 20,  stats: { sense: 2 },  flavor: '便宜，但會破。' },
  bone_crown:    { name: '骸骨王冠',   icon: '👑', type: 'equipment', slot: 'head',      baseValue: 80,  stats: { sense: 5, courage: 2 }, flavor: '某位過氣冥王的遺物。' },
  // ---- 裝備：身袍 ----
  shroud:        { name: '破舊壽衣',   icon: '👘', type: 'equipment', slot: 'body',      baseValue: 25,  stats: { courage: 2 }, flavor: '上面還有摺痕。' },
  spirit_robe:   { name: '青魂袍',     icon: '🥋', type: 'equipment', slot: 'body',      baseValue: 100, stats: { courage: 4, luck: 3 }, flavor: '飄逸到不行。' },
  // ---- 裝備：法器 ----
  bone_fan:      { name: '骨扇',       icon: '🪭', type: 'equipment', slot: 'weapon',    baseValue: 30,  stats: { luck: 2 }, flavor: '搧出陰風一陣。' },
  yama_blade:    { name: '冥羅刀',     icon: '🗡️', type: 'equipment', slot: 'weapon',    baseValue: 120, stats: { luck: 4, speed: 3 }, flavor: '殺氣有點重。' },
  // ---- 裝備：護符 ----
  copper_coin:   { name: '銅錢符',     icon: '🪙', type: 'equipment', slot: 'accessory', baseValue: 15,  stats: { luck: 1 }, flavor: '冥府通用貨幣。' },
  jade_pendant:  { name: '玉墜',       icon: '💚', type: 'equipment', slot: 'accessory', baseValue: 90,  stats: { luck: 3, sense: 2 }, flavor: '溫潤如人界記憶。' },

  // ---- 傳說/神話 ----
  yama_seal:     { name: '閻王印',     icon: '🟥', type: 'equipment', slot: 'accessory', baseValue: 800, stats: { luck: 8, courage: 6, sense: 4 }, flavor: '蓋下去什麼都做數。' },
  hibana_lantern:{ name: '彼岸燈籠',   icon: '🏮', type: 'equipment', slot: 'weapon',    baseValue: 1200,stats: { luck: 10, speed: 6, sense: 5 }, flavor: '指引迷途幽魂的明燈。' },
};

/* ============ 地圖 ============ */
const ZONES = [
  {
    id: 'old_house',
    name: '廢棄古宅',
    icon: '🏚️',
    duration: 30, // 秒（demo 用）
    minGhostLevel: 1,
    unlockCost: 0,
    desc: '陰風陣陣，蛛網滿佈。',
    drops: [
      { id: 'spider_silk', weight: 100, count: [1,3] },
      { id: 'ling_stone',  weight: 80,  count: [1,2] },
      { id: 'ghost_bone',  weight: 40,  count: [1,1] },
      { id: 'copper_coin', weight: 30,  count: [1,1] },
      { id: 'paper_hat',   weight: 15,  count: [1,1] },
      { id: 'shroud',      weight: 12,  count: [1,1] },
      { id: 'bone_fan',    weight: 10,  count: [1,1] },
      { id: 'yin_pill',    weight: 8,   count: [1,1] },
    ],
    rarityWeights: { common: 70, uncommon: 25, rare: 4.5, epic: 0.5 },
  },
  {
    id: 'graveyard',
    name: '亂葬崗',
    icon: '⚰️',
    duration: 90,
    minGhostLevel: 5,
    unlockCost: 800,
    desc: '骸骨堆積，怨氣四溢。',
    drops: [
      { id: 'ghost_bone',   weight: 100, count: [2,4] },
      { id: 'ling_stone',   weight: 70,  count: [1,3] },
      { id: 'soul_fire',    weight: 50,  count: [1,2] },
      { id: 'shroud',       weight: 25,  count: [1,1] },
      { id: 'bone_crown',   weight: 15,  count: [1,1] },
      { id: 'yama_blade',   weight: 10,  count: [1,1] },
      { id: 'ghost_talisman',weight: 12, count: [1,2] },
      { id: 'spirit_robe',  weight: 8,   count: [1,1] },
    ],
    rarityWeights: { common: 50, uncommon: 32, rare: 14, epic: 3.5, legendary: 0.5 },
  },
  {
    id: 'spirit_forest',
    name: '幽冥森林',
    icon: '🌲',
    duration: 180,
    minGhostLevel: 12,
    unlockCost: 3000,
    desc: '入夜的森林，連月光都不敢進來。',
    drops: [
      { id: 'soul_fire',    weight: 100, count: [2,4] },
      { id: 'dark_crystal', weight: 60,  count: [1,2] },
      { id: 'moon_dust',    weight: 70,  count: [1,3] },
      { id: 'spirit_robe',  weight: 20,  count: [1,1] },
      { id: 'yama_blade',   weight: 18,  count: [1,1] },
      { id: 'jade_pendant', weight: 15,  count: [1,1] },
      { id: 'bone_crown',   weight: 12,  count: [1,1] },
      { id: 'memory_shard', weight: 10,  count: [1,1] },
      { id: 'yama_seal',    weight: 2,   count: [1,1] },
      { id: 'hibana_lantern',weight: 1,  count: [1,1] },
    ],
    rarityWeights: { common: 30, uncommon: 35, rare: 25, epic: 8, legendary: 1.8, mythic: 0.2 },
  },
];

/* ============ 等級曲線 ============ */
function expForLevel(lv) {
  return Math.floor(50 * Math.pow(lv, 1.6));
}

/* ============ 漂流獎勵：經驗 / 靈幣 ============ */
function zoneRewards(zone) {
  return {
    exp: Math.floor(zone.duration * 0.8 + zone.minGhostLevel * 10),
    coins: Math.floor(zone.duration * 0.5 + zone.minGhostLevel * 5),
  };
}
