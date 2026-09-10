<!--
The cross-references touching whatever the section covers — a verse or the
chapter on screen — with the action that starts collecting a new one. Each row
opens its members, loads itself into the collect strip for editing, or opens
the note behind it.
-->
<script lang="ts">
  import type { CrossReference, StudyMaterialSource } from '../contracts'
  import type { CrossReferenceView } from '../cross-references'
  import { opensInNewPane } from '../ui'
  import CrossReferenceRow from './CrossReferenceRow.svelte'
  import SectionHeading from './SectionHeading.svelte'
  import type { StudyMaterialHost } from './study-material-host'

  let {
    entries,
    source,
    host,
    collecting,
  }: {
    entries: CrossReferenceView[]
    source: StudyMaterialSource
    host: StudyMaterialHost
    // While a cross-reference is being collected the strip owns the editing
    // seat, so the row actions stand down until it is done.
    collecting: boolean
  } = $props()

  const edit = (entry: CrossReferenceView, event: MouseEvent): void => {
    const edited: CrossReference = {
      path: entry.path,
      members: entry.members.map((member) => member.reference),
      summary: entry.summary,
    }
    if (opensInNewPane(event)) host.editCrossReferenceInNewPane(edited)
    else source.startEditingCrossReference(edited)
  }
</script>

<SectionHeading
  label="Cross-references"
  action="Collect a cross-reference"
  onAdd={() => source.startCollecting()}
  disabled={collecting}
/>
{#each entries as entry, index (entry.path)}
  <CrossReferenceRow
    {entry}
    divided={index > 0}
    editable={!collecting}
    {edit}
    openNote={host.openNote}
    openReference={host.openReference}
  />
{/each}
