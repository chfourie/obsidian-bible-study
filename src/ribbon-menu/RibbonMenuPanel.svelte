<!--
The menu behind the plugin's single ribbon icon. The feature drives it
imperatively: the ribbon click passes its element to anchor against; the
command passes no anchor and the panel centres (mobile).
-->
<script lang="ts">
  import { MenuPanel, type MenuSection } from '../ui'

  let {
    getSections,
    registerApi,
  }: {
    getSections: () => Promise<MenuSection[]>
    registerApi: (api: {
      toggle: (anchor?: HTMLElement | null) => void
      close: () => void
    }) => void
  } = $props()

  let open = $state(false)
  let sections = $state.raw<MenuSection[]>([])
  let anchorEl = $state.raw<HTMLElement | null>(null)
  // Sections arrive asynchronously, so a close or a second toggle in the
  // meantime must win over the open the in-flight build would have done.
  let openToken = 0

  // Registering through an effect avoids capturing the prop non-reactively
  // and runs well before any user click.
  $effect(() => {
    registerApi({ toggle, close: closePanel })
  })

  function toggle(anchor?: HTMLElement | null) {
    if (open) {
      closePanel()
      return
    }
    anchorEl = anchor ?? null
    const token = ++openToken
    void getSections().then((built) => {
      if (token !== openToken) return
      sections = built
      open = true
    })
  }

  function closePanel() {
    openToken += 1
    open = false
  }
</script>

{#if open}
  <MenuPanel
    {sections}
    anchor={anchorEl}
    placement="right"
    onClose={closePanel}
  />
{/if}
