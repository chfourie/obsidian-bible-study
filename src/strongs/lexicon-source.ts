export interface LexiconSource {
  fetchHebrew(): Promise<string>
  fetchGreek(): Promise<string>
}
