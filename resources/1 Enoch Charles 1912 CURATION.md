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
| 259 | 144 | 71:8–13 | `[Lost passage …]` is an unnumbered bracketed paragraph after 13 — curated as a Heading on 71:14; **71:11 opens `. . . with the spirit of power`** — the lacuna the PG text drops was added |
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

## Footnote transcription (ticket 146)

Every atom that carries a `marks` or `emended` span was read against the
1912 page image and Charles's note on that mark transcribed into a
`[Footnote: …]` marker at the mark (295 notes on 257 atoms), or waived in a
`%% waived C:V — reason` line beside the atom where the page gives the mark
no note of its own (19 waivers: 2:1, 2:3, 5:3, 5:5, 10:13, 14:25, 15:6, 15:12,
60:24, 69:12, 69:16, 69:25, 71:3, 72:6, 73:7, 76:12, 89:25, 99:3, 103:10).
Leaves read per chapter (leaf = page + 115):

| Chapter | Leaves |
| --- | --- |
| 1 | 119, 120, 121, 122, 123 |
| 2 | 124 |
| 3 | 125 |
| 5 | 125, 126, 127 |
| 6 | 130, 131 |
| 8 | 133, 135 |
| 9 | 135, 136 |
| 10 | 137, 138, 139, 140, 141 |
| 11 | 141 |
| 12 | 143, 144 |
| 13 | 144, 145, 146 |
| 14 | 147, 148, 149, 150 |
| 15 | 150, 151, 152 |
| 16 | 152, 153 |
| 17 | 153, 154 |
| 18 | 154, 155, 156, 157 |
| 19 | 157 |
| 20 | 158 |
| 21 | 160 |
| 22 | 161, 162, 163, 164, 165 |
| 23 | 166 |
| 24 | 167 |
| 25 | 167, 168, 169 |
| 26 | 169, 170 |
| 27 | 170, 171, 172 |
| 28 | 172 |
| 29 | 173 |
| 30 | 173 |
| 31 | 173, 174 |
| 32 | 175, 176 |
| 34 | 177 |
| 35 | 177 |
| 36 | 177, 178 |
| 37 | 184, 185 |
| 38 | 186 |
| 39 | 189, 190, 191 |
| 40 | 193 |
| 45 | 199 |
| 46 | 201, 203, 204 |
| 47 | 205, 206, 207 |
| 51 | 215 |
| 52 | 218 |
| 53 | 219 |
| 54 | 222, 223 |
| 55 | 223 |
| 56 | 225 |
| 58 | 227 |
| 59 | 227, 228 |
| 60 | 228, 229, 230, 231, 232, 233, 234 |
| 62 | 238, 240 |
| 63 | 242 |
| 65 | 246 |
| 66 | 247 |
| 67 | 248, 250 |
| 68 | 251 |
| 69 | 251, 252, 253, 254, 255, 256 |
| 71 | 257, 258, 259, 260 |
| 72 | 267, 268, 269, 270 |
| 73 | 273 |
| 74 | 275, 276, 285 |
| 75 | 277 |
| 76 | 278, 279, 280 |
| 77 | 280, 281 |
| 78 | 283, 284 |
| 79 | 285 |
| 80 | 286, 287 |
| 82 | 290, 291, 292 |
| 83 | 298 |
| 84 | 299, 300 |
| 86 | 303 |
| 89 | 308, 309, 310, 311, 312, 313, 316 |
| 90 | 319, 320, 323, 325, 326, 327, 328, 329, 330, 331 |
| 91 | 341, 342, 343 |
| 92 | 339 |
| 93 | 343, 344, 345, 346, 347 |
| 94 | 349, 350 |
| 95 | 351 |
| 96 | 352, 353, 354 |
| 99 | 359, 360, 361, 362 |
| 100 | 365 |
| 101 | 367, 368 |
| 102 | 368, 369 |
| 103 | 373 |
| 106 | 379, 380, 381, 382, 383 |
| 108 | 385 |

Conventions the transcriptions follow:

- Charles's wording, sigla (Gᵍ, Gˢ, E, α, β, MS letters), Greek and Hebrew
  are kept; superscript verse references are written with Unicode
  superscripts (5⁴, 89⁷⁰, ⁷¹); Charles's `+` (adds) and `>` (omits) stay.
- A note's own square brackets are written fullwidth `［ ］`, because `]`
  closes the marker (README §Footnotes); `< >` never occur in a note.
- Where a note runs on for a column or more, only the part that bears on
  the mark is transcribed and the cut is marked ` … ` (so 13:6, 22:2, 54:10,
  65:10, 90:14, 51:4). A note that explains a run of marked verses (39:1–2,
  59:1–3, 69:2–3, 69:22–24, 93:11–14, 91:12–17) stands on each verse of the
  run; a note Charles gives once for a repeated emendation (22:9–13 "And
  this", 69:4–5 "Sons of God", 77:1–3 "quarter") is repeated verbatim on
  each atom, and where he himself writes "see note on ver. 4" (101:9) that
  is the note.
- Notes on the E / Gᵍ columns (22, 27, 32) anchor on the column whose text
  the note names.

Page-driven text fixes made while transcribing: **17:1** the reprint's
`⌈and⌉ brought` closes on `brought` in 1912 (`⌈and brought⌉`, leaf 153);
**91:19** prints `for ever` in plain type in 1912 (leaf 343), so the
reprint's thick type — an `<emended>` the PG text alone had — was dropped
(103 emended atoms, not 104). **99:3** prints a thick `a` (leaf 359) that
no note explains and stays waived.

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
- **`[Lost passage …]` (71, between 13 and 14)** is Charles's note, not a
  verse: it is a `###` Heading on 71:14 (furniture beside the grid, §1), its
  brackets and `(as in 46³)` plain text, so `{1 Enoch 71:13}` cites only
  the translation.
- **Column labels `E` / `Gᵍ` are stored text** (searchable, highlightable):
  the spec has no furniture that can stand inside a verse's lines, and a
  Heading attaches to one atom, which a column of 22:9–14 is not. Flagged
  for the spec owner with 39:6b/7b and 1:2.
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
