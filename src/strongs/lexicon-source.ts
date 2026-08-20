export interface LexiconSource {
  fetchHebrew(): Promise<string>
  fetchGreek(): Promise<string>
  // The Strong's 1890 dictionaries, whose derivations supply the etymology
  // the brief lexicons carry none of.
  fetchHebrewDerivations(): Promise<string>
  fetchGreekDerivations(): Promise<string>
}
