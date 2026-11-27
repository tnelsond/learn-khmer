// ដំណើរឆ្លងកាល — leap through Genesis as its people, in Khmer only.
// Engine pieces (three.js, PeakSlab audio, the Battambang font) are shared with ../village/.
const LIB = document.querySelector('meta[name=lib]').content;
const FONTS = document.querySelector('meta[name=fonts]').content;
const THREE = await import(LIB + 'three.module.min.js');
const { peakAudio } = await import(document.querySelector('meta[name=peakjs]')?.content || LIB + 'peakaudio.js');
for (const [fam, url] of [['Battambang', LIB + 'battambang.ttf'], ['Moul', FONTS + 'muol.woff']]) { try { const f = new FontFace(fam, `url(${url})`); document.fonts.add(f); f.load().catch(() => { }); } catch (e) { } }
try { await Promise.race([document.fonts.load('30px Battambang', 'ក'), new Promise(r => setTimeout(r, 2000))]); } catch (e) { }

const { IPA } = await import('./ipa.js');
const $ = s => document.querySelector(s);
const ipaOf = w => IPA[w] || '';
const kw = w => `<b>${esc(w)}</b><u>${esc(ipaOf(w))}</u>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFC').replace(/[​-‍\s]/g, '').replace(/្ត/g, '្ដ');
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const KD = '០១២៣៤៥៦៧៨៩', khNum = n => String(n).replace(/\d/g, d => KD[d]);
const NUMW = ['', 'មួយ', 'ពីរ', 'បី', 'បួន', 'ប្រាំ', 'ប្រាំមួយ', 'ប្រាំពីរ', 'ប្រាំបី', 'ប្រាំបួន', 'ដប់'];
const NUMS = Object.fromEntries(NUMW.map((w, i) => [w, i]).filter(x => x[0])); NUMS['សែសិប'] = 40;
const wait = s => new Promise(r => setTimeout(r, s * 1000));
const isMobile = matchMedia('(pointer:coarse)').matches;

/* ---------------- save ---------------- */
const SAVE = 'leap-save-1';
let S = { ch: 0, max: 0, seen: {}, said: [] };
try { const j = JSON.parse(localStorage.getItem(SAVE)); if (j && typeof j.ch === 'number') S = Object.assign(S, j); } catch (e) { }
const hadSave = S.max > 0 || Object.keys(S.seen).length > 0;
function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } }

/* ---------------- audio ---------------- */
let actx;
function unlockAudio() { try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { } ensureAudio(); }
addEventListener('pointerdown', unlockAudio, true); addEventListener('keydown', unlockAudio, true);
function ensureAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { } }
function tone(freqs, dur = .6, type = 'sine', vol = .1, glide = 0) {
  if (!actx) return; const t = actx.currentTime;
  freqs.forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; const t0 = t + i * .09; o.frequency.setValueAtTime(f, t0); if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t0 + dur); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + .05); });
}
const chime = () => tone([660, 880, 1320], .8);
const good = () => tone([523, 659, 784, 1046], .7, 'triangle', .09);
const leapSound = () => { tone([220, 330, 440, 660, 880, 1320, 1760], 1.4, 'sawtooth', .035, 2); tone([110], 2, 'sine', .15, 4); };
let kmVoice = null;
try { const pick = () => { kmVoice = speechSynthesis.getVoices().find(v => /^km/i.test(v.lang)) || null; }; pick(); speechSynthesis.onvoiceschanged = pick; } catch (e) { }
const PEAK = {
  sources: ['https://peakslab.org/', LIB],
  slabs: [
    { name: 'kheng', path: 'khmer/aux/km-kheng.slab', bufmax: 1 << 20 },
    { name: 'rith', path: 'khmer/aux/km-audio2-tnefar.slab', bufmax: 1 << 20 },
    { name: 'khsv', path: 'khmer/aux/km-khsv-words.slab', bufmax: 1 << 20 },
  ],
  postfilters: { path: 'khmer/aux/km-postfilters.slab', bufmax: 1 << 20 },
};
let peak = null, speaking = null;
const peakReady = peakAudio(PEAK).then(p => (peak = p)).catch(e => { console.warn('PeakSlab unavailable', e); return null; });
function playPcm(s, rate) {
  ensureAudio(); if (!actx) return Promise.resolve(false);
  const b = actx.createBuffer(1, s.length, 16000); b.copyToChannel(s, 0);
  const src = actx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate; src.connect(actx.destination);
  return new Promise(res => { src.onended = () => res(true); src.start(); setTimeout(() => res(true), b.duration / rate * 1000 + 300); });
}
function sayTTS(w, lang) {
  const v = lang ? speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(lang)) : kmVoice;
  if (!v) return wait(.4).then(() => false);
  try { speechSynthesis.cancel(); } catch (e) { }
  return new Promise(res => { const u = new SpeechSynthesisUtterance(w); u.voice = v; u.lang = v.lang; u.rate = .9; u.onend = () => res(true); u.onerror = () => res(false); speechSynthesis.speak(u); setTimeout(() => res(true), Math.max(3000, w.length * 160)); });
}
async function playWord(w, lang) {
  if (lang) { try { return await sayTTS(w, lang); } catch (e) { return false; } }
  if (!peak) await Promise.race([peakReady, wait(4)]);
  if (peak && kmVoice && !peak.who(w).length) { try { return await sayTTS(w); } catch (e) { } }
  if (peak) { const [i, rate] = (SP[speaking] || SP.me).v, sp = peak.speakers; const s = peak.samples(w, sp.length ? sp[i % sp.length] : ''); if (s) return playPcm(s, rate); }
  try { return await sayTTS(w); } catch (e) { return false; }
}

/* ---------------- renderer: N64 resolution, blurred up ---------------- */
const cv = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
function resize() { const lines = 250; renderer.setPixelRatio(Math.min(1, lines / Math.min(innerWidth, innerHeight))); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 600);
resize(); addEventListener('resize', resize);
scene.fog = new THREE.Fog(0x000000, 40, 140);
const hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.5); sun.position.set(40, 80, 30); scene.add(sun);
// N64 skybox: a coarse sphere with vertex colours
const skyGeo = new THREE.SphereGeometry(450, 10, 8);
skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -1; scene.add(sky);
const skyNow = { top: new THREE.Color(0), hor: new THREE.Color(0), fog: new THREE.Color(0), light: 0 }, skyGoal = { top: new THREE.Color(0), hor: new THREE.Color(0), fog: new THREE.Color(0), light: 0 };
function setSky(top, hor, fog = hor, light = 1, now = false) { skyGoal.top.setHex(top); skyGoal.hor.setHex(hor); skyGoal.fog.setHex(fog); skyGoal.light = light; if (now) { skyNow.top.copy(skyGoal.top); skyNow.hor.copy(skyGoal.hor); skyNow.fog.copy(skyGoal.fog); skyNow.light = light; } }
function paintSky() { const p = skyGeo.attributes.position, c = skyGeo.attributes.color, tmp = new THREE.Color(); for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 450; tmp.copy(skyNow.hor).lerp(skyNow.top, clamp(y * 1.6, 0, 1)); if (y < 0) tmp.copy(skyNow.hor).multiplyScalar(.8); c.setXYZ(i, tmp.r, tmp.g, tmp.b); } c.needsUpdate = true; scene.fog.color.copy(skyNow.fog); hemi.intensity = .25 + .95 * skyNow.light; sun.intensity = .1 + 1.5 * skyNow.light; }
const stars = (() => { const p = []; for (let i = 0; i < 500; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(.08, 1), rnd(-1, 1)).normalize().multiplyScalar(420); p.push(v.x, v.y, v.z); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); })();
scene.add(stars);

/* ---------------- low-poly toolkit ---------------- */
const MC = {};
const M = (c, o = {}) => { const k = c + JSON.stringify(o); return MC[k] || (MC[k] = new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o))); };
const MB = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, typeof mat === 'number' ? M(mat) : mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
const box = (w, h, d, c, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z, p);
const cyl = (rt, rb, h, c, x, y, z, p, s = 6) => mesh(new THREE.CylinderGeometry(rt, rb, h, s), c, x, y, z, p);
const ball = (r, c, x, y, z, p, w = 6, h = 4) => mesh(new THREE.SphereGeometry(r, w, h), c, x, y, z, p);
const cone = (r, h, c, x, y, z, p, s = 5) => mesh(new THREE.ConeGeometry(r, h, s), c, x, y, z, p);
const grp = (x = 0, y = 0, z = 0, p) => { const g = new THREE.Group(); g.position.set(x, y, z); if (p) p.add(g); return g; };
function pivot(parent, x, y, z) { return grp(x, y, z, parent); }
// tiny textures, bilinear-filtered like the N64
function texture(draw, n = 32) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; }
const noiseTex = texture((g, n) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 200 + Math.random() * 55 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1); } });
const plankTex = texture((g, n) => { g.fillStyle = '#b07a48'; g.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 8) { g.fillStyle = '#6a4424'; g.fillRect(0, y, n, 1); g.fillStyle = '#c48a54'; g.fillRect(0, y + 2, n, 2); g.fillRect((y * 7) % n, y, 1, 8); } });
const brickTex = texture((g, n) => { g.fillStyle = '#7a4a2a'; g.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 8) for (let x = (y / 8) % 2 * 8; x < n + 8; x += 16) { g.fillStyle = `rgb(${170 + Math.random() * 30 | 0},${100 + Math.random() * 20 | 0},60)`; g.fillRect(x - 8 + 1, y + 1, 14, 6); } });
const waterTex = texture((g, n) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 170 + 60 * Math.sin(x * .6 + Math.sin(y * .4) * 2) * Math.sin(y * .5) | 0; g.fillStyle = `rgb(${v},${v + 20},255)`; g.fillRect(x, y, 1, 1); } });
const plankM = new THREE.MeshLambertMaterial({ map: plankTex, flatShading: true });
const brickM = new THREE.MeshLambertMaterial({ map: brickTex, flatShading: true });
function faceTex(skin) { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.fillStyle = '#' + new THREE.Color(skin).getHexString(); g.fillRect(0, 0, 16, 16); g.fillStyle = '#1a1010'; g.fillRect(4, 6, 2, 3); g.fillRect(10, 6, 2, 3); g.fillStyle = '#fff'; g.fillRect(4, 6, 1, 1); g.fillRect(10, 6, 1, 1); g.fillStyle = 'rgba(80,20,20,.6)'; g.fillRect(6, 11, 4, 1); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; }

/* ---------------- models ---------------- */
// rounder N64 people and animals: smooth-shaded capsules and spheres, a few more polygons
// Ocarina-ish: flat-shaded, only a few more faces than boxes
const MS = c => typeof c === 'number' ? M(c) : c;
const capsule = (r, len, c, x, y, z, p, seg = 5) => mesh(new THREE.CapsuleGeometry(r, len, 1, Math.min(seg, 6)), MS(c), x, y, z, p);
const sph = (r, c, x, y, z, p, w = 6, h = 4) => mesh(new THREE.SphereGeometry(r, Math.min(w, 7), Math.min(h, 5)), MS(c), x, y, z, p);
function person(o = {}) {
  const g = new THREE.Group(), b = grp(0, 0, 0, g); b.scale.setScalar(o.small ? .66 : o.scale || 1);
  const sk = o.skin ?? 0xb07a50, top = o.top ?? 0x8a6a4a, bot = o.bottom ?? top;
  const mat = c => o.glow ? MB(o.glow, { transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }) : MS(c);
  const legs = [], arms = [];
  for (const s of [-1, 1]) { const p = pivot(b, s * .13, .74, 0); capsule(.1, .5, mat(sk), 0, -.36, 0, p); const f = sph(.12, mat(0x4a3420), 0, -.7, .06, p, 8, 6); f.scale.set(.9, .5, 1.4); legs.push(p); }
  if (o.robe) mesh(new THREE.CylinderGeometry(.27, .5, 1.1, 7), mat(bot), 0, .6, 0, b); else { const h = sph(.27, mat(bot), 0, .76, 0, b); h.scale.set(1, .7, .85); }
  const t = mesh(new THREE.CylinderGeometry(.25, .29, .74, 7), mat(top), 0, 1.12, 0, b); sph(.25, mat(top), 0, 1.46, 0, b).scale.set(1.15, .45, .9);
  for (const s of [-1, 1]) { const p = pivot(b, s * .36, 1.42, 0); capsule(.075, .46, mat(o.sleeve ?? top), 0, -.28, 0, p); sph(.085, mat(sk), 0, -.6, 0, p, 8, 6); arms.push(p); }
  const head = grp(0, 1.8, 0, b);
  sph(.26, mat(sk), 0, 0, 0, head, 7, 5).scale.set(.95, 1.05, .95);
  if (!o.glow) { for (const s of [-1, 1]) { sph(.045, 0x1a1010, s * .09, .03, .23, head, 8, 6); } sph(.04, sk, 0, -.04, .26, head, 8, 6); }
  if (o.hair != null) { const h = mesh(new THREE.SphereGeometry(.28, 7, 3, 0, Math.PI * 2, 0, Math.PI * .55), mat(o.hair), 0, .02, -.03, head); h.rotation.x = -.35; if (o.female) capsule(.2, .4, mat(o.hair), 0, -.22, -.15, head); }
  if (o.cloth != null) { const c = mesh(new THREE.SphereGeometry(.3, 7, 3, 0, Math.PI * 2, 0, Math.PI * .6), mat(o.cloth), 0, .02, -.02, head); c.rotation.x = -.5; mesh(new THREE.CylinderGeometry(.24, .34, .5, 7, 1, true), mat(o.cloth), 0, -.2, -.1, head); }
  if (o.beard != null) { const bd = mesh(new THREE.ConeGeometry(.2, .42, 6), mat(o.beard), 0, -.32, .14, head); bd.rotation.x = Math.PI + .2; }
  if (o.leaves) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const l = mesh(new THREE.ConeGeometry(.1, .36, 6), mat(0x3f8a2a), Math.sin(a) * .25, .6, Math.cos(a) * .2, b); l.rotation.x = Math.PI; }
  return { g, b, legs, arms, head };
}
function animal(kind) {
  const g = new THREE.Group(), b = grp(0, 0, 0, g), legs = [];
  if (kind === 'monkey') {
    for (const s of [-1, 1]) { const p = pivot(b, s * .14, .42, 0); capsule(.07, .26, 0x6a4424, 0, -.2, 0, p); legs.push(p); }
    sph(.3, 0x7a5030, 0, .68, 0, b).scale.y = 1.15; const h = sph(.24, 0x7a5030, 0, 1.08, .05, b); sph(.15, 0xd8b088, 0, 1.03, .2, b).scale.z = .6;
    for (const s of [-1, 1]) { sph(.08, 0xd8b088, s * .24, 1.1, .05, b, 8, 6); sph(.035, 0x1a1010, s * .07, 1.12, .25, b, 6, 4); }
    const t = mesh(new THREE.TorusGeometry(.35, .04, 4, 7, Math.PI * 1.3), MS(0x6a4424), 0, .7, -.4, b); t.rotation.y = Math.PI / 2; return { g, b, legs, head: h };
  }
  const [c, L, W, H, legH] = { cow: [0x8a5a3a, 1.7, .8, .9, .75], sheep: [0xf2eee0, 1.1, .8, .8, .45], lion: [0xd0a050, 1.6, .7, .8, .7], elephant: [0x8a8a92, 2.6, 1.7, 1.8, 1.3], camel: [0xc8a06a, 1.8, .7, .9, 1.4], ram: [0xe8e2d0, 1.2, .8, .85, .5], horse: [0x6a4a30, 1.8, .6, .8, 1.0] }[kind];
  const woolly = kind === 'sheep' || kind === 'ram', lc = woolly ? 0x2a2a2a : c, lr = W * .15 + .02;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = pivot(b, sx * W * .3, legH + .05, sz * L * .32); capsule(lr, Math.max(.05, legH - lr * 2), lc, 0, -legH / 2, 0, p); legs.push(p); }
  const body = capsule(Math.min(W, H) / 2, Math.max(.1, L - Math.min(W, H)), c, 0, legH + H / 2, 0, b, 6); body.rotation.x = Math.PI / 2; body.scale.x = W / Math.min(W, H) * 1.0;
  if (woolly) for (let i = 0; i < 7; i++) sph(.28, c, rnd(-.25, .25), legH + H * .55 + rnd(-.1, .2), rnd(-.4, .4), b, 8, 6);
  const head = grp(0, legH + H * .85, L / 2 + .05, b);
  const hc = woolly ? 0x2a2a2a : c, eye = (x, y, z) => { for (const s of [-1, 1]) sph(.04, 0x1a1010, s * x, y, z, head, 6, 4); };
  if (kind === 'elephant') { sph(.62, c, 0, .2, .25, head); const tr = mesh(new THREE.CylinderGeometry(.12, .24, 1.3, 6), MS(c), 0, -.5, .75, head); tr.rotation.x = .3; for (const s of [-1, 1]) { const e = sph(.5, 0x7a7a84, s * .6, .3, .1, head); e.scale.set(.2, 1, .9); const t = mesh(new THREE.ConeGeometry(.07, .5, 8), MS(0xf0f0e0), s * .3, -.3, .8, head); t.rotation.x = 1.9; } eye(.32, .35, .7); }
  else if (kind === 'camel') { const n = capsule(.15, .9, c, 0, .4, .15, head); n.rotation.x = .4; const hh = sph(.22, c, 0, 1.0, .45, head); hh.scale.z = 1.6; eye(.12, 1.08, .55); sph(.42, c, 0, legH + H + .1, 0, b).scale.y = .8; }
  else if (kind === 'horse') { const n = capsule(.17, .6, c, 0, .3, 0, head); n.rotation.x = .5; const hh = sph(.18, c, 0, .7, .4, head); hh.scale.z = 2.2; eye(.12, .78, .45); const m = capsule(.05, .6, 0x2a1a10, 0, .55, -.12, head); m.rotation.x = .5; }
  else { const hh = sph(.25, hc, 0, .05, .18, head); hh.scale.set(1, .95, 1.25); eye(.13, .12, .4); }
  if (kind === 'cow') for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(.05, .3, 8), MS(0xf0e8d0), s * .22, .3, .1, head); h.rotation.z = -s * .8; }
  if (kind === 'ram') for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(.16, .06, 4, 7, 4.5), MS(0xc8b888), s * .24, .16, .08, head); h.rotation.y = s * Math.PI / 2; }
  if (kind === 'lion') { const m = sph(.46, 0x8a4a18, 0, .05, .02, head); m.scale.z = .7; sph(.26, c, 0, .02, .26, head).scale.z = 1.1; eye(.12, .1, .48); }
  const tail = capsule(.04, .55, kind === 'lion' ? 0x8a4a18 : c, 0, legH + H * .6, -L / 2 - .15, b, 6); tail.rotation.x = .5;
  return { g, b, legs, head };
}
function snake() { const g = new THREE.Group(), segs = []; for (let i = 0; i < 12; i++) { const s = sph(.14 - i * .006, i % 2 ? 0x3a7a2a : 0xc8a020, 0, .12, -i * .2, g, 8, 6); s.scale.z = 1.4; segs.push(s); } const h = sph(.17, 0x3a7a2a, 0, .16, .26, g); h.scale.set(1.1, .8, 1.4); for (const s of [-1, 1]) sph(.035, 0xffe040, s * .09, .24, .4, g, 6, 4); return { g, segs, head: h }; }
function bird(c = 0xf0f0f0) { const g = new THREE.Group(); const b = ball(.22, c, 0, 0, 0, g, 5, 3); b.scale.z = 1.6; ball(.13, c, 0, .12, .3, g, 4, 3); cone(.05, .14, 0xe0a020, 0, .1, .45, g, 3).rotation.x = Math.PI / 2; const wings = []; for (const s of [-1, 1]) { const p = pivot(g, s * .12, .05, 0); const w = box(.6, .04, .3, c, s * .3, 0, 0, p); wings.push(p); } return { g, wings }; }
function fish(c = 0xff8030) { const g = new THREE.Group(); const b = mesh(new THREE.OctahedronGeometry(.4, 0), c, 0, 0, 0, g); b.scale.set(.5, .7, 1.2); const t = cone(.25, .4, c, 0, 0, -.6, g, 3); t.rotation.x = -Math.PI / 2; return { g }; }
function tree(o = {}) {
  const g = new THREE.Group(), s = o.s || 1;
  cyl(.18 * s, .3 * s, 2.4 * s, 0x6a4424, 0, 1.2 * s, 0, g, 5);
  const crown = o.palm ? null : mesh(new THREE.DodecahedronGeometry(1.5 * s, 0), o.leaf ?? 0x3f8a2a, 0, 3.2 * s, 0, g);
  if (o.palm) for (let i = 0; i < 7; i++) { const l = box(.3 * s, .06, 2.2 * s, 0x4a8a30, 0, 2.5 * s, 0, g); l.geometry.translate(0, 0, 1.1 * s); l.rotation.set(.5, i / 7 * Math.PI * 2, 0); }
  if (crown) { crown.scale.y = .85; const c2 = mesh(new THREE.DodecahedronGeometry(1.0 * s, 0), o.leaf2 ?? 0x56a03a, .6 * s, 3.9 * s, .3 * s, g); }
  const fruits = [];
  if (o.fruit != null) for (let i = 0; i < (o.n || 6); i++) { const a = i / (o.n || 6) * Math.PI * 2; fruits.push(ball(.2 * s, o.fruit, Math.cos(a) * 1.35 * s, (2.7 + (i % 2) * .7) * s, Math.sin(a) * 1.35 * s, g, 5, 3)); }
  return { g, fruits };
}
function bush(c = 0x2f7a2a) { const g = new THREE.Group(); for (let i = 0; i < 4; i++) mesh(new THREE.IcosahedronGeometry(rnd(.7, 1.1), 0), c, rnd(-.8, .8), .6, rnd(-.8, .8), g); return g; }
function rock(s = 1, c = 0x8a8478) { const m = mesh(new THREE.DodecahedronGeometry(s, 0), c); m.scale.y = .6; return m; }
function glowOrb(c = 0xfff0b0, r = 1) { const g = new THREE.Group(); ball(r, MB(c, { fog: false }), 0, 0, 0, g, 8, 6); ball(r * 1.7, MB(c, { transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0, 0, 0, g, 8, 6); return g; }
function fire() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) cone(.3 - i * .07, .8 - i * .15, MB([0xff5010, 0xff9020, 0xffe060][i]), 0, .4 + i * .05, 0, g, 5); for (let i = 0; i < 4; i++) box(.12, .12, .9, 0x5a3a20, 0, .06, 0, g).rotation.y = i * .8; return g; }
function log() { const g = new THREE.Group(); const l = cyl(.22, .22, 1.8, 0x7a5030, 0, .22, 0, g, 6); l.rotation.z = Math.PI / 2; return g; }
function logPile() { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const l = cyl(.22, .22, 2.2, 0x7a5030, (i % 3 - 1) * .46, .22 + (i > 2 ? .4 : 0), (i > 2 ? (i - 3.5) * .46 : 0), g, 6); l.rotation.x = Math.PI / 2; } return g; }
function brickStack() { const g = new THREE.Group(); for (let i = 0; i < 6; i++) box(.5, .2, .3, brickM, (i % 2) * .5 - .25, .1 + Math.floor(i / 2) * .2, 0, g); return g; }
function tent(c = 0x6a4a3a) { const g = new THREE.Group(); const t = cone(2.4, 2.6, c, 0, 1.3, 0, g, 4); t.rotation.y = Math.PI / 4; box(.9, 1.4, .1, 0x2a1a10, 0, .7, 1.66, g); return g; }
function bread() { const g = new THREE.Group(); const b = ball(.35, 0xd8a050, 0, .2, 0, g, 6, 3); b.scale.y = .5; return g; }
function cloud() { const g = new THREE.Group(); for (let i = 0; i < 4; i++) mesh(new THREE.IcosahedronGeometry(rnd(1, 1.6), 0), 0x9aa0b0, i * 1.2 - 1.8, rnd(0, .4), rnd(-.4, .4), g); for (let i = 0; i < 6; i++) box(.06, .4, .06, MB(0x80b0ff), rnd(-2, 2), -1.6 - rnd(0, 1), rnd(-.5, .5), g); return g; }
function rainbowMesh(R = 60) { const g = new THREE.Group(); [0xff3030, 0xff9020, 0xffe030, 0x40d040, 0x3080ff, 0x8040d0].forEach((c, i) => { mesh(new THREE.TorusGeometry(R - i * 1.6, .9, 3, 28, Math.PI), MB(c, { transparent: true, opacity: .6, fog: false, depthWrite: false }), 0, 0, 0, g); }); return g; }
function ark(stage = 4) {
  const g = new THREE.Group(), parts = [];
  const add = (st, m) => { m.visible = stage >= st; m.userData.st = st; parts.push(m); return m; };
  add(1, box(22, .5, 3, plankM, 0, .25, 0, g));
  for (let i = -5; i <= 5; i++) { const r = add(1, box(.3, 4, .3, 0x6a4424, i * 2, 2.2, 3.2, g)); const r2 = add(1, box(.3, 4, .3, 0x6a4424, i * 2, 2.2, -3.2, g)); }
  add(2, box(22, 2.6, 6.8, plankM, 0, 1.5, 0, g));
  add(3, box(21.6, 2.4, 6.8, plankM, 0, 4.0, 0, g));
  add(3, box(.2, 1.8, 2.2, 0x3a2412, 0, 1.6, 3.45, g));
  add(4, box(14, 1.6, 5, plankM, 0, 6.0, 0, g));
  const roof = add(4, cyl(.1, 4.2, 1.6, 0x6a4424, 0, 7.6, 0, g, 4)); roof.scale.set(1.9, 1, .75); roof.rotation.y = Math.PI / 4;
  const ramp = add(4, box(2.2, .2, 5, plankM, 0, .9, 5.6, g)); ramp.rotation.x = .38;
  for (const s of [-1, 1]) { const p = add(2, box(1.4, 2.4, 6.8, plankM, s * 11.5, 3, 0, g)); p.rotation.z = s * .5; }
  return { g, parts, setStage(n) { stage = n; for (const p of parts) p.visible = n >= p.userData.st; } };
}
function towerMesh() { const g = new THREE.Group(), lv = []; for (let i = 0; i < 9; i++) { const w = 16 - i * 1.6; const m = box(w, 2.6, w, brickM, 0, 1.3 + i * 2.6, 0, g); m.visible = false; lv.push(m); const st = box(2.2, 2.7, 1.2, 0x8a5a3a, 0, 1.35 + i * 2.6, w / 2 + .5, g); st.rotation.x = -.5; st.visible = false; m.userData.st = st; } return { g, lv, show(n) { lv.forEach((m, i) => { m.visible = i < n; m.userData.st.visible = i < n; }); } }; }
function altar() { const g = new THREE.Group(); for (let i = 0; i < 9; i++) mesh(new THREE.DodecahedronGeometry(.4, 0), 0x8a8478, (i % 3 - 1) * .7, .3 + Math.floor(i / 3) * .4, (Math.floor(i / 3) % 2) * .2, g); return g; }
function gate() { const g = new THREE.Group(); for (const s of [-1, 1]) box(1, 6, 1, 0xd8c890, s * 3, 3, 0, g); box(8, 1, 1.2, 0xd8c890, 0, 6.3, 0, g); return g; }

// pictures for words: tapping a word shows its picture (comprehensible input, no translation)
const HEROES = {
  adam: { name: 'អ័ដាម', skin: 0xb07850, top: 0xb07850, bottom: 0x3f8a2a, hair: 0x2a1a10, leaves: true },
  eve: { name: 'អេវ៉ា', skin: 0xc08a60, top: 0xc08a60, bottom: 0x3f8a2a, hair: 0x3a2010, female: true, leaves: true },
  noah: { name: 'ណូអេ', skin: 0xa07050, top: 0x7a5a3a, bottom: 0x8a6a44, robe: true, cloth: 0xe0d8c0, beard: 0xf0f0f0 },
  builder: { name: 'អ្នកសង់', skin: 0x9a6a44, top: 0xc8a878, bottom: 0x8a6a4a, hair: 0x1a1010, cloth: 0xb03a2a },
  abram: { name: 'អាប់រ៉ាម', skin: 0xa07050, top: 0x3a5a9a, bottom: 0xe0d8c0, robe: true, cloth: 0xf0ead8, beard: 0xc8c8c8 },
};
const CAST = {
  god: { km: 'ព្រះជាម្ចាស់', v: [2, .86] }, al: { km: 'អាល់', v: [1, 1] }, me: { km: '', v: [0, 1] },
  adam: { km: 'អ័ដាម', v: [3, .95] }, eve: { km: 'អេវ៉ា', v: [4, 1.12] }, snake: { km: 'ពស់', v: [5, 1.08] },
  wife: { km: 'ប្រពន្ធ', v: [4, 1.1] }, son: { km: 'សិម', v: [3, 1.06] }, nb: { km: 'អ្នកជិតខាង', v: [5, .98] },
  boss: { km: 'មេការ', v: [3, .9] }, friend: { km: 'មិត្ត', v: [5, 1.04] }, w1: { km: 'អ្នកសង់', v: [1, 1.1] },
  sarai: { km: 'សារ៉ាយ', v: [4, 1.08] }, sarah: { km: 'សារ៉ា', v: [4, 1.08] }, lot: { km: 'ឡុត', v: [5, 1.02] }, guest: { km: 'ភ្ញៀវ', v: [2, .94] },
  isaac: { km: 'អ៊ីសាក', v: [5, 1.2] }, angel: { km: 'ទេវតា', v: [1, .92] },
};
const SP = CAST;
const P = {
  person: () => person({ skin: 0xb07a50, top: 0x8a6a4a, hair: 0x2a1a10 }).g,
  woman: () => person({ ...HEROES.eve, leaves: false, top: 0xa04a3a, bottom: 0xa04a3a, robe: true }).g,
};
const PIC = {
  'ពន្លឺ': () => glowOrb(0xfff4c0, .8), 'ងងឹត': () => ball(1, 0x101018), 'មេឃ': () => { const g = new THREE.Group(); ball(1.2, 0x5a9ae8, 0, 0, 0, g, 8, 6); mesh(new THREE.IcosahedronGeometry(.5, 0), 0xffffff, .4, .5, .9, g); return g; },
  'ទឹក': () => { const g = new THREE.Group(); box(2, .5, 2, new THREE.MeshLambertMaterial({ color: 0x4a8ae0, map: waterTex }), 0, 0, 0, g); return g; },
  'ដី': () => { const g = new THREE.Group(); box(2, .6, 2, 0x8a6a3a, 0, 0, 0, g); box(2, .12, 2, 0x5a9a3a, 0, .36, 0, g); return g; },
  'ស្មៅ': () => { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const c = cone(.12, .9, 0x5aaa3a, rnd(-.5, .5), .45, rnd(-.5, .5), g, 3); c.rotation.z = rnd(-.3, .3); } return g; },
  'ដើមឈើ': () => tree().g, 'ផ្លែឈើ': () => tree({ fruit: 0xe03a2a }).g, 'ផ្លែ': () => ball(.5, 0xe03a2a, 0, 0, 0, null, 6, 4),
  'ព្រះអាទិត្យ': () => glowOrb(0xffd040, 1), 'ព្រះចន្ទ': () => ball(1, MB(0xf4f0d8)), 'ផ្កាយ': () => mesh(new THREE.OctahedronGeometry(1, 0), MB(0xfff4a0)),
  'ត្រី': () => fish().g, 'បក្សី': () => bird(0x3a8ae0).g, 'សត្វ': () => animal('cow').g, 'មនុស្ស': P.person, 'ស្ត្រី': P.woman,
  'គោ': () => animal('cow').g, 'ចៀម': () => animal('sheep').g, 'តោ': () => animal('lion').g, 'ដំរី': () => animal('elephant').g, 'ស្វា': () => animal('monkey').g,
  'អូដ្ឋ': () => animal('camel').g, 'ចៀមឈ្មោល': () => animal('ram').g, 'កូនចៀម': () => { const a = animal('sheep').g; a.scale.setScalar(.6); return a; }, 'ពស់': () => snake().g,
  'អ័ដាម': () => person(HEROES.adam).g, 'អេវ៉ា': () => person(HEROES.eve).g, 'ណូអេ': () => person(HEROES.noah).g, 'អាប់រ៉ាម': () => person(HEROES.abram).g, 'អ័ប្រាហាំ': () => person(HEROES.abram).g,
  'អ្នកសង់': () => person(HEROES.builder).g, 'សារ៉ា': () => person({ skin: 0xb07a50, top: 0x8a3a5a, bottom: 0x8a3a5a, robe: true, cloth: 0xe8d8c0, female: true }).g, 'សារ៉ាយ': () => person({ skin: 0xb07a50, top: 0x8a3a5a, bottom: 0x8a3a5a, robe: true, cloth: 0xe8d8c0 }).g,
  'អ៊ីសាក': () => person({ skin: 0xb07a50, top: 0xe0d0a0, robe: true, hair: 0x2a1a10, small: true }).g, 'អាល់': () => person({ glow: 0x80c8ff }).g, 'ទេវតា': () => person({ glow: 0xffffff }).g,
  'ឈើ': () => log(), 'ទូក': () => ark().g, 'ទឹកជំនន់': () => { const g = new THREE.Group(); box(3, .4, 3, new THREE.MeshLambertMaterial({ color: 0x3a6ab0, map: waterTex }), 0, 0, 0, g); const t = tree({ s: .5 }).g; t.position.set(0, -.6, 0); g.add(t); return g; },
  'ភ្លៀង': () => cloud(), 'ព្រាប': () => bird(0xffffff).g, 'ស្លឹកឈើ': () => { const m = mesh(new THREE.OctahedronGeometry(.6, 0), 0x6aaa3a); m.scale.set(.5, .1, 1); return m; }, 'ឥន្ទធនូ': () => rainbowMesh(3),
  'ឥដ្ឋ': () => brickStack(), 'ដីឥដ្ឋ': () => { const m = ball(.8, 0x7a4a2a, 0, 0, 0, null, 6, 3); m.scale.y = .5; return m; }, 'ប៉ម': () => { const t = towerMesh(); t.show(7); return t.g; }, 'ភ្លើង': () => fire(),
  'តង់': () => tent(), 'នំបុ័ង': () => bread(), 'ភ្នំ': () => { const m = cone(2, 2.4, 0x8a7a5a, 0, 0, 0, null, 5); return m; }, 'អាសនា': () => altar(), 'ដាវ': () => { const g = new THREE.Group(); box(.15, 2, .05, MB(0xffa030), 0, 1, 0, g); box(.6, .1, .1, 0x8a6a30, 0, 0, 0, g); return g; },
  'ទ្វារ': () => { const g = new THREE.Group(); box(1.4, 2.2, .2, 0x6a4424, 0, 1.1, 0, g); return g; }, 'ព្រៃ': () => bush(), 'ទីក្រុង': () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) box(1, rnd(.8, 2), 1, brickM, (i % 3 - 1) * 1.2, .5, Math.floor(i / 3) * 1.2, g); return g; },
  'ភ្ញៀវ': () => person({ skin: 0xb07a50, top: 0xf0f0f0, robe: true, cloth: 0xf0f0f0 }).g, 'ឡុត': () => person({ skin: 0xa07050, top: 0x5a7a3a, robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }).g,
  'សម្លៀកបំពាក់': () => { const g = new THREE.Group(); cyl(.4, .7, 1.4, 0x8a5a30, 0, 0, 0, g, 6); return g; },
};

/* ---------------- world ---------------- */
let world = new THREE.Group(); scene.add(world);
let H = () => 0, bound = 80, clampFn = null;
const solids = [], ents = [], acts = [], floors = [];
let ground = null, water = null, waterY = -100;
function clearWorld() { track = null; scene.remove(world); world = new THREE.Group(); scene.add(world); solids.length = ents.length = acts.length = floors.length = 0; ground = water = null; waterY = -100; clampFn = null; tags = {}; anims.length = 0; stars.material.opacity = 0; marker(null); }
const groundAt = (x, z) => { let h = H(x, z); for (const f of floors) if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) h = Math.max(h, f.y()); return h; };
function terrain(size, seg, color) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2), p = geo.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = H(x, z); p.setY(i, y); c.setHex(color(x, z, y)).multiplyScalar(rnd(.9, 1.08)); cols.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  noiseTex.repeat.set(size / 6, size / 6);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: noiseTex })); world.add(m); ground = m; return m;
}
function recolor(color) { const p = ground.geometry.attributes.position, col = ground.geometry.attributes.color, c = new THREE.Color(); for (let i = 0; i < p.count; i++) { c.setHex(color(p.getX(i), p.getZ(i), p.getY(i))).multiplyScalar(rnd(.9, 1.08)); col.setXYZ(i, c.r, c.g, c.b); } col.needsUpdate = true; }
function addWater(y = 0, c = 0x3a7ad0, size = 900) { const t = waterTex.clone(); t.needsUpdate = true; t.repeat.set(size / 10, size / 10); const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: c, map: t, transparent: true, opacity: .82 })); m.position.y = y; waterY = y; world.add(m); water = m; return m; }
function place(obj, x, z, rot = 0, solid = 0, dy = 0) { obj.position.set(x, H(x, z) + dy, z); obj.rotation.y = rot; world.add(obj); if (solid) solids.push({ x, z, r: solid }); return obj; }
let tags = {};
function tag(word, obj) { (tags[word] ||= []).push(obj); }
// moving things: people, animals, birds
function ent(model, x, z, o = {}) {
  const e = Object.assign({ g: model.g || model, m: model, x, z, yaw: o.yaw || 0, y: 0, goal: null, speed: 3, follow: null, fly: 0, solid: .6, walkT: 0, face: null, hide: false }, o);
  world.add(e.g); ents.push(e); e.y = groundAt(x, z) + e.fly; e.g.position.set(x, e.y, z); e.g.rotation.y = e.yaw; return e;
}
function walk(e, x, z, speed) { if (speed) e.speed = speed; return new Promise(res => { e.goal = { x, z, res }; }); }
function npc(id, opts, x, z, yaw = 0) { const m = person(opts); const e = ent(m, x, z, { yaw, id }); e.talk = id; tag(CAST[id]?.km, e.g); return e; }

/* ---------------- player & camera ---------------- */
let hero = null, heroId = null;
const player = { x: 0, z: 0, yaw: 0, y: 0, carry: null };
function setHero(id, x, z, yaw = 0) {
  if (hero) world.remove(hero.g);
  heroId = id; hero = person(HEROES[id]); world.add(hero.g); CAST.me.km = HEROES[id].name;
  player.x = x; player.z = z; player.yaw = yaw; player.y = groundAt(x, z); camYaw = yaw + Math.PI; drop();
}
function carry(obj) { drop(); player.carry = obj; obj.position.set(0, 2.25, .1); hero.b.add(obj); }
function drop() { if (player.carry) { player.carry.parent && player.carry.parent.remove(player.carry); player.carry = null; } }
let track = null, camYaw = 0, camOff = 0, camPitch = .32, camDist = 7.5, cine = null;
function camTo(pos, look, dur = 1.5) { cine = { from: camera.position.clone(), to: new THREE.Vector3(...pos), lookFrom: cineLook.clone(), look: new THREE.Vector3(...look), t: 0, dur }; return wait(dur); }
function camFree() { cine = null; }
const cineLook = new THREE.Vector3();
function mirror() { const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw); return camTo([player.x + fx * 5, player.y + 2.4, player.z + fz * 5], [player.x, player.y + 1.3, player.z], 1.2); }

/* ---------------- input ---------------- */
const input = { jx: 0, jy: 0, keys: {} };
let ui = null;
const joy = $('#joy'), ring = $('#joyring'), knob = $('#joyknob');
let joyId = null, joyO = null, lookId = null, lookLast = null;
function joyStart(id, x, y) { joyId = id; joyO = { x, y }; ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.classList.remove('hide'); $('#joyhint').classList.add('hide'); }
function joyMove(x, y) { let dx = x - joyO.x, dy = y - joyO.y; const l = Math.hypot(dx, dy), m = 52; if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; input.jx = dx / m; input.jy = dy / m; }
function joyEnd() { joyId = null; input.jx = input.jy = 0; ring.classList.add('hide'); knob.style.transform = ''; }
joy.addEventListener('pointerdown', e => { if (ui) return; ensureAudio(); joy.setPointerCapture(e.pointerId); joyStart(e.pointerId, e.clientX, e.clientY); e.preventDefault(); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e.clientX, e.clientY); });
for (const ev of ['pointerup', 'pointercancel']) joy.addEventListener(ev, e => { if (e.pointerId === joyId) joyEnd(); });
cv.addEventListener('pointerdown', e => { if (ui) return; ensureAudio(); lookId = e.pointerId; lookLast = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (e.pointerId !== lookId) return; const k = e.pointerType === 'mouse' ? .005 : .008; camYaw -= (e.clientX - lookLast.x) * k; camPitch = clamp(camPitch + (e.clientY - lookLast.y) * k * .6, .05, 1.1); lookLast = { x: e.clientX, y: e.clientY }; });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) cv.addEventListener(ev, () => { lookId = null; });
addEventListener('keydown', e => {
  if (ui === 'kb') return kbKey(e);
  if (ui === 'dlg') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dlgTap(); } return; }
  if (ui) { if (e.key === 'Escape') closeAll(); return; }
  input.keys[e.code] = true;
  if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); pressA(); }
  if (e.code === 'Enter' || e.code === 'KeyT') { e.preventDefault(); openKB(); }
  if (e.code === 'Tab') { e.preventDefault(); openBook(); }
});
addEventListener('keyup', e => { input.keys[e.code] = false; });
const releaseAll = () => { input.keys = {}; joyEnd(); lookId = null; };
addEventListener('blur', releaseAll); document.addEventListener('visibilitychange', () => document.hidden && releaseAll());

/* ---------------- goal, marker, action button ---------------- */
let goalAt = null;
const mk = new THREE.Group(); { const o = mesh(new THREE.OctahedronGeometry(.5, 0), MB(0xf2c51c)); o.scale.y = 1.5; mk.add(o); mk.add(mesh(new THREE.OctahedronGeometry(.8, 0), MB(0xf2c51c, { transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false }))); } scene.add(mk); mk.visible = false;
function marker(at) { goalAt = at; mk.visible = !!at; }
const atXZ = at => !at ? null : Array.isArray(at) ? at : at.g ? [at.x, at.z] : at.position ? [at.position.x, at.position.z] : null;
function goal(text, at = null) { $('#obj').innerHTML = text ? wordsHTML(text) : ''; bindWords($('#obj'), text ? tokens(text) : []); marker(at); }
function act(label, at, r = 3) { return new Promise(res => { const a = { label, at, r, fn: () => { acts.splice(acts.indexOf(a), 1); res(); } }; acts.push(a); }); }
function pick(list) { return new Promise(res => { const mine = list.map(([label, at, r, v]) => ({ label, at, r: r || 3, fn: () => { for (const m of mine) { const i = acts.indexOf(m); if (i >= 0) acts.splice(i, 1); } res(v); } })); acts.push(...mine); }); }
let curAct = null;
function pressA() { if (ui || !curAct) return; ensureAudio(); tone([520, 780], .25, 'square', .04); const a = curAct; curAct = null; $('#lA').textContent = '\u00a0'; $('#nA').classList.add('off'); $('#nA').classList.remove('on'); a.fn(); }
$('#bA').onclick = pressA;
const reachers = [];
function reach(at, r = 4) { return new Promise(res => reachers.push({ at, r, res })); }

/* ---------------- text boxes ---------------- */
const isPunct = t => /^[។!?:«»….,៖()\/០-៩]+$/.test(t) || t === '...';
function tokens(text) { return text.split(' ').filter(Boolean).map(t => ({ km: t.replace(/^\*/, ''), trig: t.startsWith('*') })); }
const isKh = s => /[ក-៿]/.test(s);
function wordsHTML(text, fx) { return tokens(text).map((t, i) => isPunct(t.km) ? `<span class="p">${esc(t.km)}</span>` : fx || !isKh(t.km) ? `<span class="fx">${esc(t.km)}</span>` : `<span class="w${t.trig ? ' trig' : S.seen[t.km] ? ' seen' : ' new'}" data-i="${i}">${kw(t.km)}</span>`).join(''); }
function bindWords(el, tk) { el.querySelectorAll('.w').forEach(w => w.onclick = ev => { ev.stopPropagation(); ensureAudio(); const t = tk[+w.dataset.i]; if (t.trig && trigRes) return trigRes(t.km); hearing++; speaking = speaking || 'me'; playWord(t.km); pop(w, t.km); flashTag(t.km); }); }
function seeWords(text) { let n = false; for (const t of tokens(text)) if (!isPunct(t.km) && isKh(t.km)) { if (!S.seen[t.km]) n = true; S.seen[t.km] = (S.seen[t.km] || 0) + 1; } $('#count').textContent = khNum(Object.keys(S.seen).length); return n; }
let dlgRes = null, trigRes = null, hearing = 0, curLine = null;
function say(who, text, o = {}) {
  if (who === 'al') return Promise.resolve(); // no narrator: the scene carries it
  if (who === 'me' && !o.chosen && !text.includes('*')) return choose(text); // you pick what you say
  return new Promise(res => {
    ui = 'dlg'; joyEnd(); speaking = who; curLine = { who, text, o };
    const fx = !!o.lang;
    $('#who').textContent = CAST[who]?.km || who; $('#dlg').classList.remove('hide'); $('#hear').classList.remove('hide');
    $('#line').innerHTML = wordsHTML(text, fx); const tk = tokens(text); bindWords($('#line'), tk);
    if (!fx) seeWords(text);
    const trig = tk.some(t => t.trig);
    $('#more').classList.toggle('hide', trig);
    const fin = v => { dlgRes = trigRes = null; $('#dlg').classList.add('hide'); ui = null; hearing++; res(v); };
    if (trig) { trigRes = w => { playWord(w); fin(w); }; dlgRes = null; }
    else dlgRes = () => fin();
    hearLine(text, o.lang);
    if (o.auto) setTimeout(() => dlgRes === null || fin(), o.auto * 1000);
  });
}
// Your lines are chosen. Alternatives that would stall the story ('strict') get a pause and you choose again.
const ALT = {
  'ឆ្ងាញ់ !': { alt: ['ផ្លែឈើ ល្អ ណាស់ !'] },
  'បាទ ។': { alt: ['ទេ !'], strict: true },
  'ឆ្អឹង ពី ឆ្អឹង ខ្ញុំ ! សាច់ ពី សាច់ ខ្ញុំ !': { alt: ['អ្នក ជា នរណា ?'] },
  'យើង ហូប ផ្លែឈើ បាន ។ ប៉ុន្តែ ផ្លែ ពី ដើមឈើ នេះ ... កុំ ហូប ។ យើង នឹង ស្លាប់ ។': { alt: ['ពស់ និយាយ បាន !'] , strict: true },
  'អូយ ... យើង ខ្លាច ។': { alt: ['យើង សប្បាយ ណាស់ !'], strict: true },
  'ពស់ បញ្ឆោត ខ្ញុំ ។': { alt: ['អ័ដាម ឲ្យ ខ្ញុំ ។'], strict: true },
  'ទឹកជំនន់ នឹង មក ។': { alt: ['ខ្ញុំ ចូលចិត្ត ទូក ។'] },
  'ដី ស្ងួត ហើយ !': { alt: ['ទឹក នៅ ច្រើន ។'], strict: true },
};
async function choose(text) {
  const spec = ALT[text] || {}; let opts = [text, ...(spec.alt || [])];
  for (;;) {
    const pick = await choiceBox(opts.slice().sort(() => Math.random() - .5));
    await say('me', pick, { chosen: true });
    if (pick === text || !spec.strict) return;
    tone([220, 170], .4, 'triangle', .05); toast('...'); await wait(1); opts = opts.filter(x => x !== pick);
  }
}
function choiceBox(opts) {
  return new Promise(res => {
    ui = 'dlg'; joyEnd(); speaking = 'me'; dlgRes = trigRes = null; hearing++;
    $('#who').textContent = CAST.me.km; $('#dlg').classList.remove('hide'); $('#more').classList.add('hide'); $('#hear').classList.add('hide');
    $('#line').innerHTML = opts.map((t, i) => `<div class="ch"><button class="chh" data-i="${i}" aria-label="ស្ដាប់"><svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 010 7"/></svg></button><button class="cht" data-i="${i}">${t.split(' ').filter(Boolean).map(w => isPunct(w) ? `<span class="p">${esc(w)}</span>` : `<span class="tk">${kw(w)}</span>`).join(' ')}</button></div>`).join('');
    $('#line').querySelectorAll('.chh').forEach(b => b.onclick = e => { e.stopPropagation(); speaking = 'me'; sayPhrase(opts[+b.dataset.i]); });
    $('#line').querySelectorAll('.cht').forEach(b => b.onclick = e => { e.stopPropagation(); $('#dlg').classList.add('hide'); ui = null; res(opts[+b.dataset.i]); });
  });
}
async function talk(lines) { for (const l of lines) await say(...l); }
function dlgTap() { if (dlgRes) dlgRes(); }
$('#dlg').onclick = dlgTap;
$('#hear').onclick = e => { e.stopPropagation(); if (curLine) hearLine(curLine.text, curLine.o.lang); };
async function hearLine(text, lang) {
  const my = ++hearing;
  if (lang) { await wait(.2); if (my === hearing) playWord(text, lang); return; }
  const els = [...$('#line').querySelectorAll('.w')], tk = tokens(text);
  await wait(.15);
  // whole phrases through the device's Khmer voice when it has one; otherwise word by word through tnefar
  if (kmVoice) { const line = tk.map(t => t.km).filter(w => !isPunct(w) || w === '។').join(' ').replace(/ ។/g, '។'); els.forEach(e => e.classList.add('play')); try { await sayTTS(line); } catch (e) { } els.forEach(e => e.classList.remove('play')); return; }
  for (const el of els) { if (my !== hearing) return; el.classList.add('play'); await playWord(tk[+el.dataset.i].km); el.classList.remove('play'); await wait(.05); }
}
function pop(el, w) {
  const p = $('#pop'), r = el.getBoundingClientRect(), img = thumb(w), n = NUMS[w];
  p.innerHTML = (img ? `<img src="${img}" alt="">` : n ? `<span class="num">${khNum(n)}</span>` : '') + `<b>${esc(w)}</b><u>${esc(ipaOf(w))}</u>`;
  p.style.left = clamp(r.left + r.width / 2, 70, innerWidth - 70) + 'px'; p.style.top = Math.max(img ? 150 : 70, r.top - 6) + 'px'; p.classList.remove('hide');
  clearTimeout(p._t); p._t = setTimeout(() => p.classList.add('hide'), 2400);
}
function flashTag(w) { for (const o of tags[w] || []) { const s = o.scale.clone(); let t = 0; anims.push(dt => { t += dt; const k = 1 + .25 * Math.sin(t * 12) * (1 - t / 1.2); o.scale.copy(s).multiplyScalar(k); if (t > 1.2) { o.scale.copy(s); return false; } }); } }
let toastT;
// a phrase out loud: the device's Khmer voice if it has one, else word by word through tnefar
async function sayPhrase(text) { if (kmVoice) { try { return await sayTTS(text); } catch (e) { } } for (const w of text.split(' ')) if (w && !isPunct(w)) { await playWord(w); await wait(.05); } }
function cap(w) { toast(w); speaking = 'god'; playWord(w); }
function toast(big, small = '') { const t = $('#toast'); t.innerHTML = (big ? `<b>${esc(big)}</b>` : '') + (small ? `<i>${esc(small)}</i>` : ''); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

/* ---------------- thumbnails (the word's own low-poly model) ---------------- */
let tR, tS, tC; const thumbs = {};
function thumb(w) {
  if (w in thumbs) return thumbs[w]; const f = PIC[w]; if (!f) return thumbs[w] = null;
  try {
    if (!tR) { const c = document.createElement('canvas'); tR = new THREE.WebGLRenderer({ canvas: c, antialias: false, preserveDrawingBuffer: true, alpha: true }); tR.setSize(56, 56, false); tS = new THREE.Scene(); tS.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.5)); const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(2, 4, 5); tS.add(d); tC = new THREE.PerspectiveCamera(32, 1, .1, 300); }
    const o = f(); tS.add(o); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), s = Math.max(.5, b.getSize(new THREE.Vector3()).length());
    tC.position.set(c.x + s * .75, c.y + s * .45, c.z + s * 1.45); tC.lookAt(c); tR.render(tS, tC);
    const url = tR.domElement.toDataURL(); tS.remove(o); return thumbs[w] = url;
  } catch (e) { return thumbs[w] = null; }
}

