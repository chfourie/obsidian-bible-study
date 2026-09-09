# Section `reading` is an optional page-order list

Atom `text` + `lines` stay letter order (ADR 0010). The chapter reader and multi-atom notes need Charles’s page, where atoms interleave (6a 6b **7c** 6d…). Per-line ordinals scatter a section fact onto lines and force dummy `lines` on prose. A sidecar file is a third book-only artifact for a rare permutation.

**Decision:** optional `reading` on `BookSection` (manifest): `{ atom, line? }[]` in page order. `atom` is `VVV` in that section; `line` is the 0-based index into that atom’s letter-order `lines`; omit `line` only for a whole prose atom (no `lines`). Line letter is `letter?: string` on `VerseLine` (`"a"`), omitted when unlettered — not in the stored string, not on the step. Absent `reading` means atoms `1..N`, each atom’s `lines` in stored order (*Humility*, *IN*, most 1 Enoch chapters). Present only when that walk is not the page; then it is the full section walk. No format-version bump (ADR 0009).

Build, when `reading` is present: every atom `1..N` at least once; atom with `lines` — each index exactly once, no whole-atom step; atom without — exactly one `{ atom }`; `line` in range; duplicate `(atom, line)` fails (cite the section). Loader: present → that walk; absent → `1..N` × stored `lines`.

**Rejected:** `order` on `VerseLine`; sidecar (`reading.json`); pointer by `start` or by letter; storing an identity permutation.
