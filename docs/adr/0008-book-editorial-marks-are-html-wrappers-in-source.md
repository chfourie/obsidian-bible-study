# Book editorial-mark channels are HTML wrappers in the markdown source

The book pipeline infers Ref Spans from the author's words and otherwise stores curator prose as-is. Editorial marks cannot be inferred: supplied delimiters are stripped, stay-glyphs must be identified, thick type is not a character, and English `()` / `[]` / `<` collide. Charles 1912 is the first instance; a later critical Book must use the same parser.

**Decision:** curator wraps the three channels as HTML named elements in atom text and epigraphs: `<supplied>`, `<marks>`, `<emended>`. Wrappers never stored; inner text is the span. One `<marks>` for every stay-glyph (kind lives in the glyph). Well-formed per atom: exact lowercase, no attributes, nest ok; overlap, unknown element, empty wrap, or raw `<` fails the build. A run that crosses atoms closes at the first atom's end and reopens at the next.

**Rejected:** infer from Charles's printed glyphs; write `(even)` / `=word=`; `{named}`-family braces; typed Charles elements (`<interpolation>` …); BSB-style cross-atom open state.
