# Optional Book channels do not bump book format version

Headings, Figures, and table cells each bumped `BOOK_MODULE_FORMAT_VERSION` even though an older Book loads correctly with those fields absent. Editorial-mark channels (`marks`, `emended`; `supplied` reused) are the same kind of optional atom furniture. Bumping would not change load behaviour — it would only retell “unmarked” as a format number.

**Decision:** `BOOK_MODULE_FORMAT_VERSION` stays **8**. `supplied`, `marks`, and `emended` are general optional fields on every Book atom and epigraph. Unmarked Books omit them (*Humility* at 5, *IN* at 8). 1 Enoch publishes at 8 and populates them. Book `supplied` is the translation verse field (`FormatSpan[]`); no twin, no `suppliedWords` / marks / emended capability flags. A later bump happens only when an older installed Book would load *wrong*, not when it merely lacks a new optional channel. A once-off re-release of lagging books at the current book format version is allowed if that shrinks implementation; content is unchanged, and the constant is still not bumped.

**Rejected:** bump to 9 so installed books “load with empty channels”; a 1 Enoch–only schema; a Book-only `supplied` field; capability flags for these channels; bumping on every new optional Book channel.
