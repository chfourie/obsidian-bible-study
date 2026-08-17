# 04 — Per-reader-pane red-letter toggle

**What to build:** Each reader pane gains a toolbar toggle for derived red letter, following the same pattern as the Strong's Mode toggle. The global setting supplies the default for a pane; the pane's toggle overrides it in either direction (a pane can turn derived red on while the global is off, and off while the global is on). Panes the user never toggled keep following the global setting live; once the user touches the pane's toggle, that pane keeps its own choice. The override (not the untouched default) persists with the pane's other view state, so untouched panes reopen on the current global. Toggling updates the rendered passage immediately. The toggle only affects derived red letter — native BSB red spans keep rendering regardless.

**Blocked by:** 02 — Whole-verse derived red letter behind a global setting.

**Status:** done

- [x] Reader toolbar shows a derived red-letter toggle
- [x] New panes start from the global setting's value
- [x] Pane toggle overrides the global in both directions and re-renders immediately
- [x] Pane state persists across reopen like other pane toggles
- [x] Untouched panes follow global setting changes live; user-toggled panes keep their choice
- [x] Toggling mid-load refetches instead of landing the stale repository's passage
- [x] Toggle has no effect on translations with native red spans
