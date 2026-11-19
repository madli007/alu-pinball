'use strict';

/* =====================================================================
   ALU PINBALL  —  Impol × Alcad edition (za hec)
   Čisti HTML + JavaScript, brez knjižnic. Odpri index.html ali objavi na GitHub Pages.
   ===================================================================== */

/* ---------------- KONFIGURACIJA (spremeni po želji) ---------------- */
const CFG = {
  naslov: 'ALU PINBALL',
  podnaslov: 'IMPOL × ALCAD edition',
  firmaA: 'IMPOL',
  firmaB: 'ALCAD',
  steviloZogic: 3,
  ballSaveSek: 10,
};

/* ---------------- KONSTANTE ---------------- */
const W = 600, H = 1000;          // logične dimenzije mize
const BR = 10;                     // polmer žogice
const GRAV = 1900;                 // gravitacija (px/s²)
const MAXV = 3400;                 // največja hitrost
const STEP = 1 / 720;              // korak fizike (12 substepov na frame pri 60 fps)
const TAU = Math.PI * 2;
const PLUNGER_Y = 957;

/* =====================================================================
   ZVOK (sintetiziran z Web Audio — brez datotek)
   ===================================================================== */
const Sfx = (() => {
  let ac = null, out = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('aluPinballMute') === '1'; } catch (e) { /* ignore */ }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    out = ac.createGain();
    out.gain.value = muted ? 0 : 0.4;
    out.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function tone(f, dur, type = 'square', vol = 0.2, f2 = null, delay = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.2, freq = 2000, delay = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, s = ac.createBufferSource();
    const f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t); s.stop(t + dur + 0.05);
  }
  function arp(notes, step = 0.07, type = 'square', vol = 0.12) {
    notes.forEach((n, i) => tone(n, step * 1.8, type, vol, null, i * step));
  }
  return {
    init,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      if (out) out.gain.value = muted ? 0 : 0.4;
      try { localStorage.setItem('aluPinballMute', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      return muted;
    },
    flipper() { noise(0.05, 0.25, 700); tone(110, 0.06, 'square', 0.1, 55); },
    bumper() { tone(620, 0.12, 'square', 0.16, 240); tone(1240, 0.05, 'triangle', 0.1); },
    sling() { noise(0.07, 0.3, 2600); tone(330, 0.06, 'sawtooth', 0.1, 140); },
    lane() { tone(1320, 0.1, 'sine', 0.2); tone(1760, 0.12, 'sine', 0.15, null, 0.06); },
    target() { tone(240, 0.09, 'square', 0.18, 110); noise(0.04, 0.2, 1500); },
    spin() { tone(1700 + Math.random() * 300, 0.025, 'square', 0.05); },
    launch(p) { noise(0.25, 0.15 + p * 0.2, 900); tone(90, 0.2, 'sawtooth', 0.12, 300); },
    drain() { tone(420, 0.9, 'sawtooth', 0.15, 55); },
    wall(v) { tone(140 + Math.random() * 60, 0.03, 'triangle', Math.min(0.12, v / 9000)); },
    lock() { tone(140, 0.45, 'sawtooth', 0.2, 700); noise(0.4, 0.15, 400); },
    scoop() { tone(200, 0.3, 'triangle', 0.2, 90); },
    kick() { noise(0.12, 0.3, 500); tone(80, 0.15, 'square', 0.2, 200); },
    tilt() { tone(70, 0.7, 'square', 0.3); tone(74, 0.7, 'square', 0.3); },
    jackpot() { arp([523, 659, 784, 1046, 1318, 1568], 0.07, 'square', 0.13); },
    multiball() { arp([392, 523, 659, 784, 659, 784, 1046, 1318], 0.09, 'sawtooth', 0.11); },
    bonus() { arp([784, 988, 1175], 0.06, 'triangle', 0.15); },
    skill() { arp([1046, 1318, 1568, 2093], 0.05, 'square', 0.12); },
  };
})();

/* =====================================================================
   MIZA — geometrija
   ===================================================================== */
const segs = [];      // daljice / kapsule (stene, tarče, slingshoti, vrata)
const bumpers = [];   // pop bumperji
const sensors = [];   // nevidna stikala (kanali, orbit, spinner, talilnica)
const slings = [];

function addSeg(ax, ay, bx, by, o = {}) {
  const s = {
    ax, ay, bx, by,
    r: o.r ?? 2, e: o.e ?? 0.4, kind: o.kind || 'wall',
    active: true, flash: 0, cool: 0, data: o.data || null, oneWay: !!o.oneWay,
    nx: 0, ny: 0, draw: o.draw ?? true,
  };
  if (s.oneWay) {            // trdna stran je normala (dy, -dx)
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
    s.nx = dy / l; s.ny = -dx / l;
  }
  segs.push(s);
  return s;
}
function addPoly(pts, o) {
  for (let i = 0; i < pts.length - 1; i++) addSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o);
}

function buildTable() {
  // zgornji lok čez celo širino (vključno z izstrelitvenim kanalom)
  const arc = [];
  for (let i = 0; i <= 64; i++) {
    const a = Math.PI + Math.PI * i / 64;
    arc.push([300 + 280 * Math.cos(a), 300 + 280 * Math.sin(a)]);
  }
  addSeg(20, 1040, 20, 300, { e: 0.35 });
  addPoly(arc, { e: 0.3 });
  addSeg(580, 300, 580, 1040, { e: 0.35 });

  // izstrelitveni kanal + enosmerna vrata
  addSeg(545, 1040, 545, 335, { r: 3 });
  addSeg(545, 335, 580, 300, { oneWay: true, kind: 'gate', e: 0.25 });
  addSeg(545, PLUNGER_Y, 580, PLUNGER_Y, { kind: 'plunger', e: 0.05, r: 0, draw: false });

  // levi orbit ("iztiskovalna linija") z enosmernimi vrati na vrhu
  addSeg(20, 338, 68, 375, { oneWay: true, kind: 'gate', e: 0.25 });
  addPoly([[68, 375], [68, 575], [95, 620]], { r: 3 });

  // zgornji kanali A-L-U
  for (const x of [215, 265, 315, 365]) addSeg(x, 92, x, 135, { r: 4, e: 0.5 });

  // pop bumperji ("Al" peči)
  bumpers.push({ x: 235, y: 215, r: 26, flash: 0, cool: 0 });
  bumpers.push({ x: 335, y: 215, r: 26, flash: 0, cool: 0 });
  bumpers.push({ x: 285, y: 292, r: 26, flash: 0, cool: 0 });

  // slingshoti (stiskalnici)
  const mk = (A, B, C) => {
    addSeg(A[0], A[1], B[0], B[1], { r: 3, e: 0.6 });
    addSeg(B[0], B[1], C[0], C[1], { r: 3, e: 0.6 });
    const kick = addSeg(A[0], A[1], C[0], C[1], { r: 3, e: 0.6, kind: 'sling', draw: false });
    slings.push({ A, B, C, kick });
  };
  mk([100, 705], [100, 790], [165, 828]);
  mk([465, 705], [465, 790], [400, 828]);

  // outlane pregrade + vodila do flipperjev
  addPoly([[55, 720], [55, 815], [198, 870]], { r: 3 });
  addPoly([[510, 720], [510, 815], [367, 870]], { r: 3 });

  // BUG drop tarče (Alcad kontrola kakovosti)
  for (let i = 0; i < 3; i++) {
    const y0 = 560 + i * 45;
    addSeg(533, y0, 533, y0 + 36, { kind: 'drop', r: 5, e: 0.3, data: { idx: i }, draw: false });
  }

  // senzorji
  ['A', 'L', 'U'].forEach((ch, i) => sensors.push({ kind: 'lane', idx: i, x: 240 + 50 * i, y: 113, r: 13, inside: new Set() }));
  sensors.push({ kind: 'orbit', x: 40, y: 312, r: 18, inside: new Set() });
  sensors.push({ kind: 'spinner', x: 44, y: 500, r: 20, inside: new Set() });
  sensors.push({ kind: 'scoop', x: 490, y: 470, r: 15, inside: new Set() });
  sensors.push({ kind: 'inlane', x: 78, y: 760, r: 14, inside: new Set() });
  sensors.push({ kind: 'inlane', x: 487, y: 760, r: 14, inside: new Set() });
  sensors.push({ kind: 'outlane', x: 37, y: 800, r: 14, inside: new Set() });
  sensors.push({ kind: 'outlane', x: 528, y: 800, r: 14, inside: new Set() });
}

