<script lang="ts">
  import { BOOK_COUNT, bookName, chapterCount, type Reference } from '../reference'
  import {
    paragraphsOf,
    type ReaderPaneModel,
    type ReaderToggles,
    type VerseDetailsView,
    type VerseRowView,
  } from './reader-pane-model'
  import type { VerseSegment } from '../rendering'
  import TranslationMenu from './TranslationMenu.svelte'
  import OptionsMenu from './OptionsMenu.svelte'

  let {
    model,
    openNote,
    openReference,
    onAnnotate,
    renderMarkdown,
  }: {
    model: ReaderPaneModel
    openNote: (file: string) => void
    openReference: (reference: Reference) => void
    onAnnotate: (reference: Reference) => void
    renderMarkdown: (el: HTMLElement, markdown: string, sourcePath: string) => void
  } = $props()

  // Initial snapshot only — the model subscription below keeps it fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  $effect(() =>
    model.subscribe(() => {
      view = model.view
    }),
  )

  let openBook: number | null = $state(null)
  let sideTab: 'translations' | 'notes' = $state('translations')

  const books = Array.from({ length: BOOK_COUNT }, (_, index) => index + 1)
  const chaptersOf = (book: number): number[] =>
    Array.from({ length: chapterCount(book) }, (_, index) => index + 1)

  const treeBook = $derived(openBook ?? view.position.book)
  const selectedDetails = $derived(
    view.selectedVerseId === null
      ? null
      : (view.details[view.selectedVerseId] ?? null),
  )

  const setToggle = (key: keyof ReaderToggles, value: string): void => {
    model.setToggle(key, value as ReaderToggles[typeof key])
  }

  const contentFontSize = $derived(
    `calc(var(--font-text-size) * ${view.fontScalePercent / 100})`,
  )

  // The translation pills collapse to a dropdown when their natural width no
  // longer fits the toolbar space left over by the toggle groups. The hidden
  // measurer keeps rendering the pills so the row can expand back.
  let pillSlotEl: HTMLElement | null = $state(null)
  let pillMeasureEl: HTMLElement | null = $state(null)
  let pillsCollapsed = $state(false)

  const remeasurePills = (): void => {
    if (pillSlotEl === null || pillMeasureEl === null) return
    pillsCollapsed = pillMeasureEl.scrollWidth > pillSlotEl.clientWidth
  }

  $effect(() => {
    void view.translations
    remeasurePills()
  })

  $effect(() => {
    if (pillSlotEl === null) return
    const observer = new ResizeObserver(remeasurePills)
    observer.observe(pillSlotEl)
    return () => observer.disconnect()
  })

  const verseMarks = (row: VerseRowView): { anno: boolean; mentions: number } => ({
    anno: row.annotations > 0,
    mentions: row.mentions,
  })

  const detailsFor = (row: VerseRowView): VerseDetailsView | null =>
    row.expanded ? (view.details[row.verseId] ?? null) : null

  const onVerseClick = (event: MouseEvent, verseId: number): void => {
    if (event.shiftKey) model.extendSelectionTo(verseId)
    else void model.selectVerse(verseId)
  }

  const onWordClick = (
    event: MouseEvent | KeyboardEvent,
    verseId: number,
    strongs: string[],
  ): void => {
    event.stopPropagation()
    void model.selectWord(verseId, strongs)
  }

  const inSelectionSpan = (verseId: number): boolean => {
    if (view.selectedVerseId === null || view.selectionEndId === null) return false
    const low = Math.min(view.selectedVerseId, view.selectionEndId)
    const high = Math.max(view.selectedVerseId, view.selectionEndId)
    return verseId >= low && verseId <= high
  }

  const verseSelected = (verseId: number): boolean =>
    inSelectionSpan(verseId) ||
    (view.toggles.details === 'side-panel' && view.selectedVerseId === verseId)

  const annotateVerseBlock = (verseId: number): void => {
    onAnnotate(model.annotationReference(verseId))
  }

  type MarkdownBody = { text: string; path: string }
  const markdown = (el: HTMLElement, body: MarkdownBody) => {
    const render = (value: MarkdownBody): void => {
      el.replaceChildren()
      renderMarkdown(el, value.text, value.path)
    }
    render(body)
    return { update: render }
  }

  let typedMember = $state('')

  const startCollecting = (): void => {
    typedMember = ''
    model.startCollecting()
  }

  const startEditingCrossReference = (
    entry: VerseDetailsView['crossReferences'][number],
  ): void => {
    typedMember = ''
    model.startEditingCrossReference(entry.id, entry.allMembers, entry.description)
  }

  const addTypedMember = (): void => {
    model.addTypedReferenceToCollection(typedMember)
    if (model.view.collection?.error === null) typedMember = ''
  }

  const createCrossReference = (): void => {
    void model.createCrossReference()
  }

  const createWithoutDescription = (): void => {
    model.describeCollection('')
    createCrossReference()
  }

  let editingXrefDescription: string | null = $state(null)
  let xrefDescriptionDraft = $state('')

  const startEditingXrefDescription = (entry: VerseDetailsView['crossReferences'][number]): void => {
    editingXrefDescription = entry.id
    xrefDescriptionDraft = entry.description ?? ''
  }

  const commitXrefDescription = (id: string): void => {
    void model.updateCrossReferenceDescription(id, xrefDescriptionDraft)
    editingXrefDescription = null
  }

  const cancelEditingXrefDescription = (): void => {
    editingXrefDescription = null
  }

  const removeXrefMember = (id: string, memberIndex: number): void => {
    void model.removeCrossReferenceMember(id, memberIndex)
  }

  const onBookPicked = (event: Event): void => {
    const book = Number((event.target as HTMLSelectElement).value)
    void model.goTo(book, 1)
  }

  const onChapterPicked = (event: Event): void => {
    void model.goTo(view.position.book, Number((event.target as HTMLSelectElement).value))
  }
