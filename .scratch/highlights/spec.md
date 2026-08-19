## Problem Statement

When I render a Passage in a note (`inline` or `block`), the whole passage reads with equal weight. In real study I mark the phrases that matter — a promise, a command, a keyword thread — the way I would with physical highlighters in a paper bible. Today there is no way to mark up a rendered passage: anything I want to emphasize has to be restated in my own prose, and the emphasis is lost when I reread the passage itself.

## Solution

Highlights: colored spans over parts of a rendered passage, belonging to that single Occurrence. Five globally configured Highlight Slots (each with a light-mode and dark-mode color) are available. In Live Preview, selecting text inside a rendered passage pops a small swatch popover (5 colors + eraser); choosing one writes machine-canonical Highlight Cue tokens into the reference's curly braces, so highlights live in the note text and sync/diff like everything else. Because cue offsets index one Translation's verse text, the first highlight pins the translation token, changing the translation through plugin UI clears the cues, and fallback-served passages render no highlights.

Cue grammar: `h<slot>/<verse>.<start>-<verse>.<end>` — e.g. `{John 15:1-16 nkjv block h1/5.4-5.25 h2/7.0-9.12}`. Chapter is inherited from the reference and written only when the reference crosses chapters (`16:2.10`); offsets are end-exclusive character indices into the stored verse text; shorthand (`h1/5.4-25`) is accepted hand-typed.

## User Stories

1. As a bible-studying note-taker, I want to select text in a rendered passage and pick a color, so that key phrases stand out every time I reread the note.
2. As a note-taker, I want five distinct highlight colors, so that I can keep parallel threads (promises, commands, names of God…) visually separate.
3. As a vault owner, I want the five colors configured globally in settings, so that all my notes share one consistent palette.
4. As a user of both themes, I want each slot to have a light-mode and a dark-mode color, so that highlights stay legible whichever theme is active.
5. As a vault owner, I want cues to store only the slot index, so that recoloring a slot in settings instantly re-tints every highlight in the vault.
6. As a theme tinkerer, I want the colors exposed as CSS variables, so that snippets and themes can override them.
7. As a note author, I want highlights serialized as tokens inside the existing curly-brace grammar, so that they sync, diff, and back up as plain note text with no side files.
8. As a note author, I want the drag flow to preserve my reference spelling and spacing exactly (minimal diff), so that highlight edits don't churn my notes in version control.
9. As a hand-editor, I want shorthand cue forms accepted and malformed cues to follow the existing invalid-token rule, so that a typo never breaks the passage rendering.
10. As a reader, I want highlights rendered in both Reading mode and Live Preview, for both `inline` and `block` passages, so that emphasis is visible wherever the passage renders.
11. As a reader on mobile, I want highlights made on desktop to render read-only on my phone, so that my markup travels with the vault.
12. As a highlighter, I want a new stroke of another color to claim the overlap from older highlights (last stroke wins, no blending), so that the result always looks like a physical highlighter pass.
13. As a highlighter, I want a same-color stroke to merge with adjacent/overlapping spans, so that repeated passes produce one clean span.
14. As a highlighter, I want an eraser in the same popover, so that removing emphasis is the same gesture as adding it.
15. As a highlighter, I want my selection snapped outward to word boundaries (in whitespace-scripted text), so that half-words don't get marked by a sloppy drag.
16. As a highlighter, I want selections that stray outside the passage clamped to the passage's verse text, so that chip text, verse numbers, and attribution never enter the offset math.
17. As a user of comma-list references, I want a selection crossing a gap stored as one cue per contiguous run, so that verses outside the reference are never addressed.
18. As a translation switcher, I want the first highlight to pin the translation token explicitly, so that a later change of the vault default cannot silently shift my offsets onto different text.
19. As a translation switcher, I want changing the translation through plugin UI to delete the cues, so that stale offsets never render as garbage against the wrong text.
20. As an offline user, I want fallback-served passages to render without highlights, so that offsets are never painted onto a substitute translation's text.
21. As a red-letter reader, I want highlights rendered as background tint with text color preserved, so that words of Christ stay red under a highlight.
22. As a reader of embedded notes, I want embeds to render highlights read-only, so that viewing an embed can never edit the source file.
23. As a keyboard-driven author, I want the editor suggest to never offer cue tokens, so that autocomplete stays free of machine-written noise.
24. As a user with stale modules, I want out-of-range offsets clamped to the verse's text length, so that a module re-download degrades gracefully instead of erroring.
25. As a hand-editor, I want fully erasing all highlights to leave the pinned translation token in place, so that erasure never changes which text renders.

## Implementation Decisions

All terminology per CONTEXT.md (Highlight, Highlight Cue, Highlight Slot, Pinned Translation — added during the grilling session).

