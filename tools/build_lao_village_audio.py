"""Build audio-lo.js for the Village of Words (Lao) from peakslab_sources/lao.
Word audio: thesaurus.la recordings (tnefar) decoded with peakslab's tnefar decoder.
Words without their own recording are cut out of a two-part compound that contains them
(e.g. ໄປ from ຂາໄປ), or spliced from parts. Pronunciation: lo-ipa.tsv (Vientiane)."""
import os, re, sys, json, base64, subprocess, wave, struct, math
LAO = os.environ.get('PEAKSLAB_LAO', '../peakslab_sources/lao')
DEC = os.environ.get('TNEFAR', 'tnefar_cli')
GAME = sys.argv[1] if len(sys.argv) > 1 else 'village'
A = LAO + '/aux/lo-audio-tnefar'; VOICE = A + '/tnefar.voice'
TMP = '/tmp/laoaud'; os.makedirs(TMP, exist_ok=True)

def norm(s):
    s = re.sub('ໍ([່-໋])າ', r'\1ຳ', s)
    return s.replace('ໍາ', 'ຳ').replace('ຫນ', 'ໜ').replace('ຫມ', 'ໝ').replace('ຫລ', 'ຫຼ')
files = {}
for f in sorted(os.listdir(A)):
    if f.endswith('.tnefar'): files.setdefault(norm(re.sub(r' \(\d+\)$', '', f[:-7])), f)
def load(p):
    d = {}
    for l in open(p, encoding='utf8'):
        if l.startswith('#'): continue
        x = l.rstrip('\n').split('\t')
        if len(x) > 1: d.setdefault(norm(x[0]), x[1])
    return d
ipa = load(LAO + '/dict/phonetics/lo-ipa.tsv')

_pcm = {}
def pcm(key):
    if key in _pcm: return _pcm[key]
    out = f'{TMP}/{len(_pcm)}.wav'
    subprocess.run([DEC, VOICE, A + '/' + files[key], out], check=True, stderr=subprocess.DEVNULL)
    w = wave.open(out); n = w.getnframes(); s = list(struct.unpack('<%dh' % n, w.readframes(n)))
    _pcm[key] = s; return s
def frames(s, hop=160):
    return [math.sqrt(sum(x * x for x in s[i:i + hop]) / hop) for i in range(0, len(s) - hop, hop)]
def trim(s, thr=.04):
    if not s: return s
    e = frames(s); m = max(e) or 1; on = [i for i, v in enumerate(e) if v > m * thr]
    if not on: return s
    a, b = max(0, on[0] - 2) * 160, min(len(s), (on[-1] + 3) * 160)
    return s[a:b]
def fade(s, n=160):
    s = s[:]
    for i in range(min(n, len(s))): s[i] = int(s[i] * i / n); s[-1 - i] = int(s[-1 - i] * i / n)
    return s
STOP = set('ກດບ'); NASAL = set('ງນມຍວ')
_dur = {}
def dur(key):
    if key not in _dur: _dur[key] = len(trim(pcm(key))) / 16000
    return _dur[key]
def split_known(x, maxn=3):
    """x as a sequence of recorded words (fewest pieces), or None"""
    if not x: return []
    best = None
    for i in range(len(x), 0, -1):
        a = x[:i]
        if a in files:
            rest = split_known(x[i:], maxn - 1) if maxn > 1 else (None if x[i:] else [])
            if rest is not None and (best is None or 1 + len(rest) < len(best)): best = [a] + rest
    return best
def valley(e, t, win):
    """deepest dip (by prominence) within +-win frames of t"""
    lo, hi = max(2, t - win), min(len(e) - 3, t + win)
    if hi <= lo: return t
    def prom(i): return min(max(e[max(0, i - 6):i]), max(e[i + 1:i + 7])) - e[i]
    k = max(range(lo, hi + 1), key=prom)
    return k if prom(k) > 0 else t
