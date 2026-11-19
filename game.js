// ===== PART 1 of 5 - paste parts 1 to 5 in order, one after another, into the JS tab =====
/**
 * @file THE GOLDEN UMBRELLA - Deluxe edition.
 * A cozy gratitude side-scroller in vanilla Canvas + Web Audio. No libraries, images or audio files.
 *
 * Classes: SoundEngine, LightZone, ParallaxLayer, ParticleSystem, World, Player, NPC,
 *          InteractionManager, PostcardGenerator, Game.
 */
'use strict';

/* ==========================================================================
 * CONFIG - every tunable number lives here
 * ========================================================================== */
const CONFIG = Object.freeze({
  canvas: { w: 900, h: 500 },
  world: { width: 2500, ground: 400 },
  porchX: 2380,
  camera: { follow: 5, titleDrift: 50 },
  player: { speed: 170, startX: 120, edge: 30, stepInterval: 0.32 },
  interact: { talkRadius: 80, porchRadius: 60, porchPrompt: 90, porchReset: 200 },
  zone: { radius: 450, expandSeconds: 1.2, innerRatio: 0.55, stretch: 2.4 },
  parallax: { far: 0.2, mid: 0.5, near: 1 },
  particles: { rain: 520, leaves: 80, maxFx: 500, fireflyRate: 5 },
  audio: { master: 0.6, rainGain: 0.32, rainCutoff: 1100, rainFadePerLayer: 0.18, chordSeconds: 2.4 },
  postcard: { w: 900, h: 600, stamp: 'Maple Lane \u2022 Nov 2026', seed: 7 },
});
const { w: W, h: H } = CONFIG.canvas;
const GROUND = CONFIG.world.ground, WORLD_W = CONFIG.world.width, PORCH_X = CONFIG.porchX;

/** Two palettes: chilly rainy dusk vs. golden autumn evening. */
const PALETTE = Object.freeze({
  cool: { sky: ['#26324a', '#44587a', '#8294ad'], hillFar: '#3b4b66', rooftop: '#34435b', mist: '150,170,200', cottage: ['#3b475c', '#44506a', '#38445a'],
    roof: '#222b3a', win: '#1b2433', ground: '#232a35', walk: '#323b4a', door: '#2a2f3b', awn: ['#5a3040', '#6b7385'], hedge: '#1f2c33' },
  warm: { sky: ['#ff8f3a', '#ffc266', '#ffe9a6'], hillFar: '#d98a3f', rooftop: '#c77a38', mist: '255,226,160', cottage: ['#d98e50', '#e0a15f', '#cf8346'],
    roof: '#8e4b27', win: '#ffe28a', ground: '#6a4a2c', walk: '#9b7549', door: '#6b3a1e', awn: ['#d94f3d', '#fff0d0'], hedge: '#7a6a1f' },
});

/** Story content for the four helpers. */
const STORY = Object.freeze([
  { id: 'elder', x: 400, name: 'The Elderly Neighbor',
    intro: "Oh my, you're shivering in this drizzle! Come under my yellow umbrella, dear. There's room enough for two.",
    thanks: 'Warmth is meant to be shared. Carry a little of it down the lane; others are waiting.',
    summary: "Was sheltered under a neighbor's yellow umbrella" },
  { id: 'baker', x: 950, name: 'The Overloaded Baker',
    hint: "Mmph... this tray is so heavy and I can't reach the door. Perhaps the kind neighbor at the bus stop could lend you a little warmth first?",
    intro: 'Oh, thank goodness! Could you get the door? These cinnamon rolls are heavier than they look!',
    cta: 'Hold the door open', thanks: "Bless you! Here, the first roll is yours. The bakery's never felt so warm.",
    summary: 'Held the door for a baker with a tray of cinnamon rolls' },
  { id: 'kid', x: 1500, name: 'The Chilly Kid',
    hint: "My red scarf is stuck way up there, and I'm too small to reach. Maybe someone with a little golden light could help...",
    intro: "My red scarf blew onto that branch and I can't reach it. I'm so cold!",
    cta: 'Shake the branch', thanks: 'You got it! Thank you, thank you! Look, the streetlamp is glowing. Did you do that?',
    summary: "Shook a little one's red scarf down from a tree" },
  { id: 'musician', x: 2000, name: 'The Street Musician',
    hint: "Brr... packing up in this drizzle. Don't mind me. The neighbor at the bus stop says kindness is catching.",
    intro: 'Just packing up before the rain ruins my guitar. This stray cat has kept me company all evening.',
    cta: 'Sit and share some warmth', thanks: 'Nobody stops to listen anymore. Thank you for staying. Let me play you one last song.',
    summary: 'Shared warmth with a street musician and a stray cat' },
]);

/** Chord bed (C - Am - F - G) used by the layered music. */
const CHORDS = Object.freeze([
  { root: 65.4, notes: [261.6, 329.6, 392, 523.3], melody: [[659.3, 0], [784, 0.6], [880, 1.2], [784, 1.8]] },
  { root: 110, notes: [220, 261.6, 329.6, 440], melody: [[880, 0], [784, 0.6], [659.3, 1.2], [523.3, 1.8]] },
  { root: 87.3, notes: [174.6, 220, 261.6, 349.2], melody: [[880, 0], [698.5, 0.6], [880, 1.2], [1046.5, 1.8]] },
  { root: 98, notes: [196, 246.9, 293.7, 392], melody: [[987.8, 0], [880, 0.6], [784, 1.2], [587.3, 1.8]] },
]);

