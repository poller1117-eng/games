/* ============ 幽靈漂流記 - 主邏輯 ============ */
const SAVE_KEY = 'ghost_drift_save_v01';

// ============ 遊戲狀態 ============
let state = null;

function defaultState() {
  return {
    activeGhostId: null,
    coins: 0,
    ghosts: {}, // { id: { level, exp, equipped: {head, body, weapon, accessory} } }
    inventory: {}, // { itemId: { count, rarity } } // 裝備存個別實例
    equipment: [], // 個別裝備實例 [{uid, itemId, rarity, stats}]
    drift: null,   // { ghostId, zoneId, startTime, duration, done }
    unlockedZones: ['old_house'],
  };
}

// ============ 存取 ============
function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}
function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function reset() {
  localStorage.removeItem(SAVE_KEY);
  state = defaultState();
  showScreen('title-screen');
}

// ============ 工具 ============
function uid() { return Math.random().toString(36).slice(2,10); }
function randInt(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }
function pickWeighted(list, weightFn) {
  const total = list.reduce((s,x)=>s+weightFn(x),0);
  let r = Math.random()*total;
  for (const x of list) { r -= weightFn(x); if (r<=0) return x; }
  return list[list.length-1];
}
function clamp(n, mi, ma) { return Math.max(mi, Math.min(ma, n)); }

function getGhost(id) { return GHOSTS.find(g=>g.id===id); }
function getZone(id) { return ZONES.find(z=>z.id===id); }
function getItem(id) { return ITEMS[id]; }

function activeGhost() {
  if (!state.activeGhostId) return null;
  return state.ghosts[state.activeGhostId];
}
function activeGhostDef() { return getGhost(state.activeGhostId); }

// 取得鬼魂目前實際屬性（基礎 + 等級 + 裝備）
function ghostTotalStats(ghostId) {
  const gDef = getGhost(ghostId);
  const g = state.ghosts[ghostId];
  if (!gDef || !g) return { luck:0, speed:0, courage:0, sense:0 };
  const stats = { ...gDef.baseStats };
  // 升級加成：每級各屬性+1
  for (const k of Object.keys(stats)) stats[k] += (g.level - 1);
  // 裝備加成
  for (const slot of Object.keys(g.equipped)) {
    const eqUid = g.equipped[slot];
    if (!eqUid) continue;
    const eq = state.equipment.find(e=>e.uid===eqUid);
    if (eq && eq.stats) {
      for (const k of Object.keys(eq.stats)) stats[k] = (stats[k]||0) + eq.stats[k];
    }
  }
  return stats;
}

// ============ 物品系統 ============
function addItem(itemId, count = 1, forcedRarity = null) {
  const def = getItem(itemId);
  if (!def) return;

  if (def.type === 'equipment') {
    // 裝備是個別實例
    const rarity = forcedRarity || rollItemRarity(itemId);
    for (let i=0; i<count; i++) {
      const inst = {
        uid: uid(),
        itemId,
        rarity,
        stats: scaleStatsByRarity(def.stats || {}, rarity),
      };
      state.equipment.push(inst);
    }
  } else {
    if (!state.inventory[itemId]) state.inventory[itemId] = { count: 0 };
    state.inventory[itemId].count += count;
  }
}

function rollItemRarity(itemId, weights = null) {
  weights = weights || { common: 70, uncommon: 25, rare: 4, epic: 1 };
  const arr = Object.entries(weights);
  const total = arr.reduce((s,[,w])=>s+w, 0);
  let r = Math.random()*total;
  for (const [k,w] of arr) { r -= w; if (r<=0) return k; }
  return 'common';
}

function scaleStatsByRarity(stats, rarity) {
  const mul = { common:1, uncommon:1.3, rare:1.7, epic:2.5, legendary:4, mythic:7 }[rarity] || 1;
  const out = {};
  for (const k of Object.keys(stats)) out[k] = Math.max(1, Math.round(stats[k] * mul));
  return out;
}

function itemValue(itemId, rarity) {
  const def = getItem(itemId);
  if (!def) return 0;
  const rMul = RARITY[rarity]?.sellMul || 1;
  return Math.floor(def.baseValue * rMul);
}

