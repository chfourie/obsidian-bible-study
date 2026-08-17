# 03 — Quote-punctuation anchoring for partially red verses

**What to build:** Partially red verses stop rendering entirely red and instead anchor the red span to quotation punctuation in the target translation's own text. Using the cue's red-at-start / red-at-end flags: when red does not start at the verse start, the red span begins at the first opening double-quote mark; when red does not end at the verse end, it ends at the last closing double-quote mark. Both straight (") and typographic (“ ” „ « ») double-quote forms count. Single quotes are nested quotations inside speech and never open or close a red span. When a partial verse's text contains no double-quote mark (e.g. KJV, which prints no quotation marks), the whole verse renders red — words of Christ are never silently dropped.

**Blocked by:** 02 — Whole-verse derived red letter behind a global setting.

**Status:** done

- [x] A verse where speech opens mid-verse (e.g. "Jesus said, “Follow Me…”") renders the narrative frame plain and the quoted speech red
- [x] A verse where speech closes mid-verse renders red up to the closing double quote, plain after
- [x] Single quotes inside the speech do not terminate or start the red span
- [x] Typographic and straight double-quote variants all anchor correctly
- [x] Partial verse with no double quotes in the target text renders entirely red
- [x] Fully red verses are unaffected by this ticket
