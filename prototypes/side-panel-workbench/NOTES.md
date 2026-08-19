# Side-panel workbench prototype — NOTES

**Question**: the References Panel becomes a multi-tool "workbench" panel that follows the
focused document (reader → current chapter; note → its references) and hosts three tools:
references-in-document, the reader's verse-details/cross-references content, and the new
margin references. What should that panel look like?

**Run:** open `index.html` in any browser. Mock data only (John 15, TSK-style margin refs).

Three variants, switchable via the floating bottom bar (or ←/→ keys):

- **A — Tab strip.** Flat text tabs across the panel top; the tab set adapts to context.
- **B — Stacked sections.** One scroll of collapsible sections with counts; own
  cross-references always demarcated above margin references.
- **C — Icon rail.** Narrow activity-bar rail on the panel edge; one tool at a time,
  context named in the header.

Shared in all variants: fake workspace tabs (Reader — John 15, two notes) to flip focus,
and per-document memory of the panel's last state (switch away and back to verify).

## Verdict

_(pending — fill in the winning variant / stolen bits before deleting this folder)_
