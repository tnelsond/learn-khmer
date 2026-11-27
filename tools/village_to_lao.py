"""Make the Lao Village of Words (lao-village/) from the Khmer one (village/).
usage: python3 village_to_lao.py village/ lao-village/
Copies the engine with Lao script, keyboard, numbers, kip and fonts; content.js and audio.js
in lao-village/ are Lao-specific and are not touched. Fails loudly if Khmer text is left over."""
import re, sys, os, shutil
SRC, DST = sys.argv[1], sys.argv[2]
g = open(os.path.join(SRC, 'game.js'), encoding='utf8').read()

def rep(old, new, count=1):
    global g
    n = g.count(old)
    if n != count: raise SystemExit(f'expected {count} of {old[:70]!r}, found {n}')
    g = g.replace(old, new)
def block(start, end, new):
    global g
    a = g.index(start); b = g.index(end, a); g = g[:a] + new + g[b:]

# ---- identity, fonts, saves
rep("const SAVE = 'vow-save-2';", "const SAVE = 'vow-lao-1';")
rep("try { await Promise.race([document.fonts.load('40px Battambang', 'ក'),", "try { await Promise.race([document.fonts.load('40px \"Noto Sans Lao\"', 'ກ'),")
block("const ROM = Object.assign(", "\n", "const ROM = ROM0;")
g = g.replace('Battambang, "Noto Sans Khmer", serif', '"Noto Sans Lao", "Phetsarath OT", "Saysettha OT", sans-serif')
g = g.replace('Battambang, serif', '"Noto Sans Lao", sans-serif')

# ---- digits, number words (Lao: ໜຶ່ງ ... ແສນ)
block("const KDIG = ", "\n", "const KDIG = '໐໑໒໓໔໕໖໗໘໙';")
block("const ONES = ", "\n/* ---------------- state", """const ONES = ['', 'ໜຶ່ງ', 'ສອງ', 'ສາມ', 'ສີ່', 'ຫ້າ', 'ຫົກ', 'ເຈັດ', 'ແປດ', 'ເກົ້າ'];
function numWords(n) {
  const out = [], U = [[100000, 'ແສນ'], [10000, 'ໝື່ນ'], [1000, 'ພັນ'], [100, 'ຮ້ອຍ']];
  for (const [v, w] of U) { const k = Math.floor(n / v); n %= v; if (k) out.push(ONES[k], w); }
  if (n) out.push(n === 10 ? 'ສິບ' : ONES[n]);
  return out.join(' ');
}
""")
# ---- Lao normalisation for typed words (ໍາ -> ຳ, ຫນ ຫມ ຫລ -> ໜ ໝ ຫຼ)
block("const norm = s =>", "\n", "const norm = s => s.normalize('NFC').replace(/[\\u200b\\u200c\\u200d\\s]/g, '').replace(/\\u0ecd([\\u0ec8-\\u0ecb])\\u0eb2/g, '$1\\u0eb3').replace(/\\u0ecd\\u0eb2/g, '\\u0eb3').replace(/\\u0eab\\u0e99/g, '\\u0edc').replace(/\\u0eab\\u0ea1/g, '\\u0edd').replace(/\\u0eab\\u0ea5/g, '\\u0eab\\u0ebc');")

# ---- keyboard: Lao consonants / vowels and tone marks; the subscript key becomes ຼ
block("const CONS = ", "\n", "const CONS = 'ກ ຂ ຄ ງ ຈ ສ ຊ ຍ ດ ຕ ຖ ທ ນ ບ ປ ຜ ຝ ພ ຟ ມ ຢ ຣ ລ ວ ຫ ອ ຮ ໜ ໝ'.split(' ');")
block("const VOWS = ", "\n", "const VOWS = 'ະ ັ າ ຳ ິ ີ ຶ ື ຸ ູ ົ ຽ ເ ແ ໂ ໃ ໄ ໍ ່ ້ ໊ ໋ ໆ'.split(' ');")
block("const isDep = ", "\n", "const isDep = c => /[\\u0eb1\\u0eb3-\\u0ebc\\u0ec8-\\u0ecd]/.test(c);")
rep("nc === '\u17d2' ? ' next' : ''}\" data-c=\"\u17d2\">\u25cc\u17d2</button>", "nc === '\u0ebc' ? ' next' : ''}\" data-c=\"\u0ebc\">\u25cc\u0ebc</button>")
rep("'ក consonants' : '\u25cc\u17b6 vowels'", "'ກ consonants' : '\u25cc\u0eb0 vowels'")
rep("e.key >= '\u1780' && e.key <= '\u17ff'", "e.key >= '\u0e80' && e.key <= '\u0eff'")

