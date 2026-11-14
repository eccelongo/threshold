# PROJECT 001 — Sound

Each room plays two looping stems that start together and stay in sync:

- **BED**: the room's sustained composition (drones, harmony, space).
- **MOTION**: its rhythm or texture. The visitor's presence modulates it: getting closer, scrolling, turning the Room III sculpture, opening the door, the monolith slices.

| Room (site) | Composition | Files |
|---|---|---|
| I · Entrance | The Frequency | `rooms/entrance-bed.flac`, `rooms/entrance-motion.flac` |
| II · Manifesto | The Pulse | `rooms/manifesto-*.flac` |
| III · Experiments | The Mutation | `rooms/experiments-*.flac` |
| IV · Exit | The Pause Before | `rooms/exit-*.flac` |
| VI · Threshold | The Interruption | `rooms/threshold-*.flac` |
| VII · The Unknown | The Disorientation | `rooms/unknown-*.flac` |
| VIII · Ascension | The Expansion | `rooms/ascension-*.flac` |
| IX · Interruption | The Suspension | `rooms/interruption-*.flac` |
| X · Dissolution | The Unmaking | `rooms/dissolution-*.flac` |
| Coda · The Loop | The End Is the Beginning | `rooms/loop-*.flac` |

## Replacing a track with a studio-produced one

1. Export the stem as a loop of any length. For a seamless loop, render the reverb tail back onto the start.
2. Either overwrite the file with the same name, or change its path in `SOUND_MAP` near the top of the sound script in `index.html`. WAV, FLAC, MP3, M4A/AAC and OGG all work. For perfect loops, prefer WAV or FLAC: MP3 and AAC add a few milliseconds of silence at the edges.
3. Keep levels consistent. The drafts sit around **−21 dBFS RMS for beds** and **−23 dBFS RMS for motion stems**, with peaks at −1 dBFS.
4. If you have only one file for a room, use it as the bed and point `motion` to a short silent file, or to the same file.

The player:
- crossfades rooms over about 3 s;
- loads files only when they are needed, preparing the next room in advance;
- frees rooms that have gone silent.

In the Coda, crossing the ring blends the loop's sound into the Entrance, so the return is continuous. A missing file is silent: nothing is synthesised to replace it.

`MOTION_RANGE` in `index.html` sets how much of each room's motion stem plays at rest and at full intensity.

## The current files are drafts

The current files are drafts, rendered by `tools/compose/compose.js` (offline Web Audio: granular synthesis, modal metal, tape wow, time-stretching, convolution halls). They are placeholders for real productions.

To re-render them:
1. Run `python3 -m http.server 4173` and `python3 tools/compose/save_server.py`.
2. Open http://localhost:4173/tools/compose/ and click **Render all rooms**.
3. Convert the results with `for f in audio/rooms/*.wav; do afconvert -f flac -d flac "$f" "${f%.wav}.flac"; done`.
