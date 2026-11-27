// Word audio through PeakSlab's own engine (github.com/tnelsond/peakslab):
// peak.wasm finds a word's recordings in a .slab, tnefar.wasm turns them into speech.
// A word can have several speakers' recordings ("word<tab>N<tab>tnefar": voice tnefarN.voice);
// play() takes the speaker the caller prefers and falls back to whoever recorded the word.
// The slab and the two .wasm files are fetched from the first source that works: peakslab.org
// (always the newest recordings, where the page may fetch from it) or the copies beside the game.
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

async function openFrom(base, slabPath, bufmax) {
  const [x, slab, t] = await Promise.all([wasm(base + 'peak.wasm'), bytes(base + slabPath), wasm(base + 'tnefar.wasm', true)]);
  t._initialize?.();
  const src = x.malloc(slab.length); new Uint8Array(x.memory.buffer).set(slab, src);
  const rc = x.load_peak(src, slab.length, 0); if (rc !== 0) throw new Error('load_peak ' + rc);
  const q0 = x.malloc(bufmax + 1024), q1 = q0 + QMAX, rptr = q1 + QMAX;
  x.peak_init(q0, QMAX, q1, QMAX, rptr, bufmax + 1024 - QMAX * 2);
  return { x, t, q0, q1, rptr, qc: q0, base };
}

export async function peakAudio({ sources, slab, bufmax }) {
  let E = null, err = null;
  for (const base of sources) { try { E = await openFrom(base, slab, bufmax); break; } catch (e) { err = e; } }
  if (!E) throw err || new Error('no source');
  const { x, t } = E;
  // every recording of a word: [voice, bytes] (voice: '' for tnefar.voice, '1' for tnefar1.voice, ...)
  const found = {};
  function recs(word) {
    if (found[word]) return found[word];
    E.qc = E.qc === E.q0 ? E.q1 : E.q0; x.switchstate();
    const out = [];
    try {
      const b = enc.encode(word + '\0'); if (b.length > QMAX) return [];
      new Uint8Array(x.memory.buffer).set(b, E.qc); x.init_search(1, 0);
      let n;
      while ((n = x.get_result(1)) > 0) {
        const m = new Uint8Array(x.memory.buffer, E.rptr, n), z = m.indexOf(0), h = dec.decode(m.subarray(0, z)).trim().split('\t');
        if (h[0] !== word) continue;
        out.push([h.length > 2 ? h[1] : '', m.slice(z + 1)]);
      }
    } finally { E.qc = E.qc === E.q0 ? E.q1 : E.q0; x.switchstate(); }
    return found[word] = out;
  }
  const toW = b => { const p = t.malloc(b.length); new Uint8Array(t.memory.buffer, p, b.length).set(b); return p; };
  const voices = {};
  function voice(n) {
    if (voices[n]) return voices[n];
    const r = recs('tnefar' + n).find(Boolean); if (!r) return null;
    const v = r[1], end = 4 + new DataView(v.buffer, v.byteOffset).getUint32(0, true);
    // the codebook, and the postfilter when the voice file carries one (NXF3); else the codebook alone
    const full = v.length > end + 4 && dec.decode(v.subarray(end, end + 3)) === 'NXF' ? v : v.subarray(0, end);
    return voices[n] = [toW(full), full.length];
  }
  const made = new Map();
  function decode(bytesIn, n) {
    const key = n + ':' + bytesIn.join(',');
    if (made.has(key)) return made.get(key);
    const v = voice(n); if (!v) return null;
    const p = toW(bytesIn), h = t.tnefar_open(p, bytesIn.length, v[0], v[1]); t.free(p);
    if (h < 0) return null;
    const parts = []; let k;
    try { while ((k = t.tnefar_run(h, 16)) > 0) parts.push(new Float32Array(t.memory.buffer, t.tnefar_pcm(h), k).slice()); }
    finally { t.tnefar_close(h); }
    const all = new Float32Array(parts.reduce((a, q) => a + q.length, 0)); parts.reduce((o, q) => (all.set(q, o), o + q.length), 0);
    for (let i = 0, m = Math.min(320, all.length); i < m; i++) { all[i] *= i / m; all[all.length - 1 - i] *= i / m; }
    made.set(key, all); return all;
  }
  // the recordings to say a word: its own, or two recorded parts (a compound)
  function plan(word, prefer) {
    const pick = rs => rs.find(r => r[0] === prefer) || rs[0];
    const own = recs(word); if (own.length) return [pick(own)];
    for (let i = word.length - 1; i > 0; i--) {
      const a = recs(word.slice(0, i)), b = recs(word.slice(i));
      if (a.length && b.length) { const pa = pick(a), pb = b.find(r => r[0] === pa[0]) || pick(b); return [pa, pb]; }
    }
    return null;
  }
  const speakers = [...new Set(['', '1', '2', '3', '4'].filter(n => recs('tnefar' + n).length))];
  return {
    source: E.base, speakers,
    has: w => !!plan(w, ''),
    // samples (16 kHz) for a word, in the preferred speaker's voice when they recorded it
    samples(word, prefer = '') {
      const p = plan(word, prefer); if (!p) return null;
      const pcs = p.map(([n, b]) => decode(b, n)).filter(Boolean); if (!pcs.length) return null;
      const gap = 800, all = new Float32Array(pcs.reduce((a, q) => a + q.length, 0) + gap * (pcs.length - 1));
      let o = 0; for (const q of pcs) { all.set(q, o); o += q.length + gap; }
      return all;
    },
  };
}
