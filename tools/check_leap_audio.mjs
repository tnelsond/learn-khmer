// Finds word recordings that hold more than the word (clips cut from Bible readings sometimes catch the
// word twice or a neighbour): a one-syllable word whose loudness dips and then comes back up.
// Writes leap/badrec.js; the game then uses another reader's recording of that word.
// Run from the repo root: node tools/check_leap_audio.mjs
import fs from 'fs';
const root = new URL('../village/', import.meta.url).pathname;
globalThis.fetch = async u => { if (/^https?:/.test(u)) throw new Error('offline'); const b = fs.readFileSync(u); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const { peakAudio } = await import(root + 'peakaudio.js');
const p = await peakAudio({ sources: [root], slabs: [['kheng', 'km-kheng'], ['rith', 'km-audio2-tnefar'], ['khsv', 'km-khsv-words']].map(([n, f]) => ({ name: n, path: 'khmer/aux/' + f + '.slab', bufmax: 1 << 20 })), postfilters: { path: 'khmer/aux/km-postfilters.slab', bufmax: 1 << 20 } });
const { IPA } = await import(new URL('../leap/ipa.js', import.meta.url).href);
const src = fs.readFileSync(new URL('../leap/game.js', import.meta.url), 'utf8');
const words = [...new Set(src.match(/[ក-្]{2,}/g))];
function envelope(s) { const f = 320, e = []; for (let i = 0; i + f < s.length; i += f) { let v = 0; for (let j = 0; j < f; j++) v += s[i + j] ** 2; e.push(10 * Math.log10(v / f + 1e-9)); } return e; }
function twoNuclei(e, dip, back) { const M = Math.max(...e); let i = e.findIndex(v => v > M - 6); if (i < 0) return false; let low = Infinity; for (i++; i < e.length; i++) { low = Math.min(low, e[i]); if (low < M - dip && e[i] > M - back) return true; } return false; }
const bad = {};
for (const w of words) {
  const syl = (IPA[w] || '').split(/[.\s]/).filter(Boolean).length || 1;
  for (const sp of p.who(w)) {
    const e = envelope(p.samples(w, sp));
    const isBad = syl === 1 ? twoNuclei(e, 9, 4) : twoNuclei(e, 30, 3); // multi-syllable words dip naturally; only catch near-silence gaps
    if (isBad) (bad[w] ||= []).push(sp);
  }
}
fs.writeFileSync(new URL('../leap/badrec.js', import.meta.url), '// Recordings that hold more than their word (tools/check_leap_audio.mjs); the game avoids them.\nexport const BAD=' + JSON.stringify(bad) + ';\n');
for (const [w, v] of Object.entries(bad)) console.log(w, v.join(' '));
console.log(Object.keys(bad).length, 'words with doubtful recordings;', Object.entries(bad).filter(([w, v]) => v.length >= p.who(w).length).map(([w]) => w).join(' ') || 'none', 'have no clean one');
