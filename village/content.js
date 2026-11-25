// Game content: vocabulary, characters, dialogue, word stones, shops, quests.
// Dialogue lines: [speaker, khmer]. Khmer tokens are space-separated; a token may
// carry a context gloss as word{gloss}. Otherwise the gloss comes from VOCAB.
export const VOCAB = {
  // people & family
  "ខ្ញុំ": "I, me", "យាយ": "grandma", "តា": "grandpa", "ចៅ": "grandchild", "គ្រូ": "teacher",
  "ក្មេង": "child", "បង": "older sibling; you", "ប្អូន": "younger sibling", "ម្ដាយ": "mother", "ម៉ែ": "mum",
  "ឪពុក": "father", "ជីដូន": "grandmother", "ជីតា": "grandfather", "បងស្រី": "older sister",
  "បងប្រុស": "older brother", "ប្អូនស្រី": "younger sister", "ប្អូនប្រុស": "younger brother",
  "គាត់": "he, she (polite)", "ឯង": "you (close)", "ព្រះសង្ឃ": "monk", "នាង": "she", "គេ": "they, people",
  "យើង": "we", "អ្នក": "you; person", "គ្រួសារ": "family", "កូន": "child (offspring)", "កូនស្រី": "daughter",
  "កូនប្រុស": "son", "ប្ដី": "husband", "ប្រពន្ធ": "wife", "អ៊ុំ": "aunt/uncle (older than parent)", "ពូ": "uncle",
  "ក្មួយ": "niece, nephew", "យាយទួត": "great-grandma", "ចែ": "older sister (Chinese-Khmer)",
  "ហ៊ា": "older brother (Chinese-Khmer)", "អ៊ី": "aunt (Chinese-Khmer)", "ចិន": "Chinese", "ជាង": "mechanic, craftsman",
  "អ្នកលក់": "seller", "អ្នកនេសាទ": "fisher", "សុខ": "Sok (name)", "មុំ": "Mom (name)", "ចាស់": "old",
  // places & nature
  "ផ្ទះ": "house", "សាលា": "school", "ផ្សារ": "market", "ភូមិ": "village", "ស្រុក": "homeland, country",
  "ស្រុកកំណើត": "birthplace", "ក្រុង": "town, city", "ហាង": "shop",
  "វត្ត": "temple, pagoda", "ភ្នំ": "mountain, hill", "ទន្លេ": "river", "ស្រែ": "rice field", "ស្រូវ": "rice plant",
  "ទូក": "boat", "ត្រី": "fish", "ឆ្កែ": "dog", "មាន់": "chicken", "ក្របី": "water buffalo", "ត្នោត": "sugar palm",
  "ផ្កា": "flower", "ផ្កាឈូក": "lotus; pink", "ថ្ម": "stone", "ទ្វារ": "door", "ក្បាល": "head", "ស្លាក": "sign",
  "ថ្ងៃ": "day, sun", "យប់": "night", "ទឹក": "water", "ភ្លើង": "fire, light", "បាយ": "cooked rice, meal",
  "ពាក្យ": "word", "អំណាច": "power", "ភាសា": "language", "ខ្មែរ": "Khmer", "ពណ៌": "colour", "សត្វ": "animal",
  "ផ្លូវ": "road, path", "ដី": "earth, ground", "ឡាន": "car", "ម៉ូតូ": "motorbike", "កង់": "wheel, tyre",
  "សាំង": "petrol", "ធុង": "tank", "ដប": "bottle", "ម្ហូប": "dish, food", "ដូង": "coconut", "ទឹកដូង": "coconut water",
  // shop goods
  "ចេក": "banana", "នំ": "cake", "ពងមាន់": "chicken egg", "បាល់": "ball", "កាហ្វេ": "coffee", "ស្ករ": "sugar",
  "សៀវភៅ": "book",
  // colours
  "ក្រហម": "red", "ខៀវ": "blue", "លឿង": "yellow", "បៃតង": "green", "ស": "white", "ខ្មៅ": "black", "ស្វាយ": "purple; mango",
  // numbers & money
  "មួយ": "one", "ពីរ": "two", "បី": "three", "បួន": "four", "ប្រាំ": "five", "ប្រាំមួយ": "six", "ប្រាំពីរ": "seven",
  "ប្រាំបី": "eight", "ប្រាំបួន": "nine", "ដប់": "ten", "រយ": "hundred", "ពាន់": "thousand", "ម៉ឺន": "ten thousand",
  "រៀល": "riel", "លុយ": "money", "លេខ": "number", "ថ្លៃ": "price; expensive", "ប៉ុន្មាន": "how much",
  "ទិញ": "buy", "លក់": "sell", "គ្រប់": "enough", "អាប់": "change (money)", "ពេញ": "full",
  // verbs
  "ទៅ": "go", "មក": "come", "ឈរ": "stand", "អង្គុយ": "sit", "ដើរ": "walk", "ហូប": "eat", "ញ៉ាំ": "eat", "ផឹក": "drink",
  "ភ្ញាក់": "wake up", "ដេក": "sleep", "លេង": "play", "សម្រាក": "rest", "ធ្វើការ": "work", "រៀន": "learn, study",
  "បង្រៀន": "teach", "ចេះ": "know how", "អាន": "read", "មើល": "look", "ឃើញ": "see", "និយាយ": "speak, say", "ហៅ": "call",
  "ជួយ": "help", "រក": "look for", "ចង់": "want", "ចាំ": "wait; remember", "ភ្លេច": "forget", "ឡើង": "climb, board",
  "ដួល": "fall over", "ត្រូវការ": "need", "មាន": "have; there is", "ជា": "is, am", "នៅ": "at; is at",
  "ធ្វើ": "do, make", "ឲ្យ": "give; let", "ខ្ចី": "borrow, lend", "ជួស": "repair", "ជួសជុល": "repair", "បែក": "burst",
  "ជិះ": "ride", "ចាប់": "catch", "ត្រឡប់": "return", "ដាក់": "put", "ធ្លាប់": "used to", "ស្រេក": "thirsty",
  // describing
  "ល្អ": "good", "ធំ": "big", "តូច": "small", "ស្រស់": "fresh", "ឆ្ងាយ": "far", "ជិត": "near",
  "ថ្មី": "new", "ឆ្ងាញ់": "delicious", "ស្ងួត": "dry", "ស្អាត": "beautiful, clean",
  // little words
  "ហើយ": "already; and then", "បាន": "got; did", "ទេ": "no; (question)", "អត់": "not", "មិន": "not", "បាទ": "yes (male)",
  "អរគុណ": "thank you", "ណា": "where; (softener)", "អ្វី": "what", "ឈ្មោះ": "name", "នេះ": "this", "នោះ": "that",
  "ថា": "that (quote)", "គឺ": "is (equals)", "និង": "and", "លើ": "on, above", "ក្រោម": "under", "ក្នុង": "in", "ពី": "from",
  "ផង": "please; too", "ឥឡូវ": "now", "បន្តិច": "a little", "ណាស់": "very", "វា": "it", "របស់": "belonging to",
  "ទៀត": "again, more", "ជាមួយ": "with", "គ្នា": "each other, together", "វិញ": "back", "ប៉ុន្តែ": "but",
  "មែន": "true, really", "អូ": "oh", "ក្បែរ": "near, beside", "ដើម": "trunk; tree", "សួរ": "ask", "ដែរ": "also, too", "យក": "take",
};

