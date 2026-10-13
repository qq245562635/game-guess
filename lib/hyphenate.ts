const SHY = "­";

// Break points for long words, as [pattern, replacement]. Applied only to words of 11+ letters,
// so short names are never touched. Soft hyphens render as "-" only when the line actually breaks.
const RULES: [RegExp, string][] = [
  [/(tain)(ments?)$/i, `$1${SHY}$2`], // Entertain-ment
  [/(\w{4,})(tions?)$/i, `$1${SHY}$2`], // Produc-tions
  [/^(inter|under|over|counter|super)(\w{4,})$/i, `$1${SHY}$2`], // Inter-active
  [/(\w{4,})(vania)$/i, `$1${SHY}$2`], // Metroid-vania
  [/(\w{5,})(ware|works|soft|studios?)$/i, `$1${SHY}$2`],
];

/** Insert soft hyphens into long words so narrow cells wrap at syllable boundaries in every browser. */
export function softHyphenate(text: string): string {
  return text.replace(/[A-Za-z]{11,}/g, (word) => {
    for (const [re, rep] of RULES) if (re.test(word)) return word.replace(re, rep);
    return word;
  });
}
