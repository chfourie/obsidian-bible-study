# Spec — Cross-References

**Status:** ready-for-agent

## Problem Statement

While studying scripture I constantly notice that passages belong together — a shared theme, an allusion, a quotation (e.g. the vine imagery of John 15 and Israel-as-vineyard in Psalm 80 and Romans 11). Today the plugin has no way to record such a connection. The insight lives only in my head or buried in annotation prose, and when I later read one of the connected passages nothing reminds me of the others. I want to capture these connections while reading, with minimal friction, and have them resurface automatically whenever I read any of the connected passages.

## Solution

Introduce the **Cross-Reference**: a symmetric, n-ary connection between two or more References. All members are mutually connected — no direction, no primary member — and an optional short description records why they belong together. (See CONTEXT.md for the canonical glossary entry.)

Cross-references are created from the reader through a lightweight collection flow: I start collecting, gather member references by selecting verses (and/or typing references as text) while navigating freely, then create the cross-reference once at least two members are gathered. Whenever I read a passage that intersects any member, the cross-reference surfaces in the reader beside the intersecting verses, listing the *other* members; tapping a member navigates the reader there, where the cross-reference surfaces again — making it natural to hop around a cluster. Cross-references also appear in the References panel for the passage being viewed. They are managed entirely in place: edit the description, add or remove members, or delete — no dedicated manager view.

Cross-references are not vault notes. They live in a single plugin-managed data file inside the vault, so they sync and back up with the vault without imposing per-item filenames or unique titles.

## User Stories

1. As a reader, I want to start a cross-reference collection from the reader, so that I can capture a connection the moment I notice it mid-study.
2. As a reader, I want to add my current verse selection to the collection basket, so that I don't retype the passage I am literally looking at.
3. As a reader, I want to navigate to other books, chapters, and translations while collecting without losing my basket, so that I can gather members from across the canon in one flow.
4. As a reader, I want to type a reference as text into the basket, so that I can add a member I already know by address without navigating to it.
5. As a reader, I want to see the gathered members as chips in a basket bar, so that I can review what the cross-reference will contain before creating it.
6. As a reader, I want to remove a chip from the basket, so that I can correct a mis-added member without starting over.
7. As a reader, I want to cancel collection, so that an abandoned train of thought leaves no residue.
8. As a reader, I want the Create action enabled only once the basket holds at least two members, so that I cannot create a degenerate cross-reference.
9. As a reader, I want to optionally attach a short description when creating, so that the reason for the connection is preserved.
10. As a reader, I want to skip the description when the connection is self-evident, so that quick captures stay frictionless.
11. As a reader, I want a cross-reference member to be a full Reference (one book, possibly multiple verse ranges), so that a member can be as precise as `John 15:4-6,9`.
12. As a reader, I want cross-references whose members intersect the passage I am viewing to surface beside the intersecting verses, so that connections resurface exactly where they are relevant.
13. As a reader, I want a surfaced cross-reference to show the *other* members (not the one I am reading) plus its description, so that what I see is the jump-off points, not noise.
14. As a reader, I want to tap a surfaced member to navigate the reader to that passage, so that following a connection is one tap.
15. As a reader, I want the cross-reference to surface again at the destination, so that hopping around a cluster of connected passages is natural.
16. As a reader, I want cross-references intersecting the current passage listed in the References panel, so that connections and note occurrences are visible side by side.
17. As a reader, I want to edit a cross-reference's description in place wherever it surfaces, so that I can refine the "why" without hunting for a management screen.
18. As a reader, I want to add members to an existing cross-reference by re-entering the collection flow pre-loaded with its members, so that growing a cluster reuses the flow I already know.
19. As a reader, I want to remove a member from an existing cross-reference in place, so that I can prune a cluster that grew too broad.
20. As a reader, I want to delete a cross-reference with a confirmation step, so that removal is possible but not accidental.
21. As a vault owner, I want all cross-references stored in a single plugin-managed data file inside my vault, so that they sync and back up with the vault.
22. As a vault owner, I want the data file written deterministically (stable ordering, one entry per line), so that sync-tool merges usually succeed and diffs stay readable.
23. As a multi-device user, I accept last-write-wins on rare concurrent edits to the data file, so that the design stays simple for a single-user plugin.
24. As a reader, I want cross-references addressed on the Canonical Grid, so that a connection captured while reading one translation surfaces identically in every translation.

## Implementation Decisions

