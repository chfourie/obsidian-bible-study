# Scripture Study — Ubiquitous Language

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
Superseded in v1.1: every translation is a downloadable Module sourced from the bolls.life catalogue (or the BSB release artifact). The online tier and its passage cache were removed with API.Bible.

### Fallback Translation
The single user-configured translation (restricted to installed modules) served when a requested translation is unavailable. Substitution is always visible — the rendered output names the translation actually served. Never applied in the reader's multi-translation stacked view.

### Cross-Reference
A symmetric connection between two or more References that belong together in study (e.g. a shared theme or allusion). All members are mutually connected — there is no direction and no primary member. Not a note: cross-references live in a single plugin-managed data file inside the vault, so they sync and back up with the vault without imposing per-item filenames. Distinct from a Reference: a Reference is an address; a Cross-Reference is an edge between addresses.

### Study Panel
The single right-sidebar surface that follows the last-focused note or reader tab: for a note, the passages it references and intersecting Cross-References; for a reader, the selected verse's details and the chapter's Cross-References. Remembers its state per tab (in memory, for the tab's lifetime). The reader itself shows only scripture text — all companion material lives here.

### Occurrence
One appearance of a reference at a position in a vault note (in the body or in annotation frontmatter). The unit the vault index stores; intersection queries return occurrences.

### Annotation
A vault note dedicated to commenting on a reference, with the reference in its frontmatter as source of truth. Indexed like any note but always surfaced in the reader beside its verses.

### Tagged Translation
A translation whose module carries word-level Strong's tag spans beside each verse's text, recorded as a capability flag in its manifest. Tags are inert everywhere except the reader's Strong's Mode. Currently BSB (built from the public-domain Berean word-level tables) and KJV (built from bolls.life's `<S>`-tagged dump); the capability is per-translation.

### Strong's Dictionaries
The shared dictionary module (STEPBible TBESH/TBESG, CC BY 4.0) mapping Strong's numbers to lemma, transliteration, gloss, and definition. One module serves all Tagged Translations; downloading it is what "Enable Strong's" means.

### Strong's Mode
A reader-toolbar toggle (visible only when the viewed translation is tagged and the Strong's Dictionaries are installed) that makes tagged words tappable. Tapping renders the word's dictionary entries in the Study Panel, with CC BY attribution.

### Highlight
A colored span over part of one occurrence's rendered passage, anchored as character offsets into one translation's stored verse text (verse id + start/end chars, end-exclusive). Belongs to that single occurrence — never a vault-wide property of the verse. Exists only while the occurrence displays its requested translation; a substituted (fallback) passage renders none.

### Highlight Cue
The serialized form of a highlight: an option token `h<slot>/<verse>.<start>-<verse>.<end>` inside the reference's curly braces. Machine-canonical (sorted, merged, non-overlapping, split at reference gaps); hand-typed shorthand is accepted but rewritten on the next machine edit.

### Highlight Slot
One of five global, positional color roles (`h1`–`h5`), each with a light-mode and dark-mode color configured in settings. A cue stores only the slot index, so recoloring a slot re-tints every highlight in the vault that uses it. Slots have no names or semantics — they are colors, not tags.

### Pinned Translation
The explicit translation token the plugin writes into a reference the moment its first highlight is created, binding the cues' offsets to that translation's text. Changing the translation through plugin UI deletes the cues; hand-editing it leaves them to render best-effort.
