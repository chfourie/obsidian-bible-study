// Cmd (macOS) or Ctrl (Windows/Linux) held while activating a reference asks
// for a fresh reader pane instead of reusing the open one, matching how
// Obsidian's own links treat the modifier.
export const opensInNewPane = (event: MouseEvent | KeyboardEvent): boolean =>
  event.metaKey || event.ctrlKey
