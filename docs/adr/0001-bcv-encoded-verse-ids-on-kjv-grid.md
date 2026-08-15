# 0001 — BCV-encoded verse ids on a fixed KJV grid

Date: 2026-08-15
Status: accepted

## Context

Every subsystem (parser output, intersection index, cache keys, annotations, reader) needs one canonical representation of a scripture reference. Candidates were a structural form (`{book, [{start:{ch,v}, end:{ch,v}}]}`), a contiguous ordinal (position 0..~31101 on the canon), and a sparse BCV-encoded integer. Versification data is a shipped dependency either way, because the grammar validates verse numbers against it. A small number of verses differ across translations (omissions like John 5:4, numbering drift like 3 John 15); all representations inherit that limitation equally.

## Decision

The canonical internal identity of a verse is a BCV-encoded integer `BBBCCCVVV`: book number (1-66, Protestant/OSIS order), chapter, verse — John 15:4 = `043015004`. A reference normalizes to `{book, ranges: [{startId, endId}]}`. The grid is KJV versification; per-translation versification differences are ignored in v1 — an off-grid or omitted verse is a content gap at fetch/display time, never a model change.

Contiguous ordinals were rejected because inserting books later (deuterocanon, expanded collections) would shift every subsequent ordinal and invalidate persisted data keyed on them. BCV ids never move; three digits per field leaves room for future books (max chapter 150, max verse 176 both fit).

## Consequences

- Intersection, sorting, and containment are plain integer interval operations; overlap math is unaffected by the sparse number line because all references share the same grid.
- Ids are stable under canon extension and human-readable when debugging; book/chapter/verse falls out by arithmetic with no table lookup.
- Verse iteration and adjacency across chapter boundaries need a versification-aware `nextVerse()` helper rather than `+1`; counting verses in a range needs the table. Both trivial since versification data is loaded regardless.
- 9-digit ids sit far inside JS safe-integer precision.
- References never cross book boundaries (grammar guarantees this).
- A future per-translation versification mapping would live in the content layer only; ~3-5 spots in the canon may misalign for translations with numbering drift until one exists.