**Anchor model.** A highlight anchors as (verse, startChar, endChar) into one translation's stored verse text, end-exclusive. Char offsets beat word indices because "word" is undefined for non-whitespace scripts in the bolls catalogue and would freeze a tokenization spec forever; word-snapping is drag-time UX only, storage stays chars.

**Grammar.** Cues are option tokens parsed by the reference core alongside translation/display tokens. Canonical form: sorted by (verse, start), same-slot merged, non-overlapping, split at reference gaps, cues last in the token list. Out-of-reference cues and unparseable cues follow the existing invalid-token rule (highlighted in source, ignored, reference renders normally). Cues in annotation frontmatter `ref` values parse but are inert.

**Translation binding.** First machine-written highlight inserts the explicit translation token if absent (pinning the currently effective translation). Plugin-UI translation changes on a cue-bearing reference delete the cues. Hand-edited translation swaps are accepted garbage-in: cues render best-effort, clamped. Fallback rendering suppresses highlights entirely.

**Palette.** Five positional slots (`h1`–`h5`), each a light + dark color in a new Highlights settings section (reset to defaults available). Emitted as CSS variables (`--ss-hl-1`…`--ss-hl-5`) scoped by `.theme-light`/`.theme-dark`. Defaults: muted yellow/green/blue/pink/orange with translucent dark-mode variants. No slot names or semantics.

**Editing surfaces.** Editing is Live Preview only, desktop only (v1). Reading mode, embeds, and mobile render read-only. Chip-only references carry cues harmlessly but render nothing. The reader pane renders no highlights — it shows a Passage, not an Occurrence.

**Gesture.** Selection-first: native text selection inside a rendered passage (cursor outside the decoration range) pops a popover of 5 swatches + eraser. Choosing one maps the DOM selection to verse/char offsets, snaps outward to word boundaries where whitespace-scripted, clamps to passage verse text, applies the stroke (last-stroke-wins; eraser splits), and rewrites the token minimal-diff via the editor. Popover appears only when the passage is served in its requested translation (never fallback/loading/unavailable) and only when the selection intersects passage text.

**Module layout.** A new pure highlights module owns the semantics: stroke application (paint/erase/merge/split), gap-splitting and clamping against verse texts, selection-offsets→cue mapping, and minimal-diff token rewrite (original token text + cue set → new token text, including pinning). The reference core parser gains cue-token classification. Passage rendering weaves highlight spans into verse segments (coexisting with red-letter segments). A thin Live Preview feature wires selection → popover → highlights module → editor transaction. Settings gain the palette section.

## Testing Decisions

- Test external behavior at seams, not implementation details; follow the repo's existing colocated `*.spec.ts` vitest style.
- **Reference core (existing seam):** `parseReference` — cue tokens (canonical + shorthand + chapter-qualified) produce structured highlights; malformed/duplicate/out-of-reference cues land in `invalidTokens`. Prior art: existing option-token tests in the parser spec.
- **Highlights module (the one new seam):** pure-function tests for stroke application, merge/split/last-stroke-wins, gap splitting, clamping, selection mapping, and minimal-diff rewrite (spelling/order/spacing preserved; pinning inserted; cue tail canonical). Prior art: verse-range interval tests.
- **Rendering (existing seams):** passage view + render tests — highlight spans in verse blocks, red-letter coexistence, fallback suppression, Reading-mode read-only output. Prior art: passage-view and render-reference specs.
- **Feature glue (existing pattern):** Live Preview popover gating (requested-translation only, LP only) and file rewrite, tested the way rendering-feature specs stub the plugin/editor. Keep thin.
- **Settings (existing seams):** palette rows and CSS variable emission via settings-catalog/settings-tab-model specs.

## Out of Scope

- Mobile editing (render-only v1).
- Reading-mode editing; reader-pane highlights; any vault-wide "this verse is yellow everywhere" layer (would be an annotation-like feature, not grammar tokens).
- Slot names/semantic labels; more or fewer than 5 slots; color layering/blending.
- Armed-highlighter tool mode (revisit if selection-first proves clunky).
- Detecting hand-edited translation swaps under existing cues (accepted garbage-in).
- Export/print-specific styling beyond what Reading mode already produces.

## Further Notes

- Grilling session recorded the four glossary terms in CONTEXT.md. An ADR ("highlight cues as per-occurrence verse-scoped char offsets in the note grammar") was offered and can be written at implementation time — the decision is hard to reverse because cues live in users' note text.
- Word-boundary snapping applies only where whitespace scripts make it well-defined; CJK/Thai selections store exactly as selected.
- Erasing the last cue leaves the pinned translation token in place by design.

