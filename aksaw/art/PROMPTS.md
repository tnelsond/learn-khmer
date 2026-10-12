# Background art for Khmer Letter Critters

The game looks for these files and uses them instead of its built-in painted backgrounds.
Any file that is missing falls back to the built-in watercolor backdrop, so you can add them one at a time.

**Files** (JPG, 16:10 landscape, ideally 1920×1200):

| file | what |
|---|---|
| `scene_0_water.jpg`, `scene_0_cliff.jpg`, `scene_0_forest.jpg` | Angkor Wat at sunset |
| `scene_1_*.jpg` | Mekong River, dusk, stilt houses |
| `scene_2_*.jpg` | Rice fields, blue morning |
| `scene_3_*.jpg` | Pagoda (golden Khmer wat), bright day |
| `scene_4_*.jpg` | Night market with lanterns |
| `scene_5_*.jpg` | Jungle temple (Bayon-style stone faces in the trees) |
| `map.jpg` | The journey map |
| `lab.jpg` | The Letter Lab |

`*` = `water`, `cliff`, `forest` (see the terrain notes below).

## Style (add to every prompt)
Traditional watercolor painting on cold-press paper, loose wet-on-wet washes, soft bleeding edges, visible paper grain,
unpainted white paper highlights, a few thin dark ink lines, bright cheerful colors, children's storybook illustration.
No text, no letters, no people, no characters, no UI.

## Layout (important)
Characters and bridges are drawn on top, so keep these zones calm and uncluttered:
- Top half (0–50% height): sky and landmark. Keep the top ~12% quiet, the game's text sits there.
- A central strip, about 26%–74% of the width, from 52% height to the bottom: the crossing area. Plain and low contrast.
- Left and right of the strip (0–25% and 75–100%): banks with grass or ground. The left bank is where the letters wait.

## Terrain (what the central strip is)
- `water`: a river or pond channel with gentle ripples and reflections.
- `cliff`: a deep misty chasm between two cliff edges, clouds drifting in the gap.
- `forest`: a mossy forest floor with ferns and dappled light, no water.

## Prompt template
"<scene description>, wide 16:10 composition, <terrain description> in the central lower strip, grassy banks left and right,
open calm sky at the top. <style paragraph>"

## Map and Lab
- `map.jpg`: a hand-painted storybook treasure map of Cambodia-like countryside seen from above at an angle: green fields,
  a winding blue river, a lake on the upper right, soft clouds, paper edges. Keep the middle open for a ring of path stops.
- `lab.jpg`: the inside of a cozy scholar's workshop painted in watercolor: warm wooden wall and shelves, soft lamp glow,
  muted and low contrast because panels cover most of it.
