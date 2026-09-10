import { setIcon } from 'obsidian'

export const PAGE_BREAK_CLASS = 'scripture-study-page-break'
export const PAGE_BREAK_TRAILING_CLASS = 'scripture-study-page-break-trailing'
export const PAGE_BREAK_ICON = 'separator-horizontal'
export const PAGE_BREAK_LABEL = 'page break'

// The one indicator Reading mode and the Live Preview widget both show: a
// block, since a page break on an inline element is ignored in print.
export const renderPageBreakIndicator = (trailing: boolean): HTMLElement => {
  const element = createDiv({ cls: PAGE_BREAK_CLASS })
  if (trailing) element.addClass(PAGE_BREAK_TRAILING_CLASS)
  const pill = element.createSpan({ cls: `${PAGE_BREAK_CLASS}-pill` })
  setIcon(pill.createSpan({ cls: `${PAGE_BREAK_CLASS}-icon` }), PAGE_BREAK_ICON)
  pill.createSpan({
    cls: `${PAGE_BREAK_CLASS}-label`,
    text: PAGE_BREAK_LABEL,
  })
  return element
}
