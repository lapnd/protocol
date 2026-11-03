const formatThinSpaceThousands = (numStr: string): string => {
  const digitsOnly = numStr.replace(/,/g, "");
  return digitsOnly.length > 4
    ? digitsOnly.replace(/\B(?=(\d{3})+$)/g, "\u00a0")
    : digitsOnly;
};

/**
 * Formats 5+ digit comma-grouped numbers using narrow non-breaking spaces (e.g. 12,500 -> 12 500)
 * for European/Latin locales (es, pt, fr, de, tr, id).
 */
export const formatEuropeanNumbers = (text: string): string =>
  text.replace(/(?<![\d,])\d{1,3}(?:,\d{3})+(?![\d,])/g, formatThinSpaceThousands);

/**
 * Applies French typographic spacing around punctuation marks ([:;?!»%] and «).
 */
export const formatFrenchPunctuation = (text: string): string =>
  text.replace(/ ([:;?!»%])/g, "\u00a0$1").replace(/« /g, "«\u00a0");

const formatIndianGrouping = (numStr: string): string => {
  const digitsOnly = numStr.replace(/,/g, "");
  return digitsOnly.length > 5
    ? digitsOnly.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ",") + "," + digitsOnly.slice(-3)
    : numStr;
};

/**
 * Formats numbers > 5 digits using the Indian lakh/crore grouping system for Hindi.
 */
export const formatIndianNumbers = (text: string): string =>
  text.replace(/(?<![\d,])\d{1,3}(?:,\d{3})+(?![\d,])/g, formatIndianGrouping);

const RTL_CHAR_REGEX = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const LATIN_RUN_REGEX =
  /(?:[A-Za-z0-9.\/\\#@+"'(\[<*]|-(?=[A-Za-z]))[A-Za-z0-9.\/\\#@+\-"'’()\[\]<>*_:=,;&?%!$~{}^|×–− ]*[A-Za-z0-9)\]>%+*"'’~]|[A-Za-z0-9]/g;

const CLOSING_TO_OPENING_BRACKET: Record<string, string> = {
  ")": "(",
  "]": "[",
};

function trimTrailingNonIdentifierChars(run: string): string {
  return run.replace(/[^A-Za-z0-9)\]>%+*"'’~]+$/, "");
}

function balanceBracketsInLatinRun(run: string): string {
  const openStack: number[] = [];
  for (let i = 0; i < run.length; i++) {
    const ch = run[i];
    if (ch === "(" || ch === "[") {
      openStack.push(i);
    } else if (CLOSING_TO_OPENING_BRACKET[ch]) {
      if (!openStack.length || run[openStack.at(-1)!] !== CLOSING_TO_OPENING_BRACKET[ch]) {
        return trimTrailingNonIdentifierChars(run.slice(0, i));
      }
      openStack.pop();
    }
  }
  return trimTrailingNonIdentifierChars(openStack.length ? run.slice(0, openStack[0]) : run);
}

function wrapLatinRunsInFsi(text: string): string {
  const matcher = new RegExp(LATIN_RUN_REGEX.source, "g");
  let output = "";
  let lastIndex = 0;
  for (let match: RegExpExecArray | null; (match = matcher.exec(text)); ) {
    let run = balanceBracketsInLatinRun(match[0]);
    const trailingCommaNumber = /^(.*[A-Za-z)\]]),\s+\d[\d.,]*$/.exec(run);
    if (
      trailingCommaNumber &&
      RTL_CHAR_REGEX.test(text.slice(match.index + run.length).trimStart()[0] ?? "")
    ) {
      run = trailingCommaNumber[1];
    }
    if (!run) {
      matcher.lastIndex = match.index + 1;
      continue;
    }
    output += `${text.slice(lastIndex, match.index)}\u2068${run}\u2069`;
    lastIndex = matcher.lastIndex = match.index + run.length;
  }
  return output + text.slice(lastIndex);
}

/**
 * Isolates embedded Latin/technical runs inside RTL (Arabic/Hebrew) strings using Unicode Bidi isolates.
 */
export const isolateRtlLatinRuns = (text: string): string =>
  RTL_CHAR_REGEX.test(text) ? `\u2067${wrapLatinRunsInFsi(text)}\u2069` : `\u2068${text}\u2069`;
