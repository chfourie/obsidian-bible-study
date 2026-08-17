# 01 — Read-path tracer: hand-authored cross-references surface in the reader

**What to build:** A cross-reference hand-written into the plugin-managed data file in the vault surfaces while reading: whenever the viewed passage intersects any member, the cross-reference appears beside the intersecting verses in the reader's details surface, showing the *other* members and the optional description. Tapping a member navigates the reader to that passage, where the cross-reference surfaces again. This is the tracer bullet: it proves storage, Canonical Grid intersection matching, surfacing, and navigation end to end before any authoring UI exists.

Per ADR-0003, cross-references live in a single plugin-managed data file inside the vault (not notes, not the plugin data dir). The store reads it through a file port with an Obsidian vault adapter, mirroring the annotation-vault split. Each entry carries an internal id, member References (full Reference shape: one book, possibly multiple verse ranges), and an optional description.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] CrossReferenceStore loads the data file via a file port (Obsidian adapter for the real vault, fake for tests) and tolerates a missing file as "no cross-references"
- [x] Intersection query returns the cross-references with at least one member intersecting a given Reference, using existing verse-range interval operations on the Canonical Grid
- [x] A cross-reference intersecting the viewed passage renders beside the intersecting verses, listing only the *other* members plus the description; non-intersecting cross-references do not appear
- [x] Tapping a listed member navigates the reader to that member's passage (existing reference-navigator contract) and the cross-reference resurfaces there
- [x] Surfacing is translation-independent: the same cross-reference appears in any viewed translation
- [x] Model-level tests cover store loading, intersection queries (multi-range members, boundary overlap, no overlap), and reader surfacing through the reader pane model seam
