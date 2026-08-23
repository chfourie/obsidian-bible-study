<!--
The chapter's Word Cloud: its ten most tagged Strong's Families, each headed
by the Rendering the chapter gives it most often (its gloss when none) over
its transliteration, sized by how often the chapter tags it and listed most
frequent first. Hovering a word shows its gloss, original-script lemma and
count; pressing one toggles its Occurrence Emphasis; a right-click (or the
context-menu key) opens the word's menu — highlight, word study, exclude —
from the items the host builds for it. A fallback source — a tagged
translation standing in for the untagged one being read — is named beside
the heading. Without Strong's the section holds the hint to enable it; it is
hidden while there is no cloud or nothing eligible in it.
-->
<script lang="ts">
  import type {
    WordCloudSourceView,
    WordCloudView,
    WordCloudWordView,
  } from '../contracts'
  import { MenuPanel, pressable, type MenuItem } from '../ui'
  import SectionHeading from './SectionHeading.svelte'

  let {
    cloud,
    toggle,
    menuItems,
  }: {
    cloud: WordCloudView | null
    toggle: (word: WordCloudWordView) => void
    menuItems: (word: WordCloudWordView) => MenuItem[]
  } = $props()

  // The open menu follows its family, not a snapshot of the word, so a
  // highlight toggled while it is open relabels the item.
  let menuFamily = $state<string | null>(null)
  let menuAnchor = $state.raw<HTMLElement | null>(null)
  let menuOpenedByKeyboard = $state(false)
  const menuWord = $derived(
    cloud?.kind === 'counted'
      ? (cloud.words.find((word) => word.family === menuFamily) ?? null)
      : null,
  )
  const menuSections = $derived(
    menuWord === null ? [] : [{ label: null, items: menuItems(menuWord) }],
  )

  const heading = (source: WordCloudSourceView): string =>
    source.fallback ? `Key Words · ${source.label}` : 'Key Words'

  const headline = (word: WordCloudWordView): string =>
    word.rendering === '' ? word.gloss : word.rendering

  const tooltip = (word: WordCloudWordView): string =>
    [word.gloss, word.lemma, `${word.count}`]
      .filter((part) => part !== '')
      .join(' · ')

  const openMenu = (
    word: WordCloudWordView,
    anchor: HTMLElement,
    byKeyboard: boolean,
  ) => {
    menuFamily = word.family
    menuAnchor = anchor
    menuOpenedByKeyboard = byKeyboard
  }

  const closeMenu = () => {
    menuFamily = null
    menuAnchor = null
  }

  const opensContextMenu = (event: KeyboardEvent): boolean =>
    event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)

  // Direct listeners rather than Svelte's delegated `oncontextmenu`, for the
  // same popout-window reason as `pressable`.
  function contextMenu(node: HTMLElement, word: WordCloudWordView) {
    let current = word
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      openMenu(current, node, false)
    }
    const onKeydown = (event: KeyboardEvent) => {
      if (!opensContextMenu(event)) return
      event.preventDefault()
      openMenu(current, node, true)
    }
    node.addEventListener('contextmenu', onContextMenu)
    node.addEventListener('keydown', onKeydown)
    return {
      update(next: WordCloudWordView) {
        current = next
      },
      destroy() {
        node.removeEventListener('contextmenu', onContextMenu)
        node.removeEventListener('keydown', onKeydown)
      },
    }
  }
</script>

{#if cloud?.kind === 'unavailable'}
  <SectionHeading label="Key Words" />
  <div class="bsm-cloud-hint">Enable Strong's to see the key words.</div>
{:else if cloud !== null && cloud.words.length > 0}
  <SectionHeading label={heading(cloud.source)} />
  <div class="bsm-word-cloud">
    {#each cloud.words as word (word.family)}
      <span
        class="bsm-cloud-word"
        class:bsm-cloud-word-active={word.active}
        style:font-size="{word.sizeEm}em"
        title={tooltip(word)}
        role="button"
        tabindex="0"
        aria-pressed={word.active}
        use:pressable={() => toggle(word)}
        use:contextMenu={word}
      >
        <span class="bsm-cloud-headline"
          >{headline(word)}
          <span class="bsm-cloud-count">({word.count})</span></span
        >
        {#if word.transliteration !== ''}
          <span class="bsm-cloud-translit">{word.transliteration}</span>
        {/if}
      </span>
    {/each}
  </div>
{/if}

{#if menuWord !== null}
  <MenuPanel
    sections={menuSections}
    anchor={menuAnchor}
    placement="below"
    align="left"
    anchorDismisses
    focusOnOpen={menuOpenedByKeyboard}
    onClose={closeMenu}
  />
{/if}

<style>
  .bsm-cloud-hint {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  .bsm-word-cloud {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin: 8px 0 4px;
    font-size: var(--font-ui-small);
  }

  .bsm-cloud-word {
    display: inline-flex;
    align-items: baseline;
    gap: 0.5em;
    padding: 0.1em 0.3em;
    border-radius: var(--radius-s);
    color: var(--text-normal);
    line-height: 1.15;
    cursor: pointer;
  }

  .bsm-cloud-word:hover {
    background: var(--background-modifier-hover);
  }

  .bsm-cloud-word:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 1px;
  }

  /* The accent pair reads distinctly against the panel in both themes. */
  .bsm-cloud-word-active,
  .bsm-cloud-word-active:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .bsm-cloud-count {
    font-size: 0.6em;
    color: var(--text-muted);
  }

  .bsm-cloud-word-active .bsm-cloud-count {
    color: inherit;
  }

  .bsm-cloud-translit {
    font-size: 0.6em;
    color: var(--text-muted);
    font-style: italic;
  }

  .bsm-cloud-word-active .bsm-cloud-translit {
    color: inherit;
  }
</style>