const flippers = [
  { side: 'L', px: 195, py: 880, len: 74, rest: 0.52, up: -0.45, angle: 0.52, omega: 0, r1: 13, r2: 7, pressed: false },
  { side: 'R', px: 370, py: 880, len: 74, rest: Math.PI - 0.52, up: Math.PI + 0.45, angle: Math.PI - 0.52, omega: 0, r1: 13, r2: 7, pressed: false },
];
const spinner = { x: 44, y: 500, angle: 0, w: 0, half: 0 };
const plungerSeg = () => segs.find(s => s.kind === 'plunger');

/* =====================================================================
   STANJE IGRE
   ===================================================================== */
let time = 0;
let nextBallId = 1;
const particles = [];
const popups = [];
let shake = 0;

const game = {
  state: 'attract', paused: false,
  score: 0, ballNum: 0, balls: [], timers: [], pending: 0,
  mult: 1, bonus: 0, alu: [false, false, false],
  lockLit: false, locks: 0, multiball: false, jackpotValue: 500000,
  kickback: true, spins: 0, orbits: 0, extraLit: false, extraGiven: false, extraBalls: 0,
  ballSaveUntil: 0, tiltMeter: 0, tiltWarn: 0, tilted: false,
  skillLane: 0, skillArmed: false, skillUntil: 0,
  lastOrbit: -99, combo: 0, plungerPull: 0, plungerHeld: false,
  stillTime: 0, msg: null, highScores: loadHS(),
};

function loadHS() {
  try {
    const v = JSON.parse(localStorage.getItem('aluPinballHS') || '[]');
    if (Array.isArray(v)) return v.slice(0, 5);
  } catch (e) { /* ignore */ }
  return [];
}
function saveHS() {
  try { localStorage.setItem('aluPinballHS', JSON.stringify(game.highScores)); } catch (e) { /* ignore */ }
}
const fmt = n => Math.round(n).toLocaleString('sl-SI');

function later(delay, fn) { game.timers.push({ t: delay, fn }); }
function spawnLater(delay, fn) {
  game.pending++;
  later(delay, () => { game.pending--; fn(); });
}

function showMsg(text, sub = '', dur = 2, color = '#ffab3d') {
  game.msg = { text, sub, dur, t: 0, color };
}
function popup(x, y, text, color = '#ffd27a') {
  popups.push({ x, y, text, t: 0, color });
}
function burst(x, y, color, n = 12, speed = 300) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = speed * (0.3 + Math.random());
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.4, t: 0, color });
  }
}
function addScore(pts, x, y, bonusPts = 0) {
  if (game.tilted || game.state !== 'play') return;
  game.score += pts;
  game.bonus += bonusPts;
  if (x !== undefined && pts >= 1000) popup(x, y, '+' + fmt(pts));
}

function newBall(x, y) {
  const b = { id: nextBallId++, x, y, vx: 0, vy: 0, captured: false, scoopCool: 0, trail: [] };
  game.balls.push(b);
  return b;
}
const inPlunger = b => b.x > 546 && b.y > 880 && !b.captured;

function serveBall() {
  newBall(562.5, PLUNGER_Y - BR - 1);
  game.skillLane = Math.floor(Math.random() * 3);
  game.skillArmed = true;
  game.skillUntil = 0;
}
function autoLaunch() {
  const b = newBall(562.5, PLUNGER_Y - BR - 1);
  b.vy = -2300 - Math.random() * 300;
  Sfx.launch(0.7);
}
function ejectFromScoop(b) {
  if (!b) b = newBall(490, 470);
  b.captured = false;
  b.x = 490; b.y = 470;
  b.vx = -380 - Math.random() * 120;
  b.vy = -300 - Math.random() * 100;
  b.scoopCool = 0.6;
  Sfx.kick();
  burst(490, 470, '#ff8a2a', 18, 260);
  shake = Math.max(shake, 5);
}

function startGame() {
  Sfx.init();
  Object.assign(game, {
    state: 'play', paused: false, score: 0, ballNum: 1, balls: [], timers: [], pending: 0,
    jackpotValue: 500000, kickback: true, spins: 0, orbits: 0, extraLit: false, extraGiven: false,
    extraBalls: 0, locks: 0, lockLit: false, multiball: false,
  });
  for (const s of segs) if (s.kind === 'drop') s.active = true;
  resetBallState();
  hideOverlay();
  serveBall();
  showMsg('ŽOGA 1', 'drži PRESLEDEK za izstrelitev', 2.5);
}

function resetBallState() {
  Object.assign(game, {
    mult: 1, bonus: 0, alu: [false, false, false], tiltMeter: 0, tiltWarn: 0, tilted: false,
    ballSaveUntil: 0, combo: 0, lastOrbit: -99, plungerPull: 0, multiball: false, stillTime: 0,
  });
  for (const s of sensors) s.inside.clear();
}

