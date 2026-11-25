import re,os,subprocess,json,base64,sys
K = os.environ.get('PEAKSLAB_KHMER', '../peakslab_sources/khmer')  # path to a peakslab_sources/khmer checkout
src=open('village/content.js',encoding='utf8').read()
toks=sorted(set(re.findall('[ក-្ៗៜ៝]+',src)))
def load(p,col=0):
    d={}
    for line in open(p,encoding='utf8'):
        if line.startswith('#'):continue
        p2=line.rstrip('\n').split('\t')
        if len(p2)>1: d.setdefault(p2[0].replace('​',''),p2[1])
    return d
aak=load(K+'/dict/km-aakanee.tsv'); g2k=load(K+'/dict/phonetics/km-g2k.tsv')
ipa={}
for f in os.listdir(K+'/dict/phonetics'):
    pass
rom={};aud={};miss=[]
os.makedirs('/tmp/mp3',exist_ok=True)
for t in toks:
    t2=t.replace('\u17d2\u178a','\u17d2\u178f')
    if t in g2k: rom[t]=g2k[t]
    elif t2 in g2k: rom[t]=g2k[t2]
    elif t in aak and aak[t] and not aak[t].startswith('<'): rom[t]=aak[t]
    else:
        for i in range(1,len(t)):
            if t[:i] in g2k and t[i:] in g2k: rom[t]=g2k[t[:i]]+'.'+g2k[t[i:]]; break
    w=f'{K}/aux/km-audio/{t}.webm'
    if os.path.exists(w):
        o=f'/tmp/mp3/{len(aud)}.mp3'
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',w,'-ac','1','-ar','22050','-b:a','32k',o],check=True)
        aud[t]=base64.b64encode(open(o,'rb').read()).decode()
    else:
        A=K+'/aux/km-audio/'; done=False
        for i in range(1,len(t)):
            a,b=t[:i],t[i:]
            if os.path.exists(A+a+'.webm') and os.path.exists(A+b+'.webm') and not b[0] in '\u17b6\u17b7\u17b8\u17b9\u17ba\u17bb\u17bc\u17bd\u17be\u17bf\u17c0\u17c1\u17c2\u17c3\u17c4\u17c5\u17c6\u17c7\u17c8\u17c9\u17ca\u17cb\u17d2':
                o=f'/tmp/mp3/{len(aud)}.mp3'
                subprocess.run(['ffmpeg','-y','-loglevel','error','-i',A+a+'.webm','-i',A+b+'.webm','-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1','-ac','1','-ar','22050','-b:a','32k',o],check=True)
                aud[t]=base64.b64encode(open(o,'rb').read()).decode(); done=True; print('compound',t,a,b); break
        if not done: miss.append(t)
open('village/audio.js','w',encoding='utf8').write('export const AUDIO='+json.dumps(aud,ensure_ascii=False)+';\nexport const ROM='+json.dumps(rom,ensure_ascii=False)+';\n')
print(len(toks),'tokens',len(aud),'audio','missing:',' '.join(miss)); print('norom:',' '.join(t for t in toks if t not in rom))