</script>

{#snippet notesBlock(details: VerseDetailsView)}
  <div class="bsr-notes-head">
    <span class="bsr-group-label">Annotations</span>
    <button type="button" class="bsr-annotate" onclick={() => annotateVerseBlock(details.verseId)}>Annotate</button>
  </div>
  {#if details.annotations.length === 0}
    <div class="bsr-details-empty">No annotations.</div>
  {:else}
    {#each details.annotations as block, index (block.file)}
      {#if index > 0}<hr class="bsr-anno-sep" />{/if}
      <div class="bsr-anno-block">
        <button
          type="button"
          class="bsr-anno-edit"
          aria-label="Open annotation in editor"
          onclick={() => openNote(block.file)}
        >✎</button>
        <div class="bsr-anno-body" use:markdown={{ text: block.body, path: block.file }}></div>
      </div>
    {/each}
  {/if}
  {#if details.crossReferences.length > 0}
    <div class="bsr-group-label">Cross-references</div>
    {#each details.crossReferences as entry (entry.id)}
      <div class="bsr-xref-block">
        {#if editingXrefDescription === entry.id}
          <input
            class="bsr-xref-description-input"
            type="text"
            placeholder="Why do these belong together? (optional)"
            bind:value={xrefDescriptionDraft}
            onkeydown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitXrefDescription(entry.id)
              } else if (event.key === 'Escape') {
                cancelEditingXrefDescription()
              }
            }}
            onblur={() => commitXrefDescription(entry.id)}
          />
        {:else}
          <button
            type="button"
            class="bsr-xref-description"
            onclick={() => startEditingXrefDescription(entry)}
          >{entry.description ?? 'Add a description…'}</button>
        {/if}
        <div class="bsr-xref-members">
          {#each entry.members as member (member.index)}
            <span class="bsr-xref-member-chip">
              <button
                type="button"
                class="bsr-xref-member"
                onclick={() => openReference(member.reference)}
              >{member.label}</button>
              <button
                type="button"
                class="bsr-xref-member-remove"
                aria-label="Remove {member.label} from this cross-reference"
                onclick={() => removeXrefMember(entry.id, member.index)}
              >✕</button>
            </span>
          {/each}
        </div>
        {#if entry.error !== null}
          <div class="bsr-xref-error">{entry.error}</div>
        {/if}
        {#if entry.confirmingDelete}
          <div class="bsr-xref-confirm-delete">
            <span>Delete this cross-reference?</span>
            <button
              type="button"
              class="bsr-xref-confirm-action"
              onclick={() => void model.deleteCrossReference(entry.id)}
            >Delete</button>
            <button
              type="button"
              class="bsr-xref-confirm-action"
              onclick={() => model.cancelDeleteCrossReference(entry.id)}
            >Cancel</button>
          </div>
        {:else}
          <button
            type="button"
            class="bsr-xref-action"
            disabled={view.collection !== null}
            onclick={() => startEditingCrossReference(entry)}
          >Add members</button>
          <button
            type="button"
            class="bsr-xref-action"
            onclick={() => model.confirmDeleteCrossReference(entry.id)}
          >Delete cross-reference</button>
        {/if}
      </div>
    {/each}
  {/if}
  <div class="bsr-group-label">Mentions</div>
  {#if details.mentions.length === 0}
    <div class="bsr-details-empty">No intersecting notes.</div>
  {:else}
    <ul class="bsr-mention-list">
      {#each details.mentions as note (note.file)}
        <li class="bsr-mention-item">
          <button
            type="button"
            class="bsr-mention-link"
            onclick={() => openNote(note.file)}
          >{note.file}</button>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#snippet strongsBlock(details: VerseDetailsView)}
  {#if details.strongs.length > 0}
    <div class="bsr-group-label">Strong's</div>
    {#each details.strongs as entry (entry.strongs)}
      <div class="bsr-strongs-entry">
        <div class="bsr-strongs-head">
          <span class="bsr-strongs-number">{entry.strongs}</span>
          <span class="bsr-strongs-lemma">{entry.lemma}</span>
          <span class="bsr-strongs-translit">{entry.transliteration}</span>
        </div>
        <div class="bsr-strongs-gloss">{entry.gloss}</div>
        <div class="bsr-strongs-definition">{entry.definition}</div>
      </div>
    {/each}
    {#if details.strongsAttribution !== null}
      <div class="bsr-strongs-attribution">{details.strongsAttribution}</div>
    {/if}
  {/if}
{/snippet}

{#snippet formattedText(segment: VerseSegment)}{#if segment.redLetter || segment.supplied || segment.psalmHeading}<span
      class:scripture-study-red-letter={segment.redLetter}
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-psalm-heading={segment.psalmHeading}
    >{segment.text}</span>{:else}{segment.text}{/if}{/snippet}

{#snippet detailsBlock(details: VerseDetailsView | null)}
  {#if details === null}
    <div class="bsr-details-empty">Loading…</div>
  {:else}
    <div class="bsr-details-title">{details.title}</div>
    {@render strongsBlock(details)}
    {@render translationsTable(details)}
    {@render notesBlock(details)}
  {/if}
{/snippet}

{#snippet translationsTable(details: VerseDetailsView)}
  <table class="bsr-trans-table">
    <tbody>
      {#each details.translations as row (row.id)}
        <tr>
          <td class="bsr-trans-id" title={row.name}>{row.label}</td>
          <td class="bsr-trans-text">
            {#if row.segments === null}
              <span class="bsr-unavailable">Unavailable</span>
            {:else}
              {#each row.segments as segment, index (index)}{@render formattedText(segment)}{/each}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

{#snippet segmentText(row: VerseRowView, segment: VerseSegment)}{#if view.strongsMode && segment.strongs !== undefined}<span
      role="button"
      tabindex="0"
      class="bsr-strongs-word"
      class:scripture-study-red-letter={segment.redLetter}
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-psalm-heading={segment.psalmHeading}
      onclick={(event) => onWordClick(event, row.verseId, segment.strongs ?? [])}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onWordClick(event, row.verseId, segment.strongs ?? [])
        }
      }}
    >{segment.text}</span>{:else}{@render formattedText(segment)}{/if}{/snippet}

{#snippet verseText(row: VerseRowView)}
  {@const lineStructured = view.toggles.layout === 'verse-per-line' || row.poetry}
  {#each row.segments as segment, index (index)}
    {#if segment.lineBreakBefore && lineStructured}<br />{/if}
    {#if lineStructured && segment.lineStart && segment.indent !== undefined}<span
        class="scripture-study-indent-{segment.indent}"
      >{@render segmentText(row, segment)}</span>{:else}{@render segmentText(row, segment)}{/if}
  {/each}
  {#if verseMarks(row).anno}<span class="bsr-mark-anno" title="Annotation">●</span>{/if}
  {#if verseMarks(row).mentions > 0}
    <span class="bsr-mark-inter" title="{verseMarks(row).mentions} intersecting notes">◆{verseMarks(row).mentions > 1 ? verseMarks(row).mentions : ''}</span>
  {/if}
{/snippet}

<div class="bsr-shell">
  {#if view.banner !== null}
    <div class="bsr-banner">
      <span>{view.banner}</span>
      <button type="button" class="bsr-banner-dismiss" aria-label="Dismiss" onclick={() => model.dismissBanner()}>✕</button>
    </div>
  {/if}

  <div class="bsr-toolbar">
    <OptionsMenu
      toggles={view.toggles}
      strongsAvailable={view.strongsAvailable}
      fontScalePercent={view.fontScalePercent}
      onSetToggle={setToggle}
      onIncreaseFontScale={() => model.increaseFontScale()}
      onDecreaseFontScale={() => model.decreaseFontScale()}
      onResetFontScale={() => model.resetFontScale()}
    />
    <button
      type="button"
      class="bsr-collect-start"
      title="Collect a cross-reference"
      disabled={view.collection !== null}
      onclick={startCollecting}
    >Cross-reference</button>
    <span class="bsr-trans" bind:this={pillSlotEl}>
      <span class="bsr-trans-measure" aria-hidden="true" bind:this={pillMeasureEl}>
        {#each view.translations as pill (pill.id)}
          <button type="button" class="bsr-pill" tabindex="-1">{pill.label}</button>
        {/each}
      </span>
      {#if pillsCollapsed}
        <TranslationMenu
          options={view.translations}
          onPick={(id) => void model.setTranslation(id)}
        />
      {:else}
        {#each view.translations as pill (pill.id)}
          <button
            type="button"
            class="bsr-pill"
            class:bsr-on={pill.active}
            title={pill.name}
            onclick={() => void model.setTranslation(pill.id)}
          >{pill.label}</button>
        {/each}
      {/if}
    </span>
  </div>

  {#if view.collection !== null}
    {@const collection = view.collection}
    <div class="bsr-basket">
      <span class="bsr-group-label">Cross-reference</span>
      {#if collection.stage === 'gathering'}
        {#each collection.members as member, index (index)}
          <span class="bsr-chip">
            {member.label}
            <button
              type="button"
              class="bsr-chip-remove"
              aria-label="Remove {member.label}"
              onclick={() => model.removeCollectionMember(index)}
            >✕</button>
          </span>
        {/each}
        <button
          type="button"
          class="bsr-basket-action"
          disabled={!collection.canAddSelection}
          onclick={() => model.addSelectionToCollection()}
        >Add selection</button>
        <input
          class="bsr-basket-input"
          type="text"
          placeholder="Type a reference"
          bind:value={typedMember}
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTypedMember()
            }
          }}
        />
        <button type="button" class="bsr-basket-action" onclick={addTypedMember}>Add</button>
        <span class="bsr-spacer"></span>
        <button
          type="button"
          class="bsr-basket-action mod-cta"
          disabled={!collection.canCreate}
          onclick={() => model.beginDescribingCollection()}
        >Create</button>
        <button
          type="button"
          class="bsr-basket-action"
          onclick={() => model.cancelCollecting()}
        >Cancel</button>
        {#if collection.error !== null}
          <div class="bsr-basket-error">{collection.error}</div>
        {/if}
      {:else}
        <input
          class="bsr-basket-input bsr-basket-description"
          type="text"
          placeholder="Why do these belong together? (optional)"
          value={collection.description}
          oninput={(event) => model.describeCollection(event.currentTarget.value)}
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              createCrossReference()
            }
          }}
        />
        <button
          type="button"
          class="bsr-basket-action mod-cta"
          onclick={createCrossReference}
        >Save</button>
        {#if !collection.editing}
          <button
            type="button"
            class="bsr-basket-action"
            onclick={createWithoutDescription}
          >Skip</button>
        {/if}
        <button
          type="button"
          class="bsr-basket-action"
          onclick={() => model.cancelDescribingCollection()}
        >Back</button>
      {/if}
    </div>
  {/if}

  {#if view.toggles.nav === 'breadcrumb'}
    <div class="bsr-crumb">
      <select class="dropdown" value={String(view.position.book)} onchange={onBookPicked}>
        {#each books as book (book)}
          <option value={String(book)}>{bookName(book)}</option>
        {/each}
      </select>
      <span class="bsr-crumb-sep">›</span>
      <select class="dropdown" value={String(view.position.chapter)} onchange={onChapterPicked}>
        {#each chaptersOf(view.position.book) as chapter (chapter)}
          <option value={String(chapter)}>{chapter}</option>
        {/each}
      </select>
      <span class="bsr-spacer"></span>
      <button type="button" class="bsr-step" disabled={!view.hasPreviousChapter} onclick={() => void model.previousChapter()}>‹ Previous</button>
      <button type="button" class="bsr-step" disabled={!view.hasNextChapter} onclick={() => void model.nextChapter()}>Next ›</button>
    </div>
  {/if}

  <div class="bsr-main">
    {#if view.toggles.nav === 'tree'}
      <div class="bsr-tree">
        {#each books as book (book)}
          {#if book === 1}<div class="bsr-tree-group">Old Testament</div>{/if}
          {#if book === 40}<div class="bsr-tree-group">New Testament</div>{/if}
          <button
            type="button"
            class="bsr-tree-book"
            class:bsr-on={book === view.position.book}
            onclick={() => (openBook = openBook === book ? null : book)}
          >{treeBook === book ? '▾' : '▸'} {bookName(book)}</button>
          {#if treeBook === book}
            <div class="bsr-tree-chapters">
              {#each chaptersOf(book) as chapter (chapter)}
                <button
                  type="button"
                  class="bsr-tree-chapter"
                  class:bsr-on={book === view.position.book && chapter === view.position.chapter}
                  onclick={() => void model.goTo(book, chapter)}
                >{chapter}</button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="bsr-content">
      <div class="bsr-scroll" style:font-size={contentFontSize}>
        <div class="bsr-inner">
          <div class="bsr-title-row">
            <h1 class="bsr-title">{view.title}</h1>
            <span class="bsr-title-nav">
              <button
                type="button"
                class="bsr-chapter-step"
                aria-label="Previous chapter"
                disabled={!view.hasPreviousChapter}
                onclick={() => void model.previousChapter()}
              >‹</button>
              <button
                type="button"
                class="bsr-chapter-step"
                aria-label="Next chapter"
                disabled={!view.hasNextChapter}
                onclick={() => void model.nextChapter()}
              >›</button>
            </span>
          </div>

          {#if view.status === 'loading'}
            <div class="scripture-study-loading">Loading {view.title}…</div>
          {:else if view.status === 'no-translation'}
            <div class="bsr-nudge">
              No translation installed — install one in the Scripture Study settings to start reading.
            </div>
            {#if view.installNudge}
              <button
                type="button"
                class="bsr-install-cta mod-cta"
                disabled={view.installNudge.busy}
                onclick={() => void model.installSuggestedTranslation()}
              >
                {view.installNudge.busy
                  ? `Installing ${view.installNudge.translationName}…`
                  : `Install ${view.installNudge.translationName}`}
              </button>
              {#if view.installNudge.error !== null}
                <div class="bsr-install-error">
                  Install failed: {view.installNudge.error}
                </div>
              {/if}
            {/if}
          {:else if view.status === 'unavailable'}
            <div class="bsr-nudge">{view.title} is unavailable in this translation.</div>
          {:else if view.toggles.layout === 'verse-per-line'}
            {#each view.rows as row (row.verseId)}
              <div
                class="bsr-verse-line"
                class:bsr-hl={row.highlighted}
                class:bsr-sel={verseSelected(row.verseId)}
                role="button"
                tabindex="0"
                onclick={(event) => onVerseClick(event, row.verseId)}
                onkeydown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void model.selectVerse(row.verseId)
                  }
                }}
              >
                <span class="bsr-verse-num">{row.label}</span>
                {@render verseText(row)}
              </div>
              {#if view.toggles.details === 'inline' && row.expanded}
                <div class="bsr-expand">{@render detailsBlock(detailsFor(row))}</div>
              {/if}
            {/each}
          {:else}
            {#each paragraphsOf(view.rows) as paragraph (paragraph[0].verseId)}
              <p class="bsr-prose">
                {#each paragraph as row (row.verseId)}
                  <span
                    class="bsr-verse-span"
                    class:bsr-hl={row.highlighted}
                    class:bsr-sel={verseSelected(row.verseId)}
                    role="button"
                    tabindex="0"
                    onclick={(event) => onVerseClick(event, row.verseId)}
                    onkeydown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void model.selectVerse(row.verseId)
                      }
                    }}
                  ><sup class="bsr-verse-num">{row.label}</sup>{@render verseText(row)}</span>
                  {' '}
                {/each}
              </p>
            {/each}
            {#if view.toggles.details === 'inline'}
              {#each view.rows.filter((row) => row.expanded) as row (row.verseId)}
                <div class="bsr-expand">{@render detailsBlock(detailsFor(row))}</div>
              {/each}
            {/if}
          {/if}

          {#if view.status === 'ok'}
            <div class="bsr-foot-nav">
              <button type="button" class="bsr-step" disabled={!view.hasPreviousChapter} onclick={() => void model.previousChapter()}>‹ Previous</button>
              <button type="button" class="bsr-step" disabled={!view.hasNextChapter} onclick={() => void model.nextChapter()}>Next ›</button>
            </div>
          {/if}

          {#if view.attribution !== null}
            <div class="scripture-study-attribution">{view.attribution}</div>
          {/if}
        </div>
      </div>
    </div>

    {#if view.toggles.details === 'side-panel'}
      <div class="bsr-side">
        <div class="bsr-side-tabs">
          <button
            type="button"
            class="bsr-side-tab"
            class:bsr-on={sideTab === 'translations'}
            onclick={() => (sideTab = 'translations')}
          >Translations</button>
          <button
            type="button"
            class="bsr-side-tab"
            class:bsr-on={sideTab === 'notes'}
            onclick={() => (sideTab = 'notes')}
          >Notes</button>
        </div>
        <div class="bsr-side-body">
          {#if view.selectedVerseId === null}
            <div class="bsr-details-empty">Select a verse to see details.</div>
          {:else if selectedDetails === null}
            <div class="bsr-details-empty">Loading…</div>
          {:else}
            <div class="bsr-details-title">{selectedDetails.title}</div>
            {@render strongsBlock(selectedDetails)}
            {#if sideTab === 'translations'}
              {@render translationsTable(selectedDetails)}
            {:else}
              {@render notesBlock(selectedDetails)}
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .bsr-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .bsr-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: hsla(var(--interactive-accent-hsl), 0.12);
    border-bottom: 1px solid var(--background-modifier-border);
    color: var(--text-accent);
    font-size: var(--font-ui-small);
  }

  .bsr-banner-dismiss {
    margin-left: auto;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 4px;
    cursor: pointer;
    color: var(--text-muted);
  }

  .bsr-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsr-pill.bsr-on {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    color: var(--text-accent);
  }

  .bsr-pill {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    box-shadow: none;
    padding: 2px 10px;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-pill.bsr-on {
    border-color: var(--text-accent);
  }

  .bsr-spacer {
    flex: 1;
  }

  .bsr-trans {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }

  .bsr-trans-measure {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    display: flex;
    gap: 10px;
    white-space: nowrap;
  }

  .bsr-collect-start {
    background: none;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    box-shadow: none;
    padding: 2px 10px;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-collect-start:hover:not(:disabled) {
    color: var(--text-accent);
    border-color: var(--text-accent);
  }

  .bsr-collect-start:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .bsr-basket {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 12px;
    background: hsla(var(--interactive-accent-hsl), 0.08);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsr-basket .bsr-group-label {
    margin-top: 0;
  }

  .bsr-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    padding: 1px 4px 1px 10px;
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
  }

  .bsr-chip-remove {
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 4px;
    font-size: var(--font-smallest);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-chip-remove:hover {
    color: var(--text-error);
    background: none;
  }

  .bsr-basket-action {
    padding: 2px 10px;
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .bsr-basket-action:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .bsr-basket-input {
    width: 160px;
    font-size: var(--font-ui-smaller);
  }

  .bsr-basket-description {
    flex: 1;
    min-width: 160px;
  }

  .bsr-basket-error {
    flex-basis: 100%;
    color: var(--text-error);
    font-size: var(--font-smallest);
  }

  .bsr-crumb {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsr-crumb-sep {
    color: var(--text-faint);
  }

  .bsr-step {
    background: none;
    border: none;
    box-shadow: none;
    padding: 2px 8px;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-step:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .bsr-main {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .bsr-tree {
    width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--background-modifier-border);
    overflow-y: auto;
    padding: 8px 0 40px;
    font-size: var(--font-ui-small);
  }

  .bsr-tree-group {
    padding: 4px 12px;
    margin-top: 8px;
    color: var(--text-faint);
    font-size: var(--font-smallest);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .bsr-tree-book {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    box-shadow: none;
    padding: 2px 12px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-tree-book:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .bsr-tree-book.bsr-on {
    color: var(--text-accent);
  }

  .bsr-tree-chapters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 12px 8px 20px;
  }

  .bsr-tree-chapter {
    width: 30px;
    height: 26px;
    border: none;
    border-radius: var(--radius-s);
    box-shadow: none;
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .bsr-tree-chapter.bsr-on {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    color: var(--text-accent);
    outline: 1px solid var(--text-accent);
  }

  .bsr-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .bsr-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px 60px;
  }

  .bsr-inner {
    max-width: var(--file-line-width);
    margin: 0 auto;
  }

  .bsr-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
  }

  .bsr-title {
    font-size: var(--h3-size);
    margin: 0;
  }

  .bsr-title-nav {
    display: inline-flex;
    gap: 2px;
  }

  .bsr-chapter-step {
    background: none;
    border: none;
    box-shadow: none;
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    font-size: 1.2em;
    line-height: 1;
    cursor: pointer;
  }

  .bsr-chapter-step:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .bsr-chapter-step:disabled,
  .bsr-step:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .bsr-step:disabled:hover {
    background: none;
  }

  .bsr-foot-nav {
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
  }

  .bsr-verse-line {
    padding: 3px 8px;
    border-radius: var(--radius-s);
    cursor: pointer;
    line-height: 1.65;
  }

  .bsr-verse-line:hover {
    background: var(--background-modifier-hover);
  }

  .bsr-verse-line.bsr-hl {
    background: hsla(var(--interactive-accent-hsl), 0.1);
    box-shadow: inset 3px 0 0 var(--text-accent);
    border-radius: 0 var(--radius-s) var(--radius-s) 0;
  }

  .bsr-verse-line.bsr-sel,
  .bsr-verse-span.bsr-sel {
    background: hsla(var(--interactive-accent-hsl), 0.18);
  }

  .bsr-verse-num {
    color: var(--text-accent);
    font-size: 0.75em;
    font-weight: 600;
    margin-right: 5px;
  }

  .bsr-prose {
    font-size: inherit;
    line-height: 1.85;
  }

  .bsr-verse-span {
    cursor: pointer;
    border-radius: 3px;
    padding: 1px 2px;
  }

  .bsr-verse-span:hover {
    background: var(--background-modifier-hover);
  }

  .bsr-verse-span.bsr-hl {
    background: hsla(var(--interactive-accent-hsl), 0.1);
    box-shadow: -3px 0 0 var(--text-accent);
  }

  .bsr-mark-anno {
    color: var(--color-yellow);
    font-size: 0.7em;
    margin-left: 4px;
    vertical-align: super;
  }

  .bsr-mark-inter {
    color: var(--color-blue);
    font-size: 0.7em;
    margin-left: 3px;
    vertical-align: super;
  }

  .bsr-expand {
    margin: 4px 0 10px 24px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
    padding: 8px 12px;
    font-size: var(--font-ui-small);
  }

  .bsr-details-title {
    font-size: var(--font-smallest);
    color: var(--text-faint);
    margin-bottom: 6px;
  }

  .bsr-details-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  .bsr-trans-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }

  .bsr-trans-table td {
    padding: 4px 8px;
    vertical-align: top;
    border-top: 1px solid var(--background-modifier-border);
  }

  .bsr-trans-table tr:first-child td {
    border-top: none;
  }

  .bsr-trans-id {
    color: var(--text-accent);
    font-weight: 600;
    width: 52px;
  }

  .bsr-unavailable {
    color: var(--text-faint);
    font-style: italic;
  }

  .bsr-mention-list {
    margin: 4px 0;
    padding-left: 1.2em;
    font-size: var(--font-ui-small);
  }

  .bsr-mention-item::marker {
    color: var(--text-faint);
  }

  .bsr-mention-link {
    display: inline;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: inherit;
    text-align: left;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-mention-link:hover {
    color: var(--text-accent);
    background: none;
    box-shadow: none;
  }

  .bsr-xref-block {
    margin: 4px 0;
    font-size: var(--font-ui-small);
  }

  .bsr-xref-description {
    display: block;
    width: 100%;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: inherit;
    text-align: left;
    color: var(--text-muted);
    cursor: text;
  }

  .bsr-xref-description:hover {
    color: var(--text-normal);
    background: none;
    box-shadow: none;
  }

  .bsr-xref-description-input {
    width: 100%;
    font-size: inherit;
    margin: 2px 0;
  }

  .bsr-xref-members {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: 2px;
  }

  .bsr-xref-member-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .bsr-xref-member {
    display: inline;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: inherit;
    text-align: left;
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsr-xref-member:hover {
    text-decoration: underline;
    background: none;
    box-shadow: none;
  }

  .bsr-xref-member-remove {
    padding: 0 2px;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    cursor: pointer;
  }

  .bsr-xref-member-remove:hover {
    color: var(--text-error);
    background: none;
    box-shadow: none;
  }

  .bsr-xref-error {
    margin-top: 2px;
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
  }

  .bsr-xref-action {
    margin-top: 4px;
    padding: 0;
    border: none;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    cursor: pointer;
  }

  .bsr-xref-action:hover {
    color: var(--text-error);
    background: none;
    box-shadow: none;
  }

  .bsr-xref-confirm-delete {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: var(--font-ui-smaller);
    color: var(--text-error);
  }

  .bsr-xref-confirm-action {
    padding: 1px 8px;
    height: auto;
    font-size: var(--font-ui-smaller);
  }

  .bsr-notes-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .bsr-group-label {
    display: block;
    margin-top: 8px;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bsr-notes-head .bsr-group-label {
    margin-top: 0;
  }

  .bsr-annotate {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    border: none;
    border-radius: var(--radius-s);
    box-shadow: none;
    padding: 2px 10px;
    font-size: var(--font-ui-smaller);
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsr-anno-block {
    position: relative;
    margin: 6px 0;
    font-size: var(--font-ui-small);
  }

  .bsr-anno-sep {
    width: 66.7%;
    margin: 8px auto;
    border: none;
    border-top: 1px solid var(--background-modifier-border);
  }

  .bsr-anno-edit {
    position: absolute;
    top: 0;
    right: 0;
    opacity: 0;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 4px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-anno-block:hover .bsr-anno-edit,
  .bsr-anno-edit:focus-visible {
    opacity: 1;
  }

  .bsr-anno-edit:hover {
    color: var(--text-accent);
  }

  .bsr-anno-body {
    max-height: 240px;
    overflow-y: auto;
    user-select: text;
  }

  .bsr-nudge {
    color: var(--text-faint);
    font-style: italic;
    margin: 12px 0;
  }

  .bsr-install-cta {
    margin: 4px 0 12px;
    cursor: pointer;
  }

  .bsr-install-error {
    color: var(--text-error);
    font-size: var(--font-smallest);
    margin-bottom: 12px;
  }

  .bsr-strongs-word {
    cursor: pointer;
  }

  .bsr-strongs-word:hover {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    border-radius: 2px;
  }

  .bsr-strongs-entry {
    border: 1px solid var(--background-modifier-border);
    border-left: 3px solid var(--text-accent);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
    margin: 6px 0;
    padding: 6px 10px;
    font-size: var(--font-ui-small);
  }

  .bsr-strongs-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .bsr-strongs-number {
    color: var(--text-accent);
    font-weight: 600;
    font-size: var(--font-ui-smaller);
  }

  .bsr-strongs-lemma {
    font-size: 1.1em;
  }

  .bsr-strongs-translit {
    color: var(--text-muted);
    font-style: italic;
  }

  .bsr-strongs-gloss {
    font-weight: 600;
    margin-top: 2px;
  }

  .bsr-strongs-definition {
    margin-top: 4px;
    color: var(--text-muted);
    white-space: pre-line;
    max-height: 200px;
    overflow-y: auto;
    user-select: text;
  }

  .bsr-strongs-attribution {
    color: var(--text-faint);
    font-size: var(--font-smallest);
    margin: 4px 0 8px;
  }

  .bsr-side {
    width: 300px;
    flex-shrink: 0;
    border-left: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
  }

  .bsr-side-tabs {
    display: flex;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsr-side-tab {
    flex: 1;
    background: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 8px;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }

  .bsr-side-tab.bsr-on {
    color: var(--text-accent);
    border-bottom-color: var(--text-accent);
  }

  .bsr-side-body {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px 40px;
  }
</style>
