# Editorial marks live in the atom, not as a second layer

Charles 1912 (and any later critical Book) prints editorial marks on the reading. A hideable second text would be a second layer and fight ADR 0002’s one Book / one grid / one Edition Code. Heading-like furniture cannot restyle letters inside a verse. Glyphs in the stored string do not disturb verse ids; Highlights already bind under the Edition Code.

**Decision:** one stored string. Supplied delimiters (Charles `( )`, BSB `[ ]`) are stripped at build; the words stay in the existing `supplied` channel and paint italic + opacity in scripture and Books. Remaining glyphs stay in the text with a `marks` span channel (accent + opacity). Thick type is an `emended` span channel. Spans are baked into the module; the reader parses nothing. A Book with no spans (Humility) is unmarked.

**Rejected:** dual reading/diplomatic strings; hideable apparatus; treating marks as Heading/Figure; leaving supplied brackets in the string and hiding them at render (Highlight offsets would count characters the reader does not show).
