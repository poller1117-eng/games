'use strict';

/* ============================================================
   音效系統 · Web Audio API 程式合成
   ============================================================ */

const SOUND = {
  ctx: null,
  master: null,
  sfxGain: null,
  bgmGain: null,
  enabled: true,
  sfxEnabled: true,
  bgmEnabled: true,
  sfxVolume: 0.5,
  bgmVolume: 0.35,
  _bgmInterval: null,
  _bgmStep: 0,
  _bgmIntense: false,
  _lastPlayTimes: {},
  _ready: false,

  // ─────────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────────
  init() {
    // 從 localStorage 讀設定
    try {
      const cfg = JSON.parse(localStorage.getItem('ghostMerge_sound') || '{}');
      if (typeof cfg.sfxEnabled === 'boolean') this.sfxEnabled = cfg.sfxEnabled;
      if (typeof cfg.bgmEnabled === 'boolean') this.bgmEnabled = cfg.bgmEnabled;
      if (typeof cfg.sfxVolume === 'number') this.sfxVolume = cfg.sfxVolume;
      if (typeof cfg.bgmVolume === 'number') this.bgmVolume = cfg.bgmVolume;
    } catch (e) {}

    // 等首次用戶互動再建立 AudioContext
    const wake = () => {
      if (this._ready) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxVolume;
        this.sfxGain.connect(this.master);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this.bgmVolume;
        this.bgmGain.connect(this.master);
        this._ready = true;
        if (this.bgmEnabled) this.startBGM();
      } catch (e) { console.warn('AudioContext failed', e); }
      ['click', 'touchstart', 'keydown'].forEach(ev =>
        window.removeEventListener(ev, wake)
      );
    };
    ['click', 'touchstart', 'keydown'].forEach(ev =>
      window.addEventListener(ev, wake, { once: false })
    );
  },

  saveSettings() {
    try {
      localStorage.setItem('ghostMerge_sound', JSON.stringify({
        sfxEnabled: this.sfxEnabled, bgmEnabled: this.bgmEnabled,
        sfxVolume: this.sfxVolume, bgmVolume: this.bgmVolume,
      }));
    } catch (e) {}
  },

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    this.saveSettings();
  },

  setBgmVolume(v) {
    this.bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgmGain) this.bgmGain.gain.value = this.bgmVolume;
    this.saveSettings();
  },

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    this.saveSettings();
    return this.sfxEnabled;
  },

  toggleBgm() {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmEnabled) this.startBGM();
    else this.stopBGM();
    this.saveSettings();
    return this.bgmEnabled;
  },

  // ─────────────────────────────────────────────
  // 音效合成 helpers
  // ─────────────────────────────────────────────
  _tone(freq, dur, type, vol, attack) {
    if (!this.sfxEnabled || !this._ready) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.sfxGain);
    const t = ctx.currentTime;
    const a = attack || 0.005;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + a);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  _sweep(f1, f2, dur, type, vol) {
    if (!this.sfxEnabled || !this._ready) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.connect(gain);
    gain.connect(this.sfxGain);
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(f1, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  _noise(dur, vol, filterFreq) {
    if (!this.sfxEnabled || !this._ready) return;
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    src.connect(gain);
    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = 2;
      gain.connect(filter);
      filter.connect(this.sfxGain);
    } else {
      gain.connect(this.sfxGain);
    }
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.start(t);
    src.stop(t + dur + 0.02);
  },

  _throttle(name, ms) {
    const now = Date.now();
    if (this._lastPlayTimes[name] && now - this._lastPlayTimes[name] < ms) return false;
    this._lastPlayTimes[name] = now;
    return true;
  },

  // ─────────────────────────────────────────────
  // 音效定義
  // ─────────────────────────────────────────────
  attack() {
    if (!this._throttle('attack', 80)) return;
    this._tone(440 + Math.random() * 60, 0.06, 'square', 0.15);
    this._noise(0.04, 0.1, 2000);
  },

  hit() {
    if (!this._throttle('hit', 100)) return;
    this._sweep(180, 60, 0.12, 'square', 0.18);
  },

  crit() {
    this._sweep(880, 1320, 0.06, 'square', 0.2);
    this._tone(1320, 0.12, 'square', 0.22);
    this._noise(0.05, 0.08, 3000);
  },

  enemyDie() {
    this._sweep(440, 60, 0.35, 'sawtooth', 0.25);
    this._noise(0.2, 0.12, 800);
  },

  bossAppear() {
    this._sweep(220, 50, 0.6, 'sawtooth', 0.35);
    this._noise(0.5, 0.18, 200);
    setTimeout(() => this._tone(82, 0.3, 'sawtooth', 0.2), 300);
  },

  bossDie() {
    this._sweep(200, 40, 0.8, 'sawtooth', 0.35);
    this._noise(0.6, 0.2, 300);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this._noise(0.1, 0.15, 800 + Math.random() * 1500), i * 80);
    }
  },

  heroDie() {
    this._sweep(440, 30, 0.9, 'sawtooth', 0.35);
    this._sweep(220, 20, 0.9, 'triangle', 0.25);
  },

  // 技能音效
  skillSlash() {
    this._sweep(220, 1200, 0.18, 'sawtooth', 0.25);
    this._noise(0.12, 0.15, 4000);
  },

  skillWind() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this._tone(440 + i * 120, 0.06, 'square', 0.18);
        this._noise(0.04, 0.06, 3000);
      }, i * 100);
    }
  },

  skillDrain() {
    this._sweep(220, 660, 0.4, 'sine', 0.25);
    setTimeout(() => this._sweep(660, 880, 0.3, 'sine', 0.2), 200);
    setTimeout(() => this._tone(880, 0.2, 'sine', 0.25), 400);
  },

  skillShield() {
    // 和諧三和弦
    this._tone(523, 0.4, 'sine', 0.15);   // C
    this._tone(659, 0.4, 'sine', 0.15);   // E
    this._tone(784, 0.4, 'sine', 0.15);   // G
    setTimeout(() => this._sweep(784, 1568, 0.3, 'sine', 0.2), 100);
  },

  // 經濟
  coin() {
    if (!this._throttle('coin', 60)) return;
    this._tone(900, 0.04, 'square', 0.12);
    setTimeout(() => this._tone(1320, 0.06, 'square', 0.12), 30);
  },

  crystal() {
    this._tone(1320, 0.08, 'sine', 0.2);
    setTimeout(() => this._tone(1760, 0.12, 'sine', 0.18), 50);
    setTimeout(() => this._tone(2093, 0.16, 'sine', 0.18), 120);
  },

  // 合成 / 升級
  merge() {
    const notes = [440, 554, 659, 880];
    notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.08, 'square', 0.2), i * 50));
  },

  levelUp() {
    const notes = [523, 659, 784, 988, 1175]; // C E G B D
    notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.12, 'square', 0.22), i * 80));
  },

  // 道具
  potion() {
    this._sweep(330, 880, 0.25, 'sine', 0.22);
    setTimeout(() => this._tone(880, 0.1, 'sine', 0.18), 200);
  },

  equip() {
    this._tone(550, 0.06, 'square', 0.18);
    setTimeout(() => this._tone(750, 0.08, 'square', 0.18), 50);
  },

  unequip() {
    this._tone(550, 0.06, 'square', 0.15);
    setTimeout(() => this._tone(330, 0.08, 'square', 0.15), 50);
  },

  // 召喚
  summon() {
    this._sweep(110, 880, 0.7, 'sawtooth', 0.2);
    setTimeout(() => this._noise(0.3, 0.15, 2000), 500);
    setTimeout(() => {
      const notes = [659, 784, 988, 1175, 1397];
      notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.1, 'square', 0.18), i * 60));
    }, 800);
  },

  rareDrop() {
    this._tone(880, 0.08, 'square', 0.2);
    setTimeout(() => this._tone(1175, 0.08, 'square', 0.2), 60);
    setTimeout(() => this._tone(1397, 0.16, 'square', 0.22), 120);
  },

  legendaryDrop() {
    this._tone(1175, 0.1, 'square', 0.22);
    setTimeout(() => this._tone(1568, 0.1, 'square', 0.22), 80);
    setTimeout(() => this._tone(1976, 0.1, 'square', 0.22), 160);
    setTimeout(() => this._tone(2349, 0.25, 'square', 0.25), 240);
  },

  // UI
  button() {
    if (!this._throttle('button', 30)) return;
    this._tone(800, 0.03, 'square', 0.12);
  },

  cancel() {
    this._tone(400, 0.08, 'square', 0.12);
  },

  error() {
    this._tone(200, 0.1, 'sawtooth', 0.18);
  },

  // ─────────────────────────────────────────────
  // BGM (chiptune 循環)
  // ─────────────────────────────────────────────
  _noteFreq(note) {
    if (!note) return null;
    const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const m = note.match(/([A-G]#?)(\d)/);
    if (!m) return null;
    const semi = (parseInt(m[2]) - 4) * 12 + (map[m[1]] - 9);
    return 440 * Math.pow(2, semi / 12);
  },

  _bgmNote(freq, dur, type, vol) {
    if (!this.bgmEnabled || !this._ready) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.bgmGain);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.005);
    gain.gain.linearRampToValueAtTime(vol * 0.6, t + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  // 普通戰鬥 BGM (A 小調 神秘風格)
  _bgmNormal: {
    bpm: 100,
    // 16 拍主旋律
    melody: [
      'A4', null, 'C5', null, 'E5', null, 'C5', null,
      'F5', null, 'E5', 'D5', 'C5', null, 'B4', null,
    ],
    // 低音線 (4 拍一根音)
    bass: [
      'A2', null, null, null, 'A2', null, null, null,
      'F2', null, null, null, 'E2', null, null, null,
    ],
  },

  // BOSS BGM (D 小調 急促)
  _bgmBoss: {
    bpm: 140,
    melody: [
      'D5', 'F5', 'D5', 'F5', 'A5', 'F5', 'D5', 'F5',
      'G5', 'F5', 'E5', 'D5', 'C#5', 'D5', 'E5', 'F5',
    ],
    bass: [
      'D2', null, 'A2', null, 'D2', null, 'A2', null,
      'G2', null, 'D2', null, 'A2', null, 'A2', null,
    ],
  },

  startBGM() {
    this.stopBGM();
    if (!this.bgmEnabled || !this._ready) return;
    const bgm = this._bgmIntense ? this._bgmBoss : this._bgmNormal;
    const beatMs = 60000 / bgm.bpm / 2;
    this._bgmStep = 0;
    const tick = () => {
      const step = this._bgmStep % 16;
      const bgmData = this._bgmIntense ? this._bgmBoss : this._bgmNormal;
      const m = this._noteFreq(bgmData.melody[step]);
      const b = this._noteFreq(bgmData.bass[step]);
      if (m) this._bgmNote(m, beatMs * 0.8 / 1000, 'square', 0.10);
      if (b) this._bgmNote(b, beatMs * 4 / 1000, 'triangle', 0.07);
      // 鼓點：每 2 拍一個 noise
      if (step % 4 === 0 && this._bgmIntense) {
        this._bgmNote(60, 0.05, 'triangle', 0.12);
      }
      this._bgmStep++;
    };
    tick();
    this._bgmInterval = setInterval(tick, beatMs);
  },

  stopBGM() {
    if (this._bgmInterval) {
      clearInterval(this._bgmInterval);
      this._bgmInterval = null;
    }
  },

  setIntense(on) {
    if (this._bgmIntense === on) return;
    this._bgmIntense = on;
    if (this.bgmEnabled && this._ready) this.startBGM();
  },
};

// 自動初始化
SOUND.init();
