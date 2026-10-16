import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit(f'expected {count} of {old[:70]!r}, found {n}')
    s = s.replace(old, new)

def block(start, end, new):
    """replace text from start marker (inclusive) to end marker (exclusive)"""
    global s
    a = s.index(start); b = s.index(end, a)
    assert s.count(start) == 1, start
    s = s[:a] + new + s[b:]

# ---- embedded Khmer recordings out; Lao falls back to the device's Lao voice
lines = s.split('\n')
i = next(k for k, l in enumerate(lines) if l.startswith('const AUD='))
lines[i] = 'const AUD={}; // no recordings yet: speech uses a Lao (lo) voice if the device has one'
s = '\n'.join(lines)

# ---- page, fonts
rep('<title>Khmer Letter Critters</title>', '<title>Lao Letter Critters</title>')
rep('aria-label="Khmer Letter Critters puzzle game"', 'aria-label="Lao Letter Critters puzzle game"')
rep('family=Fredoka:wght@500;700&family=Noto+Sans+Khmer:wght@500;700&family=Moul&family=Noto+Sans:wght@700',
    'family=Fredoka:wght@500;700&family=Noto+Sans+Lao+Looped:wght@500;700&family=Noto+Sans+Lao:wght@400;700&family=Noto+Sans:wght@700')
rep('''KFONT='"Noto Sans Khmer","Khmer OS","Leelawadee UI",sans-serif',''', '''KFONT='"Noto Sans Lao Looped","Phetsarath OT","Saysettha OT","Lao UI",sans-serif',''')
s = s.replace('"Noto Sans Khmer"', '"Noto Sans Lao Looped"')
rep('''const MFONT='"Moul","Noto Sans Lao Looped",serif';''', '''const MFONT='"Noto Sans Lao","Lao UI",sans-serif'; // loopless Lao, as on signs and in print''')
rep('''document.fonts.load('400 60px "Moul"','កខ');document.fonts.load('700 72px "Noto Sans Lao Looped"','កខ');''',
    '''document.fonts.load('400 60px "Noto Sans Lao"','ກຂໜ');document.fonts.load('700 72px "Noto Sans Lao Looped"','ກຂໜ');''')
rep("ɑːʰŋɲɗɓʔ", "ɔːʰŋɲɕʔɛɯ")

# ---- letters, sounds, classes, vowels and words
block('const GRID=', '// level: sc = scene', r"""// the grid: rows = where in the mouth, columns = class (mid, high, low) and the nose column
const GRID=[['ກ','ຂ','ຄ','ງ'],['ຈ','ສ','ຊ','ຍ'],['ຕ','ຖ','ທ','ນ'],['ປ','ຜ','ພ','ມ']],EXT=[['ດ','ບ','ຝ','ຟ'],['ຢ','ລ','ວ','ຣ']],VOW=[['ອ','ຫ','ຮ'],['ຫງ','ຫຍ','ໜ'],['ໝ','ຫຼ','ຫວ']];
const ROWS=GRID.concat(EXT,VOW),R=ch=>ROWS.findIndex(r=>r.includes(ch)),K=ch=>ROWS[R(ch)].indexOf(ch);
const CONS={'ກ':'k','ຂ':'kʰ','ຄ':'kʰ','ງ':'ŋ','ຈ':'tɕ','ສ':'s','ຊ':'s','ຍ':'ɲ','ຕ':'t','ຖ':'tʰ','ທ':'tʰ','ນ':'n','ປ':'p','ຜ':'pʰ','ພ':'pʰ','ມ':'m','ດ':'d','ບ':'b','ຝ':'f','ຟ':'f','ຢ':'j','ລ':'l','ວ':'w','ຣ':'r','ອ':'ʔ','ຫ':'h','ຮ':'h','ຫງ':'ŋ','ຫຍ':'ɲ','ໜ':'n','ໝ':'m','ຫຼ':'l','ຫວ':'w'};
const IPA={};Object.keys(CONS).forEach(c=>IPA[c]=CONS[c]+'ɔː');
const NAMES=IPA;
// class decides the tone: 8 mid letters, 6 high letters plus every letter with a silent ຫ in front, the rest are low
const MID=['ກ','ຈ','ດ','ຕ','ບ','ປ','ຢ','ອ'],HIGH=['ຂ','ສ','ຖ','ຜ','ຝ','ຫ'],CLS=ch=>MID.includes(ch)?0:HIGH.includes(ch)||R(ch)>=7?1:2,CLN=['mid','high','low'],UK=ch=>IPA[ch]+' · '+CLN[CLS(ch)];
const HL=ch=>R(ch)>=7,NOSE=['ງ','ຍ','ນ','ມ','ຫງ','ຫຍ','ໜ','ໝ'],PUFF=['ຂ','ຄ','ຖ','ທ','ຜ','ພ'],LIPS=['ປ','ຜ','ພ','ມ','ບ','ຝ','ຟ','ວ','ໝ','ຫວ'];
const STEPS=[
 {rows:GRID,rn:['throat','palate','teeth','lips'],cn:['mid','high','low','nose'],max:10,need:10,title:'Create your letter party',sub:'Letters you discover in Letter Lab unlock here. Pick a row and a column!',cnt:'Party',go:'Start journey'},
 {rows:EXT,rn:['pop & fan','glide & flow'],cn:['first','second','third','fourth'],max:4,need:0,title:'Recruit eight more consonants',sub:'Two new rows of four. Pick up to 4 recruits. Each letter can join only once!',cnt:'Recruits',go:'Join the party'},
 {rows:VOW,rn:['breath','silent ຫ','silent ຫ'],cn:['first','second','third'],max:4,need:0,title:'Recruit the ຫ letters',sub:'ອ ຫ ຮ, plus letters with a silent ຫ in front. Pick up to 4 recruits!',cnt:'Recruits',go:'Join the party'}];
const GX=170,GY=150,ALLG=[].concat(...GRID,...EXT,...VOW);
const cons=ch=>CONS[ch];
// vowel signs: ◌ marks where the consonant goes (some vowels are written before it)
const VOWS={'◌າ':'aː','◌ິ':'i','◌ີ':'iː','◌ຸ':'u','◌ູ':'uː','◌ື':'ɯː','ເ◌':'eː','ແ◌':'ɛː','ໂ◌':'oː','◌ໍ':'ɔː','ໄ◌':'aj','ໃ◌':'aj'};
const SP=(ch,v)=>v.replace('◌',ch),syl=(ch,v)=>cons(ch)+VOWS[v];
const WORDS=[['ມ','◌າ','to come'],['ປ','◌າ','fish'],['ຕ','◌າ','eye'],['ກ','◌າ','crow'],['ຂ','◌າ','leg'],['ນ','◌າ','rice field'],['ງ','◌າ','sesame'],['ພ','◌າ','to lead'],['ຫ','◌າ','to look for'],['ລ','◌າ','donkey'],['ຊ','◌າ','tea'],['ຢ','◌າ','medicine'],
 ['ດ','◌ີ','good'],['ປ','◌ີ','year'],['ມ','◌ີ','to have'],['ສ','◌ີ','colour'],['ຕ','◌ີ','to hit'],['ງ','◌ູ','snake'],['ປ','◌ູ','crab'],['ຄ','◌ູ','teacher'],['ຫ','◌ູ','ear'],['ຮ','◌ູ','hole'],['ມ','◌ື','hand'],
 ['ຂ','◌ໍ','to ask for'],['ພ','◌ໍ','enough'],['ຕ','ໂ◌','body'],['ປ','ໄ◌','to go'],['ກ','ໄ◌','far'],['ຟ','ໄ◌','fire'],['ຂ','ໄ◌','to open'],['ຈ','ໃ◌','heart'],['ສ','ໃ◌','clear']].map(([c,v,m])=>({w:SP(c,v),c,v,m}));
const SEQS={
 name:{key:UK,disp:k=>k,fb:ch=>'That letter says "'+UK(ch)+'".',tags:false},
 cons:{key:cons,disp:k=>k,fb:ch=>'That one starts with "'+cons(ch)+'".',tags:true},
 ipac:{key:cons,disp:k=>k,fb:ch=>'That one starts with "'+cons(ch)+'".',tags:false},
 ipa:{key:ch=>IPA[ch],disp:k=>k,fb:ch=>'That one says "'+IPA[ch]+'".',tags:false},
 muol:{key:ch=>ch,disp:k=>k,fb:ch=>'That one says "'+IPA[ch]+'". Study its shape!',tags:false},
 muol2:{key:ch=>ch,disp:k=>k,fb:ch=>'That one says "'+IPA[ch]+'". Look at the loops again!',tags:false}};
""")

