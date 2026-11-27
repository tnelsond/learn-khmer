## Learn the Khmer Alphabet
A game inspired by Logical Journey of the Zoombinis and also Alchemy.

## Todo
- <strike>Basic logic and rendering</strike>
- Make levels
- Make animations
- Make plots
- Make saves
- Make Achievements

## Lao version
`lao/index.html` is the same game adapted for the Lao alphabet: the 27 consonants arranged by mouth position and class (mid / high / low), the silent-ຫ letters, vowel signs that sit before, after, above and below, and simple first words. `lao/tolao.py` regenerates it from `aksaw/index.html`, so changes to the Khmer game can be carried over.

## Village of Words (ភូមិពាក្យ)
`village/` is a 3D open-world game in the spirit of Myst: you wake up in a Cambodian village and learn Khmer to find out why you're there. Words you type on a Khmer keyboard become spells. It has quests, a market with riel and Khmer numbers, a town with a mechanic and petrol station, and a motorbike to ride. Some characters let you tap words for their gloss; others speak only Khmer. Pronunciation (G2K) and audio (kheng.info) come from [peakslab_sources](https://github.com/tnelsond/peakslab_sources). Serve the repo from any web server and open `village/index.html`; it installs as a PWA and works offline.

`tools/build_village_audio.py` regenerates `village/audio.js` from `village/content.js` (set `PEAKSLAB_KHMER` to your `peakslab_sources/khmer` checkout; needs ffmpeg).

## Village of Words: Lao (ບ້ານແຫ່ງຄຳສັບ)
`lao-village/` is the same game adapted to Laos: a village on the Mekong, Lao kinship terms, prices in kip, Lao numerals and a Lao keyboard. It is generated from the Khmer game by `tools/village_to_lao.py village/ lao-village/` (engine only; `lao-village/content.js` holds the Lao story, dialogue and vocabulary).

Audio is played through PeakSlab's own engine: `lao-village/peakaudio.js` loads `peak.wasm` (finds a word's recordings in the Lao audio slab) and `tnefar.wasm` (makes the speech), from peakslab.org when the page can reach it, so new recordings show up without rebuilding, and otherwise from the copies in `lao-village/` (`lao/aux/lo-audio-tnefar.slab`). The slab has two speakers (thesaurus.la and the Lao Bible reader); each character prefers one of them and has their own pitch (`VOICE` in the generated game.js, set in `tools/village_to_lao.py`), falling back to whoever recorded the word. Words the slab doesn't have yet play a clip cut from a longer recording (`lao-village/audio.js`, made by `tools/build_lao_village_audio.py`), else the device's Lao voice. `lao-village/audio-check.html` plays every word in each speaker's voice.
