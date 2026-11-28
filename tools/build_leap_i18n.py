# Makes leap/i18n.js: every Khmer line of leap/game.js (and the title screen) with its Lao, Spanish and English
# versions from tools/leap_i18n.tsv (km<TAB>en<TAB>es<TAB>lo). Lines with no translation stay Khmer in game.
# Run from the repo root: python3 tools/build_leap_i18n.py [--list FILE]  (--list writes the untranslated lines, numbered)
import re, json, sys
src = open('leap/game.js', encoding='utf8').read()
html = open('leap/index.html', encoding='utf8').read()
KH = re.compile('[ក-៹]')
keys = []
def add(k):
    k = k.strip()
    if k and KH.search(k) and k not in seen: seen.add(k); keys.append(k)
seen = set()
for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'", src):
    t = m.group(1)
    if not KH.search(t) or t.startswith('<'): continue
    parts = t.split(' ')
    if len(parts) > 8 and all(len(p) <= 2 for p in parts): continue  # keyboard letter rows
    if len(t) == 1 and t != 'ស': continue  # single letters stay as they are; 'ស' is the colour white
    add(t)
for m in re.finditer(r"`([^`]*)`", src):
    t = m.group(1)
    if not KH.search(t) or '<' in t: continue
    t = re.sub(r"\s*\(\s*\$\{[^}]*\}\s*/\s*\$\{[^}]*\}\s*\)\s*$", '', t)
    t = re.sub(r"\$\{(?:khNum|NUMW|NUMWORD)[^}]*\}", '#', t)
    if '${' in t: continue
    add(t)
for m in re.finditer(r'>([^<>]*[ក-៹][^<>]*)<', html): add(m.group(1))
tr = {}
try:
    for line in open('tools/leap_i18n.tsv', encoding='utf8'):
        c = line.rstrip('\n').split('\t')
        if len(c) >= 4 and not line.startswith('#'): tr[c[0]] = c[1:4]
except FileNotFoundError: pass
LANGS = {'km': {'name': 'ខ្មែរ', 'tts': 'km'}, 'lo': {'name': 'ລາວ', 'tts': 'lo'}, 'es': {'name': 'Español', 'tts': 'es'}, 'en': {'name': 'English', 'tts': 'en'}}
out = {'en': [], 'es': [], 'lo': []}
for k in keys:
    v = tr.get(k, ['', '', ''])
    for i, l in enumerate(['en', 'es', 'lo']): out[l].append(v[i] or None)
js = ('// Every line of the game in Khmer (KM) and, index for index, in the other languages (TR); made by tools/build_leap_i18n.py from tools/leap_i18n.tsv\n'
      'export const LANGS=' + json.dumps(LANGS, ensure_ascii=False) + ';\n'
      'export const KM=' + json.dumps(keys, ensure_ascii=False) + ';\n'
      'export const TR=' + json.dumps(out, ensure_ascii=False) + ';\n')
open('leap/i18n.js', 'w', encoding='utf8').write(js)
miss = [k for k in keys if k not in tr]
print(len(keys), 'lines;', len(keys) - len(miss), 'translated;', len(miss), 'missing')
if '--list' in sys.argv:
    with open(sys.argv[sys.argv.index('--list') + 1], 'w', encoding='utf8') as f:
        for i, k in enumerate(miss): f.write(f'{i}\t{k}\n')