/* ---------------- dogodki na mizi ---------------- */
function onBumper(c) {
  c.flash = 1;
  addScore(1000, c.x, c.y - 30, 200);
  Sfx.bumper();
  burst(c.x, c.y, '#ff9a3a', 10, 320);
  shake = Math.max(shake, 3);
  game.skillArmed = false;
}
function onSling(s, x, y) {
  s.flash = 1;
  addScore(110, x, y, 100);
  Sfx.sling();
  burst(x, y, '#ffcf6a', 8, 250);
  shake = Math.max(shake, 2);
}
function onDrop(s) {
  s.active = false;
  addScore(5000, s.ax - 20, s.ay + 18, 2000);
  Sfx.target();
  burst(s.ax, (s.ay + s.by) / 2, '#39ff88', 12, 280);
  const drops = segs.filter(d => d.kind === 'drop');
  if (drops.every(d => !d.active)) {
    addScore(25000, 480, 620, 5000);
    if (!game.multiball) {
      game.lockLit = true;
      showMsg('BUG ODPRAVLJEN!', CFG.firmaB + ' hotfix → LOCK v talilnici', 2.5, '#39ff88');
    } else {
      showMsg('BUG ODPRAVLJEN!', 'jackpot +100.000', 2, '#39ff88');
      game.jackpotValue += 100000;
    }
    Sfx.bonus();
    later(1.2, () => drops.forEach(d => { d.active = true; }));
  }
}
function onLane(idx, b) {
  const x = 240 + 50 * idx;
  if (game.skillArmed && idx === game.skillLane && time < game.skillUntil + 6) {
    addScore(100000, x, 150, 5000);
    showMsg('SKILL SHOT!', '+100.000', 2, '#ffffff');
    Sfx.skill();
    burst(x, 115, '#ffffff', 25, 400);
  }
  game.skillArmed = false;
  if (!game.alu[idx]) {
    game.alu[idx] = true;
    addScore(2000, x, 150, 1000);
    Sfx.lane();
  } else {
    addScore(500, x, 150, 200);
    Sfx.lane();
  }
  if (game.alu.every(Boolean)) {
    game.alu = [false, false, false];
    if (game.mult < 6) {
      game.mult++;
      showMsg('BONUS ×' + game.mult, 'ALU kanali zaprti', 1.8, '#6fd3ff');
    } else {
      addScore(50000, 290, 160);
      showMsg('ALU MAX', '+50.000', 1.8, '#6fd3ff');
    }
    Sfx.bonus();
  }
}
function onOrbit(b) {
  if (b.vy >= 0) return;                       // šteje samo navzgor
  const now = time;
  game.combo = (now - game.lastOrbit < 4) ? game.combo + 1 : 0;
  game.lastOrbit = now;
  game.orbits++;
  if (game.multiball) {
    addScore(game.jackpotValue, 120, 300, 10000);
    showMsg('JACKPOT!', fmt(game.jackpotValue), 2.2, '#ffe14a');
    game.jackpotValue += 250000;
    Sfx.jackpot();
    burst(40, 312, '#ffe14a', 40, 500);
    shake = Math.max(shake, 8);
    return;
  }
  const pts = 15000 * (game.combo + 1);
  addScore(pts, 110, 300, 3000);
  if (game.combo > 0) showMsg('COMBO ×' + (game.combo + 1), 'iztiskovalna linija', 1.5, '#6fd3ff');
  else showMsg('IZTISKOVANJE', '+' + fmt(pts), 1.2, '#6fd3ff');
  Sfx.lane();
  if (game.orbits >= 5 && !game.extraGiven && !game.extraLit) {
    game.extraLit = true;
    showMsg('EXTRA BALL PRIŽGAN', 'zadeni talilnico', 2.2, '#ff5ad1');
  }
}
function onScoop(b) {
  if (b.scoopCool > 0 || b.captured) return;
  b.captured = true; b.vx = 0; b.vy = 0; b.x = 490; b.y = 470;
  Sfx.scoop();
  shake = Math.max(shake, 4);

  if (game.tilted) { later(1, () => ejectFromScoop(b)); return; }

  if (game.extraLit) {
    game.extraLit = false; game.extraGiven = true; game.extraBalls++;
    showMsg('EXTRA BALL!', 'še ena žogica', 2.2, '#ff5ad1');
    Sfx.skill();
  }

  if (game.multiball) {
    const v = Math.round(game.jackpotValue / 2);
    addScore(v, 490, 430, 5000);
    showMsg('TALILNICA JACKPOT', fmt(v), 1.8, '#ffe14a');
    Sfx.jackpot();
    later(1, () => ejectFromScoop(b));
    return;
  }

  if (game.lockLit) {
    game.lockLit = false;
    game.locks++;
    Sfx.lock();
    if (game.locks < 2) {
      game.balls.splice(game.balls.indexOf(b), 1);   // žoga "zaklenjena"
      showMsg('ŽOGA ZAKLENJENA', 'še 1 lock za MULTIBALL', 2.2, '#39ff88');
      spawnLater(1.6, serveBall);
    } else {
      game.locks = 0;
      startMultiball(b);
    }
    return;
  }

  addScore(25000, 490, 430, 3000);
  showMsg('TALILNICA', '+25.000', 1.2, '#ff8a2a');
  later(1.1, () => ejectFromScoop(b));
}
function startMultiball(scoopBall) {
  game.multiball = true;
  game.ballSaveUntil = time + 15;
  showMsg('MULTIBALL!', 'talilnica polna — streljaj orbit za JACKPOT', 3, '#ffe14a');
  Sfx.multiball();
  shake = 10;
  later(1.5, () => ejectFromScoop(scoopBall));
  spawnLater(2.2, autoLaunch);
  spawnLater(3.2, () => ejectFromScoop(null));
}
function onSpinnerPass(b) {
  spinner.w = Math.min(60, Math.abs(b.vy) / 25 + 6);
}
function onSensor(s, b) {
  switch (s.kind) {
    case 'lane': onLane(s.idx, b); break;
    case 'orbit': onOrbit(b); break;
    case 'spinner': onSpinnerPass(b); break;
    case 'scoop': onScoop(b); break;
    case 'inlane': addScore(1000, s.x, s.y - 20, 500); Sfx.lane(); break;
    case 'outlane': addScore(5000, s.x, s.y - 20, 500); break;
  }
}

function drain(b) {
  game.balls.splice(game.balls.indexOf(b), 1);
  for (const s of sensors) s.inside.delete(b.id);
  if (game.state !== 'play') return;
  Sfx.drain();

  if (time < game.ballSaveUntil && !game.tilted) {
    if (game.multiball) spawnLater(0.8, autoLaunch);
    else {
      showMsg('ŠE ENKRAT!', 'ball save', 1.8, '#6fd3ff');
      spawnLater(1, serveBall);
      game.ballSaveUntil = 0;
    }
    return;
  }

  const live = game.balls.length + game.pending;
  if (live === 0) endOfBall();
  else if (game.multiball && live === 1) {
    game.multiball = false;
    showMsg('KONEC MULTIBALLA', 'jackpot ostane: ' + fmt(game.jackpotValue), 1.8);
  }
}

