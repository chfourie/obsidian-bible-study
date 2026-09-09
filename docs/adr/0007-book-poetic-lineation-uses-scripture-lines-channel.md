# Book poetic lineation uses the scripture poetry `lines` channel

A Book that prints poetry (Charles 1912 *1 Enoch* first) keeps that lineation on the atom. Flattening would throw away Charles’s metrical reading; storing `\n` like a list would make Highlights count layout. One atom per printed verse; stored text space-joined; `lines` holds metrical-line starts, flush, no BSB indent. Stanza blanks are `paragraph: true` on the group’s first line. A prose lead-in in a poetic verse (1:3) is line 0 of the same atom.

**Rejected:** flatten to one prose run; list-style newlines in the stored string; treating page-wrap as a line.
