// How much of the leap's Lao text PeakSlab's Lao slab can say: node tools/leap_lao_audio.mjs
// Each word is looked up whole, else cut into the fewest recorded pieces (as the game does).
import fs from 'fs';
const root = new URL('../village/', import.meta.url).pathname;
globalThis.fetch = async u => { if (/^https?:/.test(u)) throw new Error('offline'); const b = fs.readFileSync(u); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const { peakAudio } = await import(root + 'peakaudio.js');
const p = await peakAudio({ sources: [root], slabs: [{ name: 'lao', path: 'lao/aux/lo-audio-tnefar.slab', bufmax: 1 << 20 }], postfilters: null });
const norm = s => s.normalize('NFC').replace(/[​‌‍\s]/g, '').replace(/ໍ([່-໋])າ/g, '$1ຳ').replace(/ໍາ/g, 'ຳ').replace(/ຫນ/g, 'ໜ').replace(/ຫມ/g, 'ໝ').replace(/ຫລ/g, 'ຫຼ');
const alt = w => [w, w.replace(/\u0eab\u0ebc/g, '\u0eab\u0ea5').replace(/\u0edc/g, '\u0eab\u0e99').replace(/\u0edd/g, '\u0eab\u0ea1'), w.replace(/\u0eab\u0ebc/g, '\u0edc')];
const has = w => alt(w).some(x => p.who(x).length > 0);
const seg = (w, memo = {}) => { if (w in memo) return memo[w]; if (has(w)) return memo[w] = [w]; let best = null; for (let i = w.length - 1; i > 0; i--) { if (!has(w.slice(0, i))) continue; const r = seg(w.slice(i), memo); if (r && (!best || r.length + 1 < best.length)) best = [w.slice(0, i), ...r]; } return memo[w] = best; };
const rows = fs.readFileSync(new URL('./leap_i18n.tsv', import.meta.url), 'utf8').split('\n').map(l => l.split('\t')[3]).filter(Boolean);
const words = [...new Set(rows.flatMap(r => r.split(/\s+/)).map(w => norm(w.replace(/[^຀-໿]/g, ''))).filter(Boolean))];
const whole = words.filter(has), cut = words.filter(w => !has(w) && seg(w)), none = words.filter(w => !seg(w));
console.log(`${words.length} Lao words: ${whole.length} recorded whole, ${cut.length} from pieces, ${none.length} none`);
console.log('NONE:', none.join(' '));