def extract(w):
    """cut w out of a recording P+w+Q where P and Q are made of recorded words"""
    cands = []
    for key in files:
        if len(key) <= len(w): continue
        k2 = key.replace(' ', '')
        i = k2.find(w)
        while i >= 0:
            P, Q = k2[:i], k2[i + len(w):]
            ps, qs = split_known(P), split_known(Q)
            if ps is not None and qs is not None and len(ps) + len(qs) <= 4:
                edge = 0 if not P else (0 if P[-1] in STOP else 1 if P[-1] in NASAL else 2)
                cands.append((2 * (len(ps) + len(qs)) + (2 if P and Q else 0) + edge + len(k2) / 20, key, ps, qs))
            i = k2.find(w, i + 1)
    for _, key, ps, qs in sorted(cands)[:6]:
        s = trim(pcm(key)); e = frames(s); n = len(e)
        a = 0; b = len(s)
        if ps:
            t = int(sum(dur(p) for p in ps) * .82 * 100); a = valley(e, min(max(t, 3), n - 4), 9) * 160
        if qs:
            t = n - int(sum(dur(q) for q in qs) * .82 * 100); b = (valley(e, min(max(t, 3), n - 4), 9) + 1) * 160
        if b - a < 16000 * .15: continue
        part = trim(s[a:b])
        if len(part) > 16000 * .15: return fade(part), f'cut from {key}'
    return None

def get(w, depth=0):
    if w in files: return fade(trim(pcm(w))), 'recorded'
    r = extract(w)
    if r: return r
    if depth < 2:
        for i in range(len(w) - 1, 0, -1):
            a, b = w[:i], w[i:]
            if b[0] in 'ະັາຳິີຶືຸູົຼ່້໊໋ໍ': continue
            if a[-1] in 'ເແໂໃໄ': continue
            ra, rb = get(a, depth + 1), get(b, depth + 1)
            if ra and rb: return ra[0] + [0] * 800 + rb[0], f'spliced {a}+{b}'
    return None

src = open(GAME + '/content-lo.js', encoding='utf8').read()
words = sorted(set(re.findall('[຀-໿]+', src)) - set(re.findall('[໐-໙]+', src)))
words = [w for w in words if not re.fullmatch('[໐-໙]+', w)]
aud, rom, how, miss = {}, {}, {}, []
for w in words:
    W = norm(w)
    if W in ipa: rom[w] = ipa[W]
    r = get(W)
    if not r: miss.append(w); continue
    s, h = r; how[w] = h
    raw = f'{TMP}/o.raw'; open(raw, 'wb').write(struct.pack('<%dh' % len(s), *s))
    mp3 = f'{TMP}/o.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', '16000', '-ac', '1', '-i', raw, '-af', 'loudnorm=I=-18:TP=-2', '-ar', '22050', '-b:a', '32k', mp3], check=True)
    aud[w] = base64.b64encode(open(mp3, 'rb').read()).decode()
for w in words:
    if w not in rom:
        parts = [p for p in re.findall('.{1,6}', w)]
        for i in range(1, len(w)):
            if norm(w[:i]) in ipa and norm(w[i:]) in ipa: rom[w] = ipa[norm(w[:i])] + ' ' + ipa[norm(w[i:])]; break
open(GAME + '/audio-lo.js', 'w', encoding='utf8').write('export const AUDIO=' + json.dumps(aud, ensure_ascii=False) + ';\nexport const ROM=' + json.dumps(rom, ensure_ascii=False) + ';\n')
json.dump(how, open(GAME + '/audio-sources.json', 'w', encoding='utf8'), ensure_ascii=False, indent=0)
c = {}
for v in how.values(): k = v.split(' ')[0]; c[k] = c.get(k, 0) + 1
print(len(words), 'words |', c, '| missing', len(miss), ':', ' '.join(miss))
print('no romanization:', ' '.join(w for w in words if w not in rom))