// Spells. uses: the special places/ways a spell works (tracked in the spell book).
export const SPELLS = {
  "ទឹក": { d: "Summons water", uses: ["flowers", "paddy", "well", "mud", "buffalo", "rain"] },
  "ភ្លើង": { d: "Kindles fire and light", uses: ["lamps", "hearth", "lanterns", "dark", "shop", "fire"] },
  "ឈរ": { d: "Makes fallen things stand", uses: ["sign", "scarecrow", "fallen", "dog", "moto"] },
  "អង្គុយ": { d: "Makes creatures sit", uses: ["dog", "kid", "buffalo", "rest"] },
  "មក": { d: "Calls a thing to you", uses: ["boat", "dog", "fish", "far", "moto", "coconut"] },
  "ទៅ": { d: "Sends you (or your ride) onward", uses: ["boat", "dash", "boost", "chickens"] },
  "ដើរ": { d: "Swift walking", uses: ["swift", "buffalo"] },
  "បាយ": { d: "Conjures a bowl of rice", uses: ["kid", "dog", "chickens", "monk", "bowl"] },
  "ផ្កា": { d: "Flowers bloom around you", uses: ["tuot", "ee", "bloom"] },
  "ថ្ងៃ": { d: "Brings the day", uses: ["day"] },
  "យប់": { d: "Brings the night", uses: ["night"] },
  "ផ្ទះ": { d: "Returns you to Grandma's house", uses: ["home"] },
  "ក្រហម": { d: "Paints red", uses: ["door", "paint", "ball", "ee"] },
  "ខៀវ": { d: "Paints blue", uses: ["door", "paint", "ball"] },
  "លឿង": { d: "Paints yellow", uses: ["door", "paint", "ball"] },
  "បៃតង": { d: "Paints green", uses: ["paint", "ball"] },
  "ស": { d: "Paints white", uses: ["paint", "ball", "tuot"] },
  "ខ្មៅ": { d: "Paints black", uses: ["paint", "ball"] },
  "ស្វាយ": { d: "Paints purple", uses: ["paint", "ball"] },
  "ផ្កាឈូក": { d: "Paints pink", uses: ["paint", "ball"] },
};