/* ---------- helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const $ = (s) => document.querySelector(s);
/** Small deterministic PRNG so the postcard's paper and leaves look the same every time. */
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** Filled rounded rect with optional colour. */
function rr(c, x, y, w, h, r, col) {
  if (col) c.fillStyle = col;
  c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill();
}
function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
/** Soft radial glow. */
function glow(c, x, y, r, rgb, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
/** A scarf tail that flutters in the breeze (drawn trailing toward -x). */
function scarfTail(c, x, y, len, col, t, amp = 1) {
  const w = Math.sin(t * 4) * 4 * amp, e = Math.sin(t * 3 + 1) * 3 * amp;
  c.fillStyle = col; c.beginPath(); c.moveTo(x, y);
  c.quadraticCurveTo(x - len * 0.5 + w, y + 3, x - len + w * 1.6, y + e);
  c.lineTo(x - len + w * 1.6, y + 8 + e); c.quadraticCurveTo(x - len * 0.5 + w, y + 9, x, y + 7); c.fill();
}
const isBlinking = (t) => t % 3.8 < 0.13;
/** Shared character body at the origin facing +x: breathing torso, blinking eye. */
function body(c, coat, hair, t) {
  c.fillStyle = '#2b2320'; c.fillRect(-9, -8, 8, 8); c.fillRect(1, -8, 8, 8);
  c.save(); c.scale(1, 1 + Math.sin(t * 2.2) * 0.015);
  rr(c, -13, -50, 26, 44, 8, coat); circ(c, 0, -60, 10, '#f1c9a0');
  c.fillStyle = hair; c.beginPath(); c.arc(0, -62, 10.5, Math.PI, 0); c.fill();
  if (isBlinking(t)) { c.strokeStyle = '#2a2a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2.5, -60); c.lineTo(6, -60); c.stroke(); }
  else circ(c, 4, -60, 1.5, '#2a2a2a');
  c.restore();
}

// ===== end of PART 1 =====
// ===== PART 2 of 5 - paste parts 1 to 5 in order, one after another, into the JS tab =====
/* ==========================================================================
 * SoundEngine - rain, evolving music layers, chimes (all synthesised)
 * ========================================================================== */
/** Procedural audio. Everything starts only after a user gesture (see {@link SoundEngine#unlock}). */
class SoundEngine {
  constructor() { this.ctx = null; this.muted = false; this.timer = null; this.bar = 0; this.layers = 0; this.rain = null; }

  /** Create or resume the AudioContext. Call from a user gesture. */
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC(); this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : CONFIG.audio.master; this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  /** @returns {boolean} the new muted state */
  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : CONFIG.audio.master, this.ctx.currentTime, 0.05);
    return this.muted;
  }
  /** One enveloped oscillator note routed to `dest` (defaults to master). */
  tone(freq, dur, type = 'sine', vol = 0.1, delay = 0, dest = this.master) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  /** Warm electric-piano voice: a few sine partials through a soft low-pass. */
  epiano(f, dur, vol, delay = 0) {
    if (!this.ctx) return;
    const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1800; flt.connect(this.master);
    [[f, 1], [f * 2, 0.25], [f * 4.01, 0.06]].forEach(([fr, a]) => this.tone(fr, dur, 'sine', vol * a, delay, flt));
  }
  /** Pause/resume all audio (called when the tab is hidden or shown). */
  suspend(hidden) { if (this.ctx) (hidden ? this.ctx.suspend() : this.ctx.resume()); }
  pop() { this.tone(440, 0.12, 'triangle', 0.07); this.tone(660, 0.1, 'triangle', 0.05, 0.05); }
  step() { this.tone(80 + Math.random() * 30, 0.07, 'triangle', 0.05); }
  /** Rising pentatonic music-box phrase; climbs higher with each kindness (n = 1..4). */
  kindness(n) {
    const sc = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
    for (let i = 0; i < 6; i++) {
      const k = (n - 1) * 2 + i, f = 523.25 * sc[k % 5] * 2 ** Math.floor(k / 5);
      this.tone(f, 1.4, 'sine', 0.07, i * 0.11); this.tone(f * 4, 0.25, 'sine', 0.02, i * 0.11);
    }
  }

  /** Soft looping pink-noise rain through a low-pass filter. */
  startRain() {
    if (!this.ctx || this.rain) return;
    const ctx = this.ctx, len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; src.loop = true; f.type = 'lowpass'; f.frequency.value = CONFIG.audio.rainCutoff; g.gain.value = CONFIG.audio.rainGain;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); this.rain = g;
  }
  /** Set how many music layers play (0-4). Each lit zone adds one; the rain softens. */
  setLayers(n) {
    this.layers = n;
    if (this.rain) this.rain.gain.setTargetAtTime(CONFIG.audio.rainGain * (1 - CONFIG.audio.rainFadePerLayer * n), this.ctx.currentTime, 0.6);
    if (n > 0 && !this.timer && this.ctx) { this.tick(); this.timer = setInterval(() => this.tick(), CONFIG.audio.chordSeconds * 1000); }
    if (n === 0) { clearInterval(this.timer); this.timer = null; this.bar = 0; }
  }
  /** One chord. L1 e-piano chord, L2 bass, L3 shimmer arpeggio, L4 melody. */
  tick() {
    const c = CHORDS[this.bar++ % CHORDS.length], L = this.layers;
    if (L >= 1) c.notes.forEach((f, i) => this.epiano(f, 2.2, 0.045, i * 0.025));
    if (L >= 2) { this.tone(c.root, 1.2, 'sine', 0.08); this.tone(c.root, 1.0, 'sine', 0.06, 1.2); }
    if (L >= 3) [1, 2, 3, 2].forEach((n, i) => this.epiano(c.notes[n] * 2, 0.9, 0.022, 0.6 + i * 0.45));
    if (L >= 4) c.melody.forEach(([f, d]) => this.tone(f, 0.8, 'triangle', 0.05, d));
  }
}
/* ==========================================================================
 * LightZone - a warm region that expands outward like a shockwave
 * ========================================================================== */
/** A permanently warm patch of street centred on world-x `x`. */
class LightZone {
  constructor(x) { this.x = x; this.age = 0; }
  update(dt) { this.age += dt; }
  /** 0..1 expansion progress. */
  get progress() { return clamp(this.age / CONFIG.zone.expandSeconds, 0, 1); }
  /** Current radius in px (eased). */
  get radius() { return CONFIG.zone.radius * easeOutCubic(this.progress); }
  /** Paint this zone's soft radial alpha mask. */
  paintMask(m, cam) {
    const r = this.radius, cx = this.x - cam;
    if (r < 1 || cx < -r || cx > W + r) return;
    m.save(); m.translate(cx, GROUND); m.scale(1, CONFIG.zone.stretch);
    const g = m.createRadialGradient(0, 0, r * CONFIG.zone.innerRatio, 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = g; m.fillRect(-r, -r, r * 2, r * 2); m.restore();
  }
  /** Glowing golden ring riding the expanding edge. */
  paintRing(c, cam) {
    if (this.progress >= 1) return;
    const r = this.radius, cx = this.x - cam;
    if (r < 1 || cx < -r - 40 || cx > W + r + 40) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.translate(cx, GROUND); c.scale(1, CONFIG.zone.stretch);
    const g = c.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.06);
    g.addColorStop(0, 'rgba(255,190,80,0)'); g.addColorStop(0.7, `rgba(255,205,110,${0.55 * (1 - this.progress)})`); g.addColorStop(1, 'rgba(255,190,80,0)');
    c.fillStyle = g; c.fillRect(-r * 1.1, -r * 1.1, r * 2.2, r * 2.2); c.restore();
  }
}

/* ==========================================================================
 * ParallaxLayer
 * ========================================================================== */
/** One depth layer: scrolls at `speed` x the camera and paints itself via a callback. */
class ParallaxLayer {
  /** @param {number} speed camera multiplier  @param {(c:CanvasRenderingContext2D, off:number, P:object, warm:boolean)=>void} paint */
  constructor(speed, paint) { this.speed = speed; this.paint = paint; }
  render(c, cam, P, warm) { const off = cam * this.speed; c.save(); c.translate(-off, 0); this.paint(c, off, P, warm); c.restore(); }
}

/* ==========================================================================
 * ParticleSystem
 * ========================================================================== */
/** Rain, drifting leaves, swirling shockwave leaves, fireflies and floating hearts/notes. */
class ParticleSystem {
  constructor() {
    const n = CONFIG.particles;
    this.rain = Array.from({ length: n.rain }, () => ({ x: rnd(0, WORLD_W), y: rnd(-100, GROUND), v: rnd(500, 700) }));
    this.leaves = Array.from({ length: n.leaves }, (_, i) => ({ x: rnd(0, WORLD_W), y: rnd(0, GROUND + 40), ph: rnd(0, 6.3), s: rnd(18, 36), c: i % 3, sz: rnd(3, 5.5) }));
    this.fx = [];
  }
  /** Add a one-off effect particle (kind: 'spark' | 'swirl' | 'icon'). */
  push(p) { if (this.fx.length < CONFIG.particles.maxFx) this.fx.push({ age: 0, ph: rnd(0, 6.3), vx: 0, vy: 0, ...p }); }
  update(dt) {
    for (const r of this.rain) { r.y += r.v * dt; r.x -= 50 * dt; if (r.y > GROUND + rnd(0, 80) || r.x < 0) { r.y = -rnd(0, 40); r.x = rnd(0, WORLD_W); } }
    for (const l of this.leaves) {
      l.ph += dt * 2; l.x += (l.s + Math.sin(l.ph) * 25) * dt; l.y += (22 + Math.cos(l.ph) * 8) * dt;
      if (l.y > GROUND + 70) { l.y = -10; l.x = rnd(0, WORLD_W); } if (l.x > WORLD_W) l.x = 0;
    }
    for (const f of this.fx) {
      f.age += dt;
      if (f.kind === 'swirl') { f.a += f.va * dt; f.r += f.vr * dt * Math.max(0, 1 - f.age / 1.4); f.x = f.cx + Math.cos(f.a) * f.r; f.y = f.cy + Math.sin(f.a) * f.r * 0.3 + f.vy * f.age; }
      else { f.x += (f.vx + Math.sin(f.age * 2 + f.ph) * 12) * dt; f.y += f.vy * dt; }
    }
    this.fx = this.fx.filter((f) => f.age < f.life);
  }
  /** Golden shockwave: swirling autumn leaves + rising fireflies. */
  shockwave(x, y) {
    for (let i = 0; i < 36; i++) this.push({ kind: 'swirl', cx: x, cy: y, a: rnd(0, 6.3), r: rnd(5, 30), va: rnd(2, 4) * (i % 2 ? 1 : -1), vr: rnd(260, 420), vy: rnd(-70, -25), life: rnd(1.8, 2.6), col: i % 3, sz: rnd(4, 7) });
    for (let i = 0; i < 34; i++) this.push({ kind: 'spark', x: x + rnd(-280, 280), y: GROUND - rnd(0, 40), vy: -rnd(15, 55), life: rnd(2.5, 4.5), sz: rnd(1.5, 3) });
  }
  /** Floating icons (hearts, sparkles, notes). */
  icons(x, y, n, chars = ['\u2665', '\u2665', '\u2726']) {
    for (let i = 0; i < n; i++) this.push({ kind: 'icon', x: x + rnd(-18, 18), y, vy: -rnd(25, 45), life: rnd(1.6, 2.4), ch: chars[i % chars.length], sz: rnd(12, 18) });
  }
  drawRain(c, cam) {
    c.strokeStyle = 'rgba(175,195,225,.45)'; c.lineWidth = 1; c.beginPath();
    for (const r of this.rain) if (r.x > cam - 20 && r.x < cam + W + 20) { c.moveTo(r.x, r.y); c.lineTo(r.x - 3, r.y + 13); }
    c.stroke();
  }
  drawLeaves(c, cam, warm) {
    const cols = warm ? ['#e8892b', '#f2b134', '#c8561a'] : ['#6f7886', '#5d6573', '#7f8896'];
    for (const l of this.leaves) { if (l.x < cam - 10 || l.x > cam + W + 10) continue; c.fillStyle = cols[l.c]; c.beginPath(); c.ellipse(l.x, l.y, l.sz, l.sz * 0.6, l.ph, 0, 6.3); c.fill(); }
  }
  /** Draw effect particles (world space). */
  drawFx(c) {
    const cols = ['#e8892b', '#f2b134', '#c8561a'];
    for (const f of this.fx) {
      c.globalAlpha = clamp(Math.min((f.life - f.age) * 1.5, f.age * 4 + 0.1), 0, 1);
      if (f.kind === 'spark') { const tw = 0.6 + 0.4 * Math.sin(f.age * 6 + f.ph); c.globalAlpha *= tw; circ(c, f.x, f.y, f.sz * 3, 'rgba(255,214,110,.25)'); circ(c, f.x, f.y, f.sz, '#fff1a8'); }
      else if (f.kind === 'swirl') { c.fillStyle = cols[f.col]; c.beginPath(); c.ellipse(f.x, f.y, f.sz, f.sz * 0.6, f.a, 0, 6.3); c.fill(); }
      else { c.fillStyle = f.ch === '\u2665' ? '#ff8fa3' : '#ffd96a'; c.font = `${f.sz}px Georgia`; c.fillText(f.ch, f.x, f.y); }
    }
    c.globalAlpha = 1;
  }
}

