export type VerseLocation = {
  book: number
  chapter: number
  verse: number
}

export const makeVerseId = (
  book: number,
  chapter: number,
  verse: number,
): number => book * 1_000_000 + chapter * 1_000 + verse

export const decodeVerseId = (verseId: number): VerseLocation => ({
  book: Math.floor(verseId / 1_000_000),
  chapter: Math.floor(verseId / 1_000) % 1_000,
  verse: verseId % 1_000,
})