// Characters. bilingual: shows the gloss under every word. Others speak Khmer only.
export const NPCS = {
  yay:    { km: "យាយ", bilingual: true, color: 0x7a3b5c, krama: 0xd8b25a, pos: [2.2, 1.6] },
  kru:    { km: "គ្រូ", bilingual: true, color: 0x2f5d8a, krama: 0xffffff, pos: [34, -41] },
  aunt:   { km: "អ៊ុំស្រី", bilingual: true, color: 0x3a6a5a, krama: 0xc23b3b, pos: [-13, -7] },
  tuot:   { km: "យាយទួត", bilingual: false, color: 0x5a4a6a, krama: 0xe8e0d0, pos: [-22, -5], old: true },
  sok:    { km: "សុខ", bilingual: true, color: 0xd07a9a, krama: 0xf0e0a0, pos: [44, 12] },
  kid:    { km: "ក្មេង", bilingual: false, color: 0xc0623a, krama: 0x335533, pos: [49, 15], small: true },
  vendor: { km: "អ្នកលក់", bilingual: false, color: 0x9a6b2a, krama: 0xb03030, pos: [58, 6] },
  ta:     { km: "តា", bilingual: false, color: 0x5a4a3a, krama: 0x3a6fb0, pos: [18, 40], hat: true },
  fisher: { km: "អ្នកនេសាទ", bilingual: false, color: 0x44575f, krama: 0xc9a227, pos: [-43, 15], hat: true },
  monk:   { km: "ព្រះសង្ឃ", bilingual: false, color: 0xd9771f, krama: 0xd9771f, pos: [-99.5, -22.4], robe: true },
  // town
  jang:   { km: "ជាង", bilingual: false, color: 0x4a4a52, krama: 0x8a8a8a, pos: [146, 13] },
  gas:    { km: "អ្នកលក់", bilingual: false, color: 0xc0302a, krama: 0xffffff, pos: [166, -8] },
  che:    { km: "ចែ", bilingual: true, color: 0xb02a2a, krama: 0xe8c040, pos: [200, -11] },
  hia:    { km: "ហ៊ា", bilingual: false, color: 0x2a3a6a, krama: 0xffffff, pos: [206, -9] },
  ee:     { km: "អ៊ី", bilingual: false, color: 0x6a2a5a, krama: 0xe0b0c0, pos: [194, -11.5], old: true },
  tacha:  { km: "តាចាស់", bilingual: true, color: 0x6a6a5a, krama: 0x9ac0e0, pos: [216, 12], old: true },
};

