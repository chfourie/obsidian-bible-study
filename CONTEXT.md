# Bible Study — Ubiquitous Language

## Terms

### Reference
A pointer to scripture in exactly one book: a book plus a set of verse ranges (e.g. `John 15:4-6,9`). Written in notes with the curly-brace grammar. A reference never crosses a book boundary.

### Canonical Grid
The fixed, translation-independent numbering of all verses in the 66-book Protestant canon, following KJV versification (~31,102 verses). Every reference, intersection, and cache key lives on this grid. A translation that omits or renumbers a verse has a content gap at that grid position — the grid itself never changes per translation.

### Verse Id
The canonical internal identity of a verse: a BCV-encoded integer `BBBCCCVVV` (book number 1-66 in Protestant/OSIS order, chapter, verse — e.g. John 15:4 = 043015004). Ids are stable forever: adding books to the collection later never renumbers existing verses. Book/chapter/verse is derivable by arithmetic; validity and adjacency come from versification data.

### Verse Range
An inclusive span of verse ids within one book (`startId`-`endId` on the Canonical Grid). The normalized form of a reference is a set of verse ranges. Overlap, sorting, and containment are plain integer interval operations; enumerating the verses inside a range uses versification data to skip non-existent ids.

### Versification Data
The static verse-counts-per-chapter table for the canon (KJV versification). Shipped with the plugin; used for validating references and mapping between ordinals and book/chapter/verse.

### Intersection
Two references intersect iff they share at least one verse ordinal. Translation-agnostic.

### Passage
The scripture content a reference resolves to in a specific translation: reference + translation → text. A reference is the address; a passage is what lives there.

### Translation
A specific bible text (e.g. NIV, WEB) whose content is projected onto the Canonical Grid.

### Module
A downloadable, locally-stored data bundle — a full translation download or a Strong's package (tagged text + dictionary). The unit of storage and settings management.

### Occurrence
One appearance of a reference at a position in a vault note (in the body or in annotation frontmatter). The unit the vault index stores; intersection queries return occurrences.

### Annotation
A vault note dedicated to commenting on a reference, with the reference in its frontmatter as source of truth. Indexed like any note but always surfaced in the reader beside its verses.