// ============ 漂流系統 ============
function startDrift(zoneId) {
  const zone = getZone(zoneId);
  if (!zone) return;
  if (state.drift) { toast('已經有寵物在漂流了'); return; }
  const g = activeGhost();
  if (!g) { toast('沒有可用的鬼魂'); return; }
  if (g.level < zone.minGhostLevel) { toast('鬼魂等級不足'); return; }
  if (!state.unlockedZones.includes(zoneId)) { toast('地圖未解鎖'); return; }

  // 速度屬性影響漂流時間（-2% per speed point, max -40%）
  const stats = ghostTotalStats(state.activeGhostId);
  const speedMul = clamp(1 - stats.speed * 0.02, 0.6, 1);
  const duration = Math.floor(zone.duration * speedMul);

  state.drift = {
    ghostId: state.activeGhostId,
    zoneId,
    startTime: Date.now(),
    duration,
    done: false,
  };
  save();
  closeModal('map-modal');
  renderMain();
  toast(`${activeGhostDef().name} 出發前往 ${zone.name}！`);
}

function driftRemaining() {
  if (!state.drift) return 0;
  const elapsed = (Date.now() - state.drift.startTime) / 1000;
  return Math.max(0, state.drift.duration - elapsed);
}

function speedupDrift() {
  if (!state.drift) return;
  const yin = state.inventory['yin_pill'];
  if (!yin || yin.count <= 0) { toast('沒有陰氣丹'); return; }
  yin.count -= 1;
  if (yin.count <= 0) delete state.inventory['yin_pill'];
  // 縮短一半剩餘時間
  const remain = driftRemaining();
  state.drift.startTime = Date.now() - (state.drift.duration - remain/2)*1000;
  save();
  renderMain();
  toast('使用了陰氣丹！剩餘時間減半');
}

function rollDriftLoot() {
  const zone = getZone(state.drift.zoneId);
  const gDef = getGhost(state.drift.ghostId);
  const stats = ghostTotalStats(state.drift.ghostId);

  // 幸運影響高品質權重
  const rarityWeights = { ...zone.rarityWeights };
  const luckBoost = 1 + stats.luck * 0.03;
  if (rarityWeights.rare) rarityWeights.rare *= luckBoost;
  if (rarityWeights.epic) rarityWeights.epic *= luckBoost * 1.2;
  if (rarityWeights.legendary) rarityWeights.legendary *= luckBoost * 1.5;
  if (rarityWeights.mythic) rarityWeights.mythic *= luckBoost * 2;

  // 感知影響物品數量（基準 3 件 + 感知/5）
  let itemCount = 3 + Math.floor(stats.sense / 5);
  if (gDef.bonusDropChance && Math.random() < gDef.bonusDropChance) itemCount += 1;

  const loots = [];
  for (let i=0; i<itemCount; i++) {
    const drop = pickWeighted(zone.drops, d=>d.weight);
    const def = getItem(drop.id);
    let count = randInt(drop.count[0], drop.count[1]);
    if (def.type === 'material' && gDef.materialBoost) {
      count = Math.ceil(count * (1 + gDef.materialBoost));
    }
    let rarity = null;
    if (def.type === 'equipment') {
      rarity = rollItemRarity(drop.id, rarityWeights);
    }
    loots.push({ itemId: drop.id, count, rarity });
  }
  return loots;
}

function claimDrift() {
  if (!state.drift || driftRemaining() > 0) return;
  const zone = getZone(state.drift.zoneId);
  const rewards = zoneRewards(zone);
  const loots = rollDriftLoot();

  // 加入物品
  for (const loot of loots) {
    addItem(loot.itemId, loot.count, loot.rarity);
  }
  // 加經驗、靈幣
  state.coins += rewards.coins;
  addExp(state.drift.ghostId, rewards.exp);

  state.drift = null;
  save();
  showLoot(loots, rewards);
  renderMain();
}

// ============ 等級系統 ============
function addExp(ghostId, amount) {
  const g = state.ghosts[ghostId];
  if (!g) return;
  g.exp += amount;
  while (g.exp >= expForLevel(g.level)) {
    g.exp -= expForLevel(g.level);
    g.level += 1;
    toast(`${getGhost(ghostId).name} 升到 Lv.${g.level}！`);
  }
}

