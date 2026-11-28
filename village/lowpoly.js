// Low-poly toolkit and models, the same as the Bible game's (../leap/game.js): N64-style
// flat-shaded meshes, tiny bilinear textures, lofted people and animals.
import * as THREE from './three.module.min.js';
const rnd = (a, b) => a + Math.random() * (b - a);
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
// body material: skin-coloured vertices get some self-light, so skin shadows stay mild while clothes shade normally
const VC = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
VC.onBeforeCompile = sh => {
  sh.vertexShader = 'attribute float skinw;\nvarying float vSkin;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkin = skinw;');
  sh.fragmentShader = 'varying float vSkin;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * .2 * vSkin;');
};
let LOFT_SKIN = -1;
function loft(rings, sides = 6, caps = true, stagger = true) {
  const pos = [], col = [], c = new THREE.Color(), P = (r, j, i = 0) => { const a = ((j + (stagger ? i % 2 : 0) * .5) / sides) * Math.PI * 2 + Math.PI / sides; return [Math.sin(a) * r[1], r[0], r[3] + Math.cos(a) * r[2]]; };
  const skw = [], tri = (a, b2, d, ca, cb, cd) => { pos.push(...a, ...b2, ...d); for (const cc of [ca, cb, cd]) { c.setHex(cc); col.push(c.r, c.g, c.b); skw.push(cc === LOFT_SKIN ? 1 : 0); } };
  for (let i = 0; i < rings.length - 1; i++) { const A = rings[i], B = rings[i + 1]; for (let j = 0; j < sides; j++) { const a0 = P(A, j, i), a1 = P(A, j + 1, i), b0 = P(B, j, i + 1), b1 = P(B, j + 1, i + 1); // staggered rings: on even bands the next ring's vertex sits between a0 and a1, on odd bands b1 does, so the fan has to follow it or the triangles cross
        const ys = A[0] > B[0], F = (p, q, r, cp, cq, cr) => ys ? tri(p, r, q, cp, cr, cq) : tri(p, q, r, cp, cq, cr);
        if (!stagger || i % 2 === 0) { F(a0, a1, b0, A[4], A[4], B[4]); F(a1, b1, b0, A[4], B[4], B[4]); } else { F(a0, a1, b1, A[4], A[4], B[4]); F(a0, b1, b0, A[4], B[4], B[4]); } } }
  if (caps) { const first = rings[0], last = rings[rings.length - 1], down = first[0] > last[0]; for (const [r, up, ri] of [[first, down, 0], [last, !down, rings.length - 1]]) { const ctr = [0, r[0], r[3]]; for (let j = 0; j < sides; j++) { const a = P(r, j, ri), b2 = P(r, j + 1, ri); if (up) tri(ctr, a, b2, r[4], r[4], r[4]); else tri(ctr, b2, a, r[4], r[4], r[4]); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('skinw', new THREE.Float32BufferAttribute(skw, 1)); g.computeVertexNormals(); return g;
}
const HEADM = {}; let PERSON_N = 0;
function person(o = {}) {
  const fem = !!o.female && !o.small, clothed = (o.top ?? 0x8a6a4a) !== (o.skin ?? 0xb07a50), pants = !o.robe && (o.bottom ?? o.top ?? 0x8a6a4a) !== (o.skin ?? 0xb07a50);
  // grown men stand about 10% taller than women
  const g = new THREE.Group(), b = grp(0, 0, 0, g); b.scale.setScalar(o.small ? .66 : (o.scale || 1) * (fem ? 1 : 1.1));
  // everyone's skin a shade lighter, so shaded faces stay readable; clothes that were "skin" follow it
  const sk0 = o.skin ?? 0xb07a50, sk = new THREE.Color(sk0).lerp(new THREE.Color(0xffe2c4), .2).getHex(), SK = c => c === sk0 ? sk : c;
  LOFT_SKIN = sk;
  const top = SK(o.top ?? 0x8a6a4a), bot = SK(o.bottom ?? o.top ?? 0x8a6a4a);
  const mat = c => o.glow ? MB(o.glow, { transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }) : MS(c);
  const legs = [], arms = [], knees = [], feet = [], VM = () => o.glow ? mat(0) : VC;
  // women: legs ~16% longer, the rest of the body raised to sit on them
  const d = fem ? .12 : 0, L = (.74 + d) / .74, sy = rs => rs.map(r => [r[0] * L, ...r.slice(1)]);
  // one low-poly torso, hips to neck; women: narrower waist, fuller hips, a moderate bust in the same shape
  const T = fem
    ? [[.68, .2, .13, 0, bot], [.82, .33, .21, 0, bot], [1.0, .2, .14, 0, top], [1.2, .26, clothed ? .2 : .17, clothed ? .05 : .03, top], [1.42, .27, .14, 0, top], [1.5, .12, .09, 0, top], [1.53, .075, .075, .01, sk], [1.66, .075, .075, .01, sk]]
    : [[.68, .2, .13, 0, bot], [.82, .27, .17, 0, bot], [1.0, .27, .165, 0, top], [1.28, .31, .18, .02, top], [1.44, .34, .16, 0, top], [1.52, .14, .1, 0, top], [1.55, .085, .085, .01, sk], [1.67, .085, .085, .01, sk]];
  mesh(loft(T.map(r => [r[0] + d, ...r.slice(1)]), 5), VM(), 0, 0, 0, b);
  // robes: women's reach the ground, men's stop above the ankle so the calves show
  if (o.robe) mesh(loft(fem ? [[1.0 + d, .21, .15, 0, bot], [.8 + d, .32, .22, 0, bot], [.08, .52, .4, 0, bot]] : [[1.0, .28, .17, 0, bot], [.8, .33, .23, 0, bot], [.3, .46, .37, 0, bot]], 6, false), VM(), 0, 0, 0, b);
  if (o.coat) [0xd03a2a, 0xf2c51c, 0x2a8a4a, 0x2f5fd0].forEach((c, i) => { const y0 = .86 + d + i * .16; mesh(loft([[y0, .25, .17, .015, c], [y0 + .12, .26, .175, .015, c]], 5, false), VC, 0, 0, 0, b); });
  // arms: shoulder, bicep, forearm, hand in one shape
  const sl = SK(o.sleeve ?? top);
  const AW = fem ? 1 : 1.3; for (const s of [-1, 1]) { const p = pivot(b, s * (fem ? .27 : .35), 1.4 + d, 0); mesh(loft([[.06, .08 * AW, .08 * AW, 0, sl], [-.06, .1 * AW, .09 * AW, 0, sl], [-.3, .065 * AW, .065 * AW, 0, sl], [-.52, .05 * AW, .05 * AW, .01, o.robe ? sl : sk], [-.68, .055 * AW, .035 * AW, .03, sk]], 4), VM(), 0, 0, 0, p); arms.push(p); }
  // legs: thigh and shin as separate shapes so the knee bends
  const lc = o.robe ? sk : pants ? bot : sk, fc = o.barefoot ? sk : 0x4a3420;
  for (const s of [-1, 1]) {
    const W = fem ? 1.2 : 1.3, p = pivot(b, s * (fem ? .14 : .13), .74 + d, 0); if (!o.robe) mesh(loft(sy([[.04, .12 * W, .12 * W, 0, lc], [-.16, .11 * W, .105 * W, 0, lc], [-.38, .075 * W, .075 * W, .01, lc]]), 4), VM(), 0, 0, 0, p);
    const k = pivot(p, 0, -.37 * L, 0); if (!o.robe) mesh(loft(sy([[.02, .075 * W, .075 * W, .01, sk], [-.1, .085 * W, .09 * W, -.015, sk], [-.32, .045 * W, .045 * W, 0, sk]]), 4), VM(), 0, 0, 0, k); else if (!fem) mesh(loft([[-.08, .07 * W, .075 * W, -.01, sk], [-.32, .045 * W, .045 * W, 0, sk]], 4), VM(), 0, 0, 0, k);
    const FW = fem ? 1 : 1.3, f = mesh(loft(sy([[-.3, .055 * FW, .06 * FW, .01, fc], [-.4, .07 * FW, .12 * FW, .07 * FW, fc]]), 4), VM(), 0, 0, 0, k);
    legs.push(p); knees.push(k); feet.push(f);
  }
  if (o.sash) { const sh = box(.95, .11, .4, MB(o.sash), 0, 1.16 + d, .005, b); sh.rotation.z = .85; }
  if (o.staff) { const st = mesh(new THREE.CylinderGeometry(.035, .035, 2.2, 5), mat(0x6a4424), 0, -.5, .05, arms[1]); st.rotation.x = .1; }
  const head = grp(0, 1.8 + d, 0, b);
  // the head: a six-sided double pyramid, 12 triangles, a flat face to the front
  // the lower faces point down and caught almost no light, which read as a beard: give the face its own softly lit skin
  // shaded, with a little self-light so the down-facing chin faces don't go dark
  const hm = o.glow ? mat(sk) : (HEADM[sk] ??= new THREE.MeshLambertMaterial({ color: sk, flatShading: true, emissive: new THREE.Color(sk).multiplyScalar(.38) }));
  mesh(loft([[.305, .02, .02, 0, sk], [0, .29, .29, 0, sk], [-.16, .24, .24, .025, sk], [-.3, .06, .06, .05, sk]], 6, true, false), o.glow ? mat(sk) : VC, 0, 0, 0, head);
  // every person gets one of several head shapes: broad, long, tall, small, square...
  const HS = [[1, 1, 1], [1.1, .9, 1], [.9, 1.14, .95], [1.04, 1.12, 1.04], [.94, .94, .94], [1.12, 1, 1.06], [.96, 1.06, 1.08]][(o.face ?? PERSON_N++) % 7];
  head.scale.set(...HS);
  if (!o.glow) { const mo = mesh(new THREE.BoxGeometry(.1, .022, .04), MB(0x5a2a22), 0, -.14, .235, head); mo.rotation.x = .15; }
  if (!o.glow) { for (const s of [-1, 1]) mesh(new THREE.OctahedronGeometry(.045, 0), MS(0x1a1010), s * .085, .03, .225, head); const no = mesh(new THREE.ConeGeometry(.055, .13, 3), MS(new THREE.Color(sk).multiplyScalar(.88).getHex()), 0, -.04, .235, head); no.rotation.x = -.3; }
  if (!fem && o.cloth != null && o.hair == null) o = { ...o, hair: o.beard ?? 0x2a1a10 };
  if (o.hair != null) { const h = mesh(new THREE.SphereGeometry(.31, 6, 2, 0, Math.PI * 2, 0, Math.PI * .55), mat(o.hair), 0, .02, -.03, head); h.rotation.x = -.35; if (fem || o.longHair) capsule(.2, .4, mat(o.hair), 0, -.22, -.15, head); }
  if (fem && o.cloth != null) { const c = mesh(new THREE.SphereGeometry(.33, 6, 2, 0, Math.PI * 2, 0, Math.PI * .5), mat(o.cloth), 0, .05, -.08, head); c.rotation.x = -.6; mesh(new THREE.CylinderGeometry(.26, .34, .5, 5, 1, true, Math.PI * .6, Math.PI * .8), mat(o.cloth), 0, -.2, -.1, head); }
  if (o.beard != null) { const bd = mesh(new THREE.ConeGeometry(.2, .42, 6), mat(o.beard), 0, -.32, .14, head); bd.rotation.x = Math.PI + .2; }
  if (o.leaves) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const l = mesh(new THREE.ConeGeometry(.11, .42, 4), mat(0x3f8a2a), Math.sin(a) * (fem ? .31 : .25), .8 + d, Math.cos(a) * (fem ? .21 : .17), b); l.rotation.x = Math.PI; }
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
  const [c, L, W, H, legH] = { pig: [0xe8a8a0, 1.1, .7, .62, .32], fox: [0xd8702a, .95, .34, .36, .32], cow: [0x8a5a3a, 1.7, .8, .9, .75], sheep: [0xf2eee0, 1.1, .8, .8, .45], lion: [0xd0a050, 1.6, .7, .8, .7], buffalo: [0x4a4a52, 2.0, .95, 1.0, .7], dog: [0xb08a5a, .9, .32, .38, .36], tiger: [0xd8802a, 1.9, .7, .75, .62], croc: [0x3a5a2a, 2.6, .9, .4, .18], elephant: [0x8a8a92, 2.6, 1.7, 1.8, 1.3], camel: [0xc8a06a, 1.8, .7, .9, 1.4], ram: [0xe8e2d0, 1.2, .8, .85, .5], horse: [0x6a4a30, 1.8, .6, .8, 1.0] }[kind];
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
    if (kind === 'cow' || kind === 'buffalo') sph(hr * .62, kind === 'buffalo' ? 0x3a3a40 : 0xd8b090, 0, -hr * .3, hr * 1.55, head).scale.set(1.1, .8, .8);
    if (kind === 'pig') { const sn = cyl(hr * .45, hr * .45, .16, 0xf0b8b0, 0, -.05, hr * 1.6, head, 6); sn.rotation.x = Math.PI / 2; for (const s2 of [-1, 1]) mesh(new THREE.ConeGeometry(.08, .18, 4), MS(c), s2 * hr * .6, hr * .8, hr * .3, head); }
    if (kind === 'fox' || kind === 'dog') { const sn = mesh(new THREE.ConeGeometry(.09, .3, 5), MS(hc), 0, -.02, hr * 1.7, head); sn.rotation.x = Math.PI / 2; for (const s2 of [-1, 1]) mesh(new THREE.ConeGeometry(.07, .2, 4), MS(hc), s2 * .1, .2, .12, head); } }
  if (kind === 'cow' || kind === 'buffalo') for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(.06, .34, 5), MS(0xf0e8d0), s * .3, .36, .2, head); h.rotation.z = -s * .8; }
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

