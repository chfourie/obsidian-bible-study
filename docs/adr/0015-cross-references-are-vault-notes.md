# Cross-references are vault notes, one per connection

Date: 2026-09-10
Status: accepted — supersedes [0003](0003-cross-references-in-plugin-managed-data-file.md)

ADR 0003 kept cross-references out of vault notes because an edge has no natural unique name, and put them in one plugin-managed JSON-lines file instead. Living with that file showed the other side of the trade: it is unreadable to a human, it is the only piece of study data the vault index has to be taught to ignore, its rationale is a one-line field edited only through plugin UI, and it cannot carry links, backlinks or the graph. Annotations meanwhile proved the vault-notes-as-truth pattern end to end.

**Decision:** every cross-reference is a vault note. Frontmatter declares `type: cross-reference`, the member `refs` (grammar strings, canonicalized on plugin write, hand-typed accepted) and a one-line `summary`; the body is the user's own. Identity is the note; the filename is generated for recognisability, bounded to the first two members plus a count, and never consulted for anything. Members index as occurrences in the existing vault index, so surfacing is the same intersection query annotations use and the store, its data file and the index exclusion all go away.

**The naming objection, answered:** the name only has to be recognisable, not unique or meaningful — collisions take a numeric suffix as annotation filenames already do, and the generated name is regenerated after a member edit only while it still matches what the plugin last generated, so a hand-chosen name is never clobbered.

**Rejected:** rewriting the single file as human-readable markdown (readable, but still one file the index must skip and the user cannot link to); opaque id filenames (what 0003 rightly refused); deriving the name from a `title` key (nothing displays a title, and a second naming rule invites drift).
