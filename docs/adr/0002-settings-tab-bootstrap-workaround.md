# 0002 — Settings tab bootstraps from getControlValue (Obsidian 1.13.7 workaround)

Date: 2026-08-16
Status: accepted — revisit when Obsidian gives declarative setting tabs a per-open hook

## Context

The settings tab is fully declarative (`getSettingDefinitions()`, Obsidian ≥1.13). Its definitions are dynamic — translation rows come from a model that must `refresh()` (network + disk) when the tab opens, and must *not* refresh at plugin load, when Obsidian indexes the tab for settings search.

The tab originally bootstrapped (subscribe to the model + kick a refresh) from the first `getSettingDefinitions()` call that arrived with a connected `containerEl`, on the assumption that opening the tab re-invokes it. Obsidian 1.13.7's actual open path (verified by reading the shipped `app.js`) is:

- `addSettingTab()` calls `update()` → `getSettingDefinitions()` with `containerEl` detached, and caches the result in `settingItems`.
- Opening the tab calls the internal `renderTab()`, which renders from the cached `settingItems` whenever they are non-empty and falls back to `display()` only when the cache is empty. The base `display()` also just renders the cache — it does not re-invoke `getSettingDefinitions()`; a fresh call happens only through `update()`.

So for any tab whose index-time definitions are non-empty, `getSettingDefinitions()` is never called while the tab is on screen: the bootstrap never ran, the model never refreshed, and the Translations section rendered permanently empty (the v1.1 "no option to download translations" bug). Whether this is an Obsidian bug or an API gap is debatable — the API docs say `getSettingDefinitions()` is "called on every display()", which is technically true; the problem is that a declarative tab has no hook that reliably fires on open.

## Decision

Bootstrap from `getControlValue()` as well as `getSettingDefinitions()`, guarded by the same "not yet subscribed and `containerEl.isConnected`" check (`#bootstrapWhenOnScreen()` in `src/settings/settings-tab.ts`). The 1.13.7 renderer calls `getControlValue()` for every `control`-type definition on each on-screen render — including renders from the cached `settingItems` — and the tab always contains controls, so it fires reliably on every open. The index-time `update()` does not render controls, so plugin load still triggers no refresh. Teardown stays in `hide()`.

The same render-time hook also serves as page-open detection: the Translations list lives on a declarative sub-page (`type: 'page'`), whose catalogue fetch is deferred until the page first renders. The `languageFilter` control renders only on that page, so `getControlValue('languageFilter')` doubles as the page-open signal (`#loadCatalogOnTranslationsPageRender()`), once per settings-open cycle, rearmed in `hide()`. There is no public per-page-open callback either, so this rides on the same workaround.

## Consequences

- Opening the settings tab reliably subscribes the tab to its model and refreshes the catalogue; closing it still tears both down.
- The workaround is invisible to the model and the specs' seams; only the tab class carries it.
- `tests/mocks/obsidian.ts` `PluginSettingTab` mirrors the real call order (detached `update()` at registration, cache-reusing `renderTab()` on open) so specs exercise the same lifecycle that broke in production.
- **Removal condition:** when Obsidian either re-invokes `getSettingDefinitions()` on open or adds a per-open lifecycle callback for declarative tabs, drop `#bootstrapWhenOnScreen()` from `getControlValue()` (keeping it in `getSettingDefinitions()`), and update the mock if the call order changed. Verify against the then-current `app.js` before removing — the mock encodes the assumption, so the settings-tab specs will catch a regression either way.
