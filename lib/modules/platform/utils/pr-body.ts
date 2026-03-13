import { logger } from '../../../logger/index.ts';
import { emojify } from '../../../util/emoji.ts';
import { regEx } from '../../../util/regex.ts';

const re = regEx(
  `(?<preNotes>.*### Release Notes)(?<releaseNotes>.*)### Configuration(?<postNotes>.*)`,
  's',
);

const htmlTags = ['summary', 'table', 'div', 'blockquote', 'details'] as const;

/**
 * Returns the stack of all unclosed opening tags in the text
 * (outermost first, innermost last), or an empty array if balanced.
 */
function findAllUnclosedTags(
  text: string,
): { tag: string; position: number }[] {
  // Collect all open/close tag positions
  const events: { tag: string; type: 'open' | 'close'; position: number }[] =
    [];

  for (const tag of htmlTags) {
    const openRe = regEx(new RegExp(`<${tag}[\\s>]`, 'gi'));
    let match;
    while ((match = openRe.exec(text)) !== null) {
      events.push({ tag, type: 'open', position: match.index });
    }
    const closeRe = regEx(new RegExp(`</${tag}>`, 'gi'));
    while ((match = closeRe.exec(text)) !== null) {
      events.push({ tag, type: 'close', position: match.index });
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
 * - A closing fence must have >= the same number of backticks, no info string
 * - Content inside a code block (even if it looks like ```lang) is not a fence
 */
function findUnclosedCodeFence(text: string): number {
  let openPos = -1;
  let openLen = 0;
  let inside = false;
  let match;
  // Matches 3+ backticks at the start of a line, capturing the backticks
  // and any trailing info string
  const re = regEx(/^(`{3,})(\S*)/gm);
  while ((match = re.exec(text)) !== null) {
    const backtickLen = match[1].length;
    const infoString = match[2];
    if (!inside) {
      // Any 3+ backticks opens a fence
      openPos = match.index;
      openLen = backtickLen;
      inside = true;
    } else if (!infoString && backtickLen >= openLen) {
      // Closes only if: no info string AND at least as many backticks
      inside = false;
      openPos = -1;
      openLen = 0;
    }
    // Otherwise it's just content inside the code block
  }
  return inside ? openPos : -1;
}

/**
 * Closes unclosed fenced code blocks and HTML tags within the given
 * length budget. If a closing tag would exceed maxLen, the text is
 * trimmed back to before the unclosed opening tag instead.
 */
export function closeUnclosedStructures(
  text: string,
  maxLen: number,
  externalClosingTags?: Partial<Record<string, number>>,
): string {
  let result = text;

  // Close unclosed fenced code blocks
  const unclosedFencePos = findUnclosedCodeFence(result);
  if (unclosedFencePos >= 0) {
    const closeFence = '\n```\n';
    if (result.length + closeFence.length <= maxLen) {
      result += closeFence;
    } else {
      result = result.slice(0, unclosedFencePos);
    }
  }

  // Track how many unclosed tags can be left for external closing
  const externalBudget: Record<string, number> = {};
  if (externalClosingTags) {
    for (const [tag, count] of Object.entries(externalClosingTags)) {
      if (count && count > 0) {
        externalBudget[tag] = count;
      }
    }
  }

  // Close unclosed HTML tags iteratively.
  // Re-scan after each modification since trimming changes the stack.
  let stack = findAllUnclosedTags(result);

  // Consume external budget from the outermost (first) entries
  while (stack.length > 0) {
    const outermost = stack[0];
    if ((externalBudget[outermost.tag] ?? 0) > 0) {
      externalBudget[outermost.tag]--;
      stack.shift();
    } else {
      break;
    }
  }

  // Process remaining unclosed tags from innermost to outermost
  while (stack.length > 0) {
    const innermost = stack[stack.length - 1];
    const closeTag = `\n</${innermost.tag}>\n`;
    if (result.length + closeTag.length <= maxLen) {
      result += closeTag;
    } else {
      result = result.slice(0, innermost.position);
    }
    // Re-scan and re-apply external budget since text changed
    stack = findAllUnclosedTags(result);
    // Re-consume external budget from outermost
    const budgetCopy = { ...externalClosingTags };
    while (stack.length > 0) {
      const outer = stack[0];
      const remaining = budgetCopy[outer.tag] ?? 0;
      if (remaining > 0) {
        budgetCopy[outer.tag] = remaining - 1;
        stack.shift();
      } else {
        break;
      }
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
      { details: 1 },
    );
    return preNotes + truncatedNotes + divider + postNotes;
  }
}
