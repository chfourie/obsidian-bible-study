# Book reader prototype — NOTES

**Question** ([wayfinder ticket #54](https://github.com/chfourie/obsidian-bible-study/issues/54)): what does the reader look like for a prose book with no verse grid?

**Run:** open `index.html` in any browser. Switch variants with the floating bar or ←/→ keys (`?variant=A|B|C`). Mock data: *Humility* (Andrew Murray, 1895) Preface + Chapter I, public domain, from PG #57121.

## Variants

- **A — Scripture parity.** The book slots into the existing reader shell unchanged: the nav tree gains a **Books** group after the NT (chapters as a 0–16 number grid, section names as tooltips), title reads `Humility 1 — The Glory of the Creature`, prose with inline superscript paragraph numbers exactly like continuous scripture layout, epigraph as an italic lead paragraph.
- **B — Book reading mode.** Sidebar is a named-section table of contents (Preface / I–XII / Notes / Prayer) with printed numbers; serif book typography, centered chapter heading + epigraph; paragraph numbers live in the margin gutter and appear only on hover/selection; footer prev/next by section name.
- **C — Breadcrumb edition.** No sidebar: breadcrumb row `Humility › [section-name dropdown]` with prev/next; always-visible margin-gutter paragraph numbers (classic edition style); left-aligned epigraph with em-dash attribution.

## Shared across variants (also under evaluation)

- **Toggle set:** Options menu keeps Nav and font size, adds **Para numbers (On/Hover)**; Layout (verse-per-line), Red letter, and Strong's are *hidden* for books, not disabled.
- **Edition pill:** the translation-pill slot shows a single non-switchable `Humility 1895` pill.
- **Study Panel paragraph details:** header = chip locator (*Humility* ch. 1, par. 6) + full Chicago-style citation; Passage tab shows the paragraph itself (no Translations tab, no stacked versions); actions include **Copy formatted reference** (`{Humility 1:6}`, per #53's sideline); intersecting notes render as for scripture.
- **Live scripture refs** in book text (epigraph source, inline `(Phil. 2:8)`) styled as accent links — behavior is ticket #58's question, only the look is shown here.
- ● annotation / ◆n intersection markers on paragraphs, attribution line at chapter foot.

## Verdict (final — ticket #54 resolved)

- **Typography: variant B wins** — serif book typography, centered `CHAPTER n` + small-caps title, centered epigraph, justified prose, margin-gutter paragraph numbers (Hover default).
- **Nav: not a variant choice** — books reuse the scripture reader's existing Nav toggle (global default + in-pane switch). Tree side = **B's named-section TOC** (the book's own contents; explicitly *not* A's Books-group-with-chapter-grid inside the scripture tree); breadcrumb side = C's `Humility › [section dropdown]` row.
- **New decision (applies to scripture reading too): reader option defaults split per device class** — separate desktop and mobile global defaults. Rationale: left-hand TOC/tree preferred on desktop, breadcrumb fits mobile's limited space.
- Shared elements accepted as prototyped: toggle set (Nav + font size + Para numbers On/Hover; Layout/Red letter/Strong's hidden), single non-switchable edition pill, Study Panel paragraph details (locator + full citation + paragraph, no Translations tab), Copy formatted reference action, live-styled epigraph/inline scripture refs (behavior = #58).

Prototype kept as the visual reference for spec assembly (#57); delete this folder when the map closes.