export const TALK = {
  yay_intro: [
    ["yay", "ចៅ ភ្ញាក់ ហើយ !"],
    ["yay", "យាយ ឃើញ ចៅ នៅ ទន្លេ ។"],
    ["yay", "ចៅ មាន ថ្ម មួយ ។ ថ្ម នេះ មាន ពាក្យ ខ្មែរ ។"],
    ["yay", "ពាក្យ ខ្មែរ មាន អំណាច !"],
    ["yay", "ផ្កា យាយ ត្រូវការ ទឹក ។ និយាយ ថា « ទឹក » ។"],
  ],
  yay_wait: [["yay", "និយាយ « ទឹក » នៅ ផ្កា ។"]],
  yay_errand: [
    ["yay", "ល្អ ណាស់ ! ផ្កា ស្រស់ ហើយ ។"],
    ["yay", "ចៅ ទៅ ផ្សារ ទិញ ត្រី មួយ ។"],
    ["yay", "យាយ ឲ្យ លុយ ប្រាំ ពាន់ រៀល ។"],
    ["yay", "សុខ នៅ ផ្សារ ។ នាង ចេះ លេខ ។"],
  ],
  yay_wait_fish: [["yay", "ទិញ ត្រី មួយ នៅ ផ្សារ ។ សុខ ចេះ លេខ ។"]],
  yay_fish: [
    ["yay", "អរគុណ ចៅ ! ត្រី ល្អ ណាស់ ។"],
    ["yay", "ឥឡូវ ទៅ សាលា ។ គ្រូ ចេះ អាន ថ្ម នេះ ។"],
  ],
  yay_school: [["yay", "ទៅ សាលា ណា ចៅ ។"]],
  yay_hearth: [["yay", "ចៅ ចេះ « ភ្លើង » ហើយ ? ជួយ យាយ ធ្វើ ម្ហូប ផង ។"]],
  yay_hearth_done: [["yay", "ឆ្ងាញ់ ណាស់ ! អរគុណ ចៅ ។ យក លុយ នេះ ។"]],
  yay_end: [
    ["yay", "ចៅ ត្រឡប់ មក ស្រុក វិញ ហើយ ។"],
    ["yay", "យាយ ជា បងស្រី ជីដូន ចៅ ។"],
    ["yay", "ភូមិ នេះ ជា ស្រុកកំណើត ជីដូន ចៅ ។"],
  ],
  sok_intro: [
    ["sok", "បង ! ខ្ញុំ ឈ្មោះ សុខ ។"],
    ["sok", "យាយ ឲ្យ លុយ បង ទិញ ត្រី មែន ទេ ? ខ្ញុំ បង្រៀន លេខ ។"],
    ["sok", "មួយ ពីរ បី បួន ប្រាំ ។"],
    ["sok", "ប្រាំមួយ ប្រាំពីរ ប្រាំបី ប្រាំបួន ដប់ ។"],
    ["sok", "១{1} ២{2} ៣{3} ៤{4} ៥{5} ៦{6} ៧{7} ៨{8} ៩{9} ១០{10}"],
    ["sok", "រយ ពាន់ ម៉ឺន ។"],
    ["sok", "ពីរ ពាន់ រៀល គឺ ២០០០{2000} ៛ ។"],
    ["sok", "ត្រី ថ្លៃ ប៉ុន្មាន ? សួរ អ្នកលក់ ។"],
  ],
  sok_wait: [["sok", "ប្រាំ រយ គឺ ៥០០{500} ។ មួយ ពាន់ គឺ ១០០០{1000} ។"]],
  sok_invite: [["sok", "អូ ! ម៉ែ ហៅ ? ខ្ញុំ ទៅ ជាមួយ ប្អូនប្រុស ។"]],
  kru_intro: [
    ["kru", "ខ្ញុំ ជា គ្រូ ។ គ្រូ មើល ថ្ម បន្តិច ។"],
    ["kru", "ថ្ម នេះ មក ពី វត្ត លើ ភ្នំ ។"],
    ["kru", "រៀន ពាក្យ ថ្មី : « ឈរ » និង « ភ្លើង » ។"],
    ["kru", "ស្លាក សាលា ដួល ។ ជួយ គ្រូ ផង ។"],
  ],
  kru_wait: [["kru", "និយាយ « ឈរ » នៅ ស្លាក ។"]],
  kru_after_sign: [
    ["kru", "អរគុណ ! ឥឡូវ រៀន « មក » និង « ទៅ » ។"],
    ["kru", "វត្ត នៅ ឆ្ងាយ ។ ទូក នៅ ទន្លេ ។"],
    ["kru", "ហៅ ទូក « មក » ។ ឡើង ទូក ហើយ និយាយ « ទៅ » ។"],
    ["kru", "ទ្វារ វត្ត ត្រូវការ ពណ៌ បី ។"],
    ["kru", "រក ក្បាល ថ្ម បី នៅ ក្នុង ភូមិ ។"],
  ],
  kru_hint: [["kru", "រក ក្បាល ថ្ម បី ។ មើល ពណ៌ !"]],
  aunt_intro: [
    ["aunt", "ក្មួយ ! ខ្ញុំ ជា អ៊ុំ ក្មួយ ។"],
    ["aunt", "យាយ ជា ម្ដាយ អ៊ុំ ។"],
    ["aunt", "យប់ នេះ យើង ញ៉ាំ បាយ ជាមួយ គ្នា ។"],
    ["aunt", "ជួយ ហៅ គ្រួសារ មក ញ៉ាំ បាយ ផង ។"],
    ["aunt", "ឪពុក អ៊ុំ នៅ ស្រែ ។ ប្ដី អ៊ុំ នៅ ទន្លេ ។"],
    ["aunt", "កូនស្រី និង កូនប្រុស អ៊ុំ នៅ ផ្សារ ។"],
  ],
  aunt_wait: [["aunt", "ហៅ ឪពុក ប្ដី កូនស្រី និង កូនប្រុស អ៊ុំ ផង ។"]],
  aunt_dinner: [
    ["aunt", "អរគុណ ក្មួយ ! គ្រួសារ មក ហើយ ។"],
    ["aunt", "នេះ ឪពុក អ៊ុំ ។ ក្មួយ ហៅ គាត់ ថា តា ។"],
    ["aunt", "នេះ ប្ដី អ៊ុំ ។ ក្មួយ ហៅ គាត់ ថា ពូ ។"],
    ["aunt", "នេះ កូនស្រី អ៊ុំ ។ នាង ជា បងស្រី ។"],
    ["aunt", "នេះ កូនប្រុស អ៊ុំ ។ គាត់ ជា ប្អូនប្រុស ។"],
    ["aunt", "យាយទួត ជា ម្ដាយ យាយ ។"],
    ["aunt", "ពូ ឲ្យ ក្មួយ ខ្ចី ម៉ូតូ ។"],
    ["aunt", "ប៉ុន្តែ កង់ បែក ។ ជាង នៅ ក្រុង ។"],
  ],
  aunt_after: [["aunt", "ម៉ូតូ នៅ ក្បែរ ផ្ទះ អ៊ុំ ។ ជាង នៅ ក្រុង ។"]],
  tuot_ask: [["tuot", "ចៅ ... ខ្ញុំ ចង់ ផ្កា ស ។ ផ្កា ស ..."]],
  tuot_done: [["tuot", "ស្អាត ណាស់ ... អរគុណ ចៅ ។"], ["tuot", "ថ្ម ... នៅ ក្រោម ផ្ទះ ។"]],
  tuot_idle: [["tuot", "ចៅ ល្អ ណាស់ ។"]],
  kid_hungry: [["kid", "ខ្ញុំ ចង់ ញ៉ាំ ... នំ ! បាយ !"]],
  kid_fed: [["kid", "អរគុណ បង ! ឆ្ងាញ់ !"], ["kid", "ក្បាល ថ្ម ក្រហម នៅ ផ្សារ ។"]],
  kid_ball: [["kid", "ខ្ញុំ ចង់ បាល់ ! បាល់ !"]],
  kid_invite: [["kid", "ម៉ែ ហៅ ? ញ៉ាំ បាយ ! ញ៉ាំ បាយ !"]],
  kid_play: [["kid", "បាល់ ! លេង ជាមួយ គ្នា !"]],
  vendor: [["vendor", "ត្រី ! ចេក ! ពងមាន់ ! មក មើល !"]],
  ta_dry: [["ta", "ស្រែ អត់ ទឹក ... ទឹក ! ត្រូវការ ទឹក !"], ["ta", "ក្របី ចង់ ផឹក ទឹក ដែរ ។"]],
  ta_scare: [["ta", "អរគុណ ចៅ ! បី ពាន់ រៀល ។"], ["ta", "មើល ! ដួល ... ឈរ !"]],
  ta_done: [["ta", "ស្រូវ ល្អ ណាស់ ។ ក្បាល ថ្ម លឿង នៅ ឆ្ងាយ ។"]],
  ta_invite: [["ta", "បាទ ! កូនស្រី ខ្ញុំ ហៅ ? ខ្ញុំ ទៅ ។"]],
  fisher: [["fisher", "ទូក នៅ ឆ្ងាយ ។ ហៅ « មក » !"]],
  fisher_fish: [["fisher", "ចាប់ ត្រី បី ! ត្រី ... « មក » !"]],
  fisher_paid: [["fisher", "ត្រី បី ! អរគុណ ! បី ពាន់ រៀល ។"]],
  fisher_idle: [["fisher", "ឡើង ទូក ហើយ និយាយ « ទៅ » ។ ម៉ូតូ ខ្ញុំ នៅ ផ្ទះ ។"]],
  fisher_invite: [["fisher", "ប្រពន្ធ ខ្ញុំ ហៅ ? បាទ ! ទៅ !"]],
  monk: [
    ["monk", "ចៅ មក ហើយ ។"],
    ["monk", "ថ្ម នេះ ជា របស់ ជីដូន ចៅ ។"],
    ["monk", "ជីដូន ចៅ មក ពី ភូមិ នេះ ។"],
    ["monk", "គាត់ ចង់ ឲ្យ ចៅ ត្រឡប់ មក ស្រុក វិញ ។"],
    ["monk", "និយាយ « ស្រុក » ។"],
  ],
  monk_wait: [["monk", "និយាយ « ស្រុក » នៅ ថ្ម ។"]],
  monk_after: [["monk", "ចៅ មក ស្រុក ហើយ ។ ល្អ ណាស់ ។"]],
  jang: [["jang", "ជួសជុល ម៉ូតូ ! ម៉ូតូ កង់ បែក ?"]],
  jang_ok: [["jang", "កង់ ល្អ ។ ម៉ូតូ ល្អ !"]],
  gas: [["gas", "សាំង ! ឡាន ! ម៉ូតូ !"]],
  che_intro: [
    ["che", "ខ្ញុំ ឈ្មោះ មុំ ។ គេ ហៅ ខ្ញុំ ថា ចែ ។"],
    ["che", "គ្រួសារ ខ្ញុំ ជា ខ្មែរ ចិន ។"],
    ["che", "បងប្រុស ខ្ញុំ គឺ ហ៊ា ។"],
    ["che", "អ៊ី គឺ ប្អូនស្រី ម្ដាយ ខ្ញុំ ។"],
    ["che", "ហាង ខ្ញុំ មាន បាល់ កាហ្វេ ស្ករ សៀវភៅ ។"],
  ],
  hia_day: [["hia", "យប់ ... ហាង ត្រូវការ ភ្លើង !"]],
  hia_paid: [["hia", "ភ្លើង ស្អាត ! អរគុណ ! ពីរ ពាន់ រៀល ។"]],
  hia_idle: [["hia", "ហាង ចែ ល្អ ណាស់ !"]],
  ee_ask: [["ee", "ខ្ញុំ ចង់ ផ្កា ... ផ្កា ក្រហម !"]],
  ee_paid: [["ee", "ស្អាត ! អរគុណ ! មួយ ពាន់ រៀល ។"]],
  tacha_intro: [
    ["tacha", "ខ្ញុំ ធ្លាប់ ជា គ្រូ ។"],
    ["tacha", "ខ្ញុំ ចង់ ផឹក ទឹកដូង ។"],
    ["tacha", "ដូង នៅ ភូមិ ។ និយាយ « មក » នៅ ក្បែរ ដើម ដូង ។"],
  ],
  tacha_wait: [["tacha", "ដូង ! ហៅ « មក » នៅ ក្បែរ ដើម ដូង ។"]],
  tacha_done: [
    ["tacha", "ឆ្ងាញ់ ណាស់ ! អរគុណ ! យក ប្រាំ ពាន់ រៀល ។"],
    ["tacha", "ឆ្កែ ចេះ រក ថ្ម ពាក្យ ។ ឲ្យ បាយ ឆ្កែ ។"],
  ],
  tacha_idle: [["tacha", "ឆ្កែ ចេះ រក ថ្ម ពាក្យ ។"]],
};

