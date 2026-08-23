import type { StrongsEntryView, WordCloudWordView } from "../contracts";
import { strongsFamily } from "../modules";

// The families whose repetition carries no significance: the Greek article,
// the Hebrew article prefix, "to be", "and", the Hebrew object marker, and
// the Hebrew relative "which" and conjunction "for". Deliberately nothing
// more — prepositions, quantifiers, negations and pronouns all stay, since
// their repetition can matter (CONTEXT.md — Cloud Exclusions).
export const CLOUD_EXCLUSIONS: ReadonlySet<string> = new Set([
  "G3588",
  "H9009",
  "H1961",
  "G1510",
  "G1096",
  "H9002",
  "G2532",
  "H0853",
  "H0834",
  "H3588",
]);

const FAMILY_DIGITS = 4;

// Tagged texts pad a number to four digits ('H0834') while a hand-typed or
// older form may not ('H834'): exclusions compare on the padded family.
export const paddedFamily = (strongsNumber: string): string => {
  const family = strongsFamily(strongsNumber);
  return family[0] + family.slice(1).padStart(FAMILY_DIGITS, "0");
};

// The built-in exclusions and the user's own, ready to match against.
export const cloudExclusions = (
  userFamilies: readonly string[],
): ReadonlySet<string> =>
  new Set([...CLOUD_EXCLUSIONS, ...userFamilies].map(paddedFamily));

export const WORD_CLOUD_SIZE = 10;

export const CLOUD_FONT_EM = { min: 0.9, max: 2 };

export type CloudSegment = { text: string; strongs?: string[] };

export type CloudVerse = { segments: readonly CloudSegment[] };

// A family with its count and the Rendering the chapter gives it most often
// — empty when no occurrence rendered as a word.
export type CloudFamily = { family: string; count: number; rendering: string };

export type CloudEntry = Pick<
  StrongsEntryView,
  "family" | "gloss" | "transliteration" | "lemma"
>;

type TaggedWord = { strongs: string[]; text: string };

// One tagged word per tag span: the span channels split a tagged word into
// several segments that all carry the same tag array, so a change of array
// is what marks the next word and the text in between is the word's.
const taggedWords = (verse: CloudVerse): TaggedWord[] => {
  const words: TaggedWord[] = [];
  let previous: string[] | undefined;
  for (const segment of verse.segments) {
    if (segment.strongs === undefined) {
      previous = undefined;
      continue;
    }
    if (segment.strongs === previous)
      words[words.length - 1].text += segment.text;
    else words.push({ strongs: segment.strongs, text: segment.text });
    previous = segment.strongs;
  }
  return words;
};

const EDGE_PUNCTUATION = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;

// The English a tag span drags in around the word it renders: articles,
// pronouns, auxiliaries, prepositions and conjunctions. A rendering made of
// nothing else keeps them all.
const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "i",
  "me",
  "my",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "it",
  "its",
  "we",
  "us",
  "our",
  "they",
  "them",
  "their",
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "will",
  "shall",
  "would",
  "should",
  "may",
  "might",
  "must",
  "can",
  "could",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "from",
  "by",
  "with",
  "into",
  "unto",
  "and",
  "but",
  "or",
  "so",
  "that",
  "when",
  "then",
  "order",
]);

const isFunctionWord = (token: string): boolean =>
  FUNCTION_WORDS.has(token.toLowerCase());

const contentWords = (tokens: string[]): string[] => {
  let start = 0;
  let end = tokens.length;
  while (start < end && isFunctionWord(tokens[start])) start++;
  while (end > start && isFunctionWord(tokens[end - 1])) end--;
  return start === end ? tokens : tokens.slice(start, end);
};

const renderingOf = (word: TaggedWord): string => {
  const tokens = word.text.replace(EDGE_PUNCTUATION, "").split(/\s+/);
  return contentWords(tokens).join(" ");
};

// Renderings tally case-insensitively so "LORD" and "Lord" pull together,
// and the winner shows as it was first written.
class RenderingTally {
  readonly #forms = new Map<string, { display: string; count: number }>();

  add(rendering: string): void {
    if (rendering === "") return;
    const key = rendering.toLowerCase();
    const form = this.#forms.get(key);
    if (form === undefined)
      this.#forms.set(key, { display: rendering, count: 1 });
    else form.count += 1;
  }

  // Insertion order breaks ties toward the earlier-appearing form.
  get mostFrequent(): string {
    let best = { display: "", count: 0 };
    for (const form of this.#forms.values())
      if (form.count > best.count) best = form;
    return best.display;
  }
}

// The families the cloud shows: the ten most tagged, most frequent first,
// ties going to the earlier-appearing.
export const cloudFamilies = (
  verses: readonly CloudVerse[],
  exclusions: ReadonlySet<string> = CLOUD_EXCLUSIONS,
): CloudFamily[] => {
  const tallies = new Map<
    string,
    { count: number; renderings: RenderingTally }
  >();
  for (const verse of verses) {
    for (const word of taggedWords(verse)) {
      const rendering = renderingOf(word);
      for (const number of word.strongs) {
        const family = strongsFamily(number);
        if (exclusions.has(paddedFamily(family))) continue;
        const tally = tallies.get(family) ?? {
          count: 0,
          renderings: new RenderingTally(),
        };
        tally.count += 1;
        tally.renderings.add(rendering);
        tallies.set(family, tally);
      }
    }
  }
  const byAppearance = [...tallies].map(([family, tally], appearance) => ({
    family,
    count: tally.count,
    rendering: tally.renderings.mostFrequent,
    appearance,
  }));
  return [...byAppearance]
    .sort((a, b) => b.count - a.count || a.appearance - b.appearance)
    .slice(0, WORD_CLOUD_SIZE)
    .map(({ family, count, rendering }) => ({ family, count, rendering }));
};

// A family the dictionaries know nothing of still shows, under its number.
export const chapterWordCloud = (
  families: readonly CloudFamily[],
  entries: readonly CloudEntry[],
): WordCloudWordView[] => {
  const sizeEm = cloudSizer(families.map(({ count }) => count));
  return families.map(({ family, count, rendering }) => {
    const entry = entries.find((candidate) => candidate.family === family);
    return {
      family,
      rendering,
      gloss: entry?.gloss ?? family,
      transliteration: entry?.transliteration ?? "",
      lemma: entry?.lemma ?? "",
      count,
      sizeEm: sizeEm(count),
      active: false,
    };
  });
};

// Linear from the smallest count to the largest; a cloud of equal counts
// sits midway rather than shouting or whispering.
const cloudSizer = (counts: readonly number[]): ((count: number) => number) => {
  const smallest = Math.min(...counts);
  const largest = Math.max(...counts);
  const { min, max } = CLOUD_FONT_EM;
  if (largest === smallest) return () => (min + max) / 2;
  return (count) =>
    min + ((count - smallest) / (largest - smallest)) * (max - min);
};