function endOfBall() {
  game.state = 'bonus';
  const bonus = game.tilted ? 0 : game.bonus * game.mult;
  if (game.tilted) showMsg('TILT', 'brez bonusa', 2.5, '#ff4a4a');
  else showMsg('BONUS ' + fmt(bonus), fmt(game.bonus) + ' × ' + game.mult, 2.5);
  game.score += bonus;
  if (!game.tilted) Sfx.bonus();
  later(2.7, () => {
    resetBallState();
    if (game.extraBalls > 0) {
      game.extraBalls--;
      game.state = 'play';
      showMsg('ŠE ENA ŽOGA', 'shoot again', 2);
      serveBall();
      return;
    }
    game.ballNum++;
    if (game.ballNum > CFG.steviloZogic) { gameOver(); return; }
    game.state = 'play';
    showMsg('ŽOGA ' + game.ballNum, '', 1.8);
    serveBall();
  });
}

function gameOver() {
  game.state = 'over';
  game.msg = null;
  Sfx.drain();
  const hs = game.highScores;
  const qualifies = game.score > 0 && (hs.length < 5 || game.score > hs[hs.length - 1].score);
  showGameOver(qualifies);
}

function nudge() {
  if (game.state !== 'play' || game.tilted) return;
  for (const b of game.balls) {
    if (b.captured || inPlunger(b)) continue;
    b.vx += (Math.random() - 0.5) * 260;
    b.vy -= 180;
  }
  shake = Math.max(shake, 9);
  Sfx.kick();
  game.tiltMeter += 1;
  if (game.tiltMeter > 2.6) {
    game.tiltMeter = 1;
    game.tiltWarn++;
    if (game.tiltWarn >= 3) {
      game.tilted = true;
      game.lockLit = false;
      showMsg('TILT', 'flipperji izklopljeni', 3, '#ff4a4a');
      Sfx.tilt();
    } else {
      showMsg('POZOR', 'opozorilo ' + game.tiltWarn + '/2', 1.2, '#ff4a4a');
    }
  }
}

/* =====================================================================
   FIZIKA
   ===================================================================== */
let _cx = 0, _cy = 0, _ct = 0;
function closest(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  _cx = ax + dx * t; _cy = ay + dy * t; _ct = t;
}

// vrne hitrost udarca (0 = ni bilo udarca)
function resolve(b, nx, ny, pen, e, svx = 0, svy = 0) {
  b.x += nx * pen; b.y += ny * pen;
  let rvx = b.vx - svx, rvy = b.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const ee = -vn < 60 ? 0 : e;                 // mirovanje brez tresenja
  const jn = -(1 + ee) * vn;
  rvx += jn * nx; rvy += jn * ny;
  // Coulombovo trenje (majhno — žogica se kotali)
  const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
  const dvt = Math.min(Math.abs(vt), 0.06 * jn) * Math.sign(vt);
  rvx -= dvt * tx; rvy -= dvt * ty;
  b.vx = rvx + svx; b.vy = rvy + svy;
  return -vn;
}

function collideSeg(b, s) {
  if (!s.active) return;
  closest(b.x, b.y, s.ax, s.ay, s.bx, s.by);
  const dx = b.x - _cx, dy = b.y - _cy, rr = BR + s.r, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  if (s.oneWay && ((b.x - s.ax) * s.nx + (b.y - s.ay) * s.ny) < 0) return;
  const d = Math.sqrt(d2);
  if (d < 1e-6) return;
  const nx = dx / d, ny = dy / d;
  const cx = _cx, cy = _cy;
  const imp = resolve(b, nx, ny, rr - d, s.e);
  if (imp <= 0) return;
  if (s.kind === 'sling') {
    if (imp > 90 && s.cool <= 0) {
      b.vx += nx * 900; b.vy += ny * 900;
      s.cool = 0.12;
      onSling(s, cx, cy);
    }
  } else if (s.kind === 'drop') {
    if (imp > 40) onDrop(s);
  } else if (imp > 450) Sfx.wall(imp);
}

function collideBumper(b, c) {
  const dx = b.x - c.x, dy = b.y - c.y, rr = BR + c.r, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2);
  if (d < 1e-6) return;
  const nx = dx / d, ny = dy / d;
  resolve(b, nx, ny, rr - d, 0.5);
  if (c.cool <= 0) {
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 1100) { b.vx += nx * (1100 - vn); b.vy += ny * (1100 - vn); }
    c.cool = 0.06;
    onBumper(c);
  }
}

function updateFlipper(f, dt) {
  const on = f.pressed && !game.tilted && game.state === 'play';
  const target = on ? f.up : f.rest;
  const speed = on ? 38 : 18;
  const diff = target - f.angle, max = speed * dt;
  const step = diff > max ? max : diff < -max ? -max : diff;
  f.angle += step;
  f.omega = step / dt;
}

function collideFlipper(b, f) {
  const tx = f.px + Math.cos(f.angle) * f.len, ty = f.py + Math.sin(f.angle) * f.len;
  closest(b.x, b.y, f.px, f.py, tx, ty);
  const rr = BR + f.r1 + (f.r2 - f.r1) * _ct;
  const dx = b.x - _cx, dy = b.y - _cy, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2);
  if (d < 1e-6) return;
  // hitrost površine flipperja v točki stika
  const svx = -f.omega * (_cy - f.py), svy = f.omega * (_cx - f.px);
  resolve(b, dx / d, dy / d, rr - d, 0.32, svx, svy);
}

function collideBalls() {
  const bs = game.balls;
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    if (a.captured) continue;
    for (let j = i + 1; j < bs.length; j++) {
      const c = bs[j];
      if (c.captured) continue;
      const dx = a.x - c.x, dy = a.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 >= 4 * BR * BR || d2 < 1e-9) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = (2 * BR - d) / 2;
      a.x += nx * pen; a.y += ny * pen; c.x -= nx * pen; c.y -= ny * pen;
      const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
      if (rel < 0) {
        const j2 = -(1.9) * rel / 2;
        a.vx += j2 * nx; a.vy += j2 * ny; c.vx -= j2 * nx; c.vy -= j2 * ny;
      }
    }
  }
}

function checkSensors(b) {
  for (const s of sensors) {
    const inside = (b.x - s.x) ** 2 + (b.y - s.y) ** 2 < s.r * s.r;
    const was = s.inside.has(b.id);
    if (inside && !was) { s.inside.add(b.id); onSensor(s, b); }
    else if (!inside && was) s.inside.delete(b.id);
  }
}

function physicsStep(dt) {
  for (const f of flippers) updateFlipper(f, dt);
  for (const b of game.balls) {
    if (b.captured) continue;
    b.vy += GRAV * dt;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAXV) { b.vx *= MAXV / sp; b.vy *= MAXV / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    for (const s of segs) collideSeg(b, s);
    for (const c of bumpers) collideBumper(b, c);
    for (const f of flippers) collideFlipper(b, f);
  }
  collideBalls();
  for (const b of game.balls.slice()) if (!b.captured) checkSensors(b);
}

/* =====================================================================
   POSODOBITEV
   ===================================================================== */
