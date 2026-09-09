// What the two lifts that shorten an atom's source share: the ledger of
// stretches taken out (an Editorial-mark wrapper, a `[Footnote…]` marker),
// so an offset written against the source lands on the stored string; and
// the failure that cites the atom — `1:4` for a verse, `1.3` or `1.e1` for a
// paragraph Book's atom or epigraph.

export type TextRemoval = { at: number; length: number }

export const removalsOffsetOf =
  (removals: readonly TextRemoval[]) =>
  (at: number): number =>
    at -
    removals
      .filter((removal) => removal.at < at)
      .reduce((removed, removal) => removed + removal.length, 0)

export const citing = <Result>(locator: string, lift: () => Result): Result => {
  try {
    return lift()
  } catch (error) {
    throw new Error(`atom ${locator}: ${(error as Error).message}`)
  }
}
