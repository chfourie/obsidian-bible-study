// Where the LSJ Lexicon module downloads from. STEPBible splits TFLSJ across
// the Strong's range and an extra file of numbers Strong never gave, so the
// source answers with as many parts as the lexicon is published in.
export interface LsjSource {
  fetchLsj(): Promise<string[]>
}
