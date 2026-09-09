# 1 Enoch (Charles 1912) — curation notes

Companion to `1 Enoch Charles 1912.md`. The build source is the PG #77935
plain text beside it (the SPCK 1917 reprint of the 1912 translation); the
verification authority is the 1912 Clarendon page scan, Cornell copy
`cu31924067146773` on the Internet Archive. A page image is fetched as
`https://iiif.archive.org/iiif/cu31924067146773$<leaf>/full/1200,/0/default.jpg`
(a region: `…$<leaf>/pct:x,y,w,h/1200,/0/default.jpg`); **leaf = printed page
+ 115** through the translation. The IA `_djvu.xml` lists every leaf's OCR
words, which is how a verse is located by phrase before the image is opened.

## How the source was made

1. `node scripts/enoch-pipeline/convert-pg77935.mjs <pg77935.txt> <draft.md>`
   turns the PG body (from the `THE BOOK OF ENOCH / I-XXXVI.` head to
   `PRINTED IN GREAT BRITAIN`) into curated Markdown mechanically: chapter
   heads, the seven Part labels, Charles's italic and bold heads as `###`,
   `N.` / `Na.` prefixes in page order, the glyph map, the three wrappers.
   The aid logs what it could not settle (page-order jumps, wraps read by
   hand, lines joined under a letter) to stderr.
2. Chapters 1–5 were kept as the tracer curated them by hand (ticket 139,
   wrapped in 141) — the draft of 1–5 differs only in wraps.
3. Hand fixes below were applied to the draft; the result is the source.

## Glyph map (PG → 1912 print)

`⌜ ⌝` → ⌈ ⌉ · `〚 〛` → ⌈⌈ ⌉⌉ · `‹ ›` → 〈 〉 · `[ ]` and `†` and `...` (→ …)
stay, each glyph in its own `<marks>` · `( )` → `<supplied>` with the
parentheses dropped · `=thick=` → `<emended>` · `_i. e._` → plain ·
`46^3` → 46³ · the column labels `E` / `G^g` → `E` / `Gᵍ`.

## Page-image verifications (leaf · what was checked)

