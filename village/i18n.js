// Village of Words: the languages you can learn, chosen on the title screen.
// LANGS: everything the engine needs per language (script, keyboard, numbers, money, voices, audio).
// TR: the game's own Khmer text (in game.js, wrapped in L(...)) in the other languages —
//   whole lines first (exact), then patterns, then word by word. content*.js and audio*.js hold each
//   language's world: words, glosses, dialogue, pronunciations.

const KM_ONES = ['', 'មួយ', 'ពីរ', 'បី', 'បួន', 'ប្រាំ', 'ប្រាំមួយ', 'ប្រាំពីរ', 'ប្រាំបី', 'ប្រាំបួន'];
const LO_ONES = ['', 'ໜຶ່ງ', 'ສອງ', 'ສາມ', 'ສີ່', 'ຫ້າ', 'ຫົກ', 'ເຈັດ', 'ແປດ', 'ເກົ້າ'];

export const LANGS = {
  km: {
    name: 'ខ្មែរ', en: 'Khmer', title: 'ភូមិពាក្យ', speak: 'និយាយ', save: 'vow-save-2',
    content: './content.js', audio: './audio.js',
    font: '"Battambang","Noto Sans Khmer","Khmer OS",serif', canvasFont: 'Battambang, "Noto Sans Khmer", serif', probe: ['40px Battambang', 'ក'],
    tts: /^km/i, digits: '០១២៣៤៥៦៧៨៩', money: 1, cur: '៛', curName: 'riel',
    notes: [100, 500, 1000, 2000, 5000, 10000],
    numWords(n) {
      const O = KM_ONES, out = []; const tm = Math.floor(n / 10000); n %= 10000; const th = Math.floor(n / 1000); n %= 1000; const h = Math.floor(n / 100); n %= 100;
      if (tm) out.push(tm === 1 ? 'មួយ' : O[tm], 'ម៉ឺន'); if (th) out.push(O[th], 'ពាន់'); if (h) out.push(O[h], 'រយ'); if (n) out.push(n === 10 ? 'ដប់' : O[n]);
      return out.join(' ');
    },
    norm: s => s.normalize('NFC').replace(/[​‌‍\s]/g, '').replace(/្ត/g, '្ដ'),
    keys: {
      cons: 'ក ខ គ ឃ ង ច ឆ ជ ឈ ញ ដ ឋ ឌ ឍ ណ ត ថ ទ ធ ន ប ផ ព ភ ម យ រ ល វ ស ហ ឡ អ'.split(' '),
      vows: 'ា ិ ី ឹ ឺ ុ ូ ួ ើ ឿ ៀ េ ែ ៃ ោ ៅ ំ ះ ់ ៉ ៊ ័ ៌ ឥ ឪ ឲ ឫ'.split(' '),
      sub: '្', consLabel: 'ក consonants', vowLabel: '◌ា vowels',
      isDep: c => c >= 'ា' && c <= '៓', inRange: c => c >= 'ក' && c <= '៿',
    },
    rom: { 'អ៊ំស្រី': 'ʊm.srəj' },
    place: 'a Cambodian village', intro: 'You wake beneath a stilt house in a Cambodian village. You don’t know how you got here. In your hand is a stone carved with letters you can’t yet read.',
    peak: {
      sources: ['https://peakslab.org/', './'],
      slabs: [
        { name: 'kheng', path: 'khmer/aux/km-kheng.slab', bufmax: 1 << 20 },
        { name: 'rith', path: 'khmer/aux/km-audio2-tnefar.slab', bufmax: 1 << 20 },
        { name: 'khsv', path: 'khmer/aux/km-khsv-words.slab', bufmax: 1 << 20 },
      ],
      postfilters: { path: 'khmer/aux/km-postfilters.slab', bufmax: 1 << 20 },
    },
    speakers: { 'kheng:': 'kheng.info', 'kheng:1': 'kheng.info', 'rith:': 'Khmer audio (rith)', 'khsv:1': 'Bible reader 1', 'khsv:2': 'Bible reader 2', 'khsv:3': 'Bible reader 3', 'khsv:4': 'Bible reader 4' },
    // each character: [preferred speaker (index into the loaded speakers, wrapping), pitch]
    voice: {
      yay: [0, .94], kru: [1, 1], aunt: [2, 1.02], tuot: [3, .88], sok: [4, 1.08], kid: [5, 1.18], vendor: [2, 1.04],
      ta: [1, .9], fisher: [3, .97], monk: [4, .86], jang: [5, 1.02], gas: [0, 1.06], che: [2, 1.06], hia: [3, 1.04],
      ee: [4, .96], chief: [5, .94], farmer: [0, .98], thief: [3, 1.08], tacha: [1, .9],
      yak: [3, .62], spirit: [2, 1.12], ranger: [1, 1.0], hermit: [5, .9], boss: [3, .7],
    },
    enRep: [],
  },
  lo: {
    name: 'ລາວ', en: 'Lao', title: 'ບ້ານແຫ່ງຄຳສັບ', speak: 'ເວົ້າ', save: 'vow-lao-1',
    content: './content-lo.js', audio: './audio-lo.js',
    font: '"Noto Sans Lao","Phetsarath OT","Saysettha OT",sans-serif', canvasFont: '"Noto Sans Lao", "Phetsarath OT", sans-serif', probe: ['40px "Noto Sans Lao"', 'ກ'],
    tts: /^lo/i, digits: '໐໑໒໓໔໕໖໗໘໙', money: 10, cur: '₭', curName: 'kip',
    notes: [100, 200, 500, 1000, 2000, 5000, 10000],
    numWords(n) {
      const out = [], U = [[100000, 'ແສນ'], [10000, 'ໝື່ນ'], [1000, 'ພັນ'], [100, 'ຮ້ອຍ']];
      for (const [v, w] of U) { const k = Math.floor(n / v); n %= v; if (k) out.push(LO_ONES[k], w); }
      if (n) out.push(n === 10 ? 'ສິບ' : LO_ONES[n]);
      return out.join(' ');
    },
    // typed Lao: ໍາ -> ຳ, ຫນ ຫມ ຫລ -> ໜ ໝ ຫຼ
    norm: s => s.normalize('NFC').replace(/[​‌‍\s]/g, '').replace(/ໍ([່-໋])າ/g, '$1ຳ').replace(/ໍາ/g, 'ຳ').replace(/ຫນ/g, 'ໜ').replace(/ຫມ/g, 'ໝ').replace(/ຫລ/g, 'ຫຼ'),
    keys: {
      cons: 'ກ ຂ ຄ ງ ຈ ສ ຊ ຍ ດ ຕ ຖ ທ ນ ບ ປ ຜ ຝ ພ ຟ ມ ຢ ຣ ລ ວ ຫ ອ ຮ ໜ ໝ'.split(' '),
      vows: 'ະ ັ າ ຳ ິ ີ ຶ ື ຸ ູ ົ ຽ ເ ແ ໂ ໃ ໄ ໍ ່ ້ ໊ ໋ ໆ'.split(' '),
      sub: 'ຼ', consLabel: 'ກ consonants', vowLabel: '◌ະ vowels',
      isDep: c => /[ັຳ-ຼ່-ໍ]/.test(c), inRange: c => c >= '຀' && c <= '໿',
    },
    rom: {},
    place: 'a Lao village on the Mekong', intro: 'You wake beneath a stilt house in a Lao village on the Mekong. You don’t know how you got here. In your hand is a stone carved with letters you can’t yet read.',
    peak: {
      sources: ['https://peakslab.org/', './'],
      slabs: [{ name: 'lao', path: 'lao/aux/lo-audio-tnefar.slab', bufmax: 1 << 20 }],
      postfilters: null,
    },
    speakers: { 'lao:': 'thesaurus.la', 'lao:1': 'Lao Bible reader 1', 'lao:2': 'Lao Bible reader 2' },
    voice: {
      yay: [0, .94], kru: [1, 1], aunt: [2, 1.02], tuot: [0, .88], sok: [2, 1.1], kid: [0, 1.18], vendor: [2, 1.04],
      ta: [1, .9], fisher: [2, .97], monk: [1, .86], jang: [2, 1.03], gas: [0, 1.06], che: [2, 1.07], hia: [1, 1.05], ee: [0, .96],
      chief: [1, .94], farmer: [2, 1], thief: [1, 1.08], tacha: [2, .9],
      yak: [1, .62], spirit: [0, 1.12], ranger: [1, 1.0], hermit: [2, .9], boss: [1, .7],
    },
    // the English text names Khmer people and things; in Laos they are these
    enRep: [['Khmer', 'Lao'], [' riel', ' kip'], ['Cambodian', 'Lao'], ['Ta’s', 'Grandpa’s'], ['Hia’s lanterns', 'The shop lanterns'],
      ['Hia wants', 'Noy’s brother wants'], ['Tell Hia', 'Tell Noy’s brother'], ['Flowers for Ee', 'Flowers for Auntie'], ['Ee wants', 'Auntie wants'],
      ['Ee claps', 'Auntie claps'], ['Che’s', 'Noy’s']],
  },
};

