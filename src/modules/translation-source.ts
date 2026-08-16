import type { NormalizedModule } from './normalized-module'

export type TextTransport = (url: string) => Promise<string>

export interface TranslationSource {
  fetchModule(moduleId: string): Promise<NormalizedModule>
}
