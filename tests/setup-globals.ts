// Obsidian exposes `activeDocument` / `activeWindow` as globals that resolve
// to the document/window of the currently-focused (possibly popped-out) leaf.
// The plugin uses them for popout-window compatibility (the
// `obsidianmd/prefer-active-doc` rule). jsdom doesn't define them, so the test
// environment polyfills them to the single jsdom document/window — matching the
// single-window behaviour Obsidian falls back to.
const g = globalThis as typeof globalThis & {
  activeDocument?: Document
  activeWindow?: Window & typeof globalThis
}
if (typeof g.activeDocument === 'undefined' && typeof document !== 'undefined') {
  g.activeDocument = document
}
if (typeof g.activeWindow === 'undefined' && typeof window !== 'undefined') {
  g.activeWindow = window
}

// Only the option fields the plugin actually uses are supported
// (cls, text, attr).
type DomElementInfo = {
  cls?: string | string[]
  text?: string
  attr?: Record<string, string | number | boolean | null>
}

const applyDomElementInfo = (
  el: HTMLElement,
  o?: DomElementInfo | string
): void => {
  if (typeof o === 'string') {
    el.className = o
    return
  }
  if (!o) return
  if (o.cls) {
    const classes = Array.isArray(o.cls) ? o.cls : o.cls.split(/\s+/)
    el.classList.add(...classes.filter(Boolean))
  }
  if (o.text !== undefined) el.textContent = o.text
  if (o.attr) {
    for (const [key, value] of Object.entries(o.attr)) {
      if (value === null) continue
      el.setAttribute(key, String(value))
    }
  }
}

// Obsidian hangs `createEl` / `createDiv` / `createSpan` / `createFragment`
// off every window, creating detached nodes in that window's document; jsdom
// has none of them.
type ObsidianDomHelpers = {
  createEl?: <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    o?: DomElementInfo | string
  ) => HTMLElementTagNameMap[K]
  createDiv?: (o?: DomElementInfo | string) => HTMLDivElement
  createSpan?: (o?: DomElementInfo | string) => HTMLSpanElement
  createFragment?: () => DocumentFragment
}

if (typeof window !== 'undefined') {
  const w = window as Window & ObsidianDomHelpers
  w.createEl ??= <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    o?: DomElementInfo | string
  ) => {
    const el = w.document.createElement(tag)
    applyDomElementInfo(el, o)
    return el
  }
  w.createDiv ??= (o?: DomElementInfo | string) => {
    const el = w.document.createElement('div')
    applyDomElementInfo(el, o)
    return el
  }
  w.createSpan ??= (o?: DomElementInfo | string) => {
    const el = w.document.createElement('span')
    applyDomElementInfo(el, o)
    return el
  }
  w.createFragment ??= () => w.document.createDocumentFragment()
}

// Obsidian exposes `doc.win` — the window a document belongs to — for popout
// compatibility. jsdom calls it `defaultView`.
if (
  typeof Document !== 'undefined' &&
  !Object.getOwnPropertyDescriptor(Document.prototype, 'win')
) {
  Object.defineProperty(Document.prototype, 'win', {
    get(this: Document) {
      return this.defaultView
    },
    configurable: true,
  })
}

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: DomElementInfo | string
    ): HTMLElementTagNameMap[K]
    createDiv(o?: DomElementInfo | string): HTMLDivElement
    createSpan(o?: DomElementInfo | string): HTMLSpanElement
    empty(): void
    addClass(...classes: string[]): void
    removeClass(...classes: string[]): void
    toggleClass(classes: string | string[], value: boolean): void
    setText(text: string): void
    appendText(text: string): void
  }
}

if (typeof HTMLElement !== 'undefined') {
  const proto = HTMLElement.prototype as HTMLElement & {
    createEl?: unknown
    createDiv?: unknown
    createSpan?: unknown
    empty?: unknown
    addClass?: unknown
    removeClass?: unknown
    toggleClass?: unknown
    setText?: unknown
    appendText?: unknown
  }

  proto.createEl ??= function (
    this: HTMLElement,
    tag: string,
    o?: DomElementInfo | string
  ) {
    const el = this.ownerDocument.createElement(tag)
    applyDomElementInfo(el, o)
    this.appendChild(el)
    return el
  }
  proto.createDiv ??= function (this: HTMLElement, o?: DomElementInfo | string) {
    return this.createEl('div', o)
  }
  proto.createSpan ??= function (this: HTMLElement, o?: DomElementInfo | string) {
    return this.createEl('span', o)
  }
  proto.empty ??= function (this: HTMLElement) {
    this.replaceChildren()
  }
  proto.addClass ??= function (this: HTMLElement, ...classes: string[]) {
    this.classList.add(...classes)
  }
  proto.removeClass ??= function (this: HTMLElement, ...classes: string[]) {
    this.classList.remove(...classes)
  }
  proto.toggleClass ??= function (
    this: HTMLElement,
    classes: string | string[],
    value: boolean
  ) {
    for (const cls of Array.isArray(classes) ? classes : [classes]) {
      this.classList.toggle(cls, value)
    }
  }
  proto.setText ??= function (this: HTMLElement, text: string) {
    this.textContent = text
  }
  proto.appendText ??= function (this: HTMLElement, text: string) {
    this.appendChild(this.ownerDocument.createTextNode(text))
  }
}
