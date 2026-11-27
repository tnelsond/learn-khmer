// Word audio through PeakSlab's own engine (github.com/tnelsond/peakslab):
// peak.wasm finds a word's recordings in .slab files, tnefar.wasm turns them into speech.
// A word can have several speakers' recordings ("word<tab>N<tab>tnefar": voice tnefarN.voice in the
// same slab); a voice file is its codebook, then either its postfilter (NXF3) or the name of its
// postfilter in the language's postfilters slab. samples() takes the speaker the caller prefers and
// falls back to whoever recorded the word. Files are fetched from the first source that works:
// peakslab.org (always the newest recordings, where the page may fetch from it) or the copies beside
// the game (a host that won't serve .slab files gets the same bytes from a .slab.js beside it).
const QMAX = 512, enc = new TextEncoder(), dec = new TextDecoder();

async function wasm(url, imports) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  const m = await WebAssembly.compile(await r.arrayBuffer());
  const imp = {};
  if (imports) for (const { module, name } of WebAssembly.Module.imports(m)) (imp[module] ??= {})[name] = () => 0;
  return (await WebAssembly.instantiate(m, imp)).exports;
}
async function bytes(url) {
  try { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return new Uint8Array(await r.arrayBuffer()); }
  catch (e) { // (hosts that won't serve a .slab: the same bytes, base64, in a script beside it)
    if (!/\.slab$/.test(url) || /^https?:/.test(url)) throw e;
    const { SLAB } = await import(url + '.js'), bin = atob(SLAB), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
}
// one slab in its own peak.wasm instance: find(word) -> [[details, bytes], ...]
async function openSlab(module, url, bufmax) {
  const [x, slab] = await Promise.all([WebAssembly.instantiate(module, {}), bytes(url)]).then(([i, s]) => [i.exports, s]);
  const src = x.malloc(slab.length); new Uint8Array(x.memory.buffer).set(slab, src);
  const rc = x.load_peak(src, slab.length, 0); if (rc !== 0) throw new Error('load_peak ' + rc + ' ' + url);
  const q0 = x.malloc(bufmax + 1024), q1 = q0 + QMAX, rptr = q1 + QMAX; let qc = q0;
  x.peak_init(q0, QMAX, q1, QMAX, rptr, bufmax + 1024 - QMAX * 2);
  const cache = {};
  return function find(word) {
    if (cache[word]) return cache[word];
    qc = qc === q0 ? q1 : q0; x.switchstate();
    const out = [];
    try {
      const b = enc.encode(word + '\0'); if (b.length > QMAX) return [];
      new Uint8Array(x.memory.buffer).set(b, qc); x.init_search(1, 0);
      let n;
      while ((n = x.get_result(1)) > 0) {
        const m = new Uint8Array(x.memory.buffer, rptr, n), z = m.indexOf(0), h = dec.decode(m.subarray(0, z)).trim().split('\t');
        if (h[0] === word) out.push([h.slice(1), m.slice(z + 1)]);
      }
    } finally { qc = qc === q0 ? q1 : q0; x.switchstate(); }
    return cache[word] = out;
  };
}

// slabs: [{ name, path, bufmax }], postfilters: { path, bufmax } or null
export async function peakAudio({ sources, slabs, postfilters = null }) {
  let E = null, err = null;
  for (const base of sources) {
    try {
      const pm = await WebAssembly.compile(await (await bytes(base + 'peak.wasm')).buffer);
      const [t, finds, pf] = await Promise.all([wasm(base + 'tnefar.wasm', true),
        Promise.all(slabs.map(s => openSlab(pm, base + s.path, s.bufmax))),
        postfilters ? openSlab(pm, base + postfilters.path, postfilters.bufmax) : null]);
      t._initialize?.();
      E = { base, t, finds, pf }; break;
    } catch (e) { err = e; }
  }
  if (!E) throw err || new Error('no source');
  const { t } = E;
  const toW = b => { const p = t.malloc(b.length); new Uint8Array(t.memory.buffer, p, b.length).set(b); return p; };
  // every recording of a word, over all slabs: [speaker ('slab:N'), slab index, voice N, bytes]
  function recs(word) {
    const out = [];
    E.finds.forEach((find, i) => { for (const [d, b] of find(word)) if (/tnefar/i.test(d.at(-1) || '')) { const n = d.length > 1 ? d[0] : ''; out.push([slabs[i].name + ':' + n, i, n, b]); } });
    return out;
  }
  const voices = {};
  function voice(i, n) {
    const key = i + ':' + n; if (key in voices) return voices[key];
    const r = E.finds[i]('tnefar' + n)[0]; if (!r) return voices[key] = null;
    const v = r[1], end = 4 + new DataView(v.buffer, v.byteOffset).getUint32(0, true);
    let full = v.subarray(0, end);
    if (v.length > end + 4 && dec.decode(v.subarray(end, end + 3)) === 'NXF') full = v; // its postfilter in the file
    else if (v.length > end && E.pf) { // its postfilter by name, in the postfilters slab
      const p = E.pf(dec.decode(v.subarray(end)).trim())[0]?.[1];
      if (p) { full = new Uint8Array(end + p.length); full.set(v.subarray(0, end)); full.set(p, end); }
    }
    return voices[key] = [toW(full), full.length];
  }
  const made = new Map();
  function decode([, i, n, b]) {
    const key = i + ':' + n + ':' + b.join(',');
    if (made.has(key)) return made.get(key);
    const v = voice(i, n); if (!v) return null;
    const p = toW(b), h = t.tnefar_open(p, b.length, v[0], v[1]); t.free(p);
    if (h < 0) return null;
    const parts = []; let k;
    try { while ((k = t.tnefar_run(h, 16)) > 0) parts.push(new Float32Array(t.memory.buffer, t.tnefar_pcm(h), k).slice()); }
    finally { t.tnefar_close(h); }
    const all = new Float32Array(parts.reduce((a, q) => a + q.length, 0)); parts.reduce((o, q) => (all.set(q, o), o + q.length), 0);
    for (let i2 = 0, m = Math.min(320, all.length); i2 < m; i2++) { all[i2] *= i2 / m; all[all.length - 1 - i2] *= i2 / m; }
    made.set(key, all); return all;
  }
  // the recordings to say a word: its own, or two recorded parts (a compound)
  function plan(word, prefer) {
    const pick = rs => rs.find(r => r[0] === prefer) || rs[0];
    const own = recs(word); if (own.length) return [pick(own)];
    for (let i = word.length - 1; i > 0; i--) {
      const a = recs(word.slice(0, i)); if (!a.length) continue;
      const b = recs(word.slice(i)); if (!b.length) continue;
      const pa = pick(a), pb = b.find(r => r[0] === pa[0]) || pick(b); return [pa, pb];
    }
    return null;
  }
  // the speakers (slab:N) whose voices load
  const speakers = [];
  slabs.forEach((s, i) => { for (const n of ['', '1', '2', '3', '4', '5', '6']) if (E.finds[i]('tnefar' + n).length) speakers.push(s.name + ':' + n); });
  return {
    source: E.base, speakers,
    // who recorded a word themselves
    who: w => [...new Set(recs(w).map(r => r[0]))],
    has: w => !!plan(w, ''),
    // samples (16 kHz) for a word, in the preferred speaker's voice when they recorded it
    samples(word, prefer = '') {
      const p = plan(word, prefer); if (!p) return null;
      const pcs = p.map(decode).filter(Boolean); if (!pcs.length) return null;
      const gap = 800, all = new Float32Array(pcs.reduce((a, q) => a + q.length, 0) + gap * (pcs.length - 1));
      let o = 0; for (const q of pcs) { all.set(q, o); o += q.length + gap; }
      return all;
    },
  };
}