// Things you can examine. If you have heard the word from someone, you work out its meaning.
export const EXAMINE = [
  { id: "buffalo", word: "ក្របី", en: "A big grey water buffalo." },
  { id: "chicken", word: "មាន់", en: "A chicken pecks at the dirt." },
  { id: "dog", word: "ឆ្កែ", en: "A friendly village dog." },
  { id: "boat", word: "ទូក", en: "A wooden river boat." },
  { id: "moto", word: "ម៉ូតូ", en: "A dusty old motorbike." },
  { id: "tyres", word: "កង់", en: "A stack of old tyres." },
  { id: "car", word: "ឡាន", en: "A parked car, covered in dust." },
  { id: "coco", word: "ដូង", en: "A coconut palm, heavy with coconuts." },
];

// Word stones: [word, x, z, mode, hint]
// modes: plain | night | mud (ទឹក) | dark (ភ្លើង) | fallen (ឈរ) | far (មក) | dig (dog) | secret (great-grandma) | temple
export const STONES = [
  ["ផ្ទះ", -2.6, -4.6, "plain", "Beneath the stilts of Grandma's house."],
  ["ថ្ងៃ", 5, -9, "plain", "Behind Grandma's house, where the morning sun lands."],
  ["ផ្កា", -6, 7.5, "plain", "Hidden behind Grandma's flower pots."],
  ["ភូមិ", -26, -16, "plain", "Behind Aunt's house."],
  ["ដើរ", -14, -40, "plain", "Behind the house closest to the southern woods... look north."],
  ["អង្គុយ", 25, 12.5, "plain", "Under the stilt house east of Grandma's."],
  ["ស", -20, -26, "mud", "A muddy lump in the woods west of the school path. Wash it."],
  ["ខ្មៅ", 70, -20, "dark", "In the shadow of a great tree north-east of the market. Bring light."],
  ["បៃតង", 54, 78, "fallen", "Toppled in the far corner of the rice fields."],
  ["ស្វាយ", -55, 42, "far", "Out in the river, south of the dock. Call it to you."],
  ["ផ្កាឈូក", 15, -55, "night", "On the lotus pond, but only under the stars."],
  ["យប់", 9, -63, "plain", "Among the reeds south of the lotus pond."],
  ["បាយ", 62, 15, "plain", "Behind the last market stall."],
  ["ស្រែ", 8, 34, "mud", "Mud at the edge of the paddies, near the path."],
  ["ស្រូវ", 34, 62, "plain", "Deep in the rice field."],
  ["ទន្លេ", -42, -10, "plain", "On the riverbank, north of the dock."],
  ["ត្រី", -41, 26, "night", "On the riverbank south of the dock, at night."],
  ["ភ្នំ", -76, 0, "plain", "At the foot of the temple hill."],
  ["វត្ត", -88, -6, "fallen", "Fallen on the hill path below the temple."],
  ["ជីដូន", -101, -17.6, "temple", "Inside the temple."],
  ["សាលា", 28, -50, "plain", "Behind the school."],
  ["ផ្សារ", 42.5, 9, "plain", "Between the market stalls."],
  ["គ្រួសារ", -18, -10, "secret", "Great-grandma knows."],
  ["ដី", 92, -42, "dig", "Buried in an empty field east of the school. Only a nose can find it."],
  ["ផ្លូវ", 128, 5, "plain", "In the pass through the hills."],
  ["ក្រុង", 152, -26, "plain", "Behind the first building in town."],
  ["ស្អាត", 230, 30, "plain", "In the far corner of town."],
  ["ថ្មី", 186, 40, "dark", "In a dark alley north of the town road."],
];

