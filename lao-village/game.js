import * as THREE from './three.module.min.js';
import { VOCAB, SPELLS, NPCS, TALK, STONES, HEADS, DOOR_ORDER, EXAMINE, SIGNS, SHOPS, ENEMIES } from './content.js';
import { AUDIO, ROM as ROM0 } from './audio.js';
import { peakAudio } from './peakaudio.js';

try { await Promise.race([document.fonts.load('40px "Noto Sans Lao"', 'ກ'), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
const ROM = ROM0;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFC').replace(/[\u200b\u200c\u200d\s]/g, '').replace(/\u0ecd([\u0ec8-\u0ecb])\u0eb2/g, '$1\u0eb3').replace(/\u0ecd\u0eb2/g, '\u0eb3').replace(/\u0eab\u0e99/g, '\u0edc').replace(/\u0eab\u0ea1/g, '\u0edd').replace(/\u0eab\u0ea5/g, '\u0eab\u0ebc');
const rnd = (a, b) => a + Math.random() * (b - a);
const isMobile = matchMedia('(pointer:coarse)').matches;
const KDIG = '໐໑໒໓໔໕໖໗໘໙';
const khNum = n => String(n).replace(/\d/g, d => KDIG[d]);
const ONES = ['', 'ໜຶ່ງ', 'ສອງ', 'ສາມ', 'ສີ່', 'ຫ້າ', 'ຫົກ', 'ເຈັດ', 'ແປດ', 'ເກົ້າ'];
function numWords(n) {
  const out = [], U = [[100000, 'ແສນ'], [10000, 'ໝື່ນ'], [1000, 'ພັນ'], [100, 'ຮ້ອຍ']];
  for (const [v, w] of U) { const k = Math.floor(n / v); n %= v; if (k) out.push(ONES[k], w); }
  if (n) out.push(n === 10 ? 'ສິບ' : ONES[n]);
  return out.join(' ');
}

/* ---------------- state & save ---------------- */
const SAVE = 'vow-lao-1';
function freshState() {
  return { known: [], heard: [], spells: [], uses: {}, casts: {}, flags: {}, heads: [], stones: [], revealed: [], door: [], hp: 5, stolen: 0, visited: [], pos: [0.6, -1.3], yaw: -2.64, night: false, boatSide: 'west', money: 0, bag: {}, moto: { x: -11, z: -16, yaw: 0.5, fuel: 30, flat: true, fallen: false }, kidColor: null };
}
function load() { try { const j = JSON.parse(localStorage.getItem(SAVE)); if (j && j.known) { const f = freshState(); return Object.assign(f, j, { moto: Object.assign(f.moto, j.moto || {}) }); } } catch (e) { } return null; }
let S = load();
const hadSave = !!S; if (!S) S = freshState();
function save() { try { S.pos = [player.x, player.z]; S.yaw = player.yaw; S.moto.x = moto.x; S.moto.z = moto.z; S.moto.yaw = moto.yaw; localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } }
const F = S.flags;
const known = w => S.known.includes(w);
function learn(w, quiet) { if (!VOCAB[w] || known(w)) return false; S.known.push(w); updateHUD(); checkWarp(w); if (!quiet) toast(w, 'New word: ' + VOCAB[w]); return true; }
function hear(w) { if (VOCAB[w] && !S.heard.includes(w)) S.heard.push(w); }
// Places you can warp to: you must have been there AND know the word.
let PLACES = {};
function checkWarp(w) { const p = PLACES[w]; if (p && known(w) && S.visited.includes(w) && !S.spells.includes(w)) { S.spells.push(w); setTimeout(() => toast(w, `Spell learned: say ${w} to return to ${p.name} from anywhere.`), 2900); chime([523, 659, 784, 1046]); } }
function teachSpell(w) { if (!S.spells.includes(w)) S.spells.push(w); learn(w, true); }
function use(spell, id) { const u = S.uses[spell] || (S.uses[spell] = []); if (!u.includes(id)) { u.push(id); return true; } return false; }
function addItem(w, n = 1) { S.bag[w] = (S.bag[w] || 0) + n; if (S.bag[w] <= 0) delete S.bag[w]; }
const has = w => (S.bag[w] || 0) > 0;
function pay(n) { S.money += n; updateHUD(); chime([880, 1175], .5, 'triangle', .08); }

/* ---------------- audio (Web Audio: reliable sequential playback on phones) ---------------- */
let actx; const bufs = {};
function ensureAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { } }
async function getBuf(w) {
  if (bufs[w]) return bufs[w];
  const bin = atob(AUDIO[w]), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return bufs[w] = await new Promise((res, rej) => actx.decodeAudioData(arr.buffer, res, rej));
}
let kmVoice = null;
try { const pick = () => { kmVoice = speechSynthesis.getVoices().find(v => /^lo/i.test(v.lang)) || null; }; pick(); speechSynthesis.onvoiceschanged = pick; } catch (e) { }
// Words play through one shared <audio> element: unlocked by the first tap, it can then play
// any number of clips in a row on iOS/Android, and it still plays when the phone's silent switch is on.
const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAACAAAA/oAR0dHR0dHR0dHR0dHYmJiYmJiYmJiYmJifHx8fHx8fHx8fHx8fJaWlpaWlpaWlpaWlrGxsbGxsbGxsbGxsbHLy8vLy8vLy8vLy8vl5eXl5eXl5eXl5eXl////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQC1AAAAAAAAAP6yysejgAAAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NAxKQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80LEowAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80DEpAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsSjAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
const voice = new Audio(); voice.preload = 'auto'; voice.setAttribute('playsinline', '');
let unlocked = false; const urls = {};
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
  ensureAudio();
  if (unlocked) return;
  try { voice.src = SILENT; const p = voice.play(); if (p && p.then) p.then(() => { unlocked = true; }).catch(() => { }); else unlocked = true; } catch (e) { }
}
function clipURL(w) {
  if (urls[w]) return urls[w];
  try { const bin = atob(AUDIO[w]), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return urls[w] = URL.createObjectURL(new Blob([arr], { type: 'audio/mpeg' })); }
  catch (e) { return urls[w] = 'data:audio/mpeg;base64,' + AUDIO[w]; }
}
let playSeq = 0;
function playClip(w) {
  const my = ++playSeq;
  return new Promise(res => {
    let done = false; const fin = ok => { if (!done) { done = true; clearTimeout(to); res(ok); } };
    voice.onended = () => my === playSeq && fin(true);
    voice.onerror = () => my === playSeq && fin(false);
    voice.src = clipURL(w); voice.currentTime = 0;
    const to = setTimeout(() => fin(true), 4000);
    voice.onloadedmetadata = () => { clearTimeout(to); setTimeout(() => fin(true), (voice.duration || 2) * 1000 + 500); };
    try { const p = voice.play(); if (p && p.catch) p.catch(() => fin(null)); } catch (e) { fin(null); }
  });
}
async function playBuf(w) {
  if (!actx) return false;
  const b = await getBuf(w); const src = actx.createBufferSource(); src.buffer = b; src.connect(actx.destination);
  return await new Promise(res => { src.onended = () => res(true); src.start(); setTimeout(() => res(true), b.duration * 1000 + 400); });
}
// Lao words are said by PeakSlab's engine: peak.wasm finds the word's recordings in the Lao audio
// slab, tnefar.wasm makes the speech. The newest slab comes from peakslab.org where the page may
// fetch it; otherwise the copy beside the game. Words not in the slab fall back to a clip (AUDIO),
// then to the device's Lao voice.
let peak = null, speaking = null;
const peakReady = peakAudio({ sources: ['https://peakslab.org/', './'], slab: 'lao/aux/lo-audio-tnefar.slab', bufmax: 1 << 20 })
  .then(p => (peak = p)).catch(e => { console.warn('PeakSlab audio unavailable:', e); return null; });
// Each character's voice: which of the slab's speakers they prefer (an index, so a slab with more
// speakers gives more voices; a word only one speaker recorded is said by them) and a pitch.
const VOICE = { yay: [0, .94], kru: [1, 1], aunt: [0, 1.02], tuot: [0, .88], sok: [0, 1.1], kid: [0, 1.18], vendor: [0, 1.04],
  ta: [1, .9], fisher: [1, .97], monk: [1, .86], jang: [1, 1.03], gas: [0, 1.06], che: [0, 1.07], hia: [1, 1.05], ee: [0, .96],
  chief: [1, .94], farmer: [1, 1], thief: [1, 1.08], tacha: [1, .9] };
function playPcm(s, rate) {
  ensureAudio(); if (!actx) return Promise.resolve(false);
  const b = actx.createBuffer(1, s.length, 16000); b.copyToChannel(s, 0);
  const src = actx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate; src.connect(actx.destination);
  return new Promise(res => { src.onended = () => res(true); src.start(); setTimeout(() => res(true), b.duration / rate * 1000 + 300); });
}
async function peakSay(w) {
  if (!peak) await Promise.race([peakReady, new Promise(r => setTimeout(r, 4000))]);
  if (!peak) return null;
  const [i, rate] = VOICE[speaking] || [0, 1], sp = peak.speakers;
  const s = peak.samples(w, sp.length ? sp[i % sp.length] : '');
  return s ? playPcm(s, rate) : null;
}
async function playWord(w) {
  { const r = await peakSay(w); if (r !== null) return r; }
  if (AUDIO[w]) {
    const r = await playClip(w);
    if (r !== null) return r;
    try { return await playBuf(w); } catch (e) { } // element refused (no gesture yet): try Web Audio
  }
  if (kmVoice) { try { return await new Promise(res => { const u = new SpeechSynthesisUtterance(w); u.voice = kmVoice; u.lang = kmVoice.lang; u.onend = () => res(true); u.onerror = () => res(false); speechSynthesis.speak(u); setTimeout(() => res(true), 2500); }); } catch (e) { } }
  await new Promise(r => setTimeout(r, 350)); return false;
}
function chime(freqs = [660, 880, 1320], dur = 0.9, type = 'sine', vol = 0.12) {
  if (!actx) return; const t = actx.currentTime;
  freqs.forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t + i * 0.08); g.gain.linearRampToValueAtTime(vol, t + i * 0.08 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + dur); o.connect(g).connect(actx.destination); o.start(t + i * 0.08); o.stop(t + i * 0.08 + dur + 0.05); });
}
function bark() { if (!actx) return; const t = actx.currentTime; for (let i = 0; i < 2; i++) { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(420, t + i * .22); o.frequency.exponentialRampToValueAtTime(220, t + i * .22 + .1); g.gain.setValueAtTime(.05, t + i * .22); g.gain.exponentialRampToValueAtTime(.0001, t + i * .22 + .13); o.connect(g).connect(actx.destination); o.start(t + i * .22); o.stop(t + i * .22 + .15); } }
let engine = null;
function engineSound(on, sp = 0) {
  if (!actx) return;
  if (on && !engine) { const o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = .025; o.connect(f).connect(g).connect(actx.destination); o.start(); engine = { o, g }; }
  if (!on && engine) { engine.o.stop(); engine = null; }
  if (engine) engine.o.frequency.value = 38 + sp * 5;
}
function ambience() {
  if (!actx) return; const t = actx.currentTime;
  if (S.night) { for (let i = 0; i < 3; i++) { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 4200 + Math.random() * 600; g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(0.012, t + i * 0.09 + 0.01); g.gain.linearRampToValueAtTime(0, t + i * 0.09 + 0.05); o.connect(g).connect(actx.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.06); } }
  else { const o = actx.createOscillator(), g = actx.createGain(), f0 = 2200 + Math.random() * 1400; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + 0.12); o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.25); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02, t + 0.03); g.gain.linearRampToValueAtTime(0, t + 0.26); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.3); }
}

/* ---------------- renderer & scene ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
addEventListener('pointerdown', unlockAudio, true); addEventListener('keydown', unlockAudio, true);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 520);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const DAY = { top: new THREE.Color(0x4f8fc9), hor: new THREE.Color(0xf6d6a0), fog: new THREE.Color(0xe9cfa0), hemi: 1.0, sun: 1.6, sunC: new THREE.Color(0xffe2b0), ground: new THREE.Color(0x6b5a3a) };
const NIGHT = { top: new THREE.Color(0x050b1c), hor: new THREE.Color(0x1b2b4a), fog: new THREE.Color(0x14203a), hemi: 0.35, sun: 0.35, sunC: new THREE.Color(0x8fa8ff), ground: new THREE.Color(0x10141f) };
let nightT = S.night ? 1 : 0, nightGoal = nightT;
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: DAY.top.clone() }, hor: { value: DAY.hor.clone() }, sun: { value: new THREE.Vector3(0.5, 0.25, -0.6).normalize() }, night: { value: 0 } },
  vertexShader: 'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'uniform vec3 top;uniform vec3 hor;uniform vec3 sun;uniform float night;varying vec3 vp;void main(){float h=clamp(vp.y,0.0,1.0);vec3 c=mix(hor,top,pow(h,0.55));float s=max(dot(vp,sun),0.0);c+=mix(vec3(1.0,0.8,0.5),vec3(0.8,0.85,1.0),night)*(pow(s,600.0)*1.5+pow(s,12.0)*0.25);gl_FragColor=vec4(c,1.0);}'
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(470, 24, 12), skyMat); scene.add(sky);
scene.fog = new THREE.Fog(DAY.fog.clone(), 30, 240);
const hemi = new THREE.HemisphereLight(0xfff1d6, 0x6b5a3a, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b0, 1.6); sun.position.set(80, 50, -100); scene.add(sun);
const starGeo = new THREE.BufferGeometry(); { const p = []; for (let i = 0; i < 700; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(0.05, 1), rnd(-1, 1)).normalize().multiplyScalar(440); p.push(v.x, v.y, v.z); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 8), new THREE.MeshBasicMaterial({ color: 0xfdf3d0, fog: false, transparent: true, opacity: 0 })); moon.position.set(-200, 160, -250);

/* ---------------- terrain ---------------- */
const TEMPLE = { x: -100, z: -20, h: 15 };
const POND = { x: 15, z: -55, r: 7 };
const riverX = z => -55 + 6 * Math.sin(z * 0.025);
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const inPaddy = (x, z) => x > -6 && x < 56 && z > 28 && z < 82;
const inGold = (x, z) => x > 34 && x < 68 && z > -118 && z < -86;
const inTown = (x, z) => x > 140 && x < 248 && Math.abs(z) < 60;
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); }
const PATHS = [[0, 0, 30, -38], [0, 0, 50, 8], [0, 0, 18, 34], [18, 34, 46, 86], [0, 0, -46, 10], [-62, 10, -88, -12], [-88, -12, -100, -20], [0, 0, -44, -30], [50, 8, 68, 20], [30, -38, 15, -50], [0, 0, -16, -10], [50, 8, 100, 3], [30, -46, 22, -78], [22, -78, 8, -96], [8, -96, -6, -110], [22, -78, 36, -90]];
const ROADS = [[100, 3, 250, 0], [200, -46, 200, 46], [160, 0, 160, -24]];
function pathDist(x, z) { let d = 1e9; for (const p of PATHS) d = Math.min(d, segDist(x, z, ...p)); return d; }
function roadDist(x, z) { let d = 1e9; for (const p of ROADS) d = Math.min(d, segDist(x, z, ...p)); return d; }
function baseH(x, z) {
  let h = 0.9 + 0.5 * Math.sin(x * 0.045) * Math.cos(z * 0.038) + 0.3 * Math.sin(x * 0.11 + z * 0.07);
  const dv = Math.hypot(x, z); h = 0.9 + (h - 0.9) * (0.35 + 0.65 * smooth((dv - 15) / 30));
  if (inPaddy(x, z)) { const e = Math.min(x + 6, 56 - x, z - 28, 82 - z); h = 0.5 + (h - 0.5) * (1 - smooth(e / 5)); }
  if (x > -22 && x < 34 && z > -124 && z < -78) { const e = Math.min(x + 22, 34 - x, z + 124, -78 - z); h = 0.9 + (h - 0.9) * (0.3 + 0.7 * (1 - smooth(e / 8))); }
  if (inGold(x, z)) { const e = Math.min(x - 34, 68 - x, z + 118, -86 - z); h = 0.55 + (h - 0.55) * (1 - smooth(e / 4)); }
  if (x > 132) h = 0.9 + (h - 0.9) * (1 - smooth((x - 132) / 10)) * 1; // flat town
  const dt = Math.hypot(x - TEMPLE.x, z - TEMPLE.z); h = 0.9 + (h - 0.9) * smooth((dt - 11) / 15); h += (TEMPLE.h - 0.9) * smooth(1 - (dt - 11) / 36); // flat hilltop, no ledge
  const rd = Math.abs(x - riverX(z)); if (rd < 13) h = h * smooth(rd / 13) + (-2.6) * (1 - smooth(rd / 13));
  const dp = Math.hypot(x - POND.x, z - POND.z); if (dp < POND.r + 3) h = h * smooth((dp - POND.r + 3) / 6) - 2.4 * (1 - smooth((dp - POND.r + 3) / 6));
  // ridge between village and town, with a pass for the road
  if (x > 108 && x < 144) { const k = Math.sin(Math.PI * (x - 108) / 36); const gap = smooth((Math.abs(z - 2) - 6) / 7); h += 18 * k * gap; }
  // boundary hills
  const over = Math.max(-120 - x, x - 248, Math.abs(z) - 120, 0); if (over > 0) h += over * 1.6;
  return h;
}
const floors = [];
function groundH(x, z) { let h = baseH(x, z); for (const f of floors) if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1 && f.h > h) h = f.h; return h; }
const WATER_Y = -0.7;
{
  const W = 412, D = 300, cx = 56, NX = isMobile ? 170 : 220, NZ = isMobile ? 124 : 160;
  const g = new THREE.PlaneGeometry(W, D, NX, NZ); g.rotateX(-Math.PI / 2); g.translate(cx, 0, 0);
  const pos = g.attributes.position, col = [];
  const cGrass = new THREE.Color(0x7c9a3e), cGrass2 = new THREE.Color(0x5f8a35), cDirt = new THREE.Color(0xb4632f), cSand = new THREE.Color(0xc9ae7a), cPaddy = new THREE.Color(0x8a7a4a), cHill = new THREE.Color(0x6f8a3c), cRoad = new THREE.Color(0x55555a), cConc = new THREE.Color(0xa8a090), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = baseH(x, z); pos.setY(i, h);
    tmp.copy(cGrass).lerp(cGrass2, 0.5 + 0.5 * Math.sin(x * 0.3) * Math.cos(z * 0.27));
    if (h < 0.1) tmp.lerp(cSand, smooth((0.1 - h) / 0.8));
    if (inPaddy(x, z)) tmp.copy(cPaddy);
    if (inGold(x, z)) tmp.set(0x9a7a3a);
    if (h > 3) tmp.lerp(cHill, 0.5);
    if (inTown(x, z)) tmp.lerp(cConc, .6);
    const pd = pathDist(x, z); if (pd < 2.2) tmp.lerp(cDirt, smooth(1 - pd / 2.2) * 0.9);
    const rdd = roadDist(x, z); if (rdd < 3.6) tmp.lerp(x > 104 ? cRoad : cDirt, smooth(1 - (rdd - 2.4) / 1.2));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
}
const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4a7f86, transparent: true, opacity: 0.82 }));
water.position.set(-40, WATER_Y, 0); scene.add(water);

/* ---------------- helpers ---------------- */
const matCache = {};
const M = (c, o = {}) => { const k = c + JSON.stringify(o); return matCache[k] || (matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o))); };
function box(w, h, d, c, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? M(c) : c); m.position.set(x, y, z); (parent || scene).add(m); return m; }
function cyl(rt, rb, h, c, x = 0, y = 0, z = 0, parent, seg = 7) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'number' ? M(c) : c); m.position.set(x, y, z); (parent || scene).add(m); return m; }
function textCanvas(text, { size = 64, color = '#f6e3b0', bg = null, w = 512, h = 128 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  const draw = tx => { c.clearRect(0, 0, w, h); if (bg) { c.fillStyle = bg; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 24); c.fill(); } c.font = `${size}px "Noto Sans Lao", "Phetsarath OT", "Saysettha OT", sans-serif`; c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 8; c.fillText(tx, w / 2, h / 2 + 4); };
  draw(text); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function textSprite(text, o = {}) { const { w = 512, h = 128, scale = 2 } = o; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas(text, o), transparent: true, depthWrite: false, fog: false })); s.scale.set(scale * w / h, scale, 1); return s; }
function textPlane(text, w, h, o = {}) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: textCanvas(text, Object.assign({ w: 512, h: Math.round(512 * h / w) }, o)) })); return p; }
function mergeGeos(list) { const pos = [], nor = []; for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g; }
const circles = [], boxes = [], interact = [], colorables = [], anims = [];
const near = (x, z, r) => Math.hypot(x - player.x, z - player.z) < r;
const dist = (x, z) => Math.hypot(x - player.x, z - player.z);

