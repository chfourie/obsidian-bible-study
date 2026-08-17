# 01 — Ship a BSB-derived red-letter verse cue table

**What to build:** The plugin ships with a compact, translation-independent table of red-letter verse cues derived from the BSB source tables at build time — available even when the BSB module is not installed, like versification data. For every verse on the Canonical Grid that contains words of Christ, the cue records whether the verse is fully red or partially red, and for partial verses whether the red portion starts at the verse start and/or ends at the verse end. An accessor exposes the cue for a verse id. The BSB build pipeline gains a step that regenerates the table so it stays in sync with BSB releases.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] A derivation step in the BSB build pipeline emits the cue table from BSB red spans
- [x] The table is shipped with the plugin and loadable without any module installed
- [x] Accessor answers none / full / partial (with red-at-start and red-at-end flags) per verse id
- [x] Unit tests verify known verses: a fully red verse (e.g. Matthew 5:4), a partial verse where speech opens mid-verse (e.g. Matthew 4:7), a verse with no words of Christ, and a verse outside the Gospels with words of Christ (e.g. Acts 9:4 or Revelation 1:8 per BSB's marking)
