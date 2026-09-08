# Book atom is the work's printed citable unit

ADR 0002 set Book atoms in the same `BBBCCCVVV` space with `VVV` = paragraph, because *Humility* (and later *IN*) has no verse numbers. *1 Enoch* is cited as chapter:verse (`{1 Enoch 1:9}` = Jude's quote). Treating blank-line paragraphs as atoms would make every scholarly citation miss. We keep one Book id space and one module grid, but the atom is the work's smallest printed citable unit: paragraph where the print has paragraphs, printed verse where it has verses. *1 Enoch* uses R.H. Charles 1912 numbering; the first published module still freezes that grid. Reverting to "paragraph always" would be a new module identity, not a renumber.

**Refines** ADR 0002's "atom = paragraph" clause. Book numbers, grid freeze, edition code, and discovery are unchanged.