block('const LV=[', '// overworld map', r"""const LV=[
{name:'Trace 1',sc:3,terr:'water',gk:[3],mode:'trace',tr:{phase:0,half:0,guide:1},intro:'Time to write! Pick a letter, then trace it with your finger or mouse. Half of your party practises today.',hint:'Follow the faint letter slowly. Start at the little loop, then follow the line.',g:['Writing helps you remember the shapes.','The other half of your party practises later!']},
 {name:'Consonants',sc:0,terr:'water',gk:[3],mode:'seq',seq:'cons',intro:'The farmer shows a consonant sound. Send every letter that STARTS with it. Letters from different classes can share a sound: ຂ and ຄ both start with kʰ!',hint:'Look at the sound tags. ຂ kʰɔː and ຄ kʰɔː share the same first sound.',g:['Letters can share a consonant sound.','ຂ (high) and ຄ (low) both start with kʰ!']},
 {name:'Sound check',sc:5,terr:'forest',gk:[9],mode:'seq',seq:'name',intro:'The monkey says a sound AND its class. Pick the letter that makes it, then pick the monkey. A wrong guess shows you that letter\'s sound and class!',hint:'Mid class: ກ ຈ ດ ຕ ບ ປ ຢ ອ. High class: ຂ ສ ຖ ຜ ຝ ຫ and every letter with a silent ຫ. The rest are low.',g:['Every Lao letter has a sound and a class.','The class decides the tone!']},
 {name:'Mid class',sc:1,terr:'water',gk:[1,4],hint:'There are only eight mid-class letters: ກ ຈ ດ ຕ ບ ປ ຢ ອ.',g:['MID class: ກ ຈ ດ ຕ ບ ປ ຢ ອ','HIGH and LOW class letters'],cat:ch=>CLS(ch)===0?0:1},
 {name:'Nose gate',sc:2,terr:'forest',gk:[7,2],hint:'Hum the sound. Which letters buzz in your nose? The elephant knows!',g:['NOSE letters: ງ ຍ ນ ມ (and ຫງ ຫຍ ໜ ໝ)','all the other letters'],cat:ch=>NOSE.includes(ch)?0:1},
{name:'Trace 2',sc:3,terr:'forest',gk:[3],mode:'trace',tr:{phase:0,half:1,guide:1},intro:'Now the rest of your party practises writing. Pick a letter and trace it.',hint:'Go slowly and cover the whole shape.',g:['Every letter in your party can now be written.','Next time you will draw from memory!']},
 {name:'Puff gate',sc:3,terr:'cliff',gk:[3,0],hint:'Hold your hand by your mouth. Which letters make a puff of air (ʰ)?',g:['PUFF letters: ຂ ຄ ຖ ທ ຜ ພ','letters with no puff'],cat:ch=>PUFF.includes(ch)?0:1},
 {name:'Three classes',sc:4,terr:'water',gk:[4,2,7],hint:'Mid: ກ ຈ ດ ຕ ບ ປ ຢ ອ. High: ຂ ສ ຖ ຜ ຝ ຫ, plus any letter with a silent ຫ. Low: all the rest.',g:['MID: ກ ຈ ດ ຕ ບ ປ ຢ ອ','HIGH: ຂ ສ ຖ ຜ ຝ ຫ + silent ຫ','LOW: all the rest'],cat:CLS},
 {name:'Lip gate',sc:5,terr:'cliff',gk:[5,8],hint:'Say them slowly. Which letters need your lips?',g:['LIP letters: ປ ຜ ພ ມ ບ ຝ ຟ ວ','all the other letters'],cat:ch=>LIPS.includes(ch)?0:1},
{name:'Draw sounds',sc:5,terr:'cliff',gk:[10],mode:'trace',tr:{phase:0,half:'all',guide:0},intro:'The dancer says a sound and its class. Draw the letter that makes it, from memory! There is nothing to trace and the chart is switched off. Afterwards you will see the real letter to compare.',hint:'Picture the letter. The class tells you which of two same-sounding letters it is.',g:['You can write a letter from its sound!','That is real reading and writing.']},
{name:'Loopless 1',sc:4,terr:'water',gk:[6],mode:'seq',seq:'muol',intro:'Signs, menus and newspapers often use LOOPLESS Lao letters: the same letters with the little loops left off. The tablet shows a loopless letter. Send the looped letter that matches it!',hint:'Look for the same bones: the same bumps, tails and turns, just without the loop.',g:['Loopless letters are used on signs and in print.','Every loopless letter matches a looped one!']},
{name:'Loopless 2',sc:3,terr:'forest',gk:[10],mode:'seq',seq:'muol2',intro:'Your critters take off their loops! The dancer shows a normal letter. Find the critter written without loops.',hint:'The shape stays the same. Only the loops are gone.',g:['Loopless letters are normal letters, simplified.','You can read both styles!']},
 {name:'Rows',sc:0,terr:'cliff',gk:[0,10,5],hint:'Now look at the rows: where in your mouth is each letter said?',g:['throat & palate rows: ກ … ຍ','teeth & lip rows: ຕ … ມ','the extra letters'],cat:ch=>R(ch)<2?0:R(ch)<4?1:2},
 {name:'Glide',sc:3,terr:'forest',gk:[1,8,2],hint:'The eight extra consonants have two rows of their own: pop & fan, and glide & flow.',g:['pop & fan: ດ ບ ຝ ຟ','glide & flow: ຢ ລ ວ ຣ','everything else'],cat:ch=>R(ch)===4?0:R(ch)===5?1:2},
 {name:'Ordered',sc:2,terr:'water',gk:[7,1,3],hint:'The guardians check in order: nose first, then puffs.',g:['NOSE letters','PUFF letters','all the rest'],cat:ch=>NOSE.includes(ch)?0:PUFF.includes(ch)?1:2},
{name:'Loopless 3',sc:1,terr:'cliff',gk:[6],mode:'seq',seq:'muol',intro:'Loopless letters, ຫ letters too! The tablet shows a loopless letter. Send the looped letter that matches it.',hint:'Look at the shape, not the sound.',g:['Loopless works for every letter.','You can read signs and menus now!']},
 {name:'Silent ຫ',sc:4,terr:'forest',gk:[10,0],hint:'A silent ຫ in front moves a low letter into the high class. ໜ and ໝ are ຫ joined to ນ and ມ.',g:['silent ຫ: ຫງ ຫຍ ໜ ໝ ຫຼ ຫວ','everything else'],cat:ch=>HL(ch)?0:1},
 {name:'Three kinds',sc:2,terr:'cliff',gk:[4,9,1],hint:'Three groups: the ຫ letters, the grid and the eight extras.',g:['ຫ letters: ອ ຫ ຮ + silent ຫ','the grid: ກ … ມ','extras: ດ ບ ຝ ຟ ຢ ລ ວ ຣ'],cat:ch=>R(ch)>=6?0:R(ch)<4?1:2},
 {name:'IPA hunt',sc:1,terr:'cliff',gk:[6],mode:'seq',seq:'ipac',intro:'The tablet shows a consonant sound. Send every letter that starts with it, whatever its class!',hint:'ʰ means a puff of air. tɕ is like ch in cheese. ɲ is like ny in canyon. ʔ is a catch in your throat.',g:['IPA writes sounds down exactly.','Different classes can share one sound!']},
 {name:'IPA tablet',sc:0,terr:'water',gk:[6],mode:'seq',seq:'ipa',intro:'The tablet shows a whole syllable. Send the letter that makes it. A wrong guess shows you how that letter sounds.',hint:'Letters from different classes can share a sound: ຂ and ຄ both say kʰɔː. Either one is right!',g:['IPA writes down the sounds of speech.','Now you can read a sound as well as a letter!']},
 {name:'Build sounds',sc:4,terr:'water',gk:[10],mode:'combine',comb:{tiles:['◌າ','◌ິ','◌ີ','◌ູ'],rounds:4},intro:'The dancer wants a syllable. Pick a consonant, then a vowel sign in the middle of the path. The consonant picks it up and walks on to the dancer. The ◌ shows where the consonant goes!',hint:'◌າ comes after the consonant, ◌ິ and ◌ີ sit on top, ◌ູ hangs below.',g:['A consonant plus a vowel sign makes a syllable.','Vowels can sit after, above or below!']},
 {name:'Build more',sc:2,terr:'forest',gk:[8],mode:'combine',comb:{tiles:['◌າ','◌ີ','◌ູ','ເ◌','ແ◌','ໂ◌'],rounds:6},intro:'New vowel signs that sit BEFORE the consonant! Build every syllable the crocodile asks for.',hint:'ເ ແ ໂ are written before the consonant, but you still say the consonant first: ເກ says keː.',g:['Some vowels are written first but said last.','You can build any sound you can read!']},
{name:'First words',sc:1,terr:'water',gk:[3],mode:'combine',comb:{tiles:['◌າ','◌ີ','◌ູ','ໄ◌'],rounds:4,word:1},intro:'Time for real words! The farmer shows what a word means and how it sounds. Build it from a consonant and a vowel sign. Only words your party can spell are chosen, and each letter can be used once.',hint:'Say the sound. Which consonant starts it, and which vowel sign makes the rest?',g:['Words are letters plus vowel signs.','You built the words your party could spell!']},
{name:'More words',sc:3,terr:'forest',gk:[1],mode:'combine',comb:{tiles:['◌າ','◌ີ','◌ູ','ໄ◌','ໃ◌','◌ໍ'],rounds:6,word:1},intro:'More words! Build each one the ferry captain asks for. Watch the spelling: ໄ and ໃ sound the same, and so do ຂ and ຄ.',hint:'Only about twenty words use ໃ, like ໃຈ (heart). Most words use ໄ.',g:['Words are letters plus vowel signs.','You built the words your party could spell!']},
{name:'Word tablet',sc:0,terr:'cliff',gk:[6],mode:'combine',comb:{tiles:['◌າ','◌ີ','◌ູ','◌ື','ໂ◌','ໃ◌'],rounds:6,hide:true,word:1},intro:'The tablet shows only the sound of a word. Read the IPA, build the word, and you will find out what it means!',hint:'Split the sound: the first symbol is the consonant, the rest is the vowel.',g:['Words are letters plus vowel signs.','You decoded every word from its sound!']}
];
""")