function update(dt) {
  time += dt;

  // časovniki
  if (game.timers.length) {
    const due = [];
    for (const t of game.timers) { t.t -= dt; if (t.t <= 0) due.push(t); }
    if (due.length) {
      game.timers = game.timers.filter(t => t.t > 0);
      due.forEach(t => t.fn());
    }
  }

  // plunger
  const ps = plungerSeg();
  if (game.plungerHeld) game.plungerPull = Math.min(1, game.plungerPull + dt * 1.25);
  ps.ay = ps.by = PLUNGER_Y + game.plungerPull * 28;

  // fizika
  const n = Math.max(1, Math.round(dt / STEP));
  const sdt = dt / n;
  for (let i = 0; i < n; i++) physicsStep(sdt);

  // ohladitve
  for (const s of segs) { if (s.cool > 0) s.cool -= dt; if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 4); }
  for (const c of bumpers) { if (c.cool > 0) c.cool -= dt; if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 4); }
  for (const sl of slings) sl.flash = sl.kick.flash;

  // žogice: drain, kickback, sledi
  let allStill = game.balls.length > 0;
  for (const b of game.balls.slice()) {
    if (b.scoopCool > 0) b.scoopCool -= dt;
    if (b.captured) { allStill = false; continue; }
    b.trail.push(b.x, b.y);
    if (b.trail.length > 20) b.trail.splice(0, 2);
    if (b.y > H + 30) { drain(b); continue; }
    if (b.x < 55 && b.y > 880 && b.vy > 0 && game.kickback && !game.tilted && game.state === 'play') {
      b.x = 37; b.y = 900; b.vx = 0; b.vy = -2100;
      game.kickback = false;
      showMsg('KICKBACK!', 'spinner ga spet prižge', 1.5, '#39ff88');
      Sfx.kick(); burst(37, 920, '#39ff88', 20, 350); shake = Math.max(shake, 6);
    }
    if (inPlunger(b) || Math.hypot(b.vx, b.vy) > 25) allStill = false;
  }

  // iskanje zataknjene žogice
  if (allStill && game.state === 'play') {
    game.stillTime += dt;
    if (game.stillTime > 3) {
      game.stillTime = 0;
      for (const b of game.balls) if (!b.captured) { b.vy = -700; b.vx = (Math.random() - 0.5) * 500; }
    }
  } else game.stillTime = 0;

  // skill shot okno se začne ob izstrelitvi
  if (game.skillArmed && game.skillUntil === 0 && game.balls.some(b => !inPlunger(b) && b.y < 880)) game.skillUntil = time;
  if (game.skillArmed && game.skillUntil > 0 && time > game.skillUntil + 6) game.skillArmed = false;

  // spinner
  if (spinner.w > 0.2) {
    spinner.angle += spinner.w * dt;
    spinner.w *= Math.exp(-1.4 * dt);
    const half = Math.floor(spinner.angle / Math.PI);
    if (half !== spinner.half) {
      spinner.half = half;
      addScore(150, undefined, undefined, 50);
      game.spins++;
      Sfx.spin();
      if (game.spins % 20 === 0 && !game.kickback && game.state === 'play') {
        game.kickback = true;
        showMsg('KICKBACK AKTIVEN', 'valjarna je napolnila', 1.5, '#39ff88');
      }
    }
  } else spinner.w = 0;

  // tilt meter
  game.tiltMeter = Math.max(0, game.tiltMeter - dt * 0.6);

  // efekti
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    if (p.t > p.life) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) { popups[i].t += dt; if (popups[i].t > 1) popups.splice(i, 1); }
  if (game.msg) { game.msg.t += dt; if (game.msg.t > game.msg.dur) game.msg = null; }
  shake *= Math.exp(-10 * dt);
  if (shake < 0.1) shake = 0;
}

/* =====================================================================
   IZRIS
   ===================================================================== */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1, dpr = 1, bgLayer = null;

function resize() {
  const hud = document.getElementById('hud').offsetHeight;
  const availH = window.innerHeight - hud - 10;
  const availW = window.innerWidth - 16;
  scale = Math.max(0.2, Math.min(availW / W, availH / H));
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  buildStatic();
}

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function buildStatic() {
  bgLayer = document.createElement('canvas');
  bgLayer.width = canvas.width; bgLayer.height = canvas.height;
  const g = bgLayer.getContext('2d');
  const s = scale * dpr;
  g.setTransform(s, 0, 0, s, 0, 0);

  // podlaga — brušen aluminij v temi
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#18212e'); grd.addColorStop(0.5, '#111824'); grd.addColorStop(1, '#0a0e15');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const r = rng(7);
  for (let i = 0; i < 700; i++) {
    g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)';
    g.lineWidth = 0.7;
    const y = r() * H, x = r() * W;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + r() * 140, y); g.stroke();
  }

  // izven mize
  g.beginPath();
  g.rect(0, 0, W, H);
  g.moveTo(20, H); g.lineTo(20, 300); g.arc(300, 300, 280, Math.PI, TAU); g.lineTo(580, H); g.closePath();
  g.fillStyle = '#04060a'; g.fill('evenodd');

  // izstrelitveni kanal in orbit pas
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(545, 300, 35, 700);
  g.fillRect(20, 340, 48, 260);

  // dekoracija: element Al
  g.save();
  g.strokeStyle = 'rgba(111,211,255,0.16)'; g.lineWidth = 2;
  g.strokeRect(227, 415, 110, 110);
  g.fillStyle = 'rgba(111,211,255,0.16)';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 60px "Arial Black", Arial, sans-serif'; g.fillText('Al', 282, 474);
  g.font = '700 15px Consolas, monospace';
  g.textAlign = 'left'; g.fillText('13', 235, 430);
  g.textAlign = 'center'; g.fillText('26,98', 282, 512);
  g.font = '900 30px "Arial Black", Arial, sans-serif';
  g.fillStyle = 'rgba(255,171,61,0.14)';
  g.fillText(CFG.firmaA, 282, 565);
  g.font = '700 16px Consolas, monospace';
  g.fillStyle = 'rgba(111,211,255,0.16)';
  g.fillText('× ' + CFG.firmaB + ' ×', 282, 594);
  g.restore();

  // napisi ob elementih
  const label = (txt, x, y, rot = 0, size = 10, col = 'rgba(217,226,236,0.35)') => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.font = `700 ${size}px Consolas, monospace`; g.fillStyle = col;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0); g.restore();
  };
  label('IZTISKOVALNA LINIJA', 44, 430, -Math.PI / 2, 10);
  label('KONTROLA KAKOVOSTI', 517, 622, -Math.PI / 2, 9, 'rgba(57,255,136,0.35)');
  label('TALILNICA', 490, 440, 0, 11, 'rgba(255,138,42,0.6)');
  label('IZSTRELITEV', 562, 700, -Math.PI / 2, 10);
  label('BONUS', 282, 640, 0, 10);

  // stene z neon sijem
  g.lineCap = 'round';
  const drawWalls = (core) => {
    for (const sg of segs) {
      if (!sg.draw) continue;
      const gate = sg.kind === 'gate';
      g.strokeStyle = core ? 'rgba(255,255,255,0.75)' : gate ? '#ffab3d' : '#6fd3ff';
      g.lineWidth = core ? 1.2 : Math.max(3, sg.r * 2);
      g.beginPath(); g.moveTo(sg.ax, sg.ay); g.lineTo(sg.bx, sg.by); g.stroke();
    }
  };
  g.shadowColor = '#6fd3ff'; g.shadowBlur = 12;
  drawWalls(false);
  g.shadowBlur = 0;
  drawWalls(true);

  // podlaga talilnice
  g.fillStyle = '#020305';
  g.beginPath(); g.arc(490, 470, 17, 0, TAU); g.fill();
}

