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

/**
 * Remove templates from string.
 *
 * This is more performant version of this code:
 *
 * ```
 *   content
 *     .replaceAll(regEx(/{{`.+?`}}/gs), '')
 *     .replaceAll(regEx(/{{.+?}}/gs), '')
 *     .replaceAll(regEx(/{%`.+?`%}/gs), '')
 *     .replaceAll(regEx(/{%.+?%}/gs), '')
 *     .replaceAll(regEx(/{#.+?#}/gs), '')
 * ```
 */
export function stripTemplates(content: string): string {
  const result: string[] = [];

  const len = content.length;
  let idx = 0;
  let lastPos = 0; // Tracks the start index of the next chunk to push
  while (idx < len) {
    if (content[idx] === '{' && idx + 1 < len) {
      let closing: string | undefined;
      let skipLength = 0;

      if (content[idx + 1] === '%') {
        if (idx + 2 < len && content[idx + 2] === '`') {
          // Handle `{%` ... `%}`
          closing = '`%}';
          skipLength = 3;
        } else {
          // Handle `{% ... %}`
          closing = '%}';
          skipLength = 2;
        }
      } else if (content[idx + 1] === '{') {
        if (idx + 2 < len && content[idx + 2] === '`') {
          // Handle `{{` ... `}}`
          closing = '`}}';
          skipLength = 3;
        } else {
          // Handle `{{ ... }}`
          closing = '}}';
          skipLength = 2;
        }
      } else if (content[idx + 1] === '#') {
        // Handle `{# ... #}`
        closing = '#}';
        skipLength = 2;
      }

      if (closing) {
        const end = content.indexOf(closing, idx + skipLength);
        if (end !== -1) {
          // Append the content before the pattern
          if (idx > lastPos) {
            result.push(content.slice(lastPos, idx));
          }

          // Move `idx` past the closing tag
          idx = end + closing.length;
          lastPos = idx; // Update the last position
          continue;
        }
      }
    }

    idx++;
  }

  // Append any remaining content after the last pattern
  if (lastPos < len) {
    result.push(content.slice(lastPos));
  }

  return result.join('');
}

export function capitalize(input: string): string {
  return input[0].toUpperCase() + input.slice(1);
}
