# 04 — Manage in place: edit description, remove member, delete

**What to build:** Wherever a cross-reference surfaces (reader details, References panel), I can manage it in place: edit the description inline, remove a member, or delete the whole cross-reference behind a confirmation step. Changes persist through the store and every surface reflects them live. Removing members below 2 is prevented — a cross-reference always has at least two members (delete it instead). No standalone manager view.

**Blocked by:** 02 — Collection flow (store write path lands there; serializing after it avoids write-path collisions).

**Status:** done

- [x] Description is editable inline where the cross-reference surfaces; clearing it leaves a cross-reference with no description
- [x] A member can be removed in place; removal that would leave fewer than 2 members is blocked with an explanation
- [x] Delete asks for confirmation, then removes the entry from the data file
- [x] All mutations persist deterministically and update reader and panel surfaces live
- [x] Model-level tests cover each mutation, the 2-member floor, and persistence
