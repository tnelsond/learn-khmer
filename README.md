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

## Village of Words (ភូមិពាក្យ · ບ້ານແຫ່ງຄຳສັບ)
`village/` is a 3D open-world adventure for learning **Khmer or Lao** — pick the language on the title screen (or open `village/index.html?lang=lo`). You wake under a stilt house, learn your first words from your grandmother, and words you type on the on-screen keyboard become spells. It has quests, a market with money and spoken numbers, a town with a mechanic and petrol station, a motorbike, and hidden word stones.

After the temple, the story opens up like a Zelda game: a vision of your grandmother's spirit and the Yak (យក្ស / ຍັກ), the giant who stole the land's three gems. The monk gives you a sword, and three shrines each hold a gem, a puzzle, a boss and a new word of power:
- the Crocodile Cave on the far river bank — fill the basins with water, freeze the crocodile with *stop*; you win *protect* (a shield)
- the Forest Ruins past the rice fields — burn the thorns, light the braziers, cross the fire walls with *protect*, scare the tiger with *fire*; you win *wind*
- the Mountain north of Mango Village — blow away the cloud and fog with *wind*, climb the vines, ground the eagle with *wind*; you win *open*
Each gem adds a heart. *Open* unlocks the chests hidden around the world and the Yak's black gate behind the temple hill, where the last fight ends with the word your grandmother carved.

The graphics follow the Bible game (`leap/`): N64-style low-resolution rendering, a coarse vertex-coloured sky, tiny bilinear textures, and the same low-poly people and animals (`village/lowpoly.js` is taken from `leap/game.js`), with a third-person camera outdoors and first person inside houses.

Files:
- `i18n.js` — the translations file: each language's script, keyboard, digits, number words, money, fonts, audio slabs and character voices, plus the Lao versions of the Khmer text in `game.js` (wrapped in `tr(...)`).
- `content.js` / `content-lo.js` — each language's world: vocabulary with glosses, spells, characters, dialogue, word stones, shops, enemies, and the quest's words (`EPIC`).
- `audio.js` / `audio-lo.js` — fallback clips and pronunciations for words the PeakSlab slabs don't have.
- `game.js` — the engine and the quest; `lowpoly.js` — models and textures; `peakaudio.js` — PeakSlab's audio engine.

Audio is played through PeakSlab's own engine: `peakaudio.js` loads `peak.wasm` (finds a word's recordings in the audio slabs) and `tnefar.wasm` (makes the speech), from peakslab.org when the page can reach it, so new recordings show up without rebuilding, and otherwise from the copies in `village/khmer/aux/` and `village/lao/aux/`. Khmer has six speakers (kheng.info, the Khmer audio slab and four Bible readers; each voice's postfilter comes from `km-postfilters.slab`), Lao three (thesaurus.la and two Bible readers). Each character prefers one speaker and has their own pitch (`voice` in `i18n.js`), falling back to whoever recorded the word, then a fallback clip, then the device's own voice. `village/audio-check.html?lang=km` (or `lo`) plays every word in each speaker's voice.

`tools/build_village_audio.py` regenerates `village/audio.js` from `village/content.js` (set `PEAKSLAB_KHMER` to your `peakslab_sources/khmer` checkout; needs ffmpeg); `tools/build_lao_village_audio.py` makes `village/audio-lo.js`. `lao-village/` now just forwards to `village/?lang=lo`.