rep("hasVow=()=>party.some(c=>R(c.ch)>=7)", "hasVow=()=>party.some(c=>R(c.ch)>=6)")
rep("canWord=t=>WORDS.some(w=>party.some(c=>c.ch===w.w[0])&&t.includes(w.w[1]))", "canWord=t=>WORDS.some(w=>party.some(c=>c.ch===w.c)&&t.includes(w.v))")
block('const META=[', ' .map(([n,mp,ok,road])', r"""const META=[['Consonants',0],['Sound check',0],['Mid class',0],['Nose gate',0],['Puff gate',0],['Lip gate',0],['Three classes',0],['Ordered',0,0,0],['Draw sounds',0,()=>party.length>0&&party.every(c=>tc(c.ch)>=1)],
 ['Loopless 1',1],['Rows',1,hasExt,0],['IPA hunt',1],
 ['Glide',2,hasExt,0],['IPA tablet',2],['Build sounds',2],['Loopless 2',2],['Silent ຫ',2,hasVow,0],
 ['Three kinds',3,()=>hasExt()&&hasVow(),0],['Build more',3],['First words',3,()=>canWord(['◌າ','◌ີ','◌ູ','ໄ◌'])],['More words',3,()=>canWord(['◌າ','◌ີ','◌ູ','ໄ◌','ໃ◌','◌ໍ'])],['Word tablet',3,()=>canWord(['◌າ','◌ີ','◌ູ','◌ື','ໂ◌','ໃ◌'])],['Loopless 3',3]]
""")