export const TR = {
  lo: {
    lines: {
      'លុយ មិន គ្រប់ ទេ ។': 'ເງິນ ບໍ່ ພໍ .',
      'ម៉ូតូ ? អត់ ម៉ូតូ ទេ ?': 'ລົດຈັກ ? ບໍ່ ມີ ລົດຈັກ ບໍ ?',
      'បាល់ ! អរគុណ បង !': 'ໝາກບານ ! ຂອບໃຈ ຫຼາຍ !',
    },
    patterns: [
      [/^ខ្ញុំ ចង់ បាល់ ពណ៌ (.*)$/, 'ຂ້ອຍ ຢາກ ໄດ້ ໝາກບານ ສີ $1'],
      [/^ជួយ ខ្ញុំ កាត់ ស្រូវ (.*) បាច់ ។$/, 'ຊ່ວຍ ຂ້ອຍ ຕັດ ເຂົ້າ $1 ມັດ ແດ່ .'],
    ],
    words: {
      'កង់': 'ລໍ້', 'កាត់': 'ຕັດ', 'ក្រហម': 'ແດງ', 'ក្រុង': 'ເມືອງ', 'ខៀវ': 'ຟ້າ', 'ខ្ញុំ': 'ຂ້ອຍ', 'ខ្មៅ': 'ດຳ',
      'គ្រប់': 'ພໍ', 'គ្រួសារ': 'ຄອບຄົວ', 'ចង់': 'ຢາກ', 'ចាក់': 'ເຕີມ', 'ចុះ': 'ລົງ', 'ចេក': 'ກ້ວຍ', 'ចោរ': 'ໂຈນ',
      'ជាង': 'ຊ່າງ', 'ជីដូន': 'ຢາຍ', 'ជួយ': 'ຊ່ວຍ', 'ជួស': 'ແປງ', 'ជួសជុល': 'ແປງ', 'ឈប់': 'ເຊົາ', 'ឈរ': 'ຢືນ',
      'ដប': 'ຂວດ', 'ដប់': 'ສິບ', 'ដូង': 'ໝາກພ້າວ', 'ដើរ': 'ຍ່າງ', 'ដេក': 'ນອນ', 'ត្រី': 'ປາ', 'ត្រីឆ្លាត': 'ປາແມ່ນ້ຳ',
      'ថ្ងៃ': 'ກາງເວັນ', 'ទន្លេ': 'ທ່າເຮືອ', 'ទឹក': 'ນ້ຳ', 'ទៅ': 'ໄປ', 'ធុង': 'ຖັງ', 'នំ': 'ເຂົ້າໜົມ',
      'បាច់': 'ມັດ', 'បាយ': 'ເຂົ້າ', 'បាល់': 'ໝາກບານ', 'បែក': 'ແຕກ', 'បៃតង': 'ຂຽວ', 'ផ្កា': 'ດອກໄມ້', 'ផ្កាឈូក': 'ບົວ',
      'ផ្ទះ': 'ເຮືອນ', 'ផ្សារ': 'ຕະຫຼາດ', 'ពងមាន់': 'ໄຂ່', 'ពណ៌': 'ສີ', 'ពេញ': 'ເຕັມ', 'ភូមិស្វាយ': 'ບ້ານມ່ວງ', 'ភ្លើង': 'ໄຟ',
      'មក': 'ມາ', 'មួយ': 'ໜຶ່ງ', 'ម៉ូតូ': 'ລົດຈັກ', 'យប់': 'ກາງຄືນ', 'រៀល': 'ກີບ', 'លុយ': 'ເງິນ', 'លឿង': 'ເຫຼືອງ',
      'ល្អ': 'ດີ', 'វត្ត': 'ວັດ', 'ស': 'ຂາວ', 'សាលា': 'ໂຮງຮຽນ', 'សាំង': 'ນ້ຳມັນ', 'សុខ': 'ດາວ', 'សៀវភៅ': 'ປຶ້ມ',
      'ស្រុក': 'ບ້ານເກີດ', 'ស្រូវ': 'ເຂົ້າ', 'ស្រែ': 'ນາ', 'ស្វា': 'ລິງ', 'ស្វាយ': 'ມ່ວງ', 'ហើយ': 'ແລ້ວ', 'ឡើង': 'ຂຶ້ນ',
      'អង្គុយ': 'ນັ່ງ', 'អរគុណ': 'ຂອບໃຈ', 'អស់': 'ໝົດ', 'អាប់': 'ທອນ',
      '។': '.', '៛': '₭',
    },
  },
};

// L(text): the chosen language's version of a line of the game's Khmer
export function makeL(lang) {
  const T = TR[lang]; if (!T) return s => s;
  const DIG = LANGS[lang].digits;
  return function L(s) {
    if (s == null) return s; s = String(s);
    if (T.lines[s]) return T.lines[s];
    for (const [re, to] of T.patterns) if (re.test(s)) { s = s.replace(re, to); break; }
    return s.replace(/[ក-៿]+/g, w => {
      if (T.words[w]) return T.words[w];
      if (/^[០-៩]+$/.test(w)) return [...w].map(d => DIG[d.charCodeAt(0) - 0x17e0]).join('');
      return w;
    });
  };
}
export function pickLang() {
  let l = null;
  try { l = new URLSearchParams(location.search).get('lang'); } catch (e) { }
  try { l = l || localStorage.getItem('vow-lang'); } catch (e) { }
  return LANGS[l] ? l : 'km';
}