/* ---------------- village ---------------- */
const HOUSES = {}; let inside = null;
const L2W = (h, lx, lz) => [h.x + lx * Math.cos(h.rot) + lz * Math.sin(h.rot), h.z - lx * Math.sin(h.rot) + lz * Math.cos(h.rot)];
const W2L = (h, x, z) => { const dx = x - h.x, dz = z - h.z; return [dx * Math.cos(h.rot) - dz * Math.sin(h.rot), dx * Math.sin(h.rot) + dz * Math.cos(h.rot)]; };
let houseN = 0;
// Stilt houses are hollow: say ຂຶ້ນ at the ladder to climb in, ລົງ to climb down.
function stiltHouse(x, z, rot, wall, roof = 0x8a3b22, opts = {}) {
  const id = opts.id || 'h' + (houseN++);
  const g = new THREE.Group(); const gy = groundH(x, z); g.position.set(x, gy, z); g.rotation.y = rot; scene.add(g);
  const W = 7, D = 5.5, FH = 2.6, WH = 2.3, t = .12, DW = 1.2;
  for (const px of [-W / 2 + .3, 0, W / 2 - .3]) for (const pz of [-D / 2 + .3, D / 2 - .3]) { cyl(.14, .16, FH + .2, 0x5a3a22, px, FH / 2 - .2, pz, g); const wp = new THREE.Vector3(px, 0, pz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); circles.push({ x: x + wp.x, z: z + wp.z, r: .3 }); }
  box(W, .25, D, 0x6e4a2a, 0, FH, 0, g);
  box(W - .3, .02, D - .3, 0x8a6a42, 0, FH + .13, 0, g);
  const wm = new THREE.MeshLambertMaterial({ color: wall, flatShading: true });
  const y = FH + .12 + WH / 2;
  box(W, WH, t, wm, 0, y, -D / 2 + t / 2, g); box(t, WH, D, wm, -W / 2 + t / 2, y, 0, g); box(t, WH, D, wm, W / 2 - t / 2, y, 0, g);
  const sw = (W - DW) / 2; box(sw, WH, t, wm, -(DW / 2 + sw / 2), y, D / 2 - t / 2, g); box(sw, WH, t, wm, DW / 2 + sw / 2, y, D / 2 - t / 2, g);
  colorables.push({ mesh: box(DW, .5, t, wm, 0, FH + .12 + WH - .25, D / 2 - t / 2, g), own: wm });
  for (const wx of [-2.2, 2.2]) box(1, .8, .05, 0x2a1a10, wx, FH + 1.4, D / 2 + .01, g);
  box(.05, .8, 1, 0x2a1a10, -W / 2 - .01, FH + 1.4, 0, g); box(.05, .8, 1, 0x2a1a10, W / 2 + .01, FH + 1.4, 0, g);
  const lad = new THREE.Group(); lad.position.set(0, FH / 2, D / 2 + 1); lad.rotation.x = -0.45; g.add(lad);
  box(.08, FH * 1.15, .08, 0x5a3a22, -.4, 0, 0, lad); box(.08, FH * 1.15, .08, 0x5a3a22, .4, 0, 0, lad); for (let i = -2; i <= 2; i++) box(.8, .06, .1, 0x5a3a22, 0, i * .5, 0, lad);
  // gable roof: two sloped panels + closed triangular ends (clear headroom inside)
  const ridge = FH + 4.12, a = Math.atan(1.7 / 3), L = 3.3 / Math.cos(a);
  for (const s of [-1, 1]) { const p = box(W + 1, .12, L, M(roof, { side: THREE.DoubleSide }), 0, ridge - 1.65 * Math.tan(a), s * 1.65, g); p.rotation.x = s * a; }
  { const top = FH + .12 + WH, tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([0, top, -D / 2, 0, top, D / 2, 0, ridge, 0], 3)); tri.computeVertexNormals();
    for (const s of [-1, 1]) { const m = new THREE.Mesh(tri, new THREE.MeshLambertMaterial({ color: wall, side: THREE.DoubleSide })); m.position.x = s * (W / 2 - .06); g.add(m); } }
  box(W - .2, .04, D - .2, 0x4a3420, 0, FH + .12 + WH, 0, g); // ceiling
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(.12, 1, 4), M(roof)); h.position.set(s * (W / 2 + .6), ridge + .4, 0); h.rotation.z = -s * .5; g.add(h); }
  const fy = FH + .13; // furniture: bed, cupboard, low table, mat
  box(.95, .35, 1.9, 0x7a5232, W / 2 - .75, fy + .18, -D / 2 + 1.2, g); box(.85, .1, 1.8, 0xe8e0d0, W / 2 - .75, fy + .4, -D / 2 + 1.2, g); box(.6, .12, .35, 0xd8a0a0, W / 2 - .75, fy + .5, -D / 2 + .5, g);
  box(.8, 1.6, .45, 0x5a3a22, -W / 2 + .55, fy + .8, -D / 2 + .4, g);
  box(.9, .28, .6, 0x6a4a2a, -1.2, fy + .14, .2, g);
  box(2, .02, 1.6, [0xc23b3b, 0x3a6fb0, 0xd8a020, 0x3a8a4a][houseN % 4], .3, fy + .01, .3, g);
  if (opts.hammock) box(2.4, .08, .9, 0xc23b3b, 0, 1, -0.5, g);
  const h = { id, g, x, z, rot, gy, FH, W, D, floor: gy + FH + .13 };
  HOUSES[id] = h;
  const [fx, fz] = L2W(h, 0, D / 2 + 2.1), [bx, bz] = L2W(h, W / 2 - .75, -D / 2 + 1.2), [ex, ez] = L2W(h, 0, D / 2 - .7);
  h.foot = [fx, fz];
  interact.push({ x: fx, z: fz, r: 2.3, label: () => 'Climb up', kh: 'ຂຶ້ນ', act: () => openKB('ຂຶ້ນ'), on: () => !moto.riding && !boatState.riding });
  interact.push({ house: id, x: bx, z: bz, r: 1.7, label: () => 'Sleep', kh: 'ນອນ', act: () => openKB('ນອນ') });
  interact.push({ house: id, x: ex, z: ez, r: 1.4, label: () => 'Climb down', kh: 'ລົງ', act: () => openKB('ລົງ') });
  return g;
}
const roomLight = new THREE.PointLight(0xffd8a0, 0, 9, 1.2); scene.add(roomLight);
function enterHouse(h, lx = 0, lz = h.D / 2 - 1, yaw = 0) { inside = h; roomLight.position.set(h.x, h.floor + 2, h.z); roomLight.intensity = 2.2; const [x, z] = L2W(h, lx, lz); player.x = x; player.z = z; player.yaw = h.rot + yaw; player.pitch = -.1; camY = h.floor + EYE; }
function exitHouse() { const h = inside; inside = null; roomLight.intensity = 0; player.x = h.foot[0]; player.z = h.foot[1]; player.yaw = h.rot; camY = groundH(player.x, player.z) + EYE; }
function moveInside(dx, dz) { const h = inside; let [lx, lz] = W2L(h, player.x + dx, player.z + dz); lx = Math.max(-h.W / 2 + .45, Math.min(h.W / 2 - .45, lx)); lz = Math.max(-h.D / 2 + .45, Math.min(h.D / 2 - .45, lz)); [player.x, player.z] = L2W(h, lx, lz); }
let _crown;
function palmCrown() { if (_crown) return _crown; const leaves = []; for (let i = 0; i < 14; i++) { const c = new THREE.ConeGeometry(.9, 3.2, 3); c.scale(1, 1, .25); c.translate(0, 1.6, 0); c.rotateZ(rnd(.9, 1.6)); c.rotateY(i / 14 * Math.PI * 2); leaves.push(c); } leaves.push(new THREE.SphereGeometry(.7, 6, 4)); return _crown = mergeGeos(leaves); }
function palm(x, z, s = 1, coco = false) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = rnd(0, 6.28); scene.add(g);
  const H = (coco ? 7 : rnd(8, 12)) * s, lean = rnd(-.12, .12);
  const t = cyl(.18, .32, H, 0x6b5440, 0, H / 2, 0, g, 6); t.rotation.z = lean;
  const top = new THREE.Vector3(-Math.sin(lean) * H, H, 0);
  const cm = new THREE.Mesh(palmCrown(), M(coco ? 0x5f8a2a : 0x4f7a2a)); cm.position.copy(top); g.add(cm);
  const nuts = [];
  if (coco) for (let i = 0; i < 4; i++) { const n = new THREE.Mesh(new THREE.SphereGeometry(.28, 7, 5), M(0x7a5a2a)); n.position.copy(top).add(new THREE.Vector3(Math.cos(i * 1.6) * .6, -.6, Math.sin(i * 1.6) * .6)); g.add(n); nuts.push(n); }
  circles.push({ x, z, r: .5 }); return { g, nuts, x, z };
}
function tree(x, z, s = 1, dark = false) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); scene.add(g);
  cyl(.25 * s, .4 * s, 3 * s, 0x5a4330, 0, 1.5 * s, 0, g);
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 * s, 0), M(dark ? 0x1f3a1c : 0x3f6e2c)); f.position.y = 4.2 * s; f.scale.y = .8; g.add(f);
  const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 * s, 0), M(dark ? 0x264a22 : 0x4e8233)); f2.position.set(1.2 * s, 5 * s, .6); g.add(f2);
  circles.push({ x, z, r: .6 * s }); return g;
}
stiltHouse(0, -2, 0, 0xc9a46a, 0x8a3b22, { hammock: true, id: 'yay' });
stiltHouse(-18, -12, 0.6, 0xa8b49a, 0x8a3b22, { id: 'aunt' }); stiltHouse(14, -20, -0.4, 0xd7c19a, 0x6b3a2a); stiltHouse(-20, 20, 2.4, 0xb89870);
stiltHouse(24, 14, -1.2, 0x9fb0b8, 0x7a3020); stiltHouse(-12, -36, 0.2, 0xc8b07a); stiltHouse(-30, 6, 1.6, 0xa4886a); stiltHouse(38, -12, 0.9, 0xc9b89a, 0x6e2e1e);
box(1.6, .05, 2.2, 0xd8c27a, 0.5, groundH(.5, -1) + .03, -1.5);
// Mango Village (ບ້ານມ່ວງ), north of the school
stiltHouse(6, -100, 0.2, 0xd8b878, 0x7a3020, { id: 'chief' }); stiltHouse(-10, -94, 0.8, 0xb8c8a0, 0x8a3b22, { id: 'n2' });
stiltHouse(20, -107, -0.5, 0xc8a8a0); stiltHouse(-4, -113, 0.1, 0xa8b8c8, 0x6b3a2a); stiltHouse(24, -93, -1.2, 0xe0c890);
// hearth under Yay's house
const hearthPos = { x: -1.6, z: -2.8 };
for (let i = 0; i < 3; i++) { const a = i * 2.1; box(.3, .3, .3, 0x6a6a60, hearthPos.x + Math.cos(a) * .35, groundH(hearthPos.x, hearthPos.z) + .15, hearthPos.z + Math.sin(a) * .35); }
cyl(.35, .25, .35, 0x2a2a2a, hearthPos.x, groundH(hearthPos.x, hearthPos.z) + .45, hearthPos.z, null, 9);
const hearthFire = new THREE.Mesh(new THREE.ConeGeometry(.22, .5, 6), new THREE.MeshBasicMaterial({ color: 0xff9030 })); hearthFire.position.set(hearthPos.x, groundH(hearthPos.x, hearthPos.z) + .25, hearthPos.z); hearthFire.visible = !!F.hearth; scene.add(hearthFire);
circles.push({ x: hearthPos.x, z: hearthPos.z, r: .5 });

const avoid = (x, z) => pathDist(x, z) < 3.5 || roadDist(x, z) < 5 || Math.hypot(x, z) < 9 || inPaddy(x + 0, z) || Math.abs(x - riverX(z)) < 12 || Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 16 || Math.hypot(x - POND.x, z - POND.z) < 11 || (x > 40 && x < 72 && z > -4 && z < 26) || (x > 20 && x < 50 && z > -56 && z < -30) || inTown(x, z) || (x > 104 && x < 148) || (x > -24 && x < 70 && z > -122 && z < -66) || HEADS.some(h => Math.hypot(x - h.pos[0], z - h.pos[1]) < 6) || STONES.some(s => Math.hypot(x - s[1], z - s[2]) < 3);
{ let n = 0, tries = 0; while (n < (isMobile ? 80 : 120) && tries++ < 3000) { const x = rnd(-118, 108), z = rnd(-118, 118); if (avoid(x, z)) continue; Math.random() < .6 ? palm(x, z) : tree(x, z, rnd(.8, 1.3)); n++; } }
for (let i = 0; i < 10; i++) palm(-9 + rnd(-1, 1), 30 + i * 5.5, 1.2);
for (let i = 0; i < 8; i++) palm(10 + i * 6, 85 + rnd(-1, 1), 1.15);
// hills between village and town get trees on top
for (let i = 0; i < 30; i++) { const x = rnd(112, 140), z = rnd(-110, 110); if (Math.abs(z) < 16) continue; tree(x, z, rnd(1, 1.6)); }
const cocoPalms = [palm(8, 5, 1, true), palm(-8, -15, 1, true), palm(58, 25, 1, true), palm(30, 26, 1, true)];
// big dark tree (hides a stone)
tree(70, -17, 2, true);

// paddies
const paddyWater = new THREE.Mesh(new THREE.PlaneGeometry(60, 52).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x7fa3a0, transparent: true, opacity: .75 }));
paddyWater.position.set(25, .56, 55); paddyWater.visible = !!F.paddy; scene.add(paddyWater);
for (let x = -4; x <= 54; x += 9.6) box(.6, .35, 52, 0x8a6a3a, x, .6, 55);
for (let z = 30; z <= 80; z += 10) box(58, .35, .6, 0x8a6a3a, 25, .6, z);
let riceMesh;
{ const g = new THREE.ConeGeometry(.18, .9, 4); g.translate(0, .45, 0); const N = isMobile ? 500 : 900; riceMesh = new THREE.InstancedMesh(g, M(F.paddy ? 0x9cc94a : 0x8a8a4a), N); const m = new THREE.Matrix4(); for (let i = 0; i < N; i++) { m.makeScale(1, rnd(.6, 1.3), 1); m.setPosition(rnd(-3, 53), .5, rnd(29, 81)); riceMesh.setMatrixAt(i, m); } riceMesh.scale.y = F.paddy ? 1 : .25; scene.add(riceMesh); }
// scarecrow
const scare = new THREE.Group(); scare.position.set(40, .5, 50); scene.add(scare);
const scareP = new THREE.Group(); scare.add(scareP);
box(.12, 2.6, .12, 0x6a4a2a, 0, 1.3, 0, scareP); box(1.8, .1, .1, 0x6a4a2a, 0, 2, 0, scareP); box(.7, .9, .3, 0xc23b3b, 0, 1.8, 0, scareP);
{ const hd = new THREE.Mesh(new THREE.SphereGeometry(.25, 7, 5), M(0xd8c08a)); hd.position.y = 2.5; scareP.add(hd); const ht = new THREE.Mesh(new THREE.ConeGeometry(.5, .3, 8), M(0xd8c080)); ht.position.y = 2.75; scareP.add(ht); }
scareP.rotation.z = F.scare ? 0 : -Math.PI / 2 + .1;
// buffalo
const buffalo = new THREE.Group(); scene.add(buffalo);
box(2.2, 1.2, 1.1, 0x4a4a50, 0, 1.3, 0, buffalo); box(.8, .7, .7, 0x4a4a50, 1.4, 1.5, 0, buffalo);
for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(.12, 1.1, 4), M(0xd8d0b8)); h.position.set(1.5, 2, s * .5); h.rotation.x = s * 1.2; buffalo.add(h); }
const bufLegs = []; for (const a of [-.8, .8]) for (const b of [-.4, .4]) bufLegs.push(box(.25, .9, .25, 0x3a3a40, a, .45, b, buffalo));
const bufS = { x: 30, z: 47, tx: 30, tz: 47, lie: false }; const bufCol = { x: 30, z: 47, r: 1.5 }; circles.push(bufCol);
// trough
box(2, .5, .8, 0x7a6a5a, 33, .75, 44); const troughW = box(1.8, .05, .6, 0x5aa0b0, 33, .98, 44); troughW.visible = !!F.trough;

// market
for (let i = 0; i < 5; i++) {
  const x = 46 + (i % 3) * 7, z = 4 + Math.floor(i / 3) * 10, g = new THREE.Group(); g.position.set(x, groundH(x, z), z); scene.add(g);
  for (const a of [-1.4, 1.4]) for (const b of [-1, 1]) cyl(.07, .07, 2.6, 0x5a3a22, a, 1.3, b, g);
  const aw = box(3.4, .12, 2.6, [0xc23b3b, 0x2f6fd6, 0xe0a020, 0x3a8a4a, 0x9a3fa0][i], 0, 2.65, 0, g); aw.rotation.x = .15; colorables.push({ mesh: aw });
  box(2.8, .7, 1.5, 0x7a5232, 0, .55, 0, g);
  for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.18, 6, 4), M([0xe8b030, 0x9ac040, 0xd04030, 0xf0e0a0][k % 4])); f.position.set(-1 + k * .4, 1, rnd(-.3, .3)); g.add(f); }
  if (i === 2) for (let k = 0; k < 4; k++) { const b = cyl(.12, .12, .4, 0xd8b030, -1 + k * .25, 1.1, .4, g); b.material = new THREE.MeshLambertMaterial({ color: 0xd8a020, transparent: true, opacity: .8 }); }
  circles.push({ x, z, r: 1.7 });
}
const lanterns = [];
for (let i = 0; i < 8; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd23a2a, emissive: 0x000000 })); l.position.set(44 + i * 3, 3.6 + Math.sin(i) * .2, 9); scene.add(l); lanterns.push(l); colorables.push({ mesh: l }); }
const marketLight = new THREE.PointLight(0xffb060, 0, 26, 1.5); marketLight.position.set(53, 5, 9); scene.add(marketLight);

// school
const school = new THREE.Group(); school.position.set(32, groundH(32, -46), -46); scene.add(school);
for (let i = -4; i <= 4; i += 2) for (const b of [-2, 2]) cyl(.15, .15, 1.4, 0x5a4a3a, i * 1.4, .5, b, school);
box(12, .2, 4.6, 0x6e4a2a, 0, 1.2, 0, school);
colorables.push({ mesh: box(11.8, 2.4, 4.4, 0x4a7ab0, 0, 2.5, 0, school) });
for (let i = -4; i <= 4; i += 2) box(1.1, .9, .05, 0x1a2a3a, i, 2.7, 2.25, school);
{ const r = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 13, 3), M(0xa03a26)); r.rotation.z = Math.PI / 2; r.rotation.x = Math.PI / 6 + Math.PI; r.position.set(0, 4.4, 0); r.scale.set(1, 1, 1.2); school.add(r); }
boxes.push({ x0: 25.5, x1: 38.5, z0: -48.5, z1: -43.5, on: true });
cyl(.06, .06, 8, 0xdddddd, 40, groundH(40, -40) + 4, -40); box(1.6, 1, .03, 0x2a4aa0, 40.8, groundH(40, -40) + 7.4, -40);
const sign = new THREE.Group(); sign.position.set(30, groundH(30, -38), -38); scene.add(sign);
const signPivot = new THREE.Group(); sign.add(signPivot);
box(.15, 2.2, .15, 0x5a3a22, -1.3, 1.1, 0, signPivot); box(.15, 2.2, .15, 0x5a3a22, 1.3, 1.1, 0, signPivot);
{ const pl = textPlane('ໂຮງຮຽນ', 3.3, 1.05, { size: 90, color: '#fff7e0', bg: '#2f5d8a' }); pl.position.set(0, 2.1, .09); signPivot.add(pl); box(3.4, 1.15, .14, 0x3a2414, 0, 2.1, 0, signPivot); }
signPivot.rotation.x = F.sign ? 0 : -Math.PI / 2 + .08;
const well = new THREE.Group(); well.position.set(42, groundH(42, -36), -36); scene.add(well);
cyl(1.1, 1.1, 1, 0x8a8a80, 0, .5, 0, well, 10); cyl(.95, .95, 1.02, 0x2a2a2a, 0, .52, 0, well, 10);
const wellWater = cyl(.92, .92, .05, 0x5aa0b0, 0, .9, 0, well, 10); wellWater.visible = !!F.well;
for (const s of [-1, 1]) box(.12, 2.4, .12, 0x5a3a22, s * 1, 1.2, 0, well); box(2.4, .1, 1, 0x8a3b22, 0, 2.5, 0, well);
circles.push({ x: 42, z: -36, r: 1.4 });
for (let i = 0; i < 14; i++) { const a = rnd(0, 6.28), r = rnd(1.5, 6); const p = new THREE.Mesh(new THREE.CircleGeometry(rnd(.4, .7), 7).rotateX(-Math.PI / 2), M(0x3f7a3a)); p.position.set(POND.x + Math.cos(a) * r, WATER_Y + .03, POND.z + Math.sin(a) * r); scene.add(p); if (i % 3 == 0) { const f = new THREE.Mesh(new THREE.ConeGeometry(.22, .35, 6), M(0xf08ab0)); f.position.copy(p.position).y += .17; scene.add(f); } }
// Yay's flowers
const flowerPots = new THREE.Group(); flowerPots.position.set(-3, groundH(-3, 5), 5); scene.add(flowerPots);
const blooms = [];
for (let i = 0; i < 3; i++) { cyl(.35, .25, .5, 0xa0522d, i * .9, .25, 0, flowerPots); const stem = cyl(.03, .03, .6, 0x6a7a3a, i * .9, .7, 0, flowerPots); stem.rotation.z = F.flowers ? 0 : .9; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 0), M(F.flowers ? 0xf06080 : 0x7a6a4a)); b.position.set(i * .9 + (F.flowers ? 0 : .3), F.flowers ? 1.05 : .8, 0); flowerPots.add(b); blooms.push({ b, stem }); }
circles.push({ x: -2.1, z: 5, r: 1.4 });

