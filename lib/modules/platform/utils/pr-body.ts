import { logger } from '../../../logger/index.ts';
import { emojify } from '../../../util/emoji.ts';
import { regEx } from '../../../util/regex.ts';

// This structure is guaranteed by the changelog template
// (lib/workers/repository/update/pr/changelog/hbs-template.ts)
const re = regEx(
  `(?<preNotes>.*### Release Notes\\n\\n<details>)(?<releaseNotes>.*)### Configuration(?<postNotes>.*)`,
  's',
);

const htmlTags = ['summary', 'table', 'div', 'blockquote', 'details'] as const;

/**
 * Returns [start, end] ranges for every fenced code block in the text.
 * For a balanced fence the range covers opener through closer (inclusive).
 * For an unclosed fence the range extends to the end of the text.
 */
function findCodeFenceRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let openPos = -1;
  let openLen = 0;
  let inside = false;
  let match;
  const fenceRe = regEx(/^(`{3,})(.*$)/gm);
  while ((match = fenceRe.exec(text)) !== null) {
    const backtickLen = match[1].length;
    const trailing = match[2];
    if (!inside) {
      openPos = match.index;
      openLen = backtickLen;
      inside = true;
    } else if (!trailing.trim() && backtickLen >= openLen) {
      // Per CommonMark, a closing fence must have no content after backticks
      // (only optional whitespace). ``` markdown` is NOT a valid closer.
      ranges.push([openPos, match.index + match[0].length]);
      inside = false;
    }
  }
  if (inside) {
    ranges.push([openPos, text.length]);
  }
  return ranges;
}

function isInsideCodeFence(
  position: number,
  ranges: [number, number][],
): boolean {
  return ranges.some(([start, end]) => position >= start && position < end);
}

/**
 * Returns the stack of all unclosed opening tags in the text
 * (outermost first, innermost last), or an empty array if balanced.
 * Tags inside fenced code blocks are ignored.
 */
function findAllUnclosedTags(
  text: string,
): { tag: string; position: number }[] {
  const fenceRanges = findCodeFenceRanges(text);

  // Collect all open/close tag positions
  const events: { tag: string; type: 'open' | 'close'; position: number }[] =
    [];

  for (const tag of htmlTags) {
    const openRe = regEx(new RegExp(`<${tag}[\\s>]`, 'gi'));
    let match;
    while ((match = openRe.exec(text)) !== null) {
      if (!isInsideCodeFence(match.index, fenceRanges)) {
        events.push({ tag, type: 'open', position: match.index });
      }
    }
    const closeRe = regEx(new RegExp(`</${tag}>`, 'gi'));
    while ((match = closeRe.exec(text)) !== null) {
      if (!isInsideCodeFence(match.index, fenceRanges)) {
        events.push({ tag, type: 'close', position: match.index });
      }
    }
  }

  // Process in document order to find unclosed tags via a stack
  events.sort((a, b) => a.position - b.position);
  const stack: { tag: string; position: number }[] = [];
  for (const event of events) {
    if (event.type === 'open') {
      stack.push({ tag: event.tag, position: event.position });
    } else if (stack.length > 0 && stack[stack.length - 1].tag === event.tag) {
      stack.pop();
    }
  }

  return stack;
}

/**
 * Finds the position of the last unclosed opening code fence, or -1 if
 * all fences are balanced. Per CommonMark:
 * - An opening fence is 3+ backticks, optionally followed by an info string
 * - A closing fence must have >= the same number of backticks, no trailing content
 * - Content inside a code block (even if it looks like ```lang) is not a fence
 */
function findUnclosedCodeFence(
  text: string,
): { position: number; backtickLen: number } | null {
  let openPos = -1;
  let openLen = 0;
  let inside = false;
  let match;
  // Matches 3+ backticks at the start of a line, capturing the backticks
  // and the rest of the line
  const re = regEx(/^(`{3,})(.*$)/gm);
  while ((match = re.exec(text)) !== null) {
    const backtickLen = match[1].length;
    const trailing = match[2];
    if (!inside) {
      // Any 3+ backticks opens a fence (trailing content is the info string)
      openPos = match.index;
      openLen = backtickLen;
      inside = true;
    } else if (!trailing.trim() && backtickLen >= openLen) {
      // Closes only if: no content after backticks AND at least as many backticks
      inside = false;
      openPos = -1;
      openLen = 0;
    }
    // Otherwise it's just content inside the code block
  }
  return inside ? { position: openPos, backtickLen: openLen } : null;
}

/**
 * Closes unclosed fenced code blocks and HTML tags within the given
 * length budget. If a closing tag would exceed maxLen, the text is
 * trimmed back to before the unclosed opening tag instead.
 */
export function closeUnclosedStructures(text: string, maxLen: number): string {
  let result = text;

  // Close unclosed fenced code blocks
  const fence = findUnclosedCodeFence(result);
  if (fence) {
    const closeFence = '\n' + '`'.repeat(fence.backtickLen) + '\n';
    if (result.length + closeFence.length <= maxLen) {
      result += closeFence;
    } else {
      const trimmedLen = maxLen - closeFence.length;
      if (trimmedLen > fence.position) {
        result = result.slice(0, trimmedLen) + closeFence;
      } else {
        result = result.slice(0, fence.position);
      }
    }
  }

  // Close unclosed HTML tags iteratively.
  // We calculate the total space needed for all closing tags, then
  // trim the content once to make room, and append all closing tags.
  let stack = findAllUnclosedTags(result);
  while (stack.length > 0) {
    // Calculate total suffix needed for all unclosed tags (innermost first)
    let suffix = '';
    for (let i = stack.length - 1; i >= 0; i--) {
      suffix += `\n</${stack[i].tag}>\n`;
    }

    if (result.length + suffix.length <= maxLen) {
      // All closing tags fit, append them all
      return result + suffix;
    }

    // Trim content to make room for all closing tags
    const availableForContent = maxLen - suffix.length;
    if (availableForContent > 0) {
      result = result.slice(0, availableForContent);
      // Re-scan: trimming may have changed which tags are unclosed
      stack = findAllUnclosedTags(result);
    } else {
      // Not enough room even for closing tags alone,
      // remove the outermost unclosed tag entirely
      result = result.slice(0, stack[0].position);
      stack = findAllUnclosedTags(result);
    }
  }

  return result;
}

export function smartTruncate(input: string, len: number): string {
  if (input.length < len) {
    return input;
  }
  logger.debug(
    `Truncating PR body due to platform limitation of ${len} characters`,
  );

  const note = emojify(
    `> :information_source: **Note**\n> \n> This PR body was truncated due to platform limits.\n\n`,
  );
  const truncatedInput = note + input;

  const reMatch = re.exec(truncatedInput);
  if (!reMatch?.groups) {
    return truncatedInput.substring(0, len);
  }

  const divider = `\n\n</details>\n\n---\n\n### Configuration`;
  const preNotes = reMatch.groups.preNotes;
  const releaseNotes = reMatch.groups.releaseNotes;
  const postNotes = reMatch.groups.postNotes;

  const availableLength =
    len - (preNotes.length + postNotes.length + divider.length);

  if (availableLength <= 0) {
    return truncatedInput.substring(0, len);
  } else {
    const truncatedNotes = closeUnclosedStructures(
      releaseNotes.slice(0, availableLength),
      availableLength,
    );
    return preNotes + truncatedNotes + divider + postNotes;
  }
}
