# Makes leap/ipa.js: the G2K pronunciation (IPA) of every Khmer word in leap/game.js.
# PEAKSLAB_KHMER: path to a peakslab_sources/khmer checkout (dict/phonetics/km-g2k.tsv, dict/km-aakanee.tsv).
import re, os, json
K = os.environ.get('PEAKSLAB_KHMER', '../peakslab_sources/khmer')
src = open('leap/game.js', encoding='utf8').read()
toks = sorted(set(re.findall('[ក-្ៗៜ៝]+', src)))
def load(p):
    d = {}
    for line in open(p, encoding='utf8'):
        if line.startswith('#'): continue
        c = line.rstrip('\n').split('\t')
        if len(c) > 1: d.setdefault(c[0].replace('​', ''), c[1])
    return d
g2k = load(K + '/dict/phonetics/km-g2k.tsv'); aak = load(K + '/dict/km-aakanee.tsv')
def look(t):
    for v in (t, t.replace('្ដ', '្ត'), t.replace('្ត', '្ដ')):
        if v in g2k: return g2k[v]
    if t in aak and aak[t] and not aak[t].startswith('<'): return aak[t]
    for i in range(len(t) - 1, 0, -1):  # a compound: two known halves
        a, b = look1(t[:i]), look1(t[i:])
        if a and b: return a + '.' + b
    return None
def look1(t):
    for v in (t, t.replace('្ដ', '្ត')):
        if v in g2k: return g2k[v]
    return None
MANUAL = {'អ័ដាម': 'ʔa.daːm', 'អ័ប្រាហាំ': 'ʔap.raː.haːm', 'ឡុត': 'lot', 'បាបិល': 'baː.bəl', 'នំបុ័ង': 'nom.paŋ'}  # names G2K lacks
ipa = {t: r for t in toks if (r := MANUAL.get(t) or look(t))}
open('leap/ipa.js', 'w', encoding='utf8').write('// G2K pronunciations, made by tools/build_leap_ipa.py\nexport const IPA=' + json.dumps(ipa, ensure_ascii=False) + ';\n')
print(len(toks), 'tokens', len(ipa), 'with IPA; missing:', ' '.join(t for t in toks if t not in ipa))