// river docks & boat
const DOCKZ = 10, rx0 = riverX(DOCKZ);
const DOCK = { east: { x: rx0 + 9.5, bx: rx0 + 4 }, west: { x: rx0 - 9.5, bx: rx0 - 4 } };
for (const side of ['east', 'west']) { const s = side === 'east' ? 1 : -1; for (let i = 0; i < 7; i++) box(.85, .12, 2.2, 0x7a5a3a, rx0 + s * (4.6 + i * .9), .35, DOCKZ); for (const a of [5, 10]) for (const b of [-1, 1]) cyl(.1, .1, 3, 0x4a3a2a, rx0 + s * a, -.8, DOCKZ + b); floors.push({ x0: Math.min(rx0 + s * 4.2, rx0 + s * 10.6), x1: Math.max(rx0 + s * 4.2, rx0 + s * 10.6), z0: DOCKZ - 1.1, z1: DOCKZ + 1.1, h: .42 }); }
for (const s of [-1, 1]) for (let i = 0; i < 3; i++) cyl(.18, .2, 4, 0x4a3a2a, riverX(-60) + s * (3 + i * 1.6), -.5 + i * .3, -60);
const boat = new THREE.Group(); scene.add(boat);
{ colorables.push({ mesh: box(1.6, .5, 4.6, 0x6a4024, 0, 0, 0, boat) }); for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(.8, 1.4, 4), M(0x6a4024)); c.rotation.x = s * Math.PI / 2; c.rotation.y = Math.PI / 4; c.position.z = s * 3; c.scale.set(1, 1, .4); boat.add(c); } box(1.4, .1, .4, 0x8a6040, 0, .2, .6, boat); const paddle = box(.08, .08, 2.4, 0xa07850, .5, .4, -.5, boat); paddle.rotation.x = .3; }
const boatState = { side: S.boatSide, moving: false, riding: false };
function placeBoat() { boat.position.set(DOCK[boatState.side].bx, WATER_Y + .25, DOCKZ); }
placeBoat();

// stone heads
for (const H of HEADS) {
  const [x, z] = H.pos, g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = Math.atan2(-x, -z); scene.add(g);
  const stone = 0x8c8678, dark = 0x3a3830;
  box(3.6, 1, 3.6, 0x6e6a60, 0, .5, 0, g); box(2.8, 3.6, 2.6, stone, 0, 2.8, 0, g); box(3.1, .5, 2.9, 0x7a7466, 0, 4.7, 0, g);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2, 4), M(0x7a7466)); crown.position.y = 5.9; crown.rotation.y = Math.PI / 4; g.add(crown);
  for (const s of [-1, 1]) { box(.7, .12, .1, dark, s * .6, 3.3, 1.31, g); box(.2, 1, .4, stone, s * 1.5, 2.8, .4, g); }
  box(.4, .9, .3, 0x9a9486, 0, 2.7, 1.4, g); box(1, .16, .1, dark, 0, 1.9, 1.31, g);
  const mark = new THREE.Mesh(new THREE.CircleGeometry(.35, 12), new THREE.MeshBasicMaterial({ color: H.color })); mark.position.set(0, 4.05, 1.32); g.add(mark);
  for (let d = 0; d < H.dots; d++) { const dm = new THREE.Mesh(new THREE.CircleGeometry(.14, 8), new THREE.MeshBasicMaterial({ color: H.color })); dm.position.set((d - (H.dots - 1) / 2) * .45, .55, 1.82); g.add(dm); }
  for (let k = 0; k < 5; k++) box(rnd(.4, .9), .1, rnd(.3, .6), 0x4f6a2a, rnd(-1.2, 1.2), 4.55 + rnd(0, .2), rnd(-1, 1), g);
  circles.push({ x, z, r: 2.4 });
  interact.push({ x, z, r: 4.5, label: () => 'Touch the stone face', act: () => touchHead(H) });
}

// temple
const T = TEMPLE; const tg = new THREE.Group(); tg.position.set(T.x, T.h, T.z); scene.add(tg);
[[16, .6], [13, 1.2], [10.5, 1.8]].forEach(([s, h], i) => { box(s, .6, s, i % 2 ? 0x8a8478 : 0x8a5a3a, 0, h - .3, 0, tg); floors.push({ x0: T.x - s / 2, x1: T.x + s / 2, z0: T.z - s / 2, z1: T.z + s / 2, h: T.h + h }); });
const RF = 1.8, RS = 7, RW = 3.6, grey = 0x8a8478;
box(.6, RW, RS, grey, -RS / 2, RF + RW / 2, 0, tg); box(RS, RW, .6, grey, 0, RF + RW / 2, -RS / 2, tg); box(RS, RW, .6, grey, 0, RF + RW / 2, RS / 2, tg);
box(.6, RW, 2.5, grey, RS / 2, RF + RW / 2, -2.25, tg); box(.6, RW, 2.5, grey, RS / 2, RF + RW / 2, 2.25, tg); box(.6, 1, 2, grey, RS / 2, RF + RW - .5, 0, tg);
box(RS + .6, .5, RS + .6, 0x7a7466, 0, RF + RW + .25, 0, tg);
for (let i = 0; i < 5; i++) { const r = 4.4 - i * .75, h = 1.8; const m = new THREE.Mesh(new THREE.CylinderGeometry(r * .82, r, h, 4), M(i % 2 ? 0x8a8478 : 0x7a7466)); m.rotation.y = Math.PI / 4; m.position.y = RF + RW + .5 + h / 2 + i * h; tg.add(m); }
{ const m = new THREE.Mesh(new THREE.ConeGeometry(.7, 2.6, 4), M(0x6e6a60)); m.rotation.y = Math.PI / 4; m.position.y = RF + RW + 10.8; tg.add(m); }
const wallC = (x0, x1, z0, z1) => boxes.push({ x0: T.x + x0, x1: T.x + x1, z0: T.z + z0, z1: T.z + z1, on: true });
wallC(-3.8, -3.2, -3.8, 3.8); wallC(-3.8, 3.8, -3.8, -3.2); wallC(-3.8, 3.8, 3.2, 3.8); wallC(3.2, 3.8, -3.8, -1); wallC(3.2, 3.8, 1, 3.8);
const door = box(.4, 2.6, 2, 0x5a5448, RS / 2 + .1, RF + 1.3, 0, tg);
const doorCol = { x0: T.x + 3.1, x1: T.x + 3.9, z0: T.z - 1, z1: T.z + 1, on: !F.door }; boxes.push(doorCol); if (F.door) door.position.z = 2;
const sockets = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), new THREE.MeshLambertMaterial({ color: 0x333333, emissive: 0x000000 })); m.position.set(RS / 2 + .35, RF + RW - .5, (i - 1) * .6); tg.add(m); return m; });
box(1.4, 1, 2, 0x6e6a60, -2.4, RF + .5, 0, tg);
const altarStone = new THREE.Mesh(new THREE.DodecahedronGeometry(.3, 0), new THREE.MeshLambertMaterial({ color: 0xbfae80, emissive: 0x3a2a00 })); altarStone.position.set(-2.4, RF + 1.3, 0); tg.add(altarStone);
const lamps = [[-2.6, -2.6], [-2.6, 2.6], [2.4, -2.6], [2.4, 2.6]].map(([a, b]) => { cyl(.15, .25, .9, 0x6a5030, a, RF + .45, b, tg); const f = new THREE.Mesh(new THREE.ConeGeometry(.14, .4, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 })); f.position.set(a, RF + 1.1, b); f.visible = !!F.lamps; tg.add(f); return f; });
const templeLight = new THREE.PointLight(0xffa040, F.lamps ? 2.5 : 0, 12, 1.5); templeLight.position.set(T.x, T.h + RF + 2.5, T.z); scene.add(templeLight);
const roomDark = box(6.3, RW - .05, 6.3, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .85, side: THREE.BackSide, depthWrite: false }), 0, RF + RW / 2, 0, tg); roomDark.visible = !F.lamps;
{ const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320; const c = cv.getContext('2d'); c.fillStyle = '#5a3a1a'; c.fillRect(0, 0, 256, 320); c.fillStyle = '#e8d8b0'; c.fillRect(16, 16, 224, 288); c.fillStyle = '#c9a46a'; c.fillRect(16, 200, 224, 104); c.fillStyle = '#4a2a1a'; c.beginPath(); c.arc(128, 120, 46, 0, 7); c.fill(); c.fillStyle = '#b07a50'; c.beginPath(); c.arc(128, 128, 38, 0, 7); c.fill(); c.fillStyle = '#7a3b5c'; c.fillRect(70, 170, 116, 134); c.fillStyle = '#d8b25a'; c.fillRect(70, 170, 116, 14); c.fillStyle = '#3a2a1a'; c.font = '28px "Noto Sans Lao", sans-serif'; c.textAlign = 'center'; c.fillText('ຢາຍ', 128, 60);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), new THREE.MeshLambertMaterial({ map: t })); p.position.set(-RS / 2 + .32, RF + 2.3, 0); p.rotation.y = Math.PI / 2; tg.add(p); }
for (let i = 0; i < 6; i++) { const x = -88 - i * 2, z = -12 - i * 1.3; cyl(.12, .12, 1.4, 0xd9771f, x, groundH(x, z) + .7, z + 2); }

/* ---------------- town ---------------- */
function shophouse(x, z, face, color, open = true) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = face; scene.add(g);
  const W = 7, H = 9, D = 9;
  box(W, H, D, color, 0, H / 2, -D / 2 - .5, g);
  if (open) box(W - 1, 2.6, .1, 0x1e1a18, 0, 1.4, -.42, g);
  for (const y of [4.3, 7]) { box(W - .4, .15, 1, 0xd8d0c0, 0, y - .9, 0, g); for (const wx of [-1.8, 0, 1.8]) box(1.2, 1.6, .05, 0x3a4a5a, wx, y, -.45, g); }
  box(W + .2, .5, D + .4, 0xc8c0b0, 0, H + .25, -D / 2 - .5, g);
  const c = Math.cos(face), s = Math.sin(face), cx = x - s * (D / 2 + .5), cz = z - c * (D / 2 + .5);
  boxes.push({ x0: cx - (Math.abs(c) * W + Math.abs(s) * D) / 2, x1: cx + (Math.abs(c) * W + Math.abs(s) * D) / 2, z0: cz - (Math.abs(s) * W + Math.abs(c) * D) / 2, z1: cz + (Math.abs(s) * W + Math.abs(c) * D) / 2, on: true });
  return g;
}
const SHOPCOL = [0xe8c8a0, 0x9ac0b0, 0xe0a090, 0xf0e0a0, 0xb0c8e0, 0xd8a8c8, 0xc8d8a0];
for (let x = 150; x <= 244; x += 7.4) {
  if (!(x > 156 && x < 176)) shophouse(x, -14, 0, x > 196 && x < 204 ? 0xb83a2a : SHOPCOL[Math.floor(x) % 7]);
  if (!(x < 154)) shophouse(x, 14, Math.PI, SHOPCOL[(Math.floor(x) + 3) % 7]);
}
// gas station
{ const g = new THREE.Group(); g.position.set(166, groundH(166, -12), -12); scene.add(g);
  for (const a of [-5, 5]) for (const b of [-3, 3]) cyl(.18, .18, 4.6, 0xdddddd, a, 2.3, b, g);
  box(12, .5, 8, 0xc0302a, 0, 4.8, 0, g); box(12.2, .2, 8.2, 0xffffff, 0, 4.5, 0, g);
  for (const a of [-2.5, 2.5]) { box(.8, 1.6, .6, 0xe8e8e8, a, .8, 0, g); box(.82, .5, .62, 0xc0302a, a, 1.4, 0, g); circles.push({ x: 166 + a, z: -12, r: .7 }); }
}
// mechanic shed
{ const g = new THREE.Group(); g.position.set(146, groundH(146, 20), 20); scene.add(g);
  for (const a of [-4, 4]) for (const b of [-3, 3]) cyl(.12, .12, 3.4, 0x6a6a6a, a, 1.7, b, g);
  const r = box(9, .2, 7, 0x6a7a8a, 0, 3.5, 0, g); r.rotation.x = .1; box(8.6, 3, .1, 0x4a4a4a, 0, 1.5, 3, g);
  box(1.2, .9, .8, 0x2a5a9a, 2.5, .45, 0, g);
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.42, .16, 6, 12), M(0x1a1a1a)); t.rotation.x = Math.PI / 2; t.position.set(-6.5, .16 + i * .3, -5.5); g.add(t); }
  boxes.push({ x0: 141.5, x1: 150.5, z0: 22.8, z1: 23.3, on: true });
}
const tyresPos = { x: 139.5, z: 14.5 };
// cafe tables
for (const a of [-2.5, 2.5]) { cyl(.6, .6, .06, 0xf0e8d8, 216 + a, groundH(216, 10) + .8, 9.5, null, 10); cyl(.06, .06, .8, 0x777777, 216 + a, groundH(216, 10) + .4, 9.5); circles.push({ x: 216 + a, z: 9.5, r: .7 }); }
// parked car
const car = new THREE.Group(); car.position.set(182, groundH(182, 6), 6); scene.add(car);
box(4.2, .9, 1.9, 0xe0e0e8, 0, .8, 0, car); box(2.4, .8, 1.7, 0xc8d8e8, -.2, 1.6, 0, car); for (const a of [-1.4, 1.4]) for (const b of [-1, 1]) { const w = cyl(.38, .38, .3, 0x1a1a1a, a, .38, b * .95, car, 10); w.rotation.x = Math.PI / 2; }
boxes.push({ x0: 179.8, x1: 184.2, z0: 5, z1: 7, on: true });
// street lamps
const streetLamps = [];
for (let x = 150; x <= 240; x += 18) { cyl(.08, .1, 5, 0x444444, x, groundH(x, 6) + 2.5, 6.5); const b = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), new THREE.MeshLambertMaterial({ color: 0xfff0c0, emissive: 0x000000 })); b.position.set(x, groundH(x, 6) + 5.1, 6.5); scene.add(b); streetLamps.push(b); }
// Che's shop lanterns (Hia's quest)
const shopLanterns = [];
for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd23a2a, emissive: F.hiaLit ? 0xd23a2a : 0x000000 })); l.position.set(196.5 + i * 2.3, 3.4, -8.6); scene.add(l); shopLanterns.push(l); }
const shopLight = new THREE.PointLight(0xff7040, F.hiaLit ? 2 : 0, 18, 1.5); shopLight.position.set(200, 4, -7); scene.add(shopLight);
// signs
for (const sg of SIGNS) {
  const p = textPlane(sg.word, 3.4, 1.1, { size: 92, color: '#ffffff', bg: sg.color });
  const y = groundH(sg.x, sg.z) + 3.4; p.position.set(sg.x, y, sg.z);
  if (sg.z < 0) p.rotation.y = 0; else p.rotation.y = Math.PI;
  if (sg.word === 'ບ້ານມ່ວງ') { for (const s of [-1.5, 1.5]) cyl(.08, .08, 3.4, 0x5a3a22, sg.x + s, groundH(sg.x, sg.z) + 1.7, sg.z - .05); p.position.y = groundH(sg.x, sg.z) + 3; }
  if (sg.word === 'ເມືອງ') { p.rotation.y = -Math.PI / 2; cyl(.08, .08, 3, 0x6a6a6a, sg.x, groundH(sg.x, sg.z) + 1.5, sg.z); p.position.y = groundH(sg.x, sg.z) + 3; }
  if (sg.word === 'ນ້ຳມັນ') { cyl(.12, .12, 6, 0x888888, sg.x, groundH(sg.x, sg.z) + 3, sg.z - .2); p.position.y = groundH(sg.x, sg.z) + 6; }
  if (sg.word === 'ແປງ') p.position.y = groundH(sg.x, sg.z) + 4.1;
  scene.add(p);
  interact.push({ x: sg.x, z: sg.z + (sg.z < 0 ? 4 : -4) * (sg.word === 'ເມືອງ' ? 0 : 1), r: 5, label: () => 'Read the sign', kh: sg.word, act: () => { const n = learn(sg.word, true); playWord(sg.word); toast(sg.word, n ? 'You read the sign: ' + VOCAB[sg.word] : VOCAB[sg.word]); if (n) chime([523, 784]); save(); } });
}

/* ---------------- people & animals ---------------- */
const npcObjs = {};
for (const [id, n] of Object.entries(NPCS)) {
  if (n.hidden) continue;
  const hh = n.house ? HOUSES[n.house] : null; const [x, z] = hh ? L2W(hh, n.pos[0], n.pos[1]) : n.pos;
  const g = new THREE.Group(); g.position.set(x, hh ? hh.floor : groundH(x, z), z); scene.add(g);
  const body = new THREE.Group(); g.add(body); const sc = n.small ? .68 : 1; body.scale.setScalar(sc);
  const skin = 0xa8734a;
  if (n.robe) { cyl(.35, .7, 1.2, n.color, 0, .6, 0, body, 8); const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), M(skin)); head.position.y = 1.45; body.add(head); const sash = box(.8, .9, .1, 0xc0601a, 0, .85, .1, body); sash.rotation.z = .5; }
  else {
    cyl(.22, .26, .8, 0x2a2a3a, 0, .4, 0, body); cyl(.28, .32, .75, n.color, 0, 1.15, 0, body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), M(skin)); head.position.y = 1.78; body.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.27, 10, 6, 0, 6.3, 0, 1.6), M(n.old ? 0xd8d8d0 : 0x1a1410)); hair.position.y = 1.82; body.add(hair);
    const kr = new THREE.Mesh(new THREE.TorusGeometry(.26, .07, 5, 10), M(n.krama)); kr.rotation.x = Math.PI / 2; kr.position.y = 1.5; body.add(kr);
    if (n.hat) { const h = new THREE.Mesh(new THREE.ConeGeometry(.6, .35, 10), M(0xd8c080)); h.position.y = 2.1; body.add(h); }
    for (const s of [-1, 1]) { const a = cyl(.07, .07, .65, n.color, s * .36, 1.15, 0, body); a.rotation.z = s * .15; }
    if (n.old) body.rotation.x = .12;
  }
  const label = textSprite(n.km, { size: 54, w: 384, h: 96, scale: .55, bg: 'rgba(20,32,31,.7)' }); label.position.y = (n.robe ? 2.1 : 2.45) * sc + .2; g.add(label);
  npcObjs[id] = { g, body, n, home: [x, z], y: g.position.y };
  if (!hh) circles.push({ x, z, r: .6 });
  interact.push({ house: n.house, x, z, r: hh ? 3 : 4.2, label: () => 'Talk to', kh: n.km, act: () => talkTo(id), on: () => id !== 'monk' || F.lamps });
}
npcObjs.monk.g.position.y = T.h + RF; npcObjs.monk.body.scale.y = .8;
// kid's ball
const ball = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })); ball.visible = !!F.ballGiven; scene.add(ball);
if (F.ballColor) ball.material.color.setHex(F.ballColor);
// dog
const dog = new THREE.Group(); scene.add(dog);
box(.9, .4, .35, 0xb08a5a, 0, .5, 0, dog); box(.35, .3, .3, 0xb08a5a, .55, .7, 0, dog); box(.12, .12, .1, 0x2a1a10, .75, .66, 0, dog);
const tail = box(.35, .07, .07, 0xb08a5a, -.55, .7, 0, dog); tail.rotation.z = .6;
const dogLegs = []; for (const a of [-.3, .3]) for (const b of [-.12, .12]) dogLegs.push(box(.1, .35, .1, 0x9a7a4a, a, .18, b, dog));
const dogBubble = textSprite('!', { size: 90, w: 128, h: 128, scale: .6, color: '#ffe080' }); dogBubble.position.y = 1.4; dogBubble.visible = false; dog.add(dogBubble);
const dogS = { x: 6, z: 9, tx: 6, tz: 9, sit: false, t: 0, barkT: 0 };
const chickens = [];
for (let i = 0; i < 5; i++) { const c = new THREE.Group(); box(.35, .3, .25, i % 2 ? 0xe8e0d0 : 0x9a4a2a, 0, .3, 0, c); box(.15, .2, .15, 0xc23b3b, .2, .5, 0, c); scene.add(c); chickens.push({ c, x: -14 + rnd(-3, 3), z: 14 + rnd(-3, 3), a: rnd(0, 6), hx: -14, hz: 14, tx: null, tz: null }); }