# ---- storage keys, speech
s = s.replace("'klc-", "'llc-")
rep("find(v=>/^km/i.test(v.lang))", "find(v=>/^lo/i.test(v.lang))")

# ---- spelling levels
rep("t.disp='◌'+v", "t.disp=v")
rep("if(have.has(w.w[0])&&L.comb.tiles.includes(w.w[1]))(by[w.w[0]]=by[w.w[0]]||[]).push(w)", "if(have.has(w.c)&&L.comb.tiles.includes(w.v))(by[w.c]=by[w.c]||[]).push(w)")
rep("if(g.tgt&&r.some(x=>IPA[x.ch]===g.tgt))return;const k=r.length?IPA[pick(r).ch]:''", "if(g.tgt&&r.some(x=>UK(x.ch)===g.tgt))return;const k=r.length?UK(pick(r).ch):''")
rep("syl(w.w[0],w.w[1])", "syl(w.c,w.v)")
rep("party.filter(q=>R(q.ch)<7&&q.st!=='safe'", "party.filter(q=>q.st!=='safe'")
rep("c.show=c.ch+t.ch", "c.show=SP(c.ch,t.ch)")
rep("const spell=c.ch+t.ch", "const spell=SP(c.ch,t.ch)")
rep("got===syl(g.tgt[0],g.tgt[1])?'Same sound, different spelling!'", "got===syl(wd.c,wd.v)?'Same sounds, different spelling!'")
rep("if(R(c.ch)>=7){setNote('Vowel letters stand alone. Pick a consonant!',3);beep(200,.15);return}", "")
rep("const tg=c.tile?VOWS[c.ch][0]+' | '+VOWS[c.ch][1]:NAMES[c.ch]", "const tg=c.tile?VOWS[c.ch]:NAMES[c.ch]")