function blink(rate = 4) { return Math.floor(time * rate) % 2 === 0; }

function light(x, y, r, on, color, txt, txtSize = 10) {
  ctx.save();
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
  ctx.fillStyle = on ? color : 'rgba(255,255,255,0.06)';
  ctx.strokeStyle = on ? '#fff' : color;
  ctx.globalAlpha = on ? 1 : 0.55;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  if (txt) {
    ctx.fillStyle = on ? '#0b0f16' : color;
    ctx.font = `800 ${txtSize}px Consolas, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y + 0.5);
  }
  ctx.restore();
}

function drawInserts() {
  // A L U
  ['A', 'L', 'U'].forEach((ch, i) => {
    const x = 240 + 50 * i;
    const skill = game.skillArmed && game.skillLane === i && blink(6);
    light(x, 160, 11, game.alu[i] || skill, skill ? '#ffffff' : '#6fd3ff', ch, 12);
  });
  // bonus multiplikator
  for (let k = 2; k <= 6; k++) light(202 + (k - 2) * 40, 660, 11, game.mult >= k, '#6fd3ff', k + '×', 9);
  // orbit puščica
  const jp = game.multiball, combo = time - game.lastOrbit < 4 && game.state === 'play';
  const arrowOn = (jp || combo || game.extraLit) && blink(jp ? 6 : 3);
  ctx.save();
  ctx.translate(104, 640); ctx.rotate(-2.3);
  ctx.fillStyle = arrowOn ? (jp ? '#ffe14a' : '#6fd3ff') : 'rgba(111,211,255,0.12)';
  if (arrowOn) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16; }
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-12, -12); ctx.lineTo(-6, 0); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (jp) {
    ctx.save(); ctx.font = '800 11px Consolas, monospace'; ctx.fillStyle = '#ffe14a'; ctx.textAlign = 'center';
    ctx.fillText('JACKPOT', 118, 672); ctx.restore();
  }
  // talilnica: lock lučki in stanje
  light(472, 500, 7, game.locks >= 1, '#39ff88');
  light(490, 504, 7, game.lockLit && blink(4), '#39ff88');
  light(508, 500, 7, game.extraLit && blink(3), '#ff5ad1');
  ctx.save(); ctx.font = '700 9px Consolas, monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = game.lockLit ? '#39ff88' : game.extraLit ? '#ff5ad1' : 'rgba(217,226,236,0.3)';
  ctx.fillText(game.lockLit ? 'LOCK' : game.extraLit ? 'EXTRA BALL' : game.multiball ? 'JACKPOT/2' : 'LOCK · EB', 490, 524);
  ctx.restore();
  // kickback
  light(37, 940, 9, game.kickback, '#39ff88', 'K', 10);
  // ball save
  const saving = time < game.ballSaveUntil && game.state === 'play';
  light(282, 978, 9, saving && blink(saving && game.ballSaveUntil - time < 3 ? 8 : 3), '#6fd3ff', 'S', 10);
}

function drawScoop() {
  const glow = game.lockLit ? '#39ff88' : game.multiball ? '#ffe14a' : '#ff8a2a';
  ctx.save();
  const gr = ctx.createRadialGradient(490, 470, 2, 490, 470, 17);
  gr.addColorStop(0, '#000'); gr.addColorStop(0.7, '#1a0a00'); gr.addColorStop(1, glow);
  ctx.fillStyle = gr; ctx.shadowColor = glow; ctx.shadowBlur = (game.lockLit ? 20 : 10) + Math.sin(time * 6) * 5;
  ctx.beginPath(); ctx.arc(490, 470, 17, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawBumpers() {
  for (const c of bumpers) {
    const f = c.flash, r = c.r + f * 3;
    ctx.save();
    ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 14 + f * 30;
    const gr = ctx.createRadialGradient(c.x - 7, c.y - 7, 2, c.x, c.y, r);
    gr.addColorStop(0, f > 0.15 ? '#fff6d6' : '#ffc066');
    gr.addColorStop(0.55, f > 0.15 ? '#ff9a2a' : '#e85d00');
    gr.addColorStop(1, '#5a1600');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3; ctx.strokeStyle = '#d9e2ec'; ctx.stroke();
    ctx.fillStyle = 'rgba(30,8,0,0.85)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 17px "Arial Black", Arial, sans-serif'; ctx.fillText('Al', c.x, c.y + 2);
    ctx.font = '700 8px Consolas, monospace'; ctx.fillText('13', c.x - 10, c.y - 12);
    ctx.restore();
  }
}

function drawSlings() {
  for (const s of slings) {
    const f = s.flash;
    ctx.save();
    ctx.fillStyle = `rgba(255,140,40,${0.08 + f * 0.5})`;
    ctx.beginPath(); ctx.moveTo(...s.A); ctx.lineTo(...s.B); ctx.lineTo(...s.C); ctx.closePath(); ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = f > 0.1 ? '#fff2cc' : '#ffab3d';
    ctx.shadowColor = '#ffab3d'; ctx.shadowBlur = 10 + f * 25;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(...s.A); ctx.lineTo(...s.C); ctx.stroke();
    ctx.restore();
  }
}

function drawTargets() {
  for (const s of segs) {
    if (s.kind !== 'drop') continue;
    const ch = 'BUG'[s.data.idx], y = s.ay, h = s.by - s.ay;
    ctx.save();
    if (s.active) {
      ctx.shadowColor = '#39ff88'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#39ff88';
      ctx.fillRect(s.ax - 5, y - 2, 10, h + 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#05130b';
      ctx.font = '900 11px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, s.ax, y + h / 2);
    } else {
      ctx.strokeStyle = 'rgba(57,255,136,0.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(s.ax - 5, y - 2, 10, h + 4);
    }
    ctx.restore();
  }
}

function drawSpinner() {
  const h = Math.abs(Math.cos(spinner.angle)) * 7 + 1.5;
  ctx.save();
  ctx.fillStyle = '#cfd8e3'; ctx.shadowColor = '#6fd3ff'; ctx.shadowBlur = spinner.w > 1 ? 14 : 4;
  ctx.fillRect(spinner.x - 22, spinner.y - h / 2, 44, h);
  ctx.fillStyle = '#ffab3d';
  ctx.fillRect(spinner.x - 25, spinner.y - 2, 3, 4); ctx.fillRect(spinner.x + 22, spinner.y - 2, 3, 4);
  ctx.restore();
}

function drawFlippers() {
  for (const f of flippers) {
    const a = f.angle, tx = f.px + Math.cos(a) * f.len, ty = f.py + Math.sin(a) * f.len;
    const d1 = a - Math.PI / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(f.px + Math.cos(d1) * f.r1, f.py + Math.sin(d1) * f.r1);
    ctx.lineTo(tx + Math.cos(d1) * f.r2, ty + Math.sin(d1) * f.r2);
    ctx.arc(tx, ty, f.r2, d1, d1 + Math.PI, false);
    ctx.lineTo(f.px + Math.cos(d1 + Math.PI) * f.r1, f.py + Math.sin(d1 + Math.PI) * f.r1);
    ctx.arc(f.px, f.py, f.r1, d1 + Math.PI, d1 + TAU, false);
    ctx.closePath();
    const gr = ctx.createLinearGradient(f.px, f.py - 14, f.px, f.py + 14);
    gr.addColorStop(0, '#f4f7fb'); gr.addColorStop(0.5, '#9aa8b8'); gr.addColorStop(1, '#4a5666');
    ctx.fillStyle = gr;
    ctx.shadowColor = game.tilted ? '#ff4a4a' : '#ffab3d'; ctx.shadowBlur = f.pressed ? 20 : 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = game.tilted ? '#ff4a4a' : '#ffab3d'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1a222d';
    ctx.beginPath(); ctx.arc(f.px, f.py, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawPlunger() {
  const top = PLUNGER_Y + game.plungerPull * 28;
  ctx.save();
  ctx.fillStyle = '#9aa8b8';
  ctx.fillRect(549, top, 27, 6);
  ctx.strokeStyle = '#6b7889'; ctx.lineWidth = 2;
  ctx.beginPath();
  const n = 6, bottom = 1000, len = bottom - top - 6;
  for (let i = 0; i <= n; i++) {
    const y = top + 6 + (len * i) / n, x = i % 2 ? 555 : 570;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  if (game.plungerPull > 0) {
    ctx.fillStyle = `hsl(${40 - game.plungerPull * 40},100%,55%)`;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    ctx.fillRect(583, 990 - game.plungerPull * 120, 5, game.plungerPull * 120);
  }
  ctx.restore();
}

function drawBalls() {
  for (const b of game.balls) {
    if (b.captured) continue;
    // sled
    const t = b.trail;
    for (let i = 0; i < t.length; i += 2) {
      const k = i / t.length;
      ctx.fillStyle = `rgba(255,170,80,${k * 0.25})`;
      ctx.beginPath(); ctx.arc(t[i], t[i + 1], BR * (0.4 + k * 0.5), 0, TAU); ctx.fill();
    }
    ctx.save();
    const gr = ctx.createRadialGradient(b.x - 3.5, b.y - 4, 1, b.x, b.y, BR);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#d5dde7'); gr.addColorStop(0.8, '#6f7c8c'); gr.addColorStop(1, '#2c3440');
    ctx.fillStyle = gr; ctx.shadowColor = 'rgba(200,230,255,0.8)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawFx() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.textAlign = 'center'; ctx.font = '800 14px Consolas, monospace';
  for (const p of popups) {
    ctx.globalAlpha = 1 - p.t;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - p.t * 40);
  }
  ctx.restore();
}

function drawMessage() {
  const m = game.msg;
  if (!m && !game.paused) return;
  const text = game.paused ? 'PAVZA' : m.text;
  const sub = game.paused ? 'pritisni P za nadaljevanje' : m.sub;
  const color = game.paused ? '#6fd3ff' : m.color;
  const a = game.paused ? 1 : Math.min(1, m.t * 6, (m.dur - m.t) * 4);
  const pop = game.paused ? 1 : 1 + Math.max(0, 0.25 - m.t) * 1.2;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.translate(282, 370);
  ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(4,6,10,0.82)';
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.shadowColor = color; ctx.shadowBlur = 20;
  roundRect(-215, -42, 430, sub ? 84 : 64, 10);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${text.length > 14 ? 28 : 36}px "Arial Black", Arial, sans-serif`;
  ctx.fillText(text, 0, sub ? -10 : -10);
  if (sub) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d9e2ec';
    ctx.font = '700 13px Consolas, monospace';
    ctx.fillText(sub, 0, 24);
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function draw() {
  const s = scale * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const ox = shake ? (Math.random() - 0.5) * shake : 0, oy = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.setTransform(s, 0, 0, s, ox * s, oy * s);
  ctx.drawImage(bgLayer, 0, 0, W, H);
  drawInserts();
  drawScoop();
  drawSlings();
  drawBumpers();
  drawTargets();
  drawSpinner();
  drawPlunger();
  drawFlippers();
  drawBalls();
  drawFx();
  drawMessage();
}

/* =====================================================================
   HUD in OVERLAY
   ===================================================================== */
const el = id => document.getElementById(id);
const overlay = el('overlay');
let hudCache = '';
function updateHud() {
  const hs = Math.max(game.score, game.highScores[0]?.score || 0);
  let info = '';
  if (game.state === 'play' || game.state === 'bonus') {
    const parts = [];
    if (game.mult > 1) parts.push('BONUS ×' + game.mult);
    if (game.multiball) parts.push('MULTIBALL');
    if (game.extraBalls) parts.push('EXTRA BALL');
    if (game.tiltWarn && !game.tilted) parts.push('POZOR ' + game.tiltWarn);
    if (game.tilted) parts.push('TILT');
    info = parts.join(' · ');
  }
  const key = [game.score, game.ballNum, hs, info, game.state].join('|');
  if (key === hudCache) return;
  hudCache = key;
  el('hud-score').textContent = fmt(game.score);
  el('hud-ball').textContent = game.state === 'attract' ? '-' : Math.min(game.ballNum, CFG.steviloZogic) + '/' + CFG.steviloZogic;
  el('hud-hs').textContent = fmt(hs);
  el('hud-info').textContent = info;
}

function hsHtml() {
  if (!game.highScores.length) return '<div class="hint">Še ni rekordov — bodi prvi!</div>';
  return '<div class="hs">' + game.highScores.map((h, i) =>
    `<div><span>${i + 1}. ${escapeHtml(h.name)}</span><span>${fmt(h.score)}</span></div>`).join('') + '</div>';
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showStart() {
  overlay.innerHTML = `
    <div class="card">
      <h1>${escapeHtml(CFG.naslov)}</h1>
      <div class="sub">${escapeHtml(CFG.podnaslov)}</div>
      <table>
        <tr><td class="k">Z / ← / L-Shift</td><td>levi flipper</td></tr>
        <tr><td class="k">M / → / D-Shift</td><td>desni flipper</td></tr>
        <tr><td class="k">PRESLEDEK / ↓</td><td>drži in spusti za izstrelitev</td></tr>
        <tr><td class="k">B / ↑</td><td>tresi mizo (pazi na TILT)</td></tr>
        <tr><td class="k">P · O</td><td>pavza · zvok</td></tr>
        <tr><td class="k">telefon</td><td>leva / desna polovica zaslona</td></tr>
      </table>
      <h2>CILJI</h2>
      <table>
        <tr><td class="k">A·L·U</td><td>zgornji kanali → bonus ×2…×6 (flipperji premikajo luči)</td></tr>
        <tr><td class="k">B·U·G</td><td>podri vse tarče → prižge LOCK v talilnici</td></tr>
        <tr><td class="k">2× LOCK</td><td>MULTIBALL — orbit levo = JACKPOT</td></tr>
        <tr><td class="k">ORBIT</td><td>combo zaporedni streli, 5× = EXTRA BALL</td></tr>
        <tr><td class="k">SPINNER</td><td>ponovno prižge KICKBACK</td></tr>
      </table>
      <h2>REKORDI</h2>
      ${hsHtml()}
      <button id="startBtn">ZAČNI</button>
      <div class="hint">ali pritisni ENTER</div>
    </div>`;
  el('startBtn').onclick = startGame;
}

function showGameOver(qualifies) {
  overlay.innerHTML = `
    <div class="card">
      <h1>KONEC IGRE</h1>
      <div class="big">${fmt(game.score)}</div>
      ${qualifies ? `<div class="sub">NOV REKORD! Vpiši ime:</div>
        <input id="hsName" maxlength="12" placeholder="IME" autocomplete="off"><br>
        <button id="saveBtn">SHRANI</button>`
      : `<h2>REKORDI</h2>${hsHtml()}<button id="startBtn">ŠE ENKRAT</button><div class="hint">ali pritisni ENTER</div>`}
    </div>`;
  if (qualifies) {
    const inp = el('hsName');
    let lastName = '';
    try { lastName = localStorage.getItem('aluPinballName') || ''; } catch (e) { /* ignore */ }
    inp.value = lastName;
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
    const save = () => {
      const name = (inp.value.trim() || 'ANONIMNEŽ').toUpperCase().slice(0, 12);
      try { localStorage.setItem('aluPinballName', name); } catch (e) { /* ignore */ }
      game.highScores.push({ name, score: game.score });
      game.highScores.sort((a, b) => b.score - a.score);
      game.highScores = game.highScores.slice(0, 5);
      saveHS();
      game.state = 'attract';
      showStart();
    };
    el('saveBtn').onclick = save;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.stopPropagation(); save(); } });
  } else {
    el('startBtn').onclick = startGame;
  }
}
function hideOverlay() { overlay.innerHTML = ''; }

