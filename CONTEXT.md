# Scripture Study — Ubiquitous Language

## Terms

### Reference
A pointer to scripture in exactly one book: a book plus a set of verse ranges (e.g. `John 15:4-6,9`). Written in notes with the curly-brace grammar. A reference never crosses a book boundary.

### Canonical Grid
The fixed, translation-independent numbering of all verses in the 66-book Protestant canon, following KJV versification (~31,102 verses). Every reference, intersection, and cache key lives on this grid. A translation that omits or renumbers a verse has a content gap at that grid position — the grid itself never changes per translation.

### Verse Id
The canonical internal identity of an atom: a BCV-encoded integer `BBBCCCVVV` (book number, chapter, atom-within-chapter — e.g. John 15:4 = 043015004). Scripture occupies book numbers 1-66 (Protestant/OSIS order) with the verse as atom; 67-100 are reserved for canon extensions; non-biblical Books start at 101 with the work's smallest printed citable unit as atom (paragraph or printed verse). Ids are stable forever: adding books later never renumbers existing atoms. Book/chapter/atom is derivable by arithmetic; validity and adjacency come from versification data.

### Book
A non-biblical work (e.g. *Humility*, Andrew Murray; *1 Enoch*) addressable on the same id space as scripture, with a Book Registry-assigned book number ≥ 101 and the work's smallest printed citable unit as its atom — a paragraph in *Humility* and *IN*, a printed verse in *1 Enoch*. Sections (front matter, printed chapters, back matter) take chapter numbers in reading order, keeping printed numbers where they exist. One book = one module = one grid — editions are not modeled as translations; the module's Edition Code fills the translation slot wherever one is required.

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
A symmetric connection between two or more References that belong together in study (e.g. a shared theme or allusion). All members are mutually connected — there is no direction and no primary member. A vault note dedicated to the connection: its members and a one-line summary live in frontmatter as source of truth, and its body is the user's own room for as much further material as they like. Its filename is organisation only. Distinct from a Reference: a Reference is an address; a Cross-Reference is an edge between addresses.

### Study Panel
The single right-sidebar surface that follows the last-focused note or reader tab: for a reader, two sub-tabs — Study, with the chapter's Annotations, Mentions, Cross-References, and Word Cloud, and Translations, with the selection's whole text in every installed translation plus tapped-word Strong's details, loaded only while that tab shows; for a note, the same three sections for its referenced scriptures, plus the passages it references. Annotations and referenced passages are folded rows, each opened and closed one at a time or all at once from its section's heading; passages start folded, annotations start folded or open as a global setting chooses. Remembers its state per tab (in memory, for the tab's lifetime). The reader itself shows only scripture text — all companion material lives here.

### Title Bar
The reader's static header naming what is in view (chapter reference or Book section) and owning previous/next stepping. The single stepping surface besides the end-of-content footer nav; pickers live in the nav surfaces, not here.

### Occurrence
One appearance of a reference at a position in a vault note (in the body, or declared in Annotation or Cross-Reference frontmatter). The unit the vault index stores; intersection queries return occurrences.

### Annotation
A vault note dedicated to commenting on a reference, with the reference in its frontmatter as source of truth. Indexed like any note but surfaced in the Study Panel for any chapter or note whose references intersect it.

### Mention
An intersecting note that is neither an Annotation nor a Cross-Reference: a vault note whose body references overlap the scripture in view. Derived, not declared — a note declaring a reference in its frontmatter is always an Annotation or a Cross-Reference, never a Mention, even if its body also references the same verses. A note under one of the settings' excluded folders (the folder itself or any folder below it) is never a Mention either, though what it declares still counts.

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

### Underline
A line drawn under part of one occurrence's rendered passage, anchored exactly as a Highlight is (verse id + start/end chars into one translation's stored verse text, per occurrence). A channel of its own, not a Highlight: an Underline and a Highlight may cover the same characters, and each is added, merged and removed without touching the other. Painted in one of five Underline Slots.
_Avoid_: sixth slot

### Underline Slot
One of five global, positional colour roles (`u1`–`u5`) for Underlines, each with a light-mode and dark-mode colour configured in settings, never washed. Parallel to the Highlight Slots but independent of them: a cue stores only the slot index, and recolouring a slot re-tints every underline in the vault that uses it. Within the underline channel, slots are exclusive on a character as Highlight Slots are.

### Highlight Cue
The serialized form of a highlight: an option token `h<slot>/<verse>.<start>-<verse>.<end>` inside the reference's curly braces. Machine-canonical (sorted, merged, non-overlapping, split at reference gaps); hand-typed shorthand is accepted but rewritten on the next machine edit. Underlines (`u<slot>/…`) and Excerpt parts (`x/…`) serialize as sibling token families with the same canon, each family kept independently of the others.

### Highlight Slot
One of five global, positional color roles (`h1`–`h5`), each with a light-mode and dark-mode color configured in settings and rendered through the Highlight Wash. A cue stores only the slot index, so recoloring a slot re-tints every highlight in the vault that uses it. Slots have no names or semantics — they are colors, not tags.