/* ---------------- motorbike ---------------- */
const moto = Object.assign({ speed: 0, riding: false, boostT: 0 }, S.moto);
const motoG = new THREE.Group(); scene.add(motoG);
const motoBody = new THREE.Group(); motoG.add(motoBody);
const wheels = [];
for (const z of [-.75, .75]) { const w = new THREE.Mesh(new THREE.TorusGeometry(.32, .1, 6, 14), M(0x1a1a1a)); w.rotation.y = Math.PI / 2; w.position.set(0, .42, z); motoBody.add(w); wheels.push(w); }
const motoPaint = new THREE.MeshLambertMaterial({ color: 0xb02a2a }); colorables.push({ mesh: box(.35, .35, 1.1, motoPaint, 0, .75, .1, motoBody), moto: true });
box(.3, .15, .7, 0x1a1a1a, 0, 1.0, -.15, motoBody); box(.12, .6, .12, 0x888888, 0, 1.0, .65, motoBody); box(.8, .06, .06, 0x888888, 0, 1.3, .6, motoBody);
const headlight = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6d0 })); headlight.position.set(0, 1.12, .78); motoBody.add(headlight);
const rider = new THREE.Group(); rider.visible = false; motoBody.add(rider);
cyl(.26, .3, .7, 0x3a5a8a, 0, 1.45, -.15, rider); { const h = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), M(0xe8e8e8)); h.position.set(0, 2.02, -.1); rider.add(h); }
const motoLight = new THREE.SpotLight(0xfff0c0, 0, 30, .5, .5, 1); motoLight.position.set(0, 1.1, .8); motoBody.add(motoLight); motoBody.add(motoLight.target); motoLight.target.position.set(0, 0, 8);
function placeMoto() { motoG.position.set(moto.x, groundH(moto.x, moto.z), moto.z); motoG.rotation.y = moto.yaw; motoBody.rotation.z = moto.fallen ? 1.35 : 0; wheels[0].scale.y = wheels[1].scale.y = 1; wheels[0].position.y = moto.flat ? .3 : .42; }
placeMoto();

/* ---------------- word stones ---------------- */
const stoneObjs = [];
for (let [w, x, z, mode, hint, hid] of STONES) {
  const sh = mode === 'house' ? HOUSES[hid] : null; if (sh) [x, z] = L2W(sh, x, z);
  let y = sh ? sh.floor : mode === 'temple' ? T.h + RF : mode === 'night' && w === 'ບົວ' ? WATER_Y + .1 : mode === 'far' ? WATER_Y + .1 : groundH(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const st = new THREE.Mesh(new THREE.DodecahedronGeometry(.32, 0), new THREE.MeshLambertMaterial({ color: 0xc8b88a, emissive: 0x2a1e06 })); st.scale.set(.8, 1.3, .8); st.position.y = .4; g.add(st);
  const glyph = textSprite(w, { size: 64, w: 512, h: 128, scale: .5 }); glyph.position.y = 1.1; g.add(glyph);
  let cover = null;
  if (mode === 'mud') { cover = new THREE.Mesh(new THREE.SphereGeometry(.55, 7, 5), M(0x5a4028)); cover.scale.y = .7; cover.position.y = .35; g.add(cover); }
  if (mode === 'fallen') st.rotation.z = Math.PI / 2;
  const o = { w, x, z, g, st, glyph, cover, mode, hint, y0: y };
  o.got = S.stones.includes(w); o.ok = S.revealed.includes(w) || ['plain', 'night', 'temple', 'house'].includes(mode);
  stoneObjs.push(o); styleStone(o);
  interact.push({ house: hid, get x() { return o.g.position.x; }, get z() { return o.g.position.z; }, r: w === 'ບົວ' ? 9 : 2.2, label: () => !o.ok ? stoneLabel(o) : o.got ? 'Hear the stone' : 'Read the word stone', kh: null, act: () => readStone(o), on: () => stoneVisible(o) && (o.ok || o.mode !== 'dig') });
}
function stoneLabel(o) { return { mud: 'A lump of mud', dark: 'Something in the darkness', fallen: 'A stone lying face down', far: '', dig: '', secret: '' }[o.mode] || 'A stone'; }
function stoneVisible(o) { if (o.mode === 'night' && nightT < .5) return false; if (o.mode === 'temple' && !F.lamps) return false; if ((o.mode === 'dig' || o.mode === 'secret') && !o.ok) return false; return true; }
function styleStone(o) {
  if (o.cover) o.cover.visible = !o.ok;
  if (o.mode === 'dark') o.st.material.color.setHex(o.ok ? 0xc8b88a : 0x111111);
  if (o.mode === 'fallen' && o.ok) o.st.rotation.z = 0;
  o.glyph.visible = o.ok; o.glyph.material.opacity = o.got ? .35 : 1;
  if (o.got) { o.st.material.color.setHex(0x7a7466); o.st.material.emissive.setHex(0); }
}
function reveal(o, msg) { if (o.ok) return; o.ok = true; if (!S.revealed.includes(o.w)) S.revealed.push(o.w); styleStone(o); burst(o.g.position.x, o.g.position.y + 1, o.g.position.z, 0xf6e3b0, 30); if (msg) toast('', msg); save(); }
function readStone(o) {
  if (!o.ok) { toast('', { mud: 'Caked in mud. Maybe water would wash it.', dark: 'Too dark to see. You need light.', fallen: 'It lies face down. If only it would stand.' }[o.mode] || 'Hidden.'); return; }
  const isNew = !o.got; o.got = true; if (!S.stones.includes(o.w)) S.stones.push(o.w); styleStone(o);
  const warp = !!PLACES[o.w]; learn(o.w, true); if (SPELLS[o.w] && !warp) teachSpell(o.w);
  playWord(o.w); toast(o.w, (SPELLS[o.w] && !warp ? 'Spell learned: ' : isNew ? 'New word: ' : '') + VOCAB[o.w]);
  if (isNew) chime([523, 784, 1046]); save(); refreshObjective();
}
const stoneByWord = w => stoneObjs.find(o => o.w === w);

/* ---------------- particles ---------------- */
const PN = 500, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pData = [];
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
for (let i = 0; i < PN; i++) { pData.push({ life: 0 }); pPos[i * 3 + 1] = -999; }
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .28, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; scene.add(pts);
let pIdx = 0;
function emit(x, y, z, vx, vy, vz, color, life = 1.2, grav = -2) { const i = pIdx = (pIdx + 1) % PN, d = pData[i], c = new THREE.Color(color); Object.assign(d, { x, y, z, vx, vy, vz, life, grav }); pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b; }
function burst(x, y, z, color, n = 40, sp = 3) { for (let i = 0; i < n; i++) emit(x, y, z, rnd(-sp, sp), rnd(0, sp * 1.4), rnd(-sp, sp), color, rnd(.7, 1.5)); }
function tickParticles(dt) { for (let i = 0; i < PN; i++) { const d = pData[i]; if (d.life <= 0) { pPos[i * 3 + 1] = -999; continue; } d.life -= dt; d.vy += d.grav * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; pPos[i * 3] = d.x; pPos[i * 3 + 1] = d.y; pPos[i * 3 + 2] = d.z; } pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; }
const ffGeo = new THREE.BufferGeometry(), ffN = 120, ffP = new Float32Array(ffN * 3), ffSeed = [];
for (let i = 0; i < ffN; i++) { const a = rnd(0, 6.28), r = rnd(5, 70); ffSeed.push([Math.cos(a) * r, Math.sin(a) * r, rnd(0, 6)]); }
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffP, 3));
const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xd8ff70, size: .12, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); fireflies.frustumCulled = false; scene.add(fireflies);

/* ---------------- player ---------------- */
const player = { x: S.pos[0], z: S.pos[1], yaw: S.yaw, pitch: -0.05, swiftT: 0 };
const EYE = 1.6;
function blocked(x, z, r = .35) {
  if (x < -126 || x > 246 || Math.abs(z) > 126) return true;
  if (baseH(x, z) < -0.25 && groundH(x, z) < 0.3) return true;
  for (const c of circles) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + r) ** 2) return true; }
  for (const b of boxes) if (b.on && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true;
  return false;
}
// how far a point at radius r is pushed into solid things (0 = free)
function overlap(x, z, r) {
  let o = 0;
  for (const c of circles) { const d = Math.hypot(x - c.x, z - c.z); o = Math.max(o, c.r + r - d); }
  for (const b of boxes) if (b.on) { const e = Math.min(x - (b.x0 - r), (b.x1 + r) - x, z - (b.z0 - r), (b.z1 + r) - z); o = Math.max(o, e); }
  return o;
}
function hardBlocked(x, z) { return x < -126 || x > 246 || Math.abs(z) > 126 || (baseH(x, z) < -0.25 && groundH(x, z) < 0.3); }
function canStep(x0, z0, x1, z1, r) {
  if (hardBlocked(x1, z1) && !hardBlocked(x0, z0)) return false;
  const o1 = overlap(x1, z1, r); if (o1 > 0 && o1 >= overlap(x0, z0, r) - 1e-4) return false; // only allow moves that get you out
  const d = Math.hypot(x1 - x0, z1 - z0) || 1e-6, dh = groundH(x1, z1) - groundH(x0, z0);
  if (dh > .8) return false;
  const th = baseH(x1, z1) - baseH(x0, z0); // steep natural slopes (hills) only; stone steps are fine
  if (th / d > 1.1 && th > .05 && dh > .05) return false;
  return true;
}
let stuckFrames = 0;
function tryMove(dx, dz) {
  // escape hatch: if you've pushed against something for a while, the slope rule is relaxed
  const loose = stuckFrames > 45;
  const s = (nx, nz) => { if (!(canStep(player.x, player.z, nx, nz, .28) || (loose && !hardBlocked(nx, nz) && overlap(nx, nz, .28) <= 0 && groundH(nx, nz) - groundH(player.x, player.z) < 1.2))) return false; player.x = nx; player.z = nz; return true; };
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2)); let moved = false;
  for (let i = 0; i < n; i++) { const ok = s(player.x + dx / n, player.z + dz / n) || s(player.x + dx / n, player.z) || s(player.x, player.z + dz / n); if (!ok) break; moved = true; }
  if (moved) stuckFrames = 0; else stuckFrames++;
}
let camY = groundH(player.x, player.z) + EYE;

/* ---------------- input ---------------- */
const input = { jx: 0, jy: 0, keys: {} };
let uiOpen = null;
const joy = $('#joy'), ring = $('#joyring'), knob = $('#joyknob');
let joyId = null, joyO = null, lookId = null, lookLast = null, lookMoved = 0, camOff = 0;
function joyStart(id, x, y) { joyId = id; joyO = { x, y }; ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.classList.remove('hide'); $('#joyhint').classList.add('hide'); }
function joyMove(x, y) { let dx = x - joyO.x, dy = y - joyO.y; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; input.jx = dx / m; input.jy = dy / m; }
function joyEnd() { joyId = null; input.jx = input.jy = 0; ring.classList.add('hide'); knob.style.transform = ''; }
joy.addEventListener('pointerdown', e => { if (uiOpen) return; joy.setPointerCapture(e.pointerId); joyStart(e.pointerId, e.clientX, e.clientY); e.preventDefault(); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e.clientX, e.clientY); });
joy.addEventListener('pointerup', e => { if (e.pointerId === joyId) joyEnd(); });
joy.addEventListener('pointercancel', e => { if (e.pointerId === joyId) joyEnd(); });
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => { if (uiOpen) return; ensureAudio(); lookId = e.pointerId; lookLast = { x: e.clientX, y: e.clientY }; lookMoved = 0; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (e.pointerId !== lookId) return; const dx = e.clientX - lookLast.x, dy = e.clientY - lookLast.y; lookMoved += Math.abs(dx) + Math.abs(dy); lookLast = { x: e.clientX, y: e.clientY }; const k = e.pointerType === 'mouse' ? .0045 : .006; if (moto.riding) camOff -= dx * k; else { player.yaw -= dx * k; player.pitch = Math.max(-1.2, Math.min(1.1, player.pitch - dy * k)); } });
cv.addEventListener('pointerup', e => { if (e.pointerId !== lookId) return; lookId = null; if (lookMoved < 8 && curInteract) curInteract.act(); });
addEventListener('keydown', e => {
  if (uiOpen === 'kb') return kbKey(e);
  if (uiOpen === 'dlg' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return dlgNext(); }
  if (uiOpen) { if (e.key === 'Escape') closeAll(); return; }
  input.keys[e.code] = true;
  if (e.code === 'KeyE' && curInteract) curInteract.act();
  if (e.code === 'KeyT' || e.code === 'Enter') { e.preventDefault(); openKB(); }
  if (e.code === 'KeyB') openBook();
});
addEventListener('keyup', e => { input.keys[e.code] = false; });
function releaseAll() { input.keys = {}; joyEnd(); lookId = null; if (moto.riding) moto.speed *= .5; }
addEventListener('blur', releaseAll); document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
addEventListener('pagehide', releaseAll); addEventListener('contextmenu', releaseAll);
cv.addEventListener('pointercancel', () => { lookId = null; }); cv.addEventListener('lostpointercapture', () => { lookId = null; });

