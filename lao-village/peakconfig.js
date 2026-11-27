// Where the Lao words' recordings come from, and who speaks with which voice.
// PeakSlab's Lao audio slab (peakslab.org/lao/aux/), newest from peakslab.org where the page may
// fetch it, else the copy beside the game.
export const PEAK = {
  sources: ['https://peakslab.org/', './'],
  slabs: [{ name: 'lao', path: 'lao/aux/lo-audio-tnefar.slab', bufmax: 1 << 20 }],
  postfilters: null,
};
export const SPEAKER_NAMES = { 'lao:': 'thesaurus.la', 'lao:1': 'Lao Bible reader' };
// Each character: [which of the loaded speakers they prefer (an index into that list, wrapping,
// so more speakers give more voices), pitch]. A word their speaker didn't record is said by one who did.
export const VOICE = {
  yay: [0, .94], kru: [1, 1], aunt: [0, 1.02], tuot: [0, .88], sok: [0, 1.1], kid: [0, 1.18], vendor: [0, 1.04],
  ta: [1, .9], fisher: [1, .97], monk: [1, .86], jang: [1, 1.03], gas: [0, 1.06], che: [0, 1.07], hia: [1, 1.05], ee: [0, .96],
  chief: [1, .94], farmer: [1, 1], thief: [1, 1.08], tacha: [1, .9],
};
