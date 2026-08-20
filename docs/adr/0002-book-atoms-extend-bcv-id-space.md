# 0002 — Non-biblical book atoms extend the BCV id space

Date: 2026-08-20
Status: accepted

## Context

Non-biblical books (first instance: *Humility*, Andrew Murray) must be readable, referencable, and cross-referencable with full parity to scripture. Every subsystem keys on the `BBBCCCVVV` integer id space (ADR 0001): intersection, cross-reference edges, Study Panel queries, cache keys, annotations. Candidates were extending that space with book numbers above 66, or a separate id scheme for books. A separate scheme forks every integer-interval code path; extension makes books participate by construction but stretches the meaning of the `VVV` field and requires per-book versification data.

## Decision

Book atoms are ids in the same `BBBCCCVVV` space:

- **Book numbers**: 67–100 reserved for possible canon extensions (deuterocanon in OSIS order); non-biblical books start at **101**. A repo-side registry next to the module build scripts is the single authority mapping number → work; numbers are append-only and never reused, even for withdrawn modules. Humility = 101.
- **Atom = paragraph**: `CCC` = section (chapter) number, `VVV` = paragraph within section. Sentences are too fragile to segment stably; whole chapters too coarse for study links. Epigraphs are chapter metadata; footnotes attach to their anchor paragraph; neither consumes an id.
- **Section numbering**: the module build assigns every top-level section a chapter number in reading order, keeping printed chapter numbers where they exist. Humility: Preface = 0 (scripture never uses chapter 0; integer order must equal reading order for interval math), chapters I–XII = 1–12, Notes A–D = 13–16, A Prayer for Humility = 17. (The planning research listed only Notes A–C; the PG #57121 source carries a fourth note, *Note D — A Secret of Secrets*, discovered at build time. It is included rather than dropped — the grid must be lossless — shifting the Prayer from the originally planned 16 to 17.) The manifest's section/paragraphs-per-chapter table is the book's versification data.
- **Grid authority**: the first published module release fixes the grid forever. Later releases may fix text within a paragraph but never split, merge, insert, delete, or renumber paragraphs. A genuinely broken grid means a new module identity, never a renumber. One book = one module = one grid; editions are not modeled as translations.
- **Translation slot**: each book module declares a single edition code (e.g. `HUM-M1895`) that fills the translation slot in all keying — storage, passage lookup, highlight binding. Fallback Translation never applies to books; the stacked multi-translation reader view has exactly one layer for a book.
- **Discovery**: the plugin learns which books exist from installed module manifests; scripture's 66 stay compiled-in. An address whose module is absent is a content gap, exactly as for uninstalled translations.

## Consequences

- Cross-references, annotations, intersection, and the Study Panel accept book atoms with no model change — an edge between Rom 12:3 and Humility 5:2 is the same integer interval pair as any other.
- `VVV` now reads "atom within chapter" (verse for scripture, paragraph for books); versification-aware helpers (`nextVerse()`, range enumeration) consult the book module's section table instead of the shipped canon table for book numbers ≥ 101.
- Cross-references and annotations can point at atoms of an uninstalled book module; rendering that gap is inherited by the cross-reference/Study Panel work, matching uninstalled-translation behavior.
- Reference grammar must resolve book names/abbreviations to registry numbers and can rely on chapter 0 and back-matter chapter numbers existing; surface syntax is decided separately.
- The packaging work must publish the registry entry and eyeball the section/paragraph table before a module's first release, since that release freezes the grid.
