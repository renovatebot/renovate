import { escapeRegExp, regEx } from '../../../util/regex';

// Extract Ruby string value (handles both quote styles)
export function extractRubyString(
  content: string,
  keyword: string,
): string | null {
  const regex = regEx(
    new RegExp(`\\b${keyword}\\s+(?:"(?<double>[^"]+)"|'(?<single>[^']+)')`),
  );
  const match = content.match(regex);
  return match?.groups?.double ?? match?.groups?.single ?? null;
}

// Update Ruby string value (preserves quote style)
export function updateRubyString(
  content: string,
  keyword: string,
  oldValue: string,
  newValue: string,
): string | null {
  const doubleQuote = new RegExp(
    `(\\b${keyword}\\s+)"${escapeRegExp(oldValue)}"`,
    'g',
  );
  const singleQuote = new RegExp(
    `(\\b${keyword}\\s+)'${escapeRegExp(oldValue)}'`,
    'g',
  );
  const result = content
    .replace(doubleQuote, `$1"${newValue}"`)
    .replace(singleQuote, `$1'${newValue}'`);

  return result === content ? null : result;
}
