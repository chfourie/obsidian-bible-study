# The book pipeline

Turns a curated Markdown source into a Book module artifact — manifest plus
paragraph atoms plus their live citations. One pipeline serves every book
(spec-books §2, ADR 0002); adding a book means curating a Markdown file and
appending an entry to [`scripts/book-registry.json`](../book-registry.json),
never writing a parser.

```
markdown + registry + ref overrides  ->  buildBookArtifact  ->  artifact
```

`buildBookArtifact` is pure. The runner beside it
(`scripts/build-in-module.mjs` for *IN*) reads the files, writes
`dist/<module-id>-module/`, and prints the per-section paragraph and Ref Span
counts the maintainer reviews before the release that freezes the grid.

## Curating a source

A source is one Markdown file, committed beside whatever it was made from —
for *IN*, `resources/IN First Edition.md` beside the PDF the registry records
the SHA-256 of. Producing it is a one-time job: extract the text (`pdftotext
-layout` is a fine aid, and is not a build dependency), then clean it by hand
— strip page numbers, running heads and footers, unwrap justified lines, undo
hyphenation, flatten tables.

### Front matter

```markdown
---
module: in-at-e1
language: English
---
```

`module` names the registry entry the source is curated for; the build fails
if the registry does not carry it, or carries it too thinly to publish from.
`language` defaults to English.

### Headings

| Markdown | Meaning |
| --- | --- |
| `# PART ONE: Fall of Man – Death through Sin` | Part title — a `part` Heading |
| `## 12. Our Pathway` | section head: chapter number, then the printed name |
| `## 0. Prologue {named}` | a section the printed work gives no number to |
| `### 12.1 Repentance – Crucified` | a `section` Heading |
| `#### 12.4.1 Preparation` | a `sub-section` Heading |

Only `##` opens a section. Every other heading attaches to the paragraph that
follows it and consumes no id, so a Part title written above the chapter head
it opens lands on that chapter's first paragraph. `{named}` marks front and
back matter, whose name replaces the chapter locator when a reference to it is
displayed (spec-books §4).

A Heading rides in the artifact on the paragraph it precedes, in source
order, as `{ text, level }` — never inside the paragraph's own text, so
highlight and Ref Span offsets are the same with a Heading as without. The
section table names the Part each numbered section sits under (`part`), read
off the part-level Heading that opened it; front and back matter (`{named}`)
stand outside the Parts, as the printed work has them.

### Atoms

A blank line separates atoms. Within one atom:

- **Prose** may stay wrapped: the lines are joined with a single space.
- **A list is one atom.** A block whose first line opens with `-`, `*`, `•`,
  `|` or `1.` keeps its line breaks, one item per line. A list item that runs
  over several printed lines must be curated onto one line. The kept breaks
  stay in the stored text and a `lines` channel beside it says where each
  line starts — the same channel a translation's poetry rides on, so the
  reader and a note's citation print the breaks without knowing about books.
- **A table is one atom**, pre-flattened by the curator to one row per line
  with `|` between cells. The leading `|` is the curator's row marker and is
  not stored; the cells are stored separated by ` | `, so a row reads as
  `Faithful in Christ | 1:1 | Were dead in trespasses and sins | 2:1`. Bare
  `chapter:verse` cells are never linked — a citation needs its book name.
- **A scripture block quote merges into its lead-in paragraph**; a quote that
  opens a section stands as that section's first atom.
- `>` blocks are epigraphs, kept beside the prose as section metadata. The
  last line may carry the attribution, opening with `—`.

The first published release freezes the grid: later releases may fix text
inside a paragraph but never split, merge, insert, delete or renumber one.

## Ref Spans

The scanner links the author's explicit citations only. It reads
`Book 3:16`, ranges (`Ephesians 6:10-20`), and the author's own list
punctuation — `&`, `,` and `;` continue one citation, `and` starts a fresh
one. It also links the book's cross-walks onto its own grid: `Chapter 12`, a
named back-matter section such as `Appendix C`, and a sub-section pointer such
as `7.3` (which resolves to the chapter that holds it). A cross-walk reads the
same lower-cased (`see chapter 20`), and a verse list stops short of the
ordinal that belongs to the next citation's book name (`Ephesians 1:19-23,
1 Peter 3:22` is two citations).

A citation the scanner deliberately leaves as prose: a verse-less chapter or
chapter range (`Psalm 51`, `Romans 5-8`), and a bare `chapter:verse` with no
book name, which is how a flattened table's cells read.

Text that is shaped like a citation but resolves to nothing fails the build,
listed atom by atom, rather than vanishing. Each one is answered in the book's
`ref-overrides.json` (`scripts/in-pipeline/ref-overrides.json`):

- **fix** — `at`, `text`, `reference`: supply the ranges for a citation the
  printed text mangled.
- **suppress** — `at`, `text`: silence a false positive, such as a `Chapter 1`
  that cites a different author's book.

`at` is `chapter.paragraph`, or `chapter.eN` for a section's Nth epigraph. An
override whose `text` no longer matches its atom exactly once fails the build,
so a re-cut source cannot rot the annotations.