| Leaf | Page | Verse(s) | Result |
| --- | --- | --- | --- |
| 119 | 4 | I-V head, 1:1 | ⌈⌈and⌉⌉, ⌈⌈and godless⌉⌉ confirmed; head text confirmed |
| 120 | 5 | 1:2–4 | 1:3 lead-in + poem line, `(even)` confirmed; **1:2 prints single ⌈which⌉ in 1912** where the reprint (and spec §10) has ⌈⌈which⌉⌉ — kept double, see Decisions |
| 121 | 6 | 1:4–6 | `[And appear from His camp]` interpolation brackets, ⌈of heavens⌉, tristichs confirmed |
| 122 | 7 | 1:6–9 | ⌈wholly⌉, `(men)`, 1:8 three tristichs with stanza gaps, ⌈all⌉, both ⌈And He …⌉ lines, ⌈His⌉ confirmed |
| 123 | 8 | 1:9, 2:1 | second tristich of 1:9 and its four bracket pairs confirmed |
| 124 | 9 | 2:1–3 | ⌈and⌉; 2:2 ⌈how **steadfast** they are⌉ thick type inside the bracket, ⌈none…earth⌉, ⌈but⌉, ⌈to you⌉; 2:3 ⌈⌈how the whole earth…it⌉⌉ confirmed — the PG ⌜⌝ / 〚〛 map holds |
| 126 | 11 | 5:4–6a | lineation and ⌈the years of your destruction⌉ confirmed |
| 127 | 12 | 5:6b–7b | page order 6a b c 7c / 6d e f g / 6i j 7a b confirmed; **stanza gap between 6g and 6i added** (the tracer had none) |
| 162 | 47 | 22:2–4 | parallel E / Gᵍ columns confirmed; thick `hollow`, `the hollow places`, `have been made`, `[till the period appointed]`, `(comes)` confirmed |
| 163 | 48 | 22:5–8 | 〈the spirit of〉, thick `a dead man`; **22:8 E prints thick `hollow places`** where the PG text has italics — curated as `<emended>` |
| 185 | 70 | 38 head | chapter opens `1. The first Parable.` with no roman numeral; both heads confirmed |
| 230 | 115 | 60:6–8 | **verse 25 printed after 60:6** as `25.` (the PG text reads `5.`) — curated as 25, page order kept as the reading walk; †Dûidâin† confirmed |
| 259 | 144 | 71:8–13 | `[Lost passage …]` is an unnumbered bracketed paragraph after 13 — curated as a second line of 71:13; **71:11 opens `. . . with the spirit of power`** — the lacuna the PG text drops was added |
| 326 | 211 | 90:13–17 | doublets set in two columns (13 ‖ 16, 19 full width, 14 ‖ 17) — prose, page order kept |
| 339 | 224 | 92 head, 92:1–3 | `XCII. XCI. 1-10, 18-19. …` head and `[Enoch indeed … earth]`, `(which is)`, `[Shall arise]` confirmed |
| 340 | 225 | 91 head, 91:1–4 | `XCI. 1-11, 18-19. …` follows 92:5 on the page; lineation confirmed |
| 343 | 228 | 91:18–19, 93 head, 93:1 | `XCIII, XCI. 12-17. …` head; †gave† confirmed |
| 347 | 232 | 93:12–14, 91:12–14d | `rest?]` closing the 93:11–14 bracket; `XCI. 12-17. The Last Three Weeks.` head; 14d before 14a confirmed |
| 349 | 234 | 91:17, 94 head, 94:1–5 | `XCIV. 1-5. …` head and lineation confirmed |
| 381–382 | 266–267 | 106:8–15 | 17 printed between 14 and 15 confirmed (Charles's note: "restored to its original place"); the 1912 Latin column is not in the reprint and not curated |
| 384 | 269 | 107:1–3, 108:1–3 | chapters present; `(this)`, `(them)`; 1912 prints no "Appendix" head in the body (SPCK's) |
| 385 | 270 | 108:3–7 | thick `in the fire shall they burn`, †look over†, `(even)` confirmed |
| 388 | 273 | after 108 | Appendix I (Greek) follows 108:15 directly — no chapter 109 |

## Decisions the next curator should know

- **Sections stand 1–108 in numeric order** (ADR 0014). Chapter 91's three
  printed fragments (1–11, 18–19 after 92; 12–17 after 93) are one section
  in verse order; the heads on 92:1, 91:1, 93:1, 91:12 record the page.
- **Part labels** are the seven groups of spec §1, worded after the print's
  running heads where it has one (`The Book of the Courses of the Heavenly
  Luminaries`, `The Dream-Visions`, `Fragment of the Book of Noah`, `An
  Appendix to the Book of Enoch`) and the conventional name where it does
  not (`The Book of the Watchers`, `The Parables`, `The Epistle of Enoch` —
  the print says "The Concluding Section of the Book (XCII-CV)").
- **Every section is unnamed** (`## N.`). Charles's heads, including the
  ones that name a single chapter, are `###` Headings on the verse they
  precede, so the tree and Title Bar show numbers alone.
- **Parallel columns** (22:2, 5–6, 8, 9–14; 27:3–5; 32:1, 3): each column is
  two lines of the verse — its printed label `E` / `Gᵍ` and its text — so a
  single verse reads E then Gᵍ, and the chapter reading walks the columns
  as the page has them (E's 9–14, then Gᵍ's 9–14).
- **Lines under one letter are stored as one lettered line**: Charles's
  letters label half-verses, and the parser admits no unlettered line after
  a lettered one. Affected: 39:6b (two printed lines), 39:7b (five, across a
  stanza gap). Their internal breaks are lost; the letters survive.
- **Within-chapter dislocations stay in page order** as reading walks: 5:7c,
  39:6–7, 51:5a, 60:25, 89:48b, 90:13–19, 91:14d, 97:9d/9c, 106:17.
- **`( )` is always supplied**, including Charles's glosses `(lit. …)`,
  `(i. e. …)` and the query `(?)` in 31:2 — the key gives the parentheses
  one meaning and the pipeline one channel.
- **`[Lost passage …]` (71, between 13 and 14)** is a second, unlettered line
  of verse 13, its brackets marks.
- **The SPCK editors' bracket** before 52 (`[Only six are mentioned … —EDD.]`)
  is not Charles's and was dropped.
- **1:2 keeps ⌈⌈which⌉⌉** although the 1912 page prints single corners:
  spec §10 names the double bracket as the example, the reprint has it, and
  Charles's own note ("Gᵍ reads corruptly 'he showed me'") makes the words
  an E-only reading, which is what ⌈⌈ ⌉⌉ means. Flagged for the spec owner.
- Not checked against the page: chapters 6–21, 23–37, 40–59, 61–70, 72–89
  beyond the rows above; the reprint's punctuation is kept as the build
  source's even where the 1912 page differs in a stop (92:1 `earth.` vs
  `earth;`).
