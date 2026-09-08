# Editorial-marks reader prototype — NOTES

**Question** ([Prototype an editorial-marks reader](https://github.com/chfourie/obsidian-bible-study/issues/116)): how should **editorial marks** *feel* in the reader?

**Run:** open `index.html` in any browser. Switch variants with the floating bar or ←/→ (`?variant=A|B|C`). Tune supplied / marks opacity in Options. Light/dark in the toolbar.

Implements [What two-layer is](https://github.com/chfourie/obsidian-bible-study/issues/115) / [ADR 0006](../../docs/adr/0006-editorial-marks-in-the-atom.md): one stored string, no hide toggle. Supplied delimiters already gone; remaining glyphs stay; thick type is weight.

**Passage:** Charles 1912 *1 Enoch* I.1–I.9 (PG #77935, glyphs normalized to 1912 ⌈⌉ / ⌈⌈⌉⌉). I.4 carries supplied *even* and interpolation `[And appear from His camp]`. **II.2** is appended so thick type (`steadfast`) can be judged with accent+italic — I.1–9 has none.

## Variants

- **A — Quiet book.** Winning book-reader typography (serif, centered chapter, gutter verse numbers on hover). Marks recede. Default opacities low. Tooltip on a mark glyph names Charles’s key. **Winner.**
- **B — Margin key.** Same stored string and paints, denser defaults. Each verse grows a right-hand rail listing the mark *kinds* present (not a hide, not a second layer). Tests whether the apparatus wants to be noticed.
- **C — Scripture column.** Existing scripture-reader shell: sans, verse-per-line, inline superscript numbers. Same paints. Tests whether book typography vs verse column changes how the combo reads.

Shared: no apparatus toggle. Opacity sliders (prototype chrome). Emended = bold, not accent.

## What to react to

Density of ⌈⌉ in **1:9**. Default opacities. Whether accent glyphs + italic supplied + bold emendation stay readable together, especially on **1:4** and **2:2**.

## Verdict (final — ticket #116 resolved)

- **Structure: A.** Quiet book page. No margin key (B). Not the scripture column (C).
- **Opacities:** supplied **0.5**, marks **0.3**. Emended stays full-weight, unfaded, un-accented.
- **Combo:** accent glyphs + italic supplied + bold emendation readable together (1:4, 2:2). 1:9 density acceptable at marks 0.3.
- Supplied 0.5 is the existing **global** supplied setting (scripture + Books). Marks 0.3 is the second, marks-only setting.
