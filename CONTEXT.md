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
A downloadable, locally-stored data bundle — a full translation download or the Strong's Dictionaries. The unit of storage and settings management. Lives in the plugin data dir (never vault files, never synced); stored in normalized form: per-book JSON keyed by verse id, plus a manifest (metadata, license string, source checksum, format version).

### Tier
A translation's licensing class, which dictates its storage model. **Downloadable** (public domain / open license): fetched once as a full module, works offline. **Online** (licensed, e.g. NIV/NKJV): fetched per passage via the user's API key, held only in the passage cache.

### Passage Cache
The local store of online-tier verses: normalized verse-id→text entries stamped with fetch time. Hard 14-day expiry (expired = purged, never served), at most 500 consecutive verses, never synced. Compliance mechanism, not an optimization.

### Fallback Translation
The single user-configured translation (restricted to installed modules) served when a requested translation is unavailable. Substitution is always visible — the rendered output names the translation actually served. Never applied in the reader's multi-translation stacked view.

### Occurrence
One appearance of a reference at a position in a vault note (in the body or in annotation frontmatter). The unit the vault index stores; intersection queries return occurrences.

### Annotation
A vault note dedicated to commenting on a reference, with the reference in its frontmatter as source of truth. Indexed like any note but always surfaced in the reader beside its verses.

### Tagged Translation
A translation whose module carries word-level Strong's tag spans beside each verse's text, recorded as a capability flag in its manifest. Tags are inert everywhere except the reader's Strong's Mode. Currently BSB is the only one (built from the public-domain Berean word-level tables); the capability is per-translation, not BSB-specific.

### Strong's Dictionaries
The shared dictionary module (STEPBible TBESH/TBESG, CC BY 4.0) mapping Strong's numbers to lemma, transliteration, gloss, and definition. One module serves all Tagged Translations; downloading it is what "Enable Strong's" means.

### Strong's Mode
A reader-toolbar toggle (visible only when the viewed translation is tagged and the Strong's Dictionaries are installed) that makes tagged words tappable. Tapping renders the word's dictionary entries in the reader details surface, with CC BY attribution.