// ============ 解鎖鬼魂 ============
function unlockGhost(ghostId) {
  if (state.ghosts[ghostId]) return false;
  const def = getGhost(ghostId);
  if (!def) return false;
  if (state.coins < def.unlockCost) { toast(`需要 ${def.unlockCost} 靈幣`); return false; }
  state.coins -= def.unlockCost;
  state.ghosts[ghostId] = {
    level: 1,
    exp: 0,
    equipped: { head: null, body: null, weapon: null, accessory: null },
  };
  if (!state.activeGhostId) state.activeGhostId = ghostId;
  save();
  toast(`解鎖了 ${def.name}！`);
  return true;
}

function switchActive(ghostId) {
  if (!state.ghosts[ghostId]) return;
  if (state.drift && state.drift.ghostId !== ghostId) {
    toast('目前有鬼魂在漂流，無法切換');
    return;
  }
  state.activeGhostId = ghostId;
  save();
  renderMain();
  toast(`已切換到 ${getGhost(ghostId).name}`);
}

// ============ 地圖解鎖 ============
function unlockZone(zoneId) {
  const zone = getZone(zoneId);
  if (!zone) return;
  if (state.unlockedZones.includes(zoneId)) return;
  if (state.coins < zone.unlockCost) { toast(`需要 ${zone.unlockCost} 靈幣`); return; }
  state.coins -= zone.unlockCost;
  state.unlockedZones.push(zoneId);
  save();
  toast(`解鎖地圖：${zone.name}`);
  renderMapList();
  renderMain();
}

// ============ 裝備 ============
function equipItem(eqUid) {
  const eq = state.equipment.find(e=>e.uid===eqUid);
  if (!eq) return;
  const def = getItem(eq.itemId);
  const g = activeGhost();
  if (!g) return;
  // 卸下舊的
  g.equipped[def.slot] = eq.uid;
  save();
  renderMain();
  renderGhostModal();
  closeModal('item-modal');
  toast(`穿上了 ${def.name}`);
}
function unequipSlot(slot) {
  const g = activeGhost();
  if (!g) return;
  g.equipped[slot] = null;
  save();
  renderMain();
  renderGhostModal();
}

// ============ 賣出 / 分解 ============
function sellEquipment(eqUid) {
  const eq = state.equipment.find(e=>e.uid===eqUid);
  if (!eq) return;
  // 不能賣已穿戴的
  for (const gid of Object.keys(state.ghosts)) {
    const g = state.ghosts[gid];
    for (const s of Object.keys(g.equipped)) {
      if (g.equipped[s] === eqUid) { toast('正在穿戴的裝備無法賣出'); return; }
    }
  }
  const value = itemValue(eq.itemId, eq.rarity);
  state.coins += value;
  state.equipment = state.equipment.filter(e=>e.uid!==eqUid);
  save();
  closeModal('item-modal');
  renderMain();
  renderBag();
  toast(`賣出獲得 ${value} 靈幣`);
}
function dismantleEquipment(eqUid) {
  const eq = state.equipment.find(e=>e.uid===eqUid);
  if (!eq) return;
  for (const gid of Object.keys(state.ghosts)) {
    const g = state.ghosts[gid];
    for (const s of Object.keys(g.equipped)) {
      if (g.equipped[s] === eqUid) { toast('正在穿戴的裝備無法分解'); return; }
    }
  }
  // 給予素材
  const rarityIdx = RARITY_ORDER.indexOf(eq.rarity);
  const matCount = 1 + rarityIdx;
  addItem('ling_stone', matCount);
  if (rarityIdx >= 2) addItem('soul_fire', Math.floor(rarityIdx/2));
  if (rarityIdx >= 3) addItem('dark_crystal', 1);
  state.equipment = state.equipment.filter(e=>e.uid!==eqUid);
  save();
  closeModal('item-modal');
  renderBag();
  toast(`分解獲得素材`);
}
function sellMaterial(itemId, n = 1) {
  const inv = state.inventory[itemId];
  if (!inv || inv.count < n) return;
  const value = itemValue(itemId, 'common') * n;
  state.coins += value;
  inv.count -= n;
  if (inv.count <= 0) delete state.inventory[itemId];
  save();
  renderMain();
  renderBag();
  toast(`賣出獲得 ${value} 靈幣`);
}

// ============ UI 切換 ============
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active')); }

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}

