# Reader pane prototype — NOTES

**Question** ([wayfinder ticket #6](https://github.com/chfourie/obsidian-bible-study/issues/6)): what should the reader pane look and behave like?

**Run:** open `index.html` in any browser. Mock data only (John 15; public-domain/approximate text).

## Revision 2 — decided direction

The original A/B/C variant carousel is gone. User verdict on round 1: single layout (variant C's shell) with **three independent user toggles**, each with a globally configured default plus in-pane switching:

1. **Details** — reference material (other translations + notes) as *inline expand* under the clicked verse, or in a persistent *right side panel* (Translations/Notes tabs).
2. **Nav** — book/chapter picker as *left tree panel* (Obsidian-explorer style) or *breadcrumb top links* ("John › 15", click to change) with prev/next chapter steppers.
3. **Layout** — *verse-per-line* or *continuous* prose; continuous respects paragraph (pericope) structure when the data provides it (mock: paragraphs at vv. 1, 5, 9, 12, 16).

Shared everywhere: current-passage highlight (vv. 4–7), entry-context banner ("opened from `{John 15:4-7 web callout}`"), per-verse annotation (●, amber) / intersecting-note (◆n, blue) indicators, translation pills, copyright attribution line.

## Verdict (final — ticket #6 resolved)

- Single layout (C's shell) with the three toggles above; per-toggle global defaults live in plugin settings, in-pane switching always available.
- Multi-translation verse view: **stacked** (translation label + text, one under another).
- Indicators: **as prototyped** — ● (annotation, amber) / ◆n (intersections, blue) trailing the verse text.
- Entry points: nav icon on rendered `{reference}` (opens at that passage) **+ command palette entry + ribbon icon** (both open at last position).

Prototype kept as the visual reference for spec assembly (#13); delete this folder when the map closes.