// Signs you can read.
export const SIGNS = [
  { word: "ហាង", x: 201.8, z: -14.3, color: "#b02a2a" },
  { word: "សាំង", x: 160, z: -19, color: "#c0302a" },
  { word: "ជួសជុល", x: 146, z: 16.8, color: "#2a4a8a" },
  { word: "កាហ្វេ", x: 216.6, z: 14.3, color: "#5a3a1a" },
  { word: "ក្រុង", x: 138, z: -8, color: "#2a6a3a" },
];

// Stone heads (colour clue + number of dots = order at the temple door)
export const HEADS = [
  { word: "ក្រហម", color: 0xd23a2a, dots: 1, pos: [68, 20] },
  { word: "ខៀវ", color: 0x2f6fd6, dots: 2, pos: [-44, -32] },
  { word: "លឿង", color: 0xf0c020, dots: 3, pos: [46, 88] },
];
export const DOOR_ORDER = ["ក្រហម", "ខៀវ", "លឿង"];

// Shops: item word, price in riel. kind: food | gas | fix | book
export const SHOPS = {
  vendor: [["ត្រី", 3000], ["ចេក", 500], ["ពងមាន់", 500], ["នំ", 1500], ["ស្វាយ", 1000], ["សាំង", 5000, "bottle"]],
  che: [["បាល់", 3000], ["កាហ្វេ", 2000], ["ស្ករ", 1000], ["សៀវភៅ", 5000]],
  gas: [["សាំង", 8000, "full"]],
  jang: [["កង់", 2000, "fix"]],
};
