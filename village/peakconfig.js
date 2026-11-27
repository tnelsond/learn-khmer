// Where the Khmer words' recordings come from, and who speaks with which voice.
// PeakSlab's Khmer tnefar slabs (peakslab.org/khmer/aux/), newest from peakslab.org where the page
// may fetch it, else the copies beside the game.
export const PEAK = {
  sources: ['https://peakslab.org/', './'],
  slabs: [
    { name: 'kheng', path: 'khmer/aux/km-kheng.slab', bufmax: 1 << 20 },
    { name: 'rith', path: 'khmer/aux/km-audio2-tnefar.slab', bufmax: 1 << 20 },
    { name: 'khsv', path: 'khmer/aux/km-khsv-words.slab', bufmax: 1 << 20 },
  ],
  postfilters: { path: 'khmer/aux/km-postfilters.slab', bufmax: 1 << 20 },
};
export const SPEAKER_NAMES = { 'kheng:': 'kheng.info', 'kheng:1': 'kheng.info', 'rith:': 'Khmer audio (rith)', 'khsv:1': 'Bible reader 1', 'khsv:2': 'Bible reader 2', 'khsv:3': 'Bible reader 3', 'khsv:4': 'Bible reader 4' };
// Each character: [which of the loaded speakers they prefer (an index into that list, wrapping,
// so more speakers give more voices), pitch]. A word their speaker didn't record is said by one who did.
// The player's own words (spells, the word book) use speaker 0.
export const VOICE = {
  yay: [0, .94], kru: [1, 1], aunt: [2, 1.02], tuot: [3, .88], sok: [4, 1.08], kid: [5, 1.18], vendor: [2, 1.04],
  ta: [1, .9], fisher: [3, .97], monk: [4, .86], jang: [5, 1.02], gas: [0, 1.06], che: [2, 1.06], hia: [3, 1.04],
  ee: [4, .96], chief: [5, .94], farmer: [0, .98], thief: [3, 1.08], tacha: [1, .9],
};
