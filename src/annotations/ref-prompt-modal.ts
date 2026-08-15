import { Modal, type App } from 'obsidian'

export class RefPromptModal extends Modal {
  constructor(
    app: App,
    private readonly initialValue: string,
    private readonly submit: (text: string) => boolean,
  ) {
    super(app)
  }

  override onOpen(): void {
    this.titleEl.setText('New annotation')
    const input = this.contentEl.createEl('input', {
      cls: 'bible-study-ref-input',
      attr: { type: 'text', placeholder: 'e.g. John 15:4-6,9' },
    })
    input.value = this.initialValue
    const error = this.contentEl.createDiv({ cls: 'bible-study-ref-error' })
    const trySubmit = (): void => {
      if (this.submit(input.value)) this.close()
      else error.setText(`Not a valid reference: ${input.value}`)
    }
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') trySubmit()
    })
    this.contentEl
      .createEl('button', { text: 'Create', cls: 'mod-cta' })
      .addEventListener('click', trySubmit)
    input.focus()
  }

  override onClose(): void {
    this.contentEl.empty()
  }
}