# ---- journey text
rep("Your party sets off across Cambodia!", "Your party sets off across Laos!")
rep("winMsg='Bring 3 letters of '+t.row+' on", "winMsg='Bring 3 letters of '+t.row.join(' ')+' on")
rep("tx('Journey through Cambodia'", "tx('Journey through Laos'")
rep("Your party crossed Cambodia!", "Your party crossed Laos!")
rep("'អ្នកពូកែណាស់! (Well done!)'", "'ເກັ່ງຫຼາຍ! (Well done!)'")
rep("['ខ្មែរ Critters',60,160,'#ff4d6d'],['Journey: lead a party of letters across Cambodia.'", "['ລາວ Critters',60,160,'#ff4d6d'],['Journey: lead a party of letters across Laos.'")
rep("const demo='កខគ'.split('')", "const demo=['ກ','ຂ','ຄ']")
rep("You are a true Khmer letter master!", "You are a true Lao letter master!")

# scenes (the paintings stay; the names become Lao places)
rep("{n:'Angkor Wat',k:'អង្គរវត្ត'", "{n:'Wat Phou',k:'ວັດພູ'")
rep("{n:'Mekong River',k:'ទន្លេមេគង្គ'", "{n:'Mekong River',k:'ນ້ຳຂອງ'")
rep("{n:'Rice Fields',k:'ស្រែ'", "{n:'Rice Fields',k:'ທົ່ງນາ'")
rep("{n:'Pagoda',k:'វត្ត'", "{n:'Temple',k:'ວັດ'")
rep("{n:'Night Market',k:'ផ្សារ'", "{n:'Night Market',k:'ຕະຫຼາດ'")
rep("{n:'Jungle Temple',k:'នាគ'", "{n:'Naga Temple',k:'ນາກ'")

# ---- party creation
rep("ALLG.split('').filter(c=>s.has(c))", "ALLG.filter(c=>s.has(c))")
rep("const s=new Set(['ក'])", "const s=new Set(['ກ'])")
rep("chh:nr===5?54:90", "chh:nr===4?66:90")
rep("shuffle((cs===0?unlocked().join(''):S.rows.join('')).split('')", "shuffle((cs===0?unlocked():[].concat(...S.rows))")
rep("cs||cg?44:28", "cs||cg?44:36")
rep("['The grid','Last eight','Vowel letters']", "['The grid','8 extras','ຫ letters']")

# ---- tracing from a sound: the sound plus its class names exactly one letter
rep("t=trT.find(x=>x.st!=='safe'&&x.st!=='crossed'&&IPA[x.ch]===g.tgt)", "t=trT.find(x=>x.st!=='safe'&&x.st!=='crossed'&&UK(x.ch)===g.tgt)")
rep("tg=rec?trT.filter(x=>x.st!=='safe'&&x.st!=='crossed'&&IPA[x.ch]===g.tgt)", "tg=rec?trT.filter(x=>x.st!=='safe'&&x.st!=='crossed'&&UK(x.ch)===g.tgt)")

# ---- reference chart
block('function chartHear(){', '/* ---------- Letter Lab', r"""const CTINT=['#e8f6d4','#cfe9ff','#ffd9ea'],chX=(r,k)=>r<4?170+k*72+2:610+k*72+2,chY=r=>r<4?150+r*62+2:r<6?150+(r-4)*62+2:300+(r-6)*60+2;
function chartHear(){const hit=(ch,x,y,w,h)=>{if(inR(mx,my,x,y,w,h)){speak(ch);return true}return false};
 if(chartTab==='vow'){Object.keys(VOWS).forEach((v,i)=>{const x=60+(i/6|0)*430,y=150+(i%6)*56;hit(SP('ກ',v),x+90,y,110,48)});return}
 for(let r=0;r<ROWS.length;r++)for(let k=0;k<ROWS[r].length;k++)if(hit(ROWS[r][k],chX(r,k),chY(r),68,r<6?58:56))return}
function chartClick(){chartHear();if(inR(mx,my,800,44,110,38)||!inR(mx,my,30,30,900,540)){chartOpen=false;return}if(inR(mx,my,50,44,170,38))chartTab='cons';else if(inR(mx,my,230,44,140,38))chartTab='vow';else if(inR(mx,my,380,44,150,38))chartTab='muol'}
function drawChart(){
 ctx.fillStyle='rgba(15,8,40,.82)';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#fff8e6';ctx.strokeStyle='#2b1b5e';ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(30,30,900,540,24);ctx.fill();ctx.stroke();
 btn('Consonants',50,44,170,38,true,chartTab==='cons'?'#ffe66d':'#d9d2f0');btn('Vowels',230,44,140,38,true,chartTab==='vow'?'#ffe66d':'#d9d2f0');btn('Loopless',380,44,150,38,true,chartTab==='muol'?'#ffe66d':'#d9d2f0');btn('Close',800,44,110,38,true,'#ff9aa8');
 const own=ch=>party.some(c=>c.ch===ch);
 const cell=(ch,x,y,w,h)=>{ctx.fillStyle=CTINT[CLS(ch)];ctx.strokeStyle=own(ch)?'#e0a800':'#2b1b5e';ctx.lineWidth=own(ch)?5:2;ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.fill();ctx.stroke();glyph(ch,x+w/2,y+h/2-8,chartTab==='muol'?26:28,PAL[ch.charCodeAt(0)%8],chartTab==='muol'?MFONT:undefined);dk(IPA[ch],x+w/2,y+h-10,12)};
 if(chartTab==='cons'||chartTab==='muol'){
  dk('The grid',314,112,16);dk('8 extras',754,112,16);dk('ຫ letters',718,290,15);
  STEPS[0].cn.forEach((t,k)=>dk(t,170+k*72+36,134,12));
  GRID.forEach((row,r)=>{dk(STEPS[0].rn[r],162,chY(r)+29,14,'right');row.forEach((ch,k)=>cell(ch,chX(r,k),chY(r),68,58))});
  EXT.forEach((row,r)=>{dk(STEPS[1].rn[r],602,chY(r+4)+29,13,'right');row.forEach((ch,k)=>cell(ch,chX(r+4,k),chY(r+4),68,58))});
  VOW.forEach((row,r)=>{dk(STEPS[2].rn[r],602,chY(r+6)+28,13,'right');row.forEach((ch,k)=>cell(ch,chX(r+6,k),chY(r+6),68,56))});
  if(chartTab==='muol')dk('Loopless letters, as on signs. The small text is the sound.',314,440,14);
  [['mid class',60],['high class',220],['low class',390]].forEach(([t,x],i)=>{ctx.fillStyle=CTINT[i];ctx.fillRect(x,505,28,22);ctx.strokeStyle='#2b1b5e';ctx.lineWidth=2;ctx.strokeRect(x,505,28,22);dk(t,x+38,516,15,'left')});
  ctx.strokeStyle='#e0a800';ctx.lineWidth=5;ctx.strokeRect(600,505,28,22);dk('in your party',638,516,15,'left');
 }else{
  [0,1].forEach(c=>{const x=60+c*430;dk('sign',x+40,132,13);dk('with ກ',x+145,132,13);dk('sound',x+265,132,13)});
  Object.keys(VOWS).forEach((v,i)=>{const x=60+(i/6|0)*430,y=150+(i%6)*56;
   ctx.fillStyle='#e8f6d4';ctx.strokeStyle='#2b1b5e';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x,y,80,48,8);ctx.fill();ctx.stroke();glyph(v,x+40,y+24,28,'#7b2cbf');
   ctx.fillStyle='#cfe9ff';ctx.beginPath();ctx.roundRect(x+90,y,110,48,8);ctx.fill();ctx.stroke();glyph(SP('ກ',v),x+145,y+24,28,'#7b2cbf');
   dk('k'+VOWS[v],x+265,y+24,20)});
  dk('◌ marks where the consonant goes. ເ ແ ໂ ໄ ໃ are written BEFORE it but said after it.',480,500,15);
  dk('ໄ and ໃ sound the same: only about twenty words use ໃ.',480,526,15);
 }
}
""")

