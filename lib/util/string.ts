import { minimatch } from './minimatch';
import { regEx } from './regex';

// Return true if the match string is found at index in content
export function matchAt(
  content: string,
  index: number,
  match: string,
): boolean {
  return content.substring(index, index + match.length) === match;
}

// Replace oldString with newString at location index of content
export function replaceAt(
  content: string,
  index: number,
  oldString: string,
  newString: string,
): string {
  return (
    content.substring(0, index) +
    newString +
    content.substring(index + oldString.length)
  );
}

/**
 * Converts from utf-8 string to base64-encoded string
 */
export function toBase64(input: string): string {
  return Buffer.from(input).toString('base64');
}

/**
 * Converts from base64-encoded string to utf-8 string
 */
export function fromBase64(input: string): string {
  return Buffer.from(input, 'base64').toString();
}

export function uniqueStrings(
  element: string,
  index: number,
  elements: string[],
): boolean {
  return elements.indexOf(element) === index;
}

export function looseEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!(a && b)) {
    return a === b;
  }
  return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
}

export function isDockerDigest(input: string): boolean {
  return /^sha256:[a-f0-9]{64}$/i.test(input);
}

export function titleCase(input: string): string {
  const words = input.toLowerCase().split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    words[i] = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  return words.join(' ');
}

/**
 * Sometimes we extract small strings from a multi-megabyte files.
 * If we then save them in the in-memory cache, V8 may not free
 * the initial buffer, which can lead to memory leaks:
 *
 *   https://bugs.chromium.org/p/v8/issues/detail?id=2869
 *
 */
export function copystr(x: string): string {
  const len = Buffer.byteLength(x, 'utf8');
  const buf = Buffer.allocUnsafeSlow(len);
  buf.write(x, 'utf8');
  return buf.toString('utf8');
}

/**
 * Coerce a value to a string with optional default value.
 * @param val value to coerce
 * @returns the coerced value.
 */
export function coerceString(
  val: string | null | undefined,
  def?: string,
): string {
  return val ?? def ?? '';
}

export function matchRegexOrMinimatch(input: string, pattern: string): boolean {
  if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      const regex = regEx(pattern.slice(1, -1));
      return regex.test(input);
    } catch (err) {
      return false;
    }
  }

  return minimatch(pattern, { dot: true }).match(input);
}

export function anyMatchRegexOrMinimatch(
  input: string,
  patterns: string[],
): boolean | null {
  return patterns.some((pattern) => matchRegexOrMinimatch(input, pattern));
}

const UUIDRegex = regEx(
  /^\{[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\}$/i,
);

export function isUUID(input: string): boolean {
  return UUIDRegex.test(input);
}
