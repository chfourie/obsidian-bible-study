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
A downloadable, locally-stored data bundle — a full translation download, the Strong's Dictionaries, or a Book. The unit of storage and settings management. Lives in the plugin data dir (never vault files, never synced); stored in normalized form: per-book JSON keyed by verse id, plus a manifest (metadata, license string, source checksum, format version). The manifest's `kind` discriminates: a `book` module also carries a `book` sub-object whose section table is that Book's versification data, and its id is its Edition Code lowercased.

### Tier
Superseded in v1.1: every translation is a downloadable Module sourced from the bolls.life catalogue (or the BSB release artifact). The online tier and its passage cache were removed with API.Bible.

### Fallback Translation
The single user-configured translation (restricted to installed modules) served when a requested translation is unavailable. Substitution is always visible — the rendered output names the translation actually served. Never applied in the reader's multi-translation stacked view.

### Cross-Reference
A symmetric connection between two or more References that belong together in study (e.g. a shared theme or allusion). All members are mutually connected — there is no direction and no primary member. Not a note: cross-references live in a single plugin-managed data file inside the vault, so they sync and back up with the vault without imposing per-item filenames. Distinct from a Reference: a Reference is an address; a Cross-Reference is an edge between addresses.

### Study Panel
The single right-sidebar surface that follows the last-focused note or reader tab: for a reader, two sub-tabs — Study, with the chapter's Annotations, Mentions, Cross-References, and Word Cloud, and Translations, with the selection's whole text in every installed translation plus tapped-word Strong's details, loaded only while that tab shows; for a note, the same three sections for its referenced scriptures, plus the passages it references. Remembers its state per tab (in memory, for the tab's lifetime). The reader itself shows only scripture text — all companion material lives here.

### Title Bar
The reader's static header naming what is in view (chapter reference or Book section) and owning previous/next stepping. The single stepping surface besides the end-of-content footer nav; pickers live in the nav surfaces, not here.

### Occurrence
One appearance of a reference at a position in a vault note (in the body or in annotation frontmatter). The unit the vault index stores; intersection queries return occurrences.

### Annotation
A vault note dedicated to commenting on a reference, with the reference in its frontmatter as source of truth. Indexed like any note but surfaced in the Study Panel for any chapter or note whose references intersect it.

### Mention
An intersecting note that is not an Annotation: a vault note whose body references overlap the scripture in view. Derived, not declared — a note with a frontmatter ref is always an Annotation, never a Mention, even if its body also references the same verses.

