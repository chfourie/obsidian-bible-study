# Scripture Data Sources & Licensing Research

Research for [issue #3](https://github.com/chfourie/obsidian-bible-study/issues/3). Date: 2026-08-15. All claims cite the primary source consulted; unverified points are flagged inline.

## Summary & Recommendation

- **Primary online API: API.Bible** (`api.scripture.api.bible/v1`). Only candidate that offers NIV/NKJV/NASB/NLT etc. under an actual license agreement with publishers; free Starter tier = up to 3 licensed Bibles + all public-domain/CC Bibles, 5,000 calls/month ([docs.api.bible FAQ](https://docs.api.bible/common-questions/)). Caching allowed but constrained (≤500 consecutive verses, refresh every 14–30 days) — so copyrighted translations must be **online + expiring cache**, never bulk-downloaded.
- **Offline/bulk translations: getBible v2 static JSON** (`api.getbible.net/v2/<translation>.json`, whole translation in one file, no auth, GPL-3.0 repo — [github.com/getbible/v2](https://github.com/getbible/v2)) for public-domain texts (KJV, ASV, WEB, YLT, …), plus **eBible.org** and **berean.bible** for BSB and source-format (USFM/USX) downloads.
- **Strong's: ship/download public-domain + CC-BY data.** KJV-with-Strong's JSON ([kaiserlik/kjv](https://github.com/kaiserlik/kjv)), OpenScriptures Hebrew Bible (CC BY 4.0, [morphhb](https://github.com/openscriptures/morphhb)), STEPBible TAHOT/TAGNT + lexicons (CC BY 4.0, [STEPBible-Data](https://github.com/STEPBible/STEPBible-Data)), Strong's dictionaries ([openscriptures/strongs](https://github.com/openscriptures/strongs)). Practical for an Obsidian plugin as an optional download (tens of MB), not bundled.
- **Avoid bolls.life as a primary source for copyrighted texts**: technically excellent (full-translation JSON dumps incl. NIV/ESV/NKJV) but publishes copyrighted translations with **no stated license or permission** and no ToU — legal basis unverifiable, and bulk-downloading NIV from it would put the plugin (and users) outside publishers' quotation policies.
- **Settings-UI tier model**: two tiers — **"Downloadable (public domain / open license)"** (WEB default, KJV, ASV, BSB, YLT, …; fetched once, stored in vault, works offline) and **"Online (licensed)"** (NIV, NKJV, NASB, NLT, … via user's own API.Bible key; per-passage fetch with a time-limited local cache ≤500 consecutive verses, auto-expiring ≤14 days).

## Per-API Findings

### API.Bible (api.bible, formerly scripture.api.bible)

- **What/coverage**: ~2,500 Bibles in ~1,600 languages; "popular translations like NIV, NKJV, NASB, The Message, CST, NLT, The Amplified Bible, GNT" plus "hundreds of open access Bibles" ([docs.api.bible](https://docs.api.bible/)). Run by American Bible Society.
- **Auth**: API key in `api-key` request header; sign-up at api.bible, licensed Bibles selected during signup — no separate per-Bible approval process mentioned ([docs.api.bible getting started](https://docs.api.bible/api-reference/getting-started/), [FAQ](https://docs.api.bible/common-questions/)).
- **Plans/rate limits**: Starter (free, non-commercial): public-domain + CC versions plus **up to 3 licensed Bibles**, **5,000 calls/month**; Pro: 150K/month; Enterprise custom ([docs.api.bible](https://docs.api.bible/), [FAQ](https://docs.api.bible/common-questions/)). Also stated per-key: 5,000 queries/day, ≤500 consecutive verses per request ([getting started](https://docs.api.bible/api-reference/getting-started/)). *The "5K/month plan cap" vs "5,000/day" figures both appear in official docs; exact reconciliation unverified.*
- **Endpoints**: bibles, books, chapters, verses, passages, sections, search ([docs.api.bible](https://docs.api.bible/api-reference/getting-started/)). Verse ranges: passages endpoint accepts range passage IDs and up to 500 consecutive verses per request ([FAQ search result](https://docs.api.bible/common-questions/)).
- **Response format**: JSON envelope; `content` field is an **HTML fragment** styled via their `scripture.css` ([verse-of-the-day tutorial](https://docs.api.bible/tutorials/verse-of-the-day/)). Live swagger docs (scripture.api.bible/livedocs) reportedly expose a `content-type` param (html/json/text) — **not directly verified** (livedocs is a JS app; the docs site's "Content Output Formats" section returned 404 at the URLs tried).
- **Caching/offline (ToU)**: "you can cache data, but we request that you limit it to fewer than 500 consecutive verses" and clear cache **every 14 days or less**; elsewhere refresh **at least every 30 days** is stated as the T&C requirement ([docs.api.bible FAQ](https://docs.api.bible/common-questions/), corroborated by search snippets of the same docs). Offline use is not addressed explicitly; docs say to contact support@api.bible. **Ambiguity flagged**: 14-day recommendation vs 30-day requirement.
- **FUMS**: developers are asked to embed the Fair Use Management System tracking snippet for content views ([docs.api.bible/guides/fair-use](https://docs.api.bible/guides/fair-use/)). A plugin rendering into Markdown/HTML in Obsidian cannot realistically run FUMS scripts — **compliance gap to note**; the fair-use page frames it as "we ask", not a hard block.

### bolls.life

- **Endpoints**: `GET /get-text/<translation>/<book>/<chapter>/[<verse>/]`, `POST /get-verses/` (batch), search `/v2/find/`, dictionary `/dictionary-definition/<dict>/<query>/` (supports Strong's queries like `H125`, `G523`); **full-translation dumps** at `https://bolls.life/static/translations/<translation>.json|.zip` ([API.md](https://github.com/Bolls-Bible/bain/blob/master/docs/API.md)).
- **Auth/limits**: none documented; maintainer asks users not to scrape ("single core 14€ server") ([API.md](https://github.com/Bolls-Bible/bain/blob/master/docs/API.md)).
- **Coverage**: 50 English translations incl. NIV (1984 & 2011), ESV, NKJV, NASB, NLT, CSB, WEB, BSB, and "KJV 1769 with Apocrypha and Strong's Numbers" ([languages.json](https://bolls.life/static/bolls/app/views/languages.json)).
- **Format**: JSON; verse `text` is an HTML string (`<br>`, `<i>`, Strong's markup). No native verse-range endpoint (verse or whole chapter; batch POST for arbitrary sets) ([API.md](https://github.com/Bolls-Bible/bain/blob/master/docs/API.md)).
- **Licensing**: **no terms/licensing statements anywhere in the docs**. It redistributes full copyrighted translations (NIV, ESV…) with no visible publisher permission. Hobby-run, single server. **Not a defensible source for copyrighted texts; fine as a technical reference or for its Strong's-tagged KJV (text itself public domain).**

### getBible (getbible.net / api.getbible.net)

- **Model**: static JSON files served from `api.getbible.net/v2/` — whole translation (`/v2/kjv.json`), per book, per chapter; query API for references/ranges at `query.getbible.net/v2/<translation>/<references>`; helper endpoints `translations.json`, `checksum.json` ([github.com/getbible/v2](https://github.com/getbible/v2)).
- **Auth/limits**: none documented (static files). Repo license GPL-3.0 (applies to the data packaging/tooling; underlying public-domain texts remain public domain) ([github.com/getbible/v2](https://github.com/getbible/v2)).
- **Coverage**: public-domain / freely distributable translations only — KJV, ASV, WEB, YLT, etc.; **no NIV/ESV/NKJV** ([get.bible data sets page](https://get.bible/bible-data-sets/), [translations.json](https://github.com/getbible/v2/blob/master/translations.json)). Docs site itself (gatekeeper.getbible.life/docs) returned 403 to automated fetch — endpoint details taken from the GitHub repo README instead.
- **Verdict**: ideal bulk-download source (one JSON per translation, checksums for update detection), useless for the copyrighted tier.

### bible-api.com

- **Model**: free JSON API, no auth; user-input style (`/john+3:16`, ranges via hyphen/comma e.g. `matt 25:31-33,46`) plus parameterized `/data/...` API; random-verse endpoint ([bible-api.com](https://bible-api.com/)).
- **Limits**: throttled at **15 requests / 30 s per IP** ([bible-api.com](https://bible-api.com/)).
- **Coverage**: ~16 translations, all open (WEB default, KJV, ASV, …); **no NIV or any licensed modern translation** ([bible-api.com](https://bible-api.com/)).
- **Bulk**: explicitly says get full Bibles from the source GitHub repos, don't scrape the API ([bible-api.com](https://bible-api.com/)).
- **Verdict**: fine fallback for open texts; the aggressive throttle and no-licensed-texts coverage make it weaker than getBible for our use.

### eBible.org

- **Model**: download site (no API): per-translation pages list InScript, mobile HTML, ePub 3, Kindle, PDF, SWORD module, Word XML ([engwebp page](https://ebible.org/find/show.php?id=engwebp)). USFM/USFX/other source formats are known to exist on eBible but **were not visible on the pages fetched — unverified here** (the details pages fetched showed only end-user formats).
- **Licensing (WEB)**: "The World English Bible is in the Public Domain… not copyrighted"; only restriction is not using the WEB name on modified versions ([ebible.org engwebp](https://ebible.org/find/show.php?id=engwebp)).
- **Verdict**: authoritative licensing reference and canonical source for WEB; for machine-readable JSON, getBible v2 is more convenient.

## Licensing Tiers

| Translation | Status | Full offline bulk download? | Source | Terms |
|---|---|---|---|---|
| WEB | Public domain | Yes | [getBible v2](https://github.com/getbible/v2), [ebible.org](https://ebible.org/find/show.php?id=engwebp) | No restrictions except name on modified versions ([ebible.org](https://ebible.org/find/show.php?id=engwebp)) |
| KJV, ASV, YLT | Public domain (US) | Yes | [getBible v2](https://github.com/getbible/v2), [bible-api.com repos](https://bible-api.com/) | None. (KJV: UK Crown patent applies in UK printing only — not verified here) |
| BSB (Berean Standard Bible) | **Public domain since 2023-04-30** | Yes | [berean.bible/downloads.htm](https://berean.bible/downloads.htm) (txt, xlsx/tsv translation tables, USFM/USX/USJ, ePub…) | "Licensing is not required for any use" ([berean.bible/licensing](https://berean.bible/licensing.htm)) |
| NIV | Copyright Biblica/Zondervan | **No** | API.Bible (licensed tier) | Quote ≤500 verses, <25% of work, not a complete book; copyright notice required ([biblica.com FAQ](https://www.biblica.com/resources/bible-faqs/do-i-have-to-notify-biblica-to-use-a-bible-verse-from-the-niv/)). Via API.Bible: cache <500 consecutive verses, refresh ≤14–30 days ([docs.api.bible FAQ](https://docs.api.bible/common-questions/)) |
| NKJV, NASB, NLT, AMP, MSG, GNT | Copyright (Thomas Nelson, Lockman, Tyndale…) | **No** | API.Bible (licensed tier) ([docs.api.bible](https://docs.api.bible/)) | Same API.Bible cache rules; per-publisher quotation policies not individually verified |
| ESV | Copyright Crossway | **No** | **Separate ESV API** (api.esv.org), not on API.Bible free path (presence on API.Bible unverified) | Own key; 5,000 queries/day, 60/min; local storage ≤500 verses or half a book; non-commercial; attribution + link to esv.org ([api.esv.org](https://api.esv.org/)) |

Notes:
- BibleGateway has **no public API** and its ToU do not permit scraping — excluded (not re-verified this session; treat as out of scope).
- The ESV could be offered as a third path ("bring your own ESV API key") since its terms explicitly permit storing up to 500 verses locally ([api.esv.org](https://api.esv.org/)).

## Strong's Feasibility

Verdict: **feasible and legally clean** using public-domain/CC-BY data; ship as an optional downloadable dataset.

- **KJV tagged with Strong's numbers** (word→Strong's mapping for a whole Bible):
  - [kaiserlik/kjv](https://github.com/kaiserlik/kjv) — KJV in JSON with Strong's Hebrew/Greek lexicon tags and italics, "analytics-friendly" (repo description; per-file license not verified).
  - [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) — includes "KJVA … with Strongs Numbers and Morphology" in SQL/JSON/CSV.
  - bolls.life's KJV is also Strong's-tagged with a dictionary-lookup endpoint (`/dictionary-definition/BDBT/H125/`) — useful as a design reference ([API.md](https://github.com/Bolls-Bible/bain/blob/master/docs/API.md), [languages.json](https://bolls.life/static/bolls/app/views/languages.json)).
- **Original-language tagged texts**:
  - **OpenScriptures Hebrew Bible (morphhb)**: WLC with Strong's-linked lemmas + morphology; OSIS XML, generated JSON, and an npm package (`morphhb`); text public domain, lemma/morph data **CC BY 4.0** ([github.com/openscriptures/morphhb](https://github.com/openscriptures/morphhb)).
  - **STEPBible-Data**: TAHOT (Hebrew OT) and TAGNT (Greek NT) with disambiguated-but-backward-compatible Strong's, plus lexicons TBESH/TBESG and full LSJ entries; tab-separated UTF-8 text; **CC BY 4.0** with attribution to STEP Bible ([github.com/STEPBible/STEPBible-Data](https://github.com/STEPBible/STEPBible-Data)).
- **Strong's dictionaries** (number→gloss/definition): [openscriptures/strongs](https://github.com/openscriptures/strongs) — Hebrew + Greek dictionaries in XML/JS(JSON). Strong's (1890) is public domain; **the repo's own license statement could not be fetched (README 404 via raw URL) — verify in-repo before shipping**. STEPBible's TBESH/TBESG (CC BY 4.0) are a cleaner-licensed alternative.
- **Berean interlinear**: BSB downloads include xlsx/tsv "translation tables" (Greek/Hebrew↔English word mapping) but the downloads page does not label them as Strong's-keyed, and the interlinear NT is offered only as PDF/Word ([berean.bible/downloads.htm](https://berean.bible/downloads.htm)). The tables are known in the community to carry Strong's columns — **not verified here; inspect the xlsx before relying on it**.
- **Practicality**: a full Strong's-tagged KJV JSON plus the two dictionaries is on the order of tens of MB — too big to bundle in a community plugin, fine as a one-time download into the vault (mirroring how the translation download tier works). CC BY 4.0 sources require an attribution line in plugin docs/settings.

## Recommended Architecture

1. **Downloadable tier** (default UX): translation picker backed by `api.getbible.net/v2/translations.json`; download whole-translation JSON once into the vault; verify with `checksum.json`; default WEB. BSB added from berean.bible (or a repackaged JSON the plugin project hosts, which public-domain status permits).
2. **Online tier**: user pastes their own API.Bible key (Starter, non-commercial — matches personal Obsidian use); user picks up to 3 licensed Bibles at signup; plugin fetches passages (JSON w/ HTML `content`), strips/converts HTML to Markdown, caches per-passage with a ≤14-day TTL and a ≤500-consecutive-verse ceiling; surface publisher copyright notice with rendered text (NIV notice per [Biblica](https://www.biblica.com/resources/bible-faqs/do-i-have-to-notify-biblica-to-use-a-bible-verse-from-the-niv/)).
3. **Optional ESV path**: separate api.esv.org key; plain-text endpoint; local storage capped at 500 verses per its ToU ([api.esv.org](https://api.esv.org/)).
4. **Strong's module**: optional download of Strong's-tagged KJV + STEPBible lexicons; attribution strings for CC BY 4.0 sources baked into settings/About.

## Open Questions / Unverified

- API.Bible: exact `content-type` output options (html/json/text) and passage-range syntax — confirm against livedocs/swagger with a real key.
- API.Bible: whether NIV specifically is selectable among the Starter tier's 3 licensed Bibles (docs imply yes; publisher-specific carve-outs possible).
- FUMS obligation for a non-web plugin context — ask support@api.bible.
- eBible.org USFM/USFX developer downloads (page fetch showed only end-user formats).
- kaiserlik/kjv and openscriptures/strongs in-repo license files.
- Berean translation tables: confirm Strong's columns by opening the xlsx.