function animLimbs(m, sp, dt, e) { const o = e || m; o.walkT = (o.walkT || 0) + dt * 10 * (sp ? 1 : 0);
  // a little up-and-down with every step
  if (m.b) { if (sp) { m.b.position.y = Math.abs(Math.sin(o.walkT)) * (m.legs.length > 2 ? .07 : .1) * Math.min(1, sp + .3); o.bobbing = true; } else if (o.bobbing) { m.b.position.y = 0; o.bobbing = false; } } const a = sp ? Math.sin(o.walkT) * .7 * Math.min(1, sp + .3) : 0; m.legs.forEach((l, i) => l.rotation.x += ((i % 2 ? a : -a) * (m.legs.length > 2 && i > 1 ? -1 : 1) - l.rotation.x) * Math.min(1, dt * 12));
  if (m.knees) m.knees.forEach((k, i) => { const want = sp ? Math.max(0, Math.sin(o.walkT + (i % 2 ? Math.PI : 0) - 1.3)) * 1.2 : (o.kneel || 0) * 1.55; k.rotation.x += (want - k.rotation.x) * Math.min(1, dt * 14); }); if (m.arms) m.arms.forEach((r, i) => { if (o.raise) r.rotation.x += (-2.6 - r.rotation.x) * Math.min(1, dt * 10); else r.rotation.x += ((i ? -a : a) - r.rotation.x) * Math.min(1, dt * 12); }); }

export { M, MB, mesh, box, cyl, ball, cone, grp, pivot, texture, noiseTex, plankTex, brickTex, waterTex, plankM, brickM, faceTex, capsule, sph, loft, person, animal, snake, bird, fish, tree, bush, rock, glowOrb, fire, log, logPile, tent, cloud, animLimbs, VC };