# ---- Letter Lab: start with ກ, machines change one sound feature at a time
block('const ALLL=', 'const lab=', r"""const ALLL=ALLG,g5=ch=>R(ch)<4,gl=(r,k)=>GRID[r][k];
const SWAP={'ຂ':'ຄ','ຄ':'ຂ','ສ':'ຊ','ຊ':'ສ','ຖ':'ທ','ທ':'ຖ','ຜ':'ພ','ພ':'ຜ','ຝ':'ຟ','ຟ':'ຝ','ຫ':'ຮ','ຮ':'ຫ'},HIDE={'ງ':'ຫງ','ຍ':'ຫຍ','ນ':'ໜ','ມ':'ໝ','ລ':'ຫຼ','ວ':'ຫວ'};
const MACH=[
 {id:'breath',name:'Puff machine',desc:'Adds a puff of air',sym:'ʰ',col:'#22b8f0',need:0,run:ch=>g5(ch)&&K(ch)===0?[gl(R(ch),1)]:[]},
 {id:'nasal',name:'Nasal machine',desc:'Sound through the nose',sym:'ŋ',col:'#ff9f1c',need:0,run:ch=>g5(ch)&&K(ch)<3?[gl(R(ch),3)]:[]},
 {id:'series',name:'Class machine',desc:'Swaps high and low class',sym:'H|L',col:'#b5179e',need:0,run:ch=>SWAP[ch]?[SWAP[ch]]:[]},
 {id:'tongue',name:'Tongue machine',desc:'Plain sounds move on',sym:'→',col:'#3ddc84',need:0,gate:d=>GRID[0].every(c=>d.has(c)),gateText:'Discover ກ ຂ ຄ ງ first',run:ch=>g5(ch)&&R(ch)<3&&K(ch)===0?[gl(R(ch)+1,0)]:[]},
 {id:'pop',name:'Pop machine',desc:'A softer, popping sound',sym:'d b',col:'#ff4d6d',need:2,run:ch=>ch==='ຕ'?['ດ']:ch==='ປ'?['ບ']:[]},
 {id:'fan',name:'Fan machine',desc:'Lips touch the teeth',sym:'f',col:'#f77f00',need:3,run:ch=>ch==='ຜ'?['ຝ']:ch==='ພ'?['ຟ']:[]},
 {id:'throat',name:'Throat machine',desc:'Opens the throat',sym:'h',col:'#f15bb5',need:3,run:ch=>g5(ch)&&R(ch)===0&&K(ch)<3?['ຫ','ຮ']:[]},
 {id:'catch',name:'Catch machine',desc:'Closes the throat',sym:'ʔ',col:'#9b5de5',need:3,run:ch=>g5(ch)&&R(ch)===0&&K(ch)<3?['ອ']:[]},
 {id:'glide',name:'Glide machine',desc:'Lets the sound glide',sym:'j w',col:'#e6b800',need:2,run:ch=>g5(ch)&&R(ch)===1?['ຢ']:g5(ch)&&R(ch)===3?['ວ']:[]},
 {id:'flow',name:'Flow machine',desc:'Lets the tongue flow',sym:'l r',col:'#4cc9f0',need:4,run:ch=>g5(ch)&&R(ch)===2?['ລ','ຣ']:[]},
 {id:'hidden',name:'Silent ຫ machine',desc:'Low letter → high class',sym:'ຫ+',col:'#6bcf6b',need:5,run:ch=>HIDE[ch]?[HIDE[ch]]:[]}];
""")
rep("const lab={d:new Set(['ក']),mu:new Set(),sel:'ក'", "const lab={d:new Set(['ກ']),mu:new Set(),sel:'ກ'")
block('const CELLS=[];', 'const mpos=', r"""const CELLS=[];GRID.forEach((row,r)=>row.forEach((ch,k)=>CELLS.push({ch,x:34+k*60,y:96+r*50,w:56,h:46})));
EXT.forEach((row,r)=>row.forEach((ch,k)=>CELLS.push({ch,x:34+k*52,y:318+r*48,w:48,h:44})));
VOW.forEach((row,r)=>row.forEach((ch,k)=>CELLS.push({ch,x:262+k*62,y:318+r*48,w:58,h:44})));
""")
rep("const BASE=['breath','nasal','series'],ORDER=['hiss','throat','catch','glide','flow','wake1','wake2','roll'];",
    "const BASE=['breath','nasal','series'],ORDER=['pop','fan','throat','catch','glide','flow','hidden'];")
