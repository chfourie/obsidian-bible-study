# "Humility: The Beauty of Holiness" (Andrew Murray, 1895) — Source Text Research

Research for building a book module (precedent: the BSB translation module built repo-side and shipped as a GitHub release artifact). Date: 2026-08-20. All claims cite the primary source consulted; unverified points are flagged inline.

## Summary & Recommendation

- **Build from Project Gutenberg eBook #57121** ([gutenberg.org/ebooks/57121](https://www.gutenberg.org/ebooks/57121)) — the plain-text UTF-8 file ([pg57121.txt](https://www.gutenberg.org/cache/epub/57121/pg57121.txt), ~131 kB). It is the only hand-produced (non-OCR) complete digitization found: Preface, all 12 chapters each with title + scripture epigraph, three bracketed footnotes, back-matter **Notes A–C** and **"A Prayer for Humility"** (both William Law extracts). Transcribed from the Fleming H. Revell Company edition (New York/London/Glasgow).
- **CCEL does not host this work** — Murray's author page lists 11 works, Humility is not among them, and `ccel.org/ccel/murray/humility` 404s ([ccel.org/ccel/murray](https://ccel.org/ccel/murray)). CCEL's layered-terms question is therefore moot.
- **Runner-up: Internet Archive scan** `humilitybeautyof00murr` (1910 Revell printing, Princeton Theological Seminary copy, 99 pp) — good as a **verification/proofreading reference** against the PG text, but its full-text is raw OCR and would need cleanup PG has already done ([archive.org/details/humilitybeautyof00murr](https://archive.org/details/humilitybeautyof00murr)).
- **Licensing**: the work itself is public domain (1895 publication; Murray d. 1917 — also PD in life+70 jurisdictions). PG's license permits stripping all PG header/footer/trademark references, leaving "a text unrestricted by U.S. intellectual property law" — strip them and ship the module without PG obligations ([gutenberg.org/policy/license.html](https://www.gutenberg.org/policy/license.html)).
- **Structure for module atoms**: chapter heads are trivially parseable (`I.` … `XII.` on their own line, title on the next); paragraphs are blank-line separated; epigraphs are a fixed pattern (`_'…'_--REV. iv. 11`); inline scripture references are consistently parenthetical (`(John v. 19)`) with roman-numeral chapters — normalizable to live references with a small roman-numeral converter.

## Candidate Digitizations

### Project Gutenberg #57121 (recommended)

- **Formats**: EPUB3, EPUB, Kindle, HTML ([pg57121-images.html](https://www.gutenberg.org/cache/epub/57121/pg57121-images.html)), plain text UTF-8; released 2018-05-09, credit "Produced by Free elf" ([gutenberg.org/ebooks/57121](https://www.gutenberg.org/ebooks/57121)).
- **Edition**: title page reads "NEW YORK / FLEMING H. REVELL COMPANY / LONDON GLASGOW" (verified in [pg57121.txt](https://www.gutenberg.org/cache/epub/57121/pg57121.txt)). PG's usual caveat applies: eBooks are "often created from several printed editions" ([license](https://www.gutenberg.org/policy/license.html)).
- **Completeness** (verified against the downloaded plain text, all line numbers from `pg57121.txt`):
  - Title-page motto couplet ("Lord Jesus! may our Holiness be perfect Humility! …").
  - Preface (unnumbered).
  - Chapters `I.`–`XII.` at lines 140–1693, titles matching the standard sequence (The Glory of the Creature; The Secret of Redemption; The Humility of Jesus; …; Humility and Exaltation).
  - Every chapter opens with an italic scripture epigraph, e.g. ch. I: `_'They shall cast their crowns before the throne, … '_--REV. iv. 11`; ch. IV carries two (`--MATT. xi. 29` and `--MATT. xx. 27`).
  - Back matter: `Notes.` with `NOTE A` / `Note B` / `Note C` (long William Law extracts from _Spirit of Prayer_ and _Address to the Clergy_, cross-referenced from chapters as "(See Note A.)" etc.) and `A PRAYER FOR HUMILITY` (a further Law extract), then the PG footer.
- **Footnotes**: three, inline in square brackets (`[Footnote: I knew Jesus, and He was very precious…]`, `[Footnote1: ME is a most exacting personage…]`, one editorial note in ch. X). Easy to lift into module footnotes.
- **Text quality**: hand-keyed, not OCR; paragraph breaks intact throughout. Known blemishes found by inspection (worth fixing at build time against the IA scan):
  - ch. XII: "with him the is of a contrite and humble spirit" (should read "him also that is of a contrite…", Isa. 57:15);
  - Note A: "to make it known the region of eternity" (likely "known in the region");
  - one reference missing its period: `(John v 30)` amid otherwise uniform `(John v. 19)` style.

### CCEL (ccel.org) — not available

- Murray author page lists exactly 11 works (Absolute Surrender, Deeper Christian Life, Lord's Table, Master's Indwelling, New Life, School of Obedience, True Vine, Two Covenants, Waiting On God!, With Christ in the School of Prayer, Working For God!) — **no Humility** ([ccel.org/ccel/murray](https://ccel.org/ccel/murray)).
- `ccel.org/ccel/murray/humility` returns HTTP 404 (fetched 2026-08-20). A ccel.org-restricted search surfaces only humility *passages* in the other Murray works.
- So CCEL's ThML/XML pipeline and its layered redistribution terms never come into play for this book.

### Internet Archive — `humilitybeautyof00murr` (runner-up)

- 1910 F. Revell printing, scanned 2009 from Princeton Theological Seminary Library; 99 pages at 500 DPI; marked `NOT_IN_COPYRIGHT` ([archive.org/details/humilitybeautyof00murr](https://archive.org/details/humilitybeautyof00murr)).
- Formats: B/W PDF, EPUB, full-text OCR, HOCR, DAISY; page-number confidence 97% — decent OCR but still OCR (line-break hyphenation, long-s style errors typical), so building from it means redoing cleanup PG volunteers already did.
- Best use: page-image authority for verifying/correcting the PG blemishes listed above.
- IA also mirrors the PG edition itself as [humilitythebeaut57121gut](https://archive.org/details/humilitythebeaut57121gut) — same text, no advantage.

### Other digitizations (rejected)

- **sermonindex.net** [andrew-murray--humility.txt](https://www.sermonindex.net/pdf-text/txt/a/andrew-murray--humility.txt): 5.7 kB — a single *sermon* summary/excerpt wrapped in site boilerplate, not the book (verified by download).
- **worldinvisible.com**: the old chapter-per-page HTML edition is gone — `worldinvisible.com/library/murray/humility/humilitycontent.htm` redirects to archive.worldinvisible.com and 404s (site rebuilt on WordPress; fetched 2026-08-20).
- **HolyBooks / manybooks / beunitedinchrist PDFs**: repackagings of the same PD text (manybooks explicitly redistributes PG files); PDF is a worse extraction source than PG's own plain text/HTML. Not fetched beyond identification.
- **Wikisource**: no transcription found via search (only PG/IA hits) — not pursued.

## Structure → Module Atoms

What the PG plain text exposes, in build order:

- **Sections**: Preface, chapters I–XII, Notes (A/B/C), A Prayer for Humility — 17 addressable top-level units. Chapter heads parse as: a line matching `^(I|II|…|XII)\.$`, next non-blank line = chapter title.
- **Paragraphs**: blank-line separated throughout; stable enough to number `chapter.paragraph` as the addressable atom (matching how the plugin atomizes other modules).
- **Epigraphs**: fixed shape — italic-markered quote `_'…'_` followed by `--BOOK roman. arabic` (e.g. `--REV. iv. 11`, `--PHIL. ii. 8`, `--LUKE xiv. 11`). Parse into chapter-level metadata: quote text + a normalized reference → live scripture link.
- **Inline scripture references**: dominant pattern is a quoted phrase followed by a parenthetical ref — `(John v. 19)`, `(Luke xviii. 14)`, `(Eph. iii. 8)`; 15+ instances sampled, all roman-numeral chapter + arabic verse, abbreviated or full book name. A roman-numeral → int converter plus a book-abbreviation table yields live references. Caveats: many of Murray's quotations are *unreferenced* (bare quoted allusions) — only linkify the explicit refs; quotations follow the Revised Version/KJV wording of his day, so linked text won't match a modern translation word-for-word.
- **Footnotes**: three bracketed `[Footnote…]` blocks inline — extract to per-chapter footnotes.
- **Cross-references**: "(See Note A.)" style pointers from chapters to the Notes section — can become internal module links.

## Licensing

- **Work**: first published 1895 (Murray d. 1917). Pre-1930 US publication → US public domain; author dead >70 years → PD in life+70 countries. PG states "Public domain in the USA" for #57121 ([gutenberg.org/ebooks/57121](https://www.gutenberg.org/ebooks/57121)); IA marks its scan `NOT_IN_COPYRIGHT` ([archive.org](https://archive.org/details/humilitybeautyof00murr)).
- **PG terms**: the trademark obligations attach only if the PG name/header stays. "If you strip the Project Gutenberg license and all references to Project Gutenberg from the text, you are left with a text unrestricted by U.S. intellectual property law" ([gutenberg.org/policy/license.html](https://www.gutenberg.org/policy/license.html)). Keeping the PG name would forbid textual changes (our normalization/typo fixes) — another reason to strip.
- **Build rule**: remove everything outside the `*** START …` / `*** END …` markers plus the "Produced by Free elf" credit line; no PG attribution required afterwards (a courtesy credit in the module's provenance metadata is fine and standard for this repo).

## Recommendation

**Build from PG #57121 plain text** ([pg57121.txt](https://www.gutenberg.org/cache/epub/57121/pg57121.txt)). Reasons: only complete non-OCR digitization (Preface + 12 chapters + epigraphs + footnotes + Notes A–C + A Prayer for Humility); hand-keyed with paragraph fidelity; machine-friendly regular structure for chapter/paragraph atoms and parenthetical scripture refs; unambiguous licensing once PG boilerplate is stripped. Fix the three known transcription blemishes at build time, checked against the page images of the **runner-up, the Internet Archive 1910 Revell scan** ([humilitybeautyof00murr](https://archive.org/details/humilitybeautyof00murr)) — the right verification authority, but not worth building from directly since its full-text layer is raw OCR.

## Open Questions / Unverified

- Whether the PG text derives from the 1895 first printing or the 1910 (or later) Revell printing — PG doesn't say and mixes editions by policy; textual differences between Revell printings are assumed negligible but unchecked.
- Exact count/positions of unreferenced scripture allusions (only explicitly referenced quotations were sampled).
- The PG HTML edition's markup quality (italics/blockquotes) vs plain text — if the builder prefers HTML input, inspect `pg57121-images.html` structure before choosing; the plain text was fully verified here.