// ===== end of PART 2 =====//
// ===== PART 3 of 5 - paste parts 1 to 5 in order, one after another, into the JS tab =====
/* ==========================================================================
 * World - three parallax layers + the LightZone reveal
 * ========================================================================== */
/** Maple Lane. Draws a cool scene, then a warm scene revealed through the LightZone masks. */
class World {
  constructor() {
    this.zones = []; this.bakeryOpen = false; this.particles = new ParticleSystem();
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    this.warmC = mk(); this.maskC = mk(); this.wctx = this.warmC.getContext('2d'); this.mctx = this.maskC.getContext('2d');
    const p = CONFIG.parallax;
    this.layers = [
      new ParallaxLayer(p.far, (c, off, P) => this.paintFar(c, off, P)),
      new ParallaxLayer(p.mid, (c, off, P, warm) => this.paintMid(c, off, P, warm)),
      new ParallaxLayer(p.near, (c, off, P, warm) => this.paintNear(c, off, P, warm)),
    ];
  }
  /** Start a LightZone at world-x and return it (no-op if one exists there). */
  activate(x) { let z = this.zones.find((q) => q.x === x); if (!z) { z = new LightZone(x); this.zones.push(z); } return z; }
  update(dt) { this.zones.forEach((z) => z.update(dt)); this.particles.update(dt); }

  /** Composite: cool scene, then warm scene masked by the zones, then shockwave rings. */
  render(c, cam) {
    this.drawScene(c, cam, false);
    const R = CONFIG.zone.radius;
    if (!this.zones.some((z) => z.x + R > cam && z.x - R < cam + W)) return;   // nothing lit on screen: skip the warm pass
    this.drawScene(this.wctx, cam, true);
    const m = this.mctx; m.clearRect(0, 0, W, H);
    this.zones.forEach((z) => z.paintMask(m, cam));
    this.wctx.globalCompositeOperation = 'destination-in'; this.wctx.drawImage(this.maskC, 0, 0); this.wctx.globalCompositeOperation = 'source-over';
    c.drawImage(this.warmC, 0, 0);
    this.zones.forEach((z) => z.paintRing(c, cam));
  }
  drawScene(c, cam, warm) {
    const P = warm ? PALETTE.warm : PALETTE.cool;
    c.save();
    const g = c.createLinearGradient(0, 0, 0, GROUND); P.sky.forEach((s, i) => g.addColorStop(i / 2, s));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (warm) glow(c, 640 - cam * 0.05, 260, 320, '255,236,170', 0.7);
    this.layers.forEach((l) => l.render(c, cam, P, warm));
    c.restore();
  }

