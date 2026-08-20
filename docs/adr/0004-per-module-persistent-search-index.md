# 0004 — Per-module persistent search index

Date: 2026-08-20
Status: accepted

## Context

The v1 spec ([spec.md](../spec.md) §10) explicitly excluded a persistent index cache. Full-text search reopens that decision: module text is only reachable file-by-file through `ModuleStore.bookContent`, so every query would otherwise stream-scan up to 66 per-book JSON files per searched module.

## Decision

Each searchable module gets its own persistent inverted index (folded terms → verse-id postings with character offsets), stored beside the module's content in the plugin data dir and stamped with an index format version plus the module's source checksum.

The module grain is what makes persistence cheap enough to reverse §10's exclusion: module content is immutable between downloads, so there is no file-watching and no incremental maintenance — an index is either valid or rebuilt whole. The only staleness triggers are a re-downloaded module (checksum mismatch) and a format-version bump, both detected at load. Install/uninstall life-cycles clean indexes up for free, and a query fans out over exactly the selected modules' indexes.

## Considered Options

- **Streaming scan, no index** — simplest, honors §10, but every query pays the full 66-file read and search-as-you-type is forever off the table.
- **One global index over all modules** — needs partial invalidation and orphan cleanup logic that the module grain provides for free.
- **Third-party engine (minisearch/lunr/SQLite)** — brings tokenizers that fight our diacritic-folding and char-offset needs, plus a dependency, for what is a sorted-map lookup over ~31k short texts.
