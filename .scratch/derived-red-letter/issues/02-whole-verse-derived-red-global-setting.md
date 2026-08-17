# 02 — Whole-verse derived red letter behind a global setting

**What to build:** A new global setting "Derived red letter" (default off) in the plugin settings tab. When enabled, any translation whose module carries no native red-letter spans renders verses that the cue table marks as containing words of Christ in red — whole-verse granularity in this slice: fully red verses AND partially red verses both render entirely red (partial precision arrives in ticket 03). Applies everywhere passages render (reader, note rendering, live preview). Translations with native red spans (BSB) are untouched. With the setting off, behavior is exactly as today.

**Blocked by:** 01 — Ship a BSB-derived red-letter verse cue table.

**Status:** done

- [x] Global setting appears in the settings tab, default off, persisted
- [x] With setting on, a translation without native red spans (e.g. WEB, KJV) renders cue-marked verses in red in the reader and in rendered references
- [x] BSB rendering is unchanged regardless of the setting
- [x] With setting off, no derived red anywhere
- [x] Verses with no cue render plain