### Highlight Wash
The single per-mode translucency — one value for light mode, one for dark — applied to every Highlight Slot's color, so a slot color always tints the text without hiding it. Configured in settings alongside the slots, never per slot; resetting the highlights restores the slots' colors and the wash together.

### Excerpt
The parts of one occurrence's passage that display; everything outside them is elided and stands as an ellipsis. Anchored like a Highlight: character offsets into one translation's stored verse text, belonging to that single occurrence and never a vault-wide property of the verse. May be several non-joining parts. An occurrence with no Excerpt shows its whole passage. Decoration only — the Occurrence still points at whole verses, and a Highlight over elided text lies dormant rather than being lost.
_Avoid_: clip, trim, snippet

### Passage Editing
A Live Preview mode on one occurrence, entered from a control that appears while hovering a displayed passage, in which the whole passage shows (elided text faded, not hidden) and its Highlights, Underlines and Excerpt are added, changed and removed. Left with Done, Escape or a click outside. Only one occurrence is in Passage Editing at a time; never offered in reading mode, on mobile, or on a fallback-served passage.
_Avoid_: mark mode, annotate mode (Annotation is a note)

### Verse Gap
Two consecutive verses of one reference that are not adjacent on the Canonical Grid (`John 15:4-6,9` has one between 6 and 9). Adjacency across a chapter boundary is not a gap. Wherever the reference's passage renders as text, an ellipsis stands at the gap.

### Heading
A title printed inside a Book section, at one of three levels: *part* (the title a run of chapters sits under), *section*, or *sub-section* (e.g. *7.1 They knew that they were naked*). A heading is attached to the paragraph it precedes. Like an epigraph it lives beside the grid, not on it: a heading consumes no id and is never part of an atom's text, yet it is searched with its paragraph — a Hit may be earned by words that appear only in the heading, and those words are emphasized there. Headings, epigraphs and Figures are the kinds of section furniture.

### Figure
A picture printed inside a Book section — a diagram, a photograph, a plate. Like a Heading it lives beside the grid: it consumes no id, is never part of an atom's text, and is attached to the paragraph it stands with, printing above it or below it as the printed work has it. It carries alt text and an optional caption, and travels inside the module as a data URI, so an installed Book carries its own pictures and reads no file of its own. Unlike a Heading it is never searched — no Hit is ever earned by a figure — and it is not addressable: a reference points at paragraphs only.

### Footnote
A note an edition prints on an atom, attached by character offset into the atom's stored text. Consumes no id and is never a Reference. Lifted out of the stored string — Highlights and Ref Spans bind the atom only. Surfaces only in the Study Panel for the selected atom: no marker on the page, and chip / inline / block never show a marker or a body. Footnote words never earn a Hit.
_Avoid_: endnote, apparatus (Editorial marks are not footnotes)

### Curator comment
A `%%` line in a curated source, the curator's own and never stored: the parser drops it before reading anything else. A **waiver** is one that names a marked atom the edition gives no note for (`%% waived C:V — reason`), taking it off the build's Footnote to-do; the build fails on a waiver whose atom is not on that to-do.
_Avoid_: HTML comment (a `<` can never stand in atom text)

### Ref Span
A live reference inside a Book's stored content, parsed at module build time: a character span over one atom's text plus pre-normalized verse ranges (scripture or same-book), stored as a span channel beside the text like Strong's tag spans. Renders as a quiet link (the author's original citation text); tapping navigates the reader to the target. Only explicit citations become ref spans — unreferenced allusions stay plain prose. Ref spans are not Occurrences and never enter the vault index.

### Supplied
Words an editor or translator inserted into the reading that are not in the source — Charles's parentheses, a Tagged Translation's brackets. The delimiters are dropped from stored text; the words remain in the atom and are painted italic at a reduced opacity, the same treatment in scripture and Books. The opacity is a single global setting.

