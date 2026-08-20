# Scripture Study — Ubiquitous Language

## Terms

### Reference
A pointer to scripture in exactly one book: a book plus a set of verse ranges (e.g. `John 15:4-6,9`). Written in notes with the curly-brace grammar. A reference never crosses a book boundary.

### Canonical Grid
The fixed, translation-independent numbering of all verses in the 66-book Protestant canon, following KJV versification (~31,102 verses). Every reference, intersection, and cache key lives on this grid. A translation that omits or renumbers a verse has a content gap at that grid position — the grid itself never changes per translation.

### Verse Id
The canonical internal identity of an atom: a BCV-encoded integer `BBBCCCVVV` (book number, chapter, atom-within-chapter — e.g. John 15:4 = 043015004). Scripture occupies book numbers 1-66 (Protestant/OSIS order) with the verse as atom; 67-100 are reserved for canon extensions; non-biblical Books start at 101 with the paragraph as atom. Ids are stable forever: adding books later never renumbers existing atoms. Book/chapter/atom is derivable by arithmetic; validity and adjacency come from versification data.

### Book
A non-biblical work (e.g. *Humility*, Andrew Murray) addressable on the same id space as scripture, with a Book Registry-assigned book number ≥ 101 and the paragraph as its atom. Sections (front matter, printed chapters, back matter) take chapter numbers in reading order, keeping printed numbers where they exist. One book = one module = one grid — editions are not modeled as translations; the module's Edition Code fills the translation slot wherever one is required.

### Book Registry
The append-only, repo-side authority mapping book numbers to works. Numbers are never reused, even for withdrawn modules. The plugin discovers which Books exist from installed module manifests; scripture's 66 books stay compiled-in.

### Edition Code
A book module's single manifest-declared code (e.g. `HUM-M1895`) occupying the translation slot in all keying for that Book. Fallback Translation never applies to Books; a Book has exactly one layer in any multi-translation view.

### Verse Range
An inclusive span of verse ids within one book (`startId`-`endId` on the Canonical Grid). The normalized form of a reference is a set of verse ranges. Overlap, sorting, and containment are plain integer interval operations; enumerating the verses inside a range uses versification data to skip non-existent ids.

### Versification Data
The atom-counts-per-chapter tables behind reference validation, adjacency, and enumeration, held in a runtime registry. The canon's verse-counts table (KJV versification) ships compiled-in as the permanent base; each installed Book module registers its own atom-count table from its manifest. A Book's references are only valid while its module is installed — uninstalling leaves vault text and cross-reference entries untouched but dormant until reinstall.

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
The single right-sidebar surface that follows the last-focused note or reader tab: for a reader, two sub-tabs — Study, with the chapter's Annotations, Mentions, and Cross-References, and Translations, with the selection's whole text in every installed translation plus tapped-word Strong's details, loaded only while that tab shows; for a note, the same three sections for its referenced scriptures, plus the passages it references. Remembers its state per tab (in memory, for the tab's lifetime). The reader itself shows only scripture text — all companion material lives here.

### Occurrence
One appearance of a reference at a position in a vault note (in the body or in annotation frontmatter). The unit the vault index stores; intersection queries return occurrences.

### Annotation
A vault note dedicated to commenting on a reference, with the reference in its frontmatter as source of truth. Indexed like any note but surfaced in the Study Panel for any chapter or note whose references intersect it.

### Mention
An intersecting note that is not an Annotation: a vault note whose body references overlap the scripture in view. Derived, not declared — a note with a frontmatter ref is always an Annotation, never a Mention, even if its body also references the same verses.

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

### Ref Span
A live reference inside a Book's stored content, parsed at module build time: a character span over one atom's text plus pre-normalized verse ranges (scripture or same-book), stored as a span channel beside the text like Strong's tag spans. Renders as a quiet link (the author's original citation text); tapping navigates the reader to the target. Only explicit citations become ref spans — unreferenced allusions stay plain prose. Ref spans are not Occurrences and never enter the vault index.

### Pinned Translation
The explicit translation token the plugin writes into a reference the moment its first highlight is created, binding the cues' offsets to that translation's text. Changing the translation through plugin UI deletes the cues; hand-editing it leaves them to render best-effort.