/* =====================================================================
   VNOS
   ===================================================================== */
const KEYS_L = ['KeyZ', 'ShiftLeft', 'ArrowLeft', 'KeyA'];
const KEYS_R = ['KeyM', 'ShiftRight', 'ArrowRight', 'Slash', 'KeyL'];
const KEYS_P = ['Space', 'ArrowDown', 'Enter'];

function setFlipper(side, down) {
  const f = flippers[side === 'L' ? 0 : 1];
  if (f.pressed === down) return;
  f.pressed = down;
  if (!down || game.state !== 'play' || game.tilted) return;
  Sfx.flipper();
  // pred izstrelitvijo flipperji premikajo skill shot, sicer menjajo prižgane kanale
  const waiting = game.balls.length === 1 && inPlunger(game.balls[0]) && game.skillArmed;
  if (waiting) game.skillLane = (game.skillLane + (side === 'L' ? 2 : 1)) % 3;
  else {
    const a = game.alu;
    game.alu = side === 'L' ? [a[1], a[2], a[0]] : [a[2], a[0], a[1]];
  }
}

function plungerDown() {
  if (game.state !== 'play' || game.paused) return;
  if (!game.balls.some(inPlunger)) return;
  game.plungerHeld = true;
}
function plungerUp() {
  if (!game.plungerHeld) return;
  game.plungerHeld = false;
  const p = game.plungerPull;
  game.plungerPull = 0;
  if (p < 0.05) return;
  for (const b of game.balls) {
    if (!inPlunger(b)) continue;
    b.y = PLUNGER_Y - BR - 1;
    b.vy = -(900 + 1950 * p);
    b.vx = 0;
    if (!game.ballSaveUntil || game.ballSaveUntil < time) game.ballSaveUntil = time + CFG.ballSaveSek;
  }
  Sfx.launch(p);
}