rep("speechSynthesis.getVoices().find(v => /^km/i.test(v.lang))", "speechSynthesis.getVoices().find(v => /^lo/i.test(v.lang))")

# ---- word audio: the engine (PeakSlab's, peakaudio.js) is the same; lao-village/peakconfig.js says
# which slab and which voices, like content.js it is Lao-specific and not touched here
# ---- money: kip (x10), notes, litre price
for n in (5000, 3000, 2000, 1000, 4000):
    g = re.sub(rf'pay\({n}\)', f'pay({n * 10})', g)
g = re.sub(r"khNum\((\d+)\)", lambda m: f"khNum({int(m.group(1)) * 10})", g)
rep("const amt = Math.min(1000, S.money);", "const amt = Math.min(10000, S.money);")
rep("S.money >= 500)", "S.money >= 5000)")
rep("const amt = Math.min(2000, S.money);", "const amt = Math.min(20000, S.money);")
rep("const NOTES = [100, 500, 1000, 2000, 5000, 10000];", "const NOTES = [1000, 2000, 5000, 10000, 20000, 50000, 100000];")
rep("const LITRE = 4000,", "const LITRE = 40000,")
rep("Math.max(500, Math.ceil((100 - moto.fuel) / PER_LITRE * LITRE / 500) * 500)", "Math.max(5000, Math.ceil((100 - moto.fuel) / PER_LITRE * LITRE / 5000) * 5000)")

# ---- phrases whose Lao grammar differs from a word-for-word swap
rep("'លុយ មិន គ្រប់ ទេ ។'", "'ເງິນ ບໍ່ ພໍ .'")
rep("'ម៉ូតូ ? អត់ ម៉ូតូ ទេ ?'", "'ລົດຈັກ ? ບໍ່ ມີ ລົດຈັກ ບໍ ?'")
g = g.replace("`ខ្ញុំ ចង់ បាល់ ពណ៌ ${", "`ຂ້ອຍ ຢາກ ໄດ້ ໝາກບານ ສີ ${")
rep("'បាល់ ! អរគុណ បង !'", "'ໝາກບານ ! ຂອບໃຈ ຫຼາຍ !'")
rep("`ជួយ ខ្ញុំ កាត់ ស្រូវ ${numWords(N)} បាច់ ។`", "`ຊ່ວຍ ຂ້ອຍ ຕັດ ເຂົ້າ ${numWords(N)} ມັດ ແດ່ .`")

# ---- every remaining Khmer word -> Lao
MAP = {
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
 '។': '.', '៛': '₭', '០': '໐', '៩': '໙',
}
left = set()
def sub(m):
    w = m.group(0)
    if w in MAP: return MAP[w]
    left.add(w); return w
g = re.sub('[ក-៿]+', sub, g)
if left: raise SystemExit('unmapped Khmer: ' + ' '.join(sorted(left)))