/* ---------------- keyboard: speaking a word ---------------- */
const CONS = 'ក ខ គ ឃ ង ច ឆ ជ ឈ ញ ដ ឋ ឌ ឍ ណ ត ថ ទ ធ ន ប ផ ព ភ ម យ រ ល វ ស ហ ឡ អ'.split(' ');
const VOWS = 'ា ិ ី ឹ ឺ ុ ូ ួ ើ ឿ ៀ េ ែ ៃ ោ ៅ ំ ះ ់ ៉ ៊ ័ ៌ ឥ ឪ ឲ ឫ'.split(' ');
const isDep = c => c >= 'ា' && c <= '៓';
let kbPage = 0, typed = '', guideW = null;
const speakers = [];
function speakAt(words, at = null, r = 6, hint = true) { return new Promise(res => speakers.push({ words, at, r, hint, res })); }
function openKB() {
  if (ui) return; ensureAudio(); ui = 'kb'; typed = ''; joyEnd(); $('#kb').classList.remove('hide');
  const w = speakers.find(s => s.hint && (!s.at || within(s.at, s.r)));
  guideW = w ? w.words[0] : null; renderKnown(); renderKB();
  $('#kbmsg').textContent = guideW ? 'ចុច អក្សរ ដែល ភ្លឺ ។' : 'សរសេរ ពាក្យ មួយ ហើយ និយាយ ។';
}
function renderKnown() {
  const list = [...new Set([...(guideW ? [guideW] : []), ...S.said])];
  $('#known').innerHTML = list.map(w => `<button class="${guideW === w ? 'sel' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('');
  $('#known').querySelectorAll('button').forEach(b => b.onclick = () => { guideW = guideW === b.dataset.w ? null : b.dataset.w; speaking = 'me'; playWord(b.dataset.w); renderKnown(); renderKB(); });
}
function nextChar() { if (!guideW) return null; const g = guideW.normalize('NFC'); if (!g.startsWith(typed)) return 'BK'; return g[typed.length] || 'GO'; }
function renderKB() {
  const nc = nextChar(), keys = kbPage ? VOWS : CONS, shown = c => isDep(c) ? '◌' + c : c;
  let h = keys.map(c => `<button class="k${nc === c ? ' next' : ''}" data-c="${c}">${shown(c)}</button>`).join('');
  const other = nc && (kbPage ? CONS : VOWS).includes(nc);
  h += `<button class="k fn${other ? ' next' : ''}" data-f="page" style="grid-column:span 2">${kbPage ? 'ក ព្យញ្ជនៈ' : '◌ា ស្រៈ'}</button>`;
  h += `<button class="k${nc === '្' ? ' next' : ''}" data-c="្">◌្</button><button class="k fn${nc === 'BK' ? ' next' : ''}" data-f="bk">⌫</button>`;
  h += `<button class="k go${nc === 'GO' ? ' next' : ''}" data-f="go" style="grid-column:span 2">និយាយ</button>`;
  $('#keys').innerHTML = h;
  $('#keys').querySelectorAll('.k').forEach(b => b.onpointerdown = e => { e.preventDefault(); const f = b.dataset.f; if (f === 'page') { kbPage ^= 1; renderKB(); } else if (f === 'bk') { typed = [...typed].slice(0, -1).join(''); upd(); } else if (f === 'go') speakTyped(); else { typed += b.dataset.c; upd(); } });
  $('#tx').textContent = typed; $('#ghost').textContent = guideW || ''; $('#ghost').style.visibility = typed ? 'hidden' : 'visible';
}
function upd() { const nc = nextChar(); if (nc && nc.length === 1) { if (!kbPage && VOWS.includes(nc)) kbPage = 1; else if (kbPage && CONS.includes(nc)) kbPage = 0; } renderKB(); }
function kbKey(e) { if (e.key === 'Escape') return closeAll(); if (e.key === 'Enter') { e.preventDefault(); return speakTyped(); } if (e.key === 'Backspace') { typed = [...typed].slice(0, -1).join(''); return upd(); } if (e.key.length === 1 && e.key >= 'ក' && e.key <= '៿') { typed += e.key; upd(); } }
$('#kbclose').onclick = () => closeAll(); $('#bB').onclick = () => openKB();
function speakTyped() {
  const w = norm(typed); if (!w) return;
  const word = Object.keys(S.seen).concat(speakers.flatMap(s => s.words)).find(k => norm(k) === w) || typed.normalize('NFC');
  closeAll(); speaking = 'me'; playWord(word); floatWord(word);
  const s = speakers.find(s => s.words.some(k => norm(k) === w) && (!s.at || within(s.at, s.r)));
  if (s) { speakers.splice(speakers.indexOf(s), 1); if (!S.said.includes(word)) S.said.push(word); save(); s.res(word); }
  else setTimeout(() => toast('', '... គ្មាន អ្វី កើត ឡើង ទេ ។'), 900);
}
const within = (at, r) => { const p = atXZ(at); return p && Math.hypot(p[0] - player.x, p[1] - player.z) < r; };
function closeAll() { ['#kb', '#book'].forEach(s => $(s).classList.add('hide')); if (ui !== 'dlg') ui = null; }

/* ---------------- book ---------------- */
let bookTab = 'words';
function openBook() { if (ui) return; ui = 'book'; joyEnd(); $('#book').classList.remove('hide'); renderBook(); }
function renderBook() {
  const body = $('#bookbody'); document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.t === bookTab));
  if (bookTab === 'words') {
    body.className = '';
    const ws = Object.keys(S.seen);
    body.innerHTML = ws.map((w, i) => { const n = NUMS[w]; return `<button class="card" data-i="${i}">${PIC[w] ? `<img data-w="${esc(w)}" alt="">` : n ? `<span class="num">${khNum(n)}</span>` : '<span class="blank"></span>'}<b>${esc(w)}</b><u>${esc(ipaOf(w))}</u><small>× ${khNum(S.seen[w])}</small></button>`; }).join('');
    body.querySelectorAll('.card').forEach(c => c.onclick = () => { speaking = 'me'; playWord(ws[+c.dataset.i]); });
    const imgs = [...body.querySelectorAll('img[data-w]')]; let k = 0; const step = () => { const t0 = performance.now(); while (k < imgs.length && performance.now() - t0 < 12) { imgs[k].src = thumb(imgs[k].dataset.w) || ''; k++; } if (k < imgs.length && ui === 'book') requestAnimationFrame(step); }; step();
  } else {
    body.className = 'list';
    body.innerHTML = CHAPTERS.map((c, i) => `<button class="chap${i > S.max ? ' lock' : ''}" data-i="${i}"><span class="n">${khNum(i + 1)}</span><span><strong>${esc(c.title)}</strong><small>${esc(c.ref)} · ${esc(c.who)}</small></span></button>`).join('');
    body.querySelectorAll('.chap').forEach(c => c.onclick = () => { S.ch = +c.dataset.i; save(); location.reload(); });
  }
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { bookTab = t.dataset.t; renderBook(); });
$('#bookbtn').onclick = openBook; $('#bookclose').onclick = closeAll;
$('#reset').onclick = () => { S = { ch: 0, max: 0, seen: {}, said: [] }; save(); location.reload(); };

/* ---------------- effects ---------------- */
const anims = [];
function tween(dur, f) { return new Promise(res => { let t = 0; anims.push(dt => { t = Math.min(dur, t + dt); f(ease(t / dur), t / dur); if (t >= dur) { res(); return false; } }); }); }
const PN = 500, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pData = [];
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); parts.frustumCulled = false; scene.add(parts);
for (let i = 0; i < PN; i++) { pData.push({ life: 0 }); pPos[i * 3 + 1] = -999; }
let pI = 0;
function emit(x, y, z, vx, vy, vz, c, life = 1.2, g = -2) { const d = pData[pI]; Object.assign(d, { x, y, z, vx, vy, vz, life, g }); const col = new THREE.Color(c); pCol.set([col.r, col.g, col.b], pI * 3); pI = (pI + 1) % PN; }
function burst(x, y, z, c, n = 40, sp = 3) { for (let i = 0; i < n; i++) emit(x, y, z, rnd(-sp, sp), rnd(0, sp * 1.4), rnd(-sp, sp), c, rnd(.6, 1.4)); }
function tickParts(dt) { for (let i = 0; i < PN; i++) { const d = pData[i]; if (d.life <= 0) { pPos[i * 3 + 1] = -999; continue; } d.life -= dt; d.vy += d.g * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; pPos.set([d.x, d.y, d.z], i * 3); } pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; }
let raining = 0;
function floatWord(w) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.font = '48px Battambang, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(w, 130, 66); g.fillStyle = '#f2c51c'; g.fillText(w, 128, 63);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false })); s.scale.set(3.2, 1.2, 1); s.position.set(player.x, player.y + 2.8, player.z); scene.add(s);
  burst(player.x, player.y + 2, player.z, 0xf2c51c, 24, 2);
  tween(2.2, (_, t) => { s.position.y = player.y + 2.8 + t * 1.6; s.material.opacity = 1 - t * t; }).then(() => scene.remove(s));
}
async function leapOut() {
  ensureAudio(); leapSound(); const f = $('#flash');
  if (hero) for (let i = 0; i < 6; i++) burst(player.x, player.y + 1, player.z, 0x80c0ff, 30, 4);
  await tween(.9, k => f.style.opacity = k);
}
async function card(title, ref) { const c = $('#card'); c.querySelector('b').textContent = title; c.querySelector('i').textContent = ref; c.classList.add('on'); await wait(2.6); c.classList.remove('on'); await wait(.5); }
// Al, the hologram who explains where (and who) you are
let al = null;
function showAl(on = true, dx = 2.4) { if (!al) { al = ent(person({ glow: 0x80c8ff }), player.x + dx, player.z, { solid: 0, fly: .1 }); al.isAl = true; } al.hide = !on; al.g.visible = on; if (on) { al.x = player.x + Math.cos(camYaw) * dx; al.z = player.z - Math.sin(camYaw) * dx; al.follow = 'player'; burst(al.x, player.y + 1, al.z, 0x80c8ff, 30, 2); } }
// the voice of God: a warm light
let godLight = null;
function godGlow(on, at) { if (!godLight) { godLight = glowOrb(0xfff0b0, 1.4); scene.add(godLight); } godLight.visible = on; if (at) godLight.position.set(...at); }

/* ---------------- main loop ---------------- */
let last = performance.now(), started = false;
const V3 = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
  // player
  if (hero) {
    let mx = 0, mz = 0;
    if (started && !ui && !cine && !track) {
      mx = input.jx; mz = input.jy; const K = input.keys;
      if (K.KeyW || K.ArrowUp) mz -= 1; if (K.KeyS || K.ArrowDown) mz += 1; if (K.KeyA || K.ArrowLeft) mx -= 1; if (K.KeyD || K.ArrowRight) mx += 1;
    }
    let l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; l = 1; }
    if (l > .08) {
      // speed is exactly how far the stick is pushed; no acceleration
      const s = Math.sin(camYaw), c = Math.cos(camYaw);
      const dx = s * mz + c * mx, dz = c * mz - s * mx, sp = 6.5 * dt;
      tryMove(dx * sp, dz * sp);
      player.yaw = Math.atan2(dx, dz);
    }
    player.y += (groundAt(player.x, player.z) - player.y) * Math.min(1, dt * 14);
    hero.g.position.set(player.x, player.y, player.z); hero.g.rotation.y = player.yaw;
    animLimbs(hero, l > .08 ? l : 0, dt);
  }
  // camera
  if (track) { const [p, l] = track(); camera.position.lerp(V3.set(...p), Math.min(1, dt * 3)); cineLook.lerp(new THREE.Vector3(...l), Math.min(1, dt * 3)); camera.lookAt(cineLook); }
  else if (cine) { cine.t = Math.min(cine.dur, cine.t + dt); const k = ease(cine.t / cine.dur); camera.position.lerpVectors(cine.from, cine.to, k); cineLook.lerpVectors(cine.lookFrom, cine.look, k); camera.lookAt(cineLook); }
  else if (hero) {
    // the camera eases round behind you only while you walk, and gently
    const moving = Math.hypot(input.jx, input.jy) > .08 || Object.values(input.keys).some(Boolean);
    if (moving && lookId == null) camYaw = turn(camYaw, player.yaw + Math.PI, dt * .12);
    const tx = player.x, ty = player.y + 1.5, tz = player.z;
    V3.set(tx + Math.sin(camYaw) * Math.cos(camPitch) * camDist, ty + Math.sin(camPitch) * camDist, tz + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
    V3.y = Math.max(V3.y, groundAt(V3.x, V3.z) + .6);
    camera.position.lerp(V3, Math.min(1, dt * 8)); cineLook.set(tx, ty, tz); camera.lookAt(cineLook);
  }
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  // sky
  const k = Math.min(1, dt * 1.5); skyNow.top.lerp(skyGoal.top, k); skyNow.hor.lerp(skyGoal.hor, k); skyNow.fog.lerp(skyGoal.fog, k); skyNow.light = lerp(skyNow.light, skyGoal.light, k); paintSky();
  if (water) { water.material.map.offset.x = t * .02; water.material.map.offset.y = t * .013; water.position.y = waterY + Math.sin(t * .8) * .05; }
  // ents
  for (const e of ents) {
    let moving = 0;
    if (e.follow) { const tx = e.follow === 'player' ? player.x : e.follow.x, tz = e.follow === 'player' ? player.z : e.follow.z; const d = Math.hypot(tx - e.x, tz - e.z), want = e.isAl ? 2.6 : e.gap || 2.6; if (d > want) { const s = Math.min(d - want, (e.isAl ? 9 : 7) * dt); e.x += (tx - e.x) / d * s; e.z += (tz - e.z) / d * s; e.yaw = Math.atan2(tx - e.x, tz - e.z); moving = 1; } else if (d < 6) e.yaw = turn(e.yaw, Math.atan2(tx - e.x, tz - e.z), dt); }
    else if (e.goal) { const dx = e.goal.x - e.x, dz = e.goal.z - e.z, d = Math.hypot(dx, dz); if (d < .2) { const r = e.goal.res; e.goal = null; r && r(); } else { const s = Math.min(d, e.speed * dt); e.x += dx / d * s; e.z += dz / d * s; e.yaw = turn(e.yaw, Math.atan2(dx, dz), dt * 2); moving = 1; } }
    else if (e.talk && hero && Math.hypot(player.x - e.x, player.z - e.z) < 6) e.yaw = turn(e.yaw, Math.atan2(player.x - e.x, player.z - e.z), dt);
    const gy = e.flyAbs != null ? e.flyAbs : groundAt(e.x, e.z) + e.fly + (e.isAl ? Math.sin(t * 2) * .15 + .2 : 0);
    e.y += (gy - e.y) * Math.min(1, dt * 10);
    e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
    if (e.m.legs) animLimbs(e.m, moving, dt, e);
    if (e.m.wings) e.m.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.sin(t * 14) * .7);
    if (e.m.segs) e.m.segs.forEach((s, i) => s.position.x = Math.sin(t * 4 - i * .7) * .18);
    if (e.tick) e.tick(dt, t);
  }
  for (let i = anims.length - 1; i >= 0; i--) if (anims[i](dt, t) === false) anims.splice(i, 1);
  tickParts(dt);
  if (raining > 0) for (let i = 0; i < raining; i++) emit(camera.position.x + rnd(-25, 25), camera.position.y + 14, camera.position.z + rnd(-25, 25), 0, -24, 0, 0x6090ff, 1, 0);
  // marker, arrow
  const g = atXZ(goalAt);
  if (g) { const gy = goalAt && goalAt.g ? goalAt.y + 3 : groundAt(g[0], g[1]) + 3.4; mk.position.set(g[0], gy + Math.sin(t * 3) * .3, g[1]); mk.rotation.y = t * 2; }
  drawArrow(g);
  // actions & reach & interactions
  if (started && hero) {
    let best = null, bd = 1e9;
    if (!ui) for (const a of acts) { const p = atXZ(a.at); if (!p) continue; const d = Math.hypot(p[0] - player.x, p[1] - player.z); if (d < a.r && d < bd) { bd = d; best = a; } }
    if (best !== curAct) { curAct = best; $('#lA').textContent = best ? best.label : ' '; $('#nA').classList.toggle('off', !best); $('#nA').classList.toggle('on', !!best); }
    for (let i = reachers.length - 1; i >= 0; i--) if (!ui && within(reachers[i].at, reachers[i].r)) { const r = reachers.splice(i, 1)[0]; r.res(); }
  }
  renderer.render(scene, camera);
}
function turn(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k * 6); }
function animLimbs(m, sp, dt, e) { const o = e || m; o.walkT = (o.walkT || 0) + dt * 10 * (sp ? 1 : 0); const a = sp ? Math.sin(o.walkT) * .7 * Math.min(1, sp + .3) : 0; m.legs.forEach((l, i) => l.rotation.x += ((i % 2 ? a : -a) * (m.legs.length > 2 && i > 1 ? -1 : 1) - l.rotation.x) * Math.min(1, dt * 12)); if (m.arms) m.arms.forEach((r, i) => { if (m === hero && player.carry) r.rotation.x += (-2.6 - r.rotation.x) * Math.min(1, dt * 10); else r.rotation.x += ((i ? -a : a) - r.rotation.x) * Math.min(1, dt * 12); }); }
function tryMove(dx, dz) {
  const r = .45; let nx = player.x + dx, nz = player.z + dz;
  const hit = (x, z) => solids.some(s => Math.hypot(x - s.x, z - s.z) < s.r + r) || ents.some(e => e.solid && !e.hide && e.g.visible && Math.hypot(x - e.x, z - e.z) < e.solid + r) || (waterY > -50 && groundAt(x, z) < waterY - .6 && !floors.some(f => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1)) || Math.hypot(x, z) > bound;
  if (!hit(nx, nz)) { player.x = nx; player.z = nz; } else if (!hit(nx, player.z)) player.x = nx; else if (!hit(player.x, nz)) player.z = nz;
  if (clampFn) { const [x, z] = clampFn(player.x, player.z); player.x = x; player.z = z; }
}
const arrowEl = $('#arrow');
function drawArrow(g) {
  if (!g || !started || ui || cine) return arrowEl.classList.add('hide');
  V3.set(g[0], groundAt(g[0], g[1]) + 2, g[1]).project(camera);
  const on = V3.z < 1 && Math.abs(V3.x) < .9 && Math.abs(V3.y) < .85;
  if (on) return arrowEl.classList.add('hide');
  let x = V3.x, y = V3.y; if (V3.z > 1) { x = -x; y = -y; }
  const a = Math.atan2(x, y), R = Math.min(innerWidth, innerHeight) * .38;
  arrowEl.style.left = innerWidth / 2 + Math.sin(a) * R * innerWidth / Math.min(innerWidth, innerHeight) * .9 + 'px'; arrowEl.style.top = innerHeight / 2 - Math.cos(a) * R + 'px'; arrowEl.style.transform = `rotate(${a}rad)`; arrowEl.classList.remove('hide');
}

/* ================= THE STORY ================= */
const CHAPTERS = [
  { title: 'ការបង្កើត', ref: 'លោកុប្បត្តិ ១', who: 'ពន្លឺ', run: creation },
  { title: 'សួនច្បារ អេដែន', ref: 'លោកុប្បត្តិ ២', who: 'អ័ដាម', run: adam },
  { title: 'ផ្លែឈើ ហាម', ref: 'លោកុប្បត្តិ ៣', who: 'អេវ៉ា', run: eve },
  { title: 'ទូក ធំ', ref: 'លោកុប្បត្តិ ៦–៩', who: 'ណូអេ', run: noah },
  // next leaps (written, not yet tested): { title: 'ប៉ម បាបិល', ref: 'លោកុប្បត្តិ ១១', who: 'អ្នកសង់', run: babel }, { title: 'ផ្កាយ និង ខ្សាច់', ref: 'លោកុប្បត្តិ ១២–២២', who: 'អាប់រ៉ាម', run: abram },
];
async function leapIn(heroKey, x, z, yaw, intro) {
  setHero(heroKey, x, z, yaw); showAl(false);
  camera.position.set(x + Math.sin(yaw) * 8, groundAt(x, z) + 4, z + Math.cos(yaw) * 8);
}
async function arrive(lines) {
  // the mirror moment: see who you have leapt into
  await mirror(); await wait(.4); burst(player.x, player.y + 1.2, player.z, 0x80c0ff, 60, 3); tone([880, 660], .5, 'triangle', .06);
  await say('me', 'អូយ !');
  await talk(lines);
  camFree(); camYaw = player.yaw + Math.PI;
}
function done(n) { S.max = Math.max(S.max, n); S.ch = n; save(); }
async function next(n) { done(n); goal(''); camFree(); await leapOut(); hero = null; return CHAPTERS[n] ? playChapter(n) : ending(); }
async function playChapter(n) {
  S.ch = n; save(); const c = CHAPTERS[n];
  $('#flash').style.opacity = 1; clearWorld(); al = null; godGlow(false);
  await c.run.build?.();
  $('#hud').classList.remove('hide'); started = true;
  await card(c.title, c.ref);
  const run = c.run(); tween(1.2, k => $('#flash').style.opacity = 1 - k);
  await run;
}

/* ---- 0. creation: the world forms as the words are spoken ---- */
const edenH = (x, z) => { const r = Math.hypot(x, z); const hills = 1.6 + Math.sin(x * .07) * 1.4 + Math.cos(z * .06) * 1.2 + Math.sin((x + z) * .13) * .5; const river = Math.max(0, 1 - Math.abs(z - 22 - Math.sin(x * .08) * 4) / 4) * 3; return hills - river - Math.max(0, r - 70) * .35; };
const edenCol = (x, z, y) => y < .4 ? 0xd8c890 : y > 3.2 ? 0x4a9a3a : 0x5aac3a;
const FRUITS = [[14, 6], [-12, 10], [20, -12], [-18, -8], [6, 18], [-6, -38], [24, 10], [-26, 4], [10, -30], [30, -24], [-30, -22], [-4, 30]];
function buildEden(trees = true) {
  H = edenH; bound = 78; terrain(200, 50, edenCol); addWater(0, 0x3a8ae0);
  const out = { trees: [], life: null, know: null };
  if (trees) {
    for (const [x, z] of FRUITS) { const t = tree({ fruit: [0xe03a2a, 0xf0a020, 0x9a2ad0][(x * z & 3) % 3], s: rnd(.9, 1.2) }); place(t.g, x, z, rnd(0, 6), 1); out.trees.push({ x, z, t }); tag('ដើមឈើ', t.g); tag('ផ្លែឈើ', t.g); }
    for (let i = 0; i < 60; i++) { const a = rnd(0, 6.28), r = rnd(36, 68), x = Math.cos(a) * r, z = Math.sin(a) * r; if (edenH(x, z) < .6) continue; const t = Math.random() < .4 ? tree({ palm: true }) : tree({ s: rnd(.8, 1.4) }); place(t.g, x, z, rnd(0, 6), .8); tag('ដើមឈើ', t.g); }
    const k = tree({ s: 1.8, leaf: 0x2a6a4a, leaf2: 0x3a8a5a, fruit: 0xf2c51c, n: 9 }); place(k.g, 0, -24, 0, 2); out.know = k; tag('ដើមឈើ', k.g);
    const glow = glowOrb(0xf2c51c, .6); glow.position.set(0, 7.5, -24); world.add(glow);
    for (let i = 0; i < 40; i++) { const x = rnd(-60, 60), z = rnd(-60, 60); if (edenH(x, z) < .5) continue; const f = cone(.15, .5, [0xff70a0, 0xffffff, 0xffe040][i % 3], x, edenH(x, z) + .2, z, world, 4); }
  }
  return out;
}
async function creation() {
  // every tap makes exactly that word happen, framed by a locked camera
  setSky(0x000000, 0x000000, 0x000000, 0, true); scene.fog.near = 30; scene.fog.far = 260;
  H = () => -20; goal('');
  const shot = (p, l, d = 1.6) => camTo(p, l, d);
  camera.position.set(0, 12, 50); cineLook.set(0, 12, 0); await shot([0, 12, 48], [0, 14, 0], .5);
  const show = async (w, day) => { toast(w); speaking = 'god'; await playWord(w); await wait(.8); if (day) { toast(day); await sayPhrase(day); await wait(.8); } };
  // light
  await say('god', 'ចូរ ឲ្យ មាន *ពន្លឺ !'); good();
  const light = glowOrb(0xfff4c0, 5); light.position.set(0, 16, 0); light.scale.setScalar(.01); scene.add(light);
  setSky(0x9a9aa8, 0xe8e8f0, 0xd0d0d8, .6); await tween(2, k => light.scale.setScalar(Math.max(.01, k)));
  await show('ពន្លឺ', 'ថ្ងៃ ទី មួយ'); scene.remove(light);
  // sky, then water
  await shot([0, 4, 40], [0, 40, -60]);
  await say('god', 'ចូរ ឲ្យ មាន *មេឃ !'); good();
  setSky(0x1a5ad0, 0xa8d0f0, 0xb8d8f0, 1);
  const clouds = []; for (let i = 0; i < 7; i++) { const c = grp(rnd(-60, 60), rnd(35, 55), rnd(-90, -40), world); for (let j = 0; j < 4; j++) mesh(new THREE.IcosahedronGeometry(rnd(3, 5), 0), MB(0xffffff, { fog: false }), j * 4 - 6, rnd(0, 2), 0, c); clouds.push(c); c.scale.setScalar(.01); }
  await tween(1.5, k => clouds.forEach(c => c.scale.setScalar(Math.max(.01, k))));
  await show('មេឃ');
  await shot([0, 10, 45], [0, -2, 0]);
  await say('god', 'ចូរ ឲ្យ មាន *ទឹក !'); good();
  addWater(0, 0x2a6ad0); water.material.opacity = 0; await tween(2, k => water.material.opacity = k * .85);
  await show('ទឹក', 'ថ្ងៃ ទី ពីរ');
  // land, grass, trees
  await shot([0, 30, 95], [0, 0, 0]);
  await say('god', 'ចូរ ឲ្យ មាន *ដី !'); good();
  H = edenH; const land = terrain(200, 50, (x, z, y) => y < .4 ? 0xd8c890 : 0x8a6a3a); land.position.y = -8;
  await tween(3, k => land.position.y = -8 * (1 - k));
  await show('ដី');
  await shot([2, edenH(2, 14) + 2.2, 14], [-2, edenH(-2, 2) + .5, 2]);
  await say('god', 'ចូរ ឲ្យ មាន *ស្មៅ !'); good();
  recolor(edenCol);
  const tufts = []; for (let i = 0; i < 70; i++) { const x = rnd(-10, 10), z = rnd(-2, 12); const t = cone(.12, .7, 0x5aaa3a, x, edenH(x, z) + .3, z, world, 3); t.scale.setScalar(.01); tufts.push(t); }
  await tween(1.5, k => tufts.forEach(t => t.scale.setScalar(Math.max(.01, k))));
  await show('ស្មៅ');
  await shot([0, 14, 48], [0, 3, 0]);
  await say('god', 'ចូរ ឲ្យ មាន *ដើមឈើ !'); good();
  const trees = []; for (const [x, z] of FRUITS) { const t = tree({ fruit: 0xe03a2a }); place(t.g, x, z); trees.push(t.g); }
  for (let i = 0; i < 50; i++) { const a = rnd(0, 6.28), r = rnd(30, 66), x = Math.cos(a) * r, z = Math.sin(a) * r; if (edenH(x, z) < .6) continue; const t = tree({ s: rnd(.8, 1.4), palm: Math.random() < .4 }); place(t.g, x, z); trees.push(t.g); }
  for (const t of trees) t.scale.setScalar(.01);
  await tween(2.5, k => trees.forEach((t, i) => t.scale.setScalar(clamp(k * 2 - i / trees.length, .01, 1))));
  await show('ដើមឈើ', 'ថ្ងៃ ទី បី');
  // sun, moon, stars
  await shot([0, 8, 60], [60, 30, -200]);
  await say('god', 'ចូរ ឲ្យ មាន *ព្រះអាទិត្យ !'); good();
  const sunO = glowOrb(0xffd040, 12); sunO.position.set(70, -30, -250); world.add(sunO);
  await tween(3, k => sunO.position.y = -30 + k * 90);
  await show('ព្រះអាទិត្យ');
  setSky(0x0a1440, 0x3a2a6a, 0x1a1a3a, .25); await shot([0, 8, 60], [-120, 70, -200], 2);
  await say('god', 'ចូរ ឲ្យ មាន *ព្រះចន្ទ !'); good();
  const moonO = ball(9, MB(0xf4f0d8, { fog: false }), -150, 90, -230, world, 8, 6); moonO.scale.setScalar(.01);
  await tween(2, k => moonO.scale.setScalar(Math.max(.01, k)));
  await show('ព្រះចន្ទ');
  await shot([0, 6, 40], [0, 80, -40]);
  await say('god', 'ចូរ ឲ្យ មាន *ផ្កាយ !'); good();
  await tween(2.5, k => stars.material.opacity = k);
  await show('ផ្កាយ', 'ថ្ងៃ ទី បួន');
  setSky(0x2a6ad0, 0xa8d0f0, 0xb8d8f0, 1); await tween(1.5, k => stars.material.opacity = 1 - k);
  // fish, birds
  await shot([0, 3, 102], [0, 0, 78]);
  await say('god', 'ចូរ ឲ្យ មាន *ត្រី !'); good();
  for (let i = 0; i < 10; i++) { const f = fish([0xff8030, 0x30c0ff, 0xffe040][i % 3]); const e = ent(f, 0, 0, { solid: 0 }); const x0 = rnd(-14, 14), z0 = rnd(80, 92), ph0 = rnd(0, 1); e.tick = (dt, t) => { const ph = (t * .6 + ph0) % 1; e.x = x0 + ph * 3; e.z = z0; e.flyAbs = -.8 + Math.sin(ph * Math.PI) * 2.5; e.yaw = Math.PI / 2; e.g.rotation.x = 0; e.g.rotation.z = Math.cos(ph * Math.PI) * .9; }; tag('ត្រី', f.g); }
  await wait(2); await show('ត្រី');
  await shot([0, 8, 45], [0, 20, 0]);
  await say('god', 'ចូរ ឲ្យ មាន *បក្សី !'); good();
  for (let i = 0; i < 12; i++) { const b = bird([0xffffff, 0x3a8ae0, 0xe04040, 0xf2c51c][i % 4]); const e = ent(b, 0, 0, { solid: 0 }); const a0 = rnd(0, 6.28), r = rnd(8, 22), h = rnd(14, 24); e.tick = (dt, t) => { const a = a0 + t * .4 * (i % 2 ? 1 : -1); e.x = Math.cos(a) * r; e.z = Math.sin(a) * r; e.flyAbs = h + Math.sin(t + i) * 2; e.yaw = (i % 2 ? -a : -a + Math.PI); }; tag('បក្សី', b.g); }
  await wait(1.5); await show('បក្សី', 'ថ្ងៃ ទី ប្រាំ');
  // animals, then people
  await shot([0, 7, 30], [0, 2, 0]);
  await say('god', 'ចូរ ឲ្យ មាន *សត្វ !'); good();
  for (const [k, n] of [['cow', 2], ['sheep', 3], ['lion', 1], ['elephant', 1], ['monkey', 2], ['camel', 1], ['horse', 2]]) for (let i = 0; i < n; i++) { const a = animal(k); const x = rnd(-22, 22), z = rnd(-14, 12); const e = ent(a, x, z, { speed: 1.5 }); a.g.scale.setScalar(.01); tween(1.5, q => a.g.scale.setScalar(Math.max(.01, q))); burst(x, edenH(x, z) + 1, z, 0xffffff, 12, 1.5); wander(e, 8); tag('សត្វ', a.g); }
  await wait(1.5); await show('សត្វ');
  await shot([0, edenH(0, 6) + 2.5, 6], [0, edenH(0, 0) + 1.2, 0]);
  await say('god', 'ចូរ ឲ្យ មាន *មនុស្ស !'); good();
  const dust = setInterval(() => burst(rnd(-.6, .6), edenH(0, 0) + rnd(0, 2), rnd(-.6, .6), 0xd8b080, 8, 1), 50);
  const man = person(HEROES.adam); man.g.position.set(0, edenH(0, 0), 0); world.add(man.g); man.g.scale.setScalar(.01);
  await tween(2.5, k => man.g.scale.setScalar(Math.max(.01, k))); clearInterval(dust);
  await show('មនុស្ស', 'ថ្ងៃ ទី ប្រាំមួយ');
  await next(1);
}
function wander(e, r) { const hx = e.x, hz = e.z; const go = () => { if (!ents.includes(e) || e.follow || e.stop) return; walk(e, hx + rnd(-r, r), hz + rnd(-r, r)).then(() => setTimeout(go, rnd(800, 4000))); }; go(); }

/* ---- 1. Adam names the animals ---- */
adam.build = () => { setSky(0x3a7ae0, 0xc8e4f0, 0xc0e0e8, 1, true); scene.fog.near = 40; scene.fog.far = 160; buildEden(); };
async function adam() {
  await leapIn('adam', 4, 4, 0);
  await arrive([['al', 'អ្នក ជា អ័ដាម ។ មនុស្ស ទី មួយ ។'], ['al', 'ខ្ញុំ ឈ្មោះ អាល់ ។ ខ្ញុំ ជួយ អ្នក ។'], ['al', 'ធ្វើ ឲ្យ រឿង ទៅ មុខ ។']]);
  godGlow(true, [0, 14, -10]);
  await talk([['god', 'អ័ដាម ! នេះ ជា សួនច្បារ អេដែន ។'], ['god', 'ហូប ផ្លែឈើ បាន ។']]);
  goal('ហូប ផ្លែឈើ ។', FRUITS[0]);
  await pick(FRUITS.map(([x, z]) => ['ហូប ផ្លែឈើ', [x, z], 3.5]));
  burst(player.x, player.y + 2, player.z, 0xe03a2a, 20, 1.5); good(); await say('me', 'ឆ្ងាញ់ !');
  goal('ទៅ ដើមឈើ នៅ កណ្ដាល សួនច្បារ ។', [0, -21]);
  await reach([0, -21], 5);
  await talk([['god', 'អ័ដាម ! មើល ដើមឈើ នេះ ។'], ['god', 'កុំ ហូប ផ្លែ ពី ដើមឈើ នេះ ។ បើ អ្នក ហូប អ្នក នឹង ស្លាប់ ។'], ['me', 'បាទ ។']]);
  await talk([['god', 'យើង នាំ សត្វ មក ។'], ['god', 'ដាក់ ឈ្មោះ ឲ្យ សត្វ ទាំងអស់ ។'], ['al', 'ចុច B ហើយ និយាយ ឈ្មោះ ។']]);
  const ZOO = [['cow', 'គោ'], ['sheep', 'ចៀម'], ['lion', 'តោ'], ['elephant', 'ដំរី'], ['monkey', 'ស្វា']];
  const named = [];
  for (const [kind, word] of ZOO) {
    const a = animal(kind); const a0 = Math.atan2(player.z, player.x) + rnd(-1, 1); const e = ent(a, player.x + Math.cos(a0) * 26, player.z + Math.sin(a0) * 26, { speed: 4 }); tag(word, a.g);
    goal(`សត្វ មក ។ មើល !`, e);
    await walk(e, player.x + 2.5, player.z + 2.5); e.yaw = Math.atan2(player.x - e.x, player.z - e.z);
    e.follow = 'player'; e.gap = 2.6;
    await say('me', `*${word} ?`);
    goal(`និយាយ « ${word} » ។`, e);
    await speakAt([word]); burst(e.x, e.y + 1.5, e.z, 0xf2c51c, 40, 2.5); good();
    toast(word); await wait(1.2);
    e.follow = null; named.push(e); wander(e, 10);
  }
  await talk([['al', 'គោ ចៀម តោ ដំរី ស្វា ។ សត្វ មាន គូ ។'], ['al', 'ប៉ុន្តែ អ័ដាម ... អ្នក នៅ តែ ម្នាក់ ឯង ។'], ['god', 'មនុស្ស នៅ ម្នាក់ ឯង មិន ល្អ ទេ ។'], ['god', 'ដេក ចុះ អ័ដាម ។']]);
  goal('ដេក នៅ លើ ស្មៅ ។', [6, -6]);
  await act('ដេក', [6, -6], 3.5);
  await camTo([player.x + 4, player.y + 3, player.z + 3], [player.x, player.y + .4, player.z], 1);
  await tween(1, k => { hero.b.rotation.x = -k * Math.PI / 2; hero.b.position.y = k * .3; }); toast('ដេក'); await wait(1.5);
  const f = $('#flash'); f.style.background = '#000'; await tween(1.2, k => f.style.opacity = k);
  hero.b.rotation.x = 0; hero.b.position.y = 0; camFree(); const eveE = npc('eve', HEROES.eve, 8.5, -4, Math.PI * 1.2); await wait(1.2);
  await tween(1.2, k => f.style.opacity = 1 - k); f.style.background = '';
  await talk([['al', 'ភ្ញាក់ ឡើង ! មើល !'], ['god', 'នេះ ជា ស្ត្រី ។ ជំនួយ សម្រាប់ អ្នក ។']]);
  goal('និយាយ « ស្ត្រី » ។', eveE);
  await speakAt(['ស្ត្រី']); good(); burst(eveE.x, eveE.y + 2, eveE.z, 0xff80c0, 50, 2);
  await talk([['me', 'ឆ្អឹង ពី ឆ្អឹង ខ្ញុំ ! សាច់ ពី សាច់ ខ្ញុំ !'], ['eve', 'អ័ដាម !'], ['al', 'ល្អ ណាស់ ។ រឿង ទៅ មុខ ។ ដល់ ពេល លោត ។']]);
  await next(2);
}

/* ---- 2. Eve and the forbidden fruit ---- */
eve.build = () => { setSky(0x3a7ae0, 0xf0d8b0, 0xe8d8b8, 1, true); scene.fog.near = 40; scene.fog.far = 160; buildEden(); const g = gate(); place(g, 66, 0, Math.PI / 2); for (const z of [-12, -8, -4, 4, 8, 12]) solids.push({ x: 66, z, r: 2 }); };
async function eve() {
  await leapIn('eve', -6, 8, Math.PI);
  const adamE = npc('adam', HEROES.adam, -3, 10, Math.PI);
  await arrive([['al', 'អ្នក ជា អេវ៉ា ។'], ['al', 'ថ្ងៃ នេះ ... រឿង ពិបាក ។'], ['al', 'អ្នក ត្រូវ ធ្វើ ឲ្យ រឿង ទៅ មុខ ។ មិន មែន ធ្វើ ល្អ ទេ ។']]);
  const sn = snake(); const snE = ent(sn, 1.5, -21.5, { solid: 0, speed: 2 }); tag('ពស់', sn.g); snE.talk = 'snake';
  goal('ទៅ ដើមឈើ នៅ កណ្ដាល សួនច្បារ ។', [0, -21]);
  await reach([0, -21], 6);
  await camTo([player.x + 4.5, player.y + 2.6, player.z + 2.5], [1, player.y + .8, -21.5], 1.2);
  await talk([['snake', 'អេវ៉ា ... អេវ៉ា ...'], ['snake', 'ព្រះជាម្ចាស់ ថា កុំ ហូប ផ្លែឈើ មែន ទេ ?'], ['me', 'យើង ហូប ផ្លែឈើ បាន ។ ប៉ុន្តែ ផ្លែ ពី ដើមឈើ នេះ ... កុំ ហូប ។ យើង នឹង ស្លាប់ ។'], ['snake', 'អ្នក មិន ស្លាប់ ទេ ! អ្នក នឹង ដូច ព្រះ ។'], ['snake', 'អ្នក នឹង ស្គាល់ ល្អ និង អាក្រក់ ។'], ['al', '... រឿង ត្រូវ ទៅ មុខ ។']]);
  camFree(); goal('យក ផ្លែ ។', [0, -24]);
  await act('យក ផ្លែ', [0, -24], 4.5);
  const fr = ball(.25, 0xf2c51c, 0, 0, 0, null, 6, 4); carry(fr); tone([300, 260], .5, 'triangle', .06);
  goal('ហូប ផ្លែ ។', null);
  await act('ហូប ផ្លែ', [player.x, player.z], 99);
  drop(); tone([200, 150, 110], 1.4, 'sawtooth', .05); setSky(0x5a5a7a, 0xb08870, 0x9a8070, .7);
  const fr2 = ball(.25, 0xf2c51c, 0, 0, 0, null, 6, 4); carry(fr2);
  goal('ឲ្យ ផ្លែ ទៅ អ័ដាម ។', adamE);
  adamE.follow = null; walk(adamE, 4, -16, 3);
  await act('ឲ្យ ផ្លែ', adamE, 3.5); drop();
  await talk([['adam', '...'], ['al', 'អ័ដាម ក៏ ហូប ដែរ ។'], ['me', 'អូយ ... យើង ខ្លាច ។'], ['adam', 'យើង ត្រូវ លាក់ ខ្លួន !']]);
  setSky(0x2a2a50, 0xc06040, 0x7a5050, .45);
  const bushes = [[-22, 12], [-26, 16], [-18, 18]]; for (const [x, z] of bushes) { const b = bush(); b.scale.setScalar(1.6); place(b, x, z); tag('ព្រៃ', b); }
  godGlow(true, [0, 12, -6]);
  await say('god', 'អ័ដាម ! តើ អ្នក នៅ ឯណា ?');
  goal('លាក់ ខ្លួន នៅ ក្នុង ព្រៃ ។', [-22, 14]);
  walk(adamE, -24, 13, 4);
  await act('លាក់ ខ្លួន', [-22, 14], 5);
  await camTo([-22, 9, 28], [-22, 1, 14], 1.2);
  await talk([['adam', 'ខ្ញុំ ខ្លាច ។ ខ្ញុំ លាក់ ខ្លួន ។'], ['god', 'តើ អ្នក ហូប ផ្លែ ពី ដើមឈើ នោះ ឬ ?'], ['adam', 'ស្ត្រី ឲ្យ ខ្ញុំ ។'], ['god', 'អេវ៉ា ... ហេតុ អ្វី ?'], ['me', 'ពស់ បញ្ឆោត ខ្ញុំ ។']]);
  await talk([['god', 'ពស់ ! អ្នក នឹង លូន លើ ដី ។'], ['god', 'អ័ដាម អេវ៉ា ... ចេញ ពី សួនច្បារ ។']]);
  camFree(); world.remove(sn.g); ents.splice(ents.indexOf(snE), 1);
  // clothes of skin: mercy on the way out
  burst(player.x, player.y + 1, player.z, 0xffe0a0, 50, 2);
  world.remove(hero.g); hero = person({ ...HEROES.eve, leaves: false, top: 0x8a5a30, bottom: 0x8a5a30, robe: true }); world.add(hero.g);
  world.remove(adamE.g); adamE.m = person({ ...HEROES.adam, leaves: false, top: 0x8a5a30, bottom: 0x7a4a28 }); adamE.g = adamE.m.g; world.add(adamE.g);
  await talk([['al', 'មើល ! ព្រះជាម្ចាស់ ធ្វើ សម្លៀកបំពាក់ ឲ្យ អ្នក ។'], ['al', 'ព្រះជាម្ចាស់ នៅ តែ ស្រឡាញ់ អ្នក ។']]);
  adamE.follow = 'player'; adamE.gap = 2.2;
  const cher = ent(person({ glow: 0xffffff, scale: 1.4 }), 68, 0, { solid: 0, fly: .3 }); tag('ទេវតា', cher.g);
  const sw = new THREE.Group(); box(.15, 2.4, .05, MB(0xff8020), 0, 1.2, 0, sw); cher.g.add(sw); sw.position.set(.7, 1.2, .4); anims.push((dt, t) => { sw.rotation.z = Math.sin(t * 6) * .4; if (Math.random() < .3) emit(cher.x + .7, cher.y + 2.4, cher.z + .4, rnd(-1, 1), 2, rnd(-1, 1), 0xff8020, .5); });
  goal('ចេញ ទៅ ទិស ខាងកើត ។', [62, 0]);
  await reach([62, 0], 5);
  await talk([['angel', 'ទេវតា ការពារ ផ្លូវ ទៅ ដើមឈើ ជីវិត ។'], ['al', 'រឿង នេះ ក្រៀមក្រំ ... ប៉ុន្តែ រឿង មិន ទាន់ ចប់ ទេ ។'], ['al', 'ថ្ងៃ មួយ ព្រះជាម្ចាស់ នឹង ជួយ មនុស្ស ។ ដល់ ពេល លោត ។']]);
  await next(3);
}

/* ---- 3. Noah ---- */
const noahH = (x, z) => 2 + Math.sin(x * .05) * 2.5 + Math.cos(z * .045) * 2 + Math.sin((x - z) * .11) * .6 - Math.max(0, Math.hypot(x, z) - 75) * .4;
const araratH = (x, z) => { const d = Math.hypot(x - 0, z + 10); return 22 * Math.exp(-(d * d) / 700) + noahH(x, z) * .8 + 2 + Math.sin(x * .1) * 1.5; };
const noahCol = (x, z, y) => y < 1 ? 0xb8a878 : y > 4 ? 0x6a8a3a : 0x7a9a40;
let arkO = null;
noah.build = () => {
  setSky(0x4a7ac0, 0xd8d0b0, 0xd0c8b0, 1, true); scene.fog.near = 40; scene.fog.far = 170;
  H = noahH; bound = 80; terrain(200, 50, noahCol);
  arkO = ark(0); place(arkO.g, 0, -10, 0); arkO.g.position.y = noahH(0, -10) - .2;
  solids.push({ x: -8, z: -10, r: 3.8 }, { x: 0, z: -10, r: 3.8 }, { x: 8, z: -10, r: 3.8 }); tag('ទូក', arkO.g);
  for (let i = 0; i < 40; i++) { const x = rnd(-70, 70), z = rnd(-70, 70); if (Math.hypot(x, z + 10) < 18) continue; const t = tree({ s: rnd(.8, 1.3), leaf: 0x4a7a2a }); place(t.g, x, z, 0, .8); tag('ដើមឈើ', t.g); }
  for (let i = 0; i < 6; i++) { const h = grp(); box(3, 2, 3, 0xc8b088, 0, 1, 0, h); cone(2.6, 1.4, 0x8a6a3a, 0, 2.7, 0, h, 4).rotation.y = Math.PI / 4; place(h, 40 + (i % 3) * 7, 20 + Math.floor(i / 3) * 8, 0, 2); }
};
async function noah() {
  await leapIn('noah', 6, 4, Math.PI);
  const wife = npc('wife', { skin: 0xa07050, top: 0x8a3a3a, robe: true, cloth: 0xe0d0b0, female: true }, -5, 2, 0);
  const sons = [0x3a6a8a, 0x8a7a3a, 0x5a3a6a].map((c, i) => npc('son', { skin: 0xa07050, top: c, bottom: 0x6a5a40, hair: 0x2a1a10 }, -10 + i * 4, -3.5, Math.PI));
  for (const s of sons) s.tick = (dt, t) => s.m.arms[1].rotation.x = -1.5 + Math.sin(t * 8 + s.x) * .6;
  await arrive([['al', 'អ្នក ជា ណូអេ ។'], ['al', 'មនុស្ស ច្រើន ធ្វើ អាក្រក់ ។ ប៉ុន្តែ ណូអេ ជា មនុស្ស ល្អ ។'], ['al', 'ធ្វើ ឲ្យ រឿង ទៅ មុខ ។']]);
  godGlow(true, [0, 22, -10]);
  await talk([['god', 'ណូអេ ! ធ្វើ ទូក ធំ មួយ ។'], ['god', 'ទឹកជំនន់ នឹង មក ។ ទឹក នឹង គ្រប ដី ទាំងអស់ ។']]);
  godGlow(false);
  const piles = [[-30, 14], [26, -30], [-36, -26], [30, 30]].map(([x, z]) => { const p = logPile(); place(p, x, z, rnd(0, 3)); tag('ឈើ', p); return { x, z, p }; });
  for (let n = 1; n <= 4; n++) {
    goal(`យក ឈើ ។ ( ${khNum(n - 1)} / ${khNum(4)} )`, piles.find(p => p.p.visible) && [piles.find(p => p.p.visible).x, piles.find(p => p.p.visible).z]);
    const pp = await pick(piles.filter(p => p.p.visible).map(p => ['យក ឈើ', [p.x, p.z], 3.5, p]));
    pp.p.visible = false; carry(log()); tone([400], .2, 'square', .05);
    if (n === 2) { const nb = npc('nb', { skin: 0x9a6a44, top: 0x6a6a2a, hair: 0x1a1010 }, player.x + 3, player.z + 2); await talk([['nb', 'ហាហា ! ណូអេ ! ហេតុ អ្វី ធ្វើ ទូក នៅ លើ ដី ?'], ['nb', 'មិន មាន ទឹក ទេ !'], ['me', 'ទឹកជំនន់ នឹង មក ។']]); walk(nb, 45, 25, 3); }
    goal('ដាក់ ឈើ នៅ ទូក ។', [0, -4]);
    await act('ដាក់ ឈើ', [0, -4], 5); drop();
    arkO.setStage(n); burst(0, H(0, -10) + 3, -10, 0xd8a060, 50, 4); good(); toast(`ឈើ ${NUMW[n]}`);
    await wait(.4);
  }
  await talk([['wife', 'ទូក ធំ ណាស់ !'], ['god', 'ណូអេ ! យក សត្វ មក ពីរ ពីរ ។'], ['al', 'ទៅ ជិត សត្វ ហើយ និយាយ « មក » ។']]);
  godGlow(true, [0, 22, -10]); setTimeout(() => godGlow(false), 4000);
  const PAIRS = [['cow', -34, 0], ['sheep', 34, 4], ['elephant', -20, -40], ['lion', 22, -42], ['monkey', -4, 40]];
  const pairs = PAIRS.map(([k, x, z]) => { const two = [0, 1].map(i => { const a = animal(k); const e = ent(a, x + i * 2.4, z + i, { speed: 4 }); wander(e, 3); return e; }); tag({ cow: 'គោ', sheep: 'ចៀម', elephant: 'ដំរី', lion: 'តោ', monkey: 'ស្វា' }[k], two[0].g); return { k, x, z, two }; });
  for (let n = 0; n < pairs.length; n++) {
    const left = pairs.filter(p => !p.in);
    goal(`ហៅ សត្វ ពីរ ពីរ ។ និយាយ « មក » ។ ( ${khNum(n)} / ${khNum(5)} )`, [left[0].two[0].x, left[0].two[0].z]);
    let p = null; while (!p) { await speakAt(['មក'], null, 0, true); p = left.find(q => Math.hypot(q.two[0].x - player.x, q.two[0].z - player.z) < 10); if (!p) toast('', 'សត្វ នៅ ឆ្ងាយ ។'); }
    p.in = true; good();
    for (const e of p.two) { e.stop = true; e.goal = null; }
    (async () => { for (const [i, e] of p.two.entries()) { await wait(i * .5); await walk(e, i * 1.4 - .7, 0, 6); await walk(e, 0, -6.5, 3); e.g.visible = false; e.hide = true; } })();
    toast('ពីរ !');
  }
  await wait(3);
  await talk([['al', 'សត្វ ចូល ទូក ហើយ ។'], ['god', 'ណូអេ ! ចូល ទូក ជាមួយ គ្រួសារ អ្នក ។']]);
  goal('ចូល ទូក ។', [0, -1]);
  await act('ចូល ទូក', [0, -1], 4);
  for (const e of [wife, ...sons]) { e.g.visible = false; e.hide = true; }
  // up on the deck; the door closes, the rain comes
  const deckY = () => arkO.g.position.y + 6.8;
  floors.push({ x0: -7, x1: 7, z0: -12.5, z1: -7.5, y: deckY });
  solids.length = 0; player.x = 0; player.z = -10; clampFn = (x, z) => [clamp(x, -6.5, 6.5), clamp(z, -12.2, -7.8)];
  track = () => [[26, arkO.g.position.y + 11, 20], [0, arkO.g.position.y + 4, -10]];
  setSky(0x30343e, 0x50586a, 0x485060, .4); raining = 6; tone([90], 3, 'sawtooth', .05, .5);
  const base = arkO.g.position.y; addWater(-3, 0x2a4a80);
  cap('ភ្លៀង');
  let dayN = 0;
  await tween(10, k => { waterY = -3 + k * 31; arkO.g.position.y = Math.max(base, waterY - .6) + Math.sin(performance.now() / 700) * .15; const d = Math.ceil(k * 40); if (d !== dayN) { dayN = d; goal(`ថ្ងៃ ទី ${khNum(d)}`); } });
  // under the water the land changes: the ark will come to rest on a mountain
  H = araratH; world.remove(ground); terrain(200, 50, (x, z, y) => y > 14 ? 0x8a8070 : noahCol(x, z, y)); world.children.forEach(c => { if (c.type === 'Group' && c !== arkO.g && c.position.y < 20 && !ents.some(e => e.g === c)) c.visible = false; });
  raining = 0; setSky(0x5a8ad0, 0xd0d8e0, 0xc8d0d8, .9);
  await wait(1);
  const dv = bird(0xffffff); const dove = ent(dv, 2, -9, { solid: 0, flyAbs: deckY() + .3 }); dove.tick = () => { if (!dove.flying) dove.flyAbs = deckY() + .3; }; tag('ព្រាប', dv.g);
  goal('លែង ព្រាប ។ និយាយ « ទៅ » ។', dove);
  await speakAt(['ទៅ'], null);
  dove.flying = true; await tween(3, k => { dove.x = 2 + k * 80; dove.flyAbs = deckY() + .3 + k * 20; });
  await tween(4, k => { waterY = 28 - k * 8; arkO.g.position.y = Math.max(araratH(0, -10) - .2, waterY - .6); });
  dove.x = 80; dove.yaw = -Math.PI / 2; const leaf = mesh(new THREE.OctahedronGeometry(.25, 0), 0x6aaa3a, 0, .1, .5, dv.g); leaf.scale.set(.5, .1, 1);
  await tween(3, k => { dove.x = 80 - k * 78; dove.flyAbs = deckY() + 20 - k * 19.7; });
  dove.flying = false; tag('ស្លឹកឈើ', leaf);
  await talk([['me', 'មើល ! *ស្លឹកឈើ !'], ['me', 'ដី ស្ងួត ហើយ !']]);
  await tween(5, k => { waterY = 20 - k * 22; arkO.g.position.y = Math.max(araratH(0, -10) - .2, waterY - .6); });
  world.remove(water); water = null; waterY = -100; arkO.g.position.y = araratH(0, -10) - .2;
  world.children.forEach(c => { if (c.type === 'Group') c.visible = true; });
  for (const c of [...world.children]) if (c.type === 'Group' && c !== arkO.g && !ents.some(e => e.g === c)) world.remove(c);
  for (let i = 0; i < 30; i++) { const x = rnd(-70, 70), z = rnd(-70, 70); if (Math.hypot(x, z + 10) < 22) continue; place(tree({ s: rnd(.6, 1) }).g, x, z, 0, .6); }
  await talk([['god', 'ណូអេ ! ចេញ ពី ទូក ។']]);
  goal('ចេញ ពី ទូក ។', [0, -10]);
  await act('ចេញ ពី ទូក', [0, -10], 99); track = null;
  floors.length = 0; clampFn = null; solids.length = 0; solids.push({ x: 0, z: -10, r: 5 }, { x: -8, z: -10, r: 4 }, { x: 8, z: -10, r: 4 });
  player.x = 0; player.z = -1; player.y = araratH(0, -1);
  for (const [i, e] of [wife, ...sons].entries()) { e.g.visible = true; e.hide = false; e.x = -4 + i * 2.6; e.z = -1.5; e.tick = null; }
  for (const p of pairs) for (const [i, e] of p.two.entries()) { e.g.visible = true; e.hide = false; e.x = 0; e.z = -4; e.stop = false; walk(e, rnd(-40, 40), rnd(0, 40), 4).then(() => wander(e, 10)); }
  const rb = rainbowMesh(70); rb.position.set(0, -10, -120); world.add(rb); tag('ឥន្ទធនូ', rb); good();
  godGlow(true, [0, 30, -40]);
  await camTo([player.x, player.y + 3, player.z + 8], [0, 25, -100], 2);
  await talk([['god', 'មើល *ឥន្ទធនូ ។'], ['god', 'យើង នឹង មិន ធ្វើ ទឹកជំនន់ ទៀត ទេ ។ នេះ ជា សេចក្ដី សន្យា ។'], ['al', 'ល្អ ណាស់ ណូអេ ។ ដល់ ពេល លោត ។']]);
  camFree(); await next(4);
}

/* ---- 4. Babel ---- */
const shinarH = (x, z) => .5 + Math.sin(x * .04) * .8 + Math.cos(z * .05) * .7 - (Math.hypot(x + 20, z - 8) < 5 ? 1.2 : 0);
let tower = null;
babel.build = () => {
  setSky(0x4a8ad8, 0xf0d8a0, 0xe8d0a0, 1, true); scene.fog.near = 50; scene.fog.far = 190;
  H = shinarH; bound = 85; terrain(220, 50, (x, z, y) => Math.hypot(x + 20, z - 8) < 5 ? 0x6a4028 : y > .8 ? 0xd8b878 : 0xc8a868);
  tower = towerMesh(); place(tower.g, 0, -22); tower.show(2); solids.push({ x: 0, z: -22, r: 9 }); tag('ប៉ម', tower.g);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = rnd(30, 50); const h = grp(); box(4, rnd(2, 4), 4, brickM, 0, 1.5, 0, h); place(h, Math.cos(a) * r, Math.sin(a) * r, a, 2.6); tag('ទីក្រុង', h); }
  const k = fire(); k.scale.setScalar(2); place(k, 18, 6); tag('ភ្លើង', k); const kiln = grp(); box(4, 1.2, 4, brickM, 0, .6, 0, kiln); place(kiln, 18, 6, 0, 2.4); k.position.y += 1.2;
  for (let i = 0; i < 4; i++) place(tree({ palm: true, s: 1.2 }).g, rnd(-60, 60), rnd(20, 60), 0, .7);
};
async function babel() {
  await leapIn('builder', 4, 10, Math.PI);
  const workers = [0x8a3a2a, 0x3a5a8a, 0x5a7a3a, 0x8a6a2a, 0x6a3a6a].map((c, i) => { const w = npc('w1', { skin: 0x9a6a44, top: c, bottom: 0x7a5a40, hair: 0x1a1010 }, rnd(-12, 12), rnd(-8, 4)); w.talk = null; const loop = async () => { while (ents.includes(w) && !w.scatter) { await walk(w, -20 + rnd(-2, 2), 8 + rnd(-2, 2), 3); if (w.scatter) break; await walk(w, rnd(-6, 6), -12, 3); } }; loop(); return w; });
  const boss = npc('boss', { skin: 0x9a6a44, top: 0x2a3a7a, robe: true, cloth: 0xf2c51c, beard: 0x1a1010 }, 6, -8, Math.PI);
  const friend = npc('friend', { skin: 0x9a6a44, top: 0x2a8a6a, bottom: 0x7a5a40, hair: 0x1a1010 }, 0, 12, 0);
  await arrive([['al', 'អ្នក ជា អ្នកសង់ ។ នៅ ទីក្រុង បាបិល ។'], ['al', 'ពេល នោះ មនុស្ស ទាំងអស់ និយាយ ភាសា តែ មួយ ។'], ['al', 'ធ្វើ ឲ្យ រឿង ទៅ មុខ ។']]);
  await talk([['boss', 'តោះ ! យើង សង់ ទីក្រុង និង ប៉ម មួយ ។'], ['boss', 'ប៉ម ខ្ពស់ ដល់ មេឃ ! ឈ្មោះ យើង នឹង ល្បី !'], ['friend', 'តោះ ធ្វើ ឥដ្ឋ !']]);
  for (let n = 1; n <= 3; n++) {
    goal(`យក ដីឥដ្ឋ ។ ( ${khNum(n - 1)} / ${khNum(3)} )`, [-20, 8]);
    await act('យក ដីឥដ្ឋ', [-20, 8], 6); const cl = ball(.4, 0x6a4028, 0, 0, 0, null, 5, 3); carry(cl);
    goal('ដុត ឥដ្ឋ នៅ ភ្លើង ។', [18, 6]);
    await act('ដុត ឥដ្ឋ', [18, 6], 5); drop(); burst(18, 4, 6, 0xff8020, 40, 2); carry(brickStack()); tone([300, 500], .4, 'triangle', .06);
    goal('ដាក់ ឥដ្ឋ នៅ ប៉ម ។', [0, -12]);
    await act('ដាក់ ឥដ្ឋ', [0, -12], 5); drop(); good();
    const from = 2 + (n - 1) * 2; tower.show(from + 2); burst(0, 8 + n * 4, -22, 0xd8a060, 60, 5); toast(`ឥដ្ឋ ${NUMW[n]}`);
    if (n === 1) await say('boss', 'ល្អ ! ឥដ្ឋ ទៀត ! ឥដ្ឋ ទៀត !');
  }
  tower.show(9); await camTo([0, 10, 26], [0, 18, -22], 2);
  await talk([['friend', 'មើល ! ប៉ម ខ្ពស់ ណាស់ !'], ['boss', 'យើង មិន ត្រូវការ ព្រះ ទេ !']]);
  godGlow(true, [0, 60, -22]); await tween(2.5, k => godLight.position.y = 60 - k * 30);
  await talk([['al', 'ព្រះជាម្ចាស់ ចុះ មក មើល ទីក្រុង ។'], ['god', 'មនុស្ស ទាំងនេះ មាន ភាសា តែ មួយ ។'], ['god', 'យើង នឹង ធ្វើ ឲ្យ ភាសា របស់ ពួកគេ ច្របូកច្របល់ ។']]);
  leapSound(); const f = $('#flash'); await tween(.4, k => f.style.opacity = k * .8); await tween(.8, k => f.style.opacity = .8 * (1 - k)); godGlow(false); camFree();
  // now nobody understands anybody
  const TONGUES = [['ເຈົ້າເວົ້າຫຍັງ ?', 'lo'], ['คุณพูดอะไร ?', 'th'], ['ဘာပြောတာလဲ ?', 'my'], ['Anh nói gì vậy ?', 'vi']];
  await say('boss', 'ເອົາດິນຈີ່ມາ ! ໄວໆ !', { lang: 'lo' });
  await say('al', 'អូ ! ភាសា ផ្សេង !');
  for (const w of workers) { w.scatter = true; w.goal = null; }
  for (let n = 0; n < 3; n++) {
    goal(`និយាយ ជាមួយ អ្នកសង់ ។ ( ${khNum(n)} / ${khNum(3)} )`, workers[n]);
    await act('និយាយ', workers[n], 3.5);
    await say('w1', TONGUES[n][0], { lang: TONGUES[n][1] });
    await say('me', n < 2 ? 'ខ្ញុំ មិន យល់ ទេ !' : 'ខ្ញុំ មិន យល់ អ្វី ទាំងអស់ !');
  }
  goal('និយាយ ជាមួយ មិត្ត អ្នក ។', friend);
  await act('និយាយ', friend, 3.5);
  await say('friend', TONGUES[3][0], { lang: TONGUES[3][1] });
  await talk([['al', 'សូម្បី តែ មិត្ត អ្នក ។ គ្មាន អ្នក ណា យល់ គ្នា ទេ ។'], ['al', 'ពួកគេ ខ្ចាត់ខ្ចាយ ទៅ គ្រប់ ទិស ។']]);
  [...workers, boss, friend].forEach((w, i) => { const a = i / 7 * Math.PI * 2; w.talk = null; walk(w, Math.cos(a) * 80, Math.sin(a) * 80, 4); });
  await wait(2.5);
  await talk([['al', 'ទីក្រុង នេះ ឈ្មោះ បាបិល ។ ប៉ម មិន ចប់ ទេ ។'], ['al', 'ភាសា ច្រើន ... ដូច អ្នក រៀន ភាសា ខ្មែរ ឥឡូវ !'], ['al', 'ដល់ ពេល លោត ។']]);
  await next(5);
}

/* ---- 5. Abram: leave home, count the stars, three guests, the ram ---- */
const canaanH = (x, z) => { const m = Math.hypot(x + 60, z + 70); return 1 + Math.sin(x * .05) * 1.5 + Math.cos(z * .06) * 1.2 + 30 * Math.exp(-(m * m) / 500); };
const canaanCol = (x, z, y) => y > 12 ? 0x9a8a6a : x > 50 ? 0xd8c088 : x > 20 ? 0xb8b070 : 0x7aa040;
abram.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 50; scene.fog.far = 200;
  H = canaanH; bound = 125; terrain(260, 64, canaanCol);
  for (let i = 0; i < 6; i++) { const h = grp(); box(5, rnd(3, 6), 5, brickM, 0, 2, 0, h); place(h, 95 + (i % 3) * 8, -14 + Math.floor(i / 3) * 26, 0, 3.4); tag('ទីក្រុង', h); }
  const oak = tree({ s: 2.2, leaf: 0x3a7a2a }); place(oak.g, -40, 0, 0, 2.4); tag('ដើមឈើ', oak.g);
  for (let i = 0; i < 40; i++) { const x = rnd(-120, 30), z = rnd(-110, 110); if (Math.hypot(x + 40, z) < 14 || Math.hypot(x + 60, z + 70) < 30) continue; place(tree({ s: rnd(.7, 1.2), palm: x > 10 }).g, x, z, 0, .7); }
  for (let i = 0; i < 20; i++) { const x = rnd(-80, -40), z = rnd(-100, -40); const r = rock(rnd(.6, 1.6)); place(r, x, z, rnd(0, 6), 1); }
};
async function abram() {
  await leapIn('abram', 84, 4, -Math.PI / 2);
  const sarai = npc('sarai', { skin: 0xb07a50, top: 0x8a3a5a, robe: true, cloth: 0xe8d8c0, female: true }, 86, 8, -Math.PI / 2);
  const lot = npc('lot', { skin: 0xa07050, top: 0x5a7a3a, robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, 88, 0, -Math.PI / 2);
  const tentO = tent(); place(tentO, 80, 12); solids.push({ x: 80, z: 12, r: 2.4 }); tag('តង់', tentO);
  const camels = [0, 1, 2].map(i => { const a = animal('camel'); const e = ent(a, 76 - i * 3, -4, { speed: 3, gap: 3.4 }); tag('អូដ្ឋ', a.g); return e; });
  const sheep = [0, 1, 2, 3].map(i => { const a = animal('sheep'); const e = ent(a, 90 + rnd(-4, 4), -10 + rnd(-3, 3), { gap: 3 }); wander(e, 4); tag('ចៀម', a.g); return e; });
  await arrive([['al', 'អ្នក ជា អាប់រ៉ាម ។'], ['al', 'អ្នក រស់ នៅ ទីក្រុង ហើយ អ្នក ចាស់ ហើយ ។'], ['al', 'ធ្វើ ឲ្យ រឿង ទៅ មុខ ។']]);
  godGlow(true, [60, 20, 0]);
  await talk([['god', 'អាប់រ៉ាម ! ចេញ ពី ស្រុក របស់ អ្នក ។'], ['god', 'ទៅ ស្រុក ដែល យើង នឹង បង្ហាញ អ្នក ។'], ['god', 'យើង នឹង ឲ្យ ពរ អ្នក ។']]);
  godGlow(false);
  goal('យក តង់ ។', [80, 12]);
  await act('យក តង់', [80, 12], 4.5); world.remove(tentO); solids.splice(solids.findIndex(s => s.x === 80 && s.z === 12), 1); const mini = tent(); mini.scale.setScalar(.25); carry(mini);
  goal('ដាក់ តង់ លើ អូដ្ឋ ។', camels[0]);
  await act('ដាក់ តង់', camels[0], 4); drop(); const onC = tent(); onC.scale.setScalar(.35); onC.position.set(0, 2.6, 0); camels[0].g.add(onC); good();
  await talk([['sarai', 'យើង ទៅ ឯណា ?'], ['me', 'ខ្ញុំ មិន ដឹង ទេ ។ ព្រះជាម្ចាស់ នឹង បង្ហាញ ។'], ['lot', 'ខ្ញុំ ទៅ ជាមួយ ពូ !']]);
  camels[0].follow = 'player'; camels[1].follow = camels[0]; camels[2].follow = camels[1]; sarai.follow = 'player'; sarai.gap = 2.2; lot.follow = sarai; lot.gap = 2.2;
  for (const s of sheep) { s.stop = true; s.goal = null; s.follow = lot; s.gap = rnd(2.5, 5); }
  goal('ទៅ ស្រុក កាណាន ។ ទៅ ដើមឈើ ធំ ។', [-40, 0]);
  await reach([-34, 0], 9);
  await talk([['god', 'ស្រុក នេះ ... យើង នឹង ឲ្យ កូនចៅ អ្នក ។'], ['me', 'ប៉ុន្តែ ខ្ញុំ គ្មាន កូន ទេ ។']]);
  const tent2 = tent(); place(tent2, -46, 8); solids.push({ x: -46, z: 8, r: 2.4 }); tag('តង់', tent2);
  camels[0].g.remove(onC);
  for (const e of [sarai, lot, ...camels, ...sheep]) { e.follow = null; }
  walk(sarai, -44, 4); walk(lot, -30, 6);
  // night: count the stars
  setSky(0x02041a, 0x0a1440, 0x0a1030, .2); await tween(2, k => stars.material.opacity = k);
  godGlow(true, [-40, 30, -10]);
  await talk([['god', 'អាប់រ៉ាម ! មើល ទៅ លើ មេឃ ។'], ['god', 'រាប់ ផ្កាយ ។ តើ អ្នក រាប់ បាន ទេ ?']]);
  goal('រាប់ ផ្កាយ ។', null);
  for (let n = 1; n <= 10; n++) {
    await act(`រាប់ ផ្កាយ`, [player.x, player.z], 999);
    const a = rnd(0, 6.28); burst(player.x + Math.cos(a) * 20, 40, player.z + Math.sin(a) * 20, 0xfff4a0, 20, 2);
    speaking = 'me'; playWord(NUMW[n]); toast(khNum(n), NUMW[n]); goal(`រាប់ ផ្កាយ ... ${NUMW[n]}`);
  }
  stars.material.size = 3;
  await talk([['me', 'ផ្កាយ ច្រើន ណាស់ ! ខ្ញុំ រាប់ មិន អស់ ទេ !'], ['god', 'កូនចៅ អ្នក នឹង ច្រើន ដូច ផ្កាយ ។'], ['god', 'ឈ្មោះ អ្នក មិន មែន អាប់រ៉ាម ទៀត ទេ ។ ឈ្មោះ អ្នក គឺ អ័ប្រាហាំ ។'], ['god', 'ឈ្មោះ សារ៉ាយ គឺ សារ៉ា ។']]);
  CAST.me.km = 'អ័ប្រាហាំ'; HEROES.abram.name = 'អ័ប្រាហាំ'; sarai.talk = 'sarah'; await say('me', 'ខ្ញុំ ជឿ ព្រះជាម្ចាស់ ។');
  godGlow(false); stars.material.size = 2; await tween(2, k => stars.material.opacity = 1 - k); setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1);
  // three guests at the oak
  const guests = [0, 1, 2].map(i => { const g = npc('guest', { skin: 0xb07a50, top: 0xf0f0f0, robe: true, cloth: 0xf0f0f0 }, -36 + i * 1.6, -14, 0); walk(g, -38 + i * 2, -5, 2); return g; });
  await say('al', 'មើល ! ភ្ញៀវ បី នាក់ មក ។');
  const well = grp(); cyl(1.2, 1.2, 1, 0x8a8478, 0, .5, 0, well, 8); cyl(1, 1, .05, MB(0x3a7ad0), 0, 1, 0, well, 8); place(well, -24, 12, 0, 1.6); tag('ទឹក', well);
  goal('យក ទឹក ។', [-24, 12]);
  await act('យក ទឹក', [-24, 12], 3.5); const jar = cyl(.2, .25, .5, 0xb06a3a, 0, 0, 0, null, 6); carry(jar);
  goal('ឲ្យ ទឹក ទៅ ភ្ញៀវ ។', guests[1]);
  await act('ឲ្យ ទឹក', guests[1], 4); drop(); good();
  goal('យក នំបុ័ង ពី តង់ សារ៉ា ។', [-46, 11]);
  await act('យក នំបុ័ង', [-46, 11], 4); carry(bread());
  goal('ឲ្យ នំបុ័ង ទៅ ភ្ញៀវ ។', guests[1]);
  await act('ឲ្យ នំបុ័ង', guests[1], 4); drop(); good();
  await talk([['guest', 'អរគុណ អ័ប្រាហាំ ។'], ['guest', 'សារ៉ា ប្រពន្ធ អ្នក នៅ ឯណា ?'], ['me', 'នាង នៅ ក្នុង តង់ ។'], ['guest', 'ឆ្នាំ ក្រោយ សារ៉ា នឹង មាន កូនប្រុស មួយ ។'], ['sarah', 'ហាហា ! ខ្ញុំ ចាស់ ហើយ ! អ័ប្រាហាំ ក៏ ចាស់ ដែរ !'], ['guest', 'ហេតុ អ្វី សារ៉ា សើច ? គ្មាន អ្វី ពិបាក ពេក សម្រាប់ ព្រះជាម្ចាស់ ទេ ។']]);
  for (const g of guests) walk(g, -80, -40, 3).then(() => { g.g.visible = false; });
  const f = $('#flash'); f.style.background = '#fff'; await tween(1, k => f.style.opacity = k);
  const isaac = npc('isaac', { skin: 0xb07a50, top: 0xe0d0a0, robe: true, hair: 0x2a1a10, small: true }, player.x + 2, player.z + 1.5, Math.PI); tag('អ៊ីសាក', isaac.g);
  await tween(1, k => f.style.opacity = 1 - k); f.style.background = '';
  await talk([['al', 'មួយ ឆ្នាំ ក្រោយ ... អ៊ីសាក កើត មក ។'], ['al', 'ឈ្មោះ អ៊ីសាក មាន ន័យ ថា « សើច » ។'], ['sarah', 'ព្រះជាម្ចាស់ ធ្វើ ឲ្យ ខ្ញុំ សើច ! ខ្ញុំ សប្បាយ ណាស់ !']]);
  // Moriah
  godGlow(true, [-60, 50, -70]);
  await talk([['god', 'អ័ប្រាហាំ !'], ['me', 'ខ្ញុំ នៅ ទីនេះ ។'], ['god', 'យក អ៊ីសាក កូន ដែល អ្នក ស្រឡាញ់ ទៅ ភ្នំ ម៉ូរីយ៉ា ។'], ['god', 'ថ្វាយ គាត់ ជា តង្វាយ ដល់ យើង ។'], ['al', '... ពិបាក ណាស់ ។ ប៉ុន្តែ អ័ប្រាហាំ ជឿ ព្រះជាម្ចាស់ ។']]);
  godGlow(false);
  const pile = logPile(); place(pile, -38, 14); tag('ឈើ', pile);
  goal('យក ឈើ ។', [-38, 14]);
  await act('យក ឈើ', [-38, 14], 4); pile.visible = false; carry(log());
  goal('ឲ្យ ឈើ ទៅ អ៊ីសាក ។', isaac);
  await act('ឲ្យ ឈើ', isaac, 4); drop(); const il = log(); il.scale.setScalar(.7); il.position.set(0, 2.2, 0); isaac.m.b.add(il);
  isaac.follow = 'player'; isaac.gap = 2;
  goal('ឡើង ភ្នំ ម៉ូរីយ៉ា ។', [-60, -70]);
  await reach([-52, -52], 8);
  await talk([['isaac', 'ប៉ា !'], ['me', 'កូន ។ ប៉ា នៅ ទីនេះ ។'], ['isaac', 'មាន ឈើ មាន ភ្លើង ... ប៉ុន្តែ កូនចៀម នៅ ឯណា ?'], ['me', 'ព្រះជាម្ចាស់ នឹង ផ្គត់ផ្គង់ កូនចៀម ។']]);
  await reach([-60, -70], 7);
  goal('ធ្វើ អាសនា ។', [-60, -70]);
  await act('ធ្វើ អាសនា', [-60, -70], 7); const alt = altar(); place(alt, -60, -73); tag('អាសនា', alt); burst(-60, canaanH(-60, -73) + 1, -73, 0xd8c8a0, 40, 2);
  isaac.follow = null; walk(isaac, -59, -72.2);
  await wait(1);
  const an = ent(person({ glow: 0xffffff, scale: 1.3 }), -64, -66, { solid: 0, fly: 1.5 }); tag('ទេវតា', an.g); burst(-64, canaanH(-64, -66) + 2, -66, 0xffffff, 60, 3); good();
  await say('angel', 'អ័ប្រាហាំ ! អ័ប្រាហាំ !');
  goal('ឆ្លើយ ។', an);
  await act('ខ្ញុំ នៅ ទីនេះ', an, 9);
  await talk([['me', 'ខ្ញុំ នៅ ទីនេះ ។'], ['angel', 'កុំ ធ្វើ បាប កូន ! ឥឡូវ យើង ដឹង ថា អ្នក គោរព ព្រះ ។'], ['angel', 'មើល ! នៅ ក្នុង ព្រៃ ។']]);
  const thicket = bush(0x4a6a2a); thicket.scale.setScalar(1.3); place(thicket, -52, -76); tag('ព្រៃ', thicket);
  const ram = animal('ram'); const ramE = ent(ram, -52, -74.5, { yaw: -1 }); tag('ចៀមឈ្មោល', ram.g); ramE.tick = (dt, t) => ram.head.rotation.y = Math.sin(t * 5) * .3;
  goal('ចាប់ ចៀមឈ្មោល ។', ramE);
  await act('ចាប់ ចៀមឈ្មោល', ramE, 4); good();
  isaac.follow = 'player';
  await talk([['me', 'ព្រះជាម្ចាស់ ផ្គត់ផ្គង់ !'], ['isaac', 'ប៉ា ! ព្រះជាម្ចាស់ ផ្គត់ផ្គង់ កូនចៀម !']]);
  godGlow(true, [-60, 40, -80]);
  await talk([['god', 'អ្នក មិន ហាម កូន របស់ អ្នក ទេ ។'], ['god', 'កូនចៅ អ្នក នឹង ច្រើន ដូច ផ្កាយ នៅ លើ មេឃ ដូច ខ្សាច់ នៅ មាត់ សមុទ្រ ។'], ['god', 'តាម កូនចៅ អ្នក គ្រប់ ប្រជាជាតិ នឹង បាន ពរ ។'], ['al', 'រឿង ទៅ មុខ ហើយ ។ ប៉ុន្តែ រឿង មិន ទាន់ ចប់ ទេ ...']]);
  done(6); await next(6);
}

async function ending() {
  started = false; $('#hud').classList.add('hide'); setSky(0x02041a, 0x0a1440, 0x0a1030, .2, true); stars.material.opacity = 1;
  $('#flash').style.opacity = 0;
  const n = Object.keys(S.seen).length;
  $('#endtxt').innerHTML = `<div class="sub">ដំណើរឆ្លងកាល</div><h1>មិន ទាន់ ចប់ ទេ ...</h1><p>អ្នក ជា អ័ដាម អេវ៉ា និង ណូអេ ។</p><p>អ្នក ឃើញ ពាក្យ ខ្មែរ <b style="color:var(--c);font-size:26px">${khNum(n)}</b> ពាក្យ ។</p><p class="sub">លោត បន្ទាប់ ៖ ប៉ម បាបិល · អ័ប្រាហាំ</p><div class="row"><button class="btn pri big" id="replay">ចាប់ផ្ដើម ម្ដង ទៀត</button><button class="btn big" id="words">ពាក្យ</button></div>`;
  $('#end').classList.remove('hide');
  $('#replay').onclick = () => { S.ch = 0; save(); location.reload(); };
  $('#words').onclick = () => { $('#end').classList.add('hide'); $('#hud').classList.remove('hide'); started = true; bookTab = 'words'; openBook(); $('#bookclose').onclick = () => { closeAll(); $('#hud').classList.add('hide'); $('#end').classList.remove('hide'); }; };
}

/* ---------------- start ---------------- */
requestAnimationFrame(frame);
$('#count').textContent = khNum(Object.keys(S.seen).length);
if (hadSave) { $('#start').textContent = 'បន្ត'; $('#again').classList.remove('hide'); }
setSky(0x0a1030, 0x1a2a6a, 0x0a1030, .3, true); stars.material.opacity = 1; camera.position.set(0, 5, 20); camera.lookAt(0, 8, 0);
anims.push((dt, t) => { if (!started) { camera.rotation.y = t * .03; } else return false; });
function begin() { ensureAudio(); $('#title').classList.add('hide'); stars.material.opacity = 0; const ch = S.ch >= CHAPTERS.length ? 0 : S.ch; playChapter(ch).catch(e => console.error(e)); }
$('#start').onclick = begin;
$('#again').onclick = () => { S.ch = 0; save(); begin(); };
window.LEAP = { S, acts, speakers, pressA: () => { curAct = curAct || acts[0]; pressA(); }, dlgTap, trig: () => trigRes && trigRes('x'), get ui() { return ui; }, player, ents, reachers, get started() { return started; }, speak: w => { typed = w; speakTyped(); }, get audio() { return peak ? peak.source + ' ' + peak.speakers.length : 'none'; }, warp: (x, z) => { player.x = x; player.z = z; }, get goal() { return atXZ(goalAt); }, atXZ };
