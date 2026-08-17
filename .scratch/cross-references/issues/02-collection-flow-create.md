# 02 — Collection flow: create a cross-reference from the reader

**What to build:** While reading, I can start a cross-reference collection and a basket bar appears in the reader pane. I gather members by selecting verses and adding the selection (which clears the selection), or by typing a reference as text; members show as removable chips. Navigation — book, chapter, translation — leaves the basket untouched. Cancel discards it. Create is enabled only at ≥2 members, prompts for an optional short description, persists the new cross-reference, and exits collection; the new cross-reference surfaces immediately wherever it intersects. The basket is ephemeral: in-memory, scoped to the reader pane, gone if the pane closes.

The state machine (Idle → Collecting) lives in the reader pane model, building on the existing verse-selection-to-Reference conversion and the existing reference grammar for typed entries. Create goes through the CrossReferenceStore write path: deterministic serialization — stable ordering, one entry per line — so sync merges usually succeed (last-write-wins accepted per ADR-0003).

**Blocked by:** 01 — Read-path tracer.

**Status:** done

- [x] Start action enters Collecting; a basket bar shows in the reader pane
- [x] Add-selection pushes the current verse selection as a member chip and clears the selection; typed references parse with the existing grammar and reject invalid input visibly
- [x] Chips can be removed; book/chapter/translation navigation preserves the basket
- [x] Cancel discards the basket and returns to Idle; closing the pane discards it too
- [x] Create is disabled below 2 members; on Create an optional description can be entered or skipped
- [x] Create persists via the store and the cross-reference immediately surfaces beside intersecting verses
- [x] The data file round-trips deterministically: unchanged content saves byte-identical, entries keep stable order, one entry per line
- [x] Model-level tests cover all state transitions, the ≥2 gate, basket survival across navigation, and write-path determinism