- **Domain model** (recorded in CONTEXT.md): a Cross-Reference is a symmetric connection between two or more References; members are mutually connected; no direction, no primary member; optional short description. A Reference is an address; a Cross-Reference is an edge between addresses.
- **Storage**: a single plugin-managed data file inside the vault (not the plugin data dir — that space is never synced, and cross-references are irreplaceable user-authored data; not per-item notes — rejected to avoid filename/title-uniqueness pressure). Each cross-reference carries an internal id, its member references, and the optional description. Serialization is deterministic: stable ordering, one entry per line. Concurrent-edit clobbering across devices is accepted (last-write-wins); no conflict-resolution machinery.
- **New module — CrossReferenceStore**: the single new seam. Owns the data file: load/save, create/update/delete, member add/remove, and intersection queries (`which cross-references have a member intersecting this reference`), using the existing verse-range interval operations on the Canonical Grid. File access goes through a port with an Obsidian vault adapter, mirroring the existing annotation-vault split.
- **Collection state machine**: lives in the reader pane model (the existing highest seam). States: Idle → Collecting. While Collecting: add current verse selection as a member (via the existing selection-to-Reference conversion, clearing selection), add a typed reference (parsed with the existing reference grammar), remove members, navigate freely (basket untouched by book/chapter/translation changes), Cancel (discard), Create (≥2 members; prompts optional description; persists via CrossReferenceStore; exits to Idle). Editing an existing cross-reference's members re-enters Collecting pre-loaded with its members and saves back to the same id.
- **Basket durability**: ephemeral, in-memory, scoped to the reader pane. Closing the pane or the app mid-collection discards it.
- **Surfacing**: intersection-matched on the Canonical Grid, wired explicitly (cross-references are not notes, so occurrence indexing does not apply). Two surfaces: the reader (beside intersecting verses, in the same details surface annotations use, showing the other members and the description) and the References panel (a row per intersecting cross-reference). Both reflect store changes live.
- **Interaction**: tapping a surfaced member navigates the reader to that member's passage using the existing reference-navigator contract.
- **Management**: in place only — inline description edit, add members (collection flow), remove member, delete with confirm. No standalone browse-all view.
- **Creation surfaces deliberately omitted**: no command-palette "create cross-reference" modal flow; the reader collection flow and direct data-file knowledge are sufficient.

## Testing Decisions

- Tests exercise external behavior at model seams, never implementation details; Obsidian stays behind fakes.
- **CrossReferenceStore** is tested against a fake file port: round-trip determinism (same content → byte-identical file), CRUD, member editing, and intersection queries including multi-range members and boundary overlaps. Prior art: `annotation-vault.spec` / `obsidian-annotation-vault.spec` and the vault-index specs.
- **Collection state machine** is tested through the existing reader-pane-model spec surface: start/add-selection/add-typed/remove/cancel/create transitions, the ≥2-member Create gate, basket survival across navigation, basket pre-loading when editing an existing cross-reference. Prior art: `reader-pane-model.spec.ts` selection tests.
- **Surfacing** is tested through the existing reader-pane-model and references-panel-model spec surfaces: a stored cross-reference intersecting the viewed passage appears (showing only the *other* members), non-intersecting ones do not, and store mutations update the surfaces. Prior art: `references-panel-model.spec.ts`.
- The Svelte components stay thin over the models, consistent with the codebase's existing approach (no component-level tests).

## Out of Scope

- Directed cross-references (source → target semantics).
- Cross-references as vault notes, per-item files, or human-titled entities.
- A standalone "browse all cross-references" manager view.
- A command-palette creation flow with a reference-entry modal.
- Sync conflict resolution beyond deterministic formatting and last-write-wins.
- Importing published cross-reference sets (e.g. Treasury of Scripture Knowledge).
- Persisting a half-built collection basket across pane close or app restart.
- Surfacing cross-references in note editing/preview contexts (only the reader and References panel).

## Further Notes

- The glossary entry lives in CONTEXT.md under **Cross-Reference**; the naming deliberately avoids overloading **Reference**, which remains "an address into scripture".
- During grilling, storage moved from per-cross-reference vault notes (original lean) to the single data file after the title-uniqueness pressure of note filenames surfaced; the ADR-worthy trade-off is that this deviates from the vault-notes-as-truth pattern set by Annotations.
- Members are stored on the Canonical Grid, so intersection semantics are identical to the existing occurrence intersection model.
