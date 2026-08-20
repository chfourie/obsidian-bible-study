<!--
The Word Study Panel: one main-area tab dedicated to a single extended
Strong's number. It leads with the number, lemma, transliteration and the rest
of its Strong's Family, then the brief lexicon entry and the Strong's 1890
etymology, and closes with the family's concordance in one Tagged Translation:
how that translation renders the family, as chips the list filters by, and
every verse it is tagged in, grouped by book and collapsed until asked for.
Where more than one Tagged Translation is installed the concordance can be
switched between them, and where none can be read it says so in their place.
Every number on the page is walkable — plain activation retargets this panel,
a modified one spawns another — and every occurrence row walks to its chapter
in the reader.
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import { activate, opensInNewPane } from '../ui'
  import type { WordStudyModel } from './word-study-model'

  function icon(node: HTMLElement, name: string) {
    setIcon(node, name)
    return {
      update(next: string) {
        node.empty()
        setIcon(node, next)
      },
    }
  }

  let { model }: { model: WordStudyModel } = $props()

  const walk = (strongsNumber: string, event: MouseEvent | KeyboardEvent): void =>
    void model.open(strongsNumber, { newPane: opensInNewPane(event) })

  const openOccurrence = (
    verseId: number,
    event: MouseEvent | KeyboardEvent,
  ): void => model.openOccurrence(verseId, { newPane: opensInNewPane(event) })

  // Initial snapshot only — the model subscription below keeps it fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  $effect(() =>
    model.subscribe(() => {
      view = model.view
    }),
  )
</script>

