import type { Nodes } from 'mdast';
import { remark } from 'remark';
import gfm from 'remark-gfm';
import type { Options as RemarkGithubOptions } from 'remark-github';
import github from 'remark-github';
import { coerceNumber } from './number.ts';
import { regEx } from './regex.ts';

// Returns the start and end offsets of every code block and inline code span under `node`,
// in document order. Each range covers the whole node, fences or backticks included.
// The parser follows CommonMark, so fences of any length, tilde fences and indented code blocks are found too.
function getCodeRanges(node: Nodes): [number, number][] {
  // A code node: return its range, there is nothing to look for inside it
  if (node.type === 'code' || node.type === 'inlineCode') {
    const start = coerceNumber(node.position?.start.offset);
    const end = coerceNumber(node.position?.end.offset);
    return [[start, end]];
  }

  // Text, HTML and other nodes without children contain no code
  if (!('children' in node)) {
    return [];
  }

  // A node with children (paragraph, list item, …): collect the code ranges of each child, in order
  const ranges: [number, number][] = [];
  for (const child of node.children) {
    ranges.push(...getCodeRanges(child));
  }
  return ranges;
}

function escapeMentions(text: string): string {
  // `split` puts the URLs at odd indexes
  return text
    .split(regEx(/(?<url>https?:\/\/[^\s<]+)/gi))
    .map((part, index) =>
      index % 2 === 1 ? part : part.replace(regEx(/@/g), '@&#8203;'),
    )
    .join('');
}

// Generic replacements/link-breakers
export function sanitizeMarkdown(markdown: string): string {
  let res = markdown;
  // Put a zero width space after every # followed by a digit
  res = res.replace(
    regEx(/(?<pre>\W)#(?<digit>\d)/gi),
    '$<pre>#&#8203;$<digit>',
  );
  // Put a zero width space after every @ symbol to prevent unintended hyperlinking,
  // but leave URLs, code blocks, and inline code spans untouched
  // Walk through the code ranges in order: escape the text before each one, copy the code as is.
  // `textStart` is where the text that hasn't been handled yet begins.
  let sanitized = '';
  let textStart = 0;
  for (const [codeStart, codeEnd] of getCodeRanges(remark().parse(res))) {
    sanitized += escapeMentions(res.slice(textStart, codeStart));
    sanitized += res.slice(codeStart, codeEnd);
    textStart = codeEnd;
  }
  // The text after the last code range, or all of it when there is no code
  sanitized += escapeMentions(res.slice(textStart));
  res = sanitized;
  res = res.replace(regEx(/(?<pre>[a-z]@)&#8203;/gi), '$<pre>');
  res = res.replace(regEx(/\/compare\/@&#8203;/g), '/compare/@');
  res = res.replace(
    regEx(/(?<pre>\(https:\/\/[^)]*?)\.\.\.@&#8203;/g),
    '$<pre>...@',
  );
  res = res.replace(
    regEx(/(?<pre>[\s(])#(?<digits>\d+)(?<post>[)\s]?)/g),
    '$<pre>#&#8203;$<digits>$<post>',
  );
  // convert escaped backticks back to `
  const backTickRe = regEx(/&#x60;(?<content>[^/]*?)&#x60;/g);
  res = res.replace(backTickRe, '`$<content>`');
  res = res.replace(regEx(/`#&#8203;(?<digits>\d+)`/g), '`#$<digits>`');
  res = res.replace(
    regEx(/(?<before>[^\n]\n)(?<title>#.*)/g),
    '$<before>\n$<title>',
  );
  return res;
}

/**
 *
 * @param content content to process
 * @param options github options
 * @returns linkified content
 */
export async function linkify(
  content: string,
  options: RemarkGithubOptions,
): Promise<string> {
  // https://github.com/syntax-tree/mdast-util-to-markdown#optionsbullet
  const output = await remark()
    .use({ settings: { bullet: '-' } })
    .use(gfm)
    .use(github, { mentionStrong: false, ...options })
    .process(content);
  return output.toString();
}