  /** Layer 0.2x: misty hills and distant rooftops. */
  paintFar(c, off, P) {
    c.fillStyle = P.hillFar; c.beginPath(); c.moveTo(off - 10, H);
    for (let x = off - 10; x <= off + W + 30; x += 20) c.lineTo(x, 300 + Math.sin(x * 0.005) * 34 + Math.sin(x * 0.013) * 14);
    c.lineTo(off + W + 30, H); c.fill();
    c.fillStyle = P.rooftop;
    for (let i = Math.floor(off / 70) - 1; i * 70 < off + W + 70; i++) {
      const x = i * 70, hh = 24 + Math.abs(i * 37) % 26; c.fillRect(x, 352 - hh, 52, hh + 60);
      c.beginPath(); c.moveTo(x - 4, 352 - hh); c.lineTo(x + 26, 332 - hh); c.lineTo(x + 56, 352 - hh); c.fill();
    }
    const mist = c.createLinearGradient(0, 270, 0, GROUND); mist.addColorStop(0, `rgba(${P.mist},0)`); mist.addColorStop(1, `rgba(${P.mist},.45)`);
    c.fillStyle = mist; c.fillRect(off, 270, W, GROUND - 270);
  }
  /** Layer 0.5x: cozy cottages with warm window cut-outs. */
  paintMid(c, off, P, warm) {
    for (let i = Math.max(0, Math.floor(off / 190) - 1); i * 190 < off + W + 10; i++) {
      const x = i * 190 + (i * 53) % 40, w = 120 + (i * 29) % 40, h = 100 + (i * 17) % 34, y = GROUND - 14 - h;
      c.fillStyle = P.cottage[i % 3]; c.fillRect(x, y, w, h);
      c.fillStyle = P.roof; c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x + w / 2, y - 42); c.lineTo(x + w + 10, y); c.fill(); c.fillRect(x + w - 34, y - 40, 14, 30);
      for (const wx of [x + 20, x + w - 50]) {
        c.fillStyle = P.win; c.fillRect(wx, y + 26, 28, 34);
        if (warm) glow(c, wx + 14, y + 43, 48, '255,200,90', 0.55);
        c.fillStyle = P.roof; c.fillRect(wx + 13, y + 26, 2, 34); c.fillRect(wx, y + 42, 28, 2);
      }
      c.fillStyle = P.door; c.fillRect(x + w / 2 - 11, y + h - 44, 22, 44);
    }
    c.fillStyle = P.hedge; c.fillRect(off, GROUND - 16, W, 16);
  }
  /** Layer 1.0x: sidewalk, buildings, trees, lamps, leaves and rain. */paintNear(c, cam, P, warm) {
    const vis = (x, w = 0) => x + w > cam - 80 && x < cam + W + 80;
    this.bakery(c, P, warm); this.homeHouse(c, P, warm); this.busStop(c, P, warm);
    [190, 640, 870, 1390, 1580, 1800, 2270].forEach((x) => vis(x - 70, 140) && this.tree(c, x, warm));
    c.fillStyle = P.ground; c.fillRect(cam, GROUND, W, H - GROUND);
    c.fillStyle = P.walk; c.fillRect(cam, GROUND, W, 34);
    c.fillStyle = warm ? '#b98a55' : '#3c4656'; c.fillRect(cam, GROUND + 34, W, 4);
    if (!warm) for (let x = Math.floor(cam / 180) * 180; x < cam + W + 180; x += 180) {
      c.fillStyle = 'rgba(120,145,180,.25)'; c.beginPath(); c.ellipse(x + 60 + (x % 7) * 5, GROUND + 60 + (x % 3) * 12, 40, 5, 0, 0, 6.3); c.fill();
    }
    [250, 480, 810, 1250, 1560, 1800, 2200].forEach((x) => vis(x - 60, 120) && this.lamp(c, x, warm));
    this.particles.drawLeaves(c, cam, warm);
    if (!warm) this.particles.drawRain(c, cam);
  }

  bakery(c, P, warm) {
    const x = 980, w = 210, h = 150, y = GROUND - h;
    c.fillStyle = P.cottage[1]; c.fillRect(x, y, w, h);
    for (let i = 0; i < 7; i++) { c.fillStyle = P.awn[i % 2]; c.fillRect(x - 6 + i * 31, y + 30, 31, 22); }
    rr(c, x + 55, y + 2, 100, 26, 6, P.roof);
    c.fillStyle = warm ? '#ffe9a6' : '#7d8aa0'; c.font = 'bold 17px Georgia'; c.textAlign = 'center'; c.fillText('BAKERY', x + 105, y + 21); c.textAlign = 'left';
    c.fillStyle = P.win; c.fillRect(x + 80, y + 62, 120, 60);
    if (warm) { glow(c, x + 140, y + 92, 110, '255,200,90', 0.6); for (let i = 0; i < 4; i++) circ(c, x + 100 + i * 28, y + 112, 7, '#d9a066'); }
    c.fillStyle = this.bakeryOpen ? (warm ? '#ffd884' : '#141a24') : P.door; c.fillRect(x + 15, y + 72, 42, 78);
    if (this.bakeryOpen) { c.fillStyle = P.door; c.fillRect(x + 15, y + 72, 9, 78); if (warm) glow(c, x + 36, y + 120, 70, '255,210,120', 0.6); }
  }
  homeHouse(c, P, warm) {
    const x = 2300, w = 190, h = 170, y = GROUND - h;
    c.fillStyle = P.cottage[2]; c.fillRect(x, y, w, h);
    c.fillStyle = P.roof; c.beginPath(); c.moveTo(x - 12, y); c.lineTo(x + w / 2, y - 55); c.lineTo(x + w + 12, y); c.fill();
    for (const wx of [x + 20, x + w - 50]) { c.fillStyle = P.win; c.fillRect(wx, y + 35, 30, 40); if (warm) glow(c, wx + 15, y + 55, 55, '255,200,90', 0.6); }
    c.fillStyle = P.door; c.fillRect(PORCH_X - 18, GROUND - 70, 36, 70); circ(c, PORCH_X + 10, GROUND - 35, 2.5, warm ? '#ffe28a' : '#6a7488');
    c.fillStyle = warm ? '#a8754a' : '#3a4352'; c.fillRect(PORCH_X - 50, GROUND - 6, 100, 6);
    c.fillStyle = warm ? '#d9b072' : '#4a5468'; c.fillRect(PORCH_X - 12, GROUND - 3, 24, 3);
    circ(c, PORCH_X + 36, GROUND - 90, 5, warm ? '#fff2b8' : '#596378'); if (warm) glow(c, PORCH_X + 36, GROUND - 90, 80, '255,205,100', 0.6);
  }
  busStop(c, P, warm) {
    c.fillStyle = P.roof; c.fillRect(345, GROUND - 112, 125, 8); c.fillRect(350, GROUND - 106, 5, 106); c.fillRect(462, GROUND - 106, 5, 106);
    c.fillStyle = warm ? 'rgba(255,230,160,.25)' : 'rgba(150,175,210,.18)'; c.fillRect(356, GROUND - 104, 106, 80);
    c.fillStyle = warm ? '#8a5a35' : '#2c3442'; c.fillRect(368, GROUND - 30, 80, 6); c.fillRect(374, GROUND - 24, 4, 24); c.fillRect(438, GROUND - 24, 4, 24);
    c.fillStyle = P.roof; c.fillRect(331, GROUND - 100, 4, 100); circ(c, 333, GROUND - 106, 12, warm ? '#ffd23f' : '#5d6a82');
    c.fillStyle = P.roof; c.font = 'bold 11px Georgia'; c.textAlign = 'center'; c.fillText('BUS', 333, GROUND - 102); c.textAlign = 'left';
  }
  tree(c, x, warm) {
    const trunk = warm ? '#4a2f1d' : '#241d1b';
    c.strokeStyle = trunk; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath();
    c.moveTo(x, GROUND - 60); c.lineTo(x, GROUND - 130); c.moveTo(x, GROUND - 100); c.lineTo(x - 38, GROUND - 145); c.lineTo(x - 55, GROUND - 175);
    c.moveTo(x, GROUND - 115); c.lineTo(x + 40, GROUND - 150); c.lineTo(x + 52, GROUND - 180); c.moveTo(x, GROUND - 130); c.lineTo(x + 4, GROUND - 185); c.stroke();
    c.fillStyle = trunk; c.fillRect(x - 7, GROUND - 95, 14, 95);
    if (warm) { circ(c, x, GROUND - 155, 55, '#e8892b'); circ(c, x - 38, GROUND - 130, 38, '#f2b134'); circ(c, x + 38, GROUND - 135, 40, '#d9661f'); }
  }
  lamp(c, x, warm) {
    c.fillStyle = warm ? '#3a2a1e' : '#1a1f28'; c.fillRect(x - 3, GROUND - 120, 6, 124); rr(c, x - 9, GROUND - 134, 18, 13, 3);
    if (warm) { glow(c, x, GROUND - 124, 110, '255,205,100', 0.55); circ(c, x, GROUND - 124, 5, '#fff2b8'); } else circ(c, x, GROUND - 124, 5, '#59647a');
  }
}
/* ==========================================================================
 * Player
 * ========================================================================== */
/** The shivering, scarf-wearing hero. Gains a pulsing Golden Aura once helped. */
class Player {
  constructor() { this.reset(); }
  reset() { this.x = CONFIG.player.startX; this.face = 1; this.walk = 0; this.moving = false; this.aura = false; this.t = 0; this.stepT = 0; }
  update(dt, keys, sound, canMove) {
    const P = CONFIG.player; this.t += dt;
    const d = canMove ? ((keys.has('d') || keys.has('arrowright')) ? 1 : 0) - ((keys.has('a') || keys.has('arrowleft')) ? 1 : 0) : 0;
    this.moving = d !== 0;
    if (d) {
      this.face = d; this.x = clamp(this.x + d * P.speed * dt, P.edge, WORLD_W - P.edge); this.walk += dt * 9;
      if ((this.stepT += dt) > P.stepInterval) { this.stepT = 0; sound.step(); }
    }
  }draw(c) {
    const bob = this.moving ? Math.abs(Math.sin(this.walk)) * 3 : 0, shiver = !this.aura && !this.moving ? Math.sin(this.t * 45) * 0.8 : 0;
    if (this.aura) glow(c, this.x, GROUND - 40, 72 + Math.sin(this.t * 3) * 8, '255,205,100', 0.55 + Math.sin(this.t * 3) * 0.1);
    c.save(); c.translate(this.x + shiver, GROUND - bob); c.scale(this.face, 1);
    const sw = this.moving ? Math.sin(this.walk) * 5 : 0;
    c.fillStyle = '#2b2320'; c.fillRect(-9 + sw, -8 + bob, 8, 8); c.fillRect(1 - sw, -8 + bob, 8, 8);
    c.save(); c.scale(1, 1 + Math.sin(this.t * 2.2) * 0.015);                      // breathing
    rr(c, -13, -50, 26, 44, 8, '#3f7d8c'); rr(c, -14, -53, 28, 8, 4, '#f2b134'); circ(c, 0, -61, 10, '#f1c9a0');
    c.fillStyle = '#c8553d'; c.beginPath(); c.arc(0, -64, 10.5, Math.PI, 0); c.fill(); circ(c, 0, -76, 3.5, '#f6d6a0');
    if (isBlinking(this.t)) { c.strokeStyle = '#2a2a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2.5, -61); c.lineTo(6, -61); c.stroke(); } else circ(c, 4, -61, 1.5, '#2a2a2a');
    c.restore();
    scarfTail(c, -12, -49, 22, '#f2b134', this.t, this.moving ? 2.2 : 1);          // fluttering scarf
    c.restore();
  }
}

// ===== end of PART 3 =====
// ===== PART 4 of 5 - paste parts 1 to 5 in order, one after another, into the JS tab =====
/* ==========================================================================
 * NPC
 * ========================================================================== */
/** A villager with a bespoke procedural drawing (`draw_<id>`), idle animation and helped-state. */
class NPC {
  constructor(d, i) { Object.assign(this, d); this.done = false; this.t = 0; this.anim = 0; this.ph = i * 1.3; }
  update(dt) { this.t += dt; if (this.done) this.anim += dt; }
  draw(c) { c.save(); this['draw_' + this.id](c); c.restore(); }

