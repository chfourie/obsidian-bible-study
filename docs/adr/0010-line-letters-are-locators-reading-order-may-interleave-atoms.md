# Line letters are locators; chapter reading order may interleave atoms

Charles 1912 (and any verse-atom Book that does this) labels metrical lines `6a` / `7c` and sometimes prints a line of verse 7 inside verse 6’s poem. The atom stays the printed verse (ADR 0005); `{1 Enoch 5:6a}` is not a cite. Letters are not Editorial marks (ADR 0006) and are not stored text — Highlights would count chrome. They paint as `6a` in the verse-number slot, same On/Hover.

Stored `lines` on the atom are **letter order** (5:7 = 7a, 7b, 7c). The section’s **reading order** is Charles’s page, so atoms interleave. Opening 5:7 lands on 7c (first print appearance). Notes `block` show letters; `inline` omits. A multi-atom note uses reading order.

**Rejected:** letters in the stored string; dropping them; grouping the reader by atom; storing dislocated text on the printed neighbour; page-order as the atom string (neither the traditional verse nor the page). Module encoding of the page walk: [ADR 0013](0013-section-reading-is-an-optional-page-order-list.md).