# ---- English text
for a, b in [('Khmer', 'Lao'), (' riel', ' kip'), ('Cambodian', 'Lao'), ('Ta\\u2019s', 'Grandpa\\u2019s'), ('Ta’s', 'Grandpa’s'),
             ('Hia\\u2019s lanterns', 'The shop lanterns'), ('Hia’s lanterns', 'The shop lanterns'), ('Hia wants', 'Noy\\u2019s brother wants'),
             ('Tell Hia', 'Tell Noy\\u2019s brother'), ('Flowers for Ee', 'Flowers for Auntie'), ('Ee wants', 'Auntie wants'), ('Ee claps', 'Auntie claps'),
             ('Che\\u2019s', 'Noy\\u2019s'), ('Che’s', 'Noy’s')]:
    if a: g = g.replace(a, b)

os.makedirs(DST, exist_ok=True)
open(os.path.join(DST, 'game.js'), 'w', encoding='utf8').write(g)

# ---- page
h = open(os.path.join(SRC, 'index.html'), encoding='utf8').read()
def hrep(a, b):
    global h
    if a not in h: raise SystemExit('index.html: missing ' + a[:60])
    h = h.replace(a, b)
hrep('@font-face{font-family:"Battambang";src:url(battambang.ttf) format("truetype");font-display:swap}',
     '@font-face{font-family:"Noto Sans Lao";src:url(noto-sans-lao-400.woff2) format("woff2");font-weight:400;font-display:swap}@font-face{font-family:"Noto Sans Lao";src:url(noto-sans-lao-700.woff2) format("woff2");font-weight:600 700;font-display:swap}')
hrep('--kh:"Battambang","Noto Sans Khmer","Khmer OS",serif', '--kh:"Noto Sans Lao","Phetsarath OT","Saysettha OT",sans-serif')
hrep('<title>Village of Words</title>', '<title>Village of Words: Lao</title>')
hrep('<div class="khT">ភូមិពាក្យ</div>', '<div class="khT">ບ້ານແຫ່ງຄຳສັບ</div>')
hrep("You wake beneath a stilt house in a Cambodian village.", "You wake beneath a stilt house in a Lao village on the Mekong.")
hrep('Earn riel,', 'Earn kip,')
hrep('<span class="kh">និយាយ</span>speak', '<span class="kh">ເວົ້າ</span>speak')
hrep('.n100{background:#c8b8e0}.n500{background:#e8a0a0}.n1000{background:#a8c8e8}.n2000{background:#b8d8a0}.n5000{background:#e8c890}.n10000{background:#90b8b0}',
     '.n1000{background:#c8b8e0}.n2000{background:#e8a0a0}.n5000{background:#a8c8e8}.n10000{background:#b8d8a0}.n20000{background:#e8c890}.n50000{background:#90b8b0}.n100000{background:#e0b0c8}')
hrep('.notes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr))', '.notes{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))')
hrep('@media(max-width:600px){#hearts{font-size:15px}#money{padding:0 8px;font-size:13px}.notes{grid-template-columns:repeat(3,minmax(0,1fr))}',
     '@media(max-width:600px){#hearts{font-size:15px}#money{padding:0 8px;font-size:13px}.notes{grid-template-columns:repeat(4,minmax(0,1fr))}')
h = h.replace('<html lang="en">', '<html lang="en">')
kh = set(re.findall('[ក-៿]+', h))
if kh: raise SystemExit('index.html: Khmer left: ' + ' '.join(kh))
open(os.path.join(DST, 'index.html'), 'w', encoding='utf8').write(h)
sw = open(os.path.join(SRC, 'sw.js'), encoding='utf8').read()
sw = re.sub(r"const C='[^']+'", "const C='vow-lao-1'", sw).replace("'battambang.ttf'", "'noto-sans-lao-400.woff2','noto-sans-lao-700.woff2'")
sw = re.sub(r"(,'khmer/aux/[^']+\.slab')+", ",'lao/aux/lo-audio-tnefar.slab'", sw)
open(os.path.join(DST, 'sw.js'), 'w', encoding='utf8').write(sw)
for f in ('three.module.min.js', 'icon-192.png', 'icon-512.png', 'peakaudio.js', 'peak.wasm', 'tnefar.wasm'):
    shutil.copy(os.path.join(SRC, f), os.path.join(DST, f))
print('ok: Lao engine written to', DST)