  draw_elder(c) {
    const t = this.t + this.ph; c.translate(this.x, GROUND); c.scale(-1, 1);
    body(c, '#8a6f8f', '#eeeeee', t); rr(c, -11, -74, 22, 8, 3, '#6b4f6e'); rr(c, -12, -52, 24, 7, 3, '#d9a441'); scarfTail(c, -10, -49, 18, '#d9a441', t);
    const ux = this.done ? 16 : 6, r = this.done ? 64 : 52;
    c.save(); c.translate(ux, -40); c.rotate(Math.sin(t * 1.3) * 0.03);
    c.strokeStyle = '#5a4a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -60); c.stroke();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, -60, r, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = '#e0a800'; c.lineWidth = 1.5; c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(0, -60 - r); c.lineTo(i * r / 2.5, -60); } c.stroke(); c.restore();
    if (this.done) glow(c, ux, -60, 80, '255,215,110', 0.3);
  }
  draw_baker(c) {
    const t = this.t + this.ph; c.translate(this.x, GROUND); c.scale(-1, 1);
    body(c, '#c88a4c', '#5a3a22', t); rr(c, -10, -40, 20, 34, 5, '#fff6e6'); rr(c, -10, -82, 20, 14, 6, '#ffffff');
    const b = this.done ? Math.sin(t * 2.2) * 0.6 : Math.sin(this.t * 10);
    rr(c, 4, -44 + b, 48, 5, 2, '#b9b9b9');
    [14, 25, 36, 47].forEach((x) => circ(c, x, -50 + b, 5.5, '#d9a066')); [19, 30, 41].forEach((x) => circ(c, x, -59 + b, 5.5, '#e3b27a'));
    if (!this.done) circ(c, -13, -68 + Math.abs(Math.sin(this.t * 3)) * 4, 2, '#9cc9ee');
  }
  draw_kid(c) {
    const t = this.t + this.ph, p = clamp(this.anim / 1.2, 0, 1), e = p * p * (3 - 2 * p);
    const shake = this.done && p < 1 ? Math.sin(this.anim * 30) * 4 * (1 - p) : 0;
    c.strokeStyle = '#3a2c22'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(1580, GROUND - 78); c.lineTo(1535, GROUND - 112 + shake); c.stroke();
    if (p < 1) {
      c.save(); c.translate(lerp(1535, this.x, e), lerp(GROUND - 108, GROUND - 42, e)); c.rotate(Math.sin(this.t * 6) * 0.35 * (this.done ? 1 : 0.4));
      rr(c, -5, -4, 10, 28, 4, '#d62f3a'); rr(c, -5, 6, 10, 4, 1, '#f4b6bb'); c.restore();
    }
    c.translate(this.x, GROUND); c.scale(-0.75, 0.75); body(c, '#4a6fa5', '#6b3f22', t);
    if (p >= 1) { rr(c, -14, -53, 28, 9, 4, '#d62f3a'); scarfTail(c, -10, -47, 20, '#d62f3a', t, 1.4); }
  }
  draw_musician(c) {
    const t = this.t + this.ph; c.save(); c.translate(this.x, GROUND); c.scale(-1, 1);
    body(c, '#7a4f35', '#2b2320', t); rr(c, -10, -76, 20, 7, 3, '#b5483a');
    c.translate(12, -26); c.rotate(-0.5 + (this.done ? Math.sin(this.t * 8) * 0.05 : 0));
    circ(c, 0, 0, 13, '#c9853a'); circ(c, 13, 0, 9, '#c9853a'); circ(c, 5, 0, 4, '#3b2412'); c.fillStyle = '#5a3b22'; c.fillRect(20, -3, 36, 5);
    c.restore();
    rr(c, this.x + 28, GROUND - 8, 38, 8, 2, '#3b2a22'); rr(c, this.x + 31, GROUND - 6, 32, 4, 1, '#7a1f2b');
    if (this.done) [0, 1, 2].forEach((i) => circ(c, this.x + 38 + i * 9, GROUND - 7, 2.5, '#ffd96a'));
    const sh = this.done ? 0 : Math.sin(this.t * 40) * 0.7, tail = Math.sin(this.t * (this.done ? 3 : 1.5)) * 8;
    c.save(); c.translate(this.x + 95 + sh, GROUND);
    c.strokeStyle = '#c9792e'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(12, -8); c.quadraticCurveTo(30, -10 + tail, 26, -26); c.stroke();
    c.fillStyle = '#c9792e'; c.beginPath(); c.ellipse(0, -10, 14, 10 + Math.sin(t * 2.5) * 0.6, 0, 0, 6.3); c.fill(); circ(c, -11, -22, 8, '#c9792e');
    c.beginPath(); c.moveTo(-17, -27); c.lineTo(-15, -37); c.lineTo(-10, -29); c.moveTo(-5, -29); c.lineTo(-3, -37); c.lineTo(-1, -26); c.fill();
    if (isBlinking(t * 0.9)) { c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.moveTo(-15, -23); c.lineTo(-13, -23); c.moveTo(-9, -23); c.lineTo(-7, -23); c.stroke(); }
    else { circ(c, -14, -23, 1.3, '#222'); circ(c, -8, -23, 1.3, '#222'); }
    c.restore();
  }
}

/* ==========================================================================
 * InteractionManager
 * ========================================================================== */
/** HTML/CSS dialogue card, fully navigable by mouse and keyboard. */
class InteractionManager {
  constructor(game) {
    this.game = game; this.el = $('#dialogue'); this.nameEl = $('#dlg-name'); this.textEl = $('#dlg-text');
    this.choices = $('#dlg-choices'); this.row = $('#dlg-input-row'); this.input = $('#dlg-input'); this.send = $('#dlg-send');
  }
  /** @param {string} name @param {string} text @param {{label:string,action:Function}[]} choices @param {(s:string)=>void} [onText] enables the custom text row */show(name, text, choices, onText) {
    this.game.state = 'dialogue'; this.nameEl.textContent = name; this.textEl.textContent = text; this.choices.replaceChildren();
    choices.forEach((ch, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (i ? '' : ' primary');
      b.textContent = (choices.length > 1 ? `${i + 1}. ` : '') + ch.label;
      b.addEventListener('click', () => { this.game.sound.unlock(); this.game.sound.pop(); ch.action(); });
      this.choices.appendChild(b);
    });
    this.row.classList.toggle('hidden', !onText); this.input.value = '';
    this.send.onclick = onText ? () => onText(this.input.value.trim()) : null;
    this.el.classList.remove('hidden'); this.choices.querySelector('button')?.focus();
  }
  close() {
    this.el.classList.add('hidden');
    if (this.game.state === 'dialogue') this.game.state = 'play';
    document.activeElement?.blur();
  }
}


/* ==========================================================================
 * PostcardGenerator
 * ========================================================================== */
/** Renders a vintage illustrated greeting card onto a canvas. */
class PostcardGenerator {
  /** @param {HTMLCanvasElement} cv @param {{log:object[],message:string,name:string}} data */
  render(cv, { log, message, name }) {
    const { w: PW, h: PH, seed } = CONFIG.postcard; cv.width = PW; cv.height = PH;
    const c = cv.getContext('2d'), rand = mulberry32(seed);
    this.paper(c, PW, PH, rand); this.leafBorder(c, PW, PH, rand);
    this.scene(c, 54, 54, PW - 108, 220, log);
    c.strokeStyle = '#8a5a2b'; c.lineWidth = 3; c.strokeRect(54, 54, PW - 108, 220);
    c.textAlign = 'left'; c.lineJoin = 'round'; c.font = 'italic bold 38px Georgia, serif'; c.lineWidth = 6; c.strokeStyle = '#7a3b12'; c.fillStyle = '#fff6dc';
    c.strokeText('Greetings from Maple Lane', 74, 108); c.fillText('Greetings from Maple Lane', 74, 108);
    this.postmark(c, PW - 232, 98); this.stamp(c, PW - 156, 64);

    c.fillStyle = '#5a3b22'; c.font = 'bold 17px Georgia'; c.fillText('Kindnesses shared on Maple Lane', 70, 318);
    c.font = '15px Georgia'; let y = 345; log.forEach((e) => { y = this.wrap(c, '\u2022 ' + e.summary, 76, y, 350, 20) + 6; });
    c.strokeStyle = '#d2b07a'; c.lineWidth = 1; c.beginPath(); c.moveTo(450, 300); c.lineTo(450, PH - 70); c.stroke();
    c.fillStyle = '#5a3b22'; c.font = 'bold 17px Georgia'; c.fillText('Today I am thankful for\u2026', 478, 318);
    c.fillStyle = '#3d2a18'; c.font = 'italic 24px "Palatino Linotype", Georgia, serif';
    const my = this.wrap(c, '\u201C' + (message || 'every small kindness that makes a cold day warm') + '\u201D', 478, 352, 360, 31);
    if (name) { c.textAlign = 'right'; c.font = 'italic 21px Georgia'; c.fillText('\u2014 ' + name, PW - 62, my + 10); }
    c.textAlign = 'center'; c.fillStyle = '#a07a4a'; c.font = '13px Georgia'; c.fillText('The Golden Umbrella \u00B7 Maple Lane', PW / 2, PH - 50); c.textAlign = 'left';
  }
  /** Plain-text version of the postcard, for the clipboard. */
  static note(log, message, name) {
    const lines = ['Gratitude note from Maple Lane', '', `"${message || 'every small kindness that makes a cold day warm'}"${name ? ' - ' + name : ''}`, '', 'Kindnesses shared:'];
    log.forEach((e) => lines.push('- ' + e.summary)); return lines.join('\n');
  }
  /** Textured cream paper: gradient, speckles, fibres, aged edges. */
  paper(c, PW, PH, rand) {
    const g = c.createRadialGradient(PW / 2, PH / 2, 120, PW / 2, PH / 2, 560); g.addColorStop(0, '#fbf0d6'); g.addColorStop(1, '#efd9ac');
    c.fillStyle = g; c.fillRect(0, 0, PW, PH);
    for (let i = 0; i < 2400; i++) { c.fillStyle = `rgba(${110 + rand() * 40 | 0},80,40,${0.03 + rand() * 0.06})`; c.fillRect(rand() * PW, rand() * PH, 1 + rand() * 1.5, 1); }
    c.strokeStyle = 'rgba(140,100,50,.06)'; c.lineWidth = 1;
    for (let i = 0; i < 70; i++) { const x = rand() * PW, y = rand() * PH; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rand() * 24 - 12, y + rand() * 24 - 12); c.stroke(); }
    const v = c.createRadialGradient(PW / 2, PH / 2, 300, PW / 2, PH / 2, 560); v.addColorStop(0, 'rgba(150,100,40,0)'); v.addColorStop(1, 'rgba(150,100,40,.22)');
    c.fillStyle = v; c.fillRect(0, 0, PW, PH);
  }/** Decorative autumn leaf frame. */
  leafBorder(c, PW, PH, rand) {
    const cols = ['#c8561a', '#e8892b', '#f2b134', '#a83d12', '#8f6b1e'], put = (x, y) => this.leaf(c, x, y, 9 + rand() * 7, rand() * 6.3, cols[(rand() * 5) | 0]);
    for (let x = 22; x < PW - 14; x += 28) { put(x, 20 + rand() * 8); put(x, PH - 20 - rand() * 8); }
    for (let y = 22; y < PH - 14; y += 28) { put(20 + rand() * 8, y); put(PW - 20 - rand() * 8, y); }
    c.strokeStyle = 'rgba(138,90,43,.55)'; c.lineWidth = 1.5; c.strokeRect(40, 40, PW - 80, PH - 80);
  }
  leaf(c, x, y, s, rot, col) {
    c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.beginPath(); c.moveTo(0, -s);
    c.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.8, s * 0.6, 0, s); c.bezierCurveTo(-s * 0.8, s * 0.6, -s * 0.9, -s * 0.5, 0, -s); c.fill();
    c.strokeStyle = 'rgba(60,30,10,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -s); c.lineTo(0, s * 1.2); c.stroke(); c.restore();
  }
  /** Postal stamp (perforated edge, umbrella emblem, CONFIG.postcard.stamp text). */
  stamp(c, x, y) {
    const w = 88, h = 108; c.save(); c.translate(x, y); c.rotate(0.05);
    c.strokeStyle = '#fffaf0'; c.lineWidth = 7; c.setLineDash([3, 5]); c.strokeRect(-2, -2, w + 4, h + 4); c.setLineDash([]);
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe9a6'; c.fillRect(7, 7, w - 14, h - 40);
    c.strokeStyle = '#b5483a'; c.lineWidth = 1.5; c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(w / 2, 52, 24, Math.PI, 0); c.fill();
    c.strokeStyle = '#5a3b22'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2, 52); c.lineTo(w / 2, 70); c.stroke();
    c.fillStyle = '#7a3b12'; c.font = 'bold 11px Georgia'; c.textAlign = 'center'; const [a, b] = CONFIG.postcard.stamp.split(' \u2022 ');
    c.fillText(a, w / 2, h - 22); c.fillText('\u2022 ' + b, w / 2, h - 9); c.restore();
  }
  /** Wavy cancellation marks. */
  postmark(c, x, y) {
    c.save(); c.strokeStyle = 'rgba(90,40,30,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 30, 0, 6.3); c.stroke();
    c.beginPath(); c.arc(x, y, 24, 0, 6.3); c.stroke(); c.font = 'bold 9px Georgia'; c.fillStyle = 'rgba(90,40,30,.6)'; c.textAlign = 'center'; c.fillText('MAPLE LANE', x, y - 2); c.fillText('NOV 2026', x, y + 10);
    for (let i = 0; i < 4; i++) { c.beginPath(); for (let k = 0; k <= 60; k += 4) c.lineTo(x + 36 + k, y - 18 + i * 12 + Math.sin(k / 6) * 3); c.stroke(); } c.restore();
  }
  wrap(c, text, x, y, maxW, lh) {
    let line = '';
    for (const word of text.split(' ')) { const test = line ? line + ' ' + word : word; if (c.measureText(test).width > maxW && line) { c.fillText(line, x, y); line = word; y += lh; } else line = test; }
    c.fillText(line, x, y); return y + lh;
  }
  /** Mini painted golden street with the helped neighbours standing in it. */
  scene(c, x, y, w, h, log) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff8f3a'); g.addColorStop(0.55, '#ffc266'); g.addColorStop(1, '#ffe9a6'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    glow(c, w * 0.55, 80, 170, '255,244,190', 0.9); circ(c, w * 0.55, 80, 32, '#fff4c4');
    c.fillStyle = 'rgba(255,240,210,.35)'; [[120, 60, 70], [700, 90, 60], [420, 40, 50]].forEach(([cx, cy, r]) => { c.beginPath(); c.ellipse(cx, cy, r, r * 0.3, 0, 0, 6.3); c.fill(); });
    [['#d98a3f', 135], ['#c0702a', 160]].forEach(([col, base], k) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, h); for (let i = 0; i <= w; i += 20) c.lineTo(i, base + Math.sin(i * (0.011 + k * 0.004) + k) * 20); c.lineTo(w, h); c.fill(); });
    for (let i = 0; i < 6; i++) {
      const hx = 20 + i * 132, hh = 64 + (i % 3) * 20, hy = h - 44 - hh;
      c.fillStyle = ['#d98e50', '#e0a15f', '#cf8346'][i % 3]; c.fillRect(hx, hy, 98, hh);
      c.fillStyle = '#8e4b27'; c.beginPath(); c.moveTo(hx - 8, hy); c.lineTo(hx + 49, hy - 32); c.lineTo(hx + 106, hy); c.fill();
      for (const wx of [hx + 15, hx + 60]) { glow(c, wx + 11, hy + 28, 34, '255,200,90', 0.6); c.fillStyle = '#ffe28a'; c.fillRect(wx, hy + 16, 22, 26); }
    }
    c.fillStyle = '#6a4a2c'; c.fillRect(0, h - 44, w, 44); c.fillStyle = '#9b7549'; c.fillRect(0, h - 44, w, 14);
    [80, 330, 600, 780].forEach((lx) => { c.fillStyle = '#3a2a1e'; c.fillRect(lx - 2, h - 140, 4, 100); glow(c, lx, h - 142, 70, '255,205,100', 0.7); circ(c, lx, h - 142, 5, '#fff2b8'); });
    const coats = { elder: '#8a6f8f', baker: '#c88a4c', kid: '#4a6fa5', musician: '#7a4f35' }, spots = { elder: 190, baker: 270, kid: 520, musician: 680 };
    log.forEach((e) => { const fx = spots[e.id]; rr(c, fx - 8, h - 84, 16, 32, 5, coats[e.id]); circ(c, fx, h - 90, 7, '#f1c9a0'); });
    const fx = w * 0.4; rr(c, fx - 9, h - 88, 18, 36, 6, '#3f7d8c'); circ(c, fx, h - 94, 8, '#f1c9a0');
    c.strokeStyle = '#5a4a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx + 6, h - 84); c.lineTo(fx + 6, h - 124); c.stroke();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(fx + 6, h - 124, 34, Math.PI, 0); c.fill();
    const cols = ['#e8892b', '#f2b134', '#c8561a'];
    for (let i = 0; i < 45; i++) { c.fillStyle = cols[i % 3]; c.beginPath(); c.ellipse((i * 97) % w, (i * 53) % (h - 40), 4, 2.5, i, 0, 6.3); c.fill(); }
    for (let i = 0; i < 24; i++) circ(c, (i * 131) % w, 60 + (i * 47) % (h - 120), 1.6, '#fff1a8');
    c.restore();
  }
}