### Emended
Words an editor has altered in the reading (Charles's thick type). Not a character in the stored string; identified beside it like Supplied. Paints as bold, unfaded.
_Avoid_: thick type (print description, not the channel)

### Editorial marks
The printed critical marks of a Book edition (version and interpolation brackets, restorations, daggers, lacuna points, emendation). Not a second layer and not Heading/Figure furniture: they sit on the atom's characters. Mark glyphs except supplied delimiters live in the stored text; supplied words and emendations are identified beside it. A Book with none is unmarked. Highlights, Hits, and Ref Spans bind to that stored string. Mark glyphs paint in the accent color at a reduced opacity, a second global setting from supplied.

### Line letter
A print locator on a metrical line of a verse-atom Book (Charles `6a`, `7c`). Not an atom, not an Editorial mark, and not in the stored string — Highlights, Hits, and Ref Spans never see it. Paints in the verse-number slot as `6a` when verse numbers show.
_Avoid_: sub-verse, stich label, lettered verse (implies a new atom)

### Pinned Translation
The explicit translation token the plugin writes into a reference the moment its first highlight is created, binding the cues' offsets to that translation's text. Changing the translation through plugin UI deletes the cues; hand-editing it leaves them to render best-effort.

### Search Pane
The singleton workspace view (default home: right sidebar, freely movable) for full-text search over installed modules. A query runs on explicit submit against the current Search Scope; results persist while the pane lives, and nothing survives a restart except the scope. Independent of focus — unlike the Study Panel, it never follows the active tab.

### Search Scope
What one query searches over: exactly one Translation, an OT/NT/all testament filter, and the Bible and installed Books each searched or left out — leave the Bible out and the query runs over the selected Books alone, the translation and testament filter inapplicable. Remembered across restarts as per-device configuration; a remembered translation whose module is gone falls back to the Fallback Translation.

### Search Query
One or more words that must all appear in a single atom's text (case- and diacritic-folded, each word matching as a prefix), with quoted phrases required to appear contiguously.

### Hit
One atom (verse or Book paragraph) whose text — together with any Heading attached to it — satisfies the Search Query in the searched module. Footnotes do not participate. Hits present in Canonical Grid order, grouped by book, matched words emphasized. Activating a hit opens the reader at that atom through the entry mechanism — banner shown, matched words emphasized until the banner is dismissed.

### Search Index
The persistent per-module structure that answers Search Queries without scanning the module's text. Its lifecycle is the module's: built when the module is installed (or lazily on first use), discarded with it, and rebuilt whole whenever the module's content or the index format changes — never updated incrementally.

### Relative Reference
A reference written without a book (`{:5}`, `{:5-:7}`, `{15:2, :3}`) that borrows its book — and, where a segment names no chapter, its chapter — from its Anchor. Always carries a colon; a bare number is never a relative reference. Valid only when every verse it names lies within the anchor; a chapter-less verse must match exactly one verse in the anchor, and an ambiguous match is invalid. Once a segment names a chapter, later chapter-less segments in the same reference inherit it. Inherits the anchor's translation unless it names its own; accepts the same display options as a full reference. An invalid relative reference is plain text. Indexed as an Occurrence like any reference.

### Anchor
The nearest full Reference earlier in the same note body that a Relative Reference resolves against. Only full references anchor — a relative reference never anchors another, and an invalid one never breaks the chain. Frontmatter references never anchor.

### Word Cloud
The ten Strong's Families occurring most often in the chapter on screen, shown in the Study Panel as the family's most frequent Rendering in that chapter over its transliteration (gloss, lemma and count in the tooltip), each sized by its count and listed one per line, most frequent first, under the heading "Top Words". Counted from the viewed translation when it is a Tagged Translation, otherwise from an installed Tagged Translation named beside the cloud; absent for Books and while Strong's is not enabled. Everything counts except the Cloud Exclusions. Tapping a word toggles its Occurrence Emphasis; a right-click (or the context-menu key) opens its menu — highlight, open its Word Study Panel, exclude it from this view, or (after confirming) exclude it everywhere by adding it to the user's Cloud Exclusions — drawn in-house like the ribbon menu, not by Obsidian.

### Cloud Exclusions
The Strong's Families the Word Cloud never shows because their repetition carries no significance: a fixed built-in list — the articles, "to be", "and", the Hebrew object marker, *asher* ("which") and *ki* ("for") — plus a user-maintained global list kept in settings (added to from a cloud word's menu behind a confirmation, pruned in the settings tab), plus the families a reader excludes from one reader view's cloud through a word's menu — held by that view for its lifetime, never shared or saved, and cleared from the same menu. Deliberately nothing more built in — prepositions (*in*), quantifiers (*all*), negations and pronouns all stay, since their repetition can matter.

### Occurrence Emphasis
The reader emphasizing every word in the chapter tagged with one Strong's Family, entered by tapping a Word Cloud word (or from its menu) and left by tapping it again, entering it for another word, or leaving the chapter. One family at a time.

### Christ Quote
A double-quoted span in a vault note that the author declares to be the words of Christ by prefixing the opening mark with a lowercase `c` at a word start: `c"Abide in me"`. Straight or curly double quotes, closing mark matching the opening, closed within the same paragraph; unterminated or mid-word (`Isaac"…"`) is plain text. Renders with the `c` hidden and the quote, marks included, in the same red-letter colour as a Translation's own words of Christ; markdown inside the quote renders as usual. An ellipsis inside the quote (`...` or `…`) is the author's elision and keeps the normal text colour. Escaped by a backslash before the opening mark (`c\"…"`). Decoration only — never an Occurrence, never indexed. Distinct from derived red-letter, which comes from translation data, not the author.
_Avoid_: red quote, red-letter note (implies translation data)

### Page Break
A note-author's instruction that the PDF export start a new page here: a line holding exactly `===` with a blank line or the note edge before it (text may follow on the next line; `===` under a line of text is a heading underline). On screen it is a visible marker, never a heading rule; in print it is invisible and breaks the page after itself. Consecutive Page Breaks each break; one with nothing after it in the note breaks nothing. Only notes carry Page Breaks — never scripture or Book text in the reader or the Study Panel; a note body rendered there (an Annotation) is still a note.
_Avoid_: line break (a `<br>`), horizontal rule (`---`, which prints a line and breaks no page)
