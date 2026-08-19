# 0003 — Cross-references live in a single plugin-managed data file, not vault notes

Date: 2026-08-17
Status: accepted

## Context

Annotations set a vault-notes-as-truth pattern: one note per item, reference in frontmatter, indexed as occurrences. Cross-references (symmetric, n-ary connections between References) were initially designed the same way, but every note needs a unique filename, which forced either human titles (unique-title pressure on what is conceptually just an edge) or opaque id-based filenames (notes with meaningless names). The plugin data dir was rejected outright: it is never synced, and cross-references are irreplaceable user-authored study data.

## Decision

All cross-references live in one plugin-managed data file inside the vault. It syncs and backs up with the vault, imposes no per-item filenames or titles, and identity is an internal id. Serialization is deterministic — stable ordering, one entry per line — so sync-tool merges usually succeed; residual concurrent-edit clobbering is accepted as last-write-wins for a single-user plugin.

## Amendment (2026-08-19): markdown extension, configurable folder

The file is `scripture-study-cross-references.md` — still JSON lines, but with
a `.md` extension so vault sync tools carry it without extension
allowlisting. It is explicitly excluded from the plugin's own vault index (it
is not a note); appearing in Obsidian search and the quick switcher is an
accepted cost. Its folder is a setting (default: vault root); the plugin
moves the file when the setting changes and migrates a pre-amendment
`scripture-study-cross-references.jsonl` from the vault root on load. If the
configured path is already occupied, the occupant wins and no move happens —
existing data is never overwritten.

## Consequences

- Cross-references get no free occurrence indexing and no markdown body; surfacing is wired explicitly through the store, and the rationale is a plain description field edited via plugin UI.
- Anyone extending Annotations-style note storage to new item types should first check whether the item has a natural unique name; if not, this file-based pattern is the precedent.