// ===== end of PART 4 =====
// ===== PART 5 of 5 - paste parts 1 to 5 in order, one after another, into the JS tab =====
/* ==========================================================================
 * Game
 * ========================================================================== */
/** Owns state, input, story flow, HUD and the main loop. States: title | play | dialogue | finale | postcard. */
class Game {
  constructor() {
    this.canvas = $('#game'); this.ctx = this.canvas.getContext('2d'); this.keys = new Set(); this.clock = 0;
    this.sound = new SoundEngine(); this.ui = new InteractionManager(this); this.postcard = new PostcardGenerator();
    this.bindEvents(); this.initTouch(); this.init(true);
    this.last = performance.now(); requestAnimationFrame((t) => this.loop(t));
  }
  /** (Re)start a run. `showTitle` false skips straight into play (Play Again). */
  init(showTitle) {
    this.world = new World(); this.player = new Player(); this.npcs = STORY.map((d, i) => new NPC(d, i));
    this.gratitudeLog = []; this.cam = 0; this.porchShown = false; this.state = showTitle ? 'title' : 'play';
    this.sound.setLayers(0); this.ui.close(); this.closeJournal(); this.viewPct = null;
    ['#finale', '#postcard-modal'].forEach((s) => $(s).classList.add('hidden'));
    $('#title').classList.toggle('hidden', !showTitle); $('#hud').classList.toggle('hidden', showTitle);
    $('#thanks-input').value = ''; $('#name-input').value = ''; $('#copy-btn').textContent = 'Copy Gratitude Note';
    this.updateHUD();
    if (showTitle) $('#start-btn').focus({ preventScroll: true });
  }startGame() {
    this.sound.unlock(); this.sound.startRain(); this.sound.pop();
    $('#title').classList.add('hidden'); $('#hud').classList.remove('hidden'); this.state = 'play';
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('visibilitychange', () => this.sound.suspend(document.hidden));
    this.canvas.addEventListener('click', () => { this.sound.unlock(); if (this.state === 'play') this.tryInteract(); });
    $('#start-btn').addEventListener('click', () => this.startGame());
    $('#sound-btn').addEventListener('click', () => { this.sound.unlock(); this.toggleMute(); });
    $('#journal-btn').addEventListener('click', () => this.toggleJournal());
    $('#journal-close').addEventListener('click', () => this.closeJournal());
    $('#create-btn').addEventListener('click', () => this.createPostcard());
    ['#thanks-input', '#name-input'].forEach((s) => $(s).addEventListener('keydown', (e) => { if (e.key === 'Enter') this.createPostcard(); }));
    $('#download-btn').addEventListener('click', () => this.download());
    $('#copy-btn').addEventListener('click', () => this.copyNote());
    $('#again-btn').addEventListener('click', () => this.init(false));
  }
  toggleMute() { $('#sound-btn').classList.toggle('muted', this.sound.toggleMute()); }
  toggleJournal() {
    const o = $('#journal').classList.toggle('open'); $('#journal').setAttribute('aria-hidden', String(!o));
    if (o) $('#journal-btn').classList.remove('has-new');
  }
  closeJournal() { $('#journal').classList.remove('open'); $('#journal').setAttribute('aria-hidden', 'true'); }