<div class="bsw-panel">
  {#if view.status === 'empty'}
    <div class="bsw-empty">
      Open a Strong's entry from the Study Panel to study its word.
    </div>
  {:else if view.status === 'loading'}
    <div class="bsw-empty">Loading…</div>
  {:else if view.install !== null}
    <div class="bsw-empty">
      Word studies read the Strong's Dictionaries, which are not installed.
    </div>
    <button
      type="button"
      class="bsw-install mod-cta"
      disabled={view.install.busy}
      onclick={() => void model.installDictionary()}
    >
      {view.install.busy
        ? "Installing Strong's Dictionaries…"
        : "Install Strong's Dictionaries"}
    </button>
    {#if view.install.error !== null}
      <div class="bsw-install-error">Install failed: {view.install.error}</div>
    {/if}
  {:else if view.entry === null}
    <div class="bsw-head">
      <span class="bsw-number">{view.number}</span>
    </div>
    <div class="bsw-empty">
      The Strong's Dictionaries carry no entry for {view.number}.
    </div>
  {:else}
    <div class="bsw-head">
      <span class="bsw-number">{view.entry.extendedNumber}</span>
      <span class="bsw-lemma">{view.entry.lemma}</span>
      <span class="bsw-translit">{view.entry.transliteration}</span>
    </div>
    {#if view.siblings.length > 0}
      <div class="bsw-siblings">
        <span class="bsw-siblings-label">Also in {view.entry.strongs}:</span>
        {#each view.siblings as sibling (sibling)}
          <span
            role="button"
            tabindex="0"
            class="bsw-link"
            title="Open word study"
            onclick={(event) => walk(sibling, event)}
            onkeydown={activate((event) => walk(sibling, event))}>{sibling}</span
          >
        {/each}
      </div>
    {/if}
    <div class="bsw-gloss">{view.entry.gloss}</div>
    {#if view.entry.morphology !== ''}
      <div class="bsw-morphology">{view.entry.morphology}</div>
    {/if}
    <div class="bsw-definition">{view.entry.definition}</div>
    {#if view.etymology !== null}
      <div class="bsw-section-heading">Etymology</div>
      <div class="bsw-etymology">
        {#each view.etymology as segment, index (index)}
          {#if segment.number === null}{segment.text}{:else}<span
              role="button"
              tabindex="0"
              class="bsw-link"
              title="Open word study"
              onclick={(event) => walk(segment.number ?? '', event)}
              onkeydown={activate((event) => walk(segment.number ?? '', event))}
              >{segment.text}</span
            >{/if}
        {/each}
      </div>
    {/if}
    {#if view.attribution !== null}
      <div class="bsw-attribution">{view.attribution}</div>
    {/if}
    {#if view.etymologyAttribution !== null}
      <div class="bsw-attribution">{view.etymologyAttribution}</div>
    {/if}
  {/if}
  {#if view.lsj !== null}
    {@const lsj = view.lsj}
    <section class="bsw-lsj">
      <span
        role="button"
        tabindex="0"
        class="bsw-lsj-head"
        aria-expanded={lsj.expanded}
        onclick={() => model.toggleLsj()}
        onkeydown={activate(() => model.toggleLsj())}
      >
        <span
          class="bsw-book-fold-icon"
          aria-hidden="true"
          use:icon={lsj.expanded ? 'chevron-down' : 'chevron-right'}
        ></span>
        <span class="bsw-section-heading">Full LSJ entry</span>
      </span>
      {#if lsj.expanded}
        {#if lsj.status === 'loading'}
          <div class="bsw-empty">Loading…</div>
        {:else if lsj.install !== null}
          <div class="bsw-empty">
            The full Liddell-Scott-Jones entries are an optional module, which
            is not installed.
          </div>
          <button
            type="button"
            class="bsw-install mod-cta"
            disabled={lsj.install.busy}
            onclick={() => void model.installLsj()}
          >
            {lsj.install.busy
              ? 'Installing LSJ Lexicon…'
              : 'Install LSJ Lexicon'}
          </button>
          {#if lsj.install.error !== null}
            <div class="bsw-install-error">
              Install failed: {lsj.install.error}
            </div>
          {/if}
        {:else if lsj.entry === null}
          <div class="bsw-empty">
            The LSJ Lexicon carries no entry for {view.number}.
          </div>
        {:else}
          <div class="bsw-lsj-entry">{lsj.entry}</div>
          {#if lsj.attribution !== null}
            <div class="bsw-attribution">{lsj.attribution}</div>
          {/if}
        {/if}
      {/if}
    </section>
  {/if}
  {#if view.concordance !== null}
    {@const concordance = view.concordance}
    <div class="bsw-concordance-head">
      <span class="bsw-section-heading">{concordance.label}</span>
      {#if concordance.switchable}
        <select
          class="dropdown bsw-translation"
          aria-label="Read the concordance in"
          value={concordance.translation?.id ?? ''}
          onchange={(event) =>
            void model.useTranslation(event.currentTarget.value)}
        >
          {#if concordance.translation === null}
            <option value="" disabled>Choose a translation</option>
          {/if}
          {#each concordance.translations as translation (translation.id)}
            <option value={translation.id}>{translation.name}</option>
          {/each}
        </select>
      {/if}
    </div>
    {#if concordance.message !== null}
      <div class="bsw-empty">{concordance.message}</div>
    {/if}
    {#if concordance.familyUndifferentiated}
      <div class="bsw-family-note">
        These occurrences cover the whole {concordance.family} family — a
        tagged translation does not tell its entries apart.
      </div>
    {/if}
    {#if concordance.renderings.length > 0}
      <div class="bsw-renderings">
        {#each concordance.renderings as rendering (rendering.text)}
          <span
            role="button"
            tabindex="0"
            class="bsw-chip"
            class:bsw-chip-active={rendering.active}
            aria-pressed={rendering.active}
            title="Show only this rendering"
            onclick={() => model.toggleRendering(rendering.text)}
            onkeydown={activate(() => model.toggleRendering(rendering.text))}
          >
            <span class="bsw-chip-text">{rendering.text}</span>
            <span class="bsw-chip-count">{rendering.count}</span>
          </span>
        {/each}
      </div>
    {/if}
    {#each concordance.books as book (book.book)}
      <section class="bsw-book">
        <span
          role="button"
          tabindex="0"
          class="bsw-book-head"
          aria-expanded={book.expanded}
          onclick={() => void model.toggleConcordanceBook(book.book)}
          onkeydown={activate(() => void model.toggleConcordanceBook(book.book))}
        >
          <span
            class="bsw-book-fold-icon"
            aria-hidden="true"
            use:icon={book.expanded ? 'chevron-down' : 'chevron-right'}
          ></span>
          <span class="bsw-book-name">{book.name}</span>
          <span class="bsw-book-count">{book.count}</span>
        </span>
        {#if book.expanded}
          {#if book.verses === null}
            <div class="bsw-empty">Loading…</div>
          {:else}
            {#each book.verses as verse (verse.verseId)}
              <div
                role="button"
                tabindex="0"
                class="bsw-occurrence"
                title="Open in the reader"
                onclick={(event) => openOccurrence(verse.verseId, event)}
                onkeydown={activate((event) =>
                  openOccurrence(verse.verseId, event))}
              >
                <span class="bsw-occurrence-ref">{verse.reference}</span>
                <span class="bsw-occurrence-text"
                  >{#each verse.segments as segment, index (index)}{#if segment.emphasis}<strong
                        class="bsw-occurrence-word">{segment.text}</strong
                      >{:else}{segment.text}{/if}{/each}</span
                >
              </div>
            {/each}
          {/if}
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .bsw-panel {
    padding: 16px 20px 40px;
    overflow-y: auto;
    height: 100%;
    user-select: text;
  }

  .bsw-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bsw-number {
    color: var(--text-accent);
    font-weight: 600;
    font-size: var(--font-ui-small);
  }

  .bsw-lemma {
    font-size: var(--font-ui-large);
  }

  .bsw-translit {
    color: var(--text-muted);
    font-style: italic;
  }

  .bsw-siblings {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
    font-size: var(--font-ui-small);
  }

  .bsw-siblings-label {
    color: var(--text-faint);
  }

  .bsw-link {
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsw-link:hover {
    text-decoration: underline;
  }

  .bsw-gloss {
    font-weight: 600;
    margin-top: 10px;
  }

  .bsw-morphology {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    margin-top: 2px;
  }

  .bsw-section-heading {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: 600;
    margin-top: 18px;
  }

  .bsw-etymology {
    margin-top: 4px;
    color: var(--text-muted);
    line-height: var(--line-height-normal);
  }

  .bsw-definition {
    margin-top: 10px;
    color: var(--text-muted);
    white-space: pre-line;
    line-height: var(--line-height-normal);
  }

  .bsw-attribution {
    color: var(--text-faint);
    font-size: var(--font-smallest);
    margin-top: 16px;
  }

  .bsw-lsj {
    display: block;
  }

  .bsw-lsj-head {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .bsw-lsj-entry {
    margin-top: 6px;
    color: var(--text-muted);
    white-space: pre-line;
    line-height: var(--line-height-normal);
  }

  .bsw-concordance-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bsw-translation {
    font-size: var(--font-ui-smaller);
    max-width: 60%;
  }

  .bsw-renderings {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .bsw-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    padding: 2px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-l);
    background-color: var(--background-secondary);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
  }

  .bsw-chip:hover {
    background-color: var(--background-modifier-hover);
  }

  .bsw-chip-active {
    background-color: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .bsw-chip-count {
    color: var(--text-faint);
  }

  .bsw-chip-active .bsw-chip-count {
    color: var(--text-on-accent);
    opacity: 0.75;
  }

  .bsw-family-note {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    margin-top: 4px;
  }

  .bsw-book {
    display: block;
    border-top: 1px solid var(--background-modifier-border);
  }

  .bsw-book-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    cursor: pointer;
    font-size: var(--font-ui-small);
  }

  .bsw-book-fold-icon {
    display: flex;
    color: var(--text-faint);
  }

  .bsw-book-name {
    flex: 1;
  }

  .bsw-book-count {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
  }

  .bsw-occurrence {
    padding: 4px 0 6px 22px;
    cursor: pointer;
    line-height: var(--line-height-normal);
  }

  .bsw-occurrence:hover .bsw-occurrence-ref {
    text-decoration: underline;
  }

  .bsw-occurrence-ref {
    color: var(--text-accent);
    font-size: var(--font-ui-smaller);
    margin-right: 6px;
  }

  .bsw-occurrence-text {
    color: var(--text-muted);
  }

  .bsw-occurrence-word {
    color: var(--text-normal);
  }

  .bsw-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  .bsw-install {
    margin-top: 8px;
  }

  .bsw-install-error {
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    margin-top: 6px;
  }
</style>
