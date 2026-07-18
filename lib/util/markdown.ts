import { remark } from 'remark';
import gfm from 'remark-gfm';
import type { Options as RemarkGithubOptions } from 'remark-github';
import github from 'remark-github';
import { regEx } from './regex.ts';

// Generic replacements/link-breakers
export function sanitizeMarkdown(markdown: string): string {
  let res = markdown;
  // Put a zero width space after every # followed by a digit
  res = res.replace(
    regEx(/(?<pre>\W)#(?<digit>\d)/gi),
    '$<pre>#&#8203;$<digit>',
  );
  // Put a zero width space after every @ symbol to prevent unintended hyperlinking
  res = res.replace(regEx(/@/g), '@&#8203;');
  res = res.replace(regEx(/(?<pre>`\[?@)&#8203;/g), '$<pre>');
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