window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  Sfx.init();
  if (KEYS_L.includes(e.code) || KEYS_R.includes(e.code) || KEYS_P.includes(e.code) || e.code === 'ArrowUp') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Enter' && (game.state === 'attract' || game.state === 'over') && !el('hsName')) { startGame(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (game.state === 'play' || game.state === 'bonus') game.paused = !game.paused; return; }
  if (e.code === 'KeyO') { toggleMute(); return; }
  if (game.paused) return;
  if (KEYS_L.includes(e.code)) setFlipper('L', true);
  if (KEYS_R.includes(e.code)) setFlipper('R', true);
  if (KEYS_P.includes(e.code)) plungerDown();
  if (e.code === 'KeyB' || e.code === 'ArrowUp') nudge();
});
window.addEventListener('keyup', e => {
  if (KEYS_L.includes(e.code)) setFlipper('L', false);
  if (KEYS_R.includes(e.code)) setFlipper('R', false);
  if (KEYS_P.includes(e.code)) plungerUp();
});

// dotik: leva polovica = levi flipper, desna = desni (+ izstrelitev, če čaka žogica)
const touches = new Map();
function touchSide(t) {
  const r = canvas.getBoundingClientRect();
  return t.clientX < r.left + r.width / 2 ? 'L' : 'R';
}
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  Sfx.init();
  if (game.paused) return;
  for (const t of e.changedTouches) {
    const side = touchSide(t);
    const plunge = side === 'R' && game.balls.some(inPlunger) && game.state === 'play';
    touches.set(t.identifier, { side, plunge });
    setFlipper(side, true);
    if (plunge) plungerDown();
  }
}, { passive: false });
function touchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const info = touches.get(t.identifier);
    if (!info) continue;
    touches.delete(t.identifier);
    if (![...touches.values()].some(v => v.side === info.side)) setFlipper(info.side, false);
    if (info.plunge) plungerUp();
  }
}
canvas.addEventListener('touchend', touchEnd, { passive: false });
canvas.addEventListener('touchcancel', touchEnd, { passive: false });

function toggleMute() { el('mute').textContent = Sfx.toggle() ? '🔇' : '🔊'; }
el('mute').onclick = () => { Sfx.init(); toggleMute(); el('mute').blur(); };
el('mute').textContent = Sfx.muted ? '🔇' : '🔊';

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (game.state === 'play' || game.state === 'bonus')) game.paused = true;
});
window.addEventListener('resize', resize);

/* =====================================================================
   GLAVNA ZANKA
   ===================================================================== */
buildTable();
resize();
showStart();

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1 / 30) dt = 1 / 30;
  if (!game.paused) update(dt);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// za razhroščevanje v konzoli
window.__pinball = { game, flippers, segs, sensors };
