const UNICODE_WJ = '\u2060';
const DASH_DASH = '--';
const DASH_WJ_DASH = `-${UNICODE_WJ}-`;
const RE_DASH_DASH = new RegExp(DASH_DASH, 'g');
const RE_DASH_WJ_DASH = new RegExp(DASH_WJ_DASH, 'g');

export const escapeGfmCommentText = (text: string): string => {
  if (text.indexOf(DASH_WJ_DASH) !== -1) {
    // Not even counting rare use of complex Unicode symbols overall, the exact combination of '-' <Unicode WJ> '-' is not making much sense
    throw new Error(
      "Text already contains '-' <Unicode WJ> '-' sequence or is already escaped"
    ); // ... so it's fair to expect to never encounter it in any real text and this error to only be encountered on already escaped text
  }

  if (text.indexOf(DASH_DASH) === -1) {
    // fast path
    return text;
  }

  let previousText;
  let resultText = text;

  do {
    previousText = resultText;
    resultText = previousText.replace(RE_DASH_DASH, DASH_WJ_DASH); // '--' not allowed inside github flavored markdown comments
  } while (resultText !== previousText);

  return resultText;
};

export const unescapeGfmCommentText = (text: string): string => {
  if (text.indexOf(UNICODE_WJ) === -1) {
    // fast path
    return text;
  }

  let previousText;
  let resultText = text;

  do {
    previousText = resultText;
    resultText = previousText.replace(RE_DASH_WJ_DASH, DASH_DASH);
  } while (resultText !== previousText);

  return resultText;
};