/* ---------------- HUD ---------------- */
let toastT;
function toast(km, en) { const t = $('#toast'); t.innerHTML = (km ? `<span class="big">${esc(km)}</span>${ROM[km] ? `<span class="rom">${esc(ROM[km])}</span><br>` : ''}` : '') + (en ? `<span class="tx">${esc(en)}</span>` : ''); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }
function updateHUD() { $('#hearts').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < S.hp ? 'on' : ''}">\u2665</span>`).join(''); $('#count').textContent = S.known.length; $('#money').innerHTML = `<span class="kh">${khNum(S.money)}</span> ₭`; }
function objective() {
  if (F.ended) { const left = STONES.length - S.stones.length; return [`Explore freely. ${left} word stones remain. Open the book for quests.`, 'The village is yours', null]; }
  if (!F.met) return ['Someone is waiting under the house. Talk to her.', 'You wake up', NPCS.yay.pos];
  if (!F.flowers) return ['Grandma’s flowers need water. Tap <b>speak</b> and say <span class="kh">ນ້ຳ</span> near them.', 'Your first word', [-2, 5]];
  if (!F.errand) return ['Talk to Grandma again.', 'Water', NPCS.yay.pos];
  if (!F.fish) { if (!F.sok) return ['Find <span class="kh">ດາວ</span> at the market (<span class="kh">ຕະຫຼາດ</span>), east. She teaches numbers.', 'An errand', NPCS.sok.pos]; if (!has('ປາ')) return ['Buy one fish (<span class="kh">ປາ</span>) from the market seller. Listen to the price.', 'An errand', NPCS.vendor.pos]; return ['Bring the fish to Grandma.', 'An errand', NPCS.yay.pos]; }
  if (!F.metKru) return ['Go to the school (<span class="kh">ໂຮງຮຽນ</span>) to the north-east.', 'The stone', NPCS.kru.pos];
  if (!F.sign) return ['Raise the fallen school sign: say <span class="kh">ຢືນ</span> near it.', 'The teacher', [30, -38]];
  if (!F.kru2) return ['Talk to the teacher again.', 'The teacher', NPCS.kru.pos];
  if (!F.crossed) { const n = S.heads.length; return [`Find the three stone faces (${n}/3), then cross the river west by boat.`, 'The temple on the hill', n < 3 ? nearestHead() : [DOCK.east.x, DOCKZ]]; }
  if (!F.door) return ['Climb to the temple. Speak the colours at its door, in the order the stone faces count.', 'The temple door', [T.x + 4, T.z]];
  if (!F.lamps) return ['It is dark inside. Bring light.', 'Darkness', [T.x, T.z]];
  if (!F.monk) return ['Someone sits in the lamplight. Talk to him.', 'The monk', NPCS.monk.pos];
  return ['Say the monk’s last word at the altar stone.', 'The altar', [T.x - 2.4, T.z]];
}
function nearestHead() { let b = null, bd = 1e9; for (const h of HEADS) if (!S.heads.includes(h.word)) { const d = dist(h.pos[0], h.pos[1]); if (d < bd) { bd = d; b = h.pos; } } return b; }
let objTarget = null;
function refreshObjective() { const [t, s, tg2] = objective(); $('#obj').innerHTML = `<small>${s}</small>${t}`; objTarget = tg2; }
function drawCompass() {
  const c = $('#compass'), W = c.clientWidth; let h = ''; const yaw = moto.riding ? moto.yaw + Math.PI : player.yaw;
  const rel = a => { let d = a - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  for (const [n, a] of [['N', 0], ['E', -Math.PI / 2], ['S', Math.PI], ['W', Math.PI / 2]]) { const d = rel(a); if (Math.abs(d) < 1.2) h += `<b style="left:${W / 2 - d / 1.2 * W / 2}px">${n}</b>`; }
  if (objTarget) { const a = Math.atan2(-(objTarget[0] - player.x), -(objTarget[1] - player.z)); const d = Math.max(-1.15, Math.min(1.15, rel(a))); h += `<i style="left:${W / 2 - d / 1.2 * W / 2}px"></i>`; }
  c.innerHTML = h;
}

/* ---------------- dialogue ---------------- */
let dlg = null;
const isPunct = t => /^[.!?:«»….,₭]+$/.test(t) || t === '...';
function tokens(line) { return line.split(' ').filter(Boolean).map(t => { const m = t.match(/^(.*)\{(.*)\}$/); return m ? { km: m[1], gl: m[2] } : { km: t, gl: VOCAB[t] }; }); }
function talk(id, after) { if (typeof id === 'string') id = TALK[id]; dlg = { lines: id, i: 0, after }; uiOpen = 'dlg'; joyEnd(); $('#dlg').classList.remove('hide'); showLine(); }
function showLine() {
  const [who, km] = dlg.lines[dlg.i], n = NPCS[who]; speaking = who;
  $('#dlg .who').innerHTML = `<span class="kh">${esc(n.km)}</span><em>${n.bilingual ? 'tap a word to see what it means' : 'speaks only Lao'}</em>`;
  const tk = tokens(km);
  $('#line').innerHTML = tk.map((t, i) => {
    if (isPunct(t.km)) return `<span class="p">${esc(t.km)}</span>`;
    const num = /^[໐-໙]+$/.test(t.km);
    if (!num) hear(t.km);
    return `<span class="w${known(t.km) ? ' known' : ''}" data-i="${i}"><b>${esc(t.km)}</b></span>`;
  }).join('');
  $('#line').querySelectorAll('.w').forEach(el => el.onclick = () => { const t = tk[+el.dataset.i]; hearing++; playWord(t.km); if (n.bilingual || /^[໐-໙]+$/.test(t.km)) { if (learn(t.km, true)) chime([880], .25, 'sine', .05); el.classList.add('known'); wordPop(el, t, true); } else wordPop(el, t); });
  $('#next').textContent = dlg.i < dlg.lines.length - 1 ? 'Next' : 'Done';
  hearLine();
}
let hearing = 0;
async function hearLine(sel = '#line', tk) {
  const my = ++hearing; const els = [...$(sel).querySelectorAll('.w')];
  if (!tk) tk = tokens(dlg.lines[dlg.i][1]);
  for (const el of els) { if (my !== hearing) return; const t = tk[+el.dataset.i]; if (/^[໐-໙]+$/.test(t.km)) continue; el.classList.add('play'); await playWord(t.km); el.classList.remove('play'); await new Promise(r => setTimeout(r, 70)); }
}
function wordPop(el, t, explain) {
  const p = $('#pop'), r = el.getBoundingClientRect();
  const gl = explain ? (t.gl || VOCAB[t.km] || '') : known(t.km) ? (VOCAB[t.km] || '') : 'You don’t know this word yet';
  p.innerHTML = `<b>${esc(t.km)}</b><u>${esc(ROM[t.km] || '')}</u><i>${esc(gl)}</i>`;
  p.style.left = Math.min(innerWidth - 90, Math.max(90, r.left + r.width / 2)) + 'px'; p.style.top = (r.top - 6) + 'px'; p.classList.remove('hide');
  clearTimeout(p._t); p._t = setTimeout(() => p.classList.add('hide'), 2600);
}
function dlgNext() { hearing++; if (dlg.i < dlg.lines.length - 1) { dlg.i++; showLine(); } else { const a = dlg.after; closeAll(); dlg = null; a && a(); save(); refreshObjective(); } }
$('#next').onclick = dlgNext; $('#hear').onclick = () => hearLine();

/* ---------------- story & quests ---------------- */
function invite(id) { if (F.aunt && !F.dinner && !F['inv_' + id]) { F['inv_' + id] = 1; return true; } return false; }
function talkTo(id) {
  if (id === 'yay') {
    if (F.ended && !F.hearth && S.spells.includes('ໄຟ')) return talk('yay_hearth', () => { F.hearthAsk = 1; });
    if (F.ended) return talk('yay_end');
    if (!F.met) return talk('yay_intro', () => { F.met = 1; teachSpell('ນ້ຳ'); toast('ນ້ຳ', 'Spell learned: water'); chime(); });
    if (!F.flowers) return talk('yay_wait');
    if (!F.errand) return talk('yay_errand', () => { F.errand = 1; teachSpell('ຂຶ້ນ'); teachSpell('ລົງ'); pay(50000); toast('', 'Grandma gives you ' + khNum(50000) + ' ₭'); });
    if (!F.fish) { if (has('ປາ')) return talk('yay_fish', () => { F.fish = 1; addItem('ປາ', -1); }); return talk('yay_wait_fish'); }
    if (F.hearthAsk && !F.hearth) return talk('yay_hearth');
    if (S.spells.includes('ໄຟ') && !F.hearth) return talk('yay_hearth', () => { F.hearthAsk = 1; });
    return talk('yay_school');
  }
  if (id === 'sok') {
    if (invite('sok')) { F.inv_kid = 1; return talk('sok_invite'); }
    if (!F.sok) return talk('sok_intro', () => { F.sok = 1; });
    return talk('sok_wait', () => openShop('vendor'));
  }
  if (id === 'kru') {
    if (!F.metKru) return talk('kru_intro', () => { F.metKru = 1; teachSpell('ຢືນ'); teachSpell('ໄຟ'); toast('ຢືນ · ໄຟ', 'Spells learned: stand, fire'); chime(); });
    if (!F.sign) return talk('kru_wait');
    if (!F.kru2) return talk('kru_after_sign', () => { F.kru2 = 1; teachSpell('ມາ'); teachSpell('ໄປ'); toast('ມາ · ໄປ', 'Spells learned: come, go'); chime(); });
    return talk('kru_hint');
  }
  if (id === 'aunt') {
    if (F.dinner) return talk('aunt_after');
    if (!F.aunt) return talk('aunt_intro', () => { F.aunt = 1; });
    if (F.inv_ta && F.inv_fisher && F.inv_sok) return dinner();
    return talk('aunt_wait');
  }
  if (id === 'tuot') { if (F.tuot) return talk('tuot_idle'); F.tuotAsk = 1; return talk('tuot_ask'); }
  if (id === 'kid') {
    if (invite('kid')) return talk('kid_invite');
    if (!F.kidFed) { if (has('ເຂົ້າໜົມ')) { addItem('ເຂົ້າໜົມ', -1); F.kidFed = 1; return talk('kid_fed'); } return talk('kid_hungry'); }
    if (F.ballDone) return talk('kid_play');
    if (F.ballGiven) { const c = S.kidColor; return talk([['kid', `ຂ້ອຍ ຢາກ ໄດ້ ໝາກບານ ສີ ${c} !`]]); }
    if (has('ໝາກບານ')) { addItem('ໝາກບານ', -1); F.ballGiven = 1; ball.visible = true; const opts = ['ແດງ', 'ຟ້າ', 'ເຫຼືອງ', 'ຂຽວ', 'ມ່ວງ', 'ບົວ', 'ດຳ', 'ຂາວ'].filter(c => S.spells.includes(c)); S.kidColor = opts[Math.floor(Math.random() * opts.length)] || 'ແດງ'; return talk([['kid', 'ໝາກບານ ! ຂອບໃຈ ຫຼາຍ !'], ['kid', `ຂ້ອຍ ຢາກ ໄດ້ ໝາກບານ ສີ ${S.kidColor} !`]]); }
    F.ballAsk = 1; return talk('kid_ball');
  }
  if (id === 'vendor') return talk('vendor', () => openShop('vendor'));
  if (id === 'ta') {
    if (invite('ta')) return talk('ta_invite');
    if (!F.paddy) { F.taAsk = 1; return talk('ta_dry'); }
    if (!F.scare) { if (!F.taPaid) { F.taPaid = 1; pay(30000); } return talk('ta_scare'); }
    return talk('ta_done');
  }
  if (id === 'fisher') {
    if (invite('fisher')) return talk('fisher_invite');
    if (!F.fishQuest) { F.fishQuest = 1; return talk('fisher_fish'); }
    if (!F.fishPaid) { if ((S.bag['ປາແມ່ນ້ຳ'] || 0) >= 3) { F.fishPaid = 1; addItem('ປາແມ່ນ້ຳ', -3); pay(30000); return talk('fisher_paid'); } return talk('fisher_fish'); }
    return talk(boatState.side === 'east' ? 'fisher_idle' : 'fisher');
  }
  if (id === 'monk') { if (F.ended) return talk('monk_after'); if (!F.monk) return talk('monk', () => { F.monk = 1; }); return talk('monk_wait'); }
  if (id === 'jang') { if (F.dinner && moto.flat) return talk('jang', () => openShop('jang')); if (F.dinner) return talk('jang_ok'); return talk('jang'); }
  if (id === 'gas') return talk('gas', () => openShop('gas'));
  if (id === 'che') { if (!F.che) return talk('che_intro', () => { F.che = 1; openShop('che'); }); return openShop('che'); }
  if (id === 'hia') { if (F.hiaLit && !F.hiaPaid) { F.hiaPaid = 1; pay(20000); return talk('hia_paid'); } if (F.hiaLit) return talk('hia_idle'); F.hiaAsk = 1; return talk('hia_day'); }
  if (id === 'ee') { if (F.eeDone && !F.eePaid) { F.eePaid = 1; pay(10000); return talk('ee_paid'); } if (F.eePaid) return talk('ee_paid'); F.eeAsk = 1; return talk('ee_ask'); }
  if (id === 'chief') {
    if (!F.chief) return talk('chief_intro', () => { F.chief = 1; F.thiefAsk = 1; teachSpell('ເຊົາ'); toast('ເຊົາ', 'Spell learned: stop'); chime(); });
    if (F.thiefCaught && !F.thief) return talk('chief_thanks', () => { F.thief = 1; pay(50000); });
    if (!F.thiefCaught) return talk('chief_wait');
    return talk('chief_idle');
  }
  if (id === 'farmer') {
    if (F.harvest) return talk('farmer_idle');
    if (!F.harvestAsk && !F.chief) return talk('farmer_early');
    if (!F.harvestAsk) { F.harvestAsk = 1; F.harvestN = 5 + Math.floor(Math.random() * 5); }
    const N = F.harvestN;
    if ((S.bag['ມັດ'] || 0) >= N) return talk('farmer_done', () => { addItem('ມັດ', -N); F.harvest = 1; pay(40000); });
    return talk([['farmer', `ຊ່ວຍ ຂ້ອຍ ຕັດ ເຂົ້າ ${numWords(N)} ມັດ ແດ່ .`]]);
  }
  if (id === 'tacha') {
    if (F.coco) return talk('tacha_idle');
    if (F.cocoAsk && has('ໝາກພ້າວ')) return talk('tacha_done', () => { F.coco = 1; addItem('ໝາກພ້າວ', -1); pay(50000); });
    if (F.cocoAsk) return talk('tacha_wait');
    return talk('tacha_intro', () => { F.cocoAsk = 1; });
  }
}
function dinner() {
  const spots = { ta: [-15, -5], fisher: [-11, -5], sok: [-15, -9], kid: [-11, -9], yay: [-13, -4] };
  for (const [id, p] of Object.entries(spots)) npcObjs[id].g.position.set(p[0], groundH(p[0], p[1]), p[1]);
  talk('aunt_dinner', () => {
    F.dinner = 1; for (const id of Object.keys(spots)) { const h = npcObjs[id].home; npcObjs[id].g.position.set(h[0], groundH(h[0], h[1]), h[1]); }
    npcObjs.yay.g.position.y = groundH(NPCS.yay.pos[0], NPCS.yay.pos[1]);
    for (const id of Object.keys(spots)) npcObjs[id].g.position.y = npcObjs[id].y;
    pay(20000); toast('ລົດຈັກ', 'Uncle lends you his motorbike. Its tyre is flat — the mechanic is in town, east past the hills.'); chime();
  });
}
function touchHead(H) {
  if (!S.heads.includes(H.word)) { S.heads.push(H.word); teachSpell(H.word); chime([392, 523, 659, 784], 1.4, 'triangle', .1); }
  playWord(H.word); toast(H.word, `${VOCAB[H.word]} — ${H.dots} mark${H.dots > 1 ? 's' : ''} at its base`); save(); refreshObjective();
}
function quests() {
  const q = [];
  const add = (title, done, text, ...r) => (!r.length || r[0]) && q.push({ title, done: !!done, text: String(text).replace(/<[^>]+>/g, '') });
  add('Wake up', F.errand, 'Water Grandma’s flowers with ນ້ຳ.');
  add('The fish errand', F.fish, !F.sok ? 'Learn numbers from ດາວ at the market.' : !has('ປາ') && !F.fish ? 'Buy one fish from the market seller.' : 'Bring the fish to Grandma.', F.errand);
  add('The stone’s secret', F.ended, objective()[0], F.fish);
  add('Family dinner', F.dinner, `Invite Aunt’s family: her father ${F.inv_ta ? '✓' : ''}, her husband ${F.inv_fisher ? '✓' : ''}, her children ${F.inv_sok ? '✓' : ''}. Then return to her.`, F.aunt);
  add('A ride of your own', F.fixed && F.fueled, `${F.fixed ? '✓' : 'Get the flat tyre fixed by the mechanic (ຊ່າງ) in town.'} ${F.fueled ? '✓' : 'Buy petrol (ນ້ຳມັນ) at the station in town or a bottle at the market.'}`, F.dinner);
  add('Great-grandma’s wish', F.tuot, 'She wants white flowers. Make flowers bloom near her, then make them white.', F.tuotAsk);
  add('The hungry boy', F.kidFed, 'He wants to eat. Cake from the market or a magic bowl of rice?', true && (F.kidFed || F.sok));
  add('A ball for the boy', F.ballDone, F.ballGiven ? `He wants the ball painted ${VOCAB[S.kidColor] ? 'a colour he names' : ''}. Listen to him.` : 'He wants a ball. Noy’s shop in town sells them.', F.ballAsk);
  add('Grandpa’s dry field', F.paddy, 'Grandpa’s rice field needs water.', F.taAsk || F.paddy);
  add('The scarecrow', F.scare, 'Something in Grandpa’s field has fallen over.', F.paddy);
  add('Three fish', F.fishPaid, `Call fish from the river with ມາ (${Math.min(3, S.bag['ປາແມ່ນ້ຳ'] || 0)}/3), then bring them to the fisher.`, F.fishQuest);
  add('Grandma’s cooking fire', F.hearth, 'Light the hearth under Grandma’s house.', F.hearthAsk);
  add('The shop lanterns', F.hiaPaid, 'Noy\u2019s brother wants his shop lanterns lit — at night.', F.hiaAsk);
  add('Flowers for Auntie', F.eePaid, 'Auntie wants red flowers.', F.eeAsk);
  add('Coconut water', F.coco, 'The old man at the café wants a coconut from the village. Call one down from a coconut palm.', F.cocoAsk);
  add('Mango Village', F.chief, 'Find the village chief of ບ້ານມ່ວງ, north of the school. He lives up in his house.', S.visited.includes('ບ້ານມ່ວງ') || F.chief);
  add('The golden harvest', F.harvest, `Cut bundles of rice (${S.bag['ມັດ'] || 0} so far). How many did the farmer ask for?`, F.harvestAsk);
  add('The night thief', F.thief, F.thiefCaught ? 'Tell the chief.' : 'Catch the thief on the roads at night: say ເຊົາ!', F.thiefAsk);
  add('The dog\u2019s friend', F.dogFriend, 'The old man says the dog can find word stones. Feed it.', F.coco || F.dogFriend);
  return q;
}

/* ---------------- shop ---------------- */
let shop = null;
const NOTES = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
function openShop(id) {
  shop = { id, sel: null, pile: 0 }; uiOpen = 'shop'; joyEnd(); $('#shop').classList.remove('hide'); renderShop();
}
function shopLine(item, price, kind) { return kind === 'amt' ? `ເຕີມ ນ້ຳມັນ ${numWords(price)} ກີບ .` : kind === 'full' ? `ເຕັມ ຖັງ ${numWords(price)} ກີບ .` : kind === 'fix' ? `ແປງ ລໍ້ ${numWords(price)} ກີບ .` : kind === 'bottle' ? `ນ້ຳມັນ ໜຶ່ງ ຂວດ ${numWords(price)} ກີບ .` : `${item} ${numWords(price)} ກີບ .`; }
const LITRE = 40000, PER_LITRE = 25; // kip per litre at the station; % of tank per litre
function shopItems(id) { return SHOPS[id].map(([w, p, kind]) => kind === 'full' ? [w, Math.max(5000, Math.ceil((100 - moto.fuel) / PER_LITRE * LITRE / 5000) * 5000), kind] : [w, p, kind]); }
function renderShop() {
  const items = shopItems(shop.id), who = NPCS[shop.id === 'vendor' ? 'vendor' : shop.id].km;
  let h = `<div class="shophead"><span class="kh">${esc(who)}</span><span id="wallet">You have <b class="kh">${khNum(S.money)}</b> ₭</span><button class="btn" id="shopclose">Leave</button></div><div class="items">`;
  h += items.map(([w, p, kind], i) => `<button class="item${shop.sel === i ? ' sel' : ''}" data-i="${i}"><b class="kh">${esc(kind === 'full' ? 'ເຕັມ ຖັງ' : kind === 'fix' ? 'ແປງ ລໍ້' : kind === 'bottle' ? 'ນ້ຳມັນ ໜຶ່ງ ຂວດ' : kind === 'amt' ? 'ນ້ຳມັນ' : w)}</b><i>${known(w) ? esc(VOCAB[w]) : '?'}</i><span class="tag kh">${khNum(p)} ₭</span></button>`).join('');
  h += '</div>';
  if (shop.sel != null) {
    const [w, p, kind] = items[shop.sel];
    h += `<div class="say" id="sayline"></div><div class="pile">Paying: <b class="kh">${khNum(shop.pile)}</b> ₭</div><div class="notes">${NOTES.map(n => `<button class="note n${n}" data-n="${n}" ${shop.pile + n > S.money ? 'disabled' : ''}><span class="kh">${khNum(n)}</span></button>`).join('')}</div><div class="shopbar"><button class="btn" id="clr">Take back</button><button class="btn pri" id="paybtn">Pay</button></div>`;
  } else h += `<p class="shopmsg">Tap something to ask its price. Prices are spoken in Lao.</p>`;
  $('#shop').innerHTML = h;
  $('#shopclose').onclick = () => closeAll();
  $('#shop').querySelectorAll('.item').forEach(b => b.onclick = () => { shop.sel = +b.dataset.i; shop.pile = 0; renderShop(); sayShop(); });
  $('#shop').querySelectorAll('.note').forEach(b => b.onclick = () => { shop.pile += +b.dataset.n; chime([1400], .08, 'square', .03); renderShop(); });
  if (shop.sel != null) { $('#clr').onclick = () => { shop.pile = 0; renderShop(); }; $('#paybtn').onclick = buy; renderSay(); }
}
let sayText = '';
function renderSay() { const el = $('#sayline'); if (!el) return; const tk = tokens(sayText); el.innerHTML = tk.map((t, i) => isPunct(t.km) ? `<span class="p">${esc(t.km)}</span>` : `<span class="w${known(t.km) ? ' known' : ''}" data-i="${i}"><b>${esc(t.km)}</b></span>`).join(''); el.querySelectorAll('.w').forEach(e => e.onclick = () => { hearing++; playWord(tk[+e.dataset.i].km); wordPop(e, tk[+e.dataset.i]); }); }
function sayShop(text) { speaking = shop.id; const [w, p, kind] = shopItems(shop.id)[shop.sel]; sayText = text || shopLine(w, p, kind); tokens(sayText).forEach(t => hear(t.km)); renderSay(); hearLine('#sayline', tokens(sayText)); }
function buy() {
  const [w, p, kind] = shopItems(shop.id)[shop.sel];
  if (['amt', 'full', 'bottle'].includes(kind) && F.dinner && moto.fuel >= 99.5) return sayShop('ຖັງ ເຕັມ ແລ້ວ !');
  if (kind === 'fix' && !moto.flat) return sayShop('ລໍ້ ດີ . ລົດຈັກ ດີ !');
  if (['amt', 'full', 'bottle'].includes(kind) && !F.dinner) return sayShop('ລົດຈັກ ? ບໍ່ ມີ ລົດຈັກ ບໍ ?');
  if (shop.pile < p) { sayShop('ເງິນ ບໍ່ ພໍ .'); chime([300, 220], .4, 'triangle', .06); return; }
  const change = shop.pile - p; S.money -= p; shop.pile = 0; updateHUD();
  if (kind === 'fix') { moto.flat = false; F.fixed = 1; placeMoto(); }
  else if (kind === 'full') { moto.fuel = 100; F.fueled = 1; }
  else if (kind === 'amt') { moto.fuel = Math.min(100, moto.fuel + p / LITRE * PER_LITRE); F.fueled = 1; }
  else if (kind === 'bottle') { moto.fuel = Math.min(100, moto.fuel + PER_LITRE); F.fueled = 1; }
  else { addItem(w); }
  const isNew = learn(w, true);
  chime([660, 990], .5);
  const txt = change > 0 ? `ຂອບໃຈ ! ທອນ ${numWords(change)} ກີບ .` : 'ຂອບໃຈ !';
  renderShop(); sayShop(txt);
  setTimeout(() => toast(kind === 'fix' ? 'ລໍ້' : kind ? 'ນ້ຳມັນ' : w, kind === 'fix' ? 'Tyre fixed!' : kind ? `Fuel: ${Math.round(moto.fuel)}%` : (isNew ? 'You learn: ' : 'Bought: ') + VOCAB[w] + (change ? ` · change ${khNum(change)} ₭` : '')), 300);
  if (w === 'ປຶ້ມ') F.cluebook = 1;
  save(); refreshObjective();
}

/* ---------------- keyboard ---------------- */
const CONS = 'ກ ຂ ຄ ງ ຈ ສ ຊ ຍ ດ ຕ ຖ ທ ນ ບ ປ ຜ ຝ ພ ຟ ມ ຢ ຣ ລ ວ ຫ ອ ຮ ໜ ໝ'.split(' ');
const VOWS = 'ະ ັ າ ຳ ິ ີ ຶ ື ຸ ູ ົ ຽ ເ ແ ໂ ໃ ໄ ໍ ່ ້ ໊ ໋ ໆ'.split(' ');
const isDep = c => /[\u0eb1\u0eb3-\u0ebc\u0ec8-\u0ecd]/.test(c);
let kbPage = 0, typed = '', guide = null;
function openKB(force) {
  if (uiOpen) return; uiOpen = 'kb'; typed = ''; $('#kb').classList.remove('hide'); joyEnd(); if (moto.riding) moto.speed = 0;
  if (typeof force === 'string') { guide = force; renderKnown(); renderKB(); $('#kbmsg').textContent = `Say ${force} \u2014 ${VOCAB[force] || ''}.`; return; }
  let g = null;
  if (F.met && !F.flowers) g = 'ນ້ຳ'; else if (F.metKru && !F.sign) g = 'ຢືນ'; else if (F.door && !F.lamps) g = 'ໄຟ'; else if (F.monk && !F.ended) g = 'ບ້ານເກີດ';
  guide = g && ((S.casts[g] || 0) < 2) ? g : null;
  renderKnown(); renderKB(); $('#kbmsg').textContent = guide ? 'Follow the glowing keys.' : 'Type a word you know, then speak it. Tap a spell above for help.';
}
function renderKnown() {
  $('#known').innerHTML = S.spells.map(w => `<button class="kh${guide === w ? ' sel' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('');
  $('#known').querySelectorAll('button').forEach(b => b.onclick = () => { guide = guide === b.dataset.w ? null : b.dataset.w; playWord(b.dataset.w); renderKnown(); renderKB(); $('#kbmsg').textContent = guide ? `${guide} — ${VOCAB[guide] || ''}. Follow the glowing keys.` : ''; });
}
function nextChar() { if (!guide) return null; const g = guide.normalize('NFC'); if (!g.startsWith(typed)) return 'BK'; return g[typed.length] || 'GO'; }
function renderKB() {
  const nc = nextChar(), keys = kbPage ? VOWS : CONS, shown = c => isDep(c) ? '◌' + c : c;
  let h = keys.map(c => `<button class="k${nc === c ? ' next' : ''}" data-c="${c}">${shown(c)}</button>`).join('');
  const needOther = nc && (kbPage ? CONS : VOWS).includes(nc);
  h += `<button class="k fn${needOther ? ' next' : ''}" data-f="page" style="grid-column:span 2">${kbPage ? 'ກ consonants' : '◌ະ vowels'}</button>`;
  h += `<button class="k${nc === 'ຼ' ? ' next' : ''}" data-c="ຼ">◌ຼ</button>`;
  h += `<button class="k fn${nc === 'BK' ? ' next' : ''}" data-f="bk">⌫</button>`;
  h += `<button class="k go${nc === 'GO' ? ' next' : ''}" data-f="go" style="grid-column:span 2">Speak</button>`;
  $('#keys').innerHTML = h;
  $('#keys').querySelectorAll('.k').forEach(b => b.onpointerdown = e => { e.preventDefault(); const f = b.dataset.f; if (f === 'page') { kbPage ^= 1; renderKB(); } else if (f === 'bk') { typed = [...typed].slice(0, -1).join(''); upd(); } else if (f === 'go') speak(); else { typed += b.dataset.c; upd(); } });
  $('#tx').textContent = typed; $('#ghost').textContent = guide || ''; $('#ghost').style.visibility = typed ? 'hidden' : 'visible';
}
function upd() { const nc = nextChar(); if (guide && nc && nc !== 'BK' && nc !== 'GO') { if (kbPage === 0 && VOWS.includes(nc)) kbPage = 1; else if (kbPage === 1 && CONS.includes(nc)) kbPage = 0; } renderKB(); }
function kbKey(e) { if (e.key === 'Escape') return closeAll(); if (e.key === 'Enter') { e.preventDefault(); return speak(); } if (e.key === 'Backspace') { typed = [...typed].slice(0, -1).join(''); return upd(); } if (e.key.length === 1 && e.key >= '຀' && e.key <= '໿') { typed += e.key; upd(); } }
$('#kbclose').onclick = () => closeAll(); $('#cast').onclick = () => { ensureAudio(); openKB(); };
function speak() {
  const w = norm(typed); if (!w) return;
  const match = Object.keys(VOCAB).find(k => norm(k) === w);
  if (!match) { $('#kbmsg').textContent = 'The letters fizzle — that isn’t a word you know. Try again.'; chime([220, 180], .4, 'sawtooth', .04); typed = ''; renderKB(); return; }
  closeAll(); S.casts[match] = (S.casts[match] || 0) + 1; playWord(match); cast(match); save(); refreshObjective(); updateHUD();
}

/* ---------------- spells ---------------- */
function fwd() { return [-Math.sin(player.yaw), -Math.cos(player.yaw)]; }
function front(d = 3) { const [fx, fz] = fwd(); return [player.x + fx * d, player.z + fz * d]; }
function inFront(x, z, range, cone = .3) { const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz); if (d > range) return false; if (d < 3) return true; const [fx, fz] = fwd(); return (dx * fx + dz * fz) / d > cone; }
const nearRiver = () => Math.abs(player.x - riverX(player.z)) < 16;
const COLORS = { 'ແດງ': 0xd23a2a, 'ຟ້າ': 0x2f6fd6, 'ເຫຼືອງ': 0xf0c020, 'ຂຽວ': 0x3a9a4a, 'ຂາວ': 0xf4f0e8, 'ດຳ': 0x1a1a1a, 'ມ່ວງ': 0x8a3fb0, 'ບົວ': 0xf08ab0 };
const patches = []; // flower patches {x,z,flowers:[mesh],color}
function stonesNear(mode, r) { return stoneObjs.filter(o => o.mode === mode && !o.ok && near(o.x, o.z, r)); }
function done(spell, id, km, msg) { const n = use(spell, id); toast(km || spell, msg + (n && SPELLS[spell] && SPELLS[spell].uses.length > 1 ? `  (new use ${S.uses[spell].length}/${SPELLS[spell].uses.length})` : '')); }
function cast(w) {
  const [ax, az] = front(); const npcNear = (id, r = 7) => { const p = npcObjs[id].g.position; return near(p.x, p.z, r); };
  if (w === 'ບ້ານເກີດ') { if (F.monk && !F.ended && near(T.x - 2.4, T.z, 6)) return ending(); floatWord(w); toast(w, 'You think of home, far away.'); return; }
  if (w === 'ກ້ວຍ' && has('ກ້ວຍ')) { const m = enemies.find(e => e.type === 'monkey' && e.state !== 'gone' && near(e.x, e.z, 12)); if (m) { addItem('ກ້ວຍ', -1); m.state = 'flee'; m.t = 3; toast(w, 'The monkey snatches the banana and scampers off, delighted.'); return; } }
  if (!SPELLS[w]) { floatWord(w); toast(w, `You say “${VOCAB[w]}”. Nothing magical happens — but it sounds right.`); return; }
  if (!S.spells.includes(w)) { floatWord(w); toast(w, 'The word glows faintly… you haven’t learned its power yet.'); return; }
  chime();
  if (PLACES[w]) return warpTo(w);
  if (enemyCast(w)) return;
  switch (w) {
    case 'ຂຶ້ນ': {
      if (inside) { toast(w, 'You are already up in the house.'); return; }
      const h = Object.values(HOUSES).find(h => near(h.foot[0], h.foot[1], 3.4));
      if (h) { enterHouse(h); return done(w, 'house', w, 'You climb the ladder into the house.'); }
      const me = player.x > riverX(player.z) ? 'east' : 'west';
      if (F.kru2 && !boatState.riding && !boatState.moving && boatState.side === me && near(boat.position.x, DOCKZ, 7)) { boatState.riding = true; player.x = boat.position.x; player.z = DOCKZ; return done(w, 'boat', w, 'You climb into the boat. Say ໄປ.'); }
      floatWord(w); toast(w, 'There is nothing to climb here.'); return;
    }
    case 'ລົງ':
      if (inside) { exitHouse(); return done(w, 'house', w, 'You climb back down the ladder.'); }
      if (boatState.riding && !boatState.moving) { boatState.riding = false; const s = boatState.side; player.x = DOCK[s].x - (s === 'east' ? 2 : -2); player.z = DOCKZ; return done(w, 'boat', w, 'You step out onto the dock.'); }
      if (moto.riding) { dismount(); return done(w, 'moto', w, 'You get off the motorbike.'); }
      toast(w, 'You crouch down for a moment.'); return;
    case 'ເຊົາ':
      if (moto.riding) { moto.speed = 0; toast(w, 'The motorbike stops.'); return; }
      floatWord(w); toast(w, 'Nothing here is moving.'); return;
    case 'ນອນ': {
      const bed = inside && (() => { const [bx, bz] = L2W(inside, inside.W / 2 - .75, -inside.D / 2 + 1.2); return near(bx, bz, 2.6); })();
      if (!bed) { toast(w, 'You need a bed. Climb up into a house.'); return; }
      S.hp = 5; updateHUD(); use(w, 'heal');
      if (nightT > .5) { nightGoal = 0; S.night = false; use(w, 'morning'); toast(w, 'You sleep soundly and wake at sunrise, rested.'); }
      else toast(w, 'You nap on the bed and wake up rested.');
      return;
    }

    case 'ນ້ຳ': {
      rain(player.x, player.z);
      if (near(-2, 5, 7) && !F.flowers) { F.flowers = 1; blooms.forEach(({ b, stem }, i) => anim(1.2, k => { stem.rotation.z = .9 * (1 - k); b.position.set(i * .9 + .3 * (1 - k), .8 + .25 * k, 0); if (k > .5) b.material = M(0xf06080); })); return done(w, 'flowers', w, 'The flowers lift their heads.'); }
      const mud = stonesNear('mud', 7); if (mud.length) { mud.forEach(o => reveal(o)); return done(w, 'mud', w, 'The mud washes away — a word stone!'); }
      if (inPaddy(player.x, player.z) && !F.paddy) { F.paddy = 1; paddyWater.visible = true; riceMesh.material = M(0x9cc94a); anim(2, k => riceMesh.scale.y = .25 + .75 * k); return done(w, 'paddy', w, 'Water floods the paddies. The rice rises green. Ta will be pleased.'); }
      if (near(bufS.x, bufS.z, 9)) { F.trough = 1; troughW.visible = true; bufS.tx = 33.5; bufS.tz = 46; return done(w, 'buffalo', w, 'The trough fills. The buffalo ambles over to drink.'); }
      if (near(42, -36, 7)) { F.well = 1; wellWater.visible = true; return done(w, 'well', w, 'The old well fills.'); }
      return done(w, 'rain', w, 'Rain falls around you.');
    }
    case 'ໄຟ': {
      if (F.door && !F.lamps && near(T.x, T.z, 8)) { F.lamps = 1; lamps.forEach(l => l.visible = true); anim(1.5, k => { templeLight.intensity = 2.5 * k; roomDark.material.opacity = .85 * (1 - k); }, () => roomDark.visible = false); burst(T.x, T.h + 3, T.z, 0xffa040, 60); return done(w, 'lamps', w, 'Four lamps flare. A monk sits in the light.'); }
      const dk = stonesNear('dark', 8); if (dk.length) { dk.forEach(o => { reveal(o); campfire(o.x + 1, o.z); }); return done(w, 'dark', w, 'Light spills into the shadows — a word stone!'); }
      if (near(hearthPos.x, hearthPos.z, 5)) { if (!F.hearth) { F.hearth = 1; hearthFire.visible = true; if (F.hearthAsk) { pay(20000); toast('', 'Grandma gives you ' + khNum(20000) + ' ₭'); } } hearthFire.visible = true; return done(w, 'hearth', w, 'The cooking fire crackles under the house.'); }
      if (near(200, -9, 9)) { if (nightT > .5) { F.hiaLit = 1; shopLanterns.forEach(l => l.material.emissive.setHex(0xd23a2a)); shopLight.intensity = 2; return done(w, 'shop', w, 'Noy’s lanterns glow red in the night. Tell Noy\u2019s brother.'); } return done(w, 'shop', w, 'The lanterns flicker — but nobody sees lanterns by day.'); }
      if (near(54, 9, 12)) { F.marketLit = 1; return done(w, 'lanterns', w, 'The market lanterns glow.'); }
      campfire(ax, az); return done(w, 'fire', w, 'A small fire crackles.');
    }
    case 'ຢືນ': {
      if (!F.sign && near(30, -38, 8)) { F.sign = 1; anim(1.4, k => signPivot.rotation.x = (-Math.PI / 2 + .08) * (1 - smooth(k))); burst(30, groundH(30, -38) + 1.5, -38, 0xf6e3b0); return done(w, 'sign', w, 'The sign stands up: ໂຮງຮຽນ.'); }
      const fl = stonesNear('fallen', 7); if (fl.length) { fl.forEach(o => reveal(o)); return done(w, 'fallen', w, 'The stone rights itself — its word faces you.'); }
      if (!F.scare && near(40, 50, 9)) { F.scare = 1; anim(1.4, k => scareP.rotation.z = (-Math.PI / 2 + .1) * (1 - smooth(k))); pay(10000); return done(w, 'scarecrow', w, 'The scarecrow stands tall again. Ta waves and tosses you some coins.'); }
      if (moto.fallen && near(moto.x, moto.z, 7)) { moto.fallen = false; placeMoto(); return done(w, 'moto', w, 'The motorbike stands up.'); }
      if (dogS.sit && near(dogS.x, dogS.z, 12)) { dogS.sit = false; return done(w, 'dog', w, 'The dog stands up and wags.'); }
      floatWord(w); toast(w, 'Nothing here has fallen.'); return;
    }
    case 'ນັ່ງ':
      if (near(dogS.x, dogS.z, 14)) { dogS.sit = true; return done(w, 'dog', w, 'The dog sits. Good dog.'); }
      if (npcNear('kid')) { npcObjs.kid.body.position.y = -.3; return done(w, 'kid', w, 'The boy plops down and giggles.'); }
      if (near(bufS.x, bufS.z, 10)) { bufS.lie = true; return done(w, 'buffalo', w, 'The buffalo folds its legs and lies down.'); }
      return done(w, 'rest', w, 'You sit for a moment. The cicadas hum.');
    case 'ມາ': {
      if (F.dinner && !moto.riding && !near(moto.x, moto.z, 4) && near(moto.x, moto.z, 60)) { summonMoto(); return done(w, 'moto', w, 'Your motorbike rolls toward you on its own.'); }
      const far = stoneObjs.find(o => o.mode === 'far' && !o.ok && near(o.x, o.z, 24));
      if (far) { const tx = riverX(far.z) + (player.x > riverX(player.z) ? 9.5 : -9.5); anim(3, k => { far.g.position.x = far.x + (tx - far.x) * smooth(k); far.g.position.y = far.y0 + (groundH(tx, far.z) - far.y0) * smooth(k); }, () => { far.x = tx; reveal(far); }); return done(w, 'far', w, 'The stone drifts across the water toward you.'); }
      if (!boatState.moving && !boatState.riding) { const me = player.x > riverX(player.z) ? 'east' : 'west'; if (dist(DOCK[me].x, DOCKZ) < 7 && boatState.side !== me) { moveBoat(me); return done(w, 'boat', w, 'The boat glides toward you.'); } }
      const cp = cocoPalms.find(p => p.nuts.some(n => n.visible) && near(p.x, p.z, 8)); if (cp) { const n = cp.nuts.find(n => n.visible); n.visible = false; addItem('ໝາກພ້າວ'); burst(cp.x, groundH(cp.x, cp.z) + 1, cp.z, 0x8a6a3a, 20); return done(w, 'coconut', w, 'A coconut thumps down into your hands.'); }
      if (nearRiver() && F.fishQuest) { addItem('ປາແມ່ນ້ຳ'); const n = S.bag['ປາແມ່ນ້ຳ']; const [rx, rz] = [riverX(player.z), player.z]; burst(rx, WATER_Y + .5, rz, 0x9ad0ff, 30); return done(w, 'fish', 'ປາ', `A fish leaps out of the river into your basket (${Math.min(n, 3)}/3).`); }
      if (near(dogS.x, dogS.z, 40)) { dogS.tx = player.x + 1.5; dogS.tz = player.z + 1; dogS.sit = false; return done(w, 'dog', w, 'The dog comes running.'); }
      floatWord(w); toast(w, 'Nothing answers.'); return;
    }
    case 'ໄປ':
      if (boatState.riding && !boatState.moving) { moveBoat(boatState.side === 'east' ? 'west' : 'east', true); return done(w, 'boat', w, 'The boat carries you across.'); }
      if (moto.riding) { moto.boostT = 3; return done(w, 'boost', w, 'The motorbike roars forward!'); }
      if (chickens.some(c => near(c.x, c.z, 6))) { chickens.forEach(c => { c.tx = c.x + (c.x - player.x) * 3; c.tz = c.z + (c.z - player.z) * 3; }); return done(w, 'chickens', w, 'The chickens scatter, squawking.'); }
      dash(); return done(w, 'dash', w, 'You surge forward.');
    case 'ຍ່າງ':
      if (near(bufS.x, bufS.z, 10)) { bufS.lie = false; bufS.tx = bufS.x + rnd(-8, 8); bufS.tz = Math.max(32, Math.min(78, bufS.z + rnd(-8, 8))); return done(w, 'buffalo', w, 'The buffalo plods off.'); }
      player.swiftT = 25; return done(w, 'swift', w, 'Your feet feel light.');
    case 'ເຂົ້າ': {
      spawnRice(ax, az);
      if (npcNear('kid') && !F.kidFed) { F.kidFed = 1; toast('ເຂົ້າ', 'A steaming bowl appears.'); use(w, 'kid'); setTimeout(() => talkTo('kid'), 900); return; }
      if (F.ended && npcNear('monk')) { use(w, 'monk'); return done(w, 'monk', w, 'You offer rice to the monk. He smiles and blesses you.'); }
      if (near(dogS.x, dogS.z, 10)) { F.dogFriend = 1; dogS.sit = false; return done(w, 'dog', w, 'The dog gobbles the rice and won’t leave your side. It sniffs the ground…'); }
      if (chickens.some(c => near(c.x, c.z, 12))) { chickens.forEach(c => { c.tx = ax + rnd(-1, 1); c.tz = az + rnd(-1, 1); }); return done(w, 'chickens', w, 'The chickens rush to peck the rice.'); }
      if (S.hp < 5) { S.hp = Math.min(5, S.hp + 1); updateHUD(); return done(w, 'eat', w, 'You eat the warm rice. You feel better.'); }
      return done(w, 'bowl', w, 'A bowl of rice appears.');
    }
    case 'ດອກໄມ້': {
      const p = { x: player.x, z: player.z, flowers: [], color: null }; for (let i = 0; i < 14; i++) spawnFlower(player.x + rnd(-4, 4), player.z + rnd(-4, 4), p); patches.push(p);
      if (npcNear('tuot', 8)) return done(w, 'tuot', w, 'Flowers bloom around Great-grandma. She looks at them closely…');
      if (npcNear('ee', 8)) return done(w, 'ee', w, 'Flowers bloom in front of the shop.');
      return done(w, 'bloom', w, 'Flowers bloom around you.');
    }
    case 'ກາງຄືນ': nightGoal = 1; S.night = true; return done(w, 'night', w, 'Night falls. Some things only show themselves in the dark…');
    case 'ກາງເວັນ': nightGoal = 0; S.night = false; return done(w, 'day', w, 'The sun returns.');
  }
  if (COLORS[w]) {
    const c = COLORS[w];
    if (F.crossed && !F.door && near(T.x + 4, T.z, 9)) {
      S.door.push(w); const i = S.door.length - 1;
      if (DOOR_ORDER[i] !== w) { S.door = []; sockets.forEach(s => { s.material.color.set(0x333333); s.material.emissive.set(0); }); chime([300, 200], .5, 'triangle', .06); toast(w, 'The sockets go dark. The order is wrong.'); return; }
      sockets[i].material.color.set(c); sockets[i].material.emissive.set(c); use(w, 'door');
      if (S.door.length === 3) { F.door = 1; doorCol.on = false; anim(2.5, k => door.position.z = 2 * smooth(k)); chime([262, 330, 392, 523, 659], 2, 'triangle', .1); toast(w, 'Stone grinds on stone. The door opens.'); } else toast(w, 'A socket lights up.');
      return;
    }
    if (F.ballGiven && !F.ballDone && npcNear('kid', 8)) { ball.material.color.setHex(c); F.ballColor = c; if (w === S.kidColor) { F.ballDone = 1; use(w, 'ball'); toast(w, 'The boy whoops and kicks the ball high!'); setTimeout(() => talkTo('kid'), 1200); } else toast(w, 'The boy frowns. Not that colour!'); return; }
    const p = patches.filter(p => near(p.x, p.z, 7)).pop();
    if (p) { p.color = w; p.flowers.forEach(f => f.material = M(c)); const tuot = npcObjs.tuot.g.position, ee = npcObjs.ee.g.position;
      if (w === 'ຂາວ' && Math.hypot(p.x - tuot.x, p.z - tuot.z) < 9 && !F.tuot) { F.tuot = 1; use(w, 'tuot'); const s = stoneByWord('ຄອບຄົວ'); toast(w, 'White flowers. Great-grandma smiles.'); setTimeout(() => talk('tuot_done', () => reveal(s, 'A stone glints under Aunt’s house.')), 900); return; }
      if (w === 'ແດງ' && Math.hypot(p.x - ee.x, p.z - ee.z) < 9 && !F.eeDone) { F.eeDone = 1; use(w, 'ee'); toast(w, 'Red flowers! Auntie claps her hands. Talk to her.'); return; }
      return done(w, 'paint', w, 'The flowers change colour.'); }
    let best = null, bd = 14;
    for (const o of colorables) { const pp = new THREE.Vector3(); o.mesh.getWorldPosition(pp); const d = dist(pp.x, pp.z); if (d < bd && inFront(pp.x, pp.z, 14, .5)) { bd = d; best = o; } }
    if (best) { if (best.own) best.own.color.set(c); else { best.mesh.material = best.mesh.material.clone(); best.mesh.material.color.set(c); } const pp = new THREE.Vector3(); best.mesh.getWorldPosition(pp); burst(pp.x, pp.y, pp.z, c, 40); return done(w, 'paint', w, `It turns ${VOCAB[w].split(';')[0]}.`); }
    burst(ax, groundH(ax, az) + 1, az, c, 60); toast(w, 'Colour swirls in the air.');
  }
}
function anim(dur, f, fin) { let t = 0; anims.push(dt => { t += dt; const k = Math.min(1, t / dur); f(k); if (k >= 1) { fin && fin(); return false; } return true; }); }
function floatWord(w) { const s = textSprite(w, { size: 64, w: 512, h: 128, scale: 1 }); const [x, z] = front(); s.position.set(x, groundH(x, z) + 1.6, z); scene.add(s); anim(2, k => { s.position.y += .02; s.material.opacity = 1 - k; }, () => scene.remove(s)); }
function rain(x, z) { let t = 0; anims.push(dt => { t += dt; for (let i = 0; i < 8; i++) emit(x + rnd(-5, 5), groundH(x, z) + 7, z + rnd(-5, 5), 0, -12, 0, 0x9ad0ff, .7, 0); return t < 3; }); }
function campfire(x, z) { const y = groundH(x, z); const f = new THREE.Mesh(new THREE.ConeGeometry(.35, .9, 6), new THREE.MeshBasicMaterial({ color: 0xff9030 })); f.position.set(x, y + .45, z); scene.add(f); let t = 0; anims.push(dt => { t += dt; f.scale.y = 1 + .3 * Math.sin(t * 20); if (Math.random() < .6) emit(x, y + .8, z, rnd(-.3, .3), rnd(1, 2), rnd(-.3, .3), 0xffa040, .8, .5); if (t > 12) { scene.remove(f); return false; } return true; }); }
function spawnRice(x, z) { const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); cyl(.4, .25, .3, 0xe8e0d0, 0, .15, 0, g, 10); const r = new THREE.Mesh(new THREE.SphereGeometry(.36, 8, 4, 0, 6.3, 0, 1.4), M(0xffffff)); r.position.y = .25; g.add(r); scene.add(g); burst(x, g.position.y + .5, z, 0xffffff, 20, 1.5); setTimeout(() => scene.remove(g), 30000); }
let flowerCount = 0;
function spawnFlower(x, z, patch) { if (flowerCount++ > 300 || blocked(x, z, .1)) return; const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); cyl(.02, .02, .4, 0x4a7a2a, 0, .2, 0, g, 4); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 0), M([0xf06080, 0xf0e040, 0xb070e0, 0xf09040][flowerCount % 4])); b.position.y = .42; g.add(b); patch.flowers.push(b); g.scale.setScalar(.01); scene.add(g); anim(.8, k => g.scale.setScalar(k)); }
function dash() { const [fx, fz] = fwd(); let n = 0; anim(.5, () => { if (n++ < 30) { tryMove(fx * .4, fz * .4); emit(player.x, camY - .8, player.z, 0, .5, 0, 0xf6e3b0, .6, 0); } }); }
function moveBoat(to, riding) {
  boatState.moving = true; const from = DOCK[boatState.side].bx, dest = DOCK[to].bx;
  anim(riding ? 4 : 3, k => { boat.position.x = from + (dest - from) * smooth(k); if (riding) { player.x = boat.position.x; player.z = DOCKZ; } }, () => {
    boatState.side = to; S.boatSide = to; boatState.moving = false;
    if (riding) { boatState.riding = false; player.x = DOCK[to].x - (to === 'east' ? 2 : -2); player.z = DOCKZ; if (to === 'west') F.crossed = 1; save(); refreshObjective(); toast('', to === 'west' ? 'You step onto the far bank. The hill rises ahead.' : 'Back on the village side.'); }
  });
}
function summonMoto() { const [tx, tz] = front(2.5); const fx = moto.x, fz = moto.z; moto.fallen = false; anim(2, k => { moto.x = fx + (tx - fx) * smooth(k); moto.z = fz + (tz - fz) * smooth(k); placeMoto(); if (Math.random() < .5) emit(moto.x, groundH(moto.x, moto.z) + .3, moto.z, 0, .5, 0, 0xc8b08a, .6, 0); }); }
interact.push({ get x() { return boat.position.x; }, z: DOCKZ, r: 7, label: () => 'Board the boat', act: () => { boatState.riding = true; player.x = boat.position.x; player.z = DOCKZ; toast('ໄປ', 'You sit in the boat. Say ໄປ.'); }, on: () => !boatState.riding && !boatState.moving && F.kru2 && !moto.riding });
interact.push({ x: T.x - 2.4, z: T.z, r: 3.2, label: () => 'Touch the altar stone', act: () => { toast('', F.monk ? 'The stone is warm. Speak the monk’s last word.' : 'The stone is warm.'); }, on: () => F.lamps });
interact.push({ x: -2, z: 5, r: 2.8, label: () => 'Look at the flowers', act: () => toast('', F.flowers ? 'Fresh pink flowers.' : 'Dry, drooping flowers.'), on: () => F.met });
interact.push({ x: hearthPos.x, z: hearthPos.z, r: 2.2, label: () => 'Look at the hearth', act: () => toast('', F.hearth ? 'A warm cooking fire.' : 'A cold hearth with a pot on it.') });
// examinables
const EXPOS = { buffalo: () => [bufS.x, bufS.z, 4], chicken: () => { const c = chickens.reduce((a, b) => dist(a.x, a.z) < dist(b.x, b.z) ? a : b); return [c.x, c.z, 2.5]; }, dog: () => [dogS.x, dogS.z, 2.5], boat: () => [boat.position.x, DOCKZ, 6.5], moto: () => [moto.x, moto.z, 3], tyres: () => [tyresPos.x, tyresPos.z, 3.5], car: () => [182, 6, 4.5], coco: () => { const p = cocoPalms.reduce((a, b) => dist(a.x, a.z) < dist(b.x, b.z) ? a : b); return [p.x, p.z, 3.5]; } };
for (const e of EXAMINE) {
  const it = { get x() { return EXPOS[e.id]()[0]; }, get z() { return EXPOS[e.id]()[1]; }, get r() { return EXPOS[e.id]()[2]; }, label: () => known(e.word) ? 'Look at' : 'Look at this', get kh() { return known(e.word) ? e.word : null; }, act: () => examine(e), on: () => !(e.id === 'moto' && F.dinner) && !(e.id === 'boat' && F.kru2) };
  interact.push(it);
}
function examine(e) {
  if (known(e.word)) { playWord(e.word); toast(e.word, VOCAB[e.word]); return; }
  if (S.heard.includes(e.word)) { learn(e.word, true); playWord(e.word); chime([523, 784, 1046]); toast(e.word, `You remember someone saying “${e.word}”… it must mean “${VOCAB[e.word]}”!`); save(); return; }
  toast('', e.en + ' What is it called in Lao? Listen to the villagers.');
}
// motorbike interactions
interact.push({ get x() { return moto.x; }, get z() { return moto.z; }, r: 3, label: () => moto.fallen ? 'Lift the motorbike' : 'Ride the', kh: 'ລົດຈັກ', act: () => { if (moto.fallen) { moto.fallen = false; placeMoto(); return; } mount(); }, on: () => F.dinner && !moto.riding && !boatState.riding });
function mount() { moto.riding = true; rider.visible = true; player.x = moto.x; player.z = moto.z; camOff = 0; $('#ride').classList.remove('hide'); learn('ລົດຈັກ', true); toast('ລົດຈັກ', moto.flat ? 'The tyre is flat — you can only crawl along. Find the mechanic (ຊ່າງ) in town.' : moto.fuel <= 0 ? 'No petrol (ນ້ຳມັນ)!' : 'Push forward to ride, steer left and right.'); }
function dismount() { moto.riding = false; rider.visible = false; moto.speed = 0; engineSound(false); const s = Math.sin(moto.yaw), c = Math.cos(moto.yaw); for (const [ox, oz] of [[c * 1.2, -s * 1.2], [-c * 1.2, s * 1.2], [-s * 1.5, -c * 1.5]]) if (!blocked(moto.x + ox, moto.z + oz)) { player.x = moto.x + ox; player.z = moto.z + oz; break; } player.yaw = moto.yaw + Math.PI; $('#ride').classList.add('hide'); save(); }
const dismountIt = { x: 0, z: 0, r: 99, label: () => 'Get off', act: () => dismount() };
function rideTick(dt) {
  let thr = -input.jy, st = input.jx; const K = input.keys;
  if (K.KeyW || K.ArrowUp) thr = 1; if (K.KeyS || K.ArrowDown) thr = -1; if (K.KeyA || K.ArrowLeft) st = -1; if (K.KeyD || K.ArrowRight) st = 1;
  const onRoad = roadDist(moto.x, moto.z) < 4 || pathDist(moto.x, moto.z) < 2.5;
  let max = moto.flat ? 3.5 : onRoad ? 17 : 11; if (moto.boostT > 0) { moto.boostT -= dt; max = 28; thr = 1; }
  if (moto.fuel <= 0) max = 0;
  const target = thr > 0 ? thr * max : thr * 3; moto.speed += (target - moto.speed) * Math.min(1, dt * (thr ? 1.6 : 2.5));
  moto.yaw -= st * dt * 2.2 * Math.min(1, Math.abs(moto.speed) / 4) * Math.sign(moto.speed || 1);
  const fx = Math.sin(moto.yaw), fz = Math.cos(moto.yaw); const nx = moto.x + fx * moto.speed * dt, nz = moto.z + fz * moto.speed * dt;
  let hit = false; { const n = Math.max(1, Math.ceil(Math.hypot(nx - moto.x, nz - moto.z) / .25)), sx = (nx - moto.x) / n, sz = (nz - moto.z) / n;
    for (let i = 0; i < n; i++) { if (!canStep(moto.x, moto.z, moto.x + sx, moto.z + sz, .5)) { hit = true; break; } moto.x += sx; moto.z += sz; moto.fuel = Math.max(0, moto.fuel - Math.hypot(sx, sz) * .012); } }
  if (moto.fuel === 0 && Math.abs(moto.speed) > .5 && !moto.emptyMsg) { moto.emptyMsg = 1; toast('ນ້ຳມັນ', 'ໝົດ ນ້ຳມັນ ! Out of petrol. Buy a bottle at the market or fill up in town.'); }
  if (moto.fuel > 0) moto.emptyMsg = 0;
  if (hit) { if (Math.abs(moto.speed) > 12) { moto.fallen = true; dismount(); placeMoto(); toast('', 'Crash! The motorbike tips over. Lift it, or tell it to stand.'); chime([200, 120], .6, 'sawtooth', .05); return; } moto.speed = 0; }
  if (!moto.flat && Math.abs(moto.speed) > 6 && Math.random() < dt / (onRoad ? 500 : 40)) { moto.flat = true; toast('ລໍ້', 'Pop! ລໍ້ ແຕກ — a flat tyre. Find the mechanic (ຊ່າງ) in town.'); chime([180, 90], .5, 'square', .05); }
  player.x = moto.x; player.z = moto.z; player.yaw = moto.yaw + Math.PI;
  placeMoto(); motoBody.rotation.z = -st * Math.min(.35, Math.abs(moto.speed) / 30); wheels.forEach(wh => wh.rotation.x += moto.speed * dt * 3);
  engineSound(true, Math.abs(moto.speed));
  $('#fuel').style.width = moto.fuel + '%'; $('#tyre').textContent = moto.flat ? 'flat tyre' : ''; $('#spd').textContent = Math.round(Math.abs(moto.speed) * 3.6) + ' km/h';
}

/* ---------------- ending ---------------- */
function ending() {
  F.ended = 1; learn('ຢາຍ', true); learn('ບ້ານເກີດ', true); save(); chime([262, 330, 392, 523, 659, 784], 3, 'triangle', .1);
  burst(T.x - 2.4, T.h + 3, T.z, 0xf6e3b0, 120, 4);
  const lines = TALK.monk.map(([, km]) => tokens(km).filter(t => !isPunct(t.km)).map(t => `<span class="kh">${esc(t.km)}</span> <i>${esc(t.gl || '')}</i>`).join(' · '));
  setTimeout(() => {
    uiOpen = 'end';
    $('#endtxt').innerHTML = `<div class="khT">ບ້ານເກີດ</div><h1>Homeland</h1>
    <p>The stone in your hand grows warm, and at last you can read it. Your grandmother — <span class="kh">ຢາຍ</span> — was born in this village and left it long ago. She carved one wish into a word stone: that her grandchild would one day return and speak her language.</p>
    <p>Now you understand what the monk said:<br>${lines.join('<br>')}</p>
    <p>${STONES.length - S.stones.length} word stones and many errands still wait. Say the name of a place you have been — <span class="kh">ເຮືອນ</span>, <span class="kh">ຕະຫຼາດ</span>, <span class="kh">ວັດ</span> — and the word will carry you there.</p>
    <div class="row"><button class="btn pri" id="keepgo">Keep exploring</button></div>`;
    $('#ending').classList.remove('hide');
    $('#keepgo').onclick = () => { $('#ending').classList.add('hide'); uiOpen = null; refreshObjective(); };
  }, 1500);
}

/* ---------------- book ---------------- */
let bookTab = 'quests';
const FOOD = { 'ກ້ວຍ': 1, 'ໄຂ່': 1, 'ມ່ວງ': 1, 'ເຂົ້າໜົມ': 2, 'ໝາກພ້າວ': 1 };
function openBook() { if (uiOpen) return; uiOpen = 'book'; joyEnd(); $('#book').classList.remove('hide'); renderBook(); }
function renderBook() {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.t === bookTab));
  $('.tab[data-t=clues]').classList.toggle('hide', !F.cluebook);
  let h = '';
  if (bookTab === 'quests') h = quests().sort((a, b) => a.done - b.done).map(q => `<div class="card quest${q.done ? ' done' : ''}"><strong>${esc(q.title)}</strong><i>${q.done ? 'Done' : esc(q.text)}</i></div>`).join('');
  else if (bookTab === 'spells') h = Object.keys(SPELLS).map(w => S.spells.includes(w) ? `<button class="card spell" data-w="${esc(w)}"><b>${esc(w)}</b><u>${esc(ROM[w] || '')}</u><i>${esc(VOCAB[w])}</i><i class="dim">${esc(SPELLS[w].d)} · uses found ${(S.uses[w] || []).length}/${SPELLS[w].uses.length}</i></button>` : `<div class="card lock"><b>?</b><i>Undiscovered spell</i></div>`).join('');
  else if (bookTab === 'words') h = S.known.map(w => `<button class="card" data-w="${esc(w)}"><b>${esc(w)}</b><u>${esc(ROM[w] || '')}</u><i>${esc(VOCAB[w] || '')}</i></button>`).join('') || '<p>No words yet.</p>';
  else if (bookTab === 'bag') { h = `<div class="card"><b class="kh">${khNum(S.money)} ₭</b><i>Money</i></div>` + Object.entries(S.bag).map(([w, n]) => { const label = w === 'ປາແມ່ນ້ຳ' ? 'ປາ' : w; return `<button class="card" data-w="${esc(label)}"><b>${esc(label)} \u00d7 ${khNum(n)}</b><i>${known(label) ? esc(VOCAB[label]) : '?'}${FOOD[label] ? ' \u00b7 tap to eat' : ''}</i></button>`; }).join('') + (F.dinner ? `<div class="card"><b class="kh">ລົດຈັກ</b><i>Fuel ${Math.round(moto.fuel)}% ${moto.flat ? '· flat tyre' : ''}</i></div>` : ''); }
  else if (bookTab === 'clues') h = stoneObjs.filter(o => !o.got).map(o => `<div class="card"><b>?</b><i>${esc(o.hint)}</i></div>`).join('') || '<p>You have found every stone.</p>';
  $('#bookbody').innerHTML = h;
  $('#bookbody').querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const w = b.dataset.w; playWord(w); if (bookTab === 'bag' && FOOD[w] && has(w) && S.hp < 5) { addItem(w, -1); S.hp = Math.min(5, S.hp + FOOD[w]); updateHUD(); toast(w, 'You eat it. You feel better.'); renderBook(); } });
  $('#bookstat').textContent = `${S.known.length}/${Object.keys(VOCAB).length} words · ${S.spells.length} spells · ${S.stones.length}/${STONES.length} stones`;
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { bookTab = t.dataset.t; renderBook(); });
$('#bookbtn').onclick = () => openBook(); $('#bookclose').onclick = () => closeAll();
let resetArm = 0;
$('#reset').onclick = () => { if (!resetArm) { resetArm = 1; $('#reset').textContent = 'Tap again to erase'; setTimeout(() => { resetArm = 0; $('#reset').textContent = 'New game'; }, 3000); return; } try { localStorage.removeItem(SAVE); } catch (e) { } location.reload(); };
function closeAll() { speaking = null; ['#dlg', '#kb', '#book', '#shop'].forEach(s => $(s).classList.add('hide')); uiOpen = null; hearing++; }

/* ---------------- loop ---------------- */
let curInteract = null, last = performance.now(), saveT = 0, ambT = 0, started = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
  if (started && !uiOpen && moto.riding) rideTick(dt);
  else if (moto.riding) { moto.speed = 0; engineSound(false); }
  if (started && !uiOpen && !boatState.riding && !moto.riding) {
    let mx = input.jx, mz = input.jy; const K = input.keys;
    if (K.KeyW || K.ArrowUp) mz -= 1; if (K.KeyS || K.ArrowDown) mz += 1; if (K.KeyA) mx -= 1; if (K.KeyD) mx += 1;
    if (K.ArrowLeft) player.yaw += 2 * dt; if (K.ArrowRight) player.yaw -= 2 * dt;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    if (l > .05) { if (player.swiftT > 0) player.swiftT -= dt; const sp = (player.swiftT > 0 ? 10 : 5) * dt; const s = Math.sin(player.yaw), c = Math.cos(player.yaw); (inside ? moveInside : tryMove)((mx * c + mz * s) * sp, (-mx * s + mz * c) * sp); }
  }
  // camera
  if (moto.riding) {
    camOff *= Math.pow(.2, dt); const a = moto.yaw + camOff, gy0 = groundH(moto.x, moto.z);
    const cx = moto.x - Math.sin(a) * 5.5, cz = moto.z - Math.cos(a) * 5.5, cy = Math.max(groundH(cx, cz) + 1, gy0 + 2.8);
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 6)); camera.lookAt(moto.x + Math.sin(a) * 3, gy0 + 1.2, moto.z + Math.cos(a) * 3); camY = gy0 + EYE;
  } else {
    const gy = boatState.riding || (boatState.moving && Math.abs(player.x - boat.position.x) < .1) ? boat.position.y + .6 : inside ? inside.floor : groundH(player.x, player.z);
    camY += (gy + EYE - camY) * Math.min(1, dt * 10);
    camera.position.set(player.x, camY + (input.jx || input.jy ? Math.sin(t * 9) * .03 : 0), player.z);
    camera.rotation.set(0, 0, 0); camera.rotateY(player.yaw); camera.rotateX(player.pitch);
  }
  // day / night
  nightT += (nightGoal - nightT) * Math.min(1, dt * 1.2); const n = nightT;
  skyMat.uniforms.top.value.copy(DAY.top).lerp(NIGHT.top, n); skyMat.uniforms.hor.value.copy(DAY.hor).lerp(NIGHT.hor, n); skyMat.uniforms.night.value = n; skyMat.uniforms.sun.value.set(.5 - n, .25 + n * .2, -.6).normalize();
  scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, n); hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * n; sun.intensity = DAY.sun + (NIGHT.sun - DAY.sun) * n; sun.color.copy(DAY.sunC).lerp(NIGHT.sunC, n); hemi.groundColor.copy(DAY.ground).lerp(NIGHT.ground, n);
  stars.material.opacity = n; fireflies.material.opacity = n * .9; marketLight.intensity = (F.marketLit ? 1.5 : 0) + n * 2.5;
  lanterns.forEach(l => l.material.emissive && l.material.emissive.copy(l.material.color).multiplyScalar(Math.max(n * .8, F.marketLit ? .6 : 0)));
  streetLamps.forEach(l => l.material.emissive.setHex(n > .5 ? 0xfff0c0 : 0));
  motoLight.intensity = moto.riding && n > .3 ? 3 : 0;
  sky.position.copy(camera.position);
  if (n > .05) { for (let i = 0; i < ffN; i++) { const s = ffSeed[i]; ffP[i * 3] = s[0] + Math.sin(t * .5 + s[2]) * 2; ffP[i * 3 + 2] = s[1] + Math.cos(t * .4 + s[2]) * 2; ffP[i * 3 + 1] = groundH(s[0], s[1]) + 1 + Math.sin(t + s[2]) * .5; } ffGeo.attributes.position.needsUpdate = true; }
  water.material.color.setHex(n > .5 ? 0x1a2a40 : 0x4a7f86);
  // stones: harder to spot — the word only shows up close
  for (const o of stoneObjs) { const vis = stoneVisible(o); o.g.visible = vis; if (vis) { const d = dist(o.g.position.x, o.g.position.z); o.glyph.visible = o.ok && d < 6; if (!o.got && o.ok) o.st.rotation.y = t * .6; } }
  // NPCs
  for (const [id, o] of Object.entries(npcObjs)) { const dx = player.x - o.g.position.x, dz = player.z - o.g.position.z; if (dx * dx + dz * dz < 64) o.body.rotation.y += ((Math.atan2(dx, dz)) - o.body.rotation.y) * .1; o.g.visible = id !== 'monk' || F.lamps; }
  if (ball.visible) { const k = npcObjs.kid.g.position; ball.position.set(k.x + .6, k.y + .25 + (F.ballDone ? Math.abs(Math.sin(t * 3)) * 1.5 : 0), k.z + .3); }
  // dog
  dogTick(dt, t); enemyTick(dt, t); if (started) healTick(dt);
  for (const c of chickens) { if (c.tx != null) { const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz); if (d < .3 || Math.hypot(c.x - c.hx, c.z - c.hz) > 25) c.tx = null; else { c.x += dx / d * dt * 3; c.z += dz / d * dt * 3; c.a = Math.atan2(dz, dx); } } else { c.a += rnd(-.2, .2); c.x += Math.cos(c.a) * dt * .8; c.z += Math.sin(c.a) * dt * .8; if (Math.hypot(c.x - c.hx, c.z - c.hz) > 7) c.a = Math.atan2(c.hz - c.z, c.hx - c.x); } c.c.position.set(c.x, groundH(c.x, c.z) + Math.abs(Math.sin(t * 8 + c.a)) * .05, c.z); c.c.rotation.y = -c.a; }
  // buffalo
  { const dx = bufS.tx - bufS.x, dz = bufS.tz - bufS.z, d = Math.hypot(dx, dz); if (d > .3 && !bufS.lie) { bufS.x += dx / d * dt * 1.2; bufS.z += dz / d * dt * 1.2; buffalo.rotation.y = Math.atan2(-dz, dx); bufLegs.forEach((l, i) => l.rotation.z = Math.sin(t * 6 + i * 1.6) * .3); } buffalo.position.set(bufS.x, .5 - (bufS.lie ? .5 : 0), bufS.z); bufCol.x = bufS.x; bufCol.z = bufS.z; }
  if (!boatState.moving) boat.position.y = WATER_Y + .25 + Math.sin(t * 1.5) * .04;
  hearthFire.scale.y = 1 + .3 * Math.sin(t * 18);
  for (let i = anims.length - 1; i >= 0; i--) if (anims[i](dt, t) === false) anims.splice(i, 1);
  tickParticles(dt);
  if (started) {
    let best = null, bd = 1e9;
    if (moto.riding) best = dismountIt;
    else if (!uiOpen && !boatState.riding) for (const it of interact) { if ((it.house || null) !== (inside ? inside.id : null)) continue; if (it.on && !it.on()) continue; const d = dist(it.x, it.z); if (d < it.r && d < bd) { bd = d; best = it; } }
    const lbl = best ? best.label() + (best.kh ? '|' + best.kh : '') : '';
    if (best !== curInteract || lbl !== $('#act').dataset.l) { curInteract = best; const a = $('#act'); a.dataset.l = lbl; if (best) { a.innerHTML = esc(best.label()) + (best.kh ? ` <span class="kh">${esc(best.kh)}</span>` : ''); a.classList.remove('hide'); } else a.classList.add('hide'); }
    drawCompass(); visitTick(dt);
    if ((saveT += dt) > 4) { saveT = 0; S.moto.fuel = moto.fuel; S.moto.flat = moto.flat; S.moto.fallen = moto.fallen; save(); }
    if ((ambT -= dt) < 0) { ambT = rnd(1.5, 5); ambience(); }
  }
  renderer.render(scene, camera);
}
function dogTick(dt, t) {
  if (F.dogFriend && dist(dogS.x, dogS.z) > 45) { dogS.x = player.x + 2; dogS.z = player.z + 2; dogS.sit = false; }
  if (F.dogFriend && !dogS.sit) {
    const target = stoneObjs.find(o => !o.got && (stoneVisible(o) || o.mode === 'dig') && Math.hypot(o.x - dogS.x, o.z - dogS.z) < 18 && Math.hypot(o.x - player.x, o.z - player.z) < 22);
    if (target) { dogS.tx = target.x + 1; dogS.tz = target.z; if (Math.hypot(target.x - dogS.x, target.z - dogS.z) < 1.6) { dogBubble.visible = true; if ((dogS.barkT -= dt) < 0) { dogS.barkT = 2.5; if (dist(dogS.x, dogS.z) < 30) bark(); } if (target.mode === 'dig' && !target.ok) reveal(target, 'The dog digs furiously… and uncovers a word stone!'); } }
    else { dogBubble.visible = false; if (dist(dogS.x, dogS.z) > 4) { dogS.tx = player.x + 1.5; dogS.tz = player.z + 1; } }
  }
  if (!dogS.sit) { const dx = dogS.tx - dogS.x, dz = dogS.tz - dogS.z, d = Math.hypot(dx, dz); if (d > .3) { const sp = Math.min(d, (F.dogFriend ? 7 : 4) * dt); dogS.x += dx / d * sp; dogS.z += dz / d * sp; dog.rotation.y = Math.atan2(-dz, dx); dogLegs.forEach((lg, i) => lg.rotation.z = Math.sin(t * 14 + i * 1.6) * .5); } else if (!F.dogFriend && (dogS.t -= dt) < 0) { dogS.t = rnd(2, 6); dogS.tx = dogS.x + rnd(-6, 6); dogS.tz = dogS.z + rnd(-6, 6); if (blocked(dogS.tx, dogS.tz) || Math.hypot(dogS.tx, dogS.tz) > 30) { dogS.tx = 4; dogS.tz = 8; } } }
  dog.position.set(dogS.x, groundH(dogS.x, dogS.z), dogS.z); dog.children[0].position.y = dogS.sit ? .35 : .5; tail.rotation.z = .6 + Math.sin(t * 12) * .4;
}
/* ---------------- health ---------------- */
let regenT = 0, hurtT = 0;
function damage(n, word) {
  if (S.hp <= 0) return; S.hp = Math.max(0, S.hp - n); updateHUD(); hurtT = .5; chime([160, 110], .35, 'square', .06);
  try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) { }
  if (S.hp === 0) setTimeout(faint, 600);
}
function faint() {
  if (moto.riding) dismount(); boatState.riding = false; closeAll();
  const h = HOUSES.yay; enterHouse(h, h.W / 2 - 1.6, -h.D / 2 + 1.4, Math.PI / 2); S.hp = 5; updateHUD();
  toast('', 'Everything goes dark… You wake up in Grandma’s house.'); setTimeout(() => talk('yay_faint'), 1200);
}
function healTick(dt) { if (S.hp < 5 && S.hp > 0) { if ((regenT += dt) > 45) { regenT = 0; S.hp++; updateHUD(); } } else regenT = 0; hurtT = Math.max(0, hurtT - dt); $('#hurt').style.opacity = hurtT * 1.6; }

/* ---------------- enemies ---------------- */
const ECFG = { snake: { speed: 2.4, aggro: 7, reach: 1.1, cd: 2, respawn: 60 }, monkey: { speed: 5.5, aggro: 11, reach: 1.2, cd: 1.5, respawn: 90 }, bees: { aggro: 6, cd: 2.5, respawn: 120 }, thief: { speed: 3.4, aggro: 15, reach: 1.3, cd: 1, respawn: 150 } };
function personMesh(color) { const g = new THREE.Group(); cyl(.22, .26, .8, 0x1a1a22, 0, .4, 0, g); cyl(.28, .32, .75, color, 0, 1.15, 0, g); const hd = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), M(0x1a1a1a)); hd.position.y = 1.78; g.add(hd); box(.3, .06, .05, 0xd8d0b0, 0, 1.82, .24, g); return g; }
const enemies = ENEMIES.map(e => {
  const o = Object.assign({ x: e.at[0], z: e.at[1], state: 'idle', t: 0, cd: 0, frozenT: 0, calmT: 0, wx: e.at[0], wz: e.at[1] }, e);
  const g = new THREE.Group(); scene.add(g); o.mesh = g;
  if (e.type === 'snake') { o.segs = []; for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.13 - i * .008, 7, 5), M(i ? 0x4a6a2a : 0x5a7a2a)); s.position.set(-i * .2, .12, 0); g.add(s); o.segs.push(s); } box(.05, .04, .2, 0xe0c020, .08, .2, 0, g); }
  if (e.type === 'monkey') { const b = new THREE.Mesh(new THREE.SphereGeometry(.32, 8, 6), M(0x7a5030)); b.position.y = .5; b.scale.y = 1.2; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), M(0x8a6040)); h.position.set(.1, .95, 0); g.add(h); box(.05, .1, .2, 0xd8b090, .3, .93, 0, g); const tl = new THREE.Mesh(new THREE.TorusGeometry(.35, .05, 4, 10, 3.5), M(0x7a5030)); tl.position.set(-.35, .5, 0); tl.rotation.y = Math.PI / 2; g.add(tl); }
  if (e.type === 'bees') { tree(e.at[0] + 1.5, e.at[1], 1.1); const hive = new THREE.Mesh(new THREE.ConeGeometry(.45, .9, 8), M(0x8a6a2a)); hive.rotation.x = Math.PI; hive.position.set(e.at[0] + 1.2, groundH(e.at[0], e.at[1]) + 2.7, e.at[1] + .6); scene.add(hive); const bg = new THREE.BufferGeometry(); o.bp = new Float32Array(40 * 3); bg.setAttribute('position', new THREE.BufferAttribute(o.bp, 3)); o.pts = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xf0c020, size: .07 })); o.pts.frustumCulled = false; scene.add(o.pts); o.hx = e.at[0] + 1.2; o.hz = e.at[1] + .6; o.hy = groundH(e.at[0], e.at[1]) + 2.4; }
  if (e.type === 'thief') g.add(personMesh(0x222228));
  return o;
});
const seenEnemy = new Set();
function announce(e) { if (seenEnemy.has(e.word)) return; seenEnemy.add(e.word); hear(e.word); toast(e.word + ' !', ''); playWord(e.word); }
const ePos = e => e.type === 'bees' ? [e.hx, e.hz] : [e.x, e.z];
function enemyCast(w) {
  const list = enemies.filter(e => e.state !== 'gone' && !(e.night && nightT < .5) && !(e.type === 'thief' && (F.thief || F.thiefCaught)) && dist(...ePos(e)) < 13);
  if (!list.length) return false;
  list.sort((a, b) => dist(...ePos(a)) - dist(...ePos(b)));
  for (const e of list) {
    if (w === 'ເຊົາ') { if (e.type === 'thief') { catchThief(e); use(w, 'thief'); return true; } e.frozenT = 8; use(w, e.type); chime([1200, 900], .6, 'triangle', .08); toast(w, { snake: 'The snake freezes mid-slither.', monkey: 'The monkey stops dead, blinking.', bees: 'The bees hang still in the air.' }[e.type]); return true; }
    if (w === 'ໄປ' && ['snake', 'monkey', 'thief'].includes(e.type) && !boatState.riding && !moto.riding) { e.state = 'flee'; e.t = 4; use(w, e.type); toast(w, { snake: 'The snake slithers away.', monkey: 'The monkey scampers off.', thief: 'The thief runs into the dark.' }[e.type]); return true; }
    if (w === 'ໄຟ' && ['snake', 'bees', 'thief'].includes(e.type)) { campfire(...front(2)); if (e.type === 'bees') e.calmT = 120; else { e.state = 'flee'; e.t = 4; } use(w, e.type); toast(w, { snake: 'The snake recoils from the flames and flees.', bees: 'Smoke drifts into the hive. The bees settle down.', thief: 'The light startles the thief, who runs off.' }[e.type]); return true; }
    if (w === 'ນ້ຳ' && e.type === 'bees') { rain(e.hx, e.hz); e.calmT = 120; use(w, 'bees'); toast(w, 'Rain drenches the hive. The bees crawl back inside.'); return true; }
  }
  return false;
}
function catchThief(e) {
  e.state = 'gone'; e.t = 1e9; F.thiefCaught = 1; chime([523, 659, 784]);
  talk('thief_caught', () => { const back = S.stolen; S.stolen = 0; if (back) { pay(back); toast('', `He gives back the ${khNum(back)} ₭ he stole from you.`); } save(); refreshObjective(); });
}
function enemyTick(dt, t) {
  const active = started && !uiOpen && !inside && !moto.riding && !boatState.riding && S.hp > 0;
  for (const e of enemies) {
    const C = ECFG[e.type]; let vis = true;
    if (e.night && nightT < .5) vis = false;
    if (e.type === 'thief' && (F.thief || F.thiefCaught)) vis = false;
    if (e.state === 'gone') { vis = false; if ((e.t -= dt) <= 0) { e.state = 'idle'; e.x = e.at[0]; e.z = e.at[1]; } }
    e.mesh.visible = vis && e.type !== 'bees';
    if (e.type === 'bees') {
      const calm = e.calmT > 0; if (calm) e.calmT -= dt; const d = dist(e.hx, e.hz);
      if (e.frozenT > 0) e.frozenT -= dt;
      const chasing = active && !calm && e.frozenT <= 0 && d < C.aggro;
      for (let i = 0; i < 40; i++) { const a = t * (calm ? .5 : 3) + i * 1.7, r = calm ? .3 : .9; let cx = e.hx, cy = e.hy, cz = e.hz; if (chasing) { const dx = e.hx - player.x, dz = e.hz - player.z, l = Math.hypot(dx, dz) || 1; cx = player.x + dx / l * 1.8; cz = player.z + dz / l * 1.8; cy = camY - .2; } e.bp[i * 3] = cx + Math.cos(a + i) * r * (1 + (i % 3) * .3); e.bp[i * 3 + 1] = cy + Math.sin(a * 1.3 + i) * r * .6; e.bp[i * 3 + 2] = cz + Math.sin(a + i * 2) * r; }
      e.pts.geometry.attributes.position.needsUpdate = true; e.pts.material.size = calm ? .04 : .07;
      if (chasing) { announce(e); if ((e.cd -= dt) <= 0) { e.cd = C.cd; damage(1, e.word); } } else e.cd = .8;
      continue;
    }
    if (!vis) continue;
    if (e.frozenT > 0) { e.frozenT -= dt; e.mesh.position.set(e.x, groundH(e.x, e.z), e.z); continue; }
    const d = dist(e.x, e.z); let tx = null, tz = null, sp = 0;
    if (e.state === 'flee') { const a = Math.atan2(e.z - player.z, e.x - player.x); tx = e.x + Math.cos(a) * 5; tz = e.z + Math.sin(a) * 5; sp = (C.speed || 3) * 1.4; if ((e.t -= dt) <= 0) { e.state = 'gone'; e.t = C.respawn; } }
    else if (active && d < C.aggro) {
      e.state = 'chase'; announce(e); tx = player.x; tz = player.z; sp = C.speed;
      if (d < C.reach && (e.cd -= dt) <= 0) {
        e.cd = C.cd;
        if (e.type === 'snake') damage(1, e.word);
        else if (e.type === 'monkey') { if (has('ກ້ວຍ')) { addItem('ກ້ວຍ', -1); toast('ລິງ', 'The monkey grabs your banana and runs!'); } else if (S.money >= 5000) { const amt = Math.min(10000, S.money); S.money -= amt; updateHUD(); toast('ລິງ', `The monkey snatches ${khNum(amt)} ₭ and runs!`); } else damage(1, e.word); e.state = 'flee'; e.t = 4; }
        else if (e.type === 'thief') { const amt = Math.min(20000, S.money); if (amt) { S.money -= amt; S.stolen += amt; updateHUD(); toast('ໂຈນ', `The thief grabs ${khNum(amt)} ₭ and runs! Say ເຊົາ to stop him.`); } else damage(1, e.word); e.state = 'flee'; e.t = 5; }
      }
    }
    else { e.state = 'idle'; if (Math.hypot(e.x - e.wx, e.z - e.wz) < .4 || Math.random() < dt * .2) { e.wx = e.at[0] + rnd(-4, 4); e.wz = e.at[1] + rnd(-4, 4); } tx = e.wx; tz = e.wz; sp = (C.speed || 2) * .35; }
    if (tx != null) { const dx = tx - e.x, dz = tz - e.z, l = Math.hypot(dx, dz); if (l > .05) { const nx = e.x + dx / l * Math.min(l, sp * dt), nz = e.z + dz / l * Math.min(l, sp * dt); if (!hardBlocked(nx, nz)) { e.x = nx; e.z = nz; } e.mesh.rotation.y = Math.atan2(-dz, dx); } }
    e.mesh.position.set(e.x, groundH(e.x, e.z), e.z);
    if (e.segs) e.segs.forEach((s, i) => s.position.z = Math.sin(t * 8 - i * .9) * .12);
    if (e.type === 'monkey') e.mesh.position.y += Math.abs(Math.sin(t * (e.state === 'idle' ? 4 : 10))) * .3;
  }
}

/* ---------------- the golden harvest (Mango Village) ---------------- */
{
  const gm = new THREE.ConeGeometry(.16, .9, 4); gm.translate(0, .45, 0); const N = isMobile ? 380 : 650; const im = new THREE.InstancedMesh(gm, M(0xd8b040), N); const m = new THREE.Matrix4();
  for (let i = 0; i < N; i++) { m.makeScale(1, rnd(.7, 1.2), 1); m.setPosition(rnd(35, 67), .55, rnd(-117, -87)); im.setMatrixAt(i, m); } scene.add(im);
  for (let x = 35; x <= 67; x += 8) box(.5, .3, 31, 0x8a6a3a, x, .62, -102);
}
const clumps = [];
for (let i = 0; i < 14; i++) {
  const x = 38 + (i % 5) * 6 + rnd(-1, 1), z = -112 + Math.floor(i / 5) * 9 + rnd(-1, 1), g = new THREE.Group(); g.position.set(x, groundH(x, z), z); scene.add(g);
  const stalks = []; for (let k = 0; k < 9; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.12, 1.4, 4), M(0xe8c050)); c.position.set(rnd(-.35, .35), .7, rnd(-.35, .35)); c.rotation.z = rnd(-.25, .25); g.add(c); stalks.push(c); }
  box(.8, .12, .8, 0x9a8040, 0, .06, 0, g);
  const cl = { g, x, z, stalks, cut: !!F.harvest }; stalks.forEach(s => s.visible = !cl.cut); clumps.push(cl);
  interact.push({ x, z, r: 1.9, label: () => 'Cut the rice', kh: 'ຕັດ', act: () => cutClump(cl), on: () => !cl.cut });
}
function cutClump(cl) {
  if (!F.harvestAsk) { toast('ເຂົ້າ', 'Ripe golden rice. Whose field is this? Maybe the farmer nearby will say.'); return; }
  cl.cut = true; cl.stalks.forEach(s => s.visible = false);
  addItem('ມັດ'); learn('ຕັດ', true); learn('ມັດ', true); burst(cl.x, groundH(cl.x, cl.z) + .8, cl.z, 0xf0d060, 25, 2); chime([700, 900], .3);
  toast('ມັດ', `You cut a bundle of rice: ${khNum(S.bag['ມັດ'])}`); save(); refreshObjective();
}

PLACES = {
  'ເຮືອນ': { name: 'Grandma\u2019s house', dest: [0.6, -1.3, -2.64], in: (x, z) => Math.hypot(x, z) < 8 },
  'ໂຮງຮຽນ': { name: 'the school', dest: [31, -36, 0], in: (x, z) => Math.hypot(x - 32, z + 43) < 13 },
  'ຕະຫຼາດ': { name: 'the market', dest: [41, 8, -1.57], in: (x, z) => Math.hypot(x - 53, z - 9) < 14 },
  'ນາ': { name: 'the rice fields', dest: [17, 30, Math.PI], in: (x, z) => inPaddy(x, z) },
  'ທ່າເຮືອ': { name: 'the river dock', dest: [DOCK.east.x + 3, DOCKZ + 2, 1.57], in: (x, z) => Math.hypot(x - DOCK.east.x, z - DOCKZ) < 10 },
  'ວັດ': { name: 'the temple', dest: [T.x + 7, T.z, 1.57], in: (x, z) => Math.hypot(x - T.x, z - T.z) < 13 },
  'ບ້ານມ່ວງ': { name: 'Mango Village', dest: [16, -86, 0.6], in: (x, z) => Math.hypot(x - 8, z + 100) < 16 },
  'ເມືອງ': { name: 'the town', dest: [172, 2, -1.57], in: (x, z) => inTown(x, z) },
};
if (S.spells.includes('ເຮືອນ') && !S.visited.includes('ເຮືອນ')) S.visited.push('ເຮືອນ'); // older saves
if (F.errand) { if (!S.spells.includes('ຂຶ້ນ')) S.spells.push('ຂຶ້ນ'); if (!S.spells.includes('ລົງ')) S.spells.push('ລົງ'); }
if (S.hp == null) S.hp = 5;
function warpTo(w) {
  const p = PLACES[w], [x, z, yaw] = p.dest;
  if (boatState.riding || boatState.moving) { toast(w, 'Not while you are on the boat.'); return; }
  inside = null; roomLight.intensity = 0;
  burst(player.x, camY, player.z, 0xf6e3b0, 50);
  if (moto.riding) { moto.x = x; moto.z = z; moto.yaw = yaw + Math.PI; moto.speed = 0; placeMoto(); }
  player.x = x; player.z = z; player.yaw = yaw; player.pitch = -.05; camY = groundH(x, z) + EYE; stuckFrames = 0;
  setTimeout(() => burst(x, groundH(x, z) + 1.5, z, 0xf6e3b0, 50), 50);
  done(w, 'warp', w, `The word carries you to ${p.name}.`);
}
let visitT = 0;
function visitTick(dt) { if ((visitT -= dt) > 0) return; visitT = .5; for (const [w, p] of Object.entries(PLACES)) if (!S.visited.includes(w) && p.in(player.x, player.z)) { S.visited.push(w); checkWarp(w); } }
$('#act').onclick = () => curInteract && curInteract.act();
requestAnimationFrame(frame);

/* ---------------- start ---------------- */
if (hadSave) { $('#start').textContent = 'Continue'; $('#newg').classList.remove('hide'); }
$('#newg').onclick = () => { try { localStorage.removeItem(SAVE); } catch (e) { } location.reload(); };
$('#start').onclick = () => {
  unlockAudio(); setTimeout(() => playWord('ຂ້ອຍ'), 150);
  $('#title').classList.add('hide'); $('#hud').classList.remove('hide'); started = true;
  if (!isMobile) { $('#joyhint').innerHTML = 'WASD to walk<br>drag to look'; joy.style.display = 'none'; }
  updateHUD(); refreshObjective();
  if (!F.met) setTimeout(() => toast('', 'You wake up on a mat under a house on stilts…'), 400);
};
if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { } }
if (F.door) sockets.forEach((s, i) => { const c = HEADS[i].color; s.material.color.set(c); s.material.emissive.set(c); });
window.__game = { get peak() { return peak; }, setSpeaking: v => (speaking = v), THREE, scene, camera, enemies, HOUSES, enterHouse, get inside() { return inside; }, clumps, damage, warpTo, shopItems, overlap, input, canStep, blocked, groundH, baseH, playWord, voice, dogS, S, F, player, moto, cast, talkTo, teachSpell, pay, addItem, openShop, mount, dismount, stoneObjs };
