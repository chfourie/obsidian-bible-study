# The book pipeline

Turns a curated Markdown source into a Book module artifact — manifest plus
atoms plus their live citations. One pipeline serves every book (spec-books
§2, ADR 0002); adding a book means curating a Markdown file and appending an
entry to [`scripts/book-registry.json`](../book-registry.json), never writing
a parser.

```
markdown + registry + ref overrides  ->  buildBookArtifact  ->  artifact
```

`buildBookArtifact` is pure. The registry entry's `atom` kind — `verse` or
`paragraph`, absent meaning paragraph (spec-books §1) — selects how the body
is read: blank-line paragraphs for *Humility* and *IN* ([Atoms](#atoms)), or
`N.` / `Na.` verse-lines for *1 Enoch* ([Verse-atom Books](#verse-atom-books)).
The build copies the kind into the manifest's `book` sub-object and fails on
a registry/manifest mismatch, as it does on any other identity field.

The IO glue is shared too: `build-book-module.mjs` beside this file reads
the source, registry, overrides and images, writes `dist/<module-id>-module/`,
and prints the per-section atom and Ref Span counts the maintainer reviews
before the release that freezes the grid. Each Book's runner only names the
book — `scripts/build-in-module.mjs` for *IN*, `scripts/build-enoch-module.mjs`
for *1 Enoch*.

## Curating a source

A source is one Markdown file, committed beside whatever it was made from —
for *IN*, `resources/IN First Edition.md` beside the PDF the registry records
the SHA-256 of; for *1 Enoch*, `resources/1 Enoch Charles 1912.md` beside the
Project Gutenberg #77935 plain text. Producing it is a one-time job: extract
the text (`pdftotext -layout` is a fine aid, and is not a build dependency),
then clean it by hand — strip page numbers, running heads and footers,
unwrap justified lines, undo hyphenation, flatten tables. A digitizer's
boilerplate and name never enter the curated source (spec-books §2): the raw
text stays in `resources/` as provenance only, and nothing of it ships.

### Curator comments

A line opening with `%%` — Obsidian's comment syntax, so the vault shows the
source the same way — is the curator's own and is dropped before anything
else reads it: it neither wraps onto the line above nor ends a block, and
nothing of it is stored. A waiver (see Footnotes) is one such line.

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
| `## 5.` | a verse-atom section the printed work gives no name to |
| `### 12.1 Repentance – Crucified` | a `section` Heading |
| `#### 12.4.1 Preparation` | a `sub-section` Heading |

Only `##` opens a section. Every other heading attaches to the paragraph that
follows it and consumes no id, so a Part title written above the chapter head
it opens lands on that chapter's first paragraph. `{named}` marks front and
back matter, whose name replaces the chapter locator when a reference to it is
displayed (spec-books §4). A paragraph Book's section always carries a name;
a verse-atom section may be `## 5.` alone, and is then named by its printed
chapter number (`"5"`) without being `named` (spec-books §1).

A Heading rides in the artifact on the paragraph it precedes, in source
order, as `{ text, level }` — never inside the paragraph's own text, so
highlight and Ref Span offsets are the same with a Heading as without. The
section table names the Part each numbered section sits under (`part`), read
off the part-level Heading that opened it; front and back matter (`{named}`)
stand outside the Parts, as the printed work has them.

### Figures

```markdown
![A tree diagram of the tree of life](in-images/tree-of-life.png "Fig 2 Tree of Life")
```

A Markdown image standing alone as a block is a **Figure** — section
furniture beside the grid, like a Heading (spec-books §9). It attaches to the
paragraph that follows it and prints above it; one that closes a section
attaches to the section's last paragraph and prints below it instead. The
optional Markdown title is the printed caption; where the printed work set
the caption as its own paragraph, that paragraph stays an atom and the figure
simply stands above it. A figure consumes no id, is never searched and is
never citable.

The image files are committed beside the source — `resources/in-images/` for
*IN* — and the path is written relative to the source file. The runner reads
every image under the source's directory and the build inlines the ones the
figures point at as base64 data URIs, so the module carries its own pictures;
a figure pointing at an image the build was not given fails the build.

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
  Beside that flat text every row carries its **cells** as spans over it, so
  the reader and a note's citation print the grid the printed work had
  without ever re-reading the text for a delimiter. A cell the printed table
  leaves blank (`| | Infallible | Inquire of God`) stays out of the text and
  rides as a span of no width, which keeps the row in its columns. Writing a
  Markdown header rule under the first row marks it as the table's header
  row; the rule is a marker, not a row, and is stored as nothing:

  ```markdown
  | God’s kingdom | Chapter: verse | World | Chapter: verse
  | --- | --- | --- | ---
  | Faithful in Christ | 1:1 | Were dead in trespasses and sins | 2:1
  ```

  A table the printed work gives no headings — *IN*'s prayer table in
  Appendix A — simply carries no rule, and every row prints as a plain row.
- **A scripture block quote merges into its lead-in paragraph**; a quote that
  opens a section stands as that section's first atom.
- `>` blocks are epigraphs, kept beside the prose as section metadata. The
  last line may carry the attribution, opening with `—`.

The first published release freezes the grid: later releases may fix text
inside a paragraph but never split, merge, insert, delete or renumber one.

## Verse-atom Books

A Book whose registry entry says `"atom": "verse"` is read by the verse-line
parser instead (spec-books §11, ADR 0011): the atom is the printed verse, and
the chapter is the `##` section head, never part of a prefix. Within a
section every body line is one of two things:

- **A verse-line** — `N. text` for a verse or a metrical line of it, `Na.
  text` for a line the print letters (Charles's `6a`). The digit says which
  verse the line belongs to; the letter is stripped onto the line as its Line
  letter and never enters the stored text.
- **A wrap** — an unprefixed line, joined with a single space onto the
  verse-line before it. A page-wrap is not a metrical line, and one that
  opens with a bare numeral (`5 years 1820 days`) is still a wrap: only a
  dot after the digits (`6A.`, `6aa.`) or a lone letter (`6a text`) reads as
  a prefix gone wrong.

The prefix is repeated on every metrical line — `6a.` / `6b.` / `6c.` for a
lettered poem, `3.` / `3.` / `3.` for an unlettered one — and the lines are
written in the edition's **page order**. A prose verse is one prefix plus its
wraps and carries no `lines`; a poem's lines ride in the `lines` channel,
flush, one atom per verse, with the atom's text space-joined. A mixed verse
(1:3) is an unlettered lead-in followed by that verse's lines: the lead-in
is line 0 of the same atom, and unlettered lines come only before the
lettered ones.

A blank line sets `paragraph` on the next verse-line — a stanza gap inside a
verse or a break before the next — and never delimits an atom; a section's
first verse-line carries it too. Because a prose verse has no `lines`, a
blank line before one has nowhere to land and is not encoded. `1.` is verse 1,
never a list: lists and tables fail the build in a verse-atom section.

The atom's stored `lines` are in **letter order** whatever their place on the
page (ADR 0010), so `7c.` written between `6c.` and `6d.` stores on verse 7
after `7a` and `7b`, and the page walk survives as the section's `reading`
— present only where the page is not the identity walk (ADR 0013). Missing
letters are never invented: `6a`, `6c` with no `6b` stays two lines.

The build fails, citing the source line, on a line with no prefix that is
not a wrap; a malformed prefix (`6A.`, `6aa.`) or one with no text; a
repeated letter within a verse; an unlettered line after a lettered one in
the same verse; a hole in the section's `1..N`; a list or table. A present
`reading` is checked citing the section — every atom walked, every line of
a lined atom exactly once, every prose atom exactly once as a whole.

```markdown
## 5.

3. And behold how the sea and the rivers in like manner accomplish <marks>⌈</marks>and
change not<marks>⌉</marks> their tasks <marks>⌈</marks>from His commandments<marks>⌉</marks>.

4. But ye—ye have not been steadfast, nor done the commandments of the Lord,
4. But ye have turned away and spoken proud and hard words

6a. In those days ye shall make your names an eternal execration unto all
the righteous,
6b. And by you shall <marks>⌈</marks>all<marks>⌉</marks> who curse, curse.
7c. And for you, the godless, there shall be a curse.
```

*1 Enoch*'s source was drafted from the PG #77935 text by
`scripts/enoch-pipeline/convert-pg77935.mjs` — a curation aid, not a build
step — and hand-fixed against the 1912 page images; `resources/1 Enoch
Charles 1912 CURATION.md` records the glyph map, the page checks and the
readings chosen where the print and the parser's rules meet.

## Editorial marks

A critical edition's marks — Charles's version brackets, interpolations,
supplied words, thick type — are never inferred from the glyphs (spec-books
§10, ADR 0008). The curator wraps them as three HTML elements, in atom text
and in an epigraph's quote, for a paragraph Book and a verse-atom Book
alike; the wrappers are never stored, and the build emits one span channel
per element beside the stored text:

| Wrapper | Stored | Channel |
| --- | --- | --- |
| `<supplied>even</supplied>` | `even` — the delimiters are not written | `supplied` over the words |
| `<marks>⌈</marks>which<marks>⌉</marks>` | `⌈which⌉` — the glyph stays | `marks`, one span per wrapper |
| `<emended>steadfast</emended>` | `steadfast` | `emended` over the words |

Charles's `(even)` in 1:4 is therefore written `<supplied>even</supplied>`,
his `⌈⌈which⌉⌉` in 1:2 `<marks>⌈⌈</marks>which<marks>⌉⌉</marks>`, and the
thick type inside 2:2's version bracket
`<marks>⌈</marks>how <emended>steadfast</emended> they are<marks>⌉</marks>`.
The glyphs themselves are the 1912 print's — `⌈ ⌉`, `⌈⌈ ⌉⌉`, `〈 〉`, `[ ]`,
`†`, `…` — so a digitization's substitutes (`⌜⌝`, `〚〛`, `=thick type=`)
are normalized while curating, and a bracket pair is two `<marks>`
wrappers, one on each glyph, never one around the enclosed words.

The wrappers are parsed on the joined atom: in a verse-atom section they
sit after the `N.` / `Na.` prefix, and one may open on a metrical line and
close on a later line of the same verse. Every offset the build writes
indexes the stored string, so a list's line starts and a table's cells
follow their text through the strip. Nesting is allowed — a supplied word
inside an interpolation, an emended word inside a version bracket. Each
atom's spans stand alone: a run the print carries over a verse break is
written as one wrapper closed at the first verse's end and another opened
in the next.

The build fails, citing the atom (`1:4` for a verse, `1.3` or `1.e1` for a
paragraph Book's atom or epigraph), on: a wrapper left open at the atom's
end or closed with none open; overlapping wrappers; an element that is not
exactly `<supplied>`, `<marks>` or `<emended>` (no capitals, no attributes);
an empty wrap; a raw `<` anywhere in atom text or an epigraph. It fails,
citing the furniture, on a wrapper or `<` in a Heading, a section head or a
figure's caption or alt text — furniture never carries an Editorial mark.
A Book with no wrappers builds exactly as before and carries no channel.

## Footnotes

An editor's note on an atom is written where it belongs in the reading and
lifted out of the stored text at build (spec-books §6, ADR 0012):

```
2. Behold ye the earth, <marks>⌈</marks>how <emended>steadfast</emended> they
   are<marks>⌉</marks>. [Footnote: So Dillmann; the Ethiopic is corrupt.]
```

The marker is `[Footnote: text]`, or `[Footnote2: text]` — a number after
`Footnote` is *Humility*'s own source shape and is read the same way, because
nothing addresses a note. The whitespace before the marker is lifted with it,
so the reading closes up exactly as the print has it, and the note rides
beside the atom as `footnotes: [{ start, text }]` — the anchor offset into
the **stored** string, past both this lift and the wrapper strip, in the
order the notes stand. An atom with no note carries no channel.

Nothing prints the note but the Study Panel: no marker stands in the reader
page, in a chip, or in a note's `inline` or `block`, and the Search Index
never reads a note, so a word only Charles wrote earns no Hit.

The note's own text is plain: no Editorial-mark wrapper, no `<`, and no `]`
(the first one closes the marker). The build fails, citing the atom, on a
wrapper inside a note and on a `[Footnote` the marker syntax cannot read — a
missing colon, an unclosed bracket. It fails, citing the epigraph or the
furniture, on a marker in an epigraph, a Heading, a section head or a
figure's caption or alt text: a Footnote is a channel on an atom.

A marked atom with no note of its own is **not** an error. The build lists
every one of them at the end —

```
Footnotes to curate: 15
  1:1 carries an Editorial mark and no Footnote
```

— as the curation to-do, so the notes can be written over releases while the
grid ships.

Where the print gives no note for a mark — a bracket the key alone explains,
a routine version bracket Charles passes over — the curator waives the atom
in a comment line that names it and says why:

```
%% waived 1:4 — the interpolation bracket is the key's; Charles prints no note on it.
```

A waived atom leaves the to-do. The build fails on a waiver with no reason,
and on one naming an atom that is not on the to-do — no such atom, no mark on
it, or a Footnote written since — so a waiver is as deliberate as a note and
never survives a renumbering unnoticed.

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
