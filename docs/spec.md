# Bible Study — v1 Specification

Bible Study is an Obsidian plugin that turns a vault into a full bible reading and study tool: `{curly-brace}` scripture references with styled rendering and inline/callout display, a reader pane (translation switching, multi-translation verse view, intersecting-reference lookup), verse annotations as vault notes, offline translation downloads, and Strong's concordance support.

This document consolidates every decision from the [wayfinder map](https://github.com/chfourie/obsidian-bible-study/issues/1). Terminology follows the glossary in [CONTEXT.md](../CONTEXT.md); the verse-identity decision is [ADR 0001](adr/0001-bcv-encoded-verse-ids-on-kjv-grid.md); data-source findings are in [docs/research/scripture-data-sources.md](research/scripture-data-sources.md).

Plugin id: `bible-study`. Stack: TypeScript, Svelte 5, esbuild + esbuild-svelte, vitest, eslint-plugin-obsidianmd — conventions mirrored from `obsidian-journal-folder`. The scaffold is committed and green (issue #5).

---

## 1. Domain model

### 1.1 Verse identity — BCV ids on the Canonical Grid

- Canonical internal id of a verse: integer `BBBCCCVVV` — book 1–66 in Protestant/OSIS order, chapter, verse. John 15:4 = `043015004`. ([ADR 0001](adr/0001-bcv-encoded-verse-ids-on-kjv-grid.md))
- The grid is fixed KJV versification (~31,102 verses), translation-independent. A translation that omits/renumbers a verse has a content gap (absent key) at that grid position; the grid never changes per translation. Per-translation versification drift (≈3–5 spots, e.g. 3 John 15) is a documented content-layer limitation, not a model concern.
- A reference normalizes to `{book, ranges: [{startId, endId}]}` — a **set of verse ranges**, never crossing a book boundary. Overlap/sort/containment are plain integer interval math; enumeration/adjacency uses a versification-aware `nextVerse()` over the shipped versification data (verse counts per chapter).
- Ids are stable forever; the encoding leaves room for non-canon books later (out of v1 scope).

### 1.2 Vault reference index

- **In-memory, no persistence in v1.** Full vault scan on plugin load, deferred to `layout-ready`, chunked, with a `{`-presence pre-filter before parsing. Rebuild each load; persistent caching only if real vaults prove slow.
- **Incremental updates:** re-parse on modify (debounced), fix up on rename, evict on delete. Annotations re-indexed via frontmatter `ref`.
- **Unit stored: the occurrence** — `{file, position, normalized ranges, source: body | annotation-frontmatter}`.
- **Intersection query:** normalized reference → all occurrences sharing ≥1 verse id (translation-agnostic), grouped by file, annotations flagged as their own class. Ordering: annotations first, then file path A→Z, then position within file.

## 2. Reference grammar

Curly braces with bare space-separated tokens: `{John 15:1-17}`, `{John 15:4 nkjv}`, `{John 15:4 nkjv callout}`.

- **Canon & book names:** 66-book Protestant canon, English-only v1. Case-insensitive matching against English full names + OSIS abbreviations + three-letter abbreviations; optional trailing period; `1Jn` / `1 Jn` both accepted. Lookup table is many-names → book-id, so localized tables can slot in later. Deuterocanon out of v1.
- **Verse forms:** single verse (`John 15:4`), intra-chapter range (`John 15:1-17`), whole chapter (`John 15`), cross-chapter range (`John 15:26-16:4`), comma lists (`John 15:4,7`, `John 15:4-6,9`). Whole-book references rejected.
- **Option tokens:** translation id and display keyword (`inline` | `callout`) in any order after the reference — disjoint closed vocabularies. Bare (no keyword) = chip only.
- **Errors:** invalid reference part (unknown book, bad structure, out-of-range chapter/verse per versification data) → the whole `{...}` renders as plain text, unstyled (interop safety valve for Templater/JSON braces). Valid reference with unknown/duplicate/conflicting trailing tokens → invalid tokens highlighted and ignored (first valid token wins), reference renders normally.
- **Escaping:** inline code spans and fenced code blocks never parsed; `\{John 15:4}` escapes to literal text. No per-note disable flag in v1.
- **Editor modes:** Reading mode renders fully. Live Preview renders identically via CodeMirror 6 decorations, collapsing to raw source when the cursor enters the range (standard Obsidian convention; no partial editing UI). Source mode shows raw text.

## 3. Rendering in notes

### 3.1 Bare reference (chip)

Clickable pill/chip: normalized reference text, plus translation label only when explicitly specified (`John 15:4 · NKJV`; vault-default translation shows no label), small nav icon at the end. Whole chip opens the reader at the passage. Accent color, subtle background, tag-like, visually distinct from wiki-links. One style in v1.

### 3.2 `inline` mode

Chip first, then verse text as a quoted, subtly muted/italic run in the paragraph flow. No verse numbers for a single verse; superscript verse numbers for multi-verse references. No length cap — a whole-chapter inline reference renders in full as flowing text (never a scroll box). No attribution line; the chip's translation label is the citation.

### 3.3 `callout` mode

Custom Obsidian callout type `[!bible]` (plugin-styled: book icon, accent color). Title = normalized reference + translation label; title nav icon opens the reader. Body = continuous prose honoring pericope/paragraph data when available, superscript verse numbers always. Rendered expanded; no fold token in v1. Muted attribution line at the bottom (see §3.6).

### 3.4 Red-letter

Words of Christ styled red (theme-adjustable CSS variable) wherever verse text renders — inline, callout, reader — when the translation data marks them; silently absent otherwise.

### 3.5 Async states

Chip renders immediately in all modes. Loading → subtle shimmer/placeholder ("Loading John 15:4…"), text swaps in. Unavailable (offline/error) → muted one-liner ("John 15:4 (NKJV) unavailable offline") with retry icon — degraded state, never an error box. Cache refresh after expiry swaps silently.

### 3.6 Selection & attribution

Rendered verse text is normal selectable/copyable DOM text. Attribution rule: if the translation's stored metadata carries a copyright string (API.Bible provides one per bible; e.g. NKJV's "New King James Version®, Copyright © 1982, Thomas Nelson…"), show it; if absent (public domain), show nothing. Callout: bottom attribution line. Inline: none. No manual curation, no popovers. Page-footer aggregation rejected for v1.

## 4. Reader pane

An Obsidian workspace leaf. Prototype (visual reference until implementation): [prototypes/reader-pane-prototype](../prototypes/reader-pane-prototype).

- **One layout with three independent toggles**, each with a global settings default plus in-pane switching (in-pane state is ephemeral per-pane workspace state, never written back to settings):
  1. **Details** — other translations + notes as *inline expand* under the clicked verse, or persistent *right side panel* with Translations/Notes tabs.
  2. **Nav** — book/chapter picker as *left tree panel* or *breadcrumb top links* with prev/next chapter steppers.
  3. **Layout** — *verse-per-line* or *continuous prose* (continuous honors pericope/paragraph data when provided).
- **Multi-translation verse view:** stacked (label + text, one under another), not columns. The fallback translation is never substituted here — unavailable translations show an unavailable row.
- **Indicators:** trailing marks after verse text — ● annotation (amber), ◆n intersecting notes (blue).
- **Entry points:** nav icon/chip on a rendered reference opens the reader at that passage (current-passage highlight: tint + left bar; dismissible entry-context banner); command-palette entry and ribbon icon open at last position.
- **Shared elements:** translation pill switcher in the toolbar; per-translation copyright attribution line under the chapter; Strong's mode toggle (§7.3).

## 5. Annotations

- **Schema:** `ref` is the only frontmatter key — raw grammar string without braces (e.g. `John 15:4-6,9`). Canonicalized when the plugin writes it; any valid grammar string accepted hand-typed. No translation/created/type/tags keys. Invalid `ref` → note silently not indexed as an annotation. Any note with a valid `ref` is an annotation, however created.
- **Folder & filenames:** one configurable folder, default `Annotations/`, created on demand, organization-only — identity lives in frontmatter, so a moved/renamed note keeps working. Filename = canonicalized ref with `:` → `.` (`John 15.4-6,9.md`); collisions suffix ` 1`, ` 2`, ….
- **Template:** optional template-file setting (default none). Create flow copies the template body then sets `ref` (overwriting any in the template). No variable substitution in v1 (Templater/core Templates remain compatible).
- **Create-from-reader:** "Annotate" on a verse or multi-verse selection (ref = the span); command-palette "New annotation" prompts for a ref pre-filled from an open reader. Note opens in a split beside the reader, cursor on the first body line; indicators update immediately via index create events.
- **Reader display:** full rendered markdown body per annotation in the details surface, one collapsible block per annotation titled by note name, max-height + scroll, read-only; title/edit icon opens the note in an editor split; modify events refresh on save. Ordering is a global setting: creation date oldest-first (default) or file path A→Z.
- **In-note intersection surface:** annotations appear there too, grouped first ("Annotations", then "Mentions").

## 6. Translations: modules, storage, online tier

### 6.1 Tiers

- **Downloadable (public domain / open license):** fetched once as a full module, works offline. Sources: getBible v2 static JSON (KJV, WEB, ASV, …) and the tagged BSB release artifact (§7.1).
- **Online (licensed):** per-passage fetch via the user's API.Bible key, held only in the passage cache. Starter-tier licensed English Bibles: **NKJV, NLT, NASB 1995** (NIV is *not* on Starter — verified). The user's translation is NKJV; WEB is its closest free analogue (natural setup: NKJV default + WEB fallback).

### 6.2 Module storage

- Modules live in the plugin data dir (e.g. `.obsidian/plugins/bible-study/modules/`), never as vault files, never synced. Each device re-downloads; synced `data.json` carries installed-module ids so a fresh device offers one-click re-download.
- **Normalize at download time** into one plugin-owned format: per-book JSON keyed by verse id, plus `manifest.json` (id, name, language, license/copyright string, source, source checksum, format version, capability flags):

  ```
  modules/web/
    manifest.json
    001.json … 066.json
  ```

- Read path is source-agnostic (`verse id → text`); content gaps = absent keys. The manifest feeds the settings list, the callout attribution line, and checksum-based update detection.

### 6.3 Online-tier passage cache

- Same normalized form under `cache/<translation>/`, entries stamped `fetchedAt`.
- **14-day hard expiry:** expired entries purged on load/lookup, never served — offline + expired behaves like never-fetched. (Conservative end of the 14-vs-30 ToU ambiguity; a support answer of 30 is a constant change.)
- ≤500 consecutive verses, enforced structurally by capped per-passage fetches. No size cap/LRU; TTL is the compliance mechanism. Never syncs.
- **API.Bible fetch rules:** passage requests silently truncate at 200 verses (HTTP 200, `verseCount: 200`) — chunk requests at ≤200 verses and verify `verseCount`. `content-type` = html/json/text. FUMS compliance via the manual report: `GET https://fums.api.bible/f3?t=<fumsToken>&dId=…&sId=…` using `meta.fumsToken` from each scripture response.

### 6.4 Fallback ladder

Requested translation → single configurable **offline fallback translation** (restricted to installed offline modules, defaults to first installed) → unavailable state with install CTA. Never silent: the chip/callout names the translation actually served (e.g. "WEB *(NKJV unavailable)*"). Applies to reading surfaces only — never the reader's stacked view.

### 6.5 First run

Nudge only: reader/callouts show an "install a translation" CTA with WEB as the suggested one-click default. Nothing downloads without consent.

## 7. Strong's

**In scope v1, lookup-only** (occurrence search is out of scope).

### 7.1 Data & modules

- **Tagged translation: BSB only**, built from the public-domain Berean `bsb_tables.tsv` (word-level `Str Heb`/`Str Grk` columns, verified). One BSB module, always tagged, downloadable, not bundled.
- **Repo-side pipeline:** a one-off script in `scripts/` converts the TSV to per-book JSON with word-level tag spans + manifest; artifacts published as a GitHub release on this repo. The plugin downloads pre-normalized JSON (fetch, checksum-verify, store) — no on-device TSV parsing. The release artifact is BSB's *only* source (avoids drift between Berean revisions and the tag snapshot).
- **Capability model:** Strong's-tagging is a per-translation capability — manifest flag, tags stored as inert spans beside verse text. Tagged KJV is out of scope for v1 but layers on with no model change.
- **Dictionaries:** STEPBible TBESH/TBESG (CC BY 4.0) as a shared separate module serving all tagged translations; "Enable Strong's" downloads only the dictionaries.

### 7.2 Interaction

Reader-toolbar **Strong's mode** toggle, visible only when the viewed translation is tagged and the dictionaries are installed; default configurable like other reader toggles. In Strong's mode, tapping a word renders its entries (Strong's number, original-script lemma, transliteration, short gloss, TBESH/TBESG definition, CC BY attribution line) in the reader details surface. Multiple tags stack entries in tag order. No hover popup; normal reading/selection stays inert. Untagged translations simply lack the feature.

## 8. Settings

Plain `PluginSettingTab` + `Setting` API (Svelte permitted for the translation list if the imperative API gets painful). Five sections:

1. **General** — Default translation (dropdown: installed downloadable modules + enabled online translations); Offline fallback translation (dropdown: installed offline modules only). Bootstrap rules: auto-set to first candidate when one appears; on deletion, reassign to first remaining or unset (back to nudge state); disabled placeholder ("No translations installed — see Translations below") when empty.
2. **Translations** — API.Bible key (masked input, stored in `data.json`; docs warn vault-publishers; online rows appear only with a valid key); Language filter (default English, persisted); management list per §6: one flat list, two visual tiers (Downloadable — free / Online — requires key), per-row actions (Download/progress/Update/Delete; enable toggle + "Clear cached passages" + 14-day note for online rows), Strong's badge on tagged translations.
3. **Strong's** — Enable Strong's toggle (downloads/removes the dictionaries module), note pointing at badged translations when none installed, STEPBible CC BY attribution.
4. **Reader** — four toggle defaults: Details (inline / side panel), Navigation (tree / breadcrumb), Layout (verse-per-line / continuous), Strong's mode (off / on). Defaults seed new panes only; in-pane switches are ephemeral.
5. **Annotations** — Folder (folder-suggest, default `Annotations/`), Template file (file-suggest, default none), Display ordering (creation oldest-first default / path A→Z).

Ruled out of the v1 surface: bare-ref display-mode setting (display mode comes from grammar tokens only — keeps source portable), chip style variants, first-run nudge configuration, cache TTL/size caps (compliance constants).

## 9. Architecture

Components and their dependency direction (each consumes only what's above it):

1. **Versification data** — static verse-counts-per-chapter table (KJV grid); validation, `nextVerse()`, ordinal↔BCV mapping.
2. **Reference core** — grammar parser (book-name table, verse forms, option tokens, error rules) producing normalized references; interval math on verse ranges.
3. **Vault index** — occurrence scanning/updating, intersection query (§1.2).
4. **Module layer** — module download/normalize/store, manifests, passage cache with TTL, API.Bible client (chunking, FUMS), fallback resolution (§6).
5. **Rendering** — Reading-mode post-processor + Live Preview CM6 decorations for chip/inline/callout; async states; red-letter; attribution (§3).
6. **Reader pane** — workspace leaf, toggles, stacked view, indicators, entry points (§4).
7. **Annotations** — schema, create flows, reader/in-note display (§5).
8. **Strong's** — tagged-module spans, dictionaries module, Strong's mode UI (§7); plus the repo-side BSB build pipeline in `scripts/`.
9. **Settings tab** — §8, thin over the layers above.

### Suggested implementation order

1. Versification data + reference core (pure, fully unit-testable).
2. Vault index + intersection query.
3. Module layer with one downloadable translation (WEB via getBible) end-to-end.
4. Note rendering (chip → inline → callout), async states.
5. Reader pane shell + nav + layout toggles; entry points.
6. Online tier (API.Bible client, cache, fallback ladder) + attribution.
7. Annotations.
8. BSB build pipeline + tagged module + Strong's dictionaries + Strong's mode.
9. Settings tab completion + first-run nudge polish.

Steps 1–5 need no API key and deliver a usable offline reader; 6–9 layer on independently.

## 10. Out of scope for v1

- Strong's occurrence search ("other places this number appears").
- User-supplied module import (translations & dictionaries) — motivating case requires DRM circumvention.
- Tagged KJV (needs STEPBible TAGNT/TAHOT alignment work; only ready-made source is license-shaky).
- Deuterocanon / non-English book names / localized grammar.
- Persistent index cache; per-translation versification mapping; page-footer attribution aggregation; multiple chip styles; inline length threshold + expander; general non-bible reference callout type; community-store release (own effort, post-spec).

## 11. Open items (non-blocking)

- API.Bible support email (drafted in issue #14): FUMS applicability to an Electron plugin, 14-vs-30-day cache retention, ToU constraints. Design already adopts the conservative reading (14 days, manual FUMS GET); a relaxed answer is a constant change, not a redesign.
- Local repo folder rename to `obsidian-bible-study` — user's call.