rep("tongueDone=d=>'ចដតប'.split('').every(c=>d.has(c))", "tongueDone=d=>['ຈ','ຕ','ປ'].every(c=>d.has(c))")
rep("const d=new Set(['ក']);try{JSON.parse(localStorage.getItem('llc-lab')||'[]').forEach(c=>d.add(c))}catch(e){}lab.d.forEach(c=>d.add(c));let fr=0;for(let r=0;r<5;r++)if([...GRID[r]].some(c=>d.has(c)))fr=r;return{row:GRID[fr],ok:[...GRID[fr]].filter",
    "const d=new Set(['ກ']);try{JSON.parse(localStorage.getItem('llc-lab')||'[]').forEach(c=>d.add(c))}catch(e){}lab.d.forEach(c=>d.add(c));let fr=0;for(let r=0;r<GRID.length;r++)if(GRID[r].some(c=>d.has(c)))fr=r;return{row:GRID[fr],ok:GRID[fr].filter")
rep("!ROWS[R(lab.sel)].split('').every(c=>lab.d.has(c))", "!ROWS[R(lab.sel)].every(c=>lab.d.has(c))")
rep("tx('The last eight',34,378,'left',14);tx('Vowel letters',262,378,'left',14);", "tx('8 extras',34,306,'left',14);tx('ຫ letters',262,306,'left',14);")
rep("bigText(IPA[r.ch],480,492,46,IFONT,'#ffffff','#9fe8ff');", "bigText(IPA[r.ch]+'  ·  '+CLN[CLS(r.ch)]+' class',480,492,40,IFONT,'#ffffff','#9fe8ff');")
rep("ALLL.split('').forEach((ch,i)=>glyph(ch,70+(i%14)*60,190+((i/14)|0)*78", "ALLL.forEach((ch,i)=>glyph(ch,90+(i%13)*65,190+((i/13)|0)*78")
rep("lab.sel=c.ch;lab.msg=c.ch+' selected ('+IPA[c.ch]+'). Now pick a machine!'", "lab.sel=c.ch;lab.msg=c.ch+' selected ('+UK(c.ch)+'). Now pick a machine!'")
s = s.replace("'ក'", "'ກ'").replace("letter ក!", "letter ກ!").replace("Trace ក to", "Trace ກ to").replace("start with ក and", "start with ກ and")

left = sorted(set(re.findall(r'[ក-៿᧠-᧿]', s)))
if left:
    for m in re.finditer(r'.{0,60}[ក-៿].{0,60}', s): print('KHMER LEFT:', m.group(0))
    raise SystemExit('khmer characters remain')
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s))
# ---- polish after visual check
s2 = open(dst, encoding='utf-8').read()
def r2(a, b):
    global s2
    assert s2.count(a) == 1, a
    s2 = s2.replace(a, b)
r2('''IFONT='"Noto Sans","Gentium Plus","DejaVu Sans","Noto Sans Lao Looped",system-ui,sans-serif';''', '''IFONT='"Noto Sans","Noto Sans Lao Looped","Gentium Plus","DejaVu Sans",system-ui,sans-serif';''')
r2("desc:'Swaps high and low class'", "desc:'High ↔ low class'")
r2("desc:'A softer, popping sound'", "desc:'A softer pop'")
r2("desc:'Low letter → high class'", "desc:'Low → high class'")
r2("desc:'Sound through the nose'", "desc:'Through the nose'")