  onKey(e) {
    const k = e.key.toLowerCase();
    if (e.target.tagName === 'INPUT') { if (this.state === 'dialogue' && k === 'enter') { e.preventDefault(); this.ui.send.click(); } return; }
    if (k === 'm') { this.sound.unlock(); this.toggleMute(); return; }
    if (this.state === 'title') return;
    if (k === 'escape') { this.closeJournal(); return; }
    if (k === 'j' && (this.state === 'play' || this.state === 'dialogue')) { this.toggleJournal(); return; }
    if (this.state === 'dialogue') {
      if (e.repeat) return;
      const btns = this.ui.choices.querySelectorAll('button');
      if (k === 'e' || k === 'enter') {
     
        e.preventDefault(); const a = document.activeElement;
        (a && a.tagName === 'BUTTON' && this.ui.choices.contains(a) ? a : btns[0])?.click();
      } else if (/^[1-9]$/.test(k) && btns[+k - 1]) { e.preventDefault(); btns[+k - 1].click(); }
      return;
    }
    if (this.state !== 'play') return;
    if (k === 'e') { if (!e.repeat) this.tryInteract(); }
    else if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) { e.preventDefault(); this.keys.add(k); }
  }

  /** Detect touch devices (CSS shows the on-screen controls) and wire the buttons. */
  initTouch() {
    const set = (on) => { this.touch = on; document.body.classList.toggle('touch', on); };
    // Phones report a coarse pointer. Touchscreen laptops don't, so they keep the keyboard UI until a finger actually touches
    // the screen, and switch back as soon as a key is pressed.
    set(window.matchMedia('(pointer: coarse)').matches);
    window.addEventListener('touchstart', () => set(true), { passive: true });
    window.addEventListener('keydown', () => { if (this.touch && !window.matchMedia('(pointer: coarse)').matches) set(false); });
    const hold = (id, key) => {
      const b = $(id), off = () => { this.keys.delete(key); b.classList.remove('down'); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.sound.unlock(); this.keys.add(key); b.classList.add('down'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, off));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    hold('#t-left', 'arrowleft'); hold('#t-right', 'arrowright');
    $('#t-act').addEventListener('pointerdown', (e) => { e.preventDefault(); this.sound.unlock(); if (this.state === 'play') this.tryInteract(); });
  }

  /* ----- story flow ----- */
  nearNPC() { return this.npcs.find((n) => !n.done && Math.abs(n.x - this.player.x) < CONFIG.interact.talkRadius); }
  tryInteract() {
    const n = this.nearNPC();
    if (n) this.interact(n); else if (Math.abs(PORCH_X - this.player.x) < CONFIG.interact.porchPrompt) this.porch();
  }
  cont() { return { label: 'Continue', action: () => this.ui.close() }; }

  interact(npc) {
    this.sound.unlock(); this.sound.pop(); if (this.touch) navigator.vibrate?.(15);
    if (npc.id === 'elder') {
      const fin = (t, custom) => {
        this.complete(npc, t, 'you');
        this.ui.show(npc.name, (custom ? `\u201C${t}\u201D What a lovely thing to say. ` : '') + npc.thanks + ' (A golden warmth glows around you...)', [this.cont()]);
      };
      this.ui.show(npc.name, npc.intro, [
        { label: 'Thank you so much!', action: () => fin('Thank you so much!', false) },
        { label: 'That is so kind of you.', action: () => fin('That is so kind of you.', false) },
      ], (text) => { if (text) fin(text, true); else this.ui.input.focus(); });
    } else if (!this.player.aura) {
      this.ui.show(npc.name, npc.hint, [{ label: "I'll be back soon", action: () => this.ui.close() }]);
    } else {
      this.ui.show(npc.name, npc.intro, [{ label: npc.cta, action: () => { this.complete(npc, npc.thanks, 'them'); this.ui.show(npc.name, npc.thanks, [this.cont()]); } }]);
    }
  }
  /** Record the kindness, trigger the light shockwave, particles, music layer and HUD. */
  complete(npc, note, from) {
    npc.done = true; this.gratitudeLog.push({ id: npc.id, who: npc.name, summary: npc.summary, note, from });
    this.world.activate(npc.x); this.world.particles.shockwave(npc.x, GROUND - 50); this.world.particles.icons(npc.x, GROUND - 90, 10);
    if (npc.id === 'elder') this.player.aura = true;
    if (npc.id === 'baker') this.world.bakeryOpen = true;
    const n = this.gratitudeLog.length; this.sound.kindness(n); this.sound.setLayers(n); this.updateHUD(); this.celebrate(n);
  }
  checkPorch() {
    const d = Math.abs(this.player.x - PORCH_X), I = CONFIG.interact;
    if (d > I.porchReset) this.porchShown = false;
    if (this.state === 'play' && !this.porchShown && d < I.porchRadius) { this.porchShown = true; this.porch(); }
  }
  porch() {
    const left = this.npcs.filter((n) => n.id !== 'elder' && !n.done).length;
    if (left === 0 && this.npcs[0].done) return this.openFinale();
    let msg = `Home sweet home! ${left} neighbor${left === 1 ? '' : 's'} on Maple Lane still need${left === 1 ? 's' : ''} a little kindness.`;
    if (!this.player.aura) msg += ' Start with the neighbor at the bus stop.';
    this.ui.show('Your Front Porch', msg, [this.cont()]);
  }
  openFinale() { this.state = 'finale'; this.closeJournal(); $('#finale').classList.remove('hidden'); $('#thanks-input').focus(); }
  createPostcard() {
    if (this.state !== 'finale') return;
    this.postcard.render($('#postcard'), { log: this.gratitudeLog, message: $('#thanks-input').value.trim(), name: $('#name-input').value.trim() });
    $('#finale').classList.add('hidden'); $('#postcard-modal').classList.remove('hidden'); this.state = 'postcard'; this.sound.kindness(4);
  }
  download() {
    const a = document.createElement('a'); a.href = $('#postcard').toDataURL('image/png'); a.download = 'maple-lane-postcard.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  /** Copy the plain-text gratitude note (Clipboard API with a textarea fallback). */
  async copyNote() {
    const text = PostcardGenerator.note(this.gratitudeLog, $('#thanks-input').value.trim(), $('#name-input').value.trim()), btn = $('#copy-btn');
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Gratitude Note'; }, 1800);
  }/** Toast, haptics and a journal badge after each kindness. */
  celebrate(n) {
    this.toast(n < this.npcs.length ? `Kindness ${n} of ${this.npcs.length} shared \u00B7 saved to your journal` : 'Maple Lane is glowing! Head home to the end of the street \u2192');
    $('#journal-btn').classList.add('has-new'); if (this.touch) navigator.vibrate?.([30, 40, 30]);
  }
  toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
  /** Narrow/tall screens crop the canvas (object-fit: cover); pan the crop so the player stays in view. */
  fitView() {
    const cv = this.canvas, cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
    const visW = Math.min(W, cw * H / ch); let pct = 50;
    if (visW < W) { const px = this.state === 'title' ? W / 2 : this.player.x - this.cam; pct = clamp(px - visW / 2, 0, W - visW) / (W - visW) * 100; }
    this.viewPct = lerp(this.viewPct ?? pct, pct, 0.2); cv.style.objectPosition = `${this.viewPct.toFixed(2)}% 50%`;
  }
  /** Refresh lanterns, progress text and the Memory Journal list. */
  updateHUD() {
    const n = this.gratitudeLog.length;
    document.querySelectorAll('.lanterns i').forEach((el, i) => el.classList.toggle('lit', i < n));
    $('#warmth-text').textContent = `${n} / ${this.npcs.length} Kindnesses Shared`;
    const ol = $('#journal-list'); ol.replaceChildren();
    const li = (cls) => { const e = document.createElement('li'); if (cls) e.className = cls; ol.appendChild(e); return e; };
    const add = (p, tag, text) => { const e = document.createElement(tag); e.textContent = text; p.appendChild(e); };
    if (!n) li('empty').textContent = 'Your kindnesses will gather here.';
    this.gratitudeLog.forEach((e) => { const l = li(); add(l, 'strong', e.who); add(l, 'span', e.summary); add(l, 'q', (e.from === 'you' ? 'You said: ' : 'They said: ') + e.note); });
  }

  /* ----- loop ----- */
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.clock += dt;
    this.update(dt); this.render(); requestAnimationFrame((t) => this.loop(t));
  }
  update(dt) {
    const w = this.world, P = w.particles, R = CONFIG.zone.radius;
    if (document.body.dataset.state !== this.state) document.body.dataset.state = this.state;   // CSS hook for touch controls
    if (this.state !== 'play') this.keys.clear();                                               // a hidden button can't send pointerup
    w.update(dt); this.npcs.forEach((n) => n.update(dt));
    this.player.update(dt, this.keys, this.sound, this.state === 'play');
    const target = this.state === 'title' ? 60 + Math.sin(this.clock * 0.3) * CONFIG.camera.titleDrift : clamp(this.player.x - W / 2, 0, WORLD_W - W);
    this.cam += (target - this.cam) * Math.min(1, dt * CONFIG.camera.follow);
    w.zones.forEach((z) => { if (z.progress >= 1 && Math.random() < dt * CONFIG.particles.fireflyRate) P.push({ kind: 'spark', x: z.x + rnd(-R * 0.8, R * 0.8), y: GROUND - rnd(10, 170), vy: -rnd(5, 18), life: rnd(3, 5), sz: rnd(1.5, 2.6) }); });
    this.npcs.forEach((n) => { if (n.done && Math.random() < dt * 0.4) P.icons(n.x, GROUND - 95, 1, n.id === 'musician' ? ['\u266A', '\u2665'] : ['\u2665', '\u2726']); });
    this.checkPorch();
  }
  render() {
    const c = this.ctx; c.clearRect(0, 0, W, H);
    this.world.render(c, this.cam);
    c.save(); c.translate(-this.cam, 0);
    this.npcs.forEach((n) => n.draw(c)); this.player.draw(c); this.world.particles.drawFx(c);
    const near = this.state === 'play' ? this.nearNPC() : null;
    if (near) this.drawPrompt(c, near.x); else if (this.state === 'play' && Math.abs(PORCH_X - this.player.x) < CONFIG.interact.porchPrompt) this.drawPrompt(c, PORCH_X);
    c.restore();
    const v = c.createRadialGradient(W / 2, H / 2, 250, W / 2, H / 2, 560); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.28)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    if (this.state === 'play' && !this.player.aura) { c.font = '14px Georgia'; c.textAlign = 'center'; c.fillStyle = 'rgba(230,238,250,.8)'; c.fillText('Brr... find the neighbor at the bus stop \u2192', W / 2, 78); c.textAlign = 'left'; }
    this.fitView();
  }
  drawPrompt(c, x) {
    const y = GROUND - 120 + Math.sin(performance.now() / 300) * 3, txt = this.touch ? '[Tap to Interact]' : '[Press E or Click]';
    c.font = 'bold 14px Georgia'; c.textAlign = 'center'; const w = c.measureText(txt).width + 20;
    rr(c, x - w / 2, y - 17, w, 25, 10, 'rgba(20,24,32,.82)'); c.fillStyle = '#ffe29a'; c.fillText(txt, x, y); c.textAlign = 'left';
  }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
// ===== end of PART 5 =====
