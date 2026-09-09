# Book-footnotes reader prototype — NOTES

**Question** ([How Book footnotes appear in the reader](https://github.com/chfourie/obsidian-bible-study/issues/127)): how do attached Book **footnotes** appear in the reader and in notes?

**Run:** open `index.html` in any browser. Switch variants with the floating bar or ←/→ (`?variant=A|B|C`). Light/dark in the toolbar. In the mock vault note, flip Chip / Inline / Block.

Host page is the winning quiet book from [Prototype an editorial-marks reader](https://github.com/chfourie/obsidian-bible-study/issues/116): serif, centered chapter, editorial marks already painted. Footnotes ride Humility’s existing channel (`footnotes: [{start, text}]`) — lifted out of stored text, no id, never a `{…}` address, never a Hit.

**Passage:** Charles 1912 *1 Enoch* I.1–I.9. Notes are shortened from Charles’s APOT apparatus (public domain) so density is real: almost every verse has one; **1:9** has two long ones. **1:6** has none (empty case). A sparse Humility footnote sits in the mock note for contrast.

## Variants

- **A — Study Panel, no marker.** Verse page is unmarked. Select a verse; its footnotes list in the Study Panel. Notes (chip / inline / block) never show a marker or a body. Quietest page; Charles density is a panel problem, not a page problem.
- **B — Under the atom.** Superscript marker at the channel `start`; the body prints under that verse, always. Notes `block` prints the same apparatus under the atom; `inline` keeps the marker and drops the body; chip is unmarked.
- **C — Popover.** Same marker. Tap (or click) opens a popover on the lemma; closed by default. Notes: marker in inline and block, same popover; chip unmarked.

Shared: no new citation grammar. Footnotes are not editorial marks. Default visibility is the variant itself (A = off the page, B = always on, C = marker on / body closed).

## What to react to

Whether 1:9’s two long notes wreck the quiet page in B. Whether A’s lack of a marker makes footnotes undiscoverable. Whether a popover in C is enough for apparatus you actually read. What chip / inline / block should do — show, suppress, or marker only — and whether Humility’s one-liner and Charles’s density can share that rule.

## Verdict (final — ticket #127 resolved)

- **Structure: A.** No marker. Body in the Study Panel when the atom is selected. Chip / inline / block suppress marker and body.
- **Rejected:** B (under-verse apparatus) and C (popover). No mix — not C’s marker on A’s body.
- Dense (1 Enoch) and sparse (Humility) share the rule. No On/Hover/Off; placement is the default.
- [ADR 0012](../../docs/adr/0012-book-footnotes-surface-in-the-study-panel.md).
