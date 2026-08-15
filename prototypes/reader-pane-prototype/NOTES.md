# Reader pane prototype — NOTES

**Question** ([wayfinder ticket #6](https://github.com/chfourie/obsidian-bible-study/issues/6)): what should the reader pane look and behave like?

**Run:** open `index.html` in any browser. Switch variants with the floating bar, `?variant=A|B|C`, or ←/→ keys. Mock data only (John 15; public-domain/approximate text).

## Variants

- **A — Book**: immersive prose paragraphs, superscript verse numbers, top toolbar (book/chapter selects, chapter steppers, translation pills). Clicking a verse opens a bottom sheet with the multi-translation stack + annotation/intersecting-note cards. Annotation/intersection markers as tiny superscript dots.
- **B — Study split**: verse-per-line list with a gutter (verse number + annotation ●/intersection ◆ icons), persistent right side panel with Translations/Notes tabs for the selected verse. Breadcrumb nav on top, prev/next chapter footer.
- **C — Tree + inline expand**: Obsidian-explorer-style book/chapter tree on the left; verse-per-line main area; clicking a verse expands an inline accordion with a translation comparison table + note cards. Translation pills as tabs on top.

All variants share: current-passage highlight (vv. 4–7, left border + tint), entry-context banner ("opened from `{John 15:4-7 web callout}`"), per-verse annotation (●, amber) and intersecting-note (◆n, blue) indicators, copyright attribution line.

## Verdict

_(pending — fill in which variant/mix won and why, then delete this folder)_
