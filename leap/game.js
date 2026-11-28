// ដំណើរឆ្លងកាល — leap through Genesis as its people, in Khmer only.
// Engine pieces (three.js, PeakSlab audio, the Battambang font) are shared with ../village/.
const LIB = document.querySelector('meta[name=lib]').content;
const FONTS = document.querySelector('meta[name=fonts]').content;
const THREE = await import(LIB + 'three.module.min.js');
const { peakAudio } = await import(document.querySelector('meta[name=peakjs]')?.content || LIB + 'peakaudio.js');
for (const [fam, url] of [['Battambang', LIB + 'battambang.ttf'], ['Moul', FONTS + 'muol.woff']]) { try { const f = new FontFace(fam, `url(${url})`); document.fonts.add(f); f.load().catch(() => { }); } catch (e) { } }
try { await Promise.race([document.fonts.load('30px Battambang', 'ក'), new Promise(r => setTimeout(r, 2000))]); } catch (e) { }

const { IPA } = await import('./ipa.js');
const { BAD } = await import('./badrec.js');
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
const TENS = { 20: 'ម្ភៃ', 30: 'សាមសិប', 40: 'សែសិប', 50: 'ហាសិប', 60: 'ហុកសិប', 70: 'ចិតសិប', 80: 'ប៉ែតសិប', 90: 'កៅសិប', 100: 'មួយរយ' };
const NUMWORD = n => n <= 10 ? NUMW[n] : TENS[n];
const NUMS = Object.fromEntries([...NUMW.map((w, i) => [w, i]).filter(x => x[0]), ...Object.entries(TENS).map(([n, w]) => [w, +n])]);
const wait = s => new Promise(r => setTimeout(r, s * 1000));
const isMobile = matchMedia('(pointer:coarse)').matches;

/* ---------------- save ---------------- */
const SAVE = 'leap-save-1';
let S = { ch: 0, max: 0, seen: {}, said: [] };
try { const j = JSON.parse(localStorage.getItem(SAVE)); if (j && typeof j.ch === 'number') S = Object.assign(S, j); } catch (e) { }
S.tts = false;
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
// The device's voice. Tried even when no Khmer voice is listed (some engines still speak km-KH);
// ttsWorks remembers whether it actually started, so a silent engine falls back to the recordings.
let ttsWorks = null;
function sayTTS(w, lang) {
  if (!window.speechSynthesis) { if (!lang) ttsWorks = false; return Promise.resolve(false); }
  const v = lang ? speechSynthesis.getVoices().find(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang)) : kmVoice;
  if (lang && !v) return wait(.4).then(() => false);
  try { speechSynthesis.cancel(); } catch (e) { }
  return new Promise(res => {
    let started = false, done = false; const fin = ok => { if (!done) { done = true; res(ok); } };
    const u = new SpeechSynthesisUtterance(w); if (v) u.voice = v; u.lang = v ? v.lang : 'km-KH'; u.rate = .9;
    u.onstart = () => { started = true; if (!lang) { ttsWorks = true; ttsLabel?.(); } };
    u.onend = () => fin(started); u.onerror = () => { if (!lang && !started && ttsWorks !== true) { ttsWorks = false; ttsLabel?.(); } fin(false); };
    speechSynthesis.speak(u);
    setTimeout(() => { if (!started) { if (!lang && ttsWorks !== true) { ttsWorks = false; ttsLabel?.(); } try { speechSynthesis.cancel(); } catch (e) { } fin(false); } }, 1800);
    setTimeout(() => fin(true), Math.max(3000, w.length * 160));
  });
}
const useTTS = () => S.tts && ttsWorks !== false;
// The best recording of each word: clean dictionary clips first (kheng.info), then the others; never a clip
// flagged in badrec.js; played as recorded (no pitch or speed change), so a word always sounds the same.
const READERS = ['kheng:1', 'rith:', 'khsv:1', 'khsv:2', 'khsv:3', 'khsv:4'];
async function playWord(w, lang) {
  if (lang) { try { return await sayTTS(w, lang); } catch (e) { return false; } }
  if (useTTS() && await sayTTS(w)) return true;
  if (!peak) await Promise.race([peakReady, wait(4)]);
  if (peak) {
    const who = peak.who(w), clean = who.filter(r => !(BAD[w] || []).includes(r)), rank = r => (READERS.indexOf(r) + 99) % 99;
    const used = (clean.length ? clean : who).sort((a, b) => rank(a) - rank(b))[0];
    if (!used && (kmVoice || S.tts) && ttsWorks !== false && await sayTTS(w)) return true; // no recording of its own: try the device before gluing halves
    const s = peak.samples(w, used || '');
    if (s) return playPcm(s, 1);
  }
  if ((kmVoice || S.tts) && ttsWorks !== false) { try { return await sayTTS(w); } catch (e) { } }
  await wait(.3); return false;
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
const capsule = (r, len, c, x, y, z, p, seg = 4) => mesh(new THREE.CapsuleGeometry(r, len, 1, Math.min(seg, 4)), MS(c), x, y, z, p);
const sph = (r, c, x, y, z, p, w = 5, h = 3) => mesh(new THREE.SphereGeometry(r, Math.min(w, 5), Math.min(h, 3)), MS(c), x, y, z, p);
const VC = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
function loft(rings, sides = 6, caps = true) {
  const pos = [], col = [], c = new THREE.Color(), P = (r, j, i = 0) => { const a = ((j + (i % 2) * .5) / sides) * Math.PI * 2 + Math.PI / sides; return [Math.sin(a) * r[1], r[0], r[3] + Math.cos(a) * r[2]]; };
  const tri = (a, b2, d, ca, cb, cd) => { pos.push(...a, ...b2, ...d); for (const cc of [ca, cb, cd]) { c.setHex(cc); col.push(c.r, c.g, c.b); } };
  for (let i = 0; i < rings.length - 1; i++) { const A = rings[i], B = rings[i + 1]; for (let j = 0; j < sides; j++) { const a0 = P(A, j, i), a1 = P(A, j + 1, i), b0 = P(B, j, i + 1), b1 = P(B, j + 1, i + 1); // staggered rings: on even bands the next ring's vertex sits between a0 and a1, on odd bands b1 does, so the fan has to follow it or the triangles cross
        const ys = A[0] > B[0], F = (p, q, r, cp, cq, cr) => ys ? tri(p, r, q, cp, cr, cq) : tri(p, q, r, cp, cq, cr);
        if (i % 2 === 0) { F(a0, a1, b0, A[4], A[4], B[4]); F(a1, b1, b0, A[4], B[4], B[4]); } else { F(a0, a1, b1, A[4], A[4], B[4]); F(a0, b1, b0, A[4], B[4], B[4]); } } }
  if (caps) { const first = rings[0], last = rings[rings.length - 1], down = first[0] > last[0]; for (const [r, up, ri] of [[first, down, 0], [last, !down, rings.length - 1]]) { const ctr = [0, r[0], r[3]]; for (let j = 0; j < sides; j++) { const a = P(r, j, ri), b2 = P(r, j + 1, ri); if (up) tri(ctr, b2, a, r[4], r[4], r[4]); else tri(ctr, a, b2, r[4], r[4], r[4]); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
const HEADM = {};
function person(o = {}) {
  const fem = !!o.female && !o.small, clothed = (o.top ?? 0x8a6a4a) !== (o.skin ?? 0xb07a50), pants = !o.robe && (o.bottom ?? o.top ?? 0x8a6a4a) !== (o.skin ?? 0xb07a50);
  // grown men stand about 10% taller than women
  const g = new THREE.Group(), b = grp(0, 0, 0, g); b.scale.setScalar(o.small ? .66 : (o.scale || 1) * (fem ? 1 : 1.1));
  const sk = o.skin ?? 0xb07a50, top = o.top ?? 0x8a6a4a, bot = o.bottom ?? top;
  const mat = c => o.glow ? MB(o.glow, { transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }) : MS(c);
  const legs = [], arms = [], knees = [], feet = [], VM = () => o.glow ? mat(0) : VC;
  // women: legs ~16% longer, the rest of the body raised to sit on them
  const d = fem ? .12 : 0, L = (.74 + d) / .74, sy = rs => rs.map(r => [r[0] * L, ...r.slice(1)]);
  // one low-poly torso, hips to neck; women: narrower waist, fuller hips, a moderate bust in the same shape
  const T = fem
    ? [[.68, .2, .13, 0, bot], [.82, .33, .21, 0, bot], [1.0, .2, .14, 0, top], [1.2, .26, clothed ? .2 : .17, clothed ? .05 : .03, top], [1.42, .27, .14, 0, top], [1.66, .075, .075, .01, sk]]
    : [[.68, .18, .12, 0, bot], [.82, .25, .16, 0, bot], [1.0, .22, .14, 0, top], [1.14, .25, .16, .015, top], [1.28, .29, .17, .02, top], [1.44, .32, .15, 0, top], [1.67, .085, .085, .01, sk]];
  mesh(loft(T.map(r => [r[0] + d, ...r.slice(1)]), 6), VM(), 0, 0, 0, b);
  // robes: women's reach the ground, men's stop above the ankle so the calves show
  if (o.robe) mesh(loft(fem ? [[1.0 + d, .21, .15, 0, bot], [.8 + d, .32, .22, 0, bot], [.08, .52, .4, 0, bot]] : [[1.0, .23, .15, 0, bot], [.8, .3, .22, 0, bot], [.3, .44, .36, 0, bot]], 6, false), VM(), 0, 0, 0, b);
  if (o.coat) [0xd03a2a, 0xf2c51c, 0x2a8a4a, 0x2f5fd0].forEach((c, i) => { const y0 = .86 + d + i * .16; mesh(loft([[y0, .25, .17, .015, c], [y0 + .12, .26, .175, .015, c]], 5, false), VC, 0, 0, 0, b); });
  // arms: shoulder, bicep, forearm, hand in one shape
  const sl = o.sleeve ?? top;
  for (const s of [-1, 1]) { const p = pivot(b, s * (fem ? .27 : .31), 1.4 + d, 0); mesh(loft([[.06, .08, .08, 0, sl], [-.06, .1, .09, 0, sl], [-.3, .065, .065, 0, sl], [-.52, .05, .05, .01, o.robe ? sl : sk], [-.68, .055, .035, .03, sk]], 5), VM(), 0, 0, 0, p); arms.push(p); }
  // legs: thigh and shin as separate shapes so the knee bends
  const lc = o.robe ? sk : pants ? bot : sk, fc = o.barefoot ? sk : 0x4a3420;
  for (const s of [-1, 1]) {
    const W = fem ? 1.2 : 1, p = pivot(b, s * (fem ? .14 : .11), .74 + d, 0); if (!o.robe) mesh(loft(sy([[.04, .12 * W, .12 * W, 0, lc], [-.16, .11 * W, .105 * W, 0, lc], [-.38, .075 * W, .075 * W, .01, lc]]), 5), VM(), 0, 0, 0, p);
    const k = pivot(p, 0, -.37 * L, 0); if (!o.robe) mesh(loft(sy([[.02, .075 * W, .075 * W, .01, sk], [-.1, .085 * W, .09 * W, -.015, sk], [-.32, .045 * W, .045 * W, 0, sk]]), 5), VM(), 0, 0, 0, k); else if (!fem) mesh(loft([[-.08, .07, .075, -.01, sk], [-.32, .045, .045, 0, sk]], 5), VM(), 0, 0, 0, k);
    const f = mesh(loft(sy([[-.3, .055, .06, .01, fc], [-.4, .07, .12, .07, fc]]), 5), VM(), 0, 0, 0, k);
    legs.push(p); knees.push(k); feet.push(f);
  }
  if (o.staff) { const st = mesh(new THREE.CylinderGeometry(.035, .035, 2.2, 5), mat(0x6a4424), 0, -.5, .05, arms[1]); st.rotation.x = .1; }
  const head = grp(0, 1.8 + d, 0, b);
  // the head: a six-sided double pyramid, 12 triangles, a flat face to the front
  // the lower faces point down and caught almost no light, which read as a beard: give the face its own softly lit skin
  const hm = o.glow ? mat(sk) : MB(sk); // unlit: one even skin tone, no shading on the face
  mesh(new THREE.SphereGeometry(.29, 6, 2), hm, 0, 0, 0, head).scale.set(1, 1.05, 1);
  if (!o.glow) { for (const s of [-1, 1]) mesh(new THREE.OctahedronGeometry(.045, 0), MS(0x1a1010), s * .085, .03, .2, head); mesh(new THREE.OctahedronGeometry(.04, 0), o.glow ? mat(sk) : MB(sk), 0, -.05, .23, head); }
  if (!fem && o.cloth != null && o.hair == null) o = { ...o, hair: o.beard ?? 0x2a1a10 };
  if (o.hair != null) { const h = mesh(new THREE.SphereGeometry(.31, 6, 2, 0, Math.PI * 2, 0, Math.PI * .55), mat(o.hair), 0, .02, -.03, head); h.rotation.x = -.35; if (fem) capsule(.2, .4, mat(o.hair), 0, -.22, -.15, head); }
  if (fem && o.cloth != null) { const c = mesh(new THREE.SphereGeometry(.33, 6, 2, 0, Math.PI * 2, 0, Math.PI * .5), mat(o.cloth), 0, .05, -.08, head); c.rotation.x = -.6; mesh(new THREE.CylinderGeometry(.26, .34, .5, 5, 1, true, Math.PI * .6, Math.PI * .8), mat(o.cloth), 0, -.2, -.1, head); }
  if (o.beard != null) { const bd = mesh(new THREE.ConeGeometry(.2, .42, 6), mat(o.beard), 0, -.32, .14, head); bd.rotation.x = Math.PI + .2; }
  if (o.leaves) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const l = mesh(new THREE.ConeGeometry(.1, .36, 6), mat(0x3f8a2a), Math.sin(a) * .25, .6, Math.cos(a) * .2, b); l.rotation.x = Math.PI; }
  return { g, b, legs, arms, head, knees, feet };
}
function animal(kind) {
  const g = new THREE.Group(), b = grp(0, 0, 0, g), legs = [];
  if (kind === 'monkey') {
    for (const s of [-1, 1]) { const p = pivot(b, s * .14, .42, 0); capsule(.07, .26, 0x6a4424, 0, -.2, 0, p); legs.push(p); }
    sph(.3, 0x7a5030, 0, .68, 0, b).scale.y = 1.15; const h = sph(.24, 0x7a5030, 0, 1.08, .05, b); sph(.15, 0xd8b088, 0, 1.03, .2, b).scale.z = .6;
    for (const s of [-1, 1]) { sph(.08, 0xd8b088, s * .24, 1.1, .05, b, 8, 6); sph(.035, 0x1a1010, s * .07, 1.12, .25, b, 6, 4); }
    const t = mesh(new THREE.TorusGeometry(.35, .04, 4, 7, Math.PI * 1.3), MS(0x6a4424), 0, .7, -.4, b); t.rotation.y = Math.PI / 2; return { g, b, legs, head: h };
  }
  const [c, L, W, H, legH] = { pig: [0xe8a8a0, 1.1, .7, .62, .32], fox: [0xd8702a, .95, .34, .36, .32], cow: [0x8a5a3a, 1.7, .8, .9, .75], sheep: [0xf2eee0, 1.1, .8, .8, .45], lion: [0xd0a050, 1.6, .7, .8, .7], elephant: [0x8a8a92, 2.6, 1.7, 1.8, 1.3], camel: [0xc8a06a, 1.8, .7, .9, 1.4], ram: [0xe8e2d0, 1.2, .8, .85, .5], horse: [0x6a4a30, 1.8, .6, .8, 1.0] }[kind];
  const woolly = kind === 'sheep' || kind === 'ram', lc = woolly ? 0x2a2a2a : c, lr = W * .15 + .02;
  const hip = legH + H * .35; // legs start well inside the body, so no gap shows
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = pivot(b, sx * W * .24, hip, sz * L * .3); capsule(lr, Math.max(.05, hip - lr * 2), lc, 0, -hip / 2, 0, p); legs.push(p); }
  const body = capsule(Math.min(W, H) / 2, Math.max(.1, L - Math.min(W, H)), c, 0, legH + H / 2, 0, b, 6); body.rotation.x = Math.PI / 2; body.scale.x = W / Math.min(W, H) * 1.0;
  if (woolly) for (let i = 0; i < 7; i++) sph(.28, c, rnd(-.25, .25), legH + H * .55 + rnd(-.1, .2), rnd(-.4, .4), b, 8, 6);
  const head = grp(0, legH + H * .85, L / 2 - .12, b); // tucked into the front of the body so it never floats
  const hc = woolly ? 0x2a2a2a : c, eye = (x, y, z) => { for (const s of [-1, 1]) sph(.04, 0x1a1010, s * x, y, z, head, 6, 4); };
  if (kind === 'elephant') { sph(.62, c, 0, .2, .25, head); const tr = mesh(new THREE.CylinderGeometry(.12, .24, 1.3, 6), MS(c), 0, -.5, .75, head); tr.rotation.x = .3; for (const s of [-1, 1]) { const e = sph(.5, 0x7a7a84, s * .6, .3, .1, head); e.scale.set(.2, 1, .9); const t = mesh(new THREE.ConeGeometry(.07, .5, 8), MS(0xf0f0e0), s * .3, -.3, .8, head); t.rotation.x = 1.9; } eye(.32, .35, .7); }
  else if (kind === 'camel') { const n = capsule(.15, .9, c, 0, .4, .15, head); n.rotation.x = .4; const hh = sph(.22, c, 0, 1.0, .45, head); hh.scale.z = 1.6; eye(.12, 1.08, .55); sph(.42, c, 0, legH + H + .1, 0, b).scale.y = .8; }
  else if (kind === 'horse') { const n = capsule(.17, .6, c, 0, .3, 0, head); n.rotation.x = .5; const hh = sph(.18, c, 0, .7, .4, head); hh.scale.z = 2.2; eye(.12, .78, .45); const m = capsule(.05, .6, 0x2a1a10, 0, .55, -.12, head); m.rotation.x = .5; }
  else { const hr = kind === 'fox' ? .2 : Math.max(.25, W * .42); const hh = sph(hr, hc, 0, .02, hr * .7, head); hh.scale.set(1, .95, 1.25); eye(hr * .48, hr * .35, hr * 1.55);
    if (kind === 'cow') sph(hr * .62, 0xd8b090, 0, -hr * .3, hr * 1.55, head).scale.set(1.1, .8, .8);
    if (kind === 'pig') { const sn = cyl(hr * .45, hr * .45, .16, 0xf0b8b0, 0, -.05, hr * 1.6, head, 6); sn.rotation.x = Math.PI / 2; for (const s2 of [-1, 1]) mesh(new THREE.ConeGeometry(.08, .18, 4), MS(c), s2 * hr * .6, hr * .8, hr * .3, head); }
    if (kind === 'fox') { const sn = mesh(new THREE.ConeGeometry(.09, .3, 5), MS(hc), 0, -.02, hr * 1.7, head); sn.rotation.x = Math.PI / 2; for (const s2 of [-1, 1]) mesh(new THREE.ConeGeometry(.07, .2, 4), MS(hc), s2 * .1, .2, .12, head); } }
  if (kind === 'cow') for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(.06, .34, 5), MS(0xf0e8d0), s * .3, .36, .2, head); h.rotation.z = -s * .8; }
  if (kind === 'ram') for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(.16, .06, 4, 7, 4.5), MS(0xc8b888), s * .24, .16, .08, head); h.rotation.y = s * Math.PI / 2; }
  if (kind === 'lion') { const m = sph(.46, 0x8a4a18, 0, .05, .02, head); m.scale.z = .7; sph(.26, c, 0, .02, .26, head).scale.z = 1.1; eye(.12, .1, .48); }
  const tail = kind === 'fox' ? capsule(.1, .4, c, 0, legH + H * .5, -L / 2 - .2, b, 5) : capsule(.04, .55, kind === 'lion' ? 0x8a4a18 : c, 0, legH + H * .6, -L / 2 - .15, b, 6); tail.rotation.x = kind === 'fox' ? 1.1 : .5; if (kind === 'fox') sph(.1, 0xffffff, 0, legH + H * .3, -L / 2 - .45, b, 5, 3);
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
function rainbowMesh(R = 60) { const g = new THREE.Group(); [0xff3030, 0xff9020, 0xffe030, 0x40d040, 0x3080ff, 0x8040d0].forEach((c, i) => { mesh(new THREE.TorusGeometry(R - i * 2.2, 1.2, 3, 28, Math.PI), MB(c, { transparent: true, opacity: .6, fog: false, depthWrite: false }), 0, 0, 0, g); }); return g; }
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
  adam: { name: 'អ័ដាម', skin: 0xb07850, top: 0xb07850, bottom: 0xb07850, hair: 0x2a1a10, barefoot: true },
  eve: { name: 'អេវ៉ា', skin: 0xc08a60, top: 0xc08a60, bottom: 0xc08a60, hair: 0x3a2010, female: true, barefoot: true },
  noah: { name: 'ណូអេ', skin: 0xa07050, top: 0x7a5a3a, bottom: 0x8a6a44, robe: true, cloth: 0xe0d8c0, beard: 0xf0f0f0 },
  builder: { name: 'អ្នកសង់', skin: 0x9a6a44, top: 0xc8a878, bottom: 0x8a6a4a, hair: 0x1a1010, cloth: 0xb03a2a },
  jacob: { name: 'យ៉ាកុប', skin: 0xa07050, top: 0x6a4a8a, bottom: 0x8a7a5a, robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a },
  joseph: { name: 'យ៉ូសែប', skin: 0xb07a50, top: 0xe0d8c0, bottom: 0xe0d8c0, robe: true, hair: 0x2a1a10 },
  moses: { name: 'ម៉ូសេ', skin: 0xa07050, top: 0x8a5a3a, bottom: 0x8a6a44, robe: true, cloth: 0xe8e0c8, beard: 0xd8d8d8, staff: true },
  ehud: { name: 'អេហ៊ូឌ', skin: 0xa07050, top: 0x5a6a3a, bottom: 0x8a7a5a, robe: true, cloth: 0xd8c8a0, beard: 0x2a1a10 },
  samson: { name: 'សាំសុន', skin: 0xa86e46, top: 0x8a5a3a, bottom: 0x6a4a2a, hair: 0x1a1010, female: true, beard: 0x1a1010, scale: 1.15 },
  miriam: { name: 'ម៉ារាម', skin: 0xb07a50, top: 0x8a6a3a, robe: true, hair: 0x2a1a10, female: true, small: true },
  ruth: { name: 'រស់', skin: 0xb07a50, top: 0x8a4a3a, robe: true, cloth: 0xe8d8c0, female: true },
  david: { name: 'ដាវីឌ', skin: 0xc08060, top: 0xc8a878, bottom: 0x8a6a4a, hair: 0xa04a20, small: true },
  elijah: { name: 'អេលីយ៉ា', skin: 0xa07050, top: 0x6a4a2a, robe: true, hair: 0x6a6a6a, beard: 0x8a8a8a },
  jonah: { name: 'យ៉ូណាស', skin: 0xa07050, top: 0x3a6a6a, robe: true, cloth: 0xe0d0b0, beard: 0x3a2a1a },
  shadrach: { name: 'សាដ្រាក់', skin: 0x9a6a44, top: 0x8a3a2a, robe: true, cloth: 0xe0d0b0 },
  daniel: { name: 'ដានីយ៉ែល', skin: 0x9a6a44, top: 0x2a5a6a, robe: true, cloth: 0xe8e0c8, beard: 0x5a5a5a },
  shepherd: { name: 'គង្វាល', skin: 0xa07050, top: 0x6a5a3a, robe: true, cloth: 0xc8b898, beard: 0x2a1a10 },
  peter: { name: 'ពេត្រុស', skin: 0xa07050, top: 0x5a6a8a, robe: true, hair: 0x3a2a1a, beard: 0x3a2a1a },
  boy: { name: 'ក្មេងប្រុស', skin: 0xb07a50, top: 0xc8a878, bottom: 0x8a6a4a, hair: 0x2a1a10, small: true },
  zacchaeus: { name: 'សាខេ', skin: 0xa07050, top: 0x8a2a5a, robe: true, cloth: 0xf0e0b0, beard: 0x2a1a10, scale: .78 },
  magdalene: { name: 'ម៉ារី ម៉ាក់ដាឡា', skin: 0xb07a50, top: 0x8a3a3a, robe: true, cloth: 0xd8c8b0, female: true },
  jesus: { name: 'ព្រះយេស៊ូ', skin: 0xa87048, top: 0xf0ece0, bottom: 0xf0ece0, robe: true, sleeve: 0xf0ece0, hair: 0x3a2414, female: true, beard: 0x3a2414 },
  simon: { name: 'ស៊ីម៉ូន', skin: 0x6a4428, top: 0x7a6a3a, robe: true, cloth: 0xd8c8a0, beard: 0x1a1010 },
  friend: { name: 'មិត្ត ម្នាក់', skin: 0xa07050, top: 0x6a4a3a, robe: true, cloth: 0xd8c8a0, beard: 0x2a1a10 },
  andrew: { name: 'អនទ្រេ', skin: 0xa07050, top: 0x4a6a3a, robe: true, hair: 0x3a2a1a, beard: 0x3a2a1a },
  farmer: { name: 'អ្នក សាប ព្រោះ', skin: 0xa07050, top: 0x8a7a4a, bottom: 0x6a5a3a, hair: 0x2a1a10, cloth: 0xe0d0b0 },
  samaritan: { name: 'សាសន៍ សាម៉ារី', skin: 0x9a6a44, top: 0x3a6a8a, robe: true, cloth: 0xc8a050, beard: 0x2a1a10 },
  son: { name: 'កូនប្រុស ពៅ', skin: 0xb07a50, top: 0x6a6a5a, robe: true, hair: 0x2a1a10 },
  john_old: { name: 'យ៉ូហាន', skin: 0xa07050, top: 0x8a6a4a, robe: true, hair: 0xe0e0e0, beard: 0xe0e0e0 },
  philip: { name: 'ភីលីព', skin: 0xa07050, top: 0x4a6a8a, robe: true, cloth: 0xe0d0b0, beard: 0x3a2a1a },
  saul: { name: 'សូល', skin: 0xa07050, top: 0x2a2a3a, robe: true, cloth: 0x8a2a2a, beard: 0x1a1010 },
  paul: { name: 'ប៉ុល', skin: 0xa07050, top: 0x6a4a3a, robe: true, hair: 0x3a2a1a, beard: 0x3a2a1a },
  helper: { name: 'អ្នកជំនួយ', skin: 0xb07a50, top: 0x3a6a8a, bottom: 0x7a5a40, hair: 0x2a1a10 },
  abram: { name: 'អាប់រ៉ាម', skin: 0xa07050, top: 0x3a5a9a, bottom: 0xe0d8c0, robe: true, cloth: 0xf0ead8, beard: 0xc8c8c8 },
};
// v: [preferred reader (index into peak.speakers), target pitch in Hz]. Words are pitch-shifted to the
// target whichever reader recorded them, so a character keeps one voice. Readers' median F0 is in SPK_F0.
const SPK_F0 = { 'kheng:1': 239, 'rith:': 138, 'khsv:1': 112, 'khsv:2': 118, 'khsv:3': 130, 'khsv:4': 130 };
const CAST = {
  god: { km: 'ព្រះជាម្ចាស់', v: [2, 92] }, al: { km: 'អាល់', v: [1, 130] }, me: { km: '', v: [3, 120] },
  adam: { km: 'អ័ដាម', v: [3, 120] }, eve: { km: 'អេវ៉ា', v: [0, 228] }, snake: { km: 'ពស់', v: [1, 155] },
  wife: { km: 'ប្រពន្ធ', v: [0, 212] }, son: { km: 'សិម', v: [5, 136] }, nb: { km: 'អ្នកជិតខាង', v: [1, 128] },
  boss: { km: 'មេការ', v: [2, 100] }, friend: { km: 'មិត្ត', v: [4, 142] }, w1: { km: 'អ្នកសង់', v: [5, 130] },
  sarai: { km: 'សារ៉ាយ', v: [0, 208] }, sarah: { km: 'សារ៉ា', v: [0, 208] }, lot: { km: 'ឡុត', v: [3, 125] }, guest: { km: 'ភ្ញៀវ', v: [2, 112] },
  isaac: { km: 'អ៊ីសាក', v: [0, 275] }, father: { km: 'យ៉ាកុប', v: [3, 110] }, bro: { km: 'បងប្រុស', v: [5, 130] }, trader: { km: 'ឈ្មួញ', v: [1, 125] },
  pharaoh: { km: 'ផារ៉ោន', v: [2, 105] }, eglon: { km: 'អេក្លូន', v: [2, 95] }, guard: { km: 'អ្នកយាម', v: [1, 125] }, samson: { km: 'សាំសុន', v: [2, 100] }, mom: { km: 'ម្ដាយ', v: [0, 210] }, princess: { km: 'បុត្រី ផារ៉ោន', v: [0, 230] }, maid: { km: 'អ្នកបម្រើ', v: [0, 220] }, aaron: { km: 'អើរ៉ុន', v: [3, 115] }, naomi: { km: 'ណាអូមី', v: [0, 200] }, boaz: { km: 'បូអូស', v: [2, 105] }, saul: { km: 'សូល', v: [2, 105] }, goliath: { km: 'កូលីយ៉ាត', v: [2, 80] },
  baal: { km: 'ហោរា បាល', v: [1, 130] }, sailor: { km: 'អ្នក បើក សំពៅ', v: [4, 135] },
  meshach: { km: 'មីសាក់', v: [4, 125] }, abed: { km: 'អ័បេឌនេកោ', v: [5, 130] }, king: { km: 'ស្ដេច', v: [2, 100] }, official: { km: 'មន្ត្រី', v: [1, 125] }, shep2: { km: 'គង្វាល', v: [4, 125] },
  mary: { km: 'ម៉ារី', v: [0, 220] }, joseph2: { km: 'យ៉ូសែប', v: [3, 115] }, jesus: { km: 'ព្រះយេស៊ូ', v: [3, 112] }, nation: { km: 'ភ្ញៀវ បរទេស', v: [5, 130] }, priest: { km: 'អ្នក ធ្វើ ដំណើរ', v: [1, 125] }, victim: { km: 'បុរស របួស', v: [3, 115] }, host: { km: 'ម្ចាស់ ផ្ទះ សំណាក់', v: [5, 125] }, dad: { km: 'ឪពុក', v: [2, 105] }, elder: { km: 'ពួក ចាស់ទុំ', v: [2, 100] }, friend2: { km: 'មិត្ត', v: [4, 128] }, healed: { km: 'អ្នក ខ្វិន', v: [1, 120] }, legion: { km: 'បុរស មាន អារក្ស', v: [2, 85] }, women: { km: 'ពួក ស្ត្រី', v: [0, 215] }, centurion: { km: 'មេទ័ព', v: [2, 105] }, john: { km: 'យ៉ូហាន', v: [5, 130] }, beggar: { km: 'អ្នក ពិការ', v: [1, 120] }, eunuch: { km: 'មន្ត្រី អេធីយ៉ូពី', v: [2, 110] },
  ananias: { km: 'អាណានាស', v: [3, 115] }, rhoda: { km: 'រ៉ូដា', v: [0, 240] }, silas: { km: 'ស៊ីឡាស', v: [4, 120] }, jailer: { km: 'ឆ្មាំ គុក', v: [1, 120] }, native: { km: 'អ្នក កោះ ម៉ាល់តា', v: [5, 130] }, disciple: { km: 'សិស្ស', v: [5, 125] }, people: { km: 'ប្រជាជន', v: [4, 140] }, angel: { km: 'ទេវតា', v: [1, 145] },
};
const HERO_V = { adam: [3, 120], eve: [0, 228], noah: [4, 104], builder: [5, 126], abram: [2, 100], jacob: [3, 118], joseph: [5, 140], moses: [2, 100], ehud: [3, 115], samson: [2, 100], helper: [5, 140], miriam: [0, 260], ruth: [0, 220], david: [5, 150], elijah: [2, 100], jonah: [3, 115], shadrach: [3, 120], daniel: [2, 105], shepherd: [4, 120], peter: [3, 115], boy: [5, 170], zacchaeus: [1, 130], magdalene: [0, 220], philip: [4, 120], farmer: [4, 120], samaritan: [2, 110], son: [5, 135], john_old: [2, 100], friend: [4, 120], andrew: [3, 118], simon: [2, 110], saul: [2, 110], paul: [2, 110] };
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
  'ជណ្ដើរ': () => ladder(6), 'ថ្ម': () => rock(.8), 'អាវ': () => person({ coat: true, top: 0xd03a2a }).g, 'រណ្ដៅ': () => { const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(1, 1, .3, 8), 0x7a6a50, 0, 0, 0, g); mesh(new THREE.CircleGeometry(.9, 8).rotateX(-Math.PI / 2), MB(0x0a0808), 0, .16, 0, g); return g; },
  'ប្រាក់': () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) cyl(.3, .3, .06, 0xd8d8e0, (i % 3 - 1) * .5, i * .07, (i % 2) * .4, g, 8); return g; }, 'ផារ៉ោន': () => { const p = person({ skin: 0x9a6a44, top: 0xf0f0e8, robe: true, cloth: 0x2f5fd0 }); cone(.22, .6, 0xf2c51c, 0, .5, 0, p.head, 5); return p.g; },
  'គុម្ពោត': () => { const b = bush(0x4a6a2a); const f = fire(); f.position.y = .7; b.add(f); return b; }, 'ដំបង': () => cyl(.06, .06, 2.2, 0x6a4424, 0, 0, 0, null, 5), 'សមុទ្រ': () => box(3, .6, 2, new THREE.MeshLambertMaterial({ color: 0x2a6ab0, map: waterTex })),
  'យ៉ាកុប': () => person(HEROES.jacob).g, 'យ៉ូសែប': () => person({ ...HEROES.joseph, coat: true, top: 0xd03a2a }).g, 'ម៉ូសេ': () => person(HEROES.moses).g, 'ធាត់': () => { const a = animal('cow'); a.b.scale.set(1.7, 1.15, 1.05); return a.g; }, 'ស្គម': () => { const a = animal('cow'); a.b.scale.set(.5, 1, .95); return a.g; },
  'ស្បែកជើង': () => { const g = new THREE.Group(); for (const s of [-1, 1]) box(.3, .08, .6, 0x4a3420, s * .25, 0, 0, g); return g; },
  'កញ្ជ្រាង': () => animal('fox').g, 'ស្រូវ': () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) cone(.3, 1.4, 0xe8c040, (i % 3 - 1) * .6, .7, Math.floor(i / 3) * .6, g, 4); return g; },
  'គប់ភ្លើង': () => { const g = new THREE.Group(); cyl(.06, .06, 1, 0x6a4424, 0, 0, 0, g, 5); const f = fire(); f.scale.setScalar(.5); f.position.y = .5; g.add(f); return g; }, 'កន្ទុយ': () => { const a = animal('fox'); a.g.rotation.y = Math.PI; return a.g; },
  'ខ្សែ': () => mesh(new THREE.TorusGeometry(.6, .1, 4, 10), 0xc8a870), 'ឆ្អឹង': () => { const g = new THREE.Group(); box(.2, .16, 1.4, 0xf0ead8, 0, 0, 0, g); box(.2, .6, .16, 0xf0ead8, 0, .25, -.66, g); return g; },
  'ទ្វារ': () => { const g = new THREE.Group(); box(1.8, 2.2, .2, plankM, 0, 1.1, 0, g); return g; }, 'សាំសុន': () => person(HEROES.samson).g, 'អេហ៊ូឌ': () => person(HEROES.ehud).g,
  'អេក្លូន': () => { const p = person({ skin: 0x9a6a44, top: 0x6a2a6a, robe: true, cloth: 0xf2c51c, beard: 0x1a1010 }); p.b.scale.set(1.9, 1.05, 1.7); return p.g; }, 'ស្ដេច': () => { const p = person({ skin: 0x9a6a44, top: 0x6a2a6a, robe: true, beard: 0x1a1010 }); cone(.22, .5, 0xf2c51c, 0, .45, 0, p.head, 5); return p.g; },
  'សួយសារអាករ': () => { const g = new THREE.Group(); cyl(.4, .3, .5, 0xb08a50, 0, 0, 0, g, 7); ball(.3, 0xe03a2a, 0, .3, 0, g, 5, 3); return g; }, 'ស្នែង': () => { const m = mesh(new THREE.ConeGeometry(.2, 1.2, 6), 0xe0d0a0); m.rotation.z = 1.3; return m; },
  'ដៃ': () => { const g = new THREE.Group(); capsule(.12, .6, 0xa07050, 0, 0, 0, g, 4); return g; }, 'ភីលីស្ទីន': () => { const p = person({ skin: 0xa07050, top: 0x8a2a2a, bottom: 0x5a3a2a, cloth: 0xc8a040 }); return p.g; },
  'កន្ត្រក': () => basket(), 'ទារក': () => basket(), 'កង្កែប': () => { const g = new THREE.Group(); sph(.4, 0x3a8a2a, 0, 0, 0, g, 5, 3).scale.set(1, .6, 1.2); for (const s2 of [-1, 1]) sph(.1, 0x1a1010, s2 * .18, .2, .35, g, 4, 3); return g; },
  'ម៉ាណា': () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) sph(.2, 0xf8f8f0, rnd(-.5, .5), 0, rnd(-.5, .5), g, 5, 3).scale.y = .4; return g; }, 'ក្រួច': () => bird(0x8a6a4a).g, 'បន្ទះ': () => { const g = new THREE.Group(); for (const s2 of [-1, 1]) box(.5, .75, .1, 0x9a9a92, s2 * .28, 0, 0, g); return g; },
  'ភ្នំ ស៊ីណាយ': () => cone(2, 2.4, 0x8a7a6a, 0, 0, 0, null, 6), 'មាស': () => { const a = animal('cow'); a.g.traverse(o => { if (o.material) o.material = M(0xf2c51c); }); return a.g; }, 'ឈាម': () => sph(.6, 0xa01818, 0, 0, 0, null, 6, 4), 'ទន្លេ': () => box(3, .3, 1.5, new THREE.MeshLambertMaterial({ color: 0x3a7ab0, map: waterTex })), 'ម៉ូអាប់': () => person({ skin: 0x9a6a44, top: 0x2a3a6a, robe: true }).g,
  'ទឹកឃ្មុំ': () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(.3, .3, .4, 6), MB(0xf2b81c), (i % 3 - 1) * .55, 0, Math.floor(i / 3) * .5, g); return g; }, 'ឃ្មុំ': () => { const g = new THREE.Group(); sph(.4, 0xf2c51c, 0, 0, 0, g, 6, 4).scale.z = 1.4; for (const s2 of [-1, 1]) box(.6, .04, .3, MB(0xffffff, { transparent: true, opacity: .6 }), s2 * .4, .3, 0, g); return g; },
  'គ្រឿង សឹក': () => { const g = new THREE.Group(); cyl(.5, .5, 1, 0x8a8a92, 0, 0, 0, g, 7); return g; }, 'កូលីយ៉ាត': () => { const p = person({ skin: 0x9a6a44, top: 0x9a8a60, cloth: 0xb8a060, beard: 0x1a1010 }); p.b.scale.setScalar(1.6); return p.g; }, 'សំពៅ': () => ship(), 'ពពក': () => cloud(), 'ឆ្កែ': () => { const a = animal('fox'); a.g.traverse(o => { if (o.material) o.material = M(0x8a6a4a); }); return a.g; },
  'ណាអូមី': () => person({ skin: 0xa07050, top: 0x3a3a5a, robe: true, cloth: 0xd8d0c0, female: true }).g, 'បូអូស': () => person({ skin: 0xa07050, top: 0x5a3a6a, robe: true, cloth: 0xf0e8d8, beard: 0x5a4a3a }).g, 'ដាវីឌ': () => person(HEROES.david).g, 'អេលីយ៉ា': () => person(HEROES.elijah).g, 'យ៉ូណាស': () => person(HEROES.jonah).g,
  'ព្រះយេស៊ូ': () => person(HEROES.jesus).g, 'យេស៊ូ': () => person(HEROES.jesus).g, 'ស្នូក': () => { const g = new THREE.Group(); box(1.4, .6, .8, 0x8a6a3a, 0, 0, 0, g); box(1.2, .15, .6, 0xe8d060, 0, .32, 0, g); sph(.2, 0xc08a60, -.2, .45, 0, g); return g; },
  'ឡ': () => { const g = new THREE.Group(); box(2, 1.6, 2, brickM, 0, 0, 0, g); const f2 = fire(); f2.position.set(0, -.3, 1); g.add(f2); return g; }, 'ភ្លេង': () => { const g = new THREE.Group(); cyl(.1, .3, 1.2, 0xc8a040, 0, 0, 0, g, 6); return g; }, 'ទូក': () => { const g = new THREE.Group(); box(1.4, .5, 3, plankM, 0, 0, 0, g); return g; },
  'គង្វាល': () => person(HEROES.shepherd).g, 'សាខេ': () => person(HEROES.zacchaeus).g, 'ផ្នូរ': () => { const g = new THREE.Group(); sph(1.2, 0x9a8a70, 0, 0, 0, g); mesh(new THREE.CircleGeometry(.5, 6), MB(0x0a0808), 0, 0, 1.2, g); return g; }, 'ដានីយ៉ែល': () => person(HEROES.daniel).g,
  'ឈើឆ្កាង': () => crossMesh(), 'លា': () => { const a = animal('horse'); a.g.scale.setScalar(.8); return a.g; }, 'គ្រាប់ពូជ': () => { const g = new THREE.Group(); for (let i = 0; i < 8; i++) sph(.12, 0xe8d8a0, rnd(-.4, .4), 0, rnd(-.4, .4), g, 4, 2); return g; }, 'បន្លា': () => bush(0x2a4a1a), 'ក្រុង': () => box(2, 1.2, 2, MB(0xf2c51c)), 'បល្ល័ង្ក': () => box(1.4, 1.8, 1.1, 0xf2c51c), 'ជើង ចង្កៀង': () => { const l = new THREE.Group(); cyl(.08, .2, 1.8, 0xf2c51c, 0, 0, 0, l, 6); return l; }, 'ជ្រូក': () => animal('pig').g, 'កន្ទេល': () => box(1, .12, 2.2, 0xc8a870), 'ដំបូល': () => box(2, .3, 2, 0xb89a70), 'ធូលី': () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) sph(.15, 0xc8b088, rnd(-.4, .4), rnd(0, .4), rnd(-.4, .4), g, 4, 2); return g; },
  'ច្រវាក់': () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const c = mesh(new THREE.TorusGeometry(.2, .06, 3, 6), 0x4a4a50, i * .3, 0, 0, g); c.rotation.y = i % 2 ? Math.PI / 2 : 0; } return g; }, 'រទេះ': () => chariot(), 'គុក': () => { const g = new THREE.Group(); for (let i = -2; i <= 2; i++) cyl(.06, .06, 2, 0x3a3a40, i * .3, 0, 0, g, 4); return g; },
  'ឧស': () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) cyl(.05, .05, 1, 0x6a4424, (i - 2) * .12, 0, 0, g, 4).rotation.z = Math.PI / 2; return g; }, 'ភីលីព': () => person(HEROES.philip).g, 'ប៉ុល': () => person(HEROES.paul).g, 'ពេត្រុស': () => person(HEROES.peter).g,
  'សម្លៀកបំពាក់': () => { const g = new THREE.Group(); cyl(.4, .7, 1.4, 0x8a5a30, 0, 0, 0, g, 6); return g; },
};

/* ---------------- world ---------------- */
let world = new THREE.Group(); scene.add(world);
let H = () => 0, bound = 80, clampFn = null;
const solids = [], ents = [], acts = [], floors = [];
let ground = null, water = null, waterY = -100;
function clearWorld() { faded.clear(); occlT = 0; talkCam = null; lastPartner = null; shake = 0; track = null; yOverride = null; player.raise = false; scene.remove(world); world = new THREE.Group(); scene.add(world); solids.length = ents.length = acts.length = floors.length = 0; ground = water = null; waterY = -100; clampFn = null; tags = {}; anims.length = 0; stars.material.opacity = 0; marker(null); }
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
function npc(id, opts, x, z, yaw = 0) { LOOK[id] = { key: id + JSON.stringify(opts), make: () => person(opts) }; const m = person(opts); const e = ent(m, x, z, { yaw, id }); e.talk = id; tag(CAST[id]?.km, e.g); return e; }

/* ---------------- player & camera ---------------- */
let hero = null, heroId = null;
const player = { x: 0, z: 0, yaw: 0, y: 0, carry: null };
function setHero(id, x, z, yaw = 0) {
  if (hero) world.remove(hero.g);
  for (let i = solids.length - 1; i >= 0; i--) if (Math.hypot(solids[i].x - x, solids[i].z - z) < solids[i].r + 1.2) solids.splice(i, 1);
  heroId = id; hero = person(HEROES[id]); world.add(hero.g); CAST.me.km = HEROES[id].name; CAST.me.v = HERO_V[id];
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
const atXZ = at => !at ? null : typeof at === 'function' ? at() : Array.isArray(at) ? at : at.g ? [at.x, at.z] : at.position ? [at.position.x, at.position.z] : null;
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
// conversation camera: over your shoulder at whoever speaks, over theirs when you answer
let talkCam = null, lastPartner = null;
function speakerEnt(who) {
  if (who === 'god') return godLight && godLight.visible ? { x: godLight.position.x, z: godLight.position.z, y: godLight.position.y, god: true } : null;
  let b = null, bd = 28; for (const e of ents) { if (e.id !== who || e.hide || !e.g.visible || e.dead) continue; const d = Math.hypot(e.x - player.x, e.z - player.z); if (d < bd) { bd = d; b = e; } } return b;
}
function aimTalk(who) {
  if (!hero || cine || track) return talkCam = null;
  let s2 = null, rev = false;
  if (who === 'me') { s2 = lastPartner && ents.includes(lastPartner) && !lastPartner.hide && Math.hypot(lastPartner.x - player.x, lastPartner.z - player.z) < 28 ? lastPartner : null; rev = true; }
  else { s2 = speakerEnt(who); if (s2 && !s2.god) lastPartner = s2; }
  if (!s2) return talkCam = null;
  const dx = s2.x - player.x, dz = s2.z - player.z, L = Math.max(.5, Math.hypot(dx, dz)), mx = (s2.x + player.x) / 2, mz = (s2.z + player.z) / 2;
  const side = ((camera.position.x - mx) * -dz / L + (camera.position.z - mz) * dx / L) >= 0 ? 1 : -1;
  talkCam = { s: s2, rev, side: talkCam && talkCam.s === s2 ? talkCam.side : side };
}
function say(who, text, o = {}) {
  if (who === 'al') return Promise.resolve(); // no narrator: the scene carries it
  if (who === 'me' && !o.chosen && !text.includes('*')) return choose(text); // you pick what you say
  return new Promise(res => {
    $('#kb').classList.add('hide'); $('#book').classList.add('hide'); // a line that pops up closes the keyboard/book
    ui = 'dlg'; joyEnd(); speaking = who; curLine = { who, text, o };
    const fx = !!o.lang;
    $('#who').textContent = CAST[who]?.km || who; showAva(who); aimTalk(who); $('#dlg').classList.remove('hide'); $('#hear').classList.remove('hide');
    $('#line').innerHTML = wordsHTML(text, fx); const tk = tokens(text); bindWords($('#line'), tk);
    if (!fx) seeWords(text);
    const trig = tk.some(t => t.trig);
    $('#more').classList.toggle('hide', trig);
    const fin = v => { dlgRes = trigRes = null; $('#dlg').classList.add('hide'); ui = null; hearing++; talkCam = null; res(v); };
    if (trig) { trigRes = w => { playWord(w); fin(w); }; dlgRes = null; }
    else dlgRes = () => fin();
    hearLine(text, o.lang);
    if (o.auto) setTimeout(() => dlgRes === null || fin(), o.auto * 1000);
  });
}
// Your lines are chosen. Alternatives that would stall the story ('strict') get a pause and you choose again.
const ALT = {
  'ខ្ញុំ ចង់ ធ្វើ ជា ដី ល្អ ។': { alt: ['ខ្ញុំ ចូលចិត្ត បន្លា ។'] },
  'អាណិត គាត់ ណាស់ ! ខ្ញុំ នឹង ជួយ គាត់ ។': { alt: ['មិន មែន រឿង ខ្ញុំ ទេ ។'], strict: true },
  'ចៀម មួយ បាត់ ! ខ្ញុំ ត្រូវ ទៅ រក វា ។': { alt: ['កៅសិប ប្រាំបួន គ្រប់ គ្រាន់ ហើយ ។'], strict: true },
  'ខ្ញុំ នឹង ត្រឡប់ ទៅ រក ឪពុក ។ ខ្ញុំ នឹង និយាយ ថា ៖ ខ្ញុំ បាន ធ្វើ បាប ។': { alt: ['ខ្ញុំ នឹង នៅ ទីនេះ ជាមួយ ជ្រូក ។'], strict: true },
  'ឪពុក ! ខ្ញុំ បាន ធ្វើ បាប ។ ខ្ញុំ មិន សម ជា កូន របស់ ឪពុក ទៀត ទេ ។': { alt: ['ឪពុក ! ឲ្យ ប្រាក់ ខ្ញុំ ទៀត !'], strict: true },
  'អាម៉ែន ! សូម យាង មក ព្រះអម្ចាស់ យេស៊ូ !': { alt: ['អាម៉ែន !'] },
  'តោះ ឡើង លើ ដំបូល ផ្ទះ !': { alt: ['តោះ ទៅ ផ្ទះ វិញ ។'], strict: true },
  'ចូរ ប្រែ ចិត្ត ! នគរ ព្រះ មក ជិត ហើយ !': { alt: ['ខ្ញុំ ហត់ ណាស់ ។'], strict: true },
  'ព្រះអម្ចាស់ ! សូម្បី តែ អារក្ស ក៏ ស្ដាប់ យើង ក្នុង ព្រះនាម ព្រះអង្គ !': { alt: ['ភូមិ ទី ពីរ អាក្រក់ ណាស់ !'] },
  'ព្រះអម្ចាស់ ! បើ ពិត ជា ព្រះអង្គ សូម បង្គាប់ ឲ្យ ខ្ញុំ ដើរ លើ ទឹក មក រក ព្រះអង្គ ។': { alt: ['ខ្ញុំ នៅ ក្នុង ទូក ។'], strict: true },
  'ខ្ញុំ មក ពី ស្រុក គីរេន ។ មាន រឿង អ្វី ?': { alt: ['ខ្ញុំ ចង់ ទៅ ផ្សារ ។'] },
  'ព្រះយេស៊ូ ស្លាប់ សម្រាប់ មនុស្ស គ្រប់ គ្នា ។': { alt: ['ខ្ញុំ មិន យល់ ទេ ...'] },
  'ចូរ ប្រែ ចិត្ត ហើយ ទទួល ពិធី ជ្រមុជ ទឹក ក្នុង ព្រះនាម ព្រះយេស៊ូគ្រីស្ទ !': { alt: ['ទៅ ផ្ទះ វិញ ចុះ ។'], strict: true },
  'ខ្ញុំ គ្មាន ប្រាក់ ទេ ។ ប៉ុន្តែ ក្នុង ព្រះនាម ព្រះយេស៊ូ ចូរ ក្រោក ឡើង ហើយ ដើរ !': { alt: ['សូម ទោស ខ្ញុំ គ្មាន អ្វី ទេ ។'], strict: true },
  'តើ លោក យល់ អ្វី ដែល លោក អាន ទេ ?': { alt: ['រទេះ លោក ស្អាត ណាស់ ។'] },
  'លោក ម្ចាស់ ! លោក ជា នរណា ?': { alt: ['ខ្ញុំ មិន ខ្លាច ទេ !'], strict: true },
  'កុំ ធ្វើ បាប ខ្លួន ឯង ! យើង នៅ ទីនេះ ទាំងអស់ គ្នា !': { alt: ['តោះ រត់ !'], strict: true },
  'ចូរ ជឿ ព្រះអម្ចាស់ យេស៊ូ នោះ លោក នឹង បាន សង្គ្រោះ ទាំង គ្រួសារ លោក ។': { alt: ['ខ្ញុំ មិន ដឹង ទេ ។'], strict: true },
  'ទេ ! ខ្ញុំ ជា មនុស្ស ។ ព្រះយេស៊ូ ការពារ ខ្ញុំ ។': { alt: ['បាទ ! ខ្ញុំ ជា ព្រះ !'], strict: true },
  'យើង មិន ក្រាប ថ្វាយបង្គំ រូប នេះ ទេ !': { alt: ['បាទ ! យើង ក្រាប ។'], strict: true },
  'ខ្ញុំ នឹង អធិស្ឋាន ដល់ ព្រះ ខ្ញុំ ដូច ពី មុន ។': { alt: ['ខ្ញុំ នឹង ឈប់ អធិស្ឋាន ។'], strict: true },
  'ព្រះ របស់ ខ្ញុំ បាន ចាត់ ទេវតា មក បិទ មាត់ តោ ។': { alt: ['តោ ទាំងនេះ ឃ្លាន ណាស់ !'], strict: true },
  'លោកគ្រូ ! យើង ជិត ស្លាប់ ហើយ ! លោក មិន ខ្វល់ ទេ ឬ ?': { alt: ['ខ្ញុំ ចង់ ដេក ដែរ ។'] },
  'នេះ ជា អាហារ របស់ ខ្ញុំ ។ យក ទៅ ។': { alt: ['ទេ ! អាហារ នេះ ជា របស់ ខ្ញុំ !'], strict: true },
  'ព្រះអម្ចាស់ ! ខ្ញុំ នឹង ឲ្យ ទ្រព្យ ពាក់ កណ្ដាល ដល់ អ្នក ក្រ ។ ខ្ញុំ នឹង សង វិញ បួន ដង ។': { alt: ['ប្រាក់ ទាំងអស់ ជា របស់ ខ្ញុំ !'], strict: true },
  'រ៉ាបូនី ! លោកគ្រូ !': { alt: ['លោក ជា អ្នក ថែ សួន មែន ទេ ?'], strict: true },
  'ខ្ញុំ បាន ឃើញ ព្រះអម្ចាស់ ! ព្រះអង្គ មាន ព្រះជន្ម រស់ ឡើង វិញ !': { alt: ['ខ្ញុំ មិន ដឹង ទេ ។'], strict: true },
  'ពួក ភីលីស្ទីន ធ្វើ អាក្រក់ ដាក់ ខ្ញុំ ។ ខ្ញុំ នឹង តប វិញ ។': { alt: ['ខ្ញុំ ចូលចិត្ត ពួក ភីលីស្ទីន ។'], strict: true },
  'ទីណា ដែល អ្នក ទៅ ខ្ញុំ ក៏ ទៅ ដែរ ។ ព្រះ របស់ អ្នក ជា ព្រះ របស់ ខ្ញុំ ។': { alt: ['លា ហើយ ណាអូមី ។'], strict: true },
  'ខ្ញុំ នឹង ទៅ ច្បាំង ជាមួយ គាត់ ។': { alt: ['ខ្ញុំ ខ្លាច ណាស់ ។'], strict: true },
  'អ្នក មក ជាមួយ ដាវ ។ ខ្ញុំ មក ក្នុង ព្រះនាម ព្រះជាម្ចាស់ !': { alt: ['ខ្ញុំ រត់ ទៅ ផ្ទះ !'], strict: true },
  'ទេ ! ខ្ញុំ នឹង រត់ ទៅ ក្រុង តើស៊ីស ។': { alt: ['បាទ ។ ខ្ញុំ ទៅ នីនីវេ ។'], strict: true },
  'ដោយសារ ខ្ញុំ ។ បោះ ខ្ញុំ ទៅ ក្នុង សមុទ្រ ។': { alt: ['មិន មែន ខ្ញុំ ទេ !'], strict: true },
  'ព្រះជាម្ចាស់ អើយ ! សូម ឆ្លើយ មក ! ឲ្យ គេ ដឹង ថា ព្រះអង្គ ជា ព្រះ ។': { alt: ['បាល អើយ ! ឆ្លើយ មក !'], strict: true },
  'ខ្ញុំ អាច រក ម្ដាយ ដោះ សម្រាប់ ទារក នេះ ។': { alt: ['នោះ ជា ប្អូន ខ្ញុំ !'], strict: true },
  'ផារ៉ោន ! ឲ្យ ប្រជាជន ព្រះជាម្ចាស់ ចេញ ទៅ !': { alt: ['សូម ទោស ផារ៉ោន ។'], strict: true },
  'អ្នក រាល់ គ្នា ធ្វើ បាប ធំ !': { alt: ['គោ មាស ស្អាត ណាស់ !'], strict: true },
  'ព្រះជាម្ចាស់ មាន ព្រះហឫទ័យ មេត្តាករុណា ។': { alt: ['ខ្ញុំ ហត់ ណាស់ ។'] },
  'បាទ ។ ខ្ញុំ នឹង ទៅ ។': { alt: ['ខ្ញុំ ខ្លាច ស្ដេច ។'] },
  'ព្រះករុណា ! ខ្ញុំ មាន សារ សម្ងាត់ សម្រាប់ ព្រះអង្គ ។': { alt: ['ខ្ញុំ ចង់ ទៅ ផ្ទះ ។'], strict: true },
  'តាម ខ្ញុំ ! ព្រះជាម្ចាស់ ប្រគល់ ម៉ូអាប់ មក យើង ។': { alt: ['ទៅ ផ្ទះ វិញ ។'], strict: true },
  'ចង ខ្ញុំ ចុះ ។ ប៉ុន្តែ កុំ សម្លាប់ ខ្ញុំ ។': { alt: ['កុំ ចង ខ្ញុំ !'], strict: true },
  'ខ្ញុំ ទៅ ក្រុង ធីមណាត់ ។': { alt: ['ខ្ញុំ ចង់ ដេក ។'] },
  'ខ្ញុំ ហត់ ណាស់ ។ យប់ ហើយ ។': { alt: ['ខ្ញុំ ចង់ ហែល ទឹក ។'] },
  'ព្រះជាម្ចាស់ នៅ ទីនេះ ! ខ្ញុំ មិន ដឹង ទេ ។': { alt: ['វា គ្រាន់ តែ ជា សុបិន ។'], strict: true },
  'អរគុណ ប៉ា ! អាវ ស្អាត ណាស់ !': { alt: ['ខ្ញុំ មិន ចូលចិត្ត ពណ៌ ទេ ។'] },
  'ប៉ា ! ជួយ ខ្ញុំ ផង !': { alt: ['ខ្ញុំ ចង់ ទៅ អេស៊ីប !'] },
  'ប្រាំពីរ ឆ្នាំ មាន ស្បៀង ច្រើន ។ ប្រាំពីរ ឆ្នាំ ទៀត គ្មាន ស្បៀង ។': { alt: ['គោ ចូលចិត្ត ស្មៅ ។'], strict: true },
  'ខ្ញុំ នឹង ទៅ ។': { alt: ['ខ្ញុំ មិន ចេះ និយាយ ទេ ...'] },
  'កុំ ខ្លាច ! ព្រះជាម្ចាស់ នឹង ជួយ យើង ។': { alt: ['រត់ ! រត់ !'], strict: true },
  'ព្រះជាម្ចាស់ ជា កម្លាំង របស់ ខ្ញុំ ។': { alt: ['ទឹក ត្រជាក់ ណាស់ ។'] },
  'ខ្ញុំ មិន យល់ ទេ !': { alt: ['បាទ ! ល្អ ណាស់ !'], strict: true },
  'ខ្ញុំ មិន យល់ អ្វី ទាំងអស់ !': { alt: ['ខ្ញុំ យល់ ហើយ !'], strict: true },
  'ខ្ញុំ មិន ដឹង ទេ ។ ព្រះជាម្ចាស់ នឹង បង្ហាញ ។': { alt: ['យើង ទៅ ផ្សារ ។'], strict: true },
  'ផ្កាយ ច្រើន ណាស់ ! ខ្ញុំ រាប់ មិន អស់ ទេ !': { alt: ['ផ្កាយ មាន ដប់ ។'], strict: true },
  'ខ្ញុំ នៅ ទីនេះ ។': { alt: ['ខ្ញុំ មិន ទៅ ទេ !'], strict: true },
  'ព្រះជាម្ចាស់ នឹង ផ្គត់ផ្គង់ កូនចៀម ។': { alt: ['ខ្ញុំ មិន ដឹង ទេ ។'], strict: true },
  'ទឹក ស្រក ហើយ !': { alt: ['ព្រាប ឃ្លាន ។'] },
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
    $('#kb').classList.add('hide'); $('#book').classList.add('hide');
    ui = 'dlg'; joyEnd(); speaking = 'me'; dlgRes = trigRes = null; hearing++;
    $('#who').textContent = CAST.me.km; showAva('me'); aimTalk('me'); $('#dlg').classList.remove('hide'); $('#more').classList.add('hide'); $('#hear').classList.add('hide');
    $('#line').innerHTML = opts.map((t, i) => `<div class="ch"><button class="chh" data-i="${i}" aria-label="ស្ដាប់"><svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 010 7"/></svg></button><button class="cht" data-i="${i}">${t.split(' ').filter(Boolean).map(w => isPunct(w) ? `<span class="p">${esc(w)}</span>` : `<span class="tk">${kw(w)}</span>`).join(' ')}</button></div>`).join('');
    $('#line').querySelectorAll('.chh').forEach(b => b.onclick = e => { e.stopPropagation(); speaking = 'me'; sayPhrase(opts[+b.dataset.i]); });
    $('#line').querySelectorAll('.cht').forEach(b => b.onclick = e => { e.stopPropagation(); $('#dlg').classList.add('hide'); ui = null; talkCam = null; res(opts[+b.dataset.i]); });
  });
}
async function talk(lines) { for (const l of lines) await say(...l); }
function dlgTap() { if (dlgRes) dlgRes(); }
$('#dlg').onclick = dlgTap;
// a tap anywhere outside the text box moves the dialogue on too (lines that need a word tapped or a choice still wait)
addEventListener('pointerup', e => { if (ui === 'dlg' && !e.target.closest('#dlg, #bookbtn, #pop, #book, #kb')) dlgTap(); });
$('#hear').onclick = e => { e.stopPropagation(); if (curLine) hearLine(curLine.text, curLine.o.lang); };
async function hearLine(text, lang) {
  const my = ++hearing;
  if (lang) { await wait(.2); if (my === hearing) playWord(text, lang); return; }
  const els = [...$('#line').querySelectorAll('.w')], tk = tokens(text);
  await wait(.15);
  // whole phrases through the device's Khmer voice when it has one; otherwise word by word through tnefar
  if (useTTS()) { const line = tk.map(t => t.km).filter(w => !isPunct(w) || w === '។').join(' ').replace(/ ។/g, '។'); els.forEach(e => e.classList.add('play')); try { await sayTTS(line); } catch (e) { } els.forEach(e => e.classList.remove('play')); return; }
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
async function sayPhrase(text) { if (useTTS()) { try { if (await sayTTS(text)) return; } catch (e) { } } for (const w of text.split(' ')) if (w && !isPunct(w)) { await playWord(w); await wait(.05); } }
function cap(w) { toast(w); speaking = 'god'; playWord(w); }
function toast(big, small = '') { const t = $('#toast'); t.innerHTML = (big ? `<b>${esc(big)}</b>` : '') + (small ? `<i>${esc(small)}</i>` : ''); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

/* ---------------- thumbnails (the word's own low-poly model) ---------------- */
let tR, tS, tC; const thumbs = {};
function thumbR() {
    if (!tR) { const c = document.createElement('canvas'); tR = new THREE.WebGLRenderer({ canvas: c, antialias: false, preserveDrawingBuffer: true, alpha: true }); tR.setSize(56, 56, false); tS = new THREE.Scene(); tS.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.5)); const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(2, 4, 5); tS.add(d); tC = new THREE.PerspectiveCamera(32, 1, .1, 300); }
}
function thumb(w) {
  if (w in thumbs) return thumbs[w]; const f = PIC[w]; if (!f) return thumbs[w] = null;
  try {
    thumbR(); const o = f(); tS.add(o); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), s = Math.max(.5, b.getSize(new THREE.Vector3()).length());
    tC.position.set(c.x + s * .75, c.y + s * .45, c.z + s * 1.45); tC.lookAt(c); tR.render(tS, tC);
    const url = tR.domElement.toDataURL(); tS.remove(o); return thumbs[w] = url;
  } catch (e) { return thumbs[w] = null; }
}

/* ---------------- speaker portraits: a close-up of whoever is talking ---------------- */
const LOOK = { god: { key: 'god', make: () => godFlame(.6) }, angel: { key: 'angel', make: () => person({ glow: 0xffffff }) }, snake: { key: 'snake', make: () => snake() } };
const avas = {};
function portrait(who) {
  const L = who === 'me' ? (heroId ? { key: 'hero:' + heroId + JSON.stringify(HEROES[heroId]), make: () => person(HEROES[heroId]) } : null) : LOOK[who];
  if (!L) return null; if (L.key in avas) return avas[L.key];
  try {
    thumbR(); const m = L.make(), o = m.g || m; tS.add(o); o.updateMatrixWorld(true);
    let c, d;
    if (m.head) { c = m.head.getWorldPosition(new THREE.Vector3()); d = 1.05 * m.head.getWorldScale(new THREE.Vector3()).y; c.y -= .05 * d; }
    else { const b = new THREE.Box3().setFromObject(o); c = b.getCenter(new THREE.Vector3()); d = Math.max(.6, b.getSize(new THREE.Vector3()).length()); }
    tC.position.set(c.x + d * .3, c.y + d * .12, c.z + d); tC.lookAt(c); tR.render(tS, tC);
    const url = tR.domElement.toDataURL(); tS.remove(o); return avas[L.key] = url;
  } catch (e) { return avas[L.key] = null; }
}
function showAva(who) { const u = portrait(who), a = $('#ava'); if (u) { a.src = u; a.classList.remove('hide'); } else a.classList.add('hide'); $('#dlg').classList.toggle('hasava', !!u); }

/* ---------------- keyboard: speaking a word ---------------- */
const CONS = 'ក ខ គ ឃ ង ច ឆ ជ ឈ ញ ដ ឋ ឌ ឍ ណ ត ថ ទ ធ ន ប ផ ព ភ ម យ រ ល វ ស ហ ឡ អ'.split(' ');
const VOWS = 'ា ិ ី ឹ ឺ ុ ូ ួ ើ ឿ ៀ េ ែ ៃ ោ ៅ ំ ះ ់ ៉ ៊ ័ ៌ ឥ ឪ ឲ ឫ'.split(' ');
const isDep = c => c >= 'ា' && c <= '៓';
let kbPage = 0, typed = '', guideW = null;
const speakers = [];
function speakAt(words, at = null, r = 6, hint = true, guide = null) { return new Promise(res => speakers.push({ words, at, r, hint, guide, res })); }
function openKB() {
  if (ui) return; ensureAudio(); ui = 'kb'; typed = ''; joyEnd(); $('#kb').classList.remove('hide');
  const w = speakers.find(s => s.hint && (!s.at || within(s.at, s.r)));
  guideW = w ? (w.guide ? w.guide() : w.words[0]) : null; renderKnown(); renderKB();
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
$('#kbclose').onclick = () => closeAll();
const speakAct = { label: 'និយាយ', fn: () => openKB() };
function speakTyped() {
  const w = norm(typed); if (!w) return;
  const word = Object.keys(S.seen).concat(speakers.flatMap(s => s.words)).find(k => norm(k) === w) || typed.normalize('NFC');
  closeAll(); speaking = 'me'; playWord(word); floatWord(word);
  const s = speakers.find(s => s.words.some(k => norm(k) === w) && (!s.at || within(s.at, s.r)));
  if (s) { speakers.splice(speakers.indexOf(s), 1); const hit = s.words.find(k => norm(k) === w); if (!S.said.includes(hit)) S.said.push(hit); save(); s.res(hit); }
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
    body.innerHTML = CHAPTERS.map((c, i) => `<button class="chap" data-i="${i}"><span class="n">${khNum(i + 1)}</span><span><strong>${esc(c.title)}</strong><small>${esc(c.ref)} · ${esc(c.who)}</small></span></button>`).join('');
    body.querySelectorAll('.chap').forEach(c => c.onclick = () => { S.ch = +c.dataset.i; save(); if (!started) { closeAll(); begin(); } else { try { sessionStorage.setItem('leap-autostart', '1'); } catch (e) { } location.reload(); } });
  }
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { bookTab = t.dataset.t; renderBook(); });
$('#bookbtn').onclick = openBook; $('#bookclose').onclick = closeAll;
// system voice option (book footer and title screen)
var ttsLabel = function () { const t = (S.tts ? 'សំឡេង ប្រព័ន្ធ ៖ បើក' : 'សំឡេង ប្រព័ន្ធ ៖ បិទ') + (ttsWorks === false ? ' (គ្មាន សំឡេង ខ្មែរ)' : ''); document.querySelectorAll('.ttsbtn').forEach(b => { b.textContent = t; b.classList.toggle('pri', !!S.tts); }); }
document.querySelectorAll('.ttsbtn').forEach(b => b.onclick = () => { S.tts = !S.tts; if (S.tts) ttsWorks = null; save(); ttsLabel(); ensureAudio(); speaking = 'me'; playWord('សួស្ដី'); });
ttsLabel(); try { speechSynthesis.addEventListener('voiceschanged', () => setTimeout(ttsLabel, 50)); } catch (e) { }
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
// God appears as a living flame that floats, burns on nothing and throws sparks upward
function godFlame(s = 1) {
  const g = new THREE.Group(), add = THREE.AdditiveBlending;
  [[.9, 2.6, 0xff4a10, .75], [.65, 2.1, 0xff9a20, .85], [.4, 1.5, 0xffe070, .9], [.2, .9, 0xfffff0, 1]].forEach(([r, h, c, o], i) => {
    const m = mesh(new THREE.ConeGeometry(r * s, h * s, 5), MB(c, { transparent: true, opacity: o, blending: i < 3 ? THREE.NormalBlending : add, depthWrite: false, fog: false }), 0, h * s / 2 - .4 * s, 0, g); m.userData.f = i; m.renderOrder = 2 + i;
  });
  for (let i = 0; i < 3; i++) { const t = mesh(new THREE.ConeGeometry(.25 * s, 1.1 * s, 4), MB(0xff7a18, { transparent: true, opacity: .8, depthWrite: false, fog: false }), Math.cos(i * 2.1) * .45 * s, .9 * s, Math.sin(i * 2.1) * .45 * s, g); t.userData.f = 4 + i; }
  return g;
}
function godGlow(on, at) { if (!godLight) { godLight = godFlame(1.6); scene.add(godLight); } godLight.visible = on; if (at) godLight.position.set(...at); }

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
    player.y += ((yOverride ?? groundAt(player.x, player.z)) - player.y) * Math.min(1, dt * 14);
    hero.g.position.set(player.x, player.y, player.z); hero.g.rotation.y = player.yaw;
    animLimbs(hero, l > .08 ? l : 0, dt);
  }
  // camera
  if (track) { const [p, l] = track(); camera.position.lerp(V3.set(...p), Math.min(1, dt * 3)); cineLook.lerp(new THREE.Vector3(...l), Math.min(1, dt * 3)); camera.lookAt(cineLook); }
  else if (talkCam && hero && !cine) {
    const s2 = talkCam.s, sy = s2.god ? s2.y : s2.y, dx = s2.x - player.x, dz = s2.z - player.z, L = Math.max(.5, Math.hypot(dx, dz)), ux = dx / L, uz = dz / L, sx = -uz * talkCam.side, sz = ux * talkCam.side;
    let pos, look;
    if (s2.god) { pos = [player.x - ux * 4 + sx * 1.5, player.y + 1.8, player.z - uz * 4 + sz * 1.5]; look = [s2.x, s2.y, s2.z]; }
    else if (!talkCam.rev) { pos = [player.x - ux * 3 + sx * 1.4, player.y + 2.3, player.z - uz * 3 + sz * 1.4]; look = [s2.x, sy + 1.5, s2.z]; }
    else { pos = [s2.x + ux * 3 + sx * 1.4, sy + 2.3, s2.z + uz * 3 + sz * 1.4]; look = [player.x, player.y + 1.5, player.z]; }
    pos[1] = Math.max(pos[1], groundAt(pos[0], pos[2]) + .6);
    camera.position.lerp(V3.set(...pos), Math.min(1, dt * 4)); cineLook.lerp(new THREE.Vector3(...look), Math.min(1, dt * 4)); camera.lookAt(cineLook);
  }
  else if (cine) { cine.t = Math.min(cine.dur, cine.t + dt); const k = ease(cine.t / cine.dur); camera.position.lerpVectors(cine.from, cine.to, k); cineLook.lerpVectors(cine.lookFrom, cine.look, k); camera.lookAt(cineLook); }
  else if (hero) {
    // the camera eases round behind you only while you walk, and gently
    const moving = Math.hypot(input.jx, input.jy) > .08 || Object.values(input.keys).some(Boolean);
    if (moving && lookId == null) camYaw = turn(camYaw, player.yaw + Math.PI, dt * .12);
    const tx = player.x, ty = player.y + 1.5, tz = player.z;
    V3.set(tx + Math.sin(camYaw) * Math.cos(camPitch) * camDist, ty + Math.sin(camPitch) * camDist, tz + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
    V3.y = Math.max(V3.y, groundAt(V3.x, V3.z) + .6);
    camera.position.lerp(V3, Math.min(1, dt * 8)); cineLook.set(tx, ty, tz); camera.lookAt(cineLook);
    if (shake > 0) { shake -= dt; camera.position.x += rnd(-.15, .15); camera.position.y += rnd(-.15, .15); }
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
  if (godLight && godLight.visible) { godLight.children.forEach(m => { const f = m.userData.f || 0; m.scale.set(1 + Math.sin(t * 9 + f) * .08, 1 + Math.sin(t * 13 + f * 1.7) * .18, 1 + Math.cos(t * 8 + f) * .08); m.rotation.y = t * (f % 2 ? 1.3 : -1.1); }); godLight.position.y += Math.sin(t * 1.5) * .004; if (Math.random() < .6) emit(godLight.position.x + rnd(-.8, .8), godLight.position.y + rnd(0, 2.5), godLight.position.z + rnd(-.8, .8), rnd(-.4, .4), rnd(2, 4), rnd(-.4, .4), Math.random() < .5 ? 0xffb030 : 0xffe070, .9, 0); }
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
    if (!best && !ui && speakers.some(sp => !sp.at || within(sp.at, sp.r))) best = speakAct;
    if (best !== curAct) { curAct = best; $('#lA').textContent = best ? best.label : ' '; $('#nA').classList.toggle('off', !best); $('#nA').classList.toggle('on', !!best); }
    for (let i = reachers.length - 1; i >= 0; i--) if (!ui && within(reachers[i].at, reachers[i].r)) { const r = reachers.splice(i, 1)[0]; r.res(); }
  }
  if (hero && started) seeThrough(dt);
  renderer.render(scene, camera);
}
// anything big between the camera and you turns see-through (its own material copy, restored when clear)
const ray = new THREE.Raycaster(), faded = new Map(); let occl = [], occlT = 0;
const isHero = o => { for (let p = o; p; p = p.parent) if (hero && p === hero.g) return true; return false; };
function seeThrough(dt) {
  occlT -= dt; if (occlT <= 0) { occlT = 1.5; occl = []; const v = new THREE.Vector3(); world.traverse(o => { if (!o.isMesh || o === ground || o === water || Array.isArray(o.material) || isHero(o)) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); if (o.geometry.boundingSphere.radius * o.getWorldScale(v).x > 1.1) occl.push(o); }); }
  const head = V3.set(player.x, player.y + 1.4, player.z), dir = head.clone().sub(camera.position), dist = dir.length();
  ray.set(camera.position, dir.normalize()); ray.far = Math.max(0, dist - .6);
  const hit = new Set(ray.intersectObjects(occl, false).map(h => h.object));
  for (const o of hit) if (!faded.has(o)) { faded.set(o, o.material); o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .28; o.material.depthWrite = false; }
  for (const [o, m0] of faded) if (!hit.has(o)) { o.material.dispose(); o.material = m0; faded.delete(o); }
}
function turn(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k * 6); }
// kneel (and bow from the hips) without sinking: shins fold back, the body drops by a shin's length
function kneel(m, k, o) { (o || m).kneel = k; m.b.position.y = -.36 * k * (m.b.scale.y || 1); m.b.rotation.x = .45 * k; }
function animLimbs(m, sp, dt, e) { const o = e || m; o.walkT = (o.walkT || 0) + dt * 10 * (sp ? 1 : 0);
  // a little up-and-down with every step
  if (m.b) { if (sp) { m.b.position.y = Math.abs(Math.sin(o.walkT)) * (m.legs.length > 2 ? .07 : .1) * Math.min(1, sp + .3); o.bobbing = true; } else if (o.bobbing) { m.b.position.y = 0; o.bobbing = false; } } const a = sp ? Math.sin(o.walkT) * .7 * Math.min(1, sp + .3) : 0; m.legs.forEach((l, i) => l.rotation.x += ((i % 2 ? a : -a) * (m.legs.length > 2 && i > 1 ? -1 : 1) - l.rotation.x) * Math.min(1, dt * 12));
  if (m.knees) m.knees.forEach((k, i) => { const want = sp ? Math.max(0, Math.sin(o.walkT + (i % 2 ? Math.PI : 0) - 1.3)) * 1.2 : (o.kneel || 0) * 1.55; k.rotation.x += (want - k.rotation.x) * Math.min(1, dt * 14); }); if (m.arms) m.arms.forEach((r, i) => { if (m === hero && (player.carry || player.raise)) r.rotation.x += (-2.6 - r.rotation.x) * Math.min(1, dt * 10); else r.rotation.x += ((i ? -a : a) - r.rotation.x) * Math.min(1, dt * 12); }); }
function tryMove(dx, dz) {
  const r = .45; let nx = player.x + dx, nz = player.z + dz;
  // a move is blocked only if it ends inside something AND goes deeper in: you can always walk out of an overlap
  const px = player.x, pz = player.z, deeper = (x, z, cx, cz, rr) => { const d = Math.hypot(x - cx, z - cz); return d < rr && d < Math.hypot(px - cx, pz - cz) - 1e-4; };
  const hit = (x, z) => solids.some(s => deeper(x, z, s.x, s.z, s.r + r)) || ents.some(e => e.solid && !e.hide && e.g.visible && deeper(x, z, e.x, e.z, e.solid + r)) || (waterY > -50 && groundAt(x, z) < waterY - .6 && groundAt(x, z) < groundAt(px, pz) && !floors.some(f => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1)) || (Math.hypot(x, z) > bound && Math.hypot(x, z) > Math.hypot(px, pz));
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
  { title: 'ប៉ម បាបិល', ref: 'លោកុប្បត្តិ ១១', who: 'អ្នកសង់', run: babel },
  { title: 'ផ្កាយ និង ខ្សាច់', ref: 'លោកុប្បត្តិ ១២–២២', who: 'អាប់រ៉ាម', run: abram },
  { title: 'ជណ្ដើរ យ៉ាកុប', ref: 'លោកុប្បត្តិ ២៨', who: 'យ៉ាកុប', run: jacob },
  { title: 'អាវ ពណ៌ ច្រើន', ref: 'លោកុប្បត្តិ ៣៧–៤១', who: 'យ៉ូសែប', run: joseph },
  { title: 'ទារក ក្នុង កន្ត្រក', ref: 'និក្ខមនំ ២', who: 'ម៉ារាម', run: babyMoses },
  { title: 'គុម្ពោត ឆេះ', ref: 'និក្ខមនំ ៣', who: 'ម៉ូសេ', run: moses },
  { title: 'គ្រោះកាច និង បុណ្យ រំលង', ref: 'និក្ខមនំ ៧–១២', who: 'ម៉ូសេ', run: plagues },
  { title: 'សមុទ្រ ក្រហម', ref: 'និក្ខមនំ ១៤', who: 'ម៉ូសេ', run: redSea },
  { title: 'ម៉ាណា និង ទឹក ពី ថ្ម', ref: 'និក្ខមនំ ១៦–១៧', who: 'ម៉ូសេ', run: wilderness },
  { title: 'ភ្នំ ស៊ីណាយ', ref: 'និក្ខមនំ ១៩–២០ · ៣២', who: 'ម៉ូសេ', run: sinai },
  { title: 'អេហ៊ូឌ និង អេក្លូន', ref: 'ពួកចៅហ្វាយ ៣', who: 'អេហ៊ូឌ', run: ehud },
  { title: 'សាំសុន និង តោ', ref: 'ពួកចៅហ្វាយ ១៤', who: 'សាំសុន', run: samsonLion },
  { title: 'កញ្ជ្រាង បីរយ', ref: 'ពួកចៅហ្វាយ ១៥', who: 'សាំសុន', run: samsonFox },
  { title: 'ឆ្អឹង ថ្គាម លា', ref: 'ពួកចៅហ្វាយ ១៥–១៦', who: 'សាំសុន', run: samsonFight },
  { title: 'រស់ និង បូអូស', ref: 'នាង រស់ ១–៤', who: 'រស់', run: ruth },
  { title: 'ដាវីឌ និង កូលីយ៉ាត', ref: '១ សាំយូអែល ១៧', who: 'ដាវីឌ', run: david },
  { title: 'ភ្លើង ពី មេឃ', ref: '១ ពង្សាវតារក្សត្រ ១៨', who: 'អេលីយ៉ា', run: elijah },
  { title: 'យ៉ូណាស និង ត្រី ធំ', ref: 'យ៉ូណាស ១–៣', who: 'យ៉ូណាស', run: jonah },
  { title: 'ឡ ភ្លើង', ref: 'ដានីយ៉ែល ៣', who: 'សាដ្រាក់', run: furnace },
  { title: 'រូង តោ', ref: 'ដានីយ៉ែល ៦', who: 'ដានីយ៉ែល', run: daniel },
  { title: 'ព្រះយេស៊ូ ប្រសូត', ref: 'លូកា ២', who: 'គង្វាល', run: nativity },
  { title: 'ចុះ តាម ដំបូល', ref: 'ម៉ាកុស ២', who: 'មិត្ត ម្នាក់', run: roof },
  { title: 'អ្នក សាប ព្រោះ', ref: 'ម៉ាកុស ៤', who: 'អ្នក សាប ព្រោះ', run: sower },
  { title: 'ខ្យល់ ព្យុះ ស្ងប់', ref: 'ម៉ាកុស ៤', who: 'ពេត្រុស', run: calmStorm },
  { title: 'កងទ័ព និង ជ្រូក', ref: 'ម៉ាកុស ៥', who: 'អនទ្រេ', run: legion },
  { title: 'ចាត់ សិស្ស ទៅ', ref: 'ម៉ាកុស ៦ · លូកា ៩–១០', who: 'អនទ្រេ', run: sendTwelve },
  { title: 'នំបុ័ង ប្រាំ ត្រី ពីរ', ref: 'យ៉ូហាន ៦', who: 'ក្មេងប្រុស', run: feeding },
  { title: 'ដើរ លើ ទឹក', ref: 'ម៉ាថាយ ១៤', who: 'ពេត្រុស', run: walkWater },
  { title: 'សាសន៍ សាម៉ារី ចិត្ត ល្អ', ref: 'លូកា ១០', who: 'សាសន៍ សាម៉ារី', run: samaritan },
  { title: 'ចៀម ដែល វង្វេង', ref: 'លូកា ១៥', who: 'គង្វាល', run: lostSheep },
  { title: 'កូន ដែល វង្វេង', ref: 'លូកា ១៥', who: 'កូនប្រុស ពៅ', run: prodigal },
  { title: 'សាខេ', ref: 'លូកា ១៩', who: 'សាខេ', run: zacchaeus },
  { title: 'ឈើឆ្កាង', ref: 'លូកា ២៣ · ម៉ាកុស ១៥', who: 'ស៊ីម៉ូន ពី គីរេន', run: calvary },
  { title: 'ផ្នូរ ទទេ', ref: 'យ៉ូហាន ២០', who: 'ម៉ារី ម៉ាក់ដាឡា', run: tomb },
  { title: 'បុណ្យ ថ្ងៃ ទី ហាសិប', ref: 'កិច្ចការ ២', who: 'ពេត្រុស', run: pentecost },
  { title: 'ក្រោក ឡើង ហើយ ដើរ', ref: 'កិច្ចការ ៣', who: 'ពេត្រុស', run: lame },
  { title: 'ភីលីព និង មន្ត្រី', ref: 'កិច្ចការ ៨', who: 'ភីលីព', run: desertRoad },
  { title: 'ផ្លូវ ទៅ ដាម៉ាស', ref: 'កិច្ចការ ៩', who: 'សូល', run: damascus },
  { title: 'ពេត្រុស ចេញ ពី គុក', ref: 'កិច្ចការ ១២', who: 'ពេត្រុស', run: prison },
  { title: 'រញ្ជួយ ដី នៅ គុក', ref: 'កិច្ចការ ១៦', who: 'ប៉ុល', run: philippi },
  { title: 'សំពៅ លិច និង ពស់', ref: 'កិច្ចការ ២៧–២៨', who: 'ប៉ុល', run: malta },
  { title: 'ទ្វារ បើក នៅ ស្ថានសួគ៌', ref: 'វិវរណៈ ១ · ៤–៥', who: 'យ៉ូហាន', run: patmos },
  { title: 'អ្វីៗ ទាំងអស់ ជា ថ្មី', ref: 'វិវរណៈ ២១–២២', who: 'យ៉ូហាន', run: newJerusalem },
];
async function leapIn(heroKey, x, z, yaw, intro) {
  setHero(heroKey, x, z, yaw); showAl(false);
  camera.position.set(x + Math.sin(yaw) * 8, groundAt(x, z) + 4, z + Math.cos(yaw) * 8);
}
async function arrive(lines) {
  // the mirror moment: see who you have leapt into
  await mirror(); await wait(.4); burst(player.x, player.y + 1.2, player.z, 0x80c0ff, 60, 3); tone([880, 660], .5, 'triangle', .06);
  await wait(1); // the leap transition says it all; no line needed
  await talk(lines);
  camFree(); camYaw = player.yaw + Math.PI;
}
function done(n) { S.max = Math.max(S.max, n); S.ch = n; save(); }
async function nextCh() { return next(S.ch + 1); }
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
const edenH = (x, z) => { const r = Math.hypot(x > 0 ? x * .5 : x, z); /* the land runs on east of the garden */ const hills = 1.6 + Math.sin(x * .07) * 1.4 + Math.cos(z * .06) * 1.2 + Math.sin((x + z) * .13) * .5; const river = Math.max(0, 1 - Math.abs(z - 22 - Math.sin(x * .08) * 4) / 4) * 3; return hills - river - Math.max(0, r - 70) * .35; };
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
  await nextCh();
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
    // listening for the name from the moment the animal appears: say it early and it still counts
    let gotName = false; const heard = speakAt([word]).then(() => { gotName = true; });
    await Promise.race([walk(e, player.x + 2.5, player.z + 2.5), heard]);
    e.follow = 'player'; e.gap = 2.6; e.yaw = Math.atan2(player.x - e.x, player.z - e.z);
    if (!gotName) { await say('me', `${word} ?`); goal(`និយាយ « ${word} » ។`, e); await heard; } burst(e.x, e.y + 1.5, e.z, 0xf2c51c, 40, 2.5); good();
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
  await nextCh();
}

/* ---- 2. Eve and the forbidden fruit ---- */
eve.build = () => { setSky(0x3a7ae0, 0xf0d8b0, 0xe8d8b8, 1, true); scene.fog.near = 40; scene.fog.far = 160; buildEden(); const g = gate(); place(g, 48, 0, Math.PI / 2); for (const z of [-12, -8, -4, 4, 8, 12]) solids.push({ x: 48, z, r: 2 }); bound = 95; };
async function eve() {
  await leapIn('eve', -6, 8, Math.PI);
  const adamE = npc('adam', HEROES.adam, -3, 10, Math.PI);
  await arrive([['al', 'អ្នក ជា អេវ៉ា ។'], ['al', 'ថ្ងៃ នេះ ... រឿង ពិបាក ។'], ['al', 'អ្នក ត្រូវ ធ្វើ ឲ្យ រឿង ទៅ មុខ ។ មិន មែន ធ្វើ ល្អ ទេ ។']]);
  const sn = snake(); const snE = ent(sn, 1.5, -21.5, { solid: 0, speed: 2, id: 'snake' }); tag('ពស់', sn.g); snE.talk = 'snake';
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
  // their eyes are opened: fig leaves (Genesis 3:7)
  world.remove(hero.g); hero = person({ ...HEROES.eve, leaves: true, top: 0x3f8a2a }); world.add(hero.g);
  world.remove(adamE.g); adamE.m = person({ ...HEROES.adam, leaves: true }); adamE.g = adamE.m.g; world.add(adamE.g);
  burst(player.x, player.y + 1, player.z, 0x3f8a2a, 30, 2); cap('ស្លឹកឈើ');
  await talk([['adam', '...'], ['me', 'អូយ ... យើង ខ្លាច ។'], ['adam', 'យើង ត្រូវ លាក់ ខ្លួន !']]);
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
  const cher = ent(person({ glow: 0xffffff, scale: 1.4 }), 52, 0, { solid: 0, fly: .3 }); tag('ទេវតា', cher.g);
  const sw = new THREE.Group(); box(.15, 2.4, .05, MB(0xff8020), 0, 1.2, 0, sw); cher.g.add(sw); sw.position.set(.7, 1.2, .4); anims.push((dt, t) => { sw.rotation.z = Math.sin(t * 6) * .4; if (Math.random() < .3) emit(cher.x + .7, cher.y + 2.4, cher.z + .4, rnd(-1, 1), 2, rnd(-1, 1), 0xff8020, .5); });
  goal('ចេញ ទៅ ទិស ខាងកើត ។', [58, 0]);
  await reach([58, 0], 5);
  await talk([['angel', 'ទេវតា ការពារ ផ្លូវ ទៅ ដើមឈើ ជីវិត ។'], ['al', 'រឿង នេះ ក្រៀមក្រំ ... ប៉ុន្តែ រឿង មិន ទាន់ ចប់ ទេ ។'], ['al', 'ថ្ងៃ មួយ ព្រះជាម្ចាស់ នឹង ជួយ មនុស្ស ។ ដល់ ពេល លោត ។']]);
  await nextCh();
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
  await talk([['wife', 'ទូក ធំ ណាស់ !'], ['god', 'ណូអេ ! យក សត្វ មក ។'], ['god', 'សត្វ ស្អាត ប្រាំពីរ គូ ។ សត្វ ផ្សេង ទៀត មួយ គូ ។']]);
  godGlow(true, [0, 22, -10]); setTimeout(() => godGlow(false), 4000);
  // call each kind by its name; clean animals come seven pairs, the others one pair
  const KINDS = [['sheep', 'ចៀម', 34, 4, 7], ['cow', 'គោ', -34, 0, 7], ['elephant', 'ដំរី', -20, -40, 1], ['lion', 'តោ', 22, -42, 1], ['monkey', 'ស្វា', -4, 40, 1]];
  const herds = KINDS.map(([k, name, x, z, pairsN]) => { const all = []; for (let i = 0; i < pairsN * 2; i++) { const a = animal(k); const e = ent(a, x + rnd(-4, 4), z + rnd(-4, 4), { speed: 4 }); wander(e, 5); all.push(e); } tag(name, all[0].g); return { k, name, x, z, pairsN, all }; });
  for (let n = 0; n < herds.length; n++) {
    const left = herds.filter(h => !h.in);
    const nearest = () => left.slice().sort((a, b) => Math.hypot(a.all[0].x - player.x, a.all[0].z - player.z) - Math.hypot(b.all[0].x - player.x, b.all[0].z - player.z))[0];
    goal(`ហៅ សត្វ តាម ឈ្មោះ ។ ( ${khNum(n)} / ${khNum(herds.length)} )`, nearest().all[0]);
    let h = null;
    while (!h) {
      const w = await speakAt(left.map(q => q.name), null, 0, true, () => nearest().name);
      h = left.find(q => q.name === w);
      if (h && Math.hypot(h.all[0].x - player.x, h.all[0].z - player.z) > 14) { toast(h.name, '... ឆ្ងាយ ពេក ។'); h = null; }
      goal(`ហៅ សត្វ តាម ឈ្មោះ ។ ( ${khNum(n)} / ${khNum(herds.length)} )`, nearest().all[0]);
    }
    h.in = true; good(); toast(`${h.name} ${NUMW[h.pairsN]} គូ`); speaking = 'god'; sayPhrase(`${NUMW[h.pairsN]} គូ`);
    for (const e of h.all) { e.stop = true; e.goal = null; }
    (async () => { for (const [i, e] of h.all.entries()) { await wait(i * .35); walk(e, (i % 2) * 1.4 - .7, 0, 6).then(() => walk(e, 0, -6.5, 3)).then(() => { e.g.visible = false; e.hide = true; }); } })();
  }
  await wait(3);
  await talk([['god', 'ណូអេ ! ចូល ទូក ជាមួយ គ្រួសារ អ្នក ។']]);
  goal('ចូល ទូក ។', [0, -1]);
  await act('ចូល ទូក', [0, -1], 4);
  for (const e of [wife, ...sons]) { e.g.visible = false; e.hide = true; }
  // up on the deck; locked wide shot; the door closes, the rain comes
  const deckY = () => arkO.g.position.y + 6.8;
  floors.push({ x0: -7, x1: 7, z0: -12.5, z1: -7.5, y: deckY });
  solids.length = 0; player.x = 0; player.z = -10; clampFn = (x, z) => [clamp(x, -6.5, 6.5), clamp(z, -12.2, -7.8)];
  track = () => [[26, arkO.g.position.y + 11, 20], [0, arkO.g.position.y + 4, -10]];
  setSky(0x30343e, 0x50586a, 0x485060, .4); raining = 6; tone([90], 3, 'sawtooth', .05, .5);
  const base = arkO.g.position.y; addWater(-3, 0x2a4a80);
  cap('ភ្លៀង');
  const dayGoal = d => goal(`ថ្ងៃ ទី ${khNum(d)}`);
  let dayN = 0;
  await tween(10, k => { waterY = -3 + k * 31; arkO.g.position.y = Math.max(base, waterY - .6) + Math.sin(performance.now() / 700) * .15; const d = Math.ceil(k * 40); if (d !== dayN) { dayN = d; dayGoal(d); } });
  // 40 days of rain; then the water stays, 150 days
  raining = 0; setSky(0x5a7ab0, 0xc0c8d0, 0xb8c0c8, .8); toast('សែសិប ថ្ងៃ'); speaking = 'god'; await sayPhrase('ភ្លៀង សែសិប ថ្ងៃ សែសិប យប់ ។');
  H = araratH; world.remove(ground); terrain(200, 50, (x, z, y) => y > 14 ? 0x8a8070 : noahCol(x, z, y)); world.children.forEach(c => { if (c.type === 'Group' && c !== arkO.g && c.position.y < 20 && !ents.some(e => e.g === c)) c.visible = false; });
  await tween(5, k => { const d = Math.round(40 + k * 110); if (d !== dayN) { dayN = d; dayGoal(d); } arkO.g.position.y = waterY - .6 + Math.sin(performance.now() / 900) * .15; });
  toast('មួយ រយ ហាសិប ថ្ងៃ'); await sayPhrase('ទឹក គ្រប ដី មួយ រយ ហាសិប ថ្ងៃ ។');
  // the water goes down, the ark rests on the mountain
  await tween(4, k => { waterY = 28 - k * 4; arkO.g.position.y = Math.max(araratH(0, -10) - .2, waterY - .6); });
  cap('ភ្នំ');
  // raven, then the dove three times
  const sendBird = async (color, word, out, back) => {
    const m = bird(color); const e = ent(m, 2, -9, { solid: 0, flyAbs: deckY() + .3 }); tag(word, m.g);
    goal(`លែង ${word} ។ និយាយ « ទៅ » ។`, e);
    await speakAt(['ទៅ']); cap(word);
    await tween(2.5, k => { e.x = 2 + k * 80; e.flyAbs = deckY() + .3 + k * 20; });
    if (out) await out();
    if (!back) { e.g.visible = false; return e; }
    e.yaw = -Math.PI / 2; const extra = back === 'leaf' ? (() => { const l = mesh(new THREE.OctahedronGeometry(.25, 0), 0x6aaa3a, 0, .1, .5, m.g); l.scale.set(.5, .1, 1); tag('ស្លឹកឈើ', l); return l; })() : null;
    await tween(2.5, k => { e.x = 80 - k * 78; e.flyAbs = deckY() + 20 - k * 19.7; });
    return e;
  };
  const rv = await sendBird(0x1a1a1a, 'ក្អែក', null, null);
  await sayPhrase('ក្អែក ហើរ ទៅ ហើរ មក ។');
  let d1 = await sendBird(0xffffff, 'ព្រាប', () => wait(1), 'empty'); d1.g.visible = false;
  toast('', 'ព្រាប ត្រឡប់ មក វិញ ។ គ្មាន អ្វី ទេ ។'); await sayPhrase('ព្រាប ត្រឡប់ មក វិញ ។'); toast('ប្រាំពីរ ថ្ងៃ'); await sayPhrase('ប្រាំពីរ ថ្ងៃ');
  await sendBird(0xffffff, 'ព្រាប', () => tween(3, k => { waterY = 24 - k * 8; }), 'leaf');
  await talk([['me', 'មើល ! ស្លឹកឈើ !'], ['me', 'ទឹក ស្រក ហើយ !']]);
  toast('ប្រាំពីរ ថ្ងៃ'); await sayPhrase('ប្រាំពីរ ថ្ងៃ');
  await sendBird(0xffffff, 'ព្រាប', () => tween(4, k => { waterY = 16 - k * 18; }), null);
  toast('', 'ព្រាប មិន ត្រឡប់ មក វិញ ទេ ។'); await sayPhrase('ព្រាប មិន ត្រឡប់ មក វិញ ទេ ។');
  world.remove(water); water = null; waterY = -100; arkO.g.position.y = araratH(0, -10) - .2;
  world.children.forEach(c => { if (c.type === 'Group') c.visible = true; });
  for (const c of [...world.children]) if (c.type === 'Group' && c !== arkO.g && !ents.some(e => e.g === c)) world.remove(c);
  for (let i = 0; i < 30; i++) { const x = rnd(-70, 70), z = rnd(-70, 70); if (Math.hypot(x, z + 10) < 22) continue; place(tree({ s: rnd(.6, 1) }).g, x, z, 0, .6); }
  await talk([['me', 'ដី ស្ងួត ហើយ !'], ['god', 'ណូអេ ! ចេញ ពី ទូក ។']]);
  goal('ចេញ ពី ទូក ។', [0, -10]);
  await act('ចេញ ពី ទូក', [0, -10], 99); track = null;
  floors.length = 0; clampFn = null; solids.length = 0; solids.push({ x: 0, z: -10, r: 5 }, { x: -8, z: -10, r: 4 }, { x: 8, z: -10, r: 4 });
  player.x = 0; player.z = -1; player.y = araratH(0, -1); player.yaw = 0;
  for (const [i, e] of [wife, ...sons].entries()) { e.g.visible = true; e.hide = false; e.x = -4 + i * 2.6; e.z = -1.5; e.tick = null; }
  for (const h of herds) for (const e of h.all) { e.g.visible = true; e.hide = false; e.x = rnd(-3, 3); e.z = -4; e.stop = false; walk(e, rnd(-40, 40), rnd(10, 50), 4).then(() => wander(e, 10)); }
  // the rainbow, out in the open to the south, away from the ark
  const rb = rainbowMesh(60); rb.position.set(0, 0, 140); world.add(rb); tag('ឥន្ទធនូ', rb); good();
  godGlow(true, [0, 45, 100]);
  await camTo([player.x, player.y + 3, player.z - 7], [0, 35, 140], 2);
  await talk([['god', 'មើល ឥន្ទធនូ ។'], ['god', 'យើង នឹង មិន ធ្វើ ទឹកជំនន់ ទៀត ទេ ។ នេះ ជា សេចក្ដី សន្យា ។']]);
  camFree(); await nextCh();
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
  await talk([['me', 'គ្មាន អ្នក ណា យល់ គ្នា ទេ !']]);
  [...workers, boss, friend].forEach((w, i) => { const a = i / 7 * Math.PI * 2; w.talk = null; walk(w, Math.cos(a) * 80, Math.sin(a) * 80, 4); });
  toast('', 'ពួកគេ ខ្ចាត់ខ្ចាយ ទៅ គ្រប់ ទិស ។'); speaking = 'god'; await sayPhrase('ពួកគេ ខ្ចាត់ខ្ចាយ ទៅ គ្រប់ ទិស ។');
  await camTo([0, 12, 30], [0, 16, -22], 2); toast('បាបិល'); await sayPhrase('ទីក្រុង នេះ ឈ្មោះ បាបិល ។'); await wait(1); camFree();
  await nextCh();
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
  const COUNT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  for (const n of COUNT) {
    await act(`រាប់ ផ្កាយ`, [player.x, player.z], 999);
    for (let j = 0; j < (n > 10 ? 10 : 1); j++) { const a = rnd(0, 6.28); burst(player.x + Math.cos(a) * 20, 40 + rnd(-5, 10), player.z + Math.sin(a) * 20, 0xfff4a0, 14, 2); }
    stars.material.size = 2 + n / 50; speaking = 'me'; playWord(NUMWORD(n)); toast(khNum(n), NUMWORD(n)); goal(`រាប់ ផ្កាយ ... ${NUMWORD(n)}`);
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
  await talk([['sarah', 'មើល ! កូនប្រុស យើង ! ឈ្មោះ គាត់ អ៊ីសាក ។'], ['sarah', 'អ៊ីសាក មាន ន័យ ថា « សើច » ។'], ['sarah', 'ព្រះជាម្ចាស់ ធ្វើ ឲ្យ ខ្ញុំ សើច ! ខ្ញុំ សប្បាយ ណាស់ !']]);
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
  await talk([['me', 'ខ្ញុំ នៅ ទីនេះ ។'], ['angel', 'កុំ ធ្វើ បាប កូន ! ឥឡូវ យើង ដឹង ថា អ្នក គោរព ព្រះ ។'], ['angel', 'មើល ! នៅ ក្នុង ព្រៃ ។']]);
  const thicket = bush(0x4a6a2a); thicket.scale.setScalar(1.3); place(thicket, -52, -76); tag('ព្រៃ', thicket);
  const ram = animal('ram'); const ramE = ent(ram, -52, -74.5, { yaw: -1 }); tag('ចៀមឈ្មោល', ram.g); ramE.tick = (dt, t) => ram.head.rotation.y = Math.sin(t * 5) * .3;
  goal('ចាប់ ចៀមឈ្មោល ។', ramE);
  await act('ចាប់ ចៀមឈ្មោល', ramE, 4); good();
  isaac.follow = 'player';
  await talk([['me', 'ព្រះជាម្ចាស់ ផ្គត់ផ្គង់ !'], ['isaac', 'ប៉ា ! ព្រះជាម្ចាស់ ផ្គត់ផ្គង់ កូនចៀម !']]);
  godGlow(true, [-60, 40, -80]);
  await talk([['god', 'អ្នក មិន ហាម កូន របស់ អ្នក ទេ ។'], ['god', 'កូនចៅ អ្នក នឹង ច្រើន ដូច ផ្កាយ នៅ លើ មេឃ ដូច ខ្សាច់ នៅ មាត់ សមុទ្រ ។'], ['god', 'តាម កូនចៅ អ្នក គ្រប់ ប្រជាជាតិ នឹង បាន ពរ ។'], ['al', 'រឿង ទៅ មុខ ហើយ ។ ប៉ុន្តែ រឿង មិន ទាន់ ចប់ ទេ ...']]);
  await nextCh();
}

/* ---- 6. Jacob's ladder ---- */
function ladder(h = 60) { const g = new THREE.Group(), m = MB(0xfff0b0, { transparent: true, opacity: .85, fog: false }); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.2, h, .2), m, s * 1.2, h / 2, 0, g); for (let y = 1; y < h; y += 1.6) mesh(new THREE.BoxGeometry(2.4, .12, .12), m, 0, y, 0, g); return g; }
const hillsH = (x, z) => 1 + Math.sin(x * .06) * 2 + Math.cos(z * .05) * 1.6 + Math.sin((x + z) * .12) * .5;
jacob.build = () => {
  setSky(0x3a4a8a, 0xf0a060, 0xd89870, .8, true); scene.fog.near = 40; scene.fog.far = 170;
  H = hillsH; bound = 80; terrain(200, 50, (x, z, y) => y > 3 ? 0xa89060 : 0xb8a070);
  for (let i = 0; i < 40; i++) { const x = rnd(-70, 70), z = rnd(-70, 70); if (Math.hypot(x, z) < 12) continue; place(rock(rnd(.5, 1.6), 0x9a8a70), x, z, rnd(0, 6), 1); }
  for (let i = 0; i < 14; i++) { const x = rnd(-70, 70), z = rnd(-70, 70); if (Math.hypot(x, z) < 14) continue; place(tree({ s: rnd(.7, 1), leaf: 0x5a7a3a }).g, x, z, 0, .7); }
};
async function jacob() {
  await leapIn('jacob', 0, 10, Math.PI);
  await arrive([]);
  await say('me', 'ខ្ញុំ ហត់ ណាស់ ។ យប់ ហើយ ។');
  const pillow = rock(.45, 0x8a8478); place(pillow, 5, 3); tag('ថ្ម', pillow);
  goal('យក ថ្ម មួយ ។', [5, 3]);
  await act('យក ថ្ម', [5, 3], 3); world.remove(pillow); carry(rock(.3, 0x8a8478));
  goal('ដាក់ ថ្ម នៅ ក្រោម ក្បាល ។', [0, 0]);
  await act('ដាក់ ថ្ម', [0, 0], 3.5); drop(); place(pillow, 0, -.7);
  setSky(0x02041a, 0x0a1440, 0x0a1030, .2); await tween(2, k => stars.material.opacity = k);
  goal('ដេក ។', [0, 0]);
  await act('ដេក', [0, 0], 3.5);
  player.x = 0; player.z = .3; player.yaw = 0;
  await camTo([6, H(0, 0) + 4, 6], [0, H(0, 0) + .5, 0], 1);
  await tween(1, k => { hero.b.rotation.x = -k * Math.PI / 2; hero.b.position.y = k * .3; }); toast('ដេក'); await wait(1);
  // the dream
  const f = $('#flash'); f.style.background = 'radial-gradient(circle,#fff8d8,#f2c51c 40%,#3a2a6a)'; await tween(.8, k => f.style.opacity = k * .7); await tween(.8, k => f.style.opacity = .7 * (1 - k)); f.style.background = '';
  await camTo([16, H(0, 0) + 6, 18], [0, 20, -16], 1.5);
  godGlow(true, [0, 64, -32]);
  await say('god', 'មើល ជណ្ដើរ !');
  const ld = ladder(64); place(ld, 0, -10); ld.rotation.x = -.3; tag('ជណ្ដើរ', ld); ld.scale.y = .01; await tween(2, k => ld.scale.y = Math.max(.01, k)); cap('ជណ្ដើរ');
  const angels = [];
  for (let i = 0; i < 6; i++) { const a = ent(person({ glow: 0xffffff }), 0, -10, { solid: 0 }); a.t0 = i / 6; a.dir = 0; a.tick = dt => { a.t0 = (a.t0 + dt * .07 * a.dir + 1) % 1; const y = a.t0 * 60; a.flyAbs = H(0, -10) + y * Math.cos(.3); a.z = -10 - y * Math.sin(.3); a.x = i % 2 ? .5 : -.5; }; angels.push(a); tag('ទេវតា', a.g); }
  await say('god', 'ទេវតា ឡើង ...'); angels.forEach(a => a.dir = 1); cap('ឡើង'); await wait(3);
  await say('god', 'ទេវតា ចុះ ...'); angels.forEach(a => a.dir = -1); cap('ចុះ'); await wait(3);
  angels.forEach((a, i) => a.dir = i % 2 ? 1 : -1);
  await talk([['god', 'យើង ជា ព្រះ របស់ អ័ប្រាហាំ និង អ៊ីសាក ។'], ['god', 'ដី នេះ យើង នឹង ឲ្យ អ្នក និង កូនចៅ អ្នក ។'], ['god', 'យើង នៅ ជាមួយ អ្នក ។ យើង នឹង ការពារ អ្នក ។']]);
  for (const a of angels) { world.remove(a.g); ents.splice(ents.indexOf(a), 1); } world.remove(ld); godGlow(false);
  setSky(0x4a8ad8, 0xf8d0a0, 0xe8d0b0, 1); await tween(1.5, k => stars.material.opacity = 1 - k);
  await camTo([6, H(0, 0) + 4, 6], [0, H(0, 0) + .5, 0], 1);
  await tween(1, k => { hero.b.rotation.x = -(1 - k) * Math.PI / 2; hero.b.position.y = (1 - k) * .3; }); camFree();
  await say('me', 'ព្រះជាម្ចាស់ នៅ ទីនេះ ! ខ្ញុំ មិន ដឹង ទេ ។');
  goal('បញ្ឈរ ថ្ម ។', [0, -.7]);
  await act('បញ្ឈរ ថ្ម', [0, -.7], 3.5);
  world.remove(pillow); const pillar = mesh(new THREE.CylinderGeometry(.35, .45, 2.2, 6), 0x8a8478); place(pillar, 0, -.7, 0, .6, 1.1); tag('ថ្ម', pillar); pillar.scale.y = .2; await tween(1, k => pillar.scale.y = .2 + .8 * k); good();
  toast('បេតអែល'); speaking = 'god'; await sayPhrase('ឈ្មោះ កន្លែង នេះ គឺ បេតអែល ។'); await wait(.5);
  await nextCh();
}

/* ---- 7. Joseph: the coat, the pit, Pharaoh's dream ---- */
const fieldH = (x, z) => 1 + Math.sin(x * .05) * 1.4 + Math.cos(z * .06) * 1.2;
joseph.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 50; scene.fog.far = 190;
  H = fieldH; bound = 95; terrain(220, 50, () => 0x7aa040);
  for (let i = 0; i < 30; i++) { const x = rnd(-80, 80), z = rnd(-80, 80); if (Math.hypot(x, z) < 12 || Math.hypot(x - 42, z + 26) < 16) continue; place(tree({ s: rnd(.7, 1.2) }).g, x, z, 0, .7); }
  const t = tent(0x5a3a2a); place(t, -6, -4, 0, 2.4);
};
function buildEgypt() {
  setSky(0x3a7ad8, 0xf8e0a0, 0xf0d8a0, 1, true);
  H = (x, z) => .5 + Math.sin(x * .04) * .6 + Math.cos(z * .05) * .5 - (z < -36 ? Math.min(3, (-36 - z) * .3) : 0);
  bound = 90; terrain(220, 50, (x, z, y) => y < -.5 ? 0x5a8a4a : 0xe0c080); addWater(-1.6, 0x3a7ab0);
  for (const [x, z, s] of [[-50, 30, 14], [-25, 48, 18], [32, 50, 12]]) { const p = cone(s, s * .95, 0xd8c080, x, H(x, z) + s * .47, z, world, 4); p.rotation.y = Math.PI / 4; }
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) { const z = 6 - i * 4.5; cyl(.6, .7, 7, 0xe8d8b0, sx * 5, H(sx * 5, z) + 3.5, z, world, 7); solids.push({ x: sx * 5, z, r: .8 }); }
  place(box(2.2, 2.6, 1.4, 0xd8a830), 0, -17, 0, 1.4, 1.3);
}
let yOverride = null;
async function joseph() {
  await leapIn('joseph', 2, 6, Math.PI);
  const dad = npc('father', { ...HEROES.jacob, beard: 0xd8d8d8 }, -2, 2, 0);
  await arrive([]);
  await talk([['father', 'យ៉ូសែប កូន ប្រុស ប៉ា !'], ['father', 'ប៉ា ស្រឡាញ់ កូន ណាស់ ។'], ['father', 'នេះ ជា អាវ សម្រាប់ កូន ។']]);
  world.remove(hero.g); hero = person({ ...HEROES.joseph, coat: true, top: 0xd03a2a, bottom: 0x2f5fd0 }); world.add(hero.g); burst(player.x, player.y + 1.2, player.z, 0xf2c51c, 40, 2); good(); cap('អាវ');
  await say('me', 'អរគុណ ប៉ា ! អាវ ស្អាត ណាស់ !');
  await talk([['father', 'បងប្រុស កូន នៅ វាល ជាមួយ ចៀម ។'], ['father', 'ទៅ មើល ពួកគេ ។']]);
  const bros = [0x6a4a2a, 0x3a5a3a, 0x5a3a5a, 0x8a6a3a].map((c, i) => npc('bro', { skin: 0xa07050, top: c, robe: true, beard: 0x2a1a10, cloth: 0xc8b898 }, 38 + (i % 2) * 3, -32 + i * 1.5, 0));
  for (let i = 0; i < 8; i++) { const a = animal('sheep'); const e = ent(a, 44 + rnd(-6, 6), -38 + rnd(-5, 5)); wander(e, 4); tag('ចៀម', a.g); }
  const pit = new THREE.Group(); mesh(new THREE.CylinderGeometry(1.6, 1.7, .5, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0x7a6a50, side: THREE.DoubleSide, flatShading: true }), 0, .15, 0, pit); mesh(new THREE.CircleGeometry(1.55, 8).rotateX(-Math.PI / 2), MB(0x0a0808), 0, .06, 0, pit); place(pit, 46, -20); tag('រណ្ដៅ', pit); solids.push({ x: 46, z: -20, r: 1.4 });
  goal('ទៅ រក បងប្រុស ។', bros[0]);
  await reach([40, -28], 7);
  await talk([['bro', 'មើល ! អ្នក សុបិន មក ហើយ !'], ['bro', 'យក អាវ របស់ គាត់ !']]);
  world.remove(hero.g); hero = person(HEROES.joseph); world.add(hero.g); tone([300, 200], .6, 'triangle', .06);
  const coatO = person({ coat: true, top: 0xd03a2a }).g; coatO.scale.setScalar(.6); bros[0].m.b.add(coatO); coatO.position.set(.4, .6, .3); coatO.rotation.z = 1.2;
  await say('bro', 'បោះ គាត់ ទៅ ក្នុង រណ្ដៅ !');
  // down in the pit
  solids.splice(solids.findIndex(q => q.x === 46 && q.z === -20), 1);
  const pitFloor = H(46, -20) - 3;
  player.x = 46; player.z = -20; yOverride = pitFloor;
  clampFn = (x, z) => { const dx = x - 46, dz = z + 20, d = Math.hypot(dx, dz); return d > .9 ? [46 + dx / d * .9, -20 + dz / d * .9] : [x, z]; };
  track = () => [[46, H(46, -20) + 5, -15.5], [46, pitFloor + 1, -20]];
  cap('រណ្ដៅ'); await wait(2);
  const traders = [0, 1].map(i => npc('trader', { skin: 0x8a5a3a, top: 0xa04030, robe: true, cloth: 0xffffff, beard: 0x1a1010 }, 90, -10 + i * 3, -Math.PI / 2));
  const tc = [0, 1].map(i => ent(animal('camel'), 93, -12 + i * 3, { speed: 6 }));
  traders.forEach((t, i) => walk(t, 51, -21 + i * 2.5, 7)); tc.forEach((c, i) => walk(c, 55, -19 + i * 3, 7)); tc.forEach(c => tag('អូដ្ឋ', c.g));
  track = () => [[52, H(46, -20) + 7, -8], [47, H(46, -20) + .5, -20]];
  await wait(3);
  await talk([['bro', 'មើល ! ឈ្មួញ !'], ['bro', 'កុំ សម្លាប់ គាត់ ។ លក់ គាត់ !'], ['trader', 'ម្ភៃ ប្រាក់ ។']]);
  for (let i = 0; i < 20; i++) setTimeout(() => burst(49, H(49, -21) + 1.8, -21, 0xe0e0f0, 3, 1.5), i * 90);
  toast('២០', 'ម្ភៃ ប្រាក់'); speaking = 'trader'; await sayPhrase('ម្ភៃ ប្រាក់');
  goal('ឡើង ពី រណ្ដៅ ។', null);
  await act('ឡើង', [46, -20], 99);
  yOverride = null; clampFn = null; track = null; player.x = 49; player.z = -19;
  await say('me', 'ប៉ា ! ជួយ ខ្ញុំ ផង !');
  // Egypt, years later
  goal(''); const f = $('#flash'); f.style.background = '#000'; await tween(1.2, k => f.style.opacity = k);
  clearWorld(); hero = null; buildEgypt(); setHero('joseph', 0, 12, Math.PI);
  const ph = npc('pharaoh', { skin: 0x9a6a44, top: 0xf0f0e8, robe: true, cloth: 0x2f5fd0 }, 0, -15.6, 0); cone(.22, .6, 0xf2c51c, 0, .5, 0, ph.m.head, 5); tag('ផារ៉ោន', ph.g);
  await tween(1.2, k => f.style.opacity = 1 - k); f.style.background = '';
  toast('អេស៊ីប', 'ច្រើន ឆ្នាំ ក្រោយ ...'); speaking = 'god'; await sayPhrase('ច្រើន ឆ្នាំ ក្រោយ ។ ស្រុក អេស៊ីប ។');
  goal('ទៅ ជួប ផារ៉ោន ។', ph);
  await reach([0, -12.5], 3.5);
  await talk([['pharaoh', 'យ៉ូសែប ! ខ្ញុំ សុបិន ។ គ្មាន អ្នក ណា យល់ ទេ ។']]);
  await camTo([14, 7, -28], [0, 0, -44], 1.5);
  await say('pharaoh', 'គោ ធាត់ ប្រាំពីរ ក្បាល ...');
  const fat = [], thin = [];
  for (let i = 0; i < 7; i++) { const a = animal('cow'); a.b.scale.set(1.7, 1.15, 1.05); const e = ent(a, -12 + i * 4, -50, { speed: 2 }); walk(e, -12 + i * 4, -40); fat.push(e); tag('ធាត់', a.g); }
  cap('ធាត់'); await wait(3);
  await say('pharaoh', 'គោ ស្គម ប្រាំពីរ ក្បាល ...');
  for (let i = 0; i < 7; i++) { const a = animal('cow'); a.b.scale.set(.5, 1, .95); const e = ent(a, -10 + i * 4, -52, { speed: 2 }); walk(e, -10 + i * 4, -43); thin.push(e); tag('ស្គម', a.g); }
  cap('ស្គម'); await wait(3);
  await say('pharaoh', 'គោ ស្គម ស៊ី គោ ធាត់ !');
  for (const e of fat) { burst(e.x, e.y + 1, e.z, 0xffffff, 20, 2); world.remove(e.g); ents.splice(ents.indexOf(e), 1); } cap('ស៊ី'); await wait(1.5);
  await say('pharaoh', 'តើ វា មាន ន័យ អ្វី ?');
  await say('me', 'ប្រាំពីរ ឆ្នាំ មាន ស្បៀង ច្រើន ។ ប្រាំពីរ ឆ្នាំ ទៀត គ្មាន ស្បៀង ។');
  camFree();
  await talk([['pharaoh', 'អ្នក មាន ប្រាជ្ញា ណាស់ !'], ['pharaoh', 'អ្នក នឹង ធ្វើ ជា មេ លើ ស្រុក អេស៊ីប ទាំងមូល ។']]);
  world.remove(hero.g); hero = person({ ...HEROES.joseph, top: 0xf0f0e8, cloth: 0xf2c51c }); world.add(hero.g);
  const chain = mesh(new THREE.TorusGeometry(.3, .05, 3, 8), MB(0xf2c51c), 0, 1.45, 0, hero.b); chain.rotation.x = Math.PI / 2; burst(player.x, player.y + 1.5, player.z, 0xf2c51c, 50, 2); good();
  toast('', 'យ៉ូសែប សង្គ្រោះ មនុស្ស ជា ច្រើន ។'); await sayPhrase('យ៉ូសែប សង្គ្រោះ មនុស្ស ជា ច្រើន ។');
  await nextCh();
}

/* ---- 8. Moses: the burning bush, the Red Sea ---- */
const horebH = (x, z) => { const d = Math.hypot(x, z + 45); return 1 + 18 * Math.exp(-d * d / 500) + Math.sin(x * .07) * 1.2 + Math.cos(z * .06); };
moses.build = () => {
  setSky(0x4a8ad8, 0xf0d0a0, 0xe0c8a0, 1, true); scene.fog.near = 50; scene.fog.far = 190;
  H = horebH; bound = 85; terrain(220, 50, (x, z, y) => y > 10 ? 0x9a8a70 : 0xb8a070);
  for (let i = 0; i < 30; i++) { const x = rnd(-70, 70), z = rnd(-70, 70); if (Math.hypot(x, z - 4) < 18) continue; place(rock(rnd(.6, 1.8), 0x9a8a70), x, z, rnd(0, 6), 1); }
};
async function moses() {
  await leapIn('moses', 0, 20, Math.PI);
  for (let i = 0; i < 6; i++) { const a = animal('sheep'); const e = ent(a, rnd(-6, 6), 24 + rnd(-3, 3)); wander(e, 4); tag('ចៀម', a.g); }
  await arrive([]);
  const bushO = bush(0x4a6a2a); const fl = fire(); fl.scale.setScalar(1.6); fl.position.y = .7; bushO.add(fl); place(bushO, 0, -8); tag('គុម្ពោត', bushO); tag('ភ្លើង', fl); solids.push({ x: 0, z: -8, r: 1.4 });
  anims.push((dt, t) => { fl.scale.y = 1.6 + Math.sin(t * 12) * .3; if (Math.random() < .4) emit(rnd(-.8, .8), H(0, -8) + 1.6, -8 + rnd(-.8, .8), 0, 2, 0, 0xff8020, .8, 0); });
  goal('មើល គុម្ពោត ឆេះ ។', [0, -8]);
  await reach([0, -8], 7);
  await camTo([player.x + 4, player.y + 2.5, player.z + 3], [0, H(0, -8) + 1, -8], 1.2);
  await say('god', 'ម៉ូសេ ! ម៉ូសេ !');
  await say('me', 'ខ្ញុំ នៅ ទីនេះ ។');
  await talk([['god', 'កុំ ចូល មក ជិត ។'], ['god', 'ដោះ ស្បែកជើង ចេញ ។ ទីនេះ ជា ដី បរិសុទ្ធ ។']]);
  camFree(); goal('ដោះ ស្បែកជើង ។', null);
  await act('ដោះ ស្បែកជើង', [player.x, player.z], 99);
  hero.feet.forEach(f => f.material = M(HEROES.moses.skin)); const sand = [0, 1].map(i => { const s = box(.2, .06, .34, 0x4a3420); place(s, player.x + .8 + i * .3, player.z + .6); return s; }); tag('ស្បែកជើង', sand[0]); cap('ស្បែកជើង'); good();
  await talk([['god', 'យើង ឃើញ ប្រជាជន យើង នៅ ស្រុក អេស៊ីប ។ ពួកគេ យំ ។'], ['god', 'ទៅ ! នាំ ប្រជាជន យើង ចេញ ពី ស្រុក អេស៊ីប ។']]);
  await say('me', 'ខ្ញុំ នឹង ទៅ ។');
  await nextCh();
}
async function redSea() {
  goal(''); const f = $('#flash'); f.style.background = '#000'; f.style.opacity = 1;
  clearWorld(); hero = null;
  setSky(0x3a6ab0, 0xe0c8a0, 0xd0c0a0, .9, true);
  H = (x, z) => z > -8 ? .8 + Math.sin(x * .05) * .5 : z < -70 ? .8 + Math.cos(x * .06) * .5 : -3; bound = 120;
  terrain(260, 64, (x, z, y) => y < 0 ? 0xc8b890 : 0xd8c088);
  const wm = new THREE.MeshLambertMaterial({ color: 0x2a6ab0, map: waterTex.clone(), transparent: true, opacity: .85 }); wm.map.needsUpdate = true; wm.map.repeat.set(10, 5);
  const halves = [-1, 1].map(s => mesh(new THREE.BoxGeometry(120, 4, 62), wm, s * 60, -1, -39, world)); halves.forEach(h => tag('សមុទ្រ', h));
  setHero('moses', 0, 2, Math.PI); clampFn = (x, z) => [x, Math.max(z, -7)];
  const crowd = []; for (let i = 0; i < 14; i++) { const e = npc('people', { skin: 0xa07050, top: [0x8a5a3a, 0x3a5a8a, 0x8a3a3a, 0x5a7a3a, 0xc8b080][i % 5], robe: true, cloth: 0xe0d0b0, small: i % 4 === 0 }, rnd(-9, 9), rnd(6, 15), Math.PI); e.talk = null; crowd.push(e); }
  for (let i = 0; i < 3; i++) { const c = grp(); box(1.6, .8, 1.2, 0xb03a2a, 0, .9, 0, c); for (const s of [-1, 1]) { const w = cyl(.5, .5, .12, 0x5a3a20, s * .9, .5, 0, c, 8); w.rotation.z = Math.PI / 2; } const hz = animal('horse').g; hz.position.set(0, 0, 2.2); c.add(hz); c.rotation.y = Math.PI; place(c, -10 + i * 10, 70); anims.push(dt => { if (c.position.z > 34) { c.position.z -= dt * 6; c.position.y = H(c.position.x, c.position.z); if (Math.random() < .3) emit(c.position.x, c.position.y + .3, c.position.z + 1, rnd(-1, 1), 1, 2, 0xd8c088, .8, 0); } }); tag('ទាហាន', c); }
  await tween(1.2, k => f.style.opacity = 1 - k); f.style.background = '';
  toast('សមុទ្រ ក្រហម'); speaking = 'god'; await sayPhrase('សមុទ្រ ក្រហម');
  await talk([['people', 'មើល ! ទាហាន អេស៊ីប មក !'], ['people', 'យើង នឹង ស្លាប់ !']]);
  await say('me', 'កុំ ខ្លាច ! ព្រះជាម្ចាស់ នឹង ជួយ យើង ។');
  await say('god', 'ម៉ូសេ ! លើក ដំបង របស់ អ្នក !');
  goal('លើក ដំបង នៅ មាត់ សមុទ្រ ។', [0, -6]);
  await act('លើក ដំបង', [0, -6], 4);
  player.raise = true; cap('ដំបង'); tone([80, 120], 3, 'sawtooth', .05, 1.5);
  await camTo([18, 10, 6], [0, 0, -40], 1.5);
  await tween(4, k => { halves[0].position.x = -60 - k * 4.5; halves[1].position.x = 60 + k * 4.5; halves.forEach(h => { h.scale.y = 1 + k * 2; h.position.y = -1 + k * 4; }); });
  player.raise = false; camFree(); cap('សមុទ្រ');
  clampFn = (x, z) => z < -8 ? [clamp(x, -3.5, 3.5), z] : [x, z];
  crowd[0].follow = 'player'; crowd[0].gap = 2.2; crowd.forEach((e, i) => { if (i) { e.follow = crowd[i - 1]; e.gap = 1.6; } });
  goal('ដើរ កាត់ សមុទ្រ ។', [0, -76]);
  await reach([0, -76], 5);
  clampFn = (x, z) => [x, Math.min(z, -71)];
  await wait(2); crowd.forEach(e => { e.follow = null; if (e.z > -71) { e.x = rnd(-8, 8); e.z = rnd(-80, -73); } });
  await say('god', 'លើក ដំបង ម្ដង ទៀត ។');
  await act('លើក ដំបង', [player.x, player.z], 99); player.raise = true;
  await camTo([14, 9, -86], [0, 0, -40], 1.2);
  await tween(2.5, k => { halves[0].position.x = -64.5 + k * 4.5; halves[1].position.x = 64.5 - k * 4.5; halves.forEach(h => { h.scale.y = 3 - k * 2; h.position.y = 3 - k * 4; }); });
  player.raise = false; cap('ទឹក'); camFree();
  await talk([['people', 'ព្រះជាម្ចាស់ សង្គ្រោះ យើង !']]);
  await say('me', 'ព្រះជាម្ចាស់ ជា កម្លាំង របស់ ខ្ញុំ ។');
  await nextCh();
}

/* ---- combat: foes chase you; press A near one to strike. Foes that reach you shove you back. ---- */
let shake = 0;
function foe(model, x, z, o = {}) {
  const e = ent(model, x, z, { speed: o.speed || 3.2, solid: 0 }); e.hp = o.hp || 1; e.foe = true; e.kbT = 0; e.cool = 0;
  e.tick = dt => {
    if (e.dead) return;
    e.cool -= dt;
    if (e.kbT > 0) { e.kbT -= dt; e.goal = null; e.x += e.kbx * dt; e.z += e.kby * dt; return; }
    const d = Math.hypot(player.x - e.x, player.z - e.z);
    if (d > 1.5) e.goal = { x: player.x, z: player.z, res: null };
    else { e.goal = null; e.yaw = Math.atan2(player.x - e.x, player.z - e.z); if (e.cool <= 0) { e.cool = 1.2; shake = .25; tone([140, 90], .2, 'square', .05); const k = 1.2 / Math.max(.3, d); tryMove((player.x - e.x) * k, (player.z - e.z) * k); if (e.m.arms) e.m.arms[1].rotation.x = -1.8; if (e.m.head && !e.m.arms) e.m.head.rotation.x = .5; } }
  };
  return e;
}
function fight(foes, label = 'វាយ', onDown) {
  return new Promise(res => {
    const alive = () => foes.filter(f => !f.dead);
    const nearest = () => { let b = null, bd = 1e9; for (const f of alive()) { const d = Math.hypot(f.x - player.x, f.z - player.z); if (d < bd) { bd = d; b = f; } } return b; };
    const a = { label, r: 3.2, at: () => { const n = nearest(); return n ? [n.x, n.z] : null; } };
    a.fn = () => {
      const f = nearest(); if (!f) return;
      hero.arms[1].rotation.x = -2.6; hero.arms[0].rotation.x = -1.4; tone([520, 260], .15, 'square', .06);
      const d = Math.max(.3, Math.hypot(f.x - player.x, f.z - player.z));
      f.hp--; f.kbT = .35; f.kbx = (f.x - player.x) / d * 16; f.kby = (f.z - player.z) / d * 16; burst(f.x, f.y + 1.2, f.z, 0xffffff, 18, 3);
      if (f.hp <= 0) {
        f.dead = true; f.goal = null; const g = f.g;
        tween(.5, k => { g.rotation.z = k * 1.5; }).then(() => wait(.6)).then(() => { burst(f.x, f.y + .5, f.z, 0xd8c8a0, 20, 2); world.remove(g); const i = ents.indexOf(f); if (i >= 0) ents.splice(i, 1); });
        onDown && onDown(foes.length - alive().length);
      }
      if (!alive().length) { acts.splice(acts.indexOf(a), 1); res(); }
    };
    acts.push(a);
  });
}
function soldier(x, z) { const p = person({ skin: 0xa07050, top: 0x8a2a2a, bottom: 0x5a3a2a, cloth: 0xc8a040, sleeve: 0x8a2a2a }); box(.5, .7, .08, 0xc8a040, 0, 1.1, .3, p.b); tag('ភីលីស្ទីន', p.g); return foe(p, x, z, { speed: rnd(2.6, 3.4) }); }

/* ---- 9. Ehud and Eglon (Judges 3) ---- */
ehud.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 50; scene.fog.far = 200;
  H = (x, z) => 1 + Math.sin(x * .05) * 1.2 + Math.cos(z * .045) * 1.4 + 9 * Math.exp(-((x - 45) ** 2 + (z - 60) ** 2) / 300);
  bound = 100; terrain(220, 50, (x, z, y) => y > 5 ? 0x8a9a50 : z < -20 ? 0xd8c088 : 0x8aa850);
  // Eglon's cool upper room: walls with one doorway (south) and a door that swings shut
  const wy = H(0, -46), wallM = M(0xe0d0b0), wall = (w, d, x, z) => { box(w, 3.6, d, wallM, x, wy + 1.8, z, world); const n = Math.max(1, Math.round(Math.max(w, d) / 1.2)); for (let i = 0; i <= n; i++) solids.push({ x: x + (w > d ? (i / n - .5) * w : 0), z: z + (d > w ? (i / n - .5) * d : 0), r: .7 }); };
  wall(12, .4, 0, -52); wall(.4, 12, -6, -46); wall(.4, 12, 6, -46); wall(4.5, .4, -3.75, -40); wall(4.5, .4, 3.75, -40);
  box(12.4, .3, 12.4, 0xb04a3a, 0, wy + 3.7, -46, world).visible = false;
  place(box(2.4, 1.4, 1.6, 0xd8a830), 0, -50, 0, 1.4, .7);
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { cyl(.5, .6, 4.5, 0xe0d0b0, sx * 4, H(sx * 4, -36 + i * 4) + 2.25, -36 + i * 4, world, 7); solids.push({ x: sx * 4, z: -36 + i * 4, r: .7 }); }
  const hinge = grp(-1.5, wy, -40, world); box(3, 3.4, .2, plankM, 1.5, 1.7, 0, hinge); hinge.rotation.y = -1.5; world.userData.door = hinge; tag('ទ្វារ', hinge);
  for (let i = 0; i < 6; i++) { const h = grp(); box(3, 2, 3, 0xc8b088, 0, 1, 0, h); cone(2.6, 1.3, 0x8a6a3a, 0, 2.6, 0, h, 4).rotation.y = Math.PI / 4; place(h, -24 + (i % 3) * 8, 34 + Math.floor(i / 3) * 9, 0, 2); }
  for (let i = 0; i < 20; i++) { const x = rnd(-80, 80), z = rnd(-80, 80); if (Math.abs(x) < 14 && z < -25) continue; place(tree({ s: rnd(.7, 1.2), palm: z < -20 }).g, x, z, 0, .7); }
};
async function ehud() {
  await leapIn('ehud', 0, 30, Math.PI);
  npc('people', { skin: 0xa07050, top: 0x5a7a3a, robe: true, cloth: 0xe0d0b0, beard: 0xd8d8d8 }, -3, 27, Math.PI / 2);
  await arrive([]);
  await talk([['people', 'អេក្លូន ជា ស្ដេច ម៉ូអាប់ ។ គាត់ ធ្វើ បាប យើង ដប់ប្រាំបី ឆ្នាំ ។'], ['people', 'អេហ៊ូឌ ! អ្នក ប្រើ ដៃ ឆ្វេង ។']]);
  hero.arms[1].rotation.x = -2.8; await wait(.8); // arms[1] is his left
  await say('people', 'យក សួយសារអាករ ទៅ ឲ្យ ស្ដេច អេក្លូន ។');
  await say('me', 'បាទ ។ ខ្ញុំ នឹង ទៅ ។');
  const forge = fire(); forge.scale.setScalar(1.4); place(forge, 8, 24); tag('ភ្លើង', forge);
  goal('ធ្វើ ដាវ ខ្លី ។', [8, 24]);
  await act('ធ្វើ ដាវ', [8, 24], 3.5); burst(8, H(8, 24) + 1, 24, 0xff8020, 30, 2);
  // the short sword, held up in his left hand so you can see it
  const sword = grp(); box(.09, .8, .03, MB(0xe8e8f4), 0, -.95, .12, sword); box(.3, .07, .1, 0x6a4424, 0, -.55, .12, sword); hero.arms[1].add(sword); tag('ដាវ', sword);
  await camTo([player.x + Math.sin(player.yaw) * 3.5, player.y + 2, player.z + Math.cos(player.yaw) * 3.5], [player.x, player.y + 1.6, player.z], .8);
  player.raise = true; cap('ដាវ'); await wait(1.6); player.raise = false; camFree();
  goal('លាក់ ដាវ នៅ ភ្លៅ ស្ដាំ ។', null);
  await act('លាក់ ដាវ', [player.x, player.z], 99); hero.arms[1].remove(sword); sword.position.set(0, .2, .1); sword.rotation.x = Math.PI; hero.legs[0].add(sword); sword.visible = false; toast('ភ្លៅ ស្ដាំ'); await sayPhrase('ដាវ នៅ ភ្លៅ ស្ដាំ ។');
  const baskets = grp(); for (let i = 0; i < 3; i++) { cyl(.4, .3, .5, 0xb08a50, i * .9 - .9, .25, 0, baskets, 7); ball(.3, [0xe03a2a, 0xf2c51c, 0x7a3a8a][i], i * .9 - .9, .5, 0, baskets, 5, 3); } place(baskets, -6, 22); tag('សួយសារអាករ', baskets);
  goal('យក សួយសារអាករ ។', [-6, 22]);
  await act('យក សួយសារអាករ', [-6, 22], 3.5); world.remove(baskets); const bk = grp(); cyl(.35, .28, .45, 0xb08a50, 0, 0, 0, bk, 7); ball(.28, 0xe03a2a, 0, .25, 0, bk, 5, 3); carry(bk);
  const eg = person({ skin: 0x9a6a44, top: 0x6a2a6a, robe: true, cloth: 0xf2c51c, beard: 0x1a1010 }); eg.b.scale.set(2, 1.1, 1.8); cone(.22, .5, 0xf2c51c, 0, .45, 0, eg.head, 5);
  LOOK.eglon = { key: 'eglon', make: () => { const p = person({ skin: 0x9a6a44, top: 0x6a2a6a, robe: true, cloth: 0xf2c51c, beard: 0x1a1010 }); p.b.scale.set(2, 1.1, 1.8); cone(.22, .5, 0xf2c51c, 0, .45, 0, p.head, 5); return p; } };
  const eglon = ent(eg, 0, -48, { yaw: 0, solid: 1.3, id: 'eglon' }); eglon.talk = 'eglon'; tag('អេក្លូន', eg.g); tag('ធាត់', eg.g); tag('ស្ដេច', eg.g);
  const guards = [-1, 1].map(sx => npc('guard', { skin: 0x9a6a44, top: 0x2a3a6a, cloth: 0x2a3a6a, robe: true }, sx * 2, -43, 0));
  goal('ចូល បន្ទប់ ស្ដេច ។', eglon);
  await reach([0, -45], 3.5);
  await talk([['eglon', 'អ្នក ណា ? យក អ្វី មក ?']]);
  goal('ឲ្យ សួយសារអាករ ។', eglon);
  await act('ឲ្យ សួយសារអាករ', eglon, 4.5); drop(); good();
  await say('eglon', 'ល្អ ! ខ្ញុំ ធាត់ ណាស់ ។ ហាហា !');
  await say('me', 'ព្រះករុណា ! ខ្ញុំ មាន សារ សម្ងាត់ សម្រាប់ ព្រះអង្គ ។');
  await say('eglon', 'ស្ងាត់ ! ចេញ ទៅ ទាំងអស់ គ្នា !');
  for (const g of guards) { g.talk = null; walk(g, g.x, -38, 3).then(() => walk(g, g.x * 3, -30, 3)); }
  await wait(2.5);
  await say('me', 'ខ្ញុំ មាន សារ ពី ព្រះជាម្ចាស់ សម្រាប់ ព្រះអង្គ ។');
  eglon.talk = null; eglon.yaw = Math.atan2(player.x - eglon.x, player.z - eglon.z);
  goal('ហូត ដាវ ដោយ ដៃ ឆ្វេង ។', null);
  await act('ហូត ដាវ', [player.x, player.z], 99);
  hero.legs[0].remove(sword); sword.visible = true; sword.position.set(0, 0, 0); sword.rotation.x = 0; hero.arms[1].add(sword); hero.arms[1].rotation.x = -1.4; cap('ដាវ');
  goal('ចាក់ ស្ដេច អេក្លូន ។', eglon);
  await act('ចាក់', eglon, 3.5);
  await camTo([player.x + 4, player.y + 2.4, player.z + 1], [(player.x + eglon.x) / 2, player.y + 1.2, (player.z + eglon.z) / 2], .6);
  // a close look: the blade goes into his belly, hilt and all, and the fat closes over it
  const belly = sph(.36, 0x6a2a6a, 0, 1.1, .78, eg.g, 7, 5); belly.scale.set(1.5, 1, 1);
  hero.arms[1].remove(sword); sword.position.set(0, 1.1, 2.5); sword.rotation.x = Math.PI / 2; eg.g.add(sword);
  const ex = eglon.x + Math.sin(eglon.yaw) * 1.2, ez = eglon.z + Math.cos(eglon.yaw) * 1.2;
  await camTo([ex + Math.cos(eglon.yaw) * 2.6, eglon.y + 1.4, ez - Math.sin(eglon.yaw) * 2.6], [ex, eglon.y + 1.1, ez], .6);
  hero.arms[1].rotation.x = -1.6; tone([200, 120], .4, 'square', .07);
  await tween(.9, k => { sword.position.z = 2.5 - k * 1.75; }); burst(ex, eglon.y + 1.1, ez, 0xa01818, 20, 1.2);
  await tween(.8, k => { belly.scale.set(1.5 + k * .25, 1 + k * .25, 1 + k * .35); });
  await say('god', 'ខ្លាញ់ គ្រប ដាវ ។ អេហ៊ូឌ មិន ហូត ដាវ ចេញ ទេ ។');
  await camTo([player.x + 4, player.y + 2.4, player.z + 1], [(player.x + eglon.x) / 2, player.y + 1.2, (player.z + eglon.z) / 2], .6);
  await tween(1, k => { eg.g.rotation.x = -k * 1.45; }); eglon.solid = 0;
  toast('', 'ស្ដេច អេក្លូន ស្លាប់ ។'); speaking = 'god'; await sayPhrase('ស្ដេច អេក្លូន ស្លាប់ ។'); camFree();
  // out, then shut and lock the door behind you
  const door = world.userData.door;
  goal('ចេញ ពី បន្ទប់ ហើយ បិទ ទ្វារ ។', [0, -37.5]);
  await reach([0, -37.5], 2.2);
  await act('បិទ ទ្វារ', [0, -37.5], 3);
  await tween(.6, k => door.rotation.y = -1.5 * (1 - k)); tone([180], .2, 'square', .06); solids.push({ x: -.8, z: -40, r: .8 }, { x: .8, z: -40, r: .8 }); cap('ទ្វារ');
  goal('ចាក់ សោ ទ្វារ ។', [0, -37.5]);
  await act('ចាក់ សោ', [0, -37.5], 3); tone([900, 700], .15, 'square', .05); box(.3, .3, .2, 0xc8a040, 1.2, H(0, -40) + 1.6, -39.8, world); cap('សោ');
  goal('រត់ ទៅ ភ្នំ ។', [45, 60]);
  for (const g of guards) walk(g, g.x / 3 + rnd(-.5, .5), -36, 3);
  await reach([8, -14], 16);
  await talk([['guard', 'ទ្វារ ចាក់ សោ ...'], ['guard', 'ស្ដេច ប្រហែល ជា នៅ ក្នុង បន្ទប់ ទឹក ។ រង់ចាំ !']]);
  await reach([45, 60], 7);
  // the ram's horn
  const horn = mesh(new THREE.ConeGeometry(.13, .9, 6), 0xe8d8b0); horn.position.set(0, -.75, .25); horn.rotation.x = -1.2; hero.arms[1].add(horn); tag('ស្នែង', horn);
  goal('ផ្លុំ ស្នែង ។', null);
  await act('ផ្លុំ ស្នែង', [player.x, player.z], 99); player.raise = true; tone([220, 220, 330, 330], 1.8, 'sawtooth', .07); cap('ស្នែង'); await wait(1.2); player.raise = false;
  const army = []; for (let i = 0; i < 14; i++) { const e = npc('people', { skin: 0xa07050, top: [0x5a7a3a, 0x8a5a3a, 0x3a5a8a][i % 3], robe: true, cloth: 0xe0d0b0 }, player.x + rnd(-40, 40), player.z - rnd(30, 60), 0); e.talk = null; walk(e, player.x + rnd(-6, 6), player.z + rnd(-9, -3), 7); army.push(e); }
  await wait(3); hero.arms[1].remove(horn);
  await say('me', 'តាម ខ្ញុំ ! ព្រះជាម្ចាស់ ប្រគល់ ម៉ូអាប់ មក យើង ។');
  toast('ប៉ែតសិប ឆ្នាំ'); speaking = 'god'; await sayPhrase('ស្រុក មាន សន្តិភាព ប៉ែតសិប ឆ្នាំ ។');
  await nextCh();
}

/* ---- 10. Samson and the lion (Judges 14) ---- */
const vineH = (x, z) => 1 + Math.sin(x * .06) * 1.6 + Math.cos(z * .05) * 1.3;
samsonLion.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 45; scene.fog.far = 180;
  H = vineH; bound = 85; terrain(200, 50, (x, z, y) => Math.abs(x) < 3 ? 0xc8b088 : 0x7a9a40);
  for (let z = -60; z < 60; z += 4) for (const sx of [-1, 1]) for (let r = 0; r < 3; r++) { const v = grp(); cyl(.06, .08, 1.2, 0x6a4424, 0, .6, 0, v, 4); ball(.5, 0x4a8a2a, 0, 1.2, 0, v, 5, 3); ball(.14, 0x6a2a7a, .25, .9, .2, v, 4, 3); place(v, sx * (7 + r * 4), z); tag('ចម្ការ', v); }
};
async function samsonLion() {
  await leapIn('samson', 0, 40, Math.PI);
  await arrive([]);
  await say('me', 'ខ្ញុំ ទៅ ក្រុង ធីមណាត់ ។');
  goal('ដើរ តាម ផ្លូវ ។', [0, 0]);
  await reach([0, 2], 6);
  const lion = animal('lion'); lion.g.scale.setScalar(1.3); tag('តោ', lion.g);
  const L = foe(lion, 0, -18, { hp: 4, speed: 5 }); L.yaw = 0;
  tone([90, 70], 1.2, 'sawtooth', .08); await camTo([player.x + 5, player.y + 3, player.z + 4], [0, 1, -14], 1);
  await say('me', 'មើល ! តោ !');
  toast('', 'ព្រះវិញ្ញាណ មក លើ សាំសុន ។'); speaking = 'god'; sayPhrase('ព្រះវិញ្ញាណ មក លើ សាំសុន ។'); burst(player.x, player.y + 1, player.z, 0xfff0a0, 60, 3);
  camFree(); goal('វាយ តោ ! ចុច A ។', () => [L.x, L.z]);
  await fight([L], 'វាយ តោ');
  good(); await say('me', 'ព្រះជាម្ចាស់ ឲ្យ កម្លាំង ខ្ញុំ !');
  const lx = clamp(L.x, -2, 2), lz = L.z; await wait(1.5);
  const f = $('#flash'); f.style.background = '#000'; await tween(.8, k => f.style.opacity = k);
  const body = animal('lion'); body.g.scale.setScalar(1.3); body.g.rotation.z = 1.5; place(body.g, lx + 2, lz, 0, 1.2, .5); tag('តោ', body.g);
  const comb = grp(); for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(.18, .18, .25, 6), MB(0xf2b81c), (i % 3 - 1) * .32, 0, Math.floor(i / 3) * .3, comb); place(comb, lx + 2, lz, 0, 0, 1.3); tag('ទឹកឃ្មុំ', comb);
  const bees = (dt, t) => { for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; emit(lx + 2 + Math.cos(a) * rnd(.5, 1.5), H(lx, lz) + 1.6 + rnd(-.4, .6), lz + Math.sin(a) * rnd(.5, 1.5), rnd(-1, 1), rnd(-.5, .5), rnd(-1, 1), i % 2 ? 0xf2c51c : 0x1a1a1a, .4, 0); } }; anims.push(bees);
  player.x = lx - 2; player.z = lz + 8; player.yaw = Math.PI;
  await tween(.8, k => f.style.opacity = 1 - k); f.style.background = '';
  toast('', 'ច្រើន ថ្ងៃ ក្រោយ ...'); speaking = 'god'; await sayPhrase('ច្រើន ថ្ងៃ ក្រោយ ។');
  goal('មើល តោ ។', [lx + 2, lz]);
  await reach([lx + 2, lz], 5);
  await say('me', 'មើល ! ឃ្មុំ ! មាន ទឹកឃ្មុំ នៅ ក្នុង តោ !');
  goal('យក ទឹកឃ្មុំ ។', [lx + 2, lz]);
  await act('យក ទឹកឃ្មុំ', [lx + 2, lz], 3.5); world.remove(comb); const c2 = grp(); for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(.12, .12, .18, 6), MB(0xf2b81c), (i - 1) * .22, 0, 0, c2); carry(c2); cap('ទឹកឃ្មុំ');
  goal('ហូប ទឹកឃ្មុំ ។', null);
  await act('ហូប ទឹកឃ្មុំ', [player.x, player.z], 99); drop(); good();
  await say('me', 'ផ្អែម ណាស់ !'); anims.splice(anims.indexOf(bees), 1);
  await nextCh();
}

/* ---- 11. Samson's foxes (Judges 15:4-5) ---- */
samsonFox.build = () => {
  setSky(0x4a8ad8, 0xf0d0a0, 0xe8d0a8, 1, true); scene.fog.near = 45; scene.fog.far = 190;
  H = vineH; bound = 85; terrain(200, 50, (x, z, y) => z < -30 ? 0xd8b850 : 0x7a9a40);
  for (let i = 0; i < 25; i++) { const x = rnd(-75, 75), z = rnd(-25, 75); if (Math.hypot(x, z) < 12) continue; place(tree({ s: rnd(.7, 1.1) }).g, x, z, 0, .7); }
  for (let i = 0; i < 10; i++) { const x = rnd(-70, 70), z = rnd(-25, 70); if (Math.hypot(x - 3, z - 6) < 12) continue; place(bush(0x4a7a2a), x, z, 0, 1.2); }
  // a little pen of sticks for the caught foxes
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cyl(.07, .07, 1, 0x6a4424, -3 + Math.cos(a) * 2.4, vineH(-3 + Math.cos(a) * 2.4, -2 + Math.sin(a) * 2.4) + .5, -2 + Math.sin(a) * 2.4, world, 4); }
};
async function samsonFox() {
  await leapIn('samson', 3, 6, Math.PI);
  await arrive([]);
  await say('me', 'ពួក ភីលីស្ទីន ធ្វើ អាក្រក់ ដាក់ ខ្ញុំ ។ ខ្ញុំ នឹង តប វិញ ។');
  const field = []; for (let x = -40; x <= 40; x += 2.5) for (let z = -36; z >= -70; z -= 2.5) { const t = cone(.35, 1.4, 0xe8c040, x + rnd(-.6, .6), vineH(x, z) + .7, z + rnd(-.6, .6), world, 4); field.push(t); } tag('ស្រូវ', field[0]);
  const foxes = []; for (let i = 0; i < 6; i++) { const a = animal('fox'); const e = ent(a, rnd(-40, 40), rnd(14, 50), { speed: 3.6, solid: 0 }); tag('កញ្ជ្រាង', a.g); e.tick = dt => { if (e.caught) return; e.rest = (e.rest || 0) - dt; const d = Math.hypot(player.x - e.x, player.z - e.z); if (d < 6 && e.rest <= 0) { const k = 5 / Math.max(.5, d); e.goal = { x: clamp(e.x - (player.x - e.x) * k, -70, 70), z: clamp(e.z - (player.z - e.z) * k, -20, 75), res: null }; if (Math.random() < .01) e.rest = 1.5; } else if (!e.goal && Math.random() < .01) e.goal = { x: e.x + rnd(-6, 6), z: clamp(e.z + rnd(-6, 6), -20, 75), res: null }; }; foxes.push(e); }
  let caught = 0;
  while (caught < 6) {
    const left = foxes.filter(f => !f.caught);
    goal(`ចាប់ កញ្ជ្រាង ។ ( ${khNum(caught)} / ${khNum(6)} )`, () => { const n = foxes.filter(f => !f.caught).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0]; return n ? [n.x, n.z] : null; });
    const f = await pick(left.map(e => ['ចាប់ កញ្ជ្រាង', e, 3.2, e]));
    f.caught = true; f.goal = null; f.g.visible = false; f.hide = true; const mini = animal('fox').g; mini.scale.setScalar(.6); carry(mini); tone([600, 900], .2, 'square', .05);
    goal('ដាក់ កញ្ជ្រាង ក្នុង របង ។', [-3, -2]);
    await act('ដាក់ កញ្ជ្រាង', [-3, -2], 4); drop(); caught++; good(); toast(`កញ្ជ្រាង ${NUMW[caught]}`);
    f.x = -4.2 + ((caught - 1) % 2) * 1.6; f.z = -3 + Math.floor((caught - 1) / 2) * 1.4 - 1.4; f.g.visible = true; f.hide = false; f.yaw = 0;
  }
  // pairs side by side, facing the same way, tails tied in one knot with a torch
  for (let p = 0; p < 3; p++) {
    const a = foxes[p * 2], b = foxes[p * 2 + 1];
    goal(`ចង កន្ទុយ ពីរ ពីរ ។ ( ${khNum(p)} / ${khNum(3)} )`, [a.x + .8, a.z]);
    await act('ចង កន្ទុយ', [a.x + .8, a.z], 3.5);
    b.x = a.x + .9; b.z = a.z; b.yaw = a.yaw;
    const knot = grp(); world.add(knot); mesh(new THREE.TorusGeometry(.12, .04, 3, 6), 0xc8a870, 0, 0, 0, knot); a.knot = knot; b.partner = a;
    b.tick = () => { b.x = a.x + Math.cos(a.yaw) * .9; b.z = a.z - Math.sin(a.yaw) * .9; b.yaw = a.yaw; };
    a.tick = () => { const mx = (a.x + b.x) / 2 - Math.sin(a.yaw) * .9, mz = (a.z + b.z) / 2 - Math.cos(a.yaw) * .9; knot.position.set(mx, groundAt(mx, mz) + .45, mz); };
    good(); toast('ចង !');
  }
  for (let p = 0; p < 3; p++) {
    const a = foxes[p * 2]; goal(`ដាក់ គប់ភ្លើង នៅ កន្ទុយ ។ ( ${khNum(p)} / ${khNum(3)} )`, a);
    await act('ដាក់ គប់ភ្លើង', a, 3.5);
    const fl = fire(); fl.scale.setScalar(.45); fl.position.y = .1; a.knot.add(fl); good();
  }
  cap('គប់ភ្លើង');
  goal('នាំ កញ្ជ្រាង ទៅ ស្រែ ស្រូវ ។', [0, -32]);
  for (let p = 0; p < 3; p++) { const a = foxes[p * 2]; a.follow = 'player'; a.gap = 3 + p * 1.8; a.speed = 6; }
  await reach([0, -30], 6);
  goal('លែង កញ្ជ្រាង ។', null);
  await act('លែង កញ្ជ្រាង', [player.x, player.z], 99);
  for (let p = 0; p < 3; p++) { const a = foxes[p * 2]; a.follow = null; walk(a, -25 + p * 25, rnd(-45, -66), 6); }
  cap('ភ្លើង'); tone([120, 90], 2, 'sawtooth', .05);
  await tween(4, k => { for (const t of field) { if (Math.random() < k * .04 && !t.burnt) { t.burnt = true; t.material = M(0x2a2018); emit(t.position.x, t.position.y + .5, t.position.z, 0, 3, 0, 0xff6020, 1, 0); } if (t.burnt && Math.random() < .03) emit(t.position.x, t.position.y + .8, t.position.z, rnd(-.5, .5), 3, rnd(-.5, .5), 0xff8020, .8, 0); } });
  for (const t of field) t.material = M(0x2a2018);
  await camTo([player.x + 6, player.y + 6, player.z + 10], [0, 0, -50], 1.5);
  await say('me', 'ស្រូវ របស់ ពួក ភីលីស្ទីន ឆេះ អស់ ហើយ !');
  toast('បីរយ', 'សាំសុន ចាប់ កញ្ជ្រាង បីរយ ។'); speaking = 'god'; await sayPhrase('សាំសុន ចាប់ កញ្ជ្រាង បីរយ ។');
  camFree(); await nextCh();
}

/* ---- 12. Samson: the jawbone, the gates of Gaza (Judges 15:9-16, 16:1-3) ---- */
samsonFight.build = () => {
  setSky(0x4a8ad8, 0xf0d8a8, 0xe8d0a8, 1, true); scene.fog.near = 45; scene.fog.far = 190;
  H = (x, z) => 1 + Math.sin(x * .05) * 1.3 + Math.cos(z * .05) * 1.2 + 10 * Math.exp(-((x + 40) ** 2 + (z + 55) ** 2) / 260);
  bound = 90; terrain(210, 50, (x, z, y) => y > 6 ? 0x9a8a60 : 0xc0a870);
  for (let i = 0; i < 25; i++) { const x = rnd(-75, 75), z = rnd(-75, 75); if (Math.hypot(x, z) < 14) continue; place(rock(rnd(.6, 1.6), 0x9a8a70), x, z, rnd(0, 6), 1); }
};
async function samsonFight() {
  await leapIn('samson', 0, 6, Math.PI);
  const judah = [0, 1, 2].map(i => npc('people', { skin: 0xa07050, top: 0x5a7a3a, robe: true, cloth: 0xe0d0b0 }, -3 + i * 3, 9, Math.PI));
  await arrive([]);
  await talk([['people', 'សាំសុន ! ពួក ភីលីស្ទីន មក ចាប់ អ្នក ។'], ['people', 'យើង ត្រូវ ចង អ្នក ដោយ ខ្សែ ។']]);
  await say('me', 'ចង ខ្ញុំ ចុះ ។ ប៉ុន្តែ កុំ សម្លាប់ ខ្ញុំ ។');
  const ropes = []; for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(.36, .05, 3, 8), 0xc8a870, 0, .95 + i * .22, 0, hero.b); r.rotation.x = Math.PI / 2; ropes.push(r); } cap('ខ្សែ');
  for (const j of judah) { j.talk = null; walk(j, j.x * 3, 40, 4); }
  const wave = n => { const out = []; for (let i = 0; i < n; i++) { const a = rnd(0, 6.28); out.push(soldier(player.x + Math.cos(a) * rnd(20, 30), player.z + Math.sin(a) * rnd(20, 30))); } return out; };
  const first = wave(5); for (const s of first) { s.tick0 = s.tick; s.tick = null; walk(s, player.x + (s.x - player.x) * .4, player.z + (s.z - player.z) * .4, 3); }
  await wait(2.5);
  await say('w1', 'ហូ ! យើង ចាប់ សាំសុន បាន ហើយ !');
  toast('', 'ព្រះវិញ្ញាណ មក លើ សាំសុន ។'); speaking = 'god'; sayPhrase('ព្រះវិញ្ញាណ មក លើ សាំសុន ។');
  goal('ផ្ដាច់ ខ្សែ ។', null);
  await act('ផ្ដាច់ ខ្សែ', [player.x, player.z], 99);
  for (const r of ropes) hero.b.remove(r); burst(player.x, player.y + 1.2, player.z, 0xc8a870, 50, 4); good(); toast('ខ្សែ ដាច់ !');
  const jaw = grp(); const jb = box(.12, .1, .9, 0xf0ead8, 0, 0, 0, jaw); jb.rotation.y = .3; box(.12, .35, .1, 0xf0ead8, 0, .15, -.42, jaw); place(jaw, player.x + 2, player.z - 1, 0, 0, .2); tag('ឆ្អឹង', jaw);
  goal('យក ឆ្អឹង ថ្គាម លា ។', [player.x + 2, player.z - 1]);
  await act('យក ឆ្អឹង', [player.x + 2, player.z - 1], 3); world.remove(jaw); const jh = grp(); box(.1, .08, .7, 0xf0ead8, 0, -.6, .15, jh); hero.arms[1].add(jh); cap('ឆ្អឹង');
  for (const s of first) s.tick = s.tick0;
  let down = 0; const total = 5 + 6 + 7;
  const count = () => { down++; goal(`វាយ ភីលីស្ទីន ! ( ${khNum(down)} / ${khNum(total)} )`, null); };
  goal(`វាយ ភីលីស្ទីន ! ( ${khNum(0)} / ${khNum(total)} )`, null);
  await fight(first, 'វាយ', count);
  toast('', 'មក ទៀត !'); await wait(1); await fight(wave(6), 'វាយ', count);
  toast('', 'មក ទៀត !'); await wait(1); await fight(wave(7), 'វាយ', count);
  hero.arms[1].remove(jh); good();
  await say('me', 'ដោយ ឆ្អឹង ថ្គាម លា ខ្ញុំ វាយ មនុស្ស មួយ ពាន់ នាក់ !');
  toast('មួយ ពាន់'); speaking = 'god'; await sayPhrase('មួយ ពាន់ នាក់');
  // the gates of Gaza, at night
  const f = $('#flash'); f.style.background = '#000'; await tween(1, k => f.style.opacity = k);
  for (const e of [...ents]) if (e.foe || judah.includes(e)) { world.remove(e.g); ents.splice(ents.indexOf(e), 1); }
  setSky(0x02041a, 0x0a1440, 0x0a1030, .25, true); stars.material.opacity = 1;
  const wallM = M(0xb89a70); for (const sx of [-1, 1]) { box(30, 7, 2, wallM, sx * 18.5, H(0, 20) + 3.5, 20, world); solids.push(...Array.from({ length: 8 }, (_, i) => ({ x: sx * (5 + i * 4), z: 20, r: 1.6 }))); }
  for (const sx of [-1, 1]) box(2, 9, 2.4, wallM, sx * 3.6, H(0, 20) + 4.5, 20, world);
  const gateO = grp(); box(5, 6, .4, plankM, 0, 3, 0, gateO); for (const sx of [-1, 1]) cyl(.2, .2, 6.6, 0x5a3a20, sx * 2.6, 3.3, 0, gateO, 5); place(gateO, 0, 20); tag('ទ្វារ', gateO); solids.push({ x: 0, z: 20, r: 2.2 });
  player.x = 0; player.z = 30; player.yaw = Math.PI; camYaw = 0;
  await tween(1, k => f.style.opacity = 1 - k); f.style.background = '';
  toast('កាសា', 'យប់ ។ ក្រុង កាសា ។'); speaking = 'god'; await sayPhrase('ក្រុង កាសា ។');
  await talk([['w1', 'សាំសុន នៅ ក្នុង ក្រុង ។ ចាំ ដល់ ព្រឹក ហើយ ចាប់ គាត់ !']]);
  goal('លើក ទ្វារ ក្រុង ។', [0, 22]);
  await act('លើក ទ្វារ', [0, 22], 4);
  world.remove(gateO); solids.splice(solids.findIndex(q => q.x === 0 && q.z === 20 && q.r === 2.2), 1);
  const g2 = grp(); box(3.4, 4, .3, plankM, 0, 0, 0, g2); g2.rotation.x = -1.2; g2.position.set(0, 2.6, -.3); hero.b.add(g2); player.raise = true; good(); cap('ទ្វារ');
  goal('យក ទ្វារ ទៅ លើ ភ្នំ ។', [-40, -55]);
  setSky(0x2a3a7a, 0xd09060, 0x8a6a6a, .6);
  await reach([-40, -55], 6);
  goal('ដាក់ ទ្វារ ។', null);
  await act('ដាក់ ទ្វារ', [player.x, player.z], 99);
  hero.b.remove(g2); player.raise = false; const g3 = grp(); box(5, 6, .4, plankM, 0, 3, 0, g3); place(g3, player.x + 2, player.z - 2, .4); tag('ទ្វារ', g3);
  setSky(0x4a8ad8, 0xf0d8a8, 0xe8d0a8, 1); stars.material.opacity = 0;
  await say('me', 'ព្រះជាម្ចាស់ ឲ្យ កម្លាំង ខ្ញុំ !');
  await nextCh();
}

/* ---- Baby Moses in the basket (Exodus 2), as Miriam ---- */
function reeds(n, x0, z0, w) { for (let i = 0; i < n; i++) { const x = x0 + rnd(-w, w), z = z0 + rnd(-2.5, 2.5); const r = cone(.08, rnd(1.6, 2.6), 0x6a9a3a, x, -1 + rnd(.6, 1), z, world, 3); r.rotation.z = rnd(-.2, .2); } }
function basket() { const g = new THREE.Group(); cyl(.45, .35, .35, 0x8a6a3a, 0, .18, 0, g, 8).scale.z = 1.5; sph(.16, 0xc08a60, 0, .35, .15, g, 5, 3); return g; }
babyMoses.build = () => { buildEgypt(); reeds(60, 0, -42, 20); };
async function babyMoses() {
  await leapIn('miriam', 2, 6, Math.PI);
  const mom = npc('mom', { skin: 0xa07050, top: 0x5a3a6a, robe: true, cloth: 0xd8c8a0, female: true }, -2, 4, Math.PI / 2);
  const b = basket(); place(b, -1, 2.5); tag('កន្ត្រក', b); tag('ទារក', b);
  await arrive([]);
  await talk([['mom', 'ផារ៉ោន ចង់ សម្លាប់ កូនប្រុស ទាំងអស់ ។'], ['mom', 'យើង ត្រូវ លាក់ ប្អូន ប្រុស អ្នក ។'], ['mom', 'យក កន្ត្រក ទៅ ទន្លេ ។']]);
  goal('យក កន្ត្រក ។', [-1, 2.5]);
  await act('យក កន្ត្រក', [-1, 2.5], 3); world.remove(b); const bb = basket(); bb.scale.setScalar(.7); carry(bb); tone([700, 500], .3, 'triangle', .05);
  goal('ដាក់ កន្ត្រក នៅ ទន្លេ ក្នុង ដើម ត្រែង ។', [0, -38]);
  await reach([0, -37], 5);
  await act('ដាក់ កន្ត្រក', [player.x, player.z], 99); drop();
  const fl = basket(); world.add(fl); fl.position.set(0, -1.5, -42); tag('កន្ត្រក', fl); anims.push((dt, t) => { fl.position.y = waterY + .05 + Math.sin(t * 2) * .05; fl.rotation.z = Math.sin(t * 1.3) * .08; }); cap('ទន្លេ');
  goal('លាក់ ខ្លួន ហើយ មើល ។', [12, -33]);
  const hid = bush(0x4a7a2a); hid.scale.setScalar(1.4); place(hid, 13, -33); tag('ព្រៃ', hid);
  await reach([11, -32], 3);
  await camTo([12, 3, -27], [0, -1, -42], 1.4);
  const princess = npc('princess', { skin: 0xb07a50, top: 0xf0f0e8, robe: true, cloth: 0xf2c51c, female: true }, -14, -26, 0); tag('បុត្រី', princess.g);
  const maids = [0, 1].map(i => npc('maid', { skin: 0x9a6a44, top: 0xe0d8c0, robe: true, female: true }, -16 - i * 2, -24, 0));
  await walk(princess, -3, -35, 2.5); maids.forEach((m, i) => walk(m, -6 - i * 2, -33, 2.5));
  await say('princess', 'មើល ! កន្ត្រក មួយ !');
  await wait(.5); tone([900, 1100, 900], .8, 'triangle', .05); await say('princess', 'កូន ទារក ! វា យំ ។');
  camFree(); goal('ទៅ និយាយ ជាមួយ បុត្រី ផារ៉ោន ។', princess);
  await reach([princess.x, princess.z], 4);
  await say('me', 'ខ្ញុំ អាច រក ម្ដាយ ដោះ សម្រាប់ ទារក នេះ ។');
  await say('princess', 'ទៅ !');
  goal('ហៅ ម្ដាយ ។', mom);
  await act('ហៅ ម្ដាយ', mom, 4);
  mom.follow = 'player'; mom.gap = 2; await say('mom', 'កូន ខ្ញុំ !');
  goal('នាំ ម្ដាយ ទៅ បុត្រី ផារ៉ោន ។', princess);
  await reach([princess.x, princess.z], 4); mom.follow = null;
  await talk([['princess', 'ចិញ្ចឹម ទារក នេះ ឲ្យ ខ្ញុំ ។'], ['princess', 'ឈ្មោះ គាត់ គឺ ម៉ូសេ ។ ខ្ញុំ ស្រង់ គាត់ ពី ទឹក ។']]);
  await nextCh();
}

/* ---- The plagues and the Passover (Exodus 7-12) ---- */
plagues.build = () => { buildEgypt(); for (let i = 0; i < 4; i++) { const h = grp(); box(3, 2.4, 3, 0xd8c8a0, 0, 1.2, 0, h); box(1, 1.8, .1, 0x6a4424, 0, .9, 1.52, h); place(h, 20 + i * 5, 4, 0, 2); h.userData.door = [20 + i * 5, 5.8]; world.userData.houses = (world.userData.houses || []).concat([h]); } };
async function plagues() {
  await leapIn('moses', 0, -26, 0);
  const aaron = npc('aaron', { skin: 0xa07050, top: 0x3a5a8a, robe: true, cloth: 0xe8e0c8, beard: 0x8a8a8a }, -2.5, -25, 0);
  const ph = npc('pharaoh', { skin: 0x9a6a44, top: 0xf0f0e8, robe: true, cloth: 0x2f5fd0 }, 0, -21, Math.PI); cone(.22, .6, 0xf2c51c, 0, .5, 0, ph.m.head, 5); tag('ផារ៉ោន', ph.g);
  await arrive([]);
  const ask = async () => { await say('me', 'ផារ៉ោន ! ឲ្យ ប្រជាជន ព្រះជាម្ចាស់ ចេញ ទៅ !'); await say('pharaoh', 'ទេ !'); };
  const raise = async word => { goal(`លើក ដំបង ។ ( ${word} )`, null); await act('លើក ដំបង', [player.x, player.z], 99); player.raise = true; setTimeout(() => player.raise = false, 1400); cap(word); };
  // 1. blood
  await ask();
  await raise('ឈាម'); water.material.color.setHex(0x9a1a1a); await wait(2);
  // 2. frogs
  await ask();
  await raise('កង្កែប');
  for (let i = 0; i < 70; i++) { const fr = new THREE.Group(); sph(.22, 0x3a8a2a, 0, .15, 0, fr, 5, 3).scale.set(1, .6, 1.2); for (const s2 of [-1, 1]) sph(.06, 0x1a1010, s2 * .1, .27, .18, fr, 4, 3); const e = ent({ g: fr }, rnd(-20, 20), rnd(-34, 0), { solid: 0 }); const ph0 = rnd(0, 6); e.tick = (dt, t) => { const k = (t * 1.5 + ph0) % 1; e.fly = Math.sin(k * Math.PI) * .6; if (k < .05) e.yaw = rnd(0, 6); e.x += Math.sin(e.yaw) * dt * 1.2; e.z += Math.cos(e.yaw) * dt * 1.2; }; tag('កង្កែប', fr); }
  await wait(2.5);
  // 3. flies
  await ask();
  await raise('រុយ'); const flies = (dt, t) => { for (let i = 0; i < 6; i++) emit(player.x + rnd(-8, 8), player.y + rnd(.5, 4), player.z + rnd(-8, 8), rnd(-3, 3), rnd(-1, 1), rnd(-3, 3), 0x101010, .6, 0); }; anims.push(flies); await wait(3); anims.splice(anims.indexOf(flies), 1);
  // 4. hail
  await ask();
  await raise('ព្រឹល'); setSky(0x30343e, 0x50586a, 0x485060, .4); tone([60], 1.5, 'sawtooth', .08);
  const hail = () => { for (let i = 0; i < 8; i++) emit(player.x + rnd(-20, 20), player.y + 18, player.z + rnd(-20, 20), 0, -30, 0, 0xffffff, .9, 0); }; anims.push(hail); await wait(3.5); anims.splice(anims.indexOf(hail), 1); setSky(0x3a7ad8, 0xf8e0a0, 0xf0d8a0, 1);
  // 5. locusts
  await ask();
  await raise('កណ្ដូប'); const loc = () => { for (let i = 0; i < 10; i++) emit(player.x + rnd(-25, 25), player.y + rnd(1, 8), player.z + rnd(-25, 25), rnd(4, 8), rnd(-1, 1), rnd(-2, 2), 0x6a7a2a, 1, 0); }; anims.push(loc); await wait(3.5); anims.splice(anims.indexOf(loc), 1);
  // 6. darkness
  await ask();
  await raise('ងងឹត'); setSky(0x000000, 0x050508, 0x000000, .03); await wait(3.5); setSky(0x3a7ad8, 0xf8e0a0, 0xf0d8a0, 1);
  await say('pharaoh', 'ទេ ! ទេ ! ទេ ! ចេញ ទៅ !');
  // the Passover
  await talk([['god', 'យប់ នេះ យើង នឹង ឆ្លង កាត់ ស្រុក អេស៊ីប ។'], ['god', 'លាប ឈាម កូនចៀម នៅ លើ ក្របទ្វារ ។ យើង នឹង រំលង ផ្ទះ នោះ ។']]);
  const houses = world.userData.houses;
  for (let i = 0; i < houses.length; i++) { const [x, z] = houses[i].userData.door; goal(`លាប ឈាម លើ ក្របទ្វារ ។ ( ${khNum(i)} / ${khNum(houses.length)} )`, [x, z]); await act('លាប ឈាម', [x, z], 3); box(1.3, .15, .15, MB(0xa01818), 0, 1.9, 1.56, houses[i]); for (const s2 of [-1, 1]) box(.15, 1.9, .15, MB(0xa01818), s2 * .6, .95, 1.56, houses[i]); good(); }
  setSky(0x02041a, 0x0a1440, 0x0a1030, .2); stars.material.opacity = 1;
  await camTo([28, 9, 22], [28, 1, 4], 1.5);
  const angel = ent(person({ glow: 0xffffff, scale: 1.4 }), 0, 4, { solid: 0, flyAbs: 6 }); await tween(4, k => { angel.x = -10 + k * 60; });
  world.remove(angel.g); ents.splice(ents.indexOf(angel), 1);
  toast('', 'ព្រះជាម្ចាស់ រំលង ផ្ទះ ដែល មាន ឈាម ។'); speaking = 'god'; await sayPhrase('ព្រះជាម្ចាស់ រំលង ផ្ទះ ដែល មាន ឈាម ។');
  camFree(); stars.material.opacity = 0; setSky(0x3a7ad8, 0xf8e0a0, 0xf0d8a0, 1);
  await talk([['pharaoh', 'កូន ច្បង ខ្ញុំ ស្លាប់ ...'], ['pharaoh', 'ចេញ ទៅ ! យក ប្រជាជន របស់ អ្នក ចេញ ទៅ !']]);
  await nextCh();
}

/* ---- The wilderness: manna, quail, water from the rock (Exodus 16-17) ---- */
wilderness.build = () => {
  setSky(0x4a8ad8, 0xf0d8a8, 0xe8d0a8, 1, true); scene.fog.near = 50; scene.fog.far = 200;
  H = (x, z) => 1 + Math.sin(x * .05) * 1.4 + Math.cos(z * .045) * 1.3; bound = 90; terrain(220, 50, () => 0xd0b880);
  for (let i = 0; i < 16; i++) { const t = tent([0x6a4a3a, 0x8a6a4a, 0x5a3a2a][i % 3]); place(t, (i % 4) * 9 - 14, Math.floor(i / 4) * 9 + 14, rnd(0, 1), 2.4); }
  for (let i = 0; i < 20; i++) { const x = rnd(-80, 80), z = rnd(-80, 80); if (Math.hypot(x, z - 20) < 30) continue; place(rock(rnd(.6, 1.8), 0x9a8a70), x, z, rnd(0, 6), 1); }
};
async function wilderness() {
  await leapIn('moses', 0, 4, 0);
  const crowd = []; for (let i = 0; i < 10; i++) { const e = npc('people', { skin: 0xa07050, top: [0x8a5a3a, 0x3a5a8a, 0x8a3a3a, 0x5a7a3a][i % 4], robe: true, cloth: 0xe0d0b0 }, rnd(-8, 8), rnd(8, 14), Math.PI); crowd.push(e); }
  await arrive([]);
  await talk([['people', 'ម៉ូសេ ! យើង ឃ្លាន !'], ['people', 'នៅ ស្រុក អេស៊ីប យើង មាន អាហារ ។']]);
  await say('god', 'យើង នឹង ឲ្យ នំបុ័ង ធ្លាក់ ពី មេឃ ។');
  setSky(0x4a6ab0, 0xf8d8b8, 0xe8d0b8, .8);
  const manna = []; for (let i = 0; i < 40; i++) { const x = rnd(-20, 20), z = rnd(-14, 10); const m = sph(.18, 0xf8f8f0, x, H(x, z) + .08, z, world, 5, 3); m.scale.y = .4; manna.push(m); } tag('ម៉ាណា', manna[0]);
  cap('ម៉ាណា'); await say('people', 'ម៉ាណា ? នេះ ជា អ្វី ?');
  let got = 0;
  while (got < 10) {
    goal(`រើស ម៉ាណា ។ ( ${khNum(got)} / ${khNum(10)} )`, () => { const n = manna.filter(m => m.visible).sort((a, b) => Math.hypot(a.position.x - player.x, a.position.z - player.z) - Math.hypot(b.position.x - player.x, b.position.z - player.z))[0]; return n ? [n.position.x, n.position.z] : null; });
    const m = await pick(manna.filter(q => q.visible).map(q => ['រើស ម៉ាណា', [q.position.x, q.position.z], 1.8, q]));
    m.visible = false; got++; tone([800 + got * 40], .15, 'triangle', .05); toast(khNum(got), NUMW[got]);
  }
  await say('people', 'ផ្អែម ដូច ទឹកឃ្មុំ !');
  await say('god', 'ល្ងាច នេះ សាច់ ។');
  setSky(0x3a3a7a, 0xe08a5a, 0xa07060, .6);
  for (let i = 0; i < 30; i++) { const q = bird(0x8a6a4a); const e = ent(q, rnd(-30, 30), rnd(-30, 30), { solid: 0 }); const tx = rnd(-15, 15), tz = rnd(-10, 12); e.flyAbs = 14; tween(3, k => { e.x = lerp(e.x, tx, k * .2); e.z = lerp(e.z, tz, k * .2); e.flyAbs = H(e.x, e.z) + 14 * (1 - k) + .2; }); tag('ក្រួច', q.g); }
  await wait(3); cap('ក្រួច'); await wait(1.5);
  setSky(0x4a8ad8, 0xf0d8a8, 0xe8d0a8, 1);
  await talk([['people', 'ម៉ូសេ ! យើង ស្រេក ទឹក !'], ['god', 'យក ដំបង ។ វាយ ថ្ម នៅ ភ្នំ ហោរែប ។']]);
  const big = rock(2.4, 0x8a7a6a); place(big, 0, -30); tag('ថ្ម', big); solids.push({ x: 0, z: -30, r: 2.4 });
  goal('វាយ ថ្ម ។', [0, -30]);
  await act('វាយ ថ្ម', [0, -30], 4.5);
  player.raise = true; tone([300, 200], .3, 'square', .07); setTimeout(() => player.raise = false, 900);
  const spring = (dt, t) => { for (let i = 0; i < 5; i++) emit(rnd(-.5, .5), H(0, -30) + 1.5, -27.5, rnd(-1.5, 1.5), rnd(2, 5), rnd(1, 4), 0x60a0ff, 1.2, -9); }; anims.push(spring);
  const pool = mesh(new THREE.CircleGeometry(4, 10).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3a7ad0, map: waterTex, transparent: true, opacity: .85 }), 0, H(0, -25) + .1, -25, world); tag('ទឹក', pool);
  cap('ទឹក'); for (const e of crowd) { e.talk = null; walk(e, rnd(-4, 4), rnd(-24, -20), 5); }
  await wait(2.5); await say('people', 'ទឹក ! ព្រះជាម្ចាស់ ឲ្យ ទឹក យើង !');
  await nextCh();
}

/* ---- Mount Sinai: the Ten Commandments and the golden calf (Exodus 19-20, 32) ---- */
const sinaiH = (x, z) => { const d = Math.hypot(x, z + 50); return 1 + 30 * Math.exp(-d * d / 700) + Math.sin(x * .07) + Math.cos(z * .06); };
sinai.build = () => {
  setSky(0x3a5a9a, 0xd8c8a8, 0xc8b898, .9, true); scene.fog.near = 50; scene.fog.far = 200;
  H = sinaiH; bound = 95; terrain(220, 56, (x, z, y) => y > 18 ? 0x8a7a6a : 0xc0a878);
  for (let i = 0; i < 12; i++) { const t = tent([0x6a4a3a, 0x8a6a4a][i % 2]); place(t, (i % 4) * 9 - 14, Math.floor(i / 4) * 9 + 18, rnd(0, 1), 2.4); }
  const cl = cloud(); cl.scale.setScalar(6); cl.position.set(0, sinaiH(0, -50) + 8, -50); world.add(cl); tag('ពពក', cl);
};
async function sinai() {
  await leapIn('moses', 0, 12, Math.PI);
  await arrive([]);
  await say('god', 'ម៉ូសេ ! ឡើង មក លើ ភ្នំ ស៊ីណាយ ។');
  anims.push(() => { if (Math.random() < .5) emit(rnd(-6, 6), sinaiH(0, -50) + rnd(2, 6), -50 + rnd(-6, 6), 0, 2, 0, 0xff8020, 1, 0); });
  tone([60], 2, 'sawtooth', .06);
  goal('ឡើង ភ្នំ ។', [0, -48]);
  await reach([0, -48], 7);
  godGlow(true, [0, sinaiH(0, -50) + 10, -54]);
  const LAW = ['កុំ មាន ព្រះ ឯ ទៀត ក្រៅ ពី យើង ។', 'កុំ ធ្វើ រូប ព្រះ ហើយ ក្រាប ថ្វាយបង្គំ ។', 'កុំ ប្រើ ព្រះនាម ព្រះជាម្ចាស់ ឥត ប្រយោជន៍ ។', 'ចូរ ញែក ថ្ងៃ សប្ប័ទ ជា ថ្ងៃ បរិសុទ្ធ ។', 'ចូរ គោរព ឪពុក ម្ដាយ ។', 'កុំ សម្លាប់ មនុស្ស ។', 'កុំ ផិតក្បត់ ។', 'កុំ លួច ។', 'កុំ និយាយ កុហក ។', 'កុំ លោភ ។'];
  for (let i = 0; i < LAW.length; i++) { toast(khNum(i + 1), NUMW[i + 1]); await say('god', LAW[i]); }
  const tabs = grp(); for (const s2 of [-1, 1]) { const tb = box(.5, .75, .1, 0x9a9a92, s2 * .28, 0, 0, tabs); } tag('បន្ទះ ថ្ម', tabs); tag('បន្ទះ', tabs);
  carry(tabs); burst(player.x, player.y + 2.4, player.z, 0xffffff, 40, 2); cap('បន្ទះ'); godGlow(false);
  await say('god', 'ចុះ ទៅ ! ប្រជាជន ធ្វើ បាប ហើយ ។');
  // the golden calf, down in the camp
  const calf = animal('cow'); calf.g.traverse(o => { if (o.material) o.material = M(0xf2c51c); }); place(calf.g, 0, 6); calf.g.position.y += .8; tag('គោ មាស', calf.g); tag('មាស', calf.g);
  const ped = box(2.4, .8, 2.8, 0x8a7a6a); place(ped, 0, 6, 0, 1.6, .4);
  const dancers = []; for (let i = 0; i < 12; i++) { const e = npc('people', { skin: 0xa07050, top: [0x8a5a3a, 0x3a5a8a, 0x8a3a3a][i % 3], robe: true, cloth: 0xe0d0b0 }, 0, 6, 0); e.talk = null; const a0 = i / 12 * 6.28; e.tick = (dt, t) => { const a = a0 + t * .6; e.goal = { x: Math.cos(a) * 5, z: 6 + Math.sin(a) * 5, res: null }; }; dancers.push(e); }
  goal('ចុះ ពី ភ្នំ ។', [0, -2]);
  await reach([0, -2], 6);
  await camTo([player.x + 4, player.y + 3, player.z - 2], [0, H(0, 6) + 1.5, 6], 1.2);
  await say('people', 'នេះ ជា ព្រះ របស់ យើង ! គោ មាស !');
  await say('me', 'អ្នក រាល់ គ្នា ធ្វើ បាប ធំ !');
  camFree(); goal('បោក បន្ទះ ថ្ម ។', null);
  await act('បោក បន្ទះ ថ្ម', [player.x, player.z], 99); drop(); for (let i = 0; i < 4; i++) burst(player.x, player.y + .5, player.z + 1, 0x9a9a92, 15, 3); tone([150, 80], .6, 'square', .08); cap('បាក់');
  for (const e of dancers) { e.tick = null; e.goal = null; e.yaw = Math.atan2(player.x - e.x, player.z - e.z); }
  goal('កំទេច គោ មាស ។', [0, 6]);
  await act('កំទេច គោ មាស', [0, 6], 4.5);
  for (let i = 0; i < 4; i++) burst(0, H(0, 6) + 2, 6, 0xf2c51c, 25, 3); world.remove(calf.g); good(); cap('មាស');
  await talk([['god', 'ឆ្លាក់ បន្ទះ ថ្ម ពីរ ទៀត ។ យើង នឹង សរសេរ ម្ដង ទៀត ។'], ['me', 'ព្រះជាម្ចាស់ មាន ព្រះហឫទ័យ មេត្តាករុណា ។']]);
  await nextCh();
}

/* ---- Ruth gleans in Boaz's field (Ruth 1-4) ---- */
ruth.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 50; scene.fog.far = 200;
  H = fieldH; bound = 90; terrain(220, 50, (x, z, y) => z < -6 ? 0xd8c060 : 0x8aa850);
  for (let x = -30; x <= 30; x += 2.2) for (let z = -10; z >= -50; z -= 2.2) if (x > -6 || z < -30) cone(.3, 1.3, 0xe0c040, x + rnd(-.5, .5), fieldH(x, z) + .65, z + rnd(-.5, .5), world, 4);
  for (let i = 0; i < 6; i++) { const h = grp(); box(3, 2, 3, 0xd8c8a0, 0, 1, 0, h); place(h, 20 + (i % 3) * 6, 18 + Math.floor(i / 3) * 6, 0, 2); }
};
async function ruth() {
  await leapIn('ruth', 0, 10, Math.PI);
  const naomi = npc('naomi', { skin: 0xa07050, top: 0x3a3a5a, robe: true, cloth: 0xd8d0c0, female: true }, -2.5, 9, Math.PI / 2); tag('ណាអូមី', naomi.g);
  await arrive([]);
  await talk([['naomi', 'ប្ដី ខ្ញុំ ស្លាប់ ហើយ ។ កូន ខ្ញុំ ក៏ ស្លាប់ ដែរ ។'], ['naomi', 'រស់ ! ត្រឡប់ ទៅ ផ្ទះ ម្ដាយ អ្នក វិញ ចុះ ។']]);
  await say('me', 'ទីណា ដែល អ្នក ទៅ ខ្ញុំ ក៏ ទៅ ដែរ ។ ព្រះ របស់ អ្នក ជា ព្រះ របស់ ខ្ញុំ ។');
  await say('naomi', 'យើង ឃ្លាន ។ ទៅ រើស ស្រូវ ក្នុង វាល ។');
  const reapers = [0, 1, 2].map(i => { const r = npc('w1', { skin: 0x9a6a44, top: 0xc8a878, robe: true, cloth: 0xe0d0b0 }, -14 + i * 8, -12, Math.PI); r.talk = null; r.tick = (dt, t) => r.m.arms[1].rotation.x = -1 + Math.sin(t * 5 + i) * .8; return r; });
  const stalks = []; const spill = n => { for (let i = 0; i < n; i++) { const x = rnd(-18, 18), z = rnd(-16, -4); const s2 = cone(.12, .9, 0xe8c840, x, fieldH(x, z) + .1, z, world, 3); s2.rotation.z = Math.PI / 2; stalks.push(s2); } }; spill(8); tag('ស្រូវ', stalks[0]);
  let got = 0; const glean = async upto => { while (got < upto) { const m = await pick(stalks.filter(q => q.visible).map(q => ['រើស ស្រូវ', [q.position.x, q.position.z], 1.8, q])); m.visible = false; got++; tone([700 + got * 30], .12, 'triangle', .05); toast(khNum(got), NUMWORD(got)); goal(`រើស ស្រូវ ។ ( ${khNum(got)} / ${khNum(10)} )`, null); } };
  goal(`រើស ស្រូវ ។ ( ${khNum(0)} / ${khNum(10)} )`, [0, -10]);
  await glean(5);
  const boaz = npc('boaz', { skin: 0xa07050, top: 0x5a3a6a, robe: true, cloth: 0xf0e8d8, beard: 0x5a4a3a }, 20, -4, -Math.PI / 2); tag('បូអូស', boaz.g); await walk(boaz, player.x + 2.5, player.z + 1.5, 3);
  await talk([['boaz', 'ស្ត្រី នេះ ជា នរណា ?'], ['boaz', 'អ្នក ជួយ ណាអូមី ។ ព្រះជាម្ចាស់ ឲ្យ ពរ អ្នក ។'], ['boaz', 'ពួក អ្នក ច្រូត ! ទម្លាក់ ស្រូវ ឲ្យ នាង ទៀត !']]);
  spill(10); cap('ទម្លាក់'); boaz.talk = null;
  await glean(10);
  goal('យក ស្រូវ ទៅ ឲ្យ ណាអូមី ។', naomi);
  const sheaf = grp(); for (let i = 0; i < 6; i++) cone(.1, 1, 0xe8c840, rnd(-.15, .15), 0, rnd(-.1, .1), sheaf, 3); carry(sheaf);
  await act('ឲ្យ ស្រូវ', naomi, 3.5); drop(); good();
  await talk([['naomi', 'ស្រូវ ច្រើន ណាស់ ! អ្នក រើស ក្នុង វាល អ្នក ណា ?'], ['me', 'បូអូស ។'], ['naomi', 'បូអូស ជា សាច់ញាតិ របស់ យើង !']]);
  toast('', 'បូអូស រៀបការ ជាមួយ រស់ ។'); speaking = 'god'; await sayPhrase('បូអូស រៀបការ ជាមួយ រស់ ។');
  const baby = sph(.2, 0xc08a60, 0, 0, 0, null, 5, 3); carry(baby); toast('អូបេដ', 'ជីតា របស់ ស្ដេច ដាវីឌ'); await sayPhrase('កូន ឈ្មោះ អូបេដ ។ គាត់ ជា ជីតា របស់ ស្ដេច ដាវីឌ ។'); drop();
  await nextCh();
}

/* ---- David and Goliath (1 Samuel 17) ---- */
const elahH = (x, z) => 1 + Math.abs(z) * .12 + Math.sin(x * .05) * 1.2 - (Math.abs(z) < 3 ? 1 : 0);
david.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = elahH; bound = 95; terrain(220, 50, (x, z, y) => Math.abs(z) < 3 ? 0xa8a080 : 0x8aa050);
  const brook = mesh(new THREE.PlaneGeometry(200, 3).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3a7ad0, map: waterTex, transparent: true, opacity: .8 }), 0, .15, 0, world); tag('ជ្រោះ', brook);
  for (let i = 0; i < 10; i++) { const t = tent(i % 2 ? 0x6a4a3a : 0x8a3a2a); place(t, -30 + i * 7, i % 2 ? 42 : -36, 0, 2.4); }
};
async function david() {
  await leapIn('david', 0, 24, Math.PI);
  const saul = npc('saul', { skin: 0xa07050, top: 0x5a3a6a, robe: true, cloth: 0xf2c51c, beard: 0x2a1a10, scale: 1.15 }, 3, 25, -Math.PI / 2); cone(.2, .4, 0xf2c51c, 0, .45, 0, saul.m.head, 5); tag('សូល', saul.g);
  const army = []; for (let i = 0; i < 10; i++) { const e = npc('people', { skin: 0xa07050, top: 0x3a5a8a, cloth: 0x8a8a92, sleeve: 0x3a5a8a }, -14 + i * 3, 18, Math.PI); e.talk = null; army.push(e); }
  const gp = person({ skin: 0x9a6a44, top: 0x9a8a60, bottom: 0x6a4a2a, cloth: 0xb8a060, beard: 0x1a1010, sleeve: 0x9a8a60 }); gp.b.scale.setScalar(2.8); const shield = box(.8, 1, .1, 0xc8a040, 0, -.3, .2, gp.arms[0]); const spear = cyl(.04, .04, 3, 0x6a4424, 0, -.4, .1, gp.arms[1], 5);
  LOOK.goliath = { key: 'goliath', make: () => person({ skin: 0x9a6a44, top: 0x9a8a60, bottom: 0x6a4a2a, cloth: 0xb8a060, beard: 0x1a1010, sleeve: 0x9a8a60 }) };
  const goliath = ent(gp, 0, -22, { yaw: 0, solid: 1.6, id: 'goliath' }); goliath.talk = 'goliath'; tag('កូលីយ៉ាត', gp.g);
  const phil = []; for (let i = 0; i < 10; i++) phil.push(soldierStatic(-14 + i * 3, -28));
  await arrive([]);
  await camTo([8, elahH(0, 10) + 6, 10], [0, elahH(0, -22) + 5, -22], 1.5);
  await talk([['goliath', 'ខ្ញុំ ជា កូលីយ៉ាត ! អ្នក ណា ហ៊ាន ច្បាំង ជាមួយ ខ្ញុំ ?'], ['goliath', 'ហាហា ! អ៊ីស្រាអែល ខ្លាច !']]);
  camFree();
  await say('me', 'ខ្ញុំ នឹង ទៅ ច្បាំង ជាមួយ គាត់ ។');
  await say('saul', 'អ្នក នៅ ក្មេង ណាស់ ! ពាក់ គ្រឿង សឹក របស់ ខ្ញុំ ។');
  goal('ពាក់ គ្រឿង សឹក ។', saul);
  await act('ពាក់ គ្រឿង សឹក', saul, 3.5);
  const armor = grp(); cyl(.34, .36, .8, 0x8a8a92, 0, 1.1, 0, armor, 7); sph(.32, 0x8a8a92, 0, 1.95, 0, armor, 7, 4); armor.scale.setScalar(1.4); hero.b.add(armor); tone([200, 150], .4, 'square', .05);
  await say('me', 'ធ្ងន់ ពេក ! ខ្ញុំ ដើរ មិន រួច ។');
  goal('ដោះ គ្រឿង សឹក ។', null);
  await act('ដោះ គ្រឿង សឹក', [player.x, player.z], 99); hero.b.remove(armor); good();
  const stones = []; for (let i = 0; i < 7; i++) { const x = rnd(-10, 10), z = rnd(-1.2, 1.2); const st = sph(.18, 0xd0ccc0, x, .3, z, world, 5, 3); stones.push(st); } tag('ថ្ម', stones[0]);
  for (let n = 1; n <= 5; n++) {
    goal(`រើស ថ្ម រលោង ប្រាំ ។ ( ${khNum(n - 1)} / ${khNum(5)} )`, () => { const q = stones.filter(s2 => s2.visible).sort((a, b) => Math.hypot(a.position.x - player.x, a.position.z - player.z) - Math.hypot(b.position.x - player.x, b.position.z - player.z))[0]; return q ? [q.position.x, q.position.z] : null; });
    const st = await pick(stones.filter(s2 => s2.visible).map(s2 => ['រើស ថ្ម', [s2.position.x, s2.position.z], 1.8, s2]));
    st.visible = false; tone([600 + n * 60], .15, 'triangle', .05); toast(khNum(n), NUMW[n]);
  }
  goal('ទៅ ជួប កូលីយ៉ាត ។', goliath);
  await reach([goliath.x, goliath.z], 14);
  await say('goliath', 'តើ ខ្ញុំ ជា ឆ្កែ ឬ ? អ្នក មក ជាមួយ ដំបង !');
  await say('me', 'អ្នក មក ជាមួយ ដាវ ។ ខ្ញុំ មក ក្នុង ព្រះនាម ព្រះជាម្ចាស់ !');
  goliath.talk = null; goliath.goal = { x: player.x, z: player.z, res: null }; goliath.speed = 1.5;
  goal('បាញ់ ខ្សែ ដង ។', goliath);
  await act('បាញ់ ខ្សែ ដង', goliath, 16);
  goliath.goal = null; player.raise = true; tone([900, 400], .3, 'square', .06);
  const shot = sph(.15, 0xd0ccc0, player.x, player.y + 2.4, player.z, world, 5, 3);
  await camTo([player.x + 5, player.y + 3, player.z + 4], [goliath.x, goliath.y + 4, goliath.z], .5);
  const hy = goliath.y + 2.8 * 1.85; await tween(.6, k => { shot.position.set(lerp(player.x, goliath.x, k), lerp(player.y + 2.4, hy, k) + Math.sin(k * Math.PI) * 1.5, lerp(player.z, goliath.z, k) + .4); });
  world.remove(shot); burst(goliath.x, hy, goliath.z + .4, 0xffffff, 30, 2); player.raise = false; tone([120, 60], .8, 'square', .08); cap('ថ្ម');
  await tween(1.2, k => { gp.g.rotation.x = k * 1.5; }); goliath.solid = 0; burst(goliath.x, goliath.y, goliath.z + 3, 0xd8c8a0, 50, 4);
  for (const s2 of phil) { s2.talk = null; walk(s2, s2.x * 2, -80, 6); }
  for (const e of army) walk(e, e.x, -10, 6);
  camFree(); await say('people', 'កូលីយ៉ាត ដួល ! ពួក ភីលីស្ទីន រត់ !');
  await say('me', 'ការ ច្បាំង នេះ ជា របស់ ព្រះជាម្ចាស់ ។');
  await nextCh();
}
function soldierStatic(x, z) { const e = npc('w1', { skin: 0xa07050, top: 0x8a2a2a, bottom: 0x5a3a2a, cloth: 0xc8a040, sleeve: 0x8a2a2a }, x, z, 0); e.talk = null; return e; }

/* ---- Elijah on Mount Carmel (1 Kings 18) ---- */
const carmelH = (x, z) => { const d = Math.hypot(x, z); return 8 - d * .06 + Math.sin(x * .1) * .5 + Math.cos(z * .1) * .5; };
elijah.build = () => {
  setSky(0x6a8ab8, 0xe8d0a0, 0xd8c8a0, .95, true); scene.fog.near = 50; scene.fog.far = 200;
  H = carmelH; bound = 90; terrain(220, 50, (x, z, y) => y > 5 ? 0x9a8a60 : 0xa89a60);
  for (let i = 0; i < 16; i++) { const x = rnd(-70, 70), z = rnd(-70, 70); if (Math.hypot(x, z) < 22) continue; place(tree({ s: rnd(.6, 1), leaf: 0x6a7a3a }).g, x, z, 0, .7); }
  const baal = altar(); baal.scale.setScalar(1.6); place(baal, 10, -6, 0, 1.8); tag('អាសនា', baal);
};
async function elijah() {
  await leapIn('elijah', -6, 8, Math.PI);
  const crowd = []; for (let i = 0; i < 12; i++) { const e = npc('people', { skin: 0xa07050, top: [0x8a5a3a, 0x3a5a8a, 0x5a7a3a][i % 3], robe: true, cloth: 0xe0d0b0 }, rnd(-16, 16), rnd(14, 20), Math.PI); e.talk = null; crowd.push(e); }
  const prophets = []; for (let i = 0; i < 10; i++) { const e = npc('baal', { skin: 0x9a6a44, top: 0x8a2a4a, robe: true, cloth: 0x2a1a1a }, 10, -6, 0); e.talk = null; const a0 = i / 10 * 6.28; e.tick = (dt, t) => { const a = a0 + t * .8; e.goal = { x: 10 + Math.cos(a) * 4, z: -6 + Math.sin(a) * 4, res: null }; e.m.arms.forEach(r => r.rotation.x = -2.4 + Math.sin(t * 8 + i) * .4); }; prophets.push(e); tag('ហោរា', e.g); }
  await arrive([]);
  await talk([['baal', 'បាល ! ឆ្លើយ មក ! បាល !'], ['baal', 'បាល ! ឆ្លើយ មក !']]);
  await say('me', 'ស្រែក ឲ្យ ខ្លាំង ទៀត ! ប្រហែល ជា បាល កំពុង ដេក !');
  await say('baal', '... គ្មាន ចម្លើយ ទេ ។');
  for (const e of prophets) { e.tick = null; e.goal = null; }
  const stones = []; for (let i = 0; i < 12; i++) { const x = -14 + rnd(-6, 6), z = rnd(-14, 4); const st = rock(.4, 0x8a8478); place(st, x, z); stones.push(st); } tag('ថ្ម', stones[0]);
  for (let n = 1; n <= 12; n++) {
    goal(`យក ថ្ម ដប់ពីរ ។ ( ${khNum(n - 1)} / ${khNum(12)} )`, () => { const q = stones.filter(s2 => s2.visible).sort((a, b) => Math.hypot(a.position.x - player.x, a.position.z - player.z) - Math.hypot(b.position.x - player.x, b.position.z - player.z))[0]; return q ? [q.position.x, q.position.z] : null; });
    const st = await pick(stones.filter(s2 => s2.visible).map(s2 => ['យក ថ្ម', [s2.position.x, s2.position.z], 2, s2]));
    st.visible = false; tone([500 + n * 40], .12, 'triangle', .05); toast(khNum(n));
  }
  goal('ធ្វើ អាសនា ។', [-6, -6]);
  await act('ធ្វើ អាសនា', [-6, -6], 4); const al2 = altar(); al2.scale.setScalar(1.6); place(al2, -6, -6, 0, 1.8); const wood = logPile(); wood.scale.setScalar(.6); place(wood, -6, -6, 0, 0, 1.4); tag('អាសនា', al2);
  const ditch = mesh(new THREE.RingGeometry(2.4, 3.2, 10).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3a7ad0, map: waterTex, transparent: true, opacity: 0 }), -6, carmelH(-6, -6) + .1, -6, world); tag('ទឹក', ditch);
  const jar = grp(); cyl(.3, .22, .6, 0xb06a3a, 0, .3, 0, jar, 7); place(jar, -1, -2); tag('ក្អម', jar);
  for (let n = 1; n <= 3; n++) {
    goal(`ចាក់ ទឹក លើ អាសនា ។ ( ${khNum(n - 1)} / ${khNum(3)} )`, [-6, -6]);
    await act('ចាក់ ទឹក', [-6, -6], 4.5);
    for (let i = 0; i < 30; i++) emit(-6 + rnd(-1, 1), carmelH(-6, -6) + 3, -6 + rnd(-1, 1), 0, -3, 0, 0x60a0ff, .8, -9);
    ditch.material.opacity = n * .28; toast(khNum(n), NUMW[n]); tone([400, 300], .3, 'triangle', .05);
  }
  await say('me', 'ព្រះជាម្ចាស់ អើយ ! សូម ឆ្លើយ មក ! ឲ្យ គេ ដឹង ថា ព្រះអង្គ ជា ព្រះ ។');
  await camTo([2, carmelH(0, 0) + 6, 10], [-6, carmelH(-6, -6) + 4, -6], 1.2);
  tone([60, 90], 2, 'sawtooth', .08); const bolt = mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 8), MB(0xffd060, { transparent: true, opacity: .8, fog: false }), -6, carmelH(-6, -6) + 30, -6, world);
  await tween(1.2, k => { bolt.material.opacity = .9 * (1 - k * .6); for (let i = 0; i < 8; i++) emit(-6 + rnd(-2, 2), carmelH(-6, -6) + rnd(0, 3), -6 + rnd(-2, 2), rnd(-2, 2), rnd(2, 6), rnd(-2, 2), 0xff8020, 1, 0); });
  world.remove(bolt); world.remove(wood); world.remove(al2); ditch.material.opacity = 0; for (let i = 0; i < 4; i++) burst(-6, carmelH(-6, -6) + 1, -6, 0xff6020, 30, 4); cap('ភ្លើង');
  await say('god', 'ភ្លើង ឆេះ ឈើ ថ្ម ដី និង ទឹក ទាំងអស់ ។');
  camFree(); for (const e of crowd) { e.yaw = Math.atan2(-6 - e.x, -6 - e.z); }
  await talk([['people', 'ព្រះជាម្ចាស់ ជា ព្រះ ! ព្រះជាម្ចាស់ ជា ព្រះ !']]);
  const cl = cloud(); cl.scale.setScalar(.3); cl.position.set(-40, 20, -80); world.add(cl); tag('ពពក', cl);
  await say('me', 'មើល ! ពពក មួយ តូច ដូច ដៃ មនុស្ស ។');
  await tween(3, k => { cl.scale.setScalar(.3 + k * 5); cl.position.set(-40 + k * 30, 20, -80 + k * 50); });
  setSky(0x30343e, 0x50586a, 0x485060, .4); raining = 6; cap('ភ្លៀង'); await wait(3); raining = 0;
  await nextCh();
}

/* ---- Jonah (Jonah 1-3) ---- */
jonah.build = () => { setSky(0x4a8ad8, 0xf0dcb0, 0xd8d8d0, 1, true); scene.fog.near = 50; scene.fog.far = 200; H = (x, z) => z > 10 ? 1.5 + Math.sin(x * .05) : -6; bound = 110; terrain(240, 50, (x, z, y) => y > 0 ? 0xd8c088 : 0xc8b890); addWater(0, 0x2a6ab0); };
function ship() { const g = new THREE.Group(); box(4, 1.6, 12, plankM, 0, .4, 0, g); cyl(.15, .15, 8, 0x5a3a20, 0, 4.8, 0, g, 5); box(.1, 4.5, 4, 0xf0ead8, 0, 5.2, .6, g); return g; }
async function jonah() {
  await leapIn('jonah', 0, 20, Math.PI);
  await arrive([]);
  godGlow(true, [0, 25, -10]);
  await say('god', 'យ៉ូណាស ! ទៅ ក្រុង នីនីវេ ។ ប្រកាស ទាស់ នឹង ក្រុង នោះ ។');
  await say('me', 'ទេ ! ខ្ញុំ នឹង រត់ ទៅ ក្រុង តើស៊ីស ។');
  godGlow(false);
  const sh = ship(); world.add(sh); sh.position.set(0, -.2, 4); tag('សំពៅ', sh);
  goal('ឡើង សំពៅ ។', [0, 9]);
  await act('ឡើង សំពៅ', [0, 10], 4);
  const deckY = () => sh.position.y + 1.25; floors.push({ x0: -1.8, x1: 1.8, z0: -6 + sh.position.z, z1: 6 + sh.position.z, y: deckY });
  player.x = 0; player.z = sh.position.z; solids.length = 0;
  const sailors = [0, 1, 2].map(i => { const e = npc('sailor', { skin: 0x8a5a3a, top: 0x3a5a8a, hair: 0x1a1010 }, (i - 1) * 1.1, sh.position.z - 3, 0); e.flyAbs = null; return e; });
  // sail out
  track = () => [[sh.position.x + 14, 9, sh.position.z + 14], [sh.position.x, 2, sh.position.z]];
  const dz = -60; await tween(4, k => { sh.position.z = 4 + k * dz; player.z = sh.position.z + 1; sailors.forEach((s2, i) => s2.z = sh.position.z - 3 + i * .3); floors[0].z0 = sh.position.z - 6; floors[0].z1 = sh.position.z + 6; });
  clampFn = (x, z) => [clamp(x, -1.6, 1.6), clamp(z, sh.position.z - 5.5, sh.position.z + 5.5)];
  // the storm
  setSky(0x20242e, 0x40485a, 0x384050, .3); raining = 8; tone([70], 3, 'sawtooth', .07, .6); cap('ព្យុះ');
  const rock2 = (dt, t) => { sh.rotation.z = Math.sin(t * 2.2) * .18; sh.position.y = -.2 + Math.sin(t * 1.7) * .5; waterY = Math.sin(t * 1.3) * .4; }; anims.push(rock2);
  await talk([['sailor', 'ព្យុះ ធំ ណាស់ ! យើង នឹង ស្លាប់ !'], ['sailor', 'នេះ ដោយសារ អ្នក ណា ? អ្នក ធ្វើ អ្វី ?']]);
  await say('me', 'ដោយសារ ខ្ញុំ ។ បោះ ខ្ញុំ ទៅ ក្នុង សមុទ្រ ។');
  goal('លោត ទៅ ក្នុង សមុទ្រ ។', null);
  await act('លោត', [player.x, player.z], 99);
  clampFn = null; yOverride = -.6; player.x = 3.2; // the deck stays under the sailors; only you go overboard tone([400, 200], .5, 'triangle', .06); burst(player.x, 0, player.z, 0xffffff, 40, 3);
  anims.splice(anims.indexOf(rock2), 1); sh.rotation.z = 0; waterY = 0; raining = 0; setSky(0x4a8ad8, 0xc0d8f0, 0xc8d8e8, .9);
  toast('', 'សមុទ្រ ស្ងប់ ។'); await sayPhrase('សមុទ្រ ស្ងប់ ។');
  // the great fish
  const big = fish(0x5a6a8a); big.g.scale.setScalar(14); const fe = ent(big, player.x + 40, player.z, { solid: 0, flyAbs: -3 }); fe.yaw = -Math.PI / 2; tag('ត្រី ធំ', big.g); tag('ត្រី', big.g);
  track = () => [[player.x + 16, 7, player.z + 18], [player.x + 6, 0, player.z]];
  await tween(2.5, k => { fe.x = player.x + 40 - k * 40; fe.flyAbs = -3 + Math.sin(k * Math.PI) * 2; });
  cap('ត្រី'); hero.g.visible = false;
  // inside the fish: a dark red belly behind the text box and buttons, not a black screen over them
  const f = $('#flash'); f.style.background = 'radial-gradient(ellipse at 50% 45%,#7a2a24,#3a0c0a 60%,#160404)'; f.style.zIndex = 5; await tween(.5, k => f.style.opacity = k * .95);
  for (let d = 1; d <= 3; d++) { toast(`ថ្ងៃ ទី ${khNum(d)}`); await sayPhrase(`ថ្ងៃ ទី ${NUMW[d]}`); await wait(.5); }
  await say('me', 'ព្រះជាម្ចាស់ អើយ ! សូម ជួយ ខ្ញុំ ។ សេចក្ដី សង្គ្រោះ មក ពី ព្រះជាម្ចាស់ ។');
  // spat out on dry land
  floors.length = 0; ents.splice(ents.indexOf(fe), 1); world.remove(big.g); world.remove(sh); sailors.forEach(s2 => { world.remove(s2.g); ents.splice(ents.indexOf(s2), 1); });
  track = null; yOverride = null; player.x = 0; player.z = 14; hero.g.visible = true; player.yaw = 0; camYaw = Math.PI;
  for (let i = 0; i < 10; i++) { const h = grp(); box(4, rnd(3, 6), 4, brickM, 0, 2, 0, h); place(h, -24 + (i % 5) * 12, 50 + Math.floor(i / 5) * 12, 0, 3); }
  await tween(.5, k => f.style.opacity = .95 * (1 - k)); f.style.background = ''; f.style.zIndex = '';
  burst(0, 1.5, 14, 0x60a0ff, 50, 3); toast('', 'ត្រី ខ្ជាក់ យ៉ូណាស លើ ដី គោក ។'); await sayPhrase('ត្រី ខ្ជាក់ យ៉ូណាស លើ ដី ។');
  await say('god', 'យ៉ូណាស ! ទៅ ក្រុង នីនីវេ ។');
  const folk = []; for (let i = 0; i < 12; i++) { const e = npc('people', { skin: 0x9a6a44, top: [0xc04040, 0x4060c0, 0xc0a040][i % 3], robe: true, cloth: 0xe0d0b0 }, rnd(-20, 20), rnd(34, 46), Math.PI); e.talk = null; folk.push(e); }
  goal('ទៅ ក្រុង នីនីវេ ។', [0, 36]);
  await reach([0, 34], 7);
  goal('ប្រកាស ។', null);
  await act('ប្រកាស', [player.x, player.z], 99);
  await say('me', 'សែសិប ថ្ងៃ ទៀត ក្រុង នីនីវេ នឹង ត្រូវ បំផ្លាញ !');
  await say('people', 'យើង ធ្វើ បាប ! យើង នឹង ប្រែ ចិត្ត !');
  for (const e of folk) { world.remove(e.g); e.m = person({ skin: 0x9a6a44, top: 0x5a4a3a, robe: true, cloth: 0x5a4a3a }); e.g = e.m.g; world.add(e.g); }
  cap('ប្រែ ចិត្ត'); toast('', 'ពួកគេ ពាក់ បាវ ។ ព្រះជាម្ចាស់ អាណិត ក្រុង នោះ ។'); speaking = 'god'; await sayPhrase('ព្រះជាម្ចាស់ អាណិត ក្រុង នីនីវេ ។');
  await nextCh();
}

/* ---- The fiery furnace (Daniel 3), as Shadrach ---- */
const plainH = (x, z) => 1 + Math.sin(x * .04) * .8 + Math.cos(z * .05) * .7;
furnace.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = plainH; bound = 95; terrain(220, 50, () => 0xd8c088);
  const st = person({ skin: 0xf2c51c, top: 0xf2c51c, robe: true, cloth: 0xf2c51c, beard: 0xf2c51c }); st.g.traverse(o => { if (o.material) o.material = M(0xf2c51c); }); st.b.scale.setScalar(7); place(st.g, 0, -30, 0, 5); tag('រូប មាស', st.g); tag('មាស', st.g);
  const kiln = grp(); for (const [w, d, x, z] of [[9, .6, 0, -4.2], [.6, 9, -4.2, 0], [.6, 9, 4.2, 0], [3, .6, -3, 4.2], [3, .6, 3, 4.2]]) box(w, 7, d, brickM, x, 3.5, z, kiln); box(3, 3.6, .6, brickM, 0, 5.2, 4.2, kiln); place(kiln, 30, -10, -Math.PI / 2, 5.5); world.userData.kiln = kiln; tag('ឡ ភ្លើង', kiln); tag('ឡ', kiln);
};
async function furnace() {
  await leapIn('shadrach', 0, 6, Math.PI);
  const friends = [['meshach', 0x3a6a8a], ['abed', 0x6a3a8a]].map(([id, c], i) => npc(id, { skin: 0x9a6a44, top: c, robe: true, cloth: 0xe0d0b0 }, -2.5 + i * 5, 6.5, Math.PI));
  const king = npc('king', { skin: 0x9a6a44, top: 0x8a2a2a, robe: true, cloth: 0xf2c51c, beard: 0x1a1010 }, 8, -18, -Math.PI / 4); cone(.22, .5, 0xf2c51c, 0, .45, 0, king.m.head, 5); tag('ស្ដេច', king.g);
  const crowd = []; for (let i = 0; i < 16; i++) { const e = npc('people', { skin: 0x9a6a44, top: [0xc04040, 0x4060c0, 0xc0a040, 0x40a060][i % 4], robe: true, cloth: 0xe0d0b0 }, -14 + (i % 8) * 4, -8 - Math.floor(i / 8) * 4, Math.PI); e.talk = null; e.yaw = Math.PI; crowd.push(e); }
  await arrive([]);
  await talk([['king', 'ពេល ឮ ភ្លេង ចូរ ក្រាប ថ្វាយបង្គំ រូប មាស !'], ['king', 'អ្នក ណា មិន ក្រាប នឹង ត្រូវ បោះ ទៅ ក្នុង ឡ ភ្លើង !']]);
  tone([392, 494, 587, 784, 587, 494], 1.6, 'square', .05); cap('ភ្លេង');
  await tween(1, k => crowd.forEach(e => kneel(e.m, k, e)));
  await say('me', 'យើង មិន ក្រាប ថ្វាយបង្គំ រូប នេះ ទេ !');
  await talk([['king', 'ខ្ញុំ ខឹង ណាស់ ! ដុត ឡ ឲ្យ ក្ដៅ ប្រាំពីរ ដង !'], ['king', 'ចង ពួកគេ ហើយ បោះ ទៅ ក្នុង ឡ !']]);
  crowd.forEach(e => kneel(e.m, 0, e));
  // inside the fire
  const f = $('#flash'); f.style.background = 'radial-gradient(circle,#fff0a0,#ff8020 50%,#601000)'; await tween(.7, k => f.style.opacity = k);
  setSky(0xff6020, 0xffa040, 0xff8030, .9, true); scene.fog.color.setHex(0xff8030); scene.fog.near = 2; scene.fog.far = 30;
  const fireFx = () => { for (let i = 0; i < 10; i++) emit(player.x + rnd(-8, 8), player.y + rnd(0, 1), player.z + rnd(-8, 8), rnd(-.5, .5), rnd(2, 5), rnd(-.5, .5), Math.random() < .5 ? 0xff6020 : 0xffd040, 1.2, 0); }; anims.push(fireFx);
  player.x = 30; player.z = -10; clampFn = (x, z) => [clamp(x, 26.5, 33.5), clamp(z, -13.5, -6.5)];
  track = () => [[30 + 3, plainH(30, -10) + 13, -10 + 4], [player.x, player.y + 1, player.z]];
  friends.forEach((e, i) => { e.x = 29 + i * 2; e.z = -11; e.talk = null; });
  const ropes = []; for (let i = 0; i < 2; i++) { const r = mesh(new THREE.TorusGeometry(.36, .05, 3, 6), 0xc8a870, 0, 1 + i * .25, 0, hero.b); r.rotation.x = Math.PI / 2; ropes.push(r); }
  await tween(.7, k => f.style.opacity = 1 - k); f.style.background = '';
  await say('me', 'យើង នៅ ក្នុង ភ្លើង ... ប៉ុន្តែ មិន ក្ដៅ ទេ !');
  const fourth = ent(person({ glow: 0xffffff, scale: 1.1 }), 31, -8, { solid: 0, fly: .2 }); tag('ទេវតា', fourth.g); fourth.follow = 'player'; fourth.gap = 1.8; good();
  goal('ដើរ ក្នុង ភ្លើង ។', [32, -12]);
  await act('ដើរ', [32, -12], 2.5);
  for (const r of ropes) hero.b.remove(r); burst(player.x, player.y + 1, player.z, 0xc8a870, 20, 2); toast('ខ្សែ ឆេះ', 'ខ្សែ ឆេះ ដាច់ អស់ ។'); speaking = 'god'; await sayPhrase('ខ្សែ ឆេះ ដាច់ អស់ ។');
  await say('king', 'មើល ! មនុស្ស បួន នាក់ ដើរ ក្នុង ភ្លើង ! ម្នាក់ ដូច កូន ព្រះ !');
  await say('king', 'សាដ្រាក់ ! ចេញ មក !');
  goal('ចេញ ពី ឡ ។', null);
  await act('ចេញ', [player.x, player.z], 99);
  anims.splice(anims.indexOf(fireFx), 1); clampFn = null; track = null; world.remove(fourth.g); ents.splice(ents.indexOf(fourth), 1);
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  player.x = 30; player.z = -3; friends.forEach((e, i) => { e.x = 28 + i * 4; e.z = -2; });
  await talk([['king', 'សក់ មិន ឆេះ ។ អាវ មិន ធុំ ក្លិន ផ្សែង ទេ ។'], ['king', 'ព្រះ របស់ អ្នក ជា ព្រះ ពិត ! ព្រះ អង្គ សង្គ្រោះ អ្នក !']]);
  await nextCh();
}

/* ---- Daniel in the lions' den (Daniel 6) ---- */
daniel.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 50; scene.fog.far = 200;
  H = plainH; bound = 90; terrain(220, 50, () => 0xd8c088);
  const house = grp(); box(6, 4, 6, 0xd8c8a0, 0, 2, 0, house); box(1.4, 1.2, .1, MB(0x1a2a5a), 0, 3, 3.02, house); place(house, -10, 0, 0, 3.5); tag('បង្អួច', house);
  const den = grp(); mesh(new THREE.CylinderGeometry(6, 6.4, 1, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0x7a6a50, side: THREE.DoubleSide, flatShading: true }), 0, .3, 0, den); place(den, 20, -24); tag('រូង តោ', den); tag('រូង', den);
};
async function daniel() {
  await leapIn('daniel', -10, 5, Math.PI);
  await arrive([]);
  await say('god', 'ស្ដេច ដារីយុស ចេញ ច្បាប់ ៖ កុំ អធិស្ឋាន ទៅ ព្រះ ណា ក្រៅ ពី ស្ដេច ។');
  await say('me', 'ខ្ញុំ នឹង អធិស្ឋាន ដល់ ព្រះ ខ្ញុំ ដូច ពី មុន ។');
  for (let n = 1; n <= 3; n++) {
    goal(`អធិស្ឋាន នៅ មុខ បង្អួច ។ ( ${khNum(n - 1)} / ${khNum(3)} )`, [-10, 4.2]);
    await act('អធិស្ឋាន', [-10, 4.2], 3);
    player.yaw = Math.PI; await tween(.5, k => kneel(hero, k)); toast(khNum(n), `ម្ដង ${NUMW[n]}`); await wait(.8); await tween(.4, k => kneel(hero, 1 - k));
    setSky(...[[0xe0a060, 0xf8d8a0, 0xf0d0a0, .9], [0x4a8ad8, 0xf8e8c0, 0xf0e0c0, 1], [0x3a3a7a, 0xe08a5a, 0xa07060, .6]][n - 1]);
  }
  const spies = [0, 1].map(i => npc('official', { skin: 0x9a6a44, top: 0x5a2a5a, robe: true, cloth: 0x2a2a2a }, -14 + i * 2, 9, Math.PI));
  await say('official', 'មើល ! ដានីយ៉ែល អធិស្ឋាន ទៅ ព្រះ របស់ គាត់ !');
  const king = npc('king', { skin: 0x9a6a44, top: 0x2a4a8a, robe: true, cloth: 0xf2c51c, beard: 0x5a4a3a }, 16, -16, Math.PI); cone(.22, .5, 0xf2c51c, 0, .45, 0, king.m.head, 5);
  goal('ទៅ ជួប ស្ដេច ។', king);
  await reach([king.x, king.z], 5);
  await talk([['king', 'ដានីយ៉ែល ... ខ្ញុំ ស្រឡាញ់ អ្នក ។ ប៉ុន្តែ ច្បាប់ ជា ច្បាប់ ។'], ['king', 'សូម ឲ្យ ព្រះ របស់ អ្នក ជួយ អ្នក !']]);
  // into the den
  const f = $('#flash'); f.style.background = '#000'; await tween(.7, k => f.style.opacity = k);
  setSky(0x02041a, 0x0a1440, 0x0a1030, .2, true); stars.material.opacity = 1;
  const floorY = plainH(20, -24) - 3; player.x = 20; player.z = -22; yOverride = floorY;
  clampFn = (x, z) => { const dx = x - 20, dz = z + 24, d = Math.hypot(dx, dz); return d > 5 ? [20 + dx / d * 5, -24 + dz / d * 5] : [x, z]; };
  const lions = []; for (let i = 0; i < 4; i++) { const a = animal('lion'); const e = ent(a, 20 + Math.cos(i * 1.6) * 4, -24 + Math.sin(i * 1.6) * 4, { solid: 0, speed: 1.5, flyAbs: floorY }); tag('តោ', a.g); lions.push(e); }
  track = () => [[20, plainH(20, -24) + 6, -16], [20, floorY + 1, -24]];
  await tween(.7, k => f.style.opacity = 1 - k); f.style.background = '';
  for (const e of lions) walk(e, 20 + rnd(-1.5, 1.5), -22 + rnd(-1.5, 1.5), 1.5);
  tone([90, 70], 1.2, 'sawtooth', .08); cap('តោ'); await wait(1.5);
  const ang = ent(person({ glow: 0xffffff, scale: 1.2 }), 20, -25, { solid: 0, flyAbs: floorY + .3 }); tag('ទេវតា', ang.g); good();
  await say('angel', 'ព្រះ បាន ចាត់ ខ្ញុំ មក បិទ មាត់ តោ ។');
  for (const e of lions) { e.goal = null; await tween(.4, k => { e.m.b.position.y = -k * .4; e.m.legs.forEach(l => l.rotation.x = -k * 1.2); }); }
  cap('ដេក'); await wait(1.5);
  setSky(0xe0a060, 0xf8d8a0, 0xf0d0a0, .9); stars.material.opacity = 0; world.remove(ang.g); ents.splice(ents.indexOf(ang), 1);
  king.x = 20; king.z = -30.6; king.yaw = 0; king.talk = null;
  track = () => [[20, plainH(20, -24) + 7, -15.5], [20, floorY + 2.2, -26]];
  await say('king', 'ដានីយ៉ែល ! តើ ព្រះ របស់ អ្នក សង្គ្រោះ អ្នក បាន ទេ ?');
  await say('me', 'ព្រះ របស់ ខ្ញុំ បាន ចាត់ ទេវតា មក បិទ មាត់ តោ ។');
  goal('ឡើង ពី រូង ។', null);
  await act('ឡើង', [player.x, player.z], 99); yOverride = null; clampFn = null; track = null; player.x = 20; player.z = -15; good();
  await say('king', 'ចូរ គ្រប់ គ្នា កោតខ្លាច ព្រះ របស់ ដានីយ៉ែល !');
  await nextCh();
}

/* ---- The birth of Jesus (Luke 2), as a shepherd ---- */
nativity.build = () => {
  setSky(0x02041a, 0x0a1440, 0x0a1030, .25, true); stars.material.opacity = 1; scene.fog.near = 40; scene.fog.far = 170;
  H = (x, z) => 1 + Math.sin(x * .05) * 2 + Math.cos(z * .05) * 1.5; bound = 95; terrain(220, 50, () => 0x5a7a40);
  for (let i = 0; i < 10; i++) { const h = grp(); box(3, 2.2, 3, 0xc8b890, 0, 1.1, 0, h); place(h, -34 + (i % 5) * 6, -50 - Math.floor(i / 5) * 6, 0, 2); }
  const stable = grp(); for (const sx of [-1, 1]) box(.3, 3, .3, 0x6a4424, sx * 2.4, 1.5, 2, stable); box(5.4, .3, 5, 0x8a6a3a, 0, 3, 0, stable); box(5.4, 3, .3, 0x6a4424, 0, 1.5, -2.3, stable); place(stable, -14, -44); tag('ក្រោល', stable);
  const manger = grp(); box(1.4, .6, .8, 0x8a6a3a, 0, .5, 0, manger); box(1.2, .15, .6, 0xe8d060, 0, .82, 0, manger); sph(.2, 0xc08a60, -.2, .95, 0, manger, 5, 3); place(manger, -14, -44.2); tag('ស្នូក', manger);
  const star = mesh(new THREE.OctahedronGeometry(2.4, 0), MB(0xfff4c0, { fog: false })); star.position.set(-14, 60, -48); world.add(star); tag('ផ្កាយ', star);
};
async function nativity() {
  await leapIn('shepherd', 0, 20, Math.PI);
  for (let i = 0; i < 10; i++) { const a = animal('sheep'); const e = ent(a, rnd(-8, 8), 24 + rnd(-4, 4)); wander(e, 4); tag('ចៀម', a.g); }
  const pals = [0, 1].map(i => npc('shep2', { skin: 0xa07050, top: 0x6a5a3a, robe: true, cloth: 0xc8b898, beard: 0x3a2a1a }, -3 + i * 6, 22, Math.PI));
  const fireO = fire(); place(fireO, 0, 23);
  await arrive([]);
  godGlow(false);
  setSky(0x5a5aa0, 0xd0c8f0, 0x9090c0, .9); const ang = ent(person({ glow: 0xffffff, scale: 1.6 }), 0, 12, { solid: 0, fly: 3 }); ang.talk = 'angel'; ang.id = 'angel'; tag('ទេវតា', ang.g); burst(0, 6, 12, 0xffffff, 80, 4);
  await say('me', 'អូ ! ខ្ញុំ ខ្លាច ណាស់ !');
  await talk([['angel', 'កុំ ខ្លាច ! ខ្ញុំ នាំ ដំណឹង ល្អ មក ។'], ['angel', 'ថ្ងៃ នេះ ព្រះ សង្គ្រោះ បាន ប្រសូត នៅ ភូមិ បេថ្លេហិម ។'], ['angel', 'អ្នក នឹង ឃើញ ទារក ដេក នៅ ក្នុង ស្នូក ។']]);
  const choir = []; for (let i = 0; i < 14; i++) { const a = ent(person({ glow: 0xffffff }), rnd(-25, 25), rnd(-5, 15), { solid: 0, fly: rnd(6, 14) }); choir.push(a); } burst(0, 10, 5, 0xffffff, 100, 6);
  tone([523, 659, 784, 1046, 784, 1046], 2.4, 'triangle', .05);
  await say('angel', 'សិរីល្អ ដល់ ព្រះ នៅ ស្ថាន ដ៏ ខ្ពស់ ! សេចក្ដី សុខសាន្ត នៅ លើ ផែនដី !');
  await wait(1); for (const a of [ang, ...choir]) { world.remove(a.g); ents.splice(ents.indexOf(a), 1); } setSky(0x02041a, 0x0a1440, 0x0a1030, .25);
  await say('shep2', 'តោះ ! ទៅ បេថ្លេហិម !');
  pals.forEach(p => { p.follow = 'player'; p.gap = 2.5; p.talk = null; });
  goal('ទៅ តាម ផ្កាយ ។ រក ទារក ។', [-14, -40]);
  await reach([-14, -40], 4);
  const mary = npc('mary', { skin: 0xb07a50, top: 0x2f5fd0, robe: true, cloth: 0x2f5fd0, female: true }, -15.4, -43, 0.4); const jos = npc('joseph2', { skin: 0xa07050, top: 0x8a6a3a, robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, -12.6, -43.4, -0.4);
  await camTo([-14, H(-14, -38) + 2.6, -38], [-14, H(-14, -44) + .8, -44.2], 1.2);
  await say('mary', 'ឈ្មោះ គាត់ គឺ យេស៊ូ ។');
  camFree(); goal('ក្រាប ថ្វាយបង្គំ ។', [-14, -42]);
  await act('ក្រាប ថ្វាយបង្គំ', [-14, -42], 4); await tween(.6, k => kneel(hero, k)); good(); await wait(1.2); await tween(.4, k => kneel(hero, 1 - k));
  await say('me', 'សិរីល្អ ដល់ ព្រះ ! យើង បាន ឃើញ ព្រះ សង្គ្រោះ !');
  await nextCh();
}

/* ---- Jesus calms the storm (Mark 4), as Peter ---- */
calmStorm.build = () => { setSky(0x4a8ad8, 0xe0d8c8, 0xc8d0d8, 1, true); scene.fog.near = 40; scene.fog.far = 170; H = () => -6; bound = 200; terrain(200, 10, () => 0xb8a880); addWater(0, 0x2a6ab0); };
async function calmStorm() {
  const bt = grp(); box(3, 1, 9, plankM, 0, .1, 0, bt); cyl(.1, .1, 5, 0x5a3a20, 0, 3, 1, bt, 5); world.add(bt); tag('ទូក', bt);
  floors.push({ x0: -1.3, x1: 1.3, z0: -4.3, z1: 4.3, y: () => bt.position.y + .65 });
  await leapIn('peter', 0, 1, Math.PI);
  clampFn = (x, z) => [clamp(x, -1.1, 1.1), clamp(z, -4, 4)];
  const jesus = npc('jesus', HEROES.jesus, 0, -3.4, 0); jesus.flyAbs = null; tag('ព្រះយេស៊ូ', jesus.g);
  jesus.m.b.rotation.x = -Math.PI / 2; jesus.m.b.position.y = .5; jesus.talk = null;
  const disc = [0, 1, 2].map(i => npc('disciple', { skin: 0xa07050, top: [0x8a5a3a, 0x3a6a5a, 0x6a4a6a][i], robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, i % 2 ? .8 : -.8, 1.5 + i, Math.PI));
  await arrive([]);
  setSky(0x20242e, 0x40485a, 0x384050, .3); raining = 8; tone([70], 3, 'sawtooth', .07, .6); cap('ព្យុះ');
  const rockB = (dt, t) => { bt.rotation.z = Math.sin(t * 2.4) * .2; bt.position.y = Math.sin(t * 1.8) * .5; waterY = Math.sin(t * 1.4) * .5; }; anims.push(rockB);
  track = () => [[9, 6, 9], [0, 1, 0]];
  await talk([['disciple', 'ព្យុះ ធំ ណាស់ ! ទឹក ចូល ទូក !'], ['disciple', 'ព្រះយេស៊ូ ដេក លក់ !']]);
  track = null; goal('ដាស់ ព្រះយេស៊ូ ។', jesus);
  await act('ដាស់', jesus, 3);
  await say('me', 'លោកគ្រូ ! យើង ជិត ស្លាប់ ហើយ ! លោក មិន ខ្វល់ ទេ ឬ ?');
  await tween(.6, k => { jesus.m.b.rotation.x = -(1 - k) * Math.PI / 2; jesus.m.b.position.y = (1 - k) * .5; }); jesus.talk = 'jesus';
  await say('jesus', 'ស្ងប់ ! នៅ ស្ងៀម !');
  anims.splice(anims.indexOf(rockB), 1); bt.rotation.z = 0; bt.position.y = 0; waterY = 0; raining = 0; setSky(0x4a8ad8, 0xe0d8c8, 0xc8d0d8, 1); good();
  await say('jesus', 'ហេតុ អ្វី អ្នក ខ្លាច ? អ្នក មិន ទាន់ មាន ជំនឿ ទេ ឬ ?');
  await say('me', 'លោក នេះ ជា នរណា ? ខ្យល់ និង សមុទ្រ ក៏ ស្ដាប់ លោក !');
  await nextCh();
}

/* ---- Five loaves and two fish (John 6), as the boy ---- */
feeding.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = (x, z) => 2 + z * .06 + Math.sin(x * .06) * 1.2; bound = 90; terrain(220, 50, (x, z, y) => z < -60 ? 0x3a7ad0 : 0x7aa848);
};
async function feeding() {
  await leapIn('boy', 0, 14, Math.PI);
  const jesus = npc('jesus', HEROES.jesus, 0, -2, 0); tag('ព្រះយេស៊ូ', jesus.g);
  // a big crowd sitting in groups on the green grass
  const groups = []; for (let g = 0; g < 10; g++) { const gx = -28 + (g % 5) * 14, gz = 20 + Math.floor(g / 5) * 13, people = []; for (let i = 0; i < 6; i++) { const a2 = i / 6 * 6.28; const e = npc('people', { skin: [0xa07050, 0x8a5a3a, 0xb07a50][i % 3], top: [0x8a5a3a, 0x3a5a8a, 0x8a3a3a, 0x5a7a3a, 0xc8b080, 0x6a4a6a, 0x3a6a5a][i], robe: true, cloth: 0xe0d0b0, small: i >= 4 }, gx + Math.cos(a2) * 2.6, gz + Math.sin(a2) * 2.6, 0); e.talk = null; e.yaw = Math.atan2(gx - e.x, gz - e.z); kneel(e.m, .8, e); people.push(e); } groups.push({ x: gx, z: gz, people }); }
  const discs = [0, 1, 2, 3, 4, 5].map(i => { const e = npc('disciple', { skin: 0xa07050, top: [0x8a5a3a, 0x3a6a5a, 0x6a4a6a, 0x5a5a8a, 0x8a7a3a, 0x4a6a3a][i], robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, -5 + i * 2, 1.5, Math.PI); e.talk = null; return e; });
  const lunch = grp(); for (let i = 0; i < 5; i++) { const b = sph(.18, 0xd8a050, (i - 2) * .2, .15, 0, lunch, 5, 3); b.scale.y = .6; } for (const s2 of [-1, 1]) { const fsh = fish(0x8a9aa8).g; fsh.scale.setScalar(.35); fsh.position.set(s2 * .25, .35, .1); lunch.add(fsh); }
  carry(lunch); tag('នំបុ័ង', lunch);
  await arrive([]);
  discs[1].talk = 'disciple';
  await talk([['jesus', 'តើ យើង ទិញ នំបុ័ង ពី ណា ឲ្យ មនុស្ស ទាំងនេះ ហូប ?'], ['disciple', 'មនុស្ស ប្រហែល ប្រាំ ពាន់ នាក់ ! ប្រាក់ មិន គ្រប់ ទេ !'], ['disciple', 'មាន ក្មេង ម្នាក់ មាន នំបុ័ង ប្រាំ ដុំ និង ត្រី ពីរ ។']]);
  discs[1].talk = null;
  goal('ឲ្យ នំបុ័ង ទៅ ព្រះយេស៊ូ ។', jesus);
  await act('ឲ្យ នំបុ័ង', jesus, 3.5); drop(); const held = lunch.clone(); jesus.m.arms[1].add(held); held.position.set(0, -.7, .2);
  await say('me', 'នេះ ជា អាហារ របស់ ខ្ញុំ ។ យក ទៅ ។');
  await camTo([player.x + 3, player.y + 2.4, player.z + 3], [jesus.x, jesus.y + 1.6, jesus.z], 1);
  jesus.m.arms.forEach(a2 => a2.rotation.x = -2.6); burst(jesus.x, jesus.y + 2.6, jesus.z, 0xfff0a0, 40, 2);
  await say('jesus', 'អរ ព្រះគុណ ព្រះវរបិតា ។'); jesus.m.arms.forEach(a2 => a2.rotation.x = 0); jesus.m.arms[1].remove(held);
  // the food keeps coming: a pile of baskets of bread and fish at Jesus' feet that never runs out
  const loaf = (x, z, p) => { const b = sph(.2, 0xd8a050, x, H(x, z) + .14, z, p || world, 5, 3); b.scale.set(1.3, .6, 1); return b; };
  const fishOn = (x, z) => { const f2 = fish(0x8a9aa8).g; f2.scale.setScalar(.45); f2.rotation.z = Math.PI / 2; f2.position.set(x, H(x, z) + .15, z); world.add(f2); };
  const basket2 = () => { const g = grp(); cyl(.38, .3, .42, 0xb08a50, 0, 0, 0, g, 6); for (let i = 0; i < 5; i++) { const b = sph(.15, 0xd8a050, (i % 3 - 1) * .18, .24 + Math.floor(i / 3) * .1, (i % 2) * .12 - .06, g, 4, 2); b.scale.y = .6; } return g; };
  const pile = []; for (let i = 0; i < 10; i++) { const b2 = basket2(); place(b2, jesus.x + rnd(-1.8, 1.8), jesus.z + 1.4 + rnd(0, 1.4)); pile.push(b2); } tag('នំបុ័ង', pile[0]);
  const pileTick = (dt, t) => { if (Math.random() < .03) burst(jesus.x + rnd(-1.5, 1.5), H(jesus.x, jesus.z) + .8, jesus.z + 1.6 + rnd(0, 1), 0xfff0a0, 4, 1); }; anims.push(pileTick);
  camFree(); cap('នំបុ័ង');
  const served = new Set();
  const serve = gp => { if (served.has(gp)) return; served.add(gp); for (let i = 0; i < 10; i++) loaf(gp.x + rnd(-1.3, 1.3), gp.z + rnd(-1.3, 1.3)); for (let i = 0; i < 4; i++) fishOn(gp.x + rnd(-1, 1), gp.z + rnd(-1, 1)); for (const e of gp.people) burst(e.x, e.y + 1.2, e.z, 0xd8a050, 5, 1); };
  // the disciples carry baskets out to the groups on their own
  let runners = true; const order = groups.map((g, i) => i).sort(() => Math.random() - .5);
  discs.forEach((d, i) => { (async () => { await wait(i * .7); while (runners && ents.includes(d)) { const gi = order.find(k => !served.has(groups[k]) && !groups[k].claimed); if (gi == null) break; const gp = groups[gi]; gp.claimed = d; const bk = basket2(); bk.position.set(0, 2.2, .1); d.m.b.add(bk); d.m.arms.forEach(a2 => a2.rotation.x = -2.6); await walk(d, gp.x + 3.2, gp.z - 2.4, 4.5); d.m.b.remove(bk); serve(gp); await wait(.6); if (!runners) break; await walk(d, jesus.x + rnd(-3, 3), jesus.z + 3.2, 4.5); } })(); });
  let mine = 0;
  while (served.size < groups.length) {
    goal(`ចែក អាហារ ។ ( ${khNum(served.size)} / ${khNum(groups.length)} )`, [jesus.x, jesus.z + 2]);
    await act('យក អាហារ', [jesus.x, jesus.z + 2], 3.5); if (served.size >= groups.length) break; carry(basket2());
    const nextG = () => groups.filter(g => !served.has(g)).sort((a2, b2) => Math.hypot(a2.x - player.x, a2.z - player.z) - Math.hypot(b2.x - player.x, b2.z - player.z))[0];
    goal(`ចែក អាហារ ។ ( ${khNum(served.size)} / ${khNum(groups.length)} )`, () => { const n = nextG(); return n ? [n.x, n.z] : null; });
    const gp = await pick(groups.filter(g => !served.has(g)).map(g => ['ចែក អាហារ', [g.x, g.z], 4.6, g]));
    drop(); serve(gp); good(); mine++; toast(khNum(served.size), served.size <= 10 ? NUMW[served.size] : '');
  }
  runners = false; drop(); anims.splice(anims.indexOf(pileTick), 1);
  await camTo([0, 12, 52], [0, 0, 22], 1.6);
  toast('ប្រាំ ពាន់ នាក់', 'គ្រប់ គ្នា ហូប ឆ្អែត ។'); speaking = 'god'; await sayPhrase('មនុស្ស ប្រាំ ពាន់ នាក់ ហូប ឆ្អែត ។');
  camFree();
  await say('jesus', 'ប្រមូល សំណល់ កុំ ឲ្យ ខាត ។');
  const crumbs = []; for (let i = 0; i < 12; i++) { const gp = groups[i % groups.length], b2 = basket2(); place(b2, gp.x + rnd(-3, 3), gp.z + rnd(-3, 3)); crumbs.push(b2); } tag('សំណល់', crumbs[0]);
  for (let n = 1; n <= 12; n++) {
    goal(`ប្រមូល សំណល់ ។ ( ${khNum(n - 1)} / ${khNum(12)} )`, () => { const q = crumbs.filter(b2 => b2.visible).sort((a2, b2) => Math.hypot(a2.position.x - player.x, a2.position.z - player.z) - Math.hypot(b2.position.x - player.x, b2.position.z - player.z))[0]; return q ? [q.position.x, q.position.z] : null; });
    const b2 = await pick(crumbs.filter(q => q.visible).map(q => ['ប្រមូល', [q.position.x, q.position.z], 2.4, q])); b2.visible = false; tone([600 + n * 40], .12, 'triangle', .05); toast(khNum(n), n <= 10 ? NUMW[n] : n === 11 ? 'ដប់មួយ' : 'ដប់ពីរ');
  }
  await say('me', 'កន្ត្រក ដប់ពីរ ពេញ ! អស្ចារ្យ ណាស់ !');
  await nextCh();
}

/* ---- Through the roof (Mark 2): carry your friend to Jesus ---- */
roof.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 50; scene.fog.far = 200;
  H = plainH; bound = 90; terrain(220, 50, () => 0xd8c088);
  const y0 = plainH(0, -10);
  for (const [w, d, x, z] of [[10, .5, 0, -14.75], [.5, 10, -4.75, -10], [.5, 10, 4.75, -10], [3.6, .5, -3.2, -5.25], [3.6, .5, 3.2, -5.25]]) { box(w, 3.6, d, 0xd8c8a0, x, y0 + 1.8, z, world); }
  for (const [x, z, r] of [[0, -14.75, 5], [-4.75, -10, 5], [4.75, -10, 5]]) for (let i = -2; i <= 2; i++) solids.push(x === 0 ? { x: i * 2, z, r: 1.2 } : { x, z: z + i * 2, r: 1.2 });
  solids.push({ x: -3.2, z: -5.25, r: 1.5 }, { x: 3.2, z: -5.25, r: 1.5 });
  const tiles = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const t = box(1.96, .3, 1.96, 0xb89a70, i * 2, y0 + 3.75, -10 + j * 2, world); tiles.push(t); } world.userData.tiles = tiles;
  const stairs = grp(); for (let i = 0; i < 6; i++) box(1.2, .6, .8, 0xc8b890, 0, .3 + i * .6, -i * .8, stairs); place(stairs, 6.2, -6, 0, 0); stairs.rotation.y = 0; tag('ជណ្ដើរ', stairs);
};
async function roof() {
  await leapIn('friend', 3, 10, Math.PI);
  const y0 = plainH(0, -10), tiles = world.userData.tiles;
  const mat = grp(); box(1, .12, 2.2, 0xc8a870, 0, 0, 0, mat); const sick = person({ skin: 0xa07050, top: 0x8a8a7a, robe: true, beard: 0x3a2a1a }); sick.g.rotation.x = -Math.PI / 2; sick.g.position.set(0, .2, 1); mat.add(sick.g); place(mat, 1, 8, 0, 0, .6); tag('កន្ទេល', mat); tag('ខ្វិន', mat);
  const pals = [0, 1, 2].map(i => npc('friend2', { skin: 0xa07050, top: [0x5a6a3a, 0x3a5a8a, 0x8a5a3a][i], robe: true, cloth: 0xd8c8a0 }, -.5 + (i % 2) * 2.5, 6.8 + Math.floor(i / 2) * 2.4, Math.PI));
  const jesus = npc('jesus', HEROES.jesus, 0, -11, 0); tag('ព្រះយេស៊ូ', jesus.g);
  const crowd = []; for (let i = 0; i < 14; i++) { const e = npc('people', { skin: 0xa07050, top: [0x8a5a3a, 0x3a5a8a, 0x8a3a3a, 0x5a7a3a][i % 4], robe: true, cloth: 0xe0d0b0 }, -3 + (i % 5) * 1.5, -4 + Math.floor(i / 5) * 1.2, Math.PI); e.talk = null; crowd.push(e); }
  await arrive([]);
  await talk([['friend2', 'មិត្ត យើង *ខ្វិន ។ គាត់ ដើរ មិន រួច ទេ ។'], ['friend2', 'ព្រះយេស៊ូ នៅ ក្នុង ផ្ទះ នោះ ។ ព្រះអង្គ អាច ជួយ គាត់ !']]);
  goal('លី កន្ទេល ។', [1, 8]);
  await act('លី កន្ទេល', [1, 8], 3);
  world.remove(mat); mat.position.set(0, 2.4, .5); mat.rotation.y = Math.PI / 2; hero.b.add(mat); player.raise = true; pals.forEach(p2 => { p2.follow = 'player'; p2.gap = 1.6; p2.talk = null; });
  goal('ចូល ផ្ទះ ។', [0, -4]);
  await reach([0, -2], 3.5);
  await say('people', 'ពេញ ហើយ ! ចូល មិន បាន ទេ !');
  await say('me', 'តោះ ឡើង លើ ដំបូល ផ្ទះ !');
  goal('ឡើង ជណ្ដើរ ។', [6.2, -6]);
  await act('ឡើង', [6.2, -6], 3);
  floors.push({ x0: -5, x1: 5, z0: -15, z1: -5, y: () => y0 + 3.9 }); player.x = 3; player.z = -7; clampFn = (x, z) => [clamp(x, -4.4, 4.4), clamp(z, -14.4, -5.6)];
  pals.forEach((p2, i) => { p2.follow = null; p2.x = 4 - i; p2.z = -6.5; });
  for (let n = 1; n <= 3; n++) {
    goal(`ទម្លុះ ដំបូល ។ ( ${khNum(n - 1)} / ${khNum(3)} )`, [0, -10]);
    await act('ទម្លុះ ដំបូល', [0, -10], 3.2);
    const t = tiles[[12, 7, 17][n - 1]]; burst(t.position.x, t.position.y, t.position.z, 0xb89a70, 25, 2); t.visible = false; tone([200, 150], .2, 'square', .06);
  }
  goal('បញ្ចុះ កន្ទេល ។', [0, -10]);
  await act('បញ្ចុះ', [0, -10], 3.2);
  hero.b.remove(mat); player.raise = false; world.add(mat); mat.position.set(0, y0 + 3.7, -10); mat.rotation.y = 0;
  for (const t of tiles) t.visible = false;
  track = () => [[2, y0 + 9, -2], [0, y0 + .8, -10]];
  await tween(2.4, k => mat.position.y = y0 + 3.7 - k * 3.4); cap('បញ្ចុះ');
  jesus.yaw = Math.PI; await say('jesus', 'កូន អើយ ! បាប របស់ អ្នក បាន អត់ទោស ហើយ ។');
  await say('jesus', 'ក្រោក ឡើង ! យក កន្ទេល របស់ អ្នក ហើយ ដើរ ទៅ ផ្ទះ !');
  mat.remove(sick.g); const healed = npc('healed', { skin: 0xa07050, top: 0x8a8a7a, robe: true, beard: 0x3a2a1a }, 0, -10, 0); burst(0, y0 + 1, -10, 0xfff0a0, 50, 2.5); good();
  await say('healed', 'ខ្ញុំ ដើរ បាន ! សរសើរ ព្រះ !');
  world.remove(mat); const m2 = box(.4, .12, 1, 0xc8a870); healed.m.b.add(m2); m2.position.set(0, 2.2, 0); walk(healed, 0, 6, 2.5);
  await say('people', 'យើង មិន ដែល ឃើញ ការ ដូច្នេះ ទេ !');
  track = null;
  await nextCh();
}

/* ---- Legion and the pigs (Mark 5), as a disciple ---- */
legion.build = () => {
  setSky(0x5a7ab0, 0xd8c8b0, 0xc8c0b0, .85, true); scene.fog.near = 50; scene.fog.far = 200;
  H = (x, z) => z < -40 ? -6 + (z + 40) * .2 : 1 + Math.max(0, z) * .12 + Math.sin(x * .07) * 1.2; bound = 100; terrain(220, 50, (x, z, y) => y < 0 ? 0xc8b890 : y > 5 ? 0x8a8a60 : 0x7a9a48); addWater(0, 0x2a6ab0);
  for (let i = 0; i < 8; i++) { const t = rock(rnd(1, 1.6), 0x8a8478); place(t, -24 + rnd(-6, 6), -14 + rnd(-8, 8), 0, 1.4); tag('ផ្នូរ', t); }
};
async function legion() {
  const bt = grp(); box(3, 1, 8, plankM, 0, .1, 0, bt); place(bt, 2, -46); bt.position.y = 0; tag('ទូក', bt);
  await leapIn('andrew', 2, -36, Math.PI);
  const jesus = npc('jesus', HEROES.jesus, 0, -35, Math.PI); tag('ព្រះយេស៊ូ', jesus.g);
  const mp = person({ skin: 0x9a6a44, top: 0x9a6a44, bottom: 0x5a4a3a, hair: 0x1a1010, beard: 0x1a1010 }); const man = ent(mp, -22, -12, { speed: 6, id: 'legion' }); tag('មនុស្ស', mp.g);
  LOOK.legion = { key: 'legion', make: () => person({ skin: 0x9a6a44, top: 0x9a6a44, bottom: 0x5a4a3a, hair: 0x1a1010, beard: 0x1a1010 }) };
  for (const s2 of [-1, 1]) mesh(new THREE.TorusGeometry(.12, .04, 3, 6), 0x4a4a50, 0, -.55, 0, mp.arms[s2 < 0 ? 0 : 1]);
  const pigs = []; for (let i = 0; i < 22; i++) { const a = animal('pig'); const e = ent(a, 20 + rnd(-10, 10), 22 + rnd(-6, 6), { speed: 2 }); wander(e, 5); tag('ជ្រូក', a.g); pigs.push(e); }
  await arrive([]);
  const shout = (dt, t) => { if (Math.random() < .2) emit(man.x, man.y + 2, man.z, rnd(-1, 1), 1, rnd(-1, 1), 0x2a1a2a, .8, 0); }; anims.push(shout);
  walk(man, jesus.x - 3, jesus.z + 3, 6);
  await say('god', 'បុរស ម្នាក់ មាន អារក្ស ។ គាត់ រស់ នៅ ក្នុង ផ្នូរ ។ គ្មាន ច្រវាក់ ណា ចង គាត់ បាន ទេ ។');
  await wait(2); man.yaw = Math.atan2(jesus.x - man.x, jesus.z - man.z);
  await say('legion', 'យេស៊ូ ! តើ លោក ចង់ ធ្វើ អ្វី ចំពោះ យើង ?');
  await say('jesus', 'តើ ឯង ឈ្មោះ អ្វី ?');
  await say('legion', 'ឈ្មោះ យើង គឺ កងទ័ព ពីព្រោះ យើង ច្រើន ណាស់ ។ សូម ចាត់ យើង ទៅ ក្នុង ជ្រូក ។');
  await say('jesus', 'ចេញ ពី មនុស្ស នេះ ទៅ !');
  anims.splice(anims.indexOf(shout), 1);
  await camTo([player.x + 6, player.y + 8, player.z + 16], [20, H(20, 22) + 1, 20], 1.4);
  for (let i = 0; i < 60; i++) setTimeout(() => emit(man.x + (20 - man.x) * Math.random(), 4 + rnd(0, 4), man.z + (22 - man.z) * Math.random(), rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0x2a1a2a, 1.4, 0), i * 25);
  await wait(1.4); cap('ជ្រូក');
  for (const p of pigs) { p.stop = true; p.goal = null; walk(p, p.x * .3 + rnd(-4, 4), -48 + rnd(-4, 4), 9).then(() => { p.g.visible = false; burst(p.x, 0, p.z, 0xffffff, 6, 2); }); }
  await wait(4); camFree();
  toast('', 'ជ្រូក ប្រហែល ពីរ ពាន់ ធ្លាក់ ចូល សមុទ្រ ។'); speaking = 'god'; await sayPhrase('ជ្រូក ធ្លាក់ ចូល សមុទ្រ ។');
  goal('ឲ្យ សម្លៀកបំពាក់ ដល់ គាត់ ។', man);
  await act('ឲ្យ សម្លៀកបំពាក់', man, 3.5);
  world.remove(mp.g); man.m = person({ skin: 0x9a6a44, top: 0xe0d0b0, robe: true, cloth: 0xe0d0b0, hair: 0x1a1010, beard: 0x1a1010 }); man.g = man.m.g; world.add(man.g); good();
  await tween(.5, k => kneel(man.m, k * .8, man));
  await say('legion', 'ខ្ញុំ ជា ទៀត ហើយ ! សូម ឲ្យ ខ្ញុំ ទៅ ជាមួយ លោក ។');
  await say('jesus', 'ទៅ ផ្ទះ វិញ ។ ប្រាប់ គេ ពី ការ ដែល ព្រះ ធ្វើ សម្រាប់ អ្នក ។');
  await nextCh();
}

/* ---- Jesus sends out the Twelve (Mark 6, Luke 9-10) ---- */
sendTwelve.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = (x, z) => 1 + Math.sin(x * .04) * 1.6 + Math.cos(z * .05) * 1.2; bound = 100; terrain(220, 50, () => 0x8aa850);
  for (const [vx, vz] of [[-40, -40], [40, -45]]) for (let i = 0; i < 5; i++) { const h = grp(); box(3, 2.2, 3, 0xd8c8a0, 0, 1.1, 0, h); cone(2.6, 1.3, 0x8a6a3a, 0, 2.7, 0, h, 4).rotation.y = Math.PI / 4; place(h, vx + Math.cos(i * 1.25) * 9, vz + Math.sin(i * 1.25) * 9, 0, 2); }
};
async function sendTwelve() {
  await leapIn('andrew', 0, 10, Math.PI);
  const jesus = npc('jesus', HEROES.jesus, 0, 4, 0); tag('ព្រះយេស៊ូ', jesus.g);
  const partner = npc('disciple', { skin: 0xa07050, top: 0x8a5a3a, robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, 2, 11, Math.PI);
  const others = []; for (let i = 0; i < 10; i++) { const e = npc('disciple', { skin: 0xa07050, top: [0x3a6a5a, 0x6a4a6a, 0x5a5a8a, 0x8a7a3a, 0x4a6a3a][i % 5], robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, -8 + (i % 5) * 4, 13 + Math.floor(i / 5) * 2, Math.PI); e.talk = null; others.push(e); }
  await arrive([]);
  await talk([['jesus', 'ខ្ញុំ ឲ្យ អំណាច ដល់ អ្នក រាល់ គ្នា ដើម្បី ដេញ អារក្ស និង ព្យាបាល អ្នក ជំងឺ ។'], ['jesus', 'ចូរ ទៅ ពីរ ពីរ នាក់ ។ កុំ យក អ្វី តាម ខ្លួន ក្រៅ ពី ដំបង ។'], ['jesus', 'ចូរ ប្រកាស ថា នគរ ព្រះ មក ជិត ហើយ !']]);
  const staff = cyl(.035, .035, 2.2, 0x6a4424, 0, -.5, .05, hero.arms[1], 5); tag('ដំបង', staff);
  others.forEach((e, i) => walk(e, Math.cos(i) * 80, Math.sin(i * 1.7) * 80, 3)); partner.follow = 'player'; partner.gap = 2; partner.talk = null;
  // village one: they welcome you
  const sick = [0, 1, 2].map(i => { const p2 = person({ skin: 0xa07050, top: 0x8a8a7a, robe: true }); p2.g.rotation.x = -Math.PI / 2; const e = ent(p2, -40 + (i - 1) * 4, -36, { solid: 0, id: 'sickman' }); e.y = 0; return e; }); sick.forEach(e => tag('អ្នក ជំងឺ', e.g));
  const vil = [0, 1, 2, 3].map(i => { const e = npc('people', { skin: 0xa07050, top: [0x8a5a3a, 0x3a5a8a, 0x8a3a3a, 0x5a7a3a][i], robe: true, cloth: 0xe0d0b0, female: i % 2 === 1 }, -44 + i * 3, -42, 0); e.talk = null; return e; });
  goal('ទៅ ភូមិ ទី មួយ ។', [-40, -38]);
  await reach([-40, -34], 6);
  await act('ប្រកាស', [player.x, player.z], 99);
  await say('me', 'ចូរ ប្រែ ចិត្ត ! នគរ ព្រះ មក ជិត ហើយ !');
  for (let n = 0; n < sick.length; n++) {
    const e = sick[n]; goal(`ដាក់ ដៃ លើ អ្នក ជំងឺ ។ ( ${khNum(n)} / ${khNum(sick.length)} )`, e);
    await act('ដាក់ ដៃ', e, 2.8);
    burst(e.x, e.y + .5, e.z, 0xfff0a0, 40, 2); await tween(.6, k => { e.g.rotation.x = 0; e.m.g.rotation.x = -Math.PI / 2 * (1 - k); }); good(); toast(khNum(n + 1), 'ជា !');
  }
  await say('people', 'អរគុណ ព្រះ ! ពួក គាត់ ជា ហើយ !');
  // village two: they turn you away
  const rude = [0, 1, 2].map(i => npc('people', { skin: 0x9a6a44, top: 0x5a3a3a, robe: true, cloth: 0x2a2a2a }, 38 + i * 3, -40, Math.PI));
  goal('ទៅ ភូមិ ទី ពីរ ។', [40, -38]);
  await reach([40, -36], 6);
  await act('ប្រកាស', [player.x, player.z], 99);
  await say('me', 'ចូរ ប្រែ ចិត្ត ! នគរ ព្រះ មក ជិត ហើយ !');
  await say('people', 'ចេញ ទៅ ! យើង មិន ចង់ ស្ដាប់ អ្នក ទេ !');
  goal('រលាស់ ធូលី ពី ជើង ។', null);
  await act('រលាស់ ធូលី', [player.x, player.z], 99); for (let i = 0; i < 3; i++) burst(player.x, player.y + .2, player.z, 0xc8b088, 20, 2); cap('ធូលី');
  goal('ត្រឡប់ ទៅ ព្រះយេស៊ូ វិញ ។', jesus);
  others.forEach((e, i) => { e.x = Math.cos(i) * 30; e.z = Math.sin(i * 1.7) * 30; walk(e, jesus.x - 6 + (i % 5) * 3, jesus.z + 5 + Math.floor(i / 5) * 2, 6); });
  await reach([jesus.x, jesus.z], 5);
  await say('me', 'ព្រះអម្ចាស់ ! សូម្បី តែ អារក្ស ក៏ ស្ដាប់ យើង ក្នុង ព្រះនាម ព្រះអង្គ !');
  await say('jesus', 'ចូរ អរ សប្បាយ ពីព្រោះ ឈ្មោះ របស់ អ្នក បាន កត់ ទុក នៅ ស្ថានសួគ៌ ។');
  await nextCh();
}

/* ---- Peter walks on the water (Matthew 14) ---- */
walkWater.build = () => { setSky(0x05081a, 0x1a2450, 0x101830, .25, true); stars.material.opacity = .7; scene.fog.near = 30; scene.fog.far = 150; H = () => -6; bound = 200; terrain(200, 10, () => 0x6a6a58); addWater(0, 0x1a3a70); };
async function walkWater() {
  const bt = grp(); box(3, 1, 9, plankM, 0, .1, 0, bt); cyl(.1, .1, 5, 0x5a3a20, 0, 3, 1, bt, 5); world.add(bt); tag('ទូក', bt);
  floors.push({ x0: -1.3, x1: 1.3, z0: -4.3, z1: 4.3, y: () => bt.position.y + .65 });
  await leapIn('peter', 0, -2.5, Math.PI);
  clampFn = (x, z) => [clamp(x, -1.1, 1.1), clamp(z, -4, 4)];
  const disc = [0, 1, 2, 3].map(i => npc('disciple', { skin: 0xa07050, top: [0x8a5a3a, 0x3a6a5a, 0x6a4a6a, 0x5a5a8a][i], robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, i % 2 ? .8 : -.8, -1 + i * 1.4, Math.PI));
  const rockB = (dt, t) => { bt.rotation.z = Math.sin(t * 2) * .12; bt.position.y = Math.sin(t * 1.6) * .35; waterY = Math.sin(t * 1.2) * .3; }; anims.push(rockB);
  const wind = (dt) => { for (let i = 0; i < 4; i++) emit(player.x + rnd(-20, 20), rnd(.5, 4), player.z + rnd(-20, 20), 8, 0, rnd(-1, 1), 0x8090c0, .8, 0); }; anims.push(wind);
  await arrive([]);
  const jp = person(HEROES.jesus); const jesus = ent(jp, 0, -30, { solid: 0, flyAbs: 0, id: 'jesus' }); tag('ព្រះយេស៊ូ', jp.g);
  track = () => [[7, 5, 8], [0, 1, -8]];
  await say('disciple', 'ខ្យល់ បក់ ខ្លាំង ណាស់ ... យប់ ជ្រៅ ហើយ ។');
  await tween(3, k => { jesus.z = -30 + k * 20; jesus.flyAbs = waterY; });
  await say('disciple', 'មើល ! *ខ្មោច ! មនុស្ស ដើរ លើ ទឹក !');
  await say('jesus', 'ចូរ ក្លាហាន ឡើង ! គឺ ខ្ញុំ ទេ ! កុំ ខ្លាច ឡើយ !');
  track = null;
  await say('me', 'ព្រះអម្ចាស់ ! បើ ពិត ជា ព្រះអង្គ សូម បង្គាប់ ឲ្យ ខ្ញុំ ដើរ លើ ទឹក មក រក ព្រះអង្គ ។');
  await say('jesus', 'មក !');
  goal('ចុះ ពី ទូក ។', [0, -4]);
  await act('ចុះ ពី ទូក', [0, -4], 2.5);
  clampFn = null; floors.length = 0; player.z = -5.2; yOverride = 0; good(); cap('ដើរ');
  goal('ដើរ លើ ទឹក ទៅ រក ព្រះយេស៊ូ ។', jesus);
  await reach([0, -7.5], 1.8);
  // the wind: he looks at it, he starts to sink
  tone([90, 70], 1.6, 'sawtooth', .07); for (let i = 0; i < 4; i++) emit(player.x, 1, player.z, 6, 1, 0, 0xffffff, 1, 0);
  toast('ខ្យល់ !', 'ពេត្រុស ឃើញ ខ្យល់ ហើយ ខ្លាច ។'); speaking = 'god'; sayPhrase('ពេត្រុស ឃើញ ខ្យល់ ហើយ ខ្លាច ។');
  let sinking = true; const sink = (dt) => { if (!sinking) return false; yOverride = Math.max(-1.4, yOverride - dt * .35); if (Math.random() < .3) burst(player.x, .1, player.z, 0xffffff, 3, 1); }; anims.push(sink);
  goal('ស្រែក ហៅ ព្រះយេស៊ូ !', null);
  await act('ព្រះអម្ចាស់ ជួយ ខ្ញុំ ផង !', [player.x, player.z], 99);
  sinking = false; jesus.z = player.z - 1; burst(player.x, .5, player.z, 0xfff0a0, 40, 2); await tween(.6, k => yOverride = -1.4 * (1 - k)); good();
  await say('jesus', 'អ្នក មាន ជំនឿ តិច ណាស់ ! ហេតុ អ្វី អ្នក សង្ស័យ ?');
  // back into the boat; the wind stops
  anims.splice(anims.indexOf(wind), 1); anims.splice(anims.indexOf(rockB), 1); bt.rotation.z = 0; bt.position.y = 0; waterY = 0;
  floors.push({ x0: -1.3, x1: 1.3, z0: -4.3, z1: 4.3, y: () => bt.position.y + .65 }); yOverride = null; player.x = 0; player.z = -3; clampFn = (x, z) => [clamp(x, -1.1, 1.1), clamp(z, -4, 4)];
  jesus.flyAbs = null; jesus.x = .6; jesus.z = -3.6; jesus.yaw = 0;
  setSky(0x2a3a7a, 0xe0a070, 0x8a7080, .6); toast('', 'ខ្យល់ ឈប់ ។'); await sayPhrase('ខ្យល់ ឈប់ ។');
  for (const e of disc) kneel(e.m, 1, e);
  await say('disciple', 'ពិត មែន ! ព្រះអង្គ ជា ព្រះរាជបុត្រា របស់ ព្រះ !');
  await nextCh();
}

/* ---- Zacchaeus (Luke 19) ---- */
zacchaeus.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 50; scene.fog.far = 200;
  H = plainH; bound = 90; terrain(220, 50, (x, z) => Math.abs(x) < 4 ? 0xc8b088 : 0xb8a070);
  for (let i = 0; i < 12; i++) { const h = grp(); box(4, 3, 4, 0xd8c8a0, 0, 1.5, 0, h); place(h, (i % 2 ? 1 : -1) * 10, -40 + Math.floor(i / 2) * 12, 0, 2.8); }
  const syc = tree({ s: 1.6, leaf: 0x4a8a3a }); place(syc.g, 6, -4, 0, 1); tag('ដើមឈើ', syc.g); tag('ដើម ល្វា', syc.g);
};
async function zacchaeus() {
  await leapIn('zacchaeus', 0, 10, Math.PI);
  const crowd = []; for (let i = 0; i < 14; i++) { const e = npc('people', { skin: 0xa07050, top: [0x8a5a3a, 0x3a5a8a, 0x8a3a3a, 0x5a7a3a][i % 4], robe: true, cloth: 0xe0d0b0 }, -6 + (i % 7) * 2, 3 - Math.floor(i / 7) * 1.4, Math.PI); e.talk = null; crowd.push(e); }
  const jesus = npc('jesus', HEROES.jesus, 0, -30, 0); tag('ព្រះយេស៊ូ', jesus.g);
  await arrive([]);
  await talk([['people', 'ព្រះយេស៊ូ មក ! ... ឯង ជា អ្នក ទារ ពន្ធ ! ទៅ ឆ្ងាយ !'], ['people', 'សាខេ ទាប ណាស់ ។ គាត់ មើល មិន ឃើញ ទេ ! ហាហា !']]);
  goal('ឡើង ដើមឈើ ។', [6, -4]);
  await act('ឡើង ដើមឈើ', [6, -4], 3.5);
  player.x = 6; player.z = -3.4; yOverride = H(6, -4) + 3.4; clampFn = () => [6, -3.4]; good(); cap('ឡើង');
  await walk(jesus, 0, -5, 2.5); jesus.yaw = Math.atan2(6 - jesus.x, -3.4 - jesus.z);
  await camTo([2, H(0, 0) + 4, 4], [5, H(6, -4) + 4, -4], 1.2);
  await talk([['jesus', 'សាខេ ! ចុះ មក ឆាប់ !'], ['jesus', 'ថ្ងៃ នេះ ខ្ញុំ ត្រូវ ស្នាក់ នៅ ផ្ទះ អ្នក ។']]);
  camFree(); goal('ចុះ ពី ដើមឈើ ។', null);
  await act('ចុះ', [player.x, player.z], 99); yOverride = null; clampFn = null; player.x = 4.5; player.z = -2; cap('ចុះ');
  await say('people', 'គាត់ ទៅ ផ្ទះ មនុស្ស មាន បាប !');
  await say('me', 'ព្រះអម្ចាស់ ! ខ្ញុំ នឹង ឲ្យ ទ្រព្យ ពាក់ កណ្ដាល ដល់ អ្នក ក្រ ។ ខ្ញុំ នឹង សង វិញ បួន ដង ។');
  const poor = [0, 1, 2, 3].map(i => npc('people', { skin: 0x9a6a44, top: 0x6a6a5a, robe: true, cloth: 0x8a8a7a }, -8 + i * 5, 14, Math.PI));
  for (let n = 0; n < 4; n++) {
    goal(`ឲ្យ ប្រាក់ ដល់ អ្នក ក្រ ។ ( ${khNum(n)} / ${khNum(4)} )`, poor[n]);
    await act('ឲ្យ ប្រាក់', poor[n], 3.2); burst(poor[n].x, poor[n].y + 1.4, poor[n].z, 0xe0e0f0, 15, 1.5); good(); poor[n].talk = null; toast(khNum(n + 1), NUMW[n + 1]);
  }
  await say('jesus', 'ថ្ងៃ នេះ សេចក្ដី សង្គ្រោះ បាន មក ដល់ ផ្ទះ នេះ ។ កូន មនុស្ស មក រក មនុស្ស ដែល វង្វេង ។');
  await nextCh();
}

/* ---- The cross (Luke 23, Mark 15), as Simon of Cyrene ---- */
function crossMesh() { const g = new THREE.Group(); box(.32, 5.4, .32, 0x6a4424, 0, 2.7, 0, g); box(2.8, .3, .3, 0x6a4424, 0, 4.1, 0, g); return g; }
calvary.build = () => {
  setSky(0x4a7ab8, 0xe8d0b0, 0xd8c8b0, .95, true); scene.fog.near = 50; scene.fog.far = 200;
  H = (x, z) => 1 + Math.sin(x * .05) * .8 + 9 * Math.exp(-(x * x + (z + 50) ** 2) / 260); bound = 95; terrain(220, 50, (x, z, y) => y > 5 ? 0x9a8a68 : Math.abs(x) < 2.5 ? 0xc8b088 : 0xb8a878);
  box(80, 7, 3, M(0xd8c8a0), 0, 4.5, 40, world); for (let i = 0; i < 30; i++) solids.push({ x: -40 + i * 2.8, z: 40, r: 1.6 }); solids.splice(14, 2);
};
async function calvary() {
  await leapIn('simon', 0, 32, Math.PI);
  const jp = person(HEROES.jesus); const jesus = ent(jp, 0, 27, { yaw: Math.PI, solid: .6, id: 'jesus', speed: 1.1 }); tag('ព្រះយេស៊ូ', jp.g);
  const beam = crossMesh(); beam.scale.setScalar(.75); beam.position.set(.3, 1.5, -.4); beam.rotation.set(.9, 0, .5); jp.b.add(beam); tag('ឈើឆ្កាង', beam);
  const soldiers = [-1, 1, -1].map((s2, i) => { const e = npc('guard', { skin: 0x9a6a44, top: 0x8a2a2a, cloth: 0xc8a040, robe: true, sleeve: 0x8a2a2a }, s2 * 2, 25 - i * 2, Math.PI); e.talk = null; return e; });
  const women = [0, 1, 2].map(i => { const e = npc('women', { skin: 0xa07050, top: [0x3a3a5a, 0x5a3a3a, 0x3a5a5a][i], robe: true, cloth: 0xd8d0c0, female: true }, -6 + i * 1.6, 4, Math.PI / 2); e.talk = null; return e; });
  await arrive([]);
  await say('me', 'ខ្ញុំ មក ពី ស្រុក គីរេន ។ មាន រឿង អ្វី ?');
  walk(jesus, 0, 22, 1.1); await wait(2);
  await tween(.6, k => { jp.b.rotation.x = k * .9; jp.b.position.y = -k * .5; }); tone([160, 120], .5, 'triangle', .05);
  await say('guard', 'អ្នក ! លី ឈើឆ្កាង នេះ ! តាម គាត់ !');
  goal('លី ឈើឆ្កាង ។', jesus);
  await act('លី ឈើឆ្កាង', jesus, 3.5);
  jp.b.remove(beam); const mine = crossMesh(); mine.scale.setScalar(.7); mine.position.set(.25, 1.3, -.5); mine.rotation.set(.9, 0, .4); hero.b.add(mine); tag('ឈើឆ្កាង', mine);
  await tween(.5, k => { jp.b.rotation.x = .9 * (1 - k); jp.b.position.y = -.5 * (1 - k); }); cap('ឈើឆ្កាង');
  walk(jesus, 0, -44, 1.3); soldiers.forEach((e, i) => { e.follow = i ? soldiers[i - 1] : jesus; e.gap = 2.2; });
  goal('តាម ព្រះយេស៊ូ ទៅ ភ្នំ គាល់វ៉ារី ។', jesus);
  await reach([-3, 4], 6);
  women.forEach(w => w.yaw = Math.atan2(jesus.x - w.x, jesus.z - w.z));
  await say('women', 'ឱ ព្រះយេស៊ូ ! ... ( យំ )');
  await say('jesus', 'កូនស្រី ក្រុង យេរូសាឡិម អើយ ! កុំ យំ ពី ខ្ញុំ ឡើយ ។');
  goal('ឡើង ភ្នំ គាល់វ៉ារី ។', [0, -44]);
  await reach([0, -44], 5);
  goal('ដាក់ ឈើឆ្កាង ។', null);
  await act('ដាក់ ឈើឆ្កាង', [player.x, player.z], 99); hero.b.remove(mine);
  // three crosses on the hill
  const f = $('#flash'); f.style.background = '#000'; await tween(1, k => f.style.opacity = k);
  const top = H(0, -50); const crosses = [-5, 0, 5].map(x => { const c = crossMesh(); place(c, x, -51); return c; });
  ents.splice(ents.indexOf(jesus), 1); world.remove(jp.g);
  const onCross = x => { const p = person(x ? { skin: 0x9a6a44, top: 0x9a6a44, bottom: 0x7a6a50 } : { ...HEROES.jesus, top: HEROES.jesus.skin, sleeve: HEROES.jesus.skin, robe: false, bottom: 0xf0ece0 }); p.arms.forEach((a, i) => a.rotation.z = (i ? 1 : -1) * 1.45); p.g.position.set(x, H(x, -51) + 2.05, -50.75); world.add(p.g); return p; };
  const jc = onCross(0); onCross(-5); onCross(5); tag('ឈើឆ្កាង', crosses[1]);
  soldiers.forEach((e, i) => { e.follow = null; e.goal = null; e.x = -3 + i * 3; e.z = -46; e.yaw = Math.PI; });
  const centurion = npc('centurion', { skin: 0x9a6a44, top: 0x8a2a2a, cloth: 0xc8a040, robe: true, sleeve: 0x8a2a2a, scale: 1.05 }, 2, -45, Math.PI); cone(.12, .35, 0xd03a2a, 0, .42, 0, centurion.m.head, 4);
  women.forEach((w, i) => { w.x = -8 + i * 1.6; w.z = -36; w.yaw = Math.PI; });
  player.x = 4; player.z = -40; player.yaw = Math.PI;
  track = () => [[9, top + 2, -38], [0, top + 3.6, -51]];
  await tween(1, k => f.style.opacity = 1 - k); f.style.background = '';
  await say('jesus', 'ព្រះវរបិតា អើយ ! សូម អត់ទោស ឲ្យ គេ ផង ។ គេ មិន ដឹង ថា គេ ធ្វើ អ្វី ទេ ។');
  setSky(0x050508, 0x14141c, 0x0a0a10, .12); toast('', 'ងងឹត ពី ថ្ងៃ ត្រង់ ដល់ ម៉ោង បី ។'); speaking = 'god'; await sayPhrase('ងងឹត ពី ថ្ងៃ ត្រង់ ដល់ ម៉ោង បី ។');
  await say('jesus', 'ការ ទាំងអស់ បាន សម្រេច ហើយ ។');
  await tween(1.2, k => { jc.head.rotation.x = k * .6; });
  shake = 2.5; tone([50, 40], 2.5, 'sawtooth', .1); toast('', 'ផែនដី រញ្ជួយ ។ ថ្ម បែក ។'); await sayPhrase('ផែនដី រញ្ជួយ ។');
  track = () => [[centurion.x + 2.5, centurion.y + 2.2, centurion.z + 3], [centurion.x, centurion.y + 1.6, centurion.z]]; centurion.yaw = 0; await wait(1);
  await say('centurion', 'ពិត មែន ! បុរស នេះ ជា ព្រះរាជបុត្រា របស់ ព្រះ !');
  track = null;
  await say('me', 'ព្រះយេស៊ូ ស្លាប់ សម្រាប់ មនុស្ស គ្រប់ គ្នា ។');
  setSky(0x02041a, 0x0a1440, 0x0a1030, .2); stars.material.opacity = .8;
  toast('', 'បី ថ្ងៃ ក្រោយ ...'); speaking = 'god'; await sayPhrase('បី ថ្ងៃ ក្រោយ ...');
  await nextCh();
}

/* ---- The empty tomb (John 20), as Mary Magdalene ---- */
tomb.build = () => {
  setSky(0x2a2a5a, 0xc08070, 0x8a6a6a, .45, true); scene.fog.near = 40; scene.fog.far = 170;
  H = (x, z) => 1 + Math.sin(x * .05) * 1.2 + 7 * Math.exp(-((z + 26) ** 2) / 60) * (Math.abs(x) < 30 ? 1 : 0); bound = 90; terrain(220, 50, (x, z, y) => y > 4 ? 0x9a8a70 : 0x6a8a48);
  for (let i = 0; i < 14; i++) { const x = rnd(-60, 60), z = rnd(-10, 60); if (Math.hypot(x, z - 12) < 10) continue; place(tree({ s: rnd(.7, 1.1), leaf: 0x5a8a3a }).g, x, z, 0, .7); }
  const mouth = mesh(new THREE.CircleGeometry(1.6, 8), MB(0x0a0808), 0, H(0, -21) + 1.6, -20.6, world); tag('ផ្នូរ', mouth);
  const stone = mesh(new THREE.CylinderGeometry(2, 2, .6, 9), 0x8a8478, 3.6, H(3.6, -20) + 2, -20.2, world); stone.rotation.x = Math.PI / 2; stone.rotation.z = .2; tag('ថ្ម', stone);
};
async function tomb() {
  await leapIn('magdalene', 0, 12, Math.PI);
  await arrive([]);
  await say('me', 'ព្រឹក ព្រលឹម ... ខ្ញុំ ទៅ ផ្នូរ ព្រះយេស៊ូ ។');
  goal('ទៅ ផ្នូរ ។', [0, -17]);
  await reach([0, -17], 4.5);
  setSky(0x4a7ac0, 0xf0c8a0, 0xd8c0a8, .8);
  await say('me', 'មើល ! ថ្ម ត្រូវ គេ រំកិល ចេញ !');
  goal('មើល ក្នុង ផ្នូរ ។', [0, -19]);
  await act('មើល ក្នុង ផ្នូរ', [0, -19], 3);
  await camTo([0, H(0, -18) + 2, -16.5], [0, H(0, -21) + 1.4, -22], 1);
  const cloth = box(1.4, .15, .5, 0xf0ece0); cloth.position.set(-.4, H(0, -21) + .9, -21.4); world.add(cloth); tag('ក្រណាត់', cloth);
  const angels = [-1, 1].map(s2 => { const a = ent(person({ glow: 0xffffff }), s2 * 1.1, -21.6, { solid: 0, fly: .4 }); a.id = 'angel'; return a; });
  await talk([['angel', 'ស្ត្រី អើយ ! ហេតុ អ្វី អ្នក យំ ?']]);
  await say('me', 'គេ បាន យក ព្រះអម្ចាស់ ខ្ញុំ ចេញ ។ ខ្ញុំ មិន ដឹង ថា គេ ដាក់ ព្រះអង្គ នៅ ឯណា ទេ ។');
  camFree(); for (const a of angels) { world.remove(a.g); ents.splice(ents.indexOf(a), 1); }
  setSky(0x4a8ad8, 0xf8e0c0, 0xf0d8c0, 1);
  const jesus = npc('jesus', HEROES.jesus, 0, -8, Math.PI); tag('ព្រះយេស៊ូ', jesus.g);
  goal('ងាក ក្រោយ ។', jesus);
  await reach([0, -10], 3.2);
  await say('jesus', 'ស្ត្រី អើយ ! ហេតុ អ្វី អ្នក យំ ? អ្នក រក អ្នក ណា ?');
  await say('me', 'លោក ! បើ លោក បាន យក ព្រះអង្គ ទៅ សូម ប្រាប់ ខ្ញុំ ។');
  await say('jesus', 'ម៉ារី ។');
  await say('me', 'រ៉ាបូនី ! លោកគ្រូ !');
  burst(jesus.x, jesus.y + 1.6, jesus.z, 0xfff0a0, 60, 3); good();
  await say('jesus', 'ទៅ ប្រាប់ បងប្អូន ខ្ញុំ ។ ខ្ញុំ រស់ ឡើង វិញ ហើយ !');
  const disc = [0, 1, 2, 3].map(i => npc('disciple', { skin: 0xa07050, top: [0x8a5a3a, 0x3a6a5a, 0x6a4a6a, 0x5a5a8a][i], robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, -30 + i * 2, 40, 0));
  goal('រត់ ទៅ ប្រាប់ សិស្ស ។', [-27, 38]);
  await reach([-27, 38], 5);
  await say('me', 'ខ្ញុំ បាន ឃើញ ព្រះអម្ចាស់ ! ព្រះអង្គ មាន ព្រះជន្ម រស់ ឡើង វិញ !');
  await say('disciple', 'ព្រះអម្ចាស់ មាន ព្រះជន្ម រស់ ឡើង វិញ មែន !');
  await nextCh();
}

/* ---- Pentecost (Acts 2), as Peter ---- */
const cityH = (x, z) => 1 + Math.sin(x * .04) * .6 + Math.cos(z * .05) * .5;
function walls(cx, cz, w, d, h, doorW = 3, mat = M(0xd8c8a0)) { const y = cityH(cx, cz); const seg = (sw, sd, x, z) => { box(sw, h, sd, mat, x, y + h / 2, z, world); const n = Math.max(1, Math.round(Math.max(sw, sd) / 1.2)); for (let i = 0; i <= n; i++) solids.push({ x: x + (sw > sd ? (i / n - .5) * sw : 0), z: z + (sd > sw ? (i / n - .5) * sd : 0), r: .7 }); };
  seg(w, .4, cx, cz - d / 2); seg(.4, d, cx - w / 2, cz); seg(.4, d, cx + w / 2, cz); const side = (w - doorW) / 2; seg(side, .4, cx - doorW / 2 - side / 2, cz + d / 2); seg(side, .4, cx + doorW / 2 + side / 2, cz + d / 2); }
pentecost.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = cityH; bound = 95; terrain(220, 50, (x, z) => 0xd8c8a0);
  walls(0, -6, 12, 10, 3.2);
  for (let i = 0; i < 12; i++) { const h = grp(); box(5, rnd(3, 6), 5, 0xe0d0b0, 0, 2, 0, h); place(h, (i % 2 ? 1 : -1) * rnd(14, 30), -40 + Math.floor(i / 2) * 14, 0, 3.4); }
};
async function pentecost() {
  await leapIn('peter', 0, -4, Math.PI);
  const room = []; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; const e = npc('disciple', { skin: 0xa07050, top: [0x8a5a3a, 0x3a6a5a, 0x6a4a6a, 0x5a5a8a, 0x8a7a3a][i % 5], robe: true, cloth: 0xd8c8a0, beard: i % 3 ? 0x3a2a1a : undefined, female: i % 4 === 3 }, Math.cos(a) * 3.5, -6 + Math.sin(a) * 3, 0); e.talk = null; e.yaw = Math.atan2(-e.x, -6 - e.z); room.push(e); }
  await arrive([]);
  await say('me', 'យើង រង់ចាំ ដូច ព្រះយេស៊ូ បាន មាន ព្រះបន្ទូល ។');
  await camTo([0, cityH(0, -6) + 7, 2], [0, cityH(0, -6) + 1, -6], 1.2);
  tone([110, 165, 220], 3, 'sawtooth', .04, 2); const wind = () => { for (let i = 0; i < 12; i++) emit(rnd(-6, 6), cityH(0, -6) + rnd(.5, 3), -6 + rnd(-5, 5), rnd(-8, 8), rnd(-.5, 1), rnd(-8, 8), 0xe8f0ff, .6, 0); }; anims.push(wind);
  await say('god', 'ឮ សូរ ពី មេឃ ដូច ខ្យល់ បក់ យ៉ាង ខ្លាំង ។'); await wait(1.5); anims.splice(anims.indexOf(wind), 1);
  await say('god', 'អណ្ដាត ភ្លើង មក សណ្ឋិត លើ ម្នាក់ៗ ។');
  for (const e of [...room, { m: hero }]) { const fl = godFlame(.16); fl.position.y = .55; e.m.head.add(fl); } good(); await wait(1.5);
  await say('god', 'គ្រប់ គ្នា បាន ពេញ ដោយ ព្រះវិញ្ញាណ បរិសុទ្ធ ។');
  camFree();
  const NATIONS = [['ຂ້ອຍໄດ້ຍິນເຂົາເວົ້າພາສາຂອງຂ້ອຍ !', 'lo'], ['ฉันได้ยินเขาพูดภาษาของฉัน !', 'th'], ['Tôi nghe họ nói tiếng của tôi !', 'vi'], ['ကျွန်တော့်ဘာသာစကား ကြားရတယ် !', 'my']];
  const crowd = []; for (let i = 0; i < 16; i++) { const e = npc('nation', { skin: [0x9a6a44, 0x6a4a2a, 0xc08a60, 0x8a5a3a][i % 4], top: [0xc04040, 0x4060c0, 0xc0a040, 0x40a060][i % 4], robe: true, cloth: [0xffffff, 0xf2c51c, 0x2a2a2a, 0xc04040][i % 4] }, -12 + (i % 8) * 3.4, 10 + Math.floor(i / 8) * 4, Math.PI); e.talk = null; crowd.push(e); }
  goal('ចេញ ទៅ ក្រៅ ។', [0, 6]);
  await reach([0, 6], 4);
  await say('me', 'ព្រះជាម្ចាស់ ធ្វើ ឲ្យ យើង និយាយ ភាសា ផ្សេងៗ !');
  for (let n = 0; n < NATIONS.length; n++) { goal(`ស្ដាប់ ប្រជាជន ។ ( ${khNum(n)} / ${khNum(NATIONS.length)} )`, crowd[n * 4]); await act('ស្ដាប់', crowd[n * 4], 4); await say('nation', NATIONS[n][0], { lang: NATIONS[n][1] }); }
  await say('god', 'នៅ បាបិល ភាសា ច្របូកច្របល់ ។ ថ្ងៃ នេះ គ្រប់ គ្នា យល់ !');
  await say('me', 'ចូរ ប្រែ ចិត្ត ហើយ ទទួល ពិធី ជ្រមុជ ទឹក ក្នុង ព្រះនាម ព្រះយេស៊ូគ្រីស្ទ !');
  for (const e of crowd) burst(e.x, e.y + 1.5, e.z, 0x80c0ff, 8, 1.5); good();
  toast('បី ពាន់ នាក់'); speaking = 'god'; await sayPhrase('ថ្ងៃ នោះ មនុស្ស ប្រហែល បី ពាន់ នាក់ ជឿ ។');
  await nextCh();
}

/* ---- The lame man at the Beautiful Gate (Acts 3), as Peter ---- */
lame.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = cityH; bound = 90; terrain(220, 50, () => 0xe0d0b0);
  const g = grp(); for (const sx of [-1, 1]) box(1.6, 8, 1.6, 0xd8b060, sx * 3.2, 4, 0, g); box(8, 1.4, 1.8, 0xd8b060, 0, 8.4, 0, g); place(g, 0, -12); tag('ទ្វារ', g); solids.push({ x: -3.2, z: -12, r: 1.2 }, { x: 3.2, z: -12, r: 1.2 });
  box(30, 10, 14, 0xe8e0c8, 0, 5, -30, world);
};
async function lame() {
  await leapIn('peter', 0, 6, Math.PI);
  const john = npc('john', { skin: 0xb07a50, top: 0x5a8a6a, robe: true, hair: 0x3a2a1a }, 2, 7, Math.PI); john.follow = 'player'; john.gap = 2;
  const bp = person({ skin: 0x9a6a44, top: 0x7a7a6a, robe: true, beard: 0x4a3a2a }); const beggar = ent(bp, -2, -9, { yaw: Math.PI / 3, solid: .6, id: 'beggar' }); beggar.talk = 'beggar'; bp.b.position.y = -.55; bp.legs.forEach(l => l.rotation.x = -1.5); tag('អ្នក ពិការ', bp.g);
  await arrive([]);
  goal('ទៅ ព្រះវិហារ ។', [0, -10]);
  await reach([-1, -8], 4);
  await say('beggar', 'សូម ឲ្យ ប្រាក់ ខ្ញុំ ផង ! ខ្ញុំ ពិការ ជើង តាំង ពី កើត មក ។');
  await say('me', 'មើល មក យើង !');
  await say('beggar', 'លោក នឹង ឲ្យ ខ្ញុំ អ្វី ?');
  await say('me', 'ខ្ញុំ គ្មាន ប្រាក់ ទេ ។ ប៉ុន្តែ ក្នុង ព្រះនាម ព្រះយេស៊ូ ចូរ ក្រោក ឡើង ហើយ ដើរ !');
  goal('ចាប់ ដៃ គាត់ ។', beggar);
  await act('ចាប់ ដៃ', beggar, 3);
  burst(beggar.x, beggar.y + .8, beggar.z, 0xfff0a0, 40, 2); await tween(.8, k => { bp.b.position.y = -.55 * (1 - k); bp.legs.forEach(l => l.rotation.x = -1.5 * (1 - k)); }); good();
  await say('beggar', 'ជើង ខ្ញុំ ! ខ្ញុំ ដើរ បាន !');
  beggar.talk = null; walk(beggar, -2, -4, 3); await wait(1.2);
  const hop = (dt, t) => { beggar.fly = Math.abs(Math.sin(t * 6)) * .8; }; anims.push(hop);
  await say('beggar', 'ខ្ញុំ លោត ! សរសើរ ព្រះ ! សរសើរ ព្រះ !'); cap('លោត'); await wait(1.5); anims.splice(anims.indexOf(hop), 1); beggar.fly = 0;
  await nextCh();
}

/* ---- Philip and the Ethiopian (Acts 8) ---- */
desertRoad.build = () => {
  setSky(0x4a8ad8, 0xf0d8a8, 0xe8d0a8, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = (x, z) => 1 + Math.sin(x * .05) * 1.2 + Math.cos(z * .04); bound = 110; terrain(240, 50, (x) => Math.abs(x) < 3 ? 0xc8b088 : 0xd8c088);
  const pond = mesh(new THREE.CircleGeometry(4, 10).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3a7ad0, map: waterTex, transparent: true, opacity: .85 }), 8, 0, -60, world); pond.position.y = H(8, -60) + .1; tag('ទឹក', pond);
  for (let i = 0; i < 8; i++) place(tree({ palm: true, s: 1.2 }).g, 8 + Math.cos(i) * 7, -60 + Math.sin(i * 1.3) * 7, 0, .7);
};
function chariot() { const c = grp(); box(1.6, .9, 1.6, 0x8a5a2a, 0, 1, 0, c); for (const s2 of [-1, 1]) { const w = cyl(.6, .6, .12, 0x5a3a20, s2 * .9, .6, 0, c, 8); w.rotation.z = Math.PI / 2; } const hz = animal('horse').g; hz.position.set(0, 0, 2.6); c.add(hz); return c; }
async function desertRoad() {
  await leapIn('philip', 0, 40, Math.PI);
  await arrive([]);
  const ang = ent(person({ glow: 0xffffff, scale: 1.2 }), 2, 36, { solid: 0, fly: .5, id: 'angel' }); ang.talk = 'angel';
  await say('angel', 'ភីលីព ! ចូរ ទៅ តាម ផ្លូវ ខាងត្បូង ក្នុង វាល រហោស្ថាន ។');
  world.remove(ang.g); ents.splice(ents.indexOf(ang), 1);
  const ch = chariot(); const eu = person({ skin: 0x5a3a24, top: 0xf2c51c, robe: true, cloth: 0x2a8a4a }); eu.g.position.set(0, .7, -.2); eu.g.rotation.y = 0; ch.add(eu.g); const scroll = cyl(.08, .08, .6, 0xf0e0b0, 0, -.55, .25, eu.arms[1], 5); scroll.rotation.z = Math.PI / 2;
  const car = ent({ g: ch }, 0, 30, { solid: 0, speed: 1.6, id: 'eunuch' }); car.yaw = Math.PI; tag('រទេះ', ch); LOOK.eunuch = { key: 'eunuch', make: () => person({ skin: 0x5a3a24, top: 0xf2c51c, robe: true, cloth: 0x2a8a4a }) };
  walk(car, 0, -40, 1.6);
  await say('god', 'ព្រះវិញ្ញាណ មាន ព្រះបន្ទូល ៖ ចូរ ទៅ ជិត រទេះ នោះ ។');
  goal('រត់ ទៅ ជិត រទេះ ។', car);
  await reach(car, 4);
  car.goal = null; tone([800], .2, 'triangle', .05);
  await say('eunuch', 'ព្យាការី អេសាយ ៖ « គាត់ ដូច ជា កូនចៀម ដែល គេ នាំ ទៅ សម្លាប់ ... »');
  await say('me', 'តើ លោក យល់ អ្វី ដែល លោក អាន ទេ ?');
  await say('eunuch', 'ធ្វើ ម្ដេច ខ្ញុំ យល់ បាន បើ គ្មាន អ្នក ពន្យល់ ? ឡើង មក អង្គុយ ជាមួយ ខ្ញុំ ។');
  goal('ឡើង រទេះ ។', car);
  await act('ឡើង រទេះ', car, 3.5);
  goal(''); hero.g.visible = false; const me2 = person(HEROES.philip); me2.g.position.set(.5, .7, -.4); ch.add(me2.g); camYaw = Math.PI; track = () => [[car.x + 6, car.y + 4, car.z + 6], [car.x, car.y + 1.5, car.z]];
  walk(car, 6, -55, 2.2);
  await say('me', 'កូនចៀម នោះ គឺ ព្រះយេស៊ូ ។ ព្រះអង្គ ស្លាប់ ហើយ រស់ ឡើង វិញ ។');
  await new Promise(r => { const w2 = () => Math.hypot(car.x - 6, car.z + 55) < .5 ? r() : setTimeout(w2, 200); w2(); });
  await say('eunuch', 'មើល ! មាន ទឹក ! ហេតុ អ្វី ខ្ញុំ មិន ទទួល ពិធី ជ្រមុជ ទឹក ?');
  ch.remove(me2.g); hero.g.visible = true; track = null; player.x = car.x + 2; player.z = car.z - 1.5;
  const eunE = npc('eunuch', { skin: 0x5a3a24, top: 0xf2c51c, robe: true, cloth: 0x2a8a4a }, car.x + 3, car.z - 1, Math.PI); ch.remove(eu.g);
  eunE.follow = 'player'; eunE.gap = 1.6;
  goal('ចុះ ទៅ ក្នុង ទឹក ។', [8, -60]);
  await reach([8, -60], 3);
  await act('ជ្រមុជ ទឹក', eunE, 3.5);
  eunE.follow = null; await tween(.5, k => eunE.m.b.position.y = -k * 1.2); burst(eunE.x, eunE.y + .2, eunE.z, 0x80c0ff, 40, 2.5); await tween(.5, k => eunE.m.b.position.y = -(1 - k) * 1.2); good(); cap('ជ្រមុជ');
  await say('eunuch', 'ខ្ញុំ សប្បាយ ណាស់ !');
  burst(player.x, player.y + 1, player.z, 0xffffff, 60, 3); hero.g.visible = false; toast('', 'ព្រះវិញ្ញាណ នាំ ភីលីព ទៅ បាត់ ។'); speaking = 'god'; await sayPhrase('ព្រះវិញ្ញាណ នាំ ភីលីព ទៅ បាត់ ។');
  hero.g.visible = true;
  await nextCh();
}

/* ---- The road to Damascus (Acts 9), as Saul ---- */
damascus.build = () => {
  setSky(0x4a8ad8, 0xf0d8a8, 0xe8d0a8, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = (x, z) => 1 + Math.sin(x * .05) * 1.4 + Math.cos(z * .04) * 1.2; bound = 100; terrain(220, 50, (x) => Math.abs(x) < 3 ? 0xc8b088 : 0xb8a870);
  for (let i = 0; i < 10; i++) { const h = grp(); box(4, rnd(3, 5), 4, 0xe0d0b0, 0, 2, 0, h); place(h, (i % 2 ? 1 : -1) * rnd(8, 20), -70 - Math.floor(i / 2) * 6, 0, 2.8); }
};
async function damascus() {
  await leapIn('saul', 0, 30, Math.PI);
  const guards = [0, 1, 2].map(i => npc('guard', { skin: 0x9a6a44, top: 0x2a3a6a, cloth: 0x2a3a6a, robe: true }, -3 + i * 3, 33, Math.PI)); guards.forEach(g => { g.follow = 'player'; g.gap = 2.5 + rnd(0, 2); g.talk = null; });
  await arrive([]);
  await say('me', 'ខ្ញុំ នឹង ចាប់ អ្នក ដែល ជឿ ព្រះយេស៊ូ នៅ ក្រុង ដាម៉ាស ។');
  goal('ទៅ ក្រុង ដាម៉ាស ។', [0, -60]);
  await reach([0, 0], 8);
  const f = $('#flash'); f.style.background = '#fff'; await tween(.4, k => f.style.opacity = k); tone([1200, 900, 600], 1.2, 'triangle', .06);
  await tween(.6, k => { hero.b.rotation.x = -k * 1.5; hero.b.position.y = k * .3; }); guards.forEach(g => { g.follow = null; g.goal = null; });
  await tween(1, k => f.style.opacity = 1 - k * .3); cap('ពន្លឺ');
  await say('jesus', 'សូល ! សូល ! ហេតុ អ្វី អ្នក បៀតបៀន ខ្ញុំ ?');
  await say('me', 'លោក ម្ចាស់ ! លោក ជា នរណា ?');
  await say('jesus', 'ខ្ញុំ ជា យេស៊ូ ដែល អ្នក កំពុង បៀតបៀន ។ ក្រោក ឡើង ហើយ ចូល ទៅ ក្នុង ក្រុង ។');
  await tween(.6, k => f.style.opacity = .7 * (1 - k)); f.style.background = '';
  await tween(.6, k => { hero.b.rotation.x = -(1 - k) * 1.5; hero.b.position.y = (1 - k) * .3; });
  // blind for three days
  cv.style.filter = 'blur(7px) brightness(.45)';
  await say('me', 'ខ្ញុំ មើល មិន ឃើញ !');
  guards[0].talk = 'guard'; await say('guard', 'តាម ខ្ញុំ ! ខ្ញុំ នាំ លោក ទៅ ។');
  guards[0].goal = null; walk(guards[0], 0, -64, 2.6); guards[0].talk = null;
  goal('ដើរ តាម ទាហាន ។', guards[0]);
  await reach([0, -62], 4);
  for (let d = 1; d <= 3; d++) { toast(`ថ្ងៃ ទី ${khNum(d)}`); await sayPhrase(`ថ្ងៃ ទី ${NUMW[d]}`); }
  const ananias = npc('ananias', { skin: 0xa07050, top: 0x5a6a3a, robe: true, cloth: 0xe0d0b0, beard: 0x8a8a8a }, 3, -70, 0);
  await walk(ananias, player.x + 1.5, player.z - 1, 2.5);
  await say('ananias', 'បង សូល ! ព្រះយេស៊ូ ចាត់ ខ្ញុំ មក ឲ្យ បង មើល ឃើញ វិញ ។');
  burst(player.x, player.y + 1.8, player.z, 0xd8d8d0, 30, 1.5); cv.style.filter = ''; good(); cap('ឃើញ');
  await say('me', 'ខ្ញុំ មើល ឃើញ ហើយ ! ព្រះយេស៊ូ ជា ព្រះរាជបុត្រា របស់ ព្រះ !');
  await nextCh();
}

/* ---- Peter escapes from prison (Acts 12) ---- */
prison.build = () => {
  setSky(0x02041a, 0x0a1440, 0x0a1030, .25, true); stars.material.opacity = 1; scene.fog.near = 40; scene.fog.far = 170;
  H = cityH; bound = 90; terrain(220, 50, () => 0x8a8478);
  walls(0, 0, 16, 14, 3.4, 2.4, M(0x6a6a70));
  const gate = grp(); for (let i = 0; i <= 6; i++) cyl(.08, .08, 3.2, 0x3a3a40, i * .4, 1.6, 0, gate, 4); box(2.5, .12, .12, 0x3a3a40, 1.2, 3.1, 0, gate); place(gate, -1.2, 7); world.userData.gate = gate; solids.push({ x: -.6, z: 7, r: .8 }, { x: .6, z: 7, r: .8 });
  const iron = grp(); for (let i = -4; i <= 4; i++) cyl(.1, .1, 4, 0x3a3a40, i * .5, 2, 0, iron, 4); place(iron, 0, 24); world.userData.iron = iron; tag('ទ្វារ ដែក', iron);
  for (const sx of [-1, 1]) { box(30, 5, 1, M(0x6a6a70), sx * 17.5, cityH(0, 24) + 2.5, 24, world); for (let i = 0; i < 14; i++) solids.push({ x: sx * (2.6 + i * 2.2), z: 24, r: 1.1 }); }
  solids.push({ x: -1, z: 24, r: 1 }, { x: 1, z: 24, r: 1 });
  const house = grp(); box(6, 4, 6, 0xd8c8a0, 0, 2, 0, house); box(1.4, 2.4, .1, 0x6a4424, 0, 1.2, 3.02, house); place(house, 10, 48, Math.PI, 3.6); tag('ផ្ទះ', house);
};
async function prison() {
  await leapIn('peter', 0, -1, Math.PI);
  const sold = [-1, 1].map(s2 => { const e = npc('guard', { skin: 0x9a6a44, top: 0x8a2a2a, cloth: 0xc8a040, robe: true }, s2 * 1.2, -1.5, Math.PI); e.m.b.rotation.x = -1.3; e.m.b.position.y = .3; e.talk = null; return e; });
  const chains = [-1, 1].map(s2 => { const c = mesh(new THREE.TorusGeometry(.12, .04, 3, 6), 0x4a4a50, 0, -.55, 0, hero.arms[s2 < 0 ? 0 : 1]); return c; }); tag('ច្រវាក់', chains[0]);
  await arrive([]);
  hero.b.rotation.x = -1.4; hero.b.position.y = .3;
  await say('god', 'ពេត្រុស ដេក នៅ ចន្លោះ ទាហាន ពីរ នាក់ ជាប់ ច្រវាក់ ។');
  const ang = ent(person({ glow: 0xffffff, scale: 1.2 }), 1.5, 0, { solid: 0, fly: .3, id: 'angel' }); burst(1.5, 1.5, 0, 0xffffff, 60, 3); setSky(0x6a6aa0, 0xc0c0e0, 0x9090b0, .7);
  await say('angel', 'ក្រោក ឡើង ឆាប់ !');
  goal('ក្រោក ឡើង ។', null);
  await act('ក្រោក', [player.x, player.z], 99);
  hero.b.rotation.x = 0; hero.b.position.y = 0; chains.forEach(c => { c.parent.remove(c); }); for (const s2 of [-1, 1]) { const c = mesh(new THREE.TorusGeometry(.14, .04, 3, 6), 0x4a4a50); c.rotation.x = Math.PI / 2; place(c, player.x + s2 * .5, player.z, 0, 0, .05); } tone([400, 300, 200], .5, 'square', .05); cap('ច្រវាក់');
  await say('angel', 'ពាក់ ស្បែកជើង ហើយ តាម ខ្ញុំ ។');
  await act('ពាក់ ស្បែកជើង', [player.x, player.z], 99); good();
  const gate = world.userData.gate, iron = world.userData.iron;
  await tween(.8, k => gate.rotation.y = k * 1.6); solids.splice(solids.findIndex(q => q.z === 7 && q.x === -.6), 2);
  ang.follow = null; walk(ang, 0, 26, 3);
  goal('តាម ទេវតា ។', ang);
  await reach([0, 20], 4);
  await tween(1, k => iron.position.y = cityH(0, 24) + k * 4.5); solids.splice(solids.findIndex(q => q.z === 24 && q.x === -1), 2); toast('', 'ទ្វារ ដែក បើក ដោយ ខ្លួន ឯង ។'); await sayPhrase('ទ្វារ ដែក បើក ដោយ ខ្លួន ឯង ។');
  await reach([0, 28], 3); burst(ang.x, ang.y + 1, ang.z, 0xffffff, 50, 3); world.remove(ang.g); ents.splice(ents.indexOf(ang), 1);
  await say('me', 'ព្រះអម្ចាស់ បាន ចាត់ ទេវតា មក សង្គ្រោះ ខ្ញុំ ពិត មែន !');
  goal('ទៅ ផ្ទះ ម៉ារី ។ គោះ ទ្វារ ។', [10, 44.6]);
  await act('គោះ ទ្វារ', [10, 44.6], 2.6); tone([300, 300], .3, 'square', .06);
  await talk([['rhoda', 'អ្នក ណា ? ... ពេត្រុស !'], ['rhoda', 'អ្នក ទាំងអស់ គ្នា ! ពេត្រុស នៅ ក្រៅ ទ្វារ !'], ['people', 'រ៉ូដា ! អ្នក ឆ្កួត ហើយ !']]);
  goal('គោះ ទ្វារ ម្ដង ទៀត ។', [10, 44.6]);
  await act('គោះ ទ្វារ', [10, 44.6], 2.6); tone([300, 300, 300], .4, 'square', .06);
  const fam = [0, 1, 2].map(i => npc('people', { skin: 0xa07050, top: [0x8a5a3a, 0x3a5a8a, 0x8a3a3a][i], robe: true, cloth: 0xe0d0b0, female: i === 1 }, 9 + i, 47, 0));
  await say('people', 'ពេត្រុស ពិត មែន ! អស្ចារ្យ ណាស់ !');
  await nextCh();
}

/* ---- Paul and Silas, the earthquake at midnight (Acts 16), as Paul ---- */
philippi.build = () => {
  setSky(0x02041a, 0x0a1440, 0x0a1030, .25, true); stars.material.opacity = 1; scene.fog.near = 40; scene.fog.far = 170;
  H = cityH; bound = 90; terrain(220, 50, () => 0x8a8478);
  walls(0, 0, 16, 14, 3.4, 2.4, M(0x6a6a70));
  const door = grp(); box(2.4, 3.2, .2, plankM, 1.2, 1.6, 0, door); place(door, -1.2, 7); world.userData.door = door; solids.push({ x: -.6, z: 7, r: .8 }, { x: .6, z: 7, r: .8 });
};
async function philippi() {
  await leapIn('paul', -1.2, -1, Math.PI);
  const silas = npc('silas', { skin: 0xa07050, top: 0x5a6a3a, robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, 1.2, -1, Math.PI);
  const others = [0, 1, 2].map(i => { const e = npc('people', { skin: 0x9a6a44, top: 0x6a6a5a, robe: true }, -3 + i * 3, -3, Math.PI); e.talk = null; return e; });
  const stocks = box(3.4, .3, .4, 0x6a4424); place(stocks, 0, -.6, 0, 0, .35); tag('ច្រវាក់', stocks);
  await arrive([]);
  await say('silas', 'គេ វាយ យើង ហើយ ដាក់ យើង ក្នុង គុក ។');
  await say('me', 'កណ្ដាល អធ្រាត្រ ... តោះ ច្រៀង សរសើរ ព្រះ !');
  for (let n = 1; n <= 3; n++) { goal(`ច្រៀង ។ ( ${khNum(n - 1)} / ${khNum(3)} )`, null); await act('ច្រៀង', [player.x, player.z], 99); tone([[392, 494, 587], [440, 523, 659], [494, 587, 784]][n - 1], 1.2, 'triangle', .06); for (let i = 0; i < 6; i++) emit(player.x, player.y + 2, player.z, rnd(-1, 1), rnd(1, 2), rnd(-1, 1), 0xf2c51c, 1.5, 0); }
  cap('ច្រៀង');
  // the earthquake
  shake = 3; tone([50, 40], 2.5, 'sawtooth', .1); const quake = () => { if (shake > 0) for (let i = 0; i < 4; i++) emit(rnd(-4, 4), H(0, 0) + rnd(0, 3), rnd(-4, 4), 0, -2, 0, 0xa09080, .8, -4); }; anims.push(quake);
  await say('god', 'រញ្ជួយ ដី យ៉ាង ខ្លាំង !');
  await wait(1); anims.splice(anims.indexOf(quake), 1);
  const door = world.userData.door; await tween(.6, k => door.rotation.y = k * 1.6); solids.splice(solids.findIndex(q => q.z === 7 && q.x === -.6), 2); world.remove(stocks); burst(0, H(0, 0) + .5, -.6, 0x4a4a50, 20, 2); toast('', 'ទ្វារ បើក ។ ច្រវាក់ ដាច់ ។'); await sayPhrase('ទ្វារ គុក បើក ទាំងអស់ ។');
  const jailer = npc('jailer', { skin: 0x9a6a44, top: 0x8a2a2a, cloth: 0xc8a040, robe: true }, 0, 12, Math.PI); tag('ឆ្មាំ គុក', jailer.g);
  await walk(jailer, 0, 6, 3);
  await say('jailer', 'ទ្វារ បើក ! អ្នក ទោស រត់ អស់ ហើយ ! ខ្ញុំ នឹង ត្រូវ ស្លាប់ ...');
  await say('me', 'កុំ ធ្វើ បាប ខ្លួន ឯង ! យើង នៅ ទីនេះ ទាំងអស់ គ្នា !');
  await say('jailer', 'លោក អើយ ! តើ ខ្ញុំ ត្រូវ ធ្វើ អ្វី ដើម្បី បាន សង្គ្រោះ ?');
  await say('me', 'ចូរ ជឿ ព្រះអម្ចាស់ យេស៊ូ នោះ លោក នឹង បាន សង្គ្រោះ ទាំង គ្រួសារ លោក ។');
  burst(jailer.x, jailer.y + 1.5, jailer.z, 0xfff0a0, 40, 2); good();
  await say('jailer', 'ខ្ញុំ ជឿ ! មក ផ្ទះ ខ្ញុំ ។ ខ្ញុំ នឹង លាង របួស លោក ។');
  await nextCh();
}

/* ---- Shipwreck and the viper on Malta (Acts 27-28), as Paul ---- */
malta.build = () => { setSky(0x20242e, 0x40485a, 0x384050, .3, true); scene.fog.near = 40; scene.fog.far = 170; H = (x, z) => z < -40 ? 1.5 + Math.sin(x * .05) : -6 + Math.max(0, (-z - 20) * .35); bound = 120; terrain(240, 50, (x, z, y) => y > 0 ? 0xc8b890 : 0xa89a78); addWater(0, 0x2a5a90); };
async function malta() {
  const sh = ship(); world.add(sh); sh.position.set(0, -.2, 10); tag('សំពៅ', sh);
  floors.push({ x0: -1.8, x1: 1.8, z0: 4, z1: 16, y: () => sh.position.y + 1.25 });
  await leapIn('paul', 0, 10, Math.PI);
  clampFn = (x, z) => [clamp(x, -1.6, 1.6), clamp(z, 4.5, 15.5)];
  const crew = [0, 1, 2, 3].map(i => npc('sailor', { skin: 0x8a5a3a, top: 0x3a5a8a, hair: 0x1a1010 }, i % 2 ? 1 : -1, 6 + i * 2, Math.PI));
  raining = 8; const rock3 = (dt, t) => { sh.rotation.z = Math.sin(t * 2.2) * .16; sh.position.y = -.2 + Math.sin(t * 1.7) * .5; waterY = Math.sin(t * 1.3) * .4; }; anims.push(rock3);
  track = () => [[12, 8, 22], [0, 1, 8]];
  await arrive([]);
  await say('sailor', 'ព្យុះ ដប់បួន ថ្ងៃ ហើយ ! យើង នឹង ស្លាប់ ទាំងអស់ គ្នា !');
  await say('me', 'កុំ ខ្លាច ! គ្មាន អ្នក ណា ស្លាប់ ទេ ។ ទេវតា បាន ប្រាប់ ខ្ញុំ ។');
  // the reef
  tone([90, 50], 1.2, 'square', .1); shake = 1; await tween(1.5, k => { sh.position.z = 10 - k * 6; sh.rotation.x = k * .25; }); cap('បាក់');
  anims.splice(anims.indexOf(rock3), 1); floors.length = 0; clampFn = null; track = null;
  await say('me', 'លោត ចូល ទឹក ! ហែល ទៅ ច្រាំង !');
  player.x = 3; player.z = 2; yOverride = -.6; crew.forEach((c, i) => { c.flyAbs = -.6; walk(c, -6 + i * 4, -42, 3); });
  goal('ហែល ទៅ ច្រាំង ។', [0, -44]);
  await reach([0, -40], 6); yOverride = null; crew.forEach(c => c.flyAbs = null);
  raining = 0; setSky(0x6a7aa0, 0xc8c0b0, 0xb8b0a8, .7);
  toast('២៧៦ នាក់', 'គ្រប់ គ្នា រួច ជីវិត ។'); speaking = 'god'; await sayPhrase('គ្រប់ គ្នា រួច ជីវិត ។');
  const natives = [0, 1, 2].map(i => npc('native', { skin: 0x8a5a3a, top: 0xc8a050, robe: true }, -6 + i * 3, -52, 0));
  const bon = fire(); bon.scale.setScalar(1.4); place(bon, 0, -50); tag('ភ្លើង', bon);
  await say('native', 'ត្រជាក់ ណាស់ ! មក កម្ដៅ ខ្លួន ជិត ភ្លើង ។');
  const sticks = grp(); for (let i = 0; i < 5; i++) cyl(.05, .05, 1, 0x6a4424, (i - 2) * .12, .05, 0, sticks, 4).rotation.z = Math.PI / 2; place(sticks, 5, -48); tag('ឧស', sticks);
  goal('ប្រមូល ឧស ។', [5, -48]);
  await act('ប្រមូល ឧស', [5, -48], 3); world.remove(sticks);
  goal('ដាក់ ឧស ក្នុង ភ្លើង ។', [0, -50]);
  await act('ដាក់ ឧស', [0, -50], 3.2);
  const vip = snake(); vip.g.scale.setScalar(.45); hero.arms[1].add(vip.g); vip.g.position.set(0, -.6, .1); vip.g.rotation.x = Math.PI / 2; tag('ពស់', vip.g); tone([900, 300], .4, 'square', .07);
  await say('native', 'មើល ! ពស់ ចឹក ដៃ គាត់ ! គាត់ ច្បាស់ ជា ស្លាប់ !');
  goal('រលាស់ ពស់ ចូល ភ្លើង ។', [0, -50]);
  await act('រលាស់ ពស់', [0, -50], 3.5);
  hero.arms[1].remove(vip.g); burst(0, H(0, -50) + 1, -50, 0xff8020, 30, 2); good();
  await wait(1); await say('native', 'គាត់ មិន ស្លាប់ ! គាត់ ជា ព្រះ !');
  await say('me', 'ទេ ! ខ្ញុំ ជា មនុស្ស ។ ព្រះយេស៊ូ ការពារ ខ្ញុំ ។');
  toast('', 'ដំណឹង ល្អ ទៅ ដល់ ចុង ផែនដី ។'); speaking = 'god'; await sayPhrase('ដំណឹង ល្អ ទៅ ដល់ ចុង ផែនដី ។');
  await nextCh();
}

/* ---- The sower (Mark 4) ---- */
sower.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = (x, z) => 1 + Math.sin(x * .03) * .6 + Math.cos(z * .04) * .5; bound = 90;
  terrain(220, 50, (x, z) => z > 2 ? 0x8aa850 : x < -14 ? 0xc8b088 : x < -4 ? 0x9a9488 : x < 6 ? 0x7a8a48 : 0x6a4a2a);
  for (let i = 0; i < 14; i++) place(rock(rnd(.3, .7), 0x8a8478), -9 + rnd(-4, 4), -8 + rnd(-6, 6), rnd(0, 6), 0);
  for (let i = 0; i < 6; i++) { const t = bush(0x3a5a2a); t.scale.setScalar(.5); place(t, 1 + rnd(-3, 3), -8 + rnd(-6, 6)); }
};
async function sower() {
  await leapIn('farmer', -20, 8, Math.PI);
  const bag = grp(); cyl(.25, .3, .5, 0xc8a870, 0, 0, 0, bag, 5); bag.position.set(.3, .9, .2); hero.b.add(bag); tag('គ្រាប់ពូជ', bag);
  await arrive([]);
  await say('jesus', 'ស្ដាប់ ! មាន អ្នក សាប ព្រោះ ម្នាក់ ចេញ ទៅ សាប ព្រោះ គ្រាប់ពូជ ។');
  const seeds = (x0, w) => { for (let i = 0; i < 30; i++) emit(player.x, player.y + 1.6, player.z, rnd(-3, 3) + (x0 - player.x) * .3, rnd(1, 3), rnd(-4, -1), 0xe8d8a0, 1.2, -6); };
  const sprouts = (x0, w, c, h, n = 40) => { const out = []; for (let i = 0; i < n; i++) { const x = x0 + rnd(-w, w), z = -8 + rnd(-6, 6); const s2 = cone(.07, h, c, x, H(x, z) + h / 2, z, world, 3); s2.scale.y = .01; out.push(s2); } return out; };
  // the path: birds eat it
  goal('សាប ព្រោះ នៅ ផ្លូវ ។', [-18, -6]);
  await act('សាប ព្រោះ', [-18, -6], 4); seeds(-18);
  const birds = []; for (let i = 0; i < 6; i++) { const b = bird(0x3a3a3a); const e = ent(b, -18 + rnd(-20, 20), -30, { solid: 0, flyAbs: 8 }); birds.push(e); tag('បក្សី', b.g); tween(2, k => { e.z = -30 + k * 24; e.flyAbs = 8 - k * 7.6; }); }
  await wait(2.4); cap('បក្សី'); await sayPhrase('បក្សី ស៊ី គ្រាប់ពូជ អស់ ។'); birds.forEach(e => tween(2, k => { e.z = -6 - k * 30; e.flyAbs = .4 + k * 10; }));
  // the rocky ground: up fast, then dry
  goal('សាប ព្រោះ នៅ ដី ថ្ម ។', [-9, -6]);
  await act('សាប ព្រោះ', [-9, -6], 4); seeds(-9);
  const r = sprouts(-9, 4, 0x6aaa3a, .5); await tween(1.2, k => r.forEach(s2 => s2.scale.y = Math.max(.01, k)));
  setSky(0x4a8ad8, 0xf8e0a0, 0xf8e8c0, 1.1); await wait(.6); r.forEach(s2 => s2.material = M(0xc8b060)); await tween(1, k => r.forEach(s2 => { s2.rotation.z = k * 1.2; })); cap('ស្ងួត'); await sayPhrase('ថ្ងៃ ក្ដៅ ។ គ្មាន ឫស ។ វា ស្ងួត ។');
  // the thorns: choked
  goal('សាប ព្រោះ នៅ ក្នុង បន្លា ។', [1, -6]);
  await act('សាប ព្រោះ', [1, -6], 4); seeds(1);
  const th = sprouts(1, 4, 0x6aaa3a, .5); const thorns = []; for (let i = 0; i < 10; i++) { const t = bush(0x2a4a1a); t.scale.setScalar(.01); place(t, 1 + rnd(-4, 4), -8 + rnd(-6, 6)); thorns.push(t); }
  await tween(1.5, k => { th.forEach(s2 => s2.scale.y = Math.max(.01, k * .7)); thorns.forEach(t => t.scale.setScalar(Math.max(.01, k * 1.3))); }); cap('បន្លា'); await sayPhrase('បន្លា ធំ ឡើង ។ វា មិន មាន ផ្លែ ។');
  // the good soil
  goal('សាប ព្រោះ នៅ ដី ល្អ ។', [12, -6]);
  await act('សាប ព្រោះ', [12, -6], 4); seeds(12);
  const good3 = [[9, .9, 30], [12, 1.3, 60], [15, 1.8, 100]].map(([x, h, n]) => { const out = []; for (let i = 0; i < 18; i++) { const xx = x + rnd(-1.3, 1.3), zz = -8 + rnd(-5, 5); const s2 = cone(.08, h, 0xd8c040, xx, H(xx, zz) + h / 2, zz, world, 3); s2.scale.y = .01; out.push(s2); } return { out, n, x }; });
  for (const g3 of good3) { await tween(1, k => g3.out.forEach(s2 => s2.scale.y = Math.max(.01, k))); toast(khNum(g3.n), NUMWORD(g3.n)); await wait(.9); }
  good(); tag('ដី ល្អ', good3[2].out[0]);
  await say('jesus', 'គ្រាប់ពូជ គឺ ព្រះបន្ទូល ។ ដី ល្អ គឺ មនុស្ស ដែល ស្ដាប់ ហើយ ទទួល ។');
  await say('me', 'ខ្ញុំ ចង់ ធ្វើ ជា ដី ល្អ ។');
  await nextCh();
}

/* ---- The good Samaritan (Luke 10) ---- */
samaritan.build = () => {
  setSky(0x4a8ad8, 0xf0d8a8, 0xe8d0a8, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = (x, z) => 1 + Math.sin(x * .05) * 2 + Math.cos(z * .04) * 1.4; bound = 110; terrain(240, 50, (x) => Math.abs(x) < 3 ? 0xc8b088 : 0xb8a070);
  for (let i = 0; i < 24; i++) { const x = rnd(-60, 60), z = rnd(-80, 80); if (Math.abs(x) < 8) continue; place(rock(rnd(.6, 1.8), 0x9a8a70), x, z, rnd(0, 6), 1); }
  const inn = grp(); box(7, 4, 6, 0xd8c8a0, 0, 2, 0, inn); box(1.4, 2.4, .1, 0x6a4424, 0, 1.2, 3.02, inn); place(inn, 7, -60, -Math.PI / 2, 4); tag('ផ្ទះ សំណាក់', inn);
};
async function samaritan() {
  await leapIn('samaritan', 0, 40, Math.PI);
  const donkey = animal('horse'); donkey.g.scale.setScalar(.8); donkey.g.traverse(o => { if (o.material && o.material.color && o.material.color.getHex() === 0x6a4a30) o.material = M(0x8a8a80); }); const dk = ent(donkey, 2, 42, { speed: 3 }); dk.follow = 'player'; dk.gap = 2.8; tag('លា', donkey.g);
  const vp = person({ skin: 0xa07050, top: 0xa07050, bottom: 0x6a5a40, hair: 0x2a1a10 }); vp.g.rotation.z = Math.PI / 2; const victim = ent(vp, 1.2, 8, { solid: 0, id: 'victim', fly: .25 }); tag('របួស', vp.g);
  LOOK.victim = { key: 'victim', make: () => person({ skin: 0xa07050, top: 0xa07050, bottom: 0x6a5a40, hair: 0x2a1a10 }) };
  await arrive([]);
  await say('jesus', 'បុរស ម្នាក់ ធ្វើ ដំណើរ ពី ក្រុង យេរូសាឡិម ទៅ ក្រុង យេរីខូ ។ ចោរ វាយ គាត់ ។');
  const priest = npc('priest', { skin: 0xa07050, top: 0xf0ece0, robe: true, cloth: 0x2f5fd0, beard: 0x5a4a3a }, 0, -16, 0); priest.talk = null;
  await camTo([8, H(0, 6) + 4, 14], [1, H(1, 8) + 1, 4], 1.2);
  await walk(priest, -6, 4, 3); await say('priest', 'មិន មែន រឿង ខ្ញុំ ទេ ...'); walk(priest, -2, 30, 3);
  const levite = npc('priest', { skin: 0xa07050, top: 0xd8d0b0, robe: true, cloth: 0x8a6a3a, beard: 0x3a2a1a }, 0, -20, 0); levite.talk = null;
  await walk(levite, -6, 4, 3); await say('priest', 'ខ្ញុំ ប្រញាប់ ណាស់ ...'); walk(levite, -2, 30, 3);
  camFree();
  goal('ជួយ បុរស ដែល មាន របួស ។', victim);
  await reach(victim, 3);
  await say('me', 'អាណិត គាត់ ណាស់ ! ខ្ញុំ នឹង ជួយ គាត់ ។');
  goal('រុំ របួស ។', victim);
  await act('រុំ របួស', victim, 3); for (const y of [.3, .55]) { const b2 = mesh(new THREE.TorusGeometry(.3, .06, 3, 6), 0xf0ece0, 0, 1 + y, 0, vp.b); b2.rotation.x = Math.PI / 2; } burst(victim.x, victim.y + .5, victim.z, 0xf0e0a0, 20, 1.5); cap('ប្រេង'); await sayPhrase('ចាក់ ប្រេង និង ស្រា ។');
  goal('ដាក់ គាត់ លើ លា ។', dk);
  await act('ដាក់ លើ លា', dk, 3.5); world.remove(vp.g); ents.splice(ents.indexOf(victim), 1); vp.g.rotation.z = 0; vp.g.rotation.x = -1.2; vp.g.position.set(0, 1.1, 0); vp.g.scale.setScalar(1.2); donkey.b.add(vp.g); good();
  goal('នាំ គាត់ ទៅ ផ្ទះ សំណាក់ ។', [5, -60]);
  await reach([4, -58], 5);
  const host = npc('host', { skin: 0x9a6a44, top: 0x8a6a3a, robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, 3, -57, Math.PI);
  for (let n = 1; n <= 2; n++) { goal(`ឲ្យ ប្រាក់ ដល់ ម្ចាស់ ផ្ទះ ។ ( ${khNum(n - 1)} / ${khNum(2)} )`, host); await act('ឲ្យ ប្រាក់', host, 3); burst(host.x, host.y + 1.4, host.z, 0xe0e0f0, 10, 1.2); toast(khNum(n), NUMW[n]); }
  await say('me', 'សូម មើល ថែ គាត់ ។ បើ អស់ ថ្លៃ ច្រើន ជាង នេះ ខ្ញុំ នឹង សង វិញ ។');
  await say('jesus', 'តើ អ្នក ណា ជា អ្នក ជិតខាង របស់ បុរស នោះ ? ... ចូរ ទៅ ធ្វើ ដូច្នោះ ដែរ ។');
  await nextCh();
}

/* ---- The lost sheep (Luke 15) ---- */
lostSheep.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 50; scene.fog.far = 200;
  H = (x, z) => 2 + Math.sin(x * .06) * 3 + Math.cos(z * .05) * 2.4 + Math.sin((x + z) * .11); bound = 100; terrain(220, 50, (x, z, y) => y > 5 ? 0x8a9a50 : 0x7aa040);
  for (let i = 0; i < 30; i++) { const x = rnd(-80, 80), z = rnd(-80, 80); if (Math.hypot(x, z) < 16) continue; place(rock(rnd(.8, 2.2), 0x9a8a70), x, z, rnd(0, 6), 1.8); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cyl(.07, .07, 1, 0x6a4424, Math.cos(a) * 9, H(Math.cos(a) * 9, Math.sin(a) * 9) + .5, Math.sin(a) * 9, world, 4); }
};
async function lostSheep() {
  await leapIn('shepherd', 0, 12, Math.PI);
  const flock = []; for (let i = 0; i < 30; i++) { const a = animal('sheep'); const e = ent(a, rnd(-6, 6), rnd(-6, 6), { speed: 1 }); wander(e, 2); tag('ចៀម', a.g); flock.push(e); }
  await arrive([]);
  await say('jesus', 'បុរស ម្នាក់ មាន ចៀម មួយ រយ ។');
  goal('រាប់ ចៀម ។', [0, 9]);
  await act('រាប់ ចៀម', [0, 9], 4);
  for (const n of [10, 20, 30, 40, 50, 60, 70, 80, 90]) { toast(khNum(n), NUMWORD(n)); speaking = 'me'; await playWord(NUMWORD(n)); await wait(.15); }
  toast('៩៩', 'កៅសិប ប្រាំបួន'); await sayPhrase('កៅសិប ប្រាំបួន ...');
  await say('me', 'ចៀម មួយ បាត់ ! ខ្ញុំ ត្រូវ ទៅ រក វា ។');
  const lost = animal('sheep'); const L = ent(lost, -62, -48, { solid: 0 }); tag('ចៀម', lost.g); L.tick = (dt, t) => { if (Math.random() < .01 && Math.hypot(player.x - L.x, player.z - L.z) < 40) { tone([700, 640], .3, 'triangle', .04); burst(L.x, L.y + 1.2, L.z, 0xffffff, 6, 1); } };
  goal('រក ចៀម ដែល វង្វេង ។', null);
  setTimeout(() => { if (ents.includes(L) && !L.found) goal('រក ចៀម ដែល វង្វេង ។', L); }, 25000);
  await reach(L, 4); L.found = true;
  goal('លី ចៀម ។', L);
  await act('លី ចៀម', L, 3); world.remove(lost.g); ents.splice(ents.indexOf(L), 1); const carried = animal('sheep').g; carried.scale.setScalar(.7); carried.rotation.y = Math.PI / 2; carried.position.set(0, 1.9, -.1); hero.b.add(carried); player.raise = true; good(); cap('ចៀម');
  goal('នាំ ចៀម ត្រឡប់ មក វិញ ។', [0, 9]);
  const pals = [0, 1, 2].map(i => npc('shep2', { skin: 0xa07050, top: [0x6a5a3a, 0x5a6a3a, 0x8a6a4a][i], robe: true, cloth: 0xc8b898, beard: 0x3a2a1a }, -4 + i * 4, 13, Math.PI));
  await reach([0, 10], 4);
  hero.b.remove(carried); player.raise = false; const back = animal('sheep'); const B = ent(back, player.x + 1, player.z - 1); wander(B, 2); toast('មួយ រយ', 'ចៀម មួយ រយ ។');
  await say('me', 'ចូរ អរ សប្បាយ ជាមួយ ខ្ញុំ ! ខ្ញុំ រក ចៀម ដែល បាត់ ឃើញ ហើយ !');
  await say('jesus', 'នៅ ស្ថានសួគ៌ មាន អំណរ ចំពោះ មនុស្ស បាប ម្នាក់ ដែល ប្រែ ចិត្ត ។');
  await nextCh();
}

/* ---- The prodigal son (Luke 15) ---- */
prodigal.build = () => {
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1, true); scene.fog.near = 55; scene.fog.far = 210;
  H = (x, z) => 1 + Math.sin(x * .04) * 1.4 + Math.cos(z * .05) * 1.2; bound = 120; terrain(260, 56, (x) => x > 50 ? 0xc8b078 : 0x8aa850);
  const home = grp(); box(7, 4, 6, 0xd8c8a0, 0, 2, 0, home); box(1.4, 2.4, .1, 0x6a4424, 0, 1.2, 3.02, home); place(home, -40, -6, 0, 4); tag('ផ្ទះ', home);
  for (let i = 0; i < 8; i++) { const h = grp(); box(5, rnd(3, 6), 5, 0xe0c890, 0, 2, 0, h); place(h, 80 + (i % 4) * 8, -16 + Math.floor(i / 4) * 30, 0, 3.4); }
  const pen = grp(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; cyl(.07, .07, 1, 0x6a4424, Math.cos(a) * 4, .5, Math.sin(a) * 4, pen, 4); } place(pen, 70, 30);
};
async function prodigal() {
  await leapIn('son', -40, 0, 0);
  const dad = npc('dad', { skin: 0xa07050, top: 0x5a3a6a, robe: true, cloth: 0xe8e0c8, beard: 0xd8d8d8 }, -37, 1, -Math.PI / 2); tag('ឪពុក', dad.g);
  const bro = npc('bro', { skin: 0xa07050, top: 0x6a5a3a, robe: true, cloth: 0xd8c8a0, beard: 0x3a2a1a }, -46, 6, 0);
  await arrive([]);
  await say('me', 'ឪពុក ! សូម ឲ្យ មរតក ចំណែក របស់ ខ្ញុំ ឥឡូវ ។');
  const coins = grp(); for (let i = 0; i < 6; i++) cyl(.14, .14, .05, 0xd8d8e0, (i % 3 - 1) * .2, Math.floor(i / 3) * .06, 0, coins, 6); carry(coins); good(); cap('ប្រាក់');
  goal('ធ្វើ ដំណើរ ទៅ ស្រុក ឆ្ងាយ ។', [80, 0]);
  await reach([78, 0], 8);
  const party = [0, 1, 2, 3].map(i => npc('people', { skin: 0x9a6a44, top: [0xc04040, 0xc0a040, 0x4060c0, 0xa040a0][i], robe: true, cloth: 0xf2c51c }, 80 + Math.cos(i * 1.6) * 3, 3 + Math.sin(i * 1.6) * 3, 0));
  party.forEach((e, i) => { e.talk = null; e.tick = (dt, t) => { e.m.arms.forEach(a2 => a2.rotation.x = -2 + Math.sin(t * 8 + i) * .6); }; });
  goal('ចាយ ប្រាក់ ។', [80, 3]);
  await act('ចាយ ប្រាក់', [80, 3], 5); tone([523, 659, 784, 659], 1.2, 'square', .04); drop(); for (let i = 0; i < 3; i++) burst(80, H(80, 3) + 1.5, 3, 0xe0e0f0, 20, 3); cap('ចាយ');
  toast('', 'គាត់ ចាយ ប្រាក់ អស់ ។ មាន ទុរ្ភិក្ស ។'); speaking = 'god'; await sayPhrase('គាត់ ចាយ ប្រាក់ អស់ ។ មាន ទុរ្ភិក្ស ។');
  for (const e of party) { e.tick = null; walk(e, 120, e.z * 4, 4); }
  setSky(0x8a8a7a, 0xd8c8a0, 0xc8b898, .8);
  const pigs = []; for (let i = 0; i < 6; i++) { const a = animal('pig'); pigs.push(ent(a, 70 + rnd(-2.5, 2.5), 30 + rnd(-2.5, 2.5), { speed: 1 })); tag('ជ្រូក', a.g); }
  goal('ឲ្យ ចំណី ជ្រូក ។', [70, 26]);
  await act('ឲ្យ ចំណី ជ្រូក', [70, 26], 4); for (const p of pigs) burst(p.x, p.y + .5, p.z, 0x8a7a3a, 8, 1);
  await say('me', 'ខ្ញុំ ឃ្លាន ណាស់ ... អ្នក បម្រើ ឪពុក ខ្ញុំ មាន អាហារ ច្រើន !');
  await say('me', 'ខ្ញុំ នឹង ត្រឡប់ ទៅ រក ឪពុក ។ ខ្ញុំ នឹង និយាយ ថា ៖ ខ្ញុំ បាន ធ្វើ បាប ។');
  setSky(0x4a8ad8, 0xf0dcb0, 0xe8d8b0, 1);
  goal('ត្រឡប់ ទៅ ផ្ទះ ។', [-40, 0]);
  await reach([-10, 0], 10);
  dad.talk = null; await walk(dad, player.x - 1.6, player.z, 7); dad.yaw = Math.atan2(player.x - dad.x, player.z - dad.z);
  burst(player.x, player.y + 1.5, player.z, 0xfff0a0, 40, 2); good(); toast('', 'ឪពុក រត់ មក ឱប គាត់ ។'); speaking = 'god'; sayPhrase('ឪពុក រត់ មក ឱប គាត់ ។');
  await say('me', 'ឪពុក ! ខ្ញុំ បាន ធ្វើ បាប ។ ខ្ញុំ មិន សម ជា កូន របស់ ឪពុក ទៀត ទេ ។');
  dad.talk = 'dad';
  await say('dad', 'យក អាវ ល្អ បំផុត មក ! ចិញ្ចៀន ! ស្បែកជើង ! តោះ ធ្វើ បុណ្យ !');
  world.remove(hero.g); hero = person({ ...HEROES.son, top: 0xc8a040, cloth: 0xf2c51c }); world.add(hero.g); burst(player.x, player.y + 1, player.z, 0xf2c51c, 40, 2);
  await say('dad', 'កូន ខ្ញុំ នេះ បាន ស្លាប់ ហើយ រស់ ឡើង វិញ ។ បាន បាត់ ហើយ រក ឃើញ វិញ !');
  await say('bro', 'ខ្ញុំ បម្រើ ឪពុក ច្រើន ឆ្នាំ ... ឪពុក មិន ដែល ធ្វើ បុណ្យ ឲ្យ ខ្ញុំ ទេ !');
  await say('dad', 'កូន អើយ ! កូន នៅ ជាមួយ ឪពុក ជានិច្ច ។ អ្វីៗ ទាំងអស់ របស់ ឪពុក ក៏ ជា របស់ កូន ដែរ ។');
  await nextCh();
}

/* ---- Revelation: John's vision on Patmos (Revelation 1, 4-5) ---- */
patmos.build = () => {
  setSky(0x3a5a9a, 0xd8c8b0, 0xc8c0b0, .9, true); scene.fog.near = 50; scene.fog.far = 200;
  H = (x, z) => 3 + Math.sin(x * .08) * 2 - Math.max(0, Math.hypot(x, z) - 30) * .45; bound = 60; terrain(200, 50, (x, z, y) => y < .4 ? 0xc8b890 : 0x9a8a68); addWater(0, 0x2a6ab0);
};
async function patmos() {
  await leapIn('john_old', 0, 6, Math.PI);
  await arrive([]);
  await say('me', 'ខ្ញុំ យ៉ូហាន នៅ លើ កោះ ប៉ាត់ម៉ុស ។ ថ្ងៃ របស់ ព្រះអម្ចាស់ ។');
  tone([392, 392, 523], 1.4, 'sawtooth', .06); await say('jesus', 'ចូរ សរសេរ អ្វី ដែល អ្នក ឃើញ ។');
  goal('ងាក ក្រោយ ។', null);
  await act('ងាក ក្រោយ', [player.x, player.z], 99); player.yaw = 0;
  const lamps = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const l = grp(); cyl(.08, .2, 1.8, 0xf2c51c, 0, .9, 0, l, 6); const f2 = fire(); f2.scale.setScalar(.35); f2.position.y = 1.8; l.add(f2); place(l, Math.cos(a) * 4, 12 + Math.sin(a) * 4); lamps.push(l); }
  tag('ជើង ចង្កៀង', lamps[0]);
  for (let i = 0; i < 7; i++) { burst(lamps[i].position.x, lamps[i].position.y + 2, lamps[i].position.z, 0xf2c51c, 10, 1); toast(khNum(i + 1), NUMW[i + 1]); await wait(.45); }
  const glory = ent(person({ ...HEROES.jesus, hair: 0xffffff, beard: 0xffffff, top: 0xf8f8f0, bottom: 0xf8f8f0 }), 0, 12, { solid: 0, id: 'jesus', yaw: Math.PI }); const sash = cyl(.31, .31, .12, 0xf2c51c, 0, 1.3, 0, glory.m.b, 6); const halo = godFlame(.5); halo.position.y = 2.6; glory.m.b.add(halo);
  for (const s2 of [-1, 1]) mesh(new THREE.OctahedronGeometry(.05, 0), MB(0xff8020), s2 * .085, 1.83, .22, glory.m.b);
  burst(0, H(0, 12) + 2, 12, 0xffffff, 80, 4); cap('ពន្លឺ');
  await tween(.6, k => { hero.b.rotation.x = -k * 1.4; hero.b.position.y = k * .3; });
  await say('jesus', 'កុំ ខ្លាច ! ខ្ញុំ ជា ដើម និង ជា ចុង ។ ខ្ញុំ បាន ស្លាប់ តែ ឥឡូវ ខ្ញុំ នៅ រស់ ជា រៀង រហូត !');
  await tween(.6, k => { hero.b.rotation.x = -(1 - k) * 1.4; hero.b.position.y = (1 - k) * .3; });
  // a door open in heaven: the throne, the rainbow, the elders, the Lamb
  await say('jesus', 'ចូរ ឡើង មក ទីនេះ ។');
  const f = $('#flash'); f.style.background = '#fff'; await tween(.8, k => f.style.opacity = k);
  for (const l of lamps) world.remove(l); ents.splice(ents.indexOf(glory), 1); world.remove(glory.g); world.remove(ground); if (water) world.remove(water); water = null; waterY = -100;
  H = () => 0; bound = 60; const sea = mesh(new THREE.CircleGeometry(60, 24).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xc8e0f0, map: waterTex, transparent: true, opacity: .9 }), 0, 0, 0, world); tag('សមុទ្រ កែវ', sea); solids.length = 0;
  setSky(0x6a5ab0, 0xf0e8ff, 0xe0d8f0, 1.1, true);
  const throne = grp(); box(3, 4, 2.4, 0xf2c51c, 0, 2, 0, throne); place(throne, 0, -14); tag('បល្ល័ង្ក', throne);
  const rb = rainbowMesh(9); rb.position.set(0, 0, -15); world.add(rb);
  const flame = godFlame(1.4); flame.position.set(0, 4.6, -14); world.add(flame); anims.push((dt, t) => flame.children.forEach(m => { m.scale.y = 1 + Math.sin(t * 13 + (m.userData.f || 0)) * .18; }));
  for (let i = 0; i < 24; i++) { const a = Math.PI * (1.1 + i / 23 * .8); const e = ent(person({ skin: 0xa07050, top: 0xf8f8f0, robe: true, hair: 0xd8d8d8, beard: 0xd8d8d8 }), Math.cos(a) * 11, -14 - Math.sin(a) * 11, { solid: 0, id: 'elder' }); e.yaw = Math.atan2(-e.x, -14 - e.z); cone(.2, .3, 0xf2c51c, 0, .42, 0, e.m.head, 5); e.talk = null; }
  const lambM = animal('sheep'); const lamb = ent(lambM, 0, -9, { solid: 0, yaw: 0 }); tag('កូនចៀម', lambM.g); const lglow = godFlame(.3); lglow.position.y = 1.6; lambM.b.add(lglow);
  player.x = 0; player.z = 4; player.yaw = Math.PI;
  await tween(1, k => f.style.opacity = 1 - k); f.style.background = '';
  await camTo([6, 5, 8], [0, 2.5, -12], 1.6);
  await say('elder', 'បរិសុទ្ធ ! បរិសុទ្ធ ! បរិសុទ្ធ ! ព្រះអម្ចាស់ ជា ព្រះ ដ៏ មាន ឫទ្ធានុភាព !');
  await say('elder', 'កូនចៀម ដែល ត្រូវ គេ សម្លាប់ ស័ក្តិសម នឹង ទទួល សិរីល្អ !');
  camFree();
  await say('me', 'អាម៉ែន ! សរសើរ និង សិរីល្អ ដល់ ព្រះ និង កូនចៀម ជា រៀង រហូត !');
  await nextCh();
}

/* ---- Revelation: all things new (Revelation 21-22) ---- */
newJerusalem.build = () => {
  setSky(0x3a7ae0, 0xf8f0e0, 0xf0ece0, 1.1, true); scene.fog.near = 60; scene.fog.far = 240;
  H = (x, z) => 1 + Math.sin(x * .03) * .6 + Math.cos(z * .04) * .5; bound = 110; terrain(240, 50, () => 0x7ac050);
};
async function newJerusalem() {
  await leapIn('john_old', 0, 50, Math.PI);
  await arrive([]);
  await say('me', 'ខ្ញុំ ឃើញ ផ្ទៃ មេឃ ថ្មី និង ផែនដី ថ្មី ។ សមុទ្រ លែង មាន ទៀត ហើយ ។');
  await say('me', 'ខ្ញុំ ឃើញ ក្រុង បរិសុទ្ធ យេរូសាឡិម ថ្មី ចុះ មក ពី ស្ថានសួគ៌ !');
  const city = grp(); const W = 36, gy = 0; for (const [w, d, x, z] of [[W, 2, 0, -W / 2], [2, W, -W / 2, 0], [2, W, W / 2, 0], [W / 2 - 3, 2, -W / 4 - 1.5, W / 2], [W / 2 - 3, 2, W / 4 + 1.5, W / 2]]) box(w, 12, d, MB(0xf2c51c, { transparent: true, opacity: .85 }), x, 6, z, city);
  [0x3a7ae0, 0x40c070, 0xe04040, 0xa040e0, 0xf0a020, 0x40d0d0].forEach((c, i) => box(W + 2, .8, W + 2, MB(c, { transparent: true, opacity: .7 }), 0, .4 + i * .01, 0, city).scale.set(1 - i * .02, 1, 1 - i * .02));
  for (let i = 0; i < 12; i++) { const side = Math.floor(i / 3), k = i % 3 - 1, pearl = sph(1.2, MB(0xf8f8f8), 0, 0, 0, city, 6, 4); const pos = [[k * 9, W / 2], [k * 9, -W / 2], [W / 2, k * 9], [-W / 2, k * 9]][side]; pearl.position.set(pos[0], 13, pos[1]); }
  city.position.set(0, 90, -30); world.add(city); tag('ក្រុង', city);
  await camTo([player.x + 10, player.y + 4, player.z + 10], [0, 40, -30], 1.5);
  await tween(5, k => city.position.y = 90 - k * (90 - H(0, -30))); burst(0, 4, -12, 0xfff0a0, 80, 6); camFree(); cap('ក្រុង');
  for (const [x, z, r] of [[0, -48, 18], [-18, -30, 18], [18, -30, 18]]) for (let i = -8; i <= 8; i++) solids.push(x === 0 ? { x: i * 2.2, z, r: 1.4 } : { x, z: z + i * 2.2, r: 1.4 });
  const river = mesh(new THREE.PlaneGeometry(3, 34).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x80d0ff, map: waterTex, transparent: true, opacity: .85 }), 0, H(0, -30) + .08, -30, world); tag('ទន្លេ', river);
  for (const s2 of [-1, 1]) { const t = tree({ s: 1.5, leaf: 0x3aa04a, fruit: [0xe03a2a, 0xf2c51c, 0x9a2ad0, 0xff8020][s2 > 0 ? 1 : 0], n: 12 }); place(t.g, s2 * 4.5, -34, 0, 1.6); tag('ដើមឈើ ជីវិត', t.g); tag('ដើមឈើ', t.g); }
  godGlow(true, [0, 14, -46]);
  await say('god', 'មើល ! យើង ធ្វើ ឲ្យ អ្វីៗ ទាំងអស់ ទៅ ជា ថ្មី ។');
  await say('god', 'គ្មាន ទឹកភ្នែក គ្មាន សេចក្ដី ស្លាប់ គ្មាន ការ យំ ទៀត ទេ ។');
  goal('ចូល ក្រុង ។ ទៅ ដើមឈើ ជីវិត ។', [0, -32]);
  await reach([2.5, -32], 4);
  await say('god', 'ដើមឈើ ជីវិត ។ ផ្លែ ដប់ពីរ មុខ ។ ស្លឹក សម្រាប់ ព្យាបាល ប្រជាជាតិ ។');
  goal('ហូប ផ្លែ ពី ដើមឈើ ជីវិត ។', [4.5, -34]);
  await act('ហូប ផ្លែឈើ ជីវិត', [4.5, -34], 4); burst(player.x, player.y + 2, player.z, 0xf2c51c, 60, 3); good(); cap('ជីវិត');
  toast('', 'នៅ អេដែន ដើមឈើ ជីវិត ត្រូវ បិទ ។ ឥឡូវ ផ្លូវ បើក ហើយ ។'); speaking = 'god'; await sayPhrase('ឥឡូវ ផ្លូវ ទៅ ដើមឈើ ជីវិត បើក ហើយ ។');
  await say('jesus', 'មែន ហើយ ! ខ្ញុំ មក ជា ឆាប់ !');
  await say('me', 'អាម៉ែន ! សូម យាង មក ព្រះអម្ចាស់ យេស៊ូ !');
  await nextCh();
}

async function ending() {
  started = false; $('#hud').classList.add('hide'); setSky(0x02041a, 0x0a1440, 0x0a1030, .2, true); stars.material.opacity = 1;
  $('#flash').style.opacity = 0;
  const n = Object.keys(S.seen).length;
  $('#endtxt').innerHTML = `<div class="sub">ដំណើរឆ្លងកាល</div><h1>អ្វីៗ ទាំងអស់ ជា ថ្មី</h1><p>អ្នក បាន លោត ចូល ក្នុង រឿង ព្រះគម្ពីរ ${khNum(CHAPTERS.length)} ពី លោកុប្បត្តិ ដល់ វិវរណៈ ។</p><p>អ្នក ឃើញ ពាក្យ ខ្មែរ <b style="color:var(--c);font-size:26px">${khNum(n)}</b> ពាក្យ ។</p><div class="row"><button class="btn pri big" id="replay">ចាប់ផ្ដើម ម្ដង ទៀត</button><button class="btn big" id="words">ពាក្យ</button></div>`;
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
function begin() { ensureAudio(); $('#title').classList.add('hide'); $('#bookclose').onclick = closeAll; stars.material.opacity = 0; const ch = S.ch >= CHAPTERS.length ? 0 : S.ch; playChapter(ch).catch(e => console.error(e)); }
$('#start').onclick = begin;
try { if (sessionStorage.getItem('leap-autostart')) { sessionStorage.removeItem('leap-autostart'); begin(); } } catch (e) { }
$('#pick').onclick = () => { ensureAudio(); ui = null; bookTab = 'chaps'; $('#title').classList.add('hide'); openBook(); $('#bookclose').onclick = () => { closeAll(); if (!started) $('#title').classList.remove('hide'); }; };
$('#again').onclick = () => { S.ch = 0; save(); begin(); };
window.LEAP = { thumb,  S, acts, speakers, pressA: () => { curAct = curAct || acts[0]; pressA(); }, dlgTap, trig: () => trigRes && trigRes('x'), get ui() { return ui; }, player, ents, reachers, get started() { return started; }, speak: w => { typed = w; speakTyped(); }, get audio() { return peak ? peak.source + ' ' + peak.speakers.length : 'none'; }, warp: (x, z) => { player.x = x; player.z = z; }, get goal() { return atXZ(goalAt); }, atXZ };
