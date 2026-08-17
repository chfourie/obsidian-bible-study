# 05 — Grow a cluster: add members to an existing cross-reference

**What to build:** From a surfaced cross-reference, an "add members" action re-enters the reader's collection flow with the basket pre-loaded with the existing members. I gather more members exactly as in creation (select-and-add, typed entry, free navigation, chip removal), and Create saves back to the *same* cross-reference id — no duplicate entry, description preserved unless edited. Cancel leaves the original untouched.

**Blocked by:** 02 — Collection flow; 04 — Manage in place.

**Status:** done

- [x] "Add members" on a surfaced cross-reference enters Collecting pre-loaded with its members
- [x] Existing members can be removed in the basket too (subject to the ≥2 floor at save)
- [x] Create updates the same entry in place — same id, stable file position, description preserved
- [x] Cancel leaves the stored cross-reference unchanged
- [x] Model-level tests cover pre-loading, save-to-same-id, and cancel semantics
