# 03 — References panel rows for intersecting cross-references

**What to build:** The References panel, alongside its existing occurrence rows, lists every cross-reference with a member intersecting the current passage — showing the other members and the description, with the same tap-to-navigate behaviour as the reader surface. Rows update live when cross-references change. Wired explicitly through the CrossReferenceStore (cross-references are not notes, so occurrence indexing does not apply).

**Blocked by:** 01 — Read-path tracer.

**Status:** done

- [x] Cross-references intersecting the panel's current passage appear as rows; non-intersecting ones do not
- [x] A row shows the other members and the description; tapping a member navigates the reader
- [x] Store changes (create/edit/delete) update the panel live
- [x] Model-level tests through the references-panel-model seam cover matching, row content, and live updates
