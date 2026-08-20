# Non-biblical Books — Spec Addendum

Adds a general **non-biblical book** capability to Scripture Study, with *Humility* by Andrew Murray (1895) as its first concrete instance. Full integration parity: a book is readable, referencable, and cross-referencable. This document consolidates every decision from the [wayfinder map](https://github.com/chfourie/obsidian-bible-study/issues/50); it extends the [v1 specification](spec.md) and follows the glossary in [CONTEXT.md](../CONTEXT.md). Identity decision: [ADR 0002](adr/0002-book-atoms-extend-bcv-id-space.md). Source-text research: [docs/research/humility-source-text.md](research/humility-source-text.md). Visual reference: [prototypes/book-reader-prototype](../prototypes/book-reader-prototype).

Books ride the existing machinery everywhere — no parallel book paths. Where a decision below names *Humility*, the general rule is stated first and Humility is its instance.

---

## 1. Identity & addressing

([ADR 0002](adr/0002-book-atoms-extend-bcv-id-space.md))

- Books extend the `BBBCCCVVV` id space: scripture keeps 1–66, 67–100 reserved for canon extensions, non-biblical books start at **101** (Humility = 101). Numbers are assigned by the repo-side **Book Registry** (§7), append-only, never reused.
- **Atom = paragraph**: `CCC` = section, `VVV` = paragraph within section. Epigraphs are chapter metadata, not atoms; footnotes attach to their anchor paragraph.
- **Sections** take chapter numbers in reading order, keeping printed chapter numbers. Humility: Preface = 0, chapters I–XII = 1–12, Notes A–D = 13–16, A Prayer for Humility = 17 (18 sections; the source's Note D was missed by the planning research and surfaced at build time — see ADR 0002).
- The manifest's section table is the book's versification data. The **first published module release freezes the grid** — later releases may fix text within paragraphs but never renumber. One book = one module = one grid; editions are not translations.
- A single manifest **edition code** (Humility: `HUM-M1895`) fills the translation slot in all keying. Fallback Translation never applies to books.
- The plugin discovers which books exist from installed module manifests; scripture's 66 books stay compiled-in.

## 2. Source text & build pipeline

([research](research/humility-source-text.md))

- **Source: Project Gutenberg eBook #57121** (plain text UTF-8, Fleming H. Revell edition, hand-keyed). Public domain worldwide (1895 work, Murray d. 1917). Strip everything outside PG's `*** START/END ***` markers **including the PG name** (keeping it would forbid textual fixes); the remaining text is unrestricted and safe to ship as a GitHub release artifact.
- **Verification authority**: the Internet Archive scan [`humilitybeautyof00murr`](https://archive.org/details/humilitybeautyof00murr) (1910 Revell printing) — page-image authority for build-time fixes, never a build source. Three known transcription blemishes are fixed at build time against it (listed in the research doc).
- **Pipeline**: `scripts/build-humility-module.mjs` + vitest-covered `humility-pipeline/`, mirroring the BSB build — Gutenberg #57121 → `dist/hum-m1895-module/`. Chapter heads (`^(I..XII)\.$` + title line) and blank-line paragraphs yield section.paragraph atoms; epigraphs parsed from their fixed `_'…'_--REV. iv. 11` shape. Generalize into a shared pipeline only when book #2 arrives.

## 3. Reference grammar

- **Typing is numeric only**, exactly the scripture grammar over the book's grid: `{Humility 5:2}`, ranges `{Humility 5:2-4}`, comma lists, whole chapter `{Humility 5}`, cross-chapter ranges; whole-book rejected. Special sections are typed by chapter number (`{Humility 0:3}` = Preface, `{Humility 14:1}` = Note B); autocomplete surfaces the section-name ↔ number mapping. Name-based section sugar is a possible later additive.
- **Name resolution** from installed module manifests only: canonical name (`Humility`), short abbreviation (`Hum`), optional aliases, matched case-insensitively via the existing `matchBook` path (3-word max stays; longer titles rely on an alias). Scripture's compiled table always wins collisions; manifest names shadowing scripture are dropped at load with a console warning. Cross-book uniqueness is enforced repo-side by the Book Registry at registration time. An uninstalled book's name is unknown → the whole `{...}` renders as plain text (existing safety valve).
- **Option tokens**: translation ids are never valid on a book reference (highlighted-and-ignored, like any invalid token); the edition code is not accepted as a token either. Display keywords and highlight cues work identically — highlights bind under the edition code in the translation slot.
- **Errors** mirror scripture: unknown book (incl. uninstalled module) or out-of-range chapter/paragraph per the module's section table → whole `{...}` plain text.

## 4. Rendering in notes

- All display modes apply — bare chip / `inline` / `block`. No separate callout type: the v1 "general non-bible reference block type" deferral is **superseded**.
- **Chip**: scripture's chip anatomy with a distinguishing mark (book icon / modifier class), same accent family. Compact MLA-style locators with the title in italics: *Humility* ch. 5, par. 2. Display-named sections replace the chapter locator: *Humility* Preface, par. 3 — the manifest section table flags them (`named: true`), set by the build for every section the printed work carries no chapter number for (Preface, Notes A–D, the Prayer).
- **`inline`** mirrors scripture: paragraph numbers superscripted only for multi-paragraph refs.
- **`block`** renders normal prose paragraphs with superscript paragraph numbers (no one-atom-per-line) plus a full-citation attribution line: `Andrew Murray, Humility (1895), ch. 5, par. 2` (manifest supplies author, title, year). The same full citation renders wherever a one-time citation belongs (Study Panel header).

## 5. Book reader

Visual reference: [book-reader-prototype](../prototypes/book-reader-prototype) (variant B typography; [NOTES.md](../prototypes/book-reader-prototype/NOTES.md) holds the verdict).

- **Typography**: serif book typography — centered chapter number + small-caps title, centered epigraph, justified prose, margin-gutter paragraph numbers.
- **Nav** reuses the scripture reader's existing tree/breadcrumb toggle (global default + in-pane switch). Tree side = the book's **own named-section TOC** (Preface / I–XII / Notes / Prayer) — not a Books group inside the scripture tree. Breadcrumb side = `Humility › [section dropdown]` with prev/next steppers.
- **Reaching a book** (ticket #78): the trees and the breadcrumb stay as above — the crossing point is the ribbon icon's options panel, which lists every installed book in a **Books** section (absent when none is installed). Activating an entry opens the book in the reader tab already open, at the last position that reader held inside it or else its first section; Cmd/Ctrl-activating opens it in a reader tab of its own. The same modifier opens any reader tree node in its own tab.
- **Options**: Nav + font size + **Para numbers (On/Hover, default Hover)**; Layout, Red letter, and Strong's are hidden for books. Single non-switchable edition pill (`Humility 1895`) replaces the translation switcher.
- **Per-device option defaults (scripture reader included)**: reader option global defaults split into desktop and mobile values; in-pane switching unchanged. Motivation: tree on desktop, breadcrumb on mobile.
- **Study Panel**, paragraph details: chip locator + full citation + the paragraph's text; no Translations tab (a book has exactly one layer). Same chapter-scoped sections as scripture (§6).
- **Copy formatted reference**: a reader action (scripture *and* books) copying a paste-ready `{...}` reference for the selected verse/paragraph range — especially valuable for sections without printed numbers.

## 6. Cross-references, vault index & Study Panel

- **Runtime versification registry**: atom-counts-per-section becomes first-class runtime data. The compiled 66-book table is the permanently-registered base; each installed book module registers its manifest's atom-count table at load. All versification helpers (`verseCount`, `chapterCount`, `nextVerse`, `enumerateVerseIds`, `mergeRanges`, parse validation) consult the registry — intersection, indexing, and cross-references use the **same integer machinery** as scripture.
- **Dormant, not deleted**: a book ref parses only while its module is installed. Uninstall → occurrences drop from the vault index and chips show the unknown-book error; note text and cross-reference file entries are never touched; everything reappears on reinstall. Module install/uninstall triggers the existing debounced full reindex. No tombstones, no uninstall warnings.
- **Mixed cross-references are fully symmetric** — any member mix (scripture↔book, book↔book). Collect strip works identically in the book reader. Member labels use §4's display format; no member-kind badges or grouping. Clicking a book member opens the book reader at that paragraph. Members of an uninstalled book render a degraded label (e.g. `Book 101 5:2`) — `formatReference` never throws.
- **Panel passages**: a book ref resolves its translation slot to the module's edition code (never `defaultTranslationId`, never switchable). `FallbackPassageSource` never substitutes for book ≥ 101 — a miss renders the explicit module-absent error.
- **Section = chapter** for every chapter-scoped panel query (annotations, mentions, cross-references; Preface = 0). The book reader gets the same ● / ◆ trailing markers, per paragraph, alongside the gutter numbers.
- **Annotations need no new mechanism** — they work by construction once the grammar accepts book references.

## 7. Module packaging, catalogue & settings

- **Manifest**: the existing `ModuleManifest` extended with `kind: 'book'` plus a required-when-book `book` sub-object — `{ number, editionCode, author, year, abbreviation, aliases?, sections: [{chapter, name, paragraphs, named?}] }`. One type, one store, one discovery path; `isTranslationManifest()` keeps translation-only code paths books-free. Books share `MODULE_FORMAT_VERSION`; capability flags all false/absent; `source`/`sourceChecksum` filled at download exactly like BSB.
- **Module id & storage**: id = edition code lowercased (`hum-m1895`) — a future re-cut edition coexists instead of overwriting. Storage layout unchanged: `modules/hum-m1895/manifest.json` + `101.json` keyed by paragraph verse-ids. Same `saveModule()` wipe-then-write flow.
- **Distribution** mirrors BSB per book: one release tag per book module (`hum-m1895-module`) carrying `hum-m1895-module.json` + `checksums.json`, sha256-verified. `BsbReleaseClient` generalizes into a parameterized release client (tag + filename + id) used by BSB and books; books register in the prebuilt-sources map so checksum-based update detection and cross-device re-download (`installedModuleIds` sync) work unchanged.
- **Catalogue**: compiled-in book catalogue array (v1: one entry). A future remote catalogue replaces only the array.
- **Book Registry**: `scripts/book-registry.json` — append-only `{ bookNumber, title, author, moduleId, editionCode }`; every book pipeline validates its manifest against it and fails the build on mismatch or number reuse. The section/paragraph table is eyeballed before a book's first release (that release freezes the grid).
- **Settings**: a new **Books** section beside Translations — own row list (v1: Humility only), same Download/Update/Delete row UX with shared busy/error states; no language filter, no Strong's badge. Rows show *title — author* with the edition code in the description. Translation lists and both translation pickers stay books-free via the `kind` filter. The BSB first-run nudge stays translations-only.

## 8. Live scripture references in book content

- **Representation**: build-time-parsed **Ref Spans** — `{start, end, ranges}`: a character span over the atom's text plus pre-normalized verse ranges — stored in a `refs` channel beside the prose, the same pattern as the Strong's `tags`/`red`/`supplied` channels. Stored text stays clean; the reader does zero parsing. Epigraph refs take the same shape over the epigraph's text. No curly-brace grammar in module storage.
- **Linkify policy**: explicit citations only — the parser handles the uniform parenthetical patterns (`(John v. 19)`: roman chapter, arabic verse; lenient on the known missing-period case). A build-time **overrides file** (`scripts/humility-pipeline/ref-overrides.json`) supports *fix* (supply ranges for a mangled/missed ref) and *suppress* (false positive), keyed by `chapter.paragraph` — or `chapter.eN` for a section's Nth epigraph — plus the matched text; an override that no longer matches its atom exactly once fails the build, as does a bracketed citation the scanner resolved nothing in. Unreferenced allusions are never hand-annotated — Murray didn't cite them, we don't.
- **Reader behavior**: a quiet accent-colored link (the author's original citation text — no pill/chip in prose). Tap opens the scripture reader at the passage with the existing current-passage highlight + entry-context banner; Cmd/Ctrl-activating opens the target in a reader tab of its own, leaving the book pane where it stands. A hover/long-press preview popover is a possible later additive, not a different tap action.
- **Not Occurrences**: ref spans are reader-only live links; module content never enters the vault index.
- **No wording-mismatch mechanism**: the link is a citation, not a quotation-identity claim; navigation honors the user's translation like every other entry point.
- **Internal "(See Note A.)" pointers** linkify via the same machinery (ranges into book 101); navigation stays within the book reader.

## 9. Implementation notes

Surfaced by the code scan while resolving cross-reference semantics:

- `formatReference`/`bookName` currently throw for book ≥ 67 and sit on hot paths (xref labels, passage cache keys) — must degrade instead (§6).
- `mergeRanges`/`enumerateVerseIds` silently degrade without registry data — the versification registry must be in place before book refs parse.
- Occurrence indexing is already book-agnostic once parsing succeeds.
- Per-device reader defaults (§5) touch the scripture reader's settings surface, not just books.

## Out of scope

- **Book content as a Mentions source** (indexing module-internal scripture refs as Occurrences so the scripture reader surfaces *Humility* citations) — a future effort of its own; the stored representation doesn't foreclose it.
- **A second book / general catalogue pipeline** — v-next; the packaging design only leaves room for it (parameterized release client, registry, `kind` filter).