# ---- more class puzzles; never the same kind of level twice in one journey
r2("const HL=ch=>R(ch)>=7,", "const TWIN={'ຂ':'ຄ','ຄ':'ຂ','ສ':'ຊ','ຊ':'ສ','ຖ':'ທ','ທ':'ຖ','ຜ':'ພ','ພ':'ຜ','ຝ':'ຟ','ຟ':'ຝ','ຫ':'ຮ','ຮ':'ຫ','ງ':'ຫງ','ຫງ':'ງ','ຍ':'ຫຍ','ຫຍ':'ຍ','ນ':'ໜ','ໜ':'ນ','ມ':'ໝ','ໝ':'ມ','ລ':'ຫຼ','ຫຼ':'ລ','ວ':'ຫວ','ຫວ':'ວ'};\nconst HL=ch=>R(ch)>=7,")
r2(" muol:{key:ch=>ch,", " cls:{key:ch=>CLN[CLS(ch)],disp:k=>k+' class',fb:ch=>ch+' is '+CLN[CLS(ch)]+' class.',tags:false},\n twin:{key:ch=>TWIN[ch]||'',disp:k=>k,fb:ch=>ch+' ('+UK(ch)+') is the twin of '+TWIN[ch]+'.',tags:false},\n muol:{key:ch=>ch,")
r2(" {name:'Ordered',sc:2,terr:'water',gk:[7,1,3],hint:'The guardians check in order: nose first, then puffs.',g:['NOSE letters','PUFF letters','all the rest'],cat:ch=>NOSE.includes(ch)?0:PUFF.includes(ch)?1:2},",
   " {name:'Ordered',sc:2,terr:'water',gk:[7,1,3],hint:'The guardians check in order: puffs first, then lips. ຜ and ພ are puff AND lip letters, so the first guardian takes them!',g:['PUFF letters: ຂ ຄ ຖ ທ ຜ ພ','other LIP letters','all the rest'],cat:ch=>PUFF.includes(ch)?0:LIPS.includes(ch)?1:2},\n"
   " {name:'High gate',sc:5,terr:'forest',gk:[9,5],hint:'High class: ຂ ສ ຖ ຜ ຝ ຫ, plus every letter with a silent ຫ in front (ຫງ ຫຍ ໜ ໝ ຫຼ ຫວ).',g:['HIGH class: ຂ ສ ຖ ຜ ຝ ຫ + silent ຫ','MID and LOW class'],cat:ch=>CLS(ch)===1?0:1},\n"
   " {name:'Low gate',sc:1,terr:'cliff',gk:[8,4],hint:'Low class is the biggest group. If a letter is not one of the 8 mid letters and not high, it is low.',g:['LOW class: ຄ ງ ຊ ຍ ທ ນ ພ ມ ຟ ລ ວ ຣ ຮ','MID and HIGH class'],cat:ch=>CLS(ch)===2?0:1},\n"
   " {name:'Class twins',sc:3,terr:'water',gk:[10],mode:'seq',seq:'twin',intro:'Many letters have a TWIN: the same sound in a different class. ຂ (high) and ຄ (low) both say kʰɔː. The dancer shows a letter. Send its twin! Letters without a twin rest this time.',hint:'High twins: ຂ ສ ຖ ຜ ຝ ຫ. Low twins: ຄ ຊ ທ ພ ຟ ຮ. A silent ຫ makes a high twin too: ນ and ໜ, ມ and ໝ.',g:['Twins share a sound but not a class.','The class tells you the tone!']},\n"
   " {name:'Class hunt',sc:0,terr:'forest',gk:[4],mode:'seq',seq:'cls',intro:'The guardian calls out a class. Send EVERY letter in your party that belongs to it, one at a time. A wrong guess tells you that letter\\'s class.',hint:'Mid: ກ ຈ ດ ຕ ບ ປ ຢ ອ. High: ຂ ສ ຖ ຜ ຝ ຫ + silent ຫ. Low: everything else.',g:['Every letter belongs to one class.','Mid, high and low!']},\n"
   " {name:'Class order',sc:2,terr:'cliff',gk:[3,1,0],hint:'The guardians check in order. Silent ຫ letters are high class too, but the first guardian grabs them before the second one can!',g:['SILENT ຫ letters: ຫງ ຫຍ ໜ ໝ ຫຼ ຫວ','other HIGH class letters','MID and LOW class'],cat:ch=>HL(ch)?0:CLS(ch)===1?1:2},")
r2("['Three classes',0],", "['Three classes',0],['High gate',0],['Low gate',0],['Class twins',0],['Class hunt',0],['Class order',1,hasVow],")
# levels that teach the same thing share a family; a journey uses each family once
r2("// overworld map:", "const FAM={'Mid class':'classgate','High gate':'classgate','Low gate':'classgate','Sound check':'sound','IPA tablet':'sound','Consonants':'cons','IPA hunt':'cons','Loopless 1':'loop','Loopless 3':'loop','Build sounds':'build','Build more':'build','First words':'words','More words':'words','Word tablet':'words','Trace 1':'trace','Trace 2':'trace'},fam=i=>FAM[LV[i].name]||LV[i].name;let usedFam=new Set();\n// overworld map:")
r2("if(L.seq==='feet'&&party.filter(c=>R(c.ch)<7).length<3)return false;return true};",
   "if(L.seq==='twin'&&party.filter(c=>TWIN[c.ch]).length<3)return false;if(L.seq==='cls'&&new Set(party.map(c=>CLS(c.ch))).size<2)return false;return true},fresh=m=>!usedLv.has(m.i)&&!usedFam.has(fam(m.i));")
r2(" let c=META.filter(m=>m.mp<=cap&&!usedLv.has(m.i)&&fits(m)&&!(m.road&&o.road&&m.road!==o.road));\n if(!c.length)c=META.filter(m=>m.mp<=cap&&fits(m));if(!c.length)c=META.filter(m=>m.mp<=plays&&fits(m));if(!c.length)c=META.filter(m=>m.mp===0&&fits(m));if(!c.length)c=META.filter(m=>m.mp===0);",
   " let c=[];for(const ok of [m=>m.mp<=cap&&fresh(m)&&fits(m),m=>m.mp<=plays&&fresh(m)&&fits(m),m=>fresh(m)&&fits(m),m=>fresh(m)&&m.ok(),m=>!usedLv.has(m.i)&&fits(m),m=>!usedLv.has(m.i),m=>m.mp===0]){c=META.filter(ok);if(c.length)break}")
r2("usedLv.add(i);n.lv=i;", "usedLv.add(i);usedFam.add(fam(i));n.lv=i;")
r2("usedLv=new Set();planTrace();", "usedLv=new Set();usedFam=new Set(['trace']);planTrace();")
r2("c.dim=L.seq==='feet'?R(c.ch)>=7:", "c.dim=L.seq==='twin'?!TWIN[c.ch]:")
r2("(L.seq==='muol2'||L.seq==='feet')?KFONT", "(L.seq==='muol2'||L.seq==='twin')?KFONT")
open(dst, 'w', encoding='utf-8').write(s2)
print('polished')