// ============ 渲染 ============
function renderMain() {
  const ghost = activeGhost();
  const gDef = activeGhostDef();
  if (!ghost || !gDef) return;

  document.getElementById('coin-display').textContent = state.coins;
  document.getElementById('ghost-avatar').textContent = gDef.avatar;
  document.getElementById('ghost-name').textContent = gDef.name;
  document.getElementById('ghost-level').textContent = ghost.level;

  const need = expForLevel(ghost.level);
  document.getElementById('exp-fill').style.width = `${Math.min(100, ghost.exp/need*100)}%`;

  const stats = ghostTotalStats(state.activeGhostId);
  document.getElementById('stat-luck').textContent = stats.luck;
  document.getElementById('stat-speed').textContent = stats.speed;
  document.getElementById('stat-courage').textContent = stats.courage;
  document.getElementById('stat-sense').textContent = stats.sense;

  renderDrift();
}

function renderDrift() {
  const empty = document.getElementById('drift-empty');
  const active = document.getElementById('drift-active');
  const done = document.getElementById('drift-done');

  if (!state.drift) {
    empty.classList.remove('hidden');
    active.classList.add('hidden');
    done.classList.add('hidden');
    return;
  }
  const remain = driftRemaining();
  if (remain <= 0) {
    empty.classList.add('hidden');
    active.classList.add('hidden');
    done.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  active.classList.remove('hidden');
  done.classList.add('hidden');

  const zone = getZone(state.drift.zoneId);
  const gDef = getGhost(state.drift.ghostId);
  document.getElementById('drift-msg').textContent = `${gDef.name} 正在 ${zone.name} 漂流...`;

  const progress = 100 - (remain / state.drift.duration * 100);
  document.getElementById('drift-progress-fill').style.width = `${progress}%`;

  const mm = Math.floor(remain/60).toString().padStart(2,'0');
  const ss = Math.floor(remain%60).toString().padStart(2,'0');
  document.getElementById('drift-timer').textContent = `${mm}:${ss}`;
}

function renderGhostSelect() {
  const grid = document.getElementById('ghost-select-grid');
  grid.innerHTML = '';
  GHOSTS.forEach(g => {
    const locked = g.unlockCost > 0;
    const card = document.createElement('div');
    card.className = 'ghost-card' + (locked ? ' locked' : '');
    card.innerHTML = `
      <div class="ghost-card-avatar">${g.avatar}</div>
      <div class="ghost-card-name">${g.name}</div>
      <div class="ghost-card-desc">${g.desc}</div>
      <div class="ghost-card-skill">${g.skill}</div>
      ${locked ? `<div class="ghost-card-skill">需 ${g.unlockCost} 靈幣解鎖</div>` : ''}
    `;
    if (!locked) {
      card.onclick = () => {
        state = defaultState();
        unlockGhost(g.id);
        save();
        showScreen('main-screen');
        renderMain();
      };
    }
    grid.appendChild(card);
  });
}

function renderMapList() {
  const list = document.getElementById('map-list');
  list.innerHTML = '';
  ZONES.forEach(z => {
    const unlocked = state.unlockedZones.includes(z.id);
    const ghost = activeGhost();
    const canEnter = unlocked && ghost && ghost.level >= z.minGhostLevel;

    const rarityDots = Object.entries(z.rarityWeights)
      .map(([r])=>`<span class="rarity-dot" style="background:${RARITY[r].color}" title="${RARITY[r].label}"></span>`)
      .join('');

    const card = document.createElement('div');
    card.className = 'map-card' + (canEnter ? '' : ' locked');
    card.innerHTML = `
      <div class="map-icon">${z.icon}</div>
      <div class="map-info">
        <div class="map-name">${z.name}</div>
        <div class="map-meta">${z.desc}</div>
        <div class="map-meta">⏱ ${Math.floor(z.duration/60)>0?Math.floor(z.duration/60)+'分':''}${z.duration%60}秒 | 需 Lv.${z.minGhostLevel}</div>
        <div class="map-loot-preview">${rarityDots}</div>
        ${!unlocked ? `<div class="map-meta" style="color:var(--accent-glow);margin-top:6px">🔒 ${z.unlockCost} 靈幣解鎖</div>` : ''}
      </div>
    `;
    card.onclick = () => {
      if (!unlocked) { unlockZone(z.id); return; }
      if (!canEnter) { toast(`需要鬼魂達到 Lv.${z.minGhostLevel}`); return; }
      startDrift(z.id);
    };
    list.appendChild(card);
  });
}

let currentBagTab = 'all';
function renderBag() {
  const grid = document.getElementById('bag-grid');
  grid.innerHTML = '';

  let entries = [];
  // 裝備
  if (currentBagTab === 'all' || currentBagTab === 'equipment') {
    for (const eq of state.equipment) {
      const def = getItem(eq.itemId);
      const equipped = isEquipped(eq.uid);
      entries.push({
        kind: 'equipment',
        eqUid: eq.uid,
        itemId: eq.itemId,
        rarity: eq.rarity,
        icon: def.icon,
        equipped,
      });
    }
  }
  // 素材 + 消耗
  for (const [itemId, data] of Object.entries(state.inventory)) {
    const def = getItem(itemId);
    if (!def) continue;
    if (currentBagTab === 'material' && def.type !== 'material') continue;
    if (currentBagTab === 'consumable' && def.type !== 'consumable') continue;
    if (currentBagTab === 'equipment') continue;
    entries.push({
      kind: def.type,
      itemId,
      count: data.count,
      rarity: 'common',
      icon: def.icon,
    });
  }

  if (entries.length === 0) {
    grid.innerHTML = '<div class="empty-hint">背包空空如也...</div>';
    return;
  }

  entries.forEach(e => {
    const slot = document.createElement('div');
    slot.className = 'item-slot';
    slot.dataset.rarity = e.rarity;
    slot.innerHTML = `
      ${e.icon}
      ${e.count > 1 ? `<span class="item-count">${e.count}</span>` : ''}
      ${e.equipped ? `<span class="item-equipped">●</span>` : ''}
    `;
    slot.onclick = () => openItemDetail(e);
    grid.appendChild(slot);
  });
}

function isEquipped(eqUid) {
  for (const gid of Object.keys(state.ghosts)) {
    const g = state.ghosts[gid];
    for (const s of Object.keys(g.equipped)) {
      if (g.equipped[s] === eqUid) return true;
    }
  }
  return false;
}

function openItemDetail(entry) {
  const detail = document.getElementById('item-detail');
  const actions = document.getElementById('item-actions');
  const def = getItem(entry.itemId);

  document.getElementById('item-modal-name').textContent = def.name;

  let html = `<div class="item-detail-icon">${def.icon}</div>`;
  html += `<div class="item-detail-name">${def.name}</div>`;
  if (entry.kind === 'equipment') {
    html += `<span class="item-rarity-label item-rarity-${entry.rarity}">${RARITY[entry.rarity].label}</span>`;
  }
  html += `<div class="item-flavor">「${def.flavor}」</div>`;

  if (entry.kind === 'equipment') {
    const eq = state.equipment.find(e=>e.uid===entry.eqUid);
    const slotLabel = { head:'頭飾', body:'身袍', weapon:'法器', accessory:'護符' }[def.slot];
    html += `<div class="item-stats">`;
    html += `<div class="item-stat-line"><span>裝備位</span><span class="stat-val">${slotLabel}</span></div>`;
    for (const [k,v] of Object.entries(eq.stats || {})) {
      const label = { luck:'🍀 幸運', speed:'💨 速度', courage:'💪 膽量', sense:'👁 感知' }[k];
      html += `<div class="item-stat-line"><span>${label}</span><span class="stat-val">+${v}</span></div>`;
    }
    const value = itemValue(eq.itemId, eq.rarity);
    html += `<div class="item-stat-line"><span>賣價</span><span class="stat-val">${value} 靈幣</span></div>`;
    html += `</div>`;
  } else {
    const value = itemValue(entry.itemId, 'common');
    html += `<div class="item-stats">`;
    html += `<div class="item-stat-line"><span>類型</span><span class="stat-val">${entry.kind === 'material' ? '素材' : '消耗品'}</span></div>`;
    html += `<div class="item-stat-line"><span>數量</span><span class="stat-val">×${entry.count}</span></div>`;
    html += `<div class="item-stat-line"><span>單價</span><span class="stat-val">${value} 靈幣</span></div>`;
    html += `</div>`;
  }
  detail.innerHTML = html;

  // 動作按鈕
  actions.innerHTML = '';
  if (entry.kind === 'equipment') {
    if (entry.equipped) {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.textContent = '脫下';
      btn.onclick = () => {
        // 找到正在哪個鬼身上
        for (const gid of Object.keys(state.ghosts)) {
          const g = state.ghosts[gid];
          for (const s of Object.keys(g.equipped)) {
            if (g.equipped[s] === entry.eqUid) { g.equipped[s] = null; }
          }
        }
        save();
        closeModal('item-modal');
        renderBag();
        renderMain();
        toast('已脫下');
      };
      actions.appendChild(btn);
    } else {
      const btnEq = document.createElement('button');
      btnEq.className = 'btn-primary';
      btnEq.textContent = '穿戴';
      btnEq.onclick = () => equipItem(entry.eqUid);
      actions.appendChild(btnEq);
    }
    const btnSell = document.createElement('button');
    btnSell.className = 'btn-secondary';
    btnSell.textContent = '賣出';
    btnSell.onclick = () => sellEquipment(entry.eqUid);
    actions.appendChild(btnSell);

    const btnDis = document.createElement('button');
    btnDis.className = 'btn-secondary';
    btnDis.textContent = '分解';
    btnDis.onclick = () => dismantleEquipment(entry.eqUid);
    actions.appendChild(btnDis);
  } else if (entry.kind === 'consumable' && entry.itemId === 'yin_pill') {
    const btnUse = document.createElement('button');
    btnUse.className = 'btn-primary';
    btnUse.textContent = '使用（加速漂流）';
    btnUse.onclick = () => {
      if (!state.drift) { toast('沒有正在漂流的寵物'); return; }
      closeModal('item-modal');
      speedupDrift();
    };
    actions.appendChild(btnUse);
    const btnSell = document.createElement('button');
    btnSell.className = 'btn-secondary';
    btnSell.textContent = '賣出 1 個';
    btnSell.onclick = () => sellMaterial(entry.itemId, 1);
    actions.appendChild(btnSell);
  } else {
    const btnSell1 = document.createElement('button');
    btnSell1.className = 'btn-secondary';
    btnSell1.textContent = '賣出 1 個';
    btnSell1.onclick = () => sellMaterial(entry.itemId, 1);
    actions.appendChild(btnSell1);
    if (entry.count > 1) {
      const btnSellAll = document.createElement('button');
      btnSellAll.className = 'btn-secondary';
      btnSellAll.textContent = `全部賣出 (${entry.count})`;
      btnSellAll.onclick = () => sellMaterial(entry.itemId, entry.count);
      actions.appendChild(btnSellAll);
    }
  }

  openModal('item-modal');
}

function renderGhostModal() {
  const ghost = activeGhost();
  const gDef = activeGhostDef();
  if (!ghost || !gDef) return;

  const stats = ghostTotalStats(state.activeGhostId);
  const detail = document.getElementById('ghost-detail');
  detail.innerHTML = `
    <div class="ghost-detail-avatar">${gDef.avatar}</div>
    <div class="ghost-detail-info">
      <div class="ghost-detail-name">${gDef.name}　Lv.${ghost.level}</div>
      <div class="ghost-detail-skill">${gDef.skill}</div>
      <div class="ghost-stats">
        <div class="ghost-stat-line">🍀 幸運<span>${stats.luck}</span></div>
        <div class="ghost-stat-line">💨 速度<span>${stats.speed}</span></div>
        <div class="ghost-stat-line">💪 膽量<span>${stats.courage}</span></div>
        <div class="ghost-stat-line">👁 感知<span>${stats.sense}</span></div>
      </div>
    </div>
  `;

  // 裝備格
  const slots = [
    { key: 'head', label: '頭飾', emptyIcon: '🎩' },
    { key: 'body', label: '身袍', emptyIcon: '👘' },
    { key: 'weapon', label: '法器', emptyIcon: '🗡️' },
    { key: 'accessory', label: '護符', emptyIcon: '🪙' },
  ];
  const eqGrid = document.getElementById('equip-grid');
  eqGrid.innerHTML = '';
  slots.forEach(s => {
    const eqUid = ghost.equipped[s.key];
    const eq = eqUid ? state.equipment.find(e=>e.uid===eqUid) : null;
    const def = eq ? getItem(eq.itemId) : null;
    const slot = document.createElement('div');
    slot.className = 'equip-slot' + (eq ? ' has-item' : '');
    if (eq) slot.dataset.rarity = eq.rarity;
    slot.innerHTML = `
      ${eq ? def.icon : `<span style="opacity:0.3">${s.emptyIcon}</span>`}
      <div class="equip-slot-label">${s.label}</div>
    `;
    slot.onclick = () => {
      if (eq) {
        openItemDetail({ kind:'equipment', eqUid: eq.uid, itemId: eq.itemId, rarity: eq.rarity, icon: def.icon, equipped: true });
      } else {
        openModal('bag-modal');
        currentBagTab = 'equipment';
        document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab==='equipment'));
        renderBag();
      }
    };
    eqGrid.appendChild(slot);
  });

  // 鬼魂列表
  const collection = document.getElementById('ghost-collection');
  collection.innerHTML = '';
  GHOSTS.forEach(g => {
    const owned = !!state.ghosts[g.id];
    const isActive = state.activeGhostId === g.id;
    const mini = document.createElement('div');
    mini.className = 'ghost-mini' + (isActive ? ' active' : '') + (owned ? '' : ' locked');
    mini.innerHTML = `
      <div class="ghost-mini-avatar">${g.avatar}</div>
      <div class="ghost-mini-name">${g.name}</div>
      ${owned ? `<div class="ghost-mini-name">Lv.${state.ghosts[g.id].level}</div>` : `<div class="ghost-mini-name">${g.unlockCost}💰</div>`}
    `;
    mini.onclick = () => {
      if (owned) switchActive(g.id);
      else unlockGhost(g.id);
      renderGhostModal();
    };
    collection.appendChild(mini);
  });
}