### Tagged Translation
A translation whose module carries word-level Strong's tag spans beside each verse's text, recorded as a capability flag in its manifest. Tags are inert everywhere except the reader's Strong's Mode. Currently BSB (built from the public-domain Berean word-level tables) and KJV (built from bolls.life's `<S>`-tagged dump); the capability is per-translation.

### Strong's Dictionaries
The shared dictionary module (STEPBible TBESH/TBESG plus Strong's 1890 derivations) mapping extended Strong's numbers to lemma, transliteration, gloss, definition, family, morphology, and etymology. One module serves all Tagged Translations; downloading it is what "Enable Strong's" means.

### Strong's Number
The translation-independent identity of an original-language word, and the join key of the whole Strong's system: tag spans, dictionary and lexicon entries, and Concordance Indexes share no other common key. What the Verse Id is to verses, the Strong's number is to words — an arbitrary-but-stable coordinate everything projects onto. The glue is only as fine-grained as the coarsest source keyed by it.

### Strong's Family
A base Strong's number together with its lettered disambiguations (`H4191`, `H4191a`, `H4191b`). Dictionary entries exist at extended-number granularity; occurrence matching is only honest at family granularity, because tagged translations mostly predate disambiguation.

### Word Study Panel
A main-area tab dedicated to one extended Strong's number: the dictionary entries for that number, its etymology chain and sibling entries as walkable links, a collapsible full LSJ entry where the number is Greek and that module is installed, and the family's concordance in one tagged translation at a time — switchable where more than one is installed, and filterable by Rendering. Plain activation retargets the most-recently-focused Word Study Panel; a modified activation opens a new one. Reached from a Strong's entry card in the Study Panel or from a Word Cloud word's menu.

### Concordance Index
The per-translation mapping from Strong's Family to the verses where the family is tagged, each with how many of that verse's words carry it, built when a Tagged Translation module is installed. Counts are of occurrences, not of verses: a verse tagging the family on two words counts twice, while the occurrence list still shows that verse as one row. A concordance is inherently per-text — counts and renderings are only meaningful within one translation.

### Rendering
The surface text a translation uses where a Strong's Family is tagged ("love", "charity"). The unit occurrence lists group and filter by; meaningful only within one translation.

### LSJ Lexicon
The optional Greek-only module (STEPBible TFLSJ, CC BY 4.0) carrying full Liddell-Scott-Jones entries keyed by extended Strong's number. Depth is asymmetric by source availability: no full Hebrew counterpart exists, so Hebrew stays at Strong's Dictionaries depth.

### Strong's Mode
A reader-toolbar toggle (visible only when the viewed translation is tagged and the Strong's Dictionaries are installed) that makes tagged words tappable. Tapping renders the word's dictionary entries in the Study Panel, with CC BY attribution.

### Highlight
A colored span over part of one occurrence's rendered passage, anchored as character offsets into one translation's stored verse text (verse id + start/end chars, end-exclusive). Belongs to that single occurrence — never a vault-wide property of the verse. Exists only while the occurrence displays its requested translation; a substituted (fallback) passage renders none.

### Highlight Cue
The serialized form of a highlight: an option token `h<slot>/<verse>.<start>-<verse>.<end>` inside the reference's curly braces. Machine-canonical (sorted, merged, non-overlapping, split at reference gaps); hand-typed shorthand is accepted but rewritten on the next machine edit.

### Highlight Slot
One of five global, positional color roles (`h1`–`h5`), each with a light-mode and dark-mode color configured in settings. A cue stores only the slot index, so recoloring a slot re-tints every highlight in the vault that uses it. Slots have no names or semantics — they are colors, not tags.

### Heading
A title printed inside a Book section, at one of three levels: *part* (the title a run of chapters sits under), *section*, or *sub-section* (e.g. *7.1 They knew that they were naked*). A heading is attached to the paragraph it precedes. Like an epigraph it lives beside the grid, not on it: a heading consumes no id and is never part of an atom's text, yet it is searched with its paragraph — a Hit may be earned by words that appear only in the heading, and those words are emphasized there. Headings, epigraphs and Figures are the kinds of section furniture.

### Figure
A picture printed inside a Book section — a diagram, a photograph, a plate. Like a Heading it lives beside the grid: it consumes no id, is never part of an atom's text, and is attached to the paragraph it stands with, printing above it or below it as the printed work has it. It carries alt text and an optional caption, and travels inside the module as a data URI, so an installed Book carries its own pictures and reads no file of its own. Unlike a Heading it is never searched — no Hit is ever earned by a figure — and it is not addressable: a reference points at paragraphs only.

### Ref Span
A live reference inside a Book's stored content, parsed at module build time: a character span over one atom's text plus pre-normalized verse ranges (scripture or same-book), stored as a span channel beside the text like Strong's tag spans. Renders as a quiet link (the author's original citation text); tapping navigates the reader to the target. Only explicit citations become ref spans — unreferenced allusions stay plain prose. Ref spans are not Occurrences and never enter the vault index.

### Pinned Translation
The explicit translation token the plugin writes into a reference the moment its first highlight is created, binding the cues' offsets to that translation's text. Changing the translation through plugin UI deletes the cues; hand-editing it leaves them to render best-effort.

### Search Pane
The singleton workspace view (default home: right sidebar, freely movable) for full-text search over installed modules. A query runs on explicit submit against the current Search Scope; results persist while the pane lives, and nothing survives a restart except the scope. Independent of focus — unlike the Study Panel, it never follows the active tab.

### Search Scope
What one query searches over: exactly one Translation, an OT/NT/all testament filter, and the Bible and installed Books each searched or left out — leave the Bible out and the query runs over the selected Books alone, the translation and testament filter inapplicable. Remembered across restarts as per-device configuration; a remembered translation whose module is gone falls back to the Fallback Translation.

### Search Query
One or more words that must all appear in a single atom's text (case- and diacritic-folded, each word matching as a prefix), with quoted phrases required to appear contiguously.

### Hit
One atom (verse or Book paragraph) whose text — together with any Heading attached to it — satisfies the Search Query in the searched module. Hits present in Canonical Grid order, grouped by book, matched words emphasized. Activating a hit opens the reader at that atom through the entry mechanism — banner shown, matched words emphasized until the banner is dismissed.

### Search Index
The persistent per-module structure that answers Search Queries without scanning the module's text. Its lifecycle is the module's: built when the module is installed (or lazily on first use), discarded with it, and rebuilt whole whenever the module's content or the index format changes — never updated incrementally.

### Relative Reference
A reference written without a book (`{:5}`, `{:5-:7}`, `{15:2, :3}`) that borrows its book — and, where a segment names no chapter, its chapter — from its Anchor. Always carries a colon; a bare number is never a relative reference. Valid only when every verse it names lies within the anchor; a chapter-less verse must match exactly one verse in the anchor, and an ambiguous match is invalid. Once a segment names a chapter, later chapter-less segments in the same reference inherit it. Inherits the anchor's translation unless it names its own; accepts the same display options as a full reference. An invalid relative reference is plain text. Indexed as an Occurrence like any reference.

### Anchor
The nearest full Reference earlier in the same note body that a Relative Reference resolves against. Only full references anchor — a relative reference never anchors another, and an invalid one never breaks the chain. Frontmatter references never anchor.

### Word Cloud
The ten Strong's Families occurring most often in the chapter on screen, shown in the Study Panel as the family's most frequent Rendering in that chapter over its transliteration (gloss, lemma and count in the tooltip), each sized by its count and listed one per line, most frequent first, under the heading "Key Words". Counted from the viewed translation when it is a Tagged Translation, otherwise from an installed Tagged Translation named beside the cloud; absent for Books and while Strong's is not enabled. Everything counts except the Cloud Exclusions. Tapping a word opens its menu: toggle Occurrence Emphasis, open its Word Study Panel, or exclude it.

### Cloud Exclusions
The Strong's Families the Word Cloud never shows because their repetition carries no significance: a fixed built-in list — the articles, "to be", "and", the Hebrew object marker, *asher* ("which") and *ki* ("for") — plus a user-maintained global list kept in settings, added to from a cloud word's menu and pruned in the settings tab. Deliberately nothing more built in — prepositions (*in*), quantifiers (*all*), negations and pronouns all stay, since their repetition can matter.

### Occurrence Emphasis
The reader emphasizing every word in the chapter tagged with one Strong's Family, entered from a Word Cloud word's menu and left by choosing it again there, entering it for another word, or leaving the chapter. One family at a time.
