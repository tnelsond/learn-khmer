// Lists words (from a text file) that have no recording in any slab: node tools/leap_missing_audio.mjs words.txt
import fs from 'fs';
const root = '/home/claude/learn-khmer/village/';
globalThis.fetch = async u => { if (/^https?:/.test(u)) throw new Error('offline'); const b = fs.readFileSync(u); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const { peakAudio } = await import(root + 'peakaudio.js');
const p = await peakAudio({ sources: [root], slabs: [['kheng', 'km-kheng'], ['rith', 'km-audio2-tnefar'], ['khsv', 'km-khsv-words']].map(([n, f]) => ({ name: n, path: 'khmer/aux/' + f + '.slab', bufmax: 1 << 20 })), postfilters: { path: 'khmer/aux/km-postfilters.slab', bufmax: 1 << 20 } });
const ws = fs.readFileSync(process.argv[2], 'utf8').split(/\s+/).filter(w => /[ក-្]/.test(w));
const miss = [...new Set(ws)].filter(w => !p.who(w).length);
console.log('MISSING:', miss.join(' '));