function showLoot(loots, rewards) {
  const list = document.getElementById('loot-list');
  list.innerHTML = '';
  document.getElementById('loot-subtitle').textContent = `獲得 ${rewards.exp} 經驗、${rewards.coins} 靈幣`;
  loots.forEach(l => {
    const def = getItem(l.itemId);
    const rarity = l.rarity || 'common';
    const item = document.createElement('div');
    item.className = 'loot-item';
    item.dataset.rarity = rarity;
    item.innerHTML = `
      <div class="loot-icon">${def.icon}</div>
      <div class="loot-name">${def.name}</div>
      <div class="loot-count">${l.count > 1 ? `×${l.count}` : RARITY[rarity].label}</div>
    `;
    list.appendChild(item);
  });
  openModal('loot-modal');
}

// ============ 事件綁定 ============
function bindEvents() {
  // 標題
  document.getElementById('btn-new-game').onclick = () => {
    showScreen('select-screen');
    renderGhostSelect();
  };
  document.getElementById('btn-continue').onclick = () => {
    const saved = load();
    if (!saved || !saved.activeGhostId) { toast('沒有存檔'); return; }
    state = saved;
    showScreen('main-screen');
    renderMain();
  };

  // 主畫面按鈕
  document.getElementById('btn-open-map').onclick = () => { renderMapList(); openModal('map-modal'); };
  document.getElementById('btn-claim').onclick = claimDrift;
  document.getElementById('btn-speedup').onclick = () => speedupDrift();
  document.getElementById('btn-bag').onclick = () => { currentBagTab = 'all'; document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab==='all')); renderBag(); openModal('bag-modal'); };
  document.getElementById('btn-ghost-info').onclick = () => { renderGhostModal(); openModal('ghost-modal'); };
  document.getElementById('btn-menu').onclick = () => openModal('menu-modal');

  // 戰利品
  document.getElementById('btn-close-loot').onclick = () => closeModal('loot-modal');

  // 選單
  document.getElementById('btn-save').onclick = () => { save(); toast('已存檔'); };
  document.getElementById('btn-reset').onclick = () => {
    if (confirm('確定要重置遊戲嗎？所有進度將消失。')) reset();
  };

  // 關閉按鈕
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.onclick = () => btn.closest('.modal').classList.remove('active');
  });
  // 點 modal 背景關閉
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('active');
    });
  });

  // 背包分頁
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      currentBagTab = t.dataset.tab;
      renderBag();
    };
  });
}

// ============ 主循環 ============
function tick() {
  if (state && state.drift) {
    renderDrift();
  }
}

// ============ 啟動 ============
function init() {
  bindEvents();
  const saved = load();
  if (saved && saved.activeGhostId) {
    state = saved;
    showScreen('main-screen');
    renderMain();
  } else {
    state = defaultState();
    showScreen('title-screen');
  }
  setInterval(tick, 500);
}

init();
