import remark from 'remark';
import github from 'remark-github';

// Generic replacements/link-breakers
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown) {
    return markdown;
  }
  let res = markdown;
  // Put a zero width space after every # followed by a digit
  res = res.replace(/#(\d)/gi, '#&#8203;$1');
  // Put a zero width space after every @ symbol to prevent unintended hyperlinking
  res = res.replace(/@/g, '@&#8203;');
  res = res.replace(/(`\[?@)&#8203;/g, '$1');
  res = res.replace(/([a-z]@)&#8203;/gi, '$1');
  res = res.replace(/\/compare\/@&#8203;/g, '/compare/@');
  res = res.replace(/(\(https:\/\/[^)]*?)\.\.\.@&#8203;/g, '$1...@');
  res = res.replace(/([\s(])#(\d+)([)\s]?)/g, '$1#&#8203;$2$3');
  // convert escaped backticks back to `
  const backTickRe = /&#x60;([^/]*?)&#x60;/g;
  res = res.replace(backTickRe, '`$1`');
  res = res.replace(/`#&#8203;(\d+)`/g, '`#$1`');
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
  options: github.RemarkGithubOptions
): Promise<string> {
  // https://github.com/syntax-tree/mdast-util-to-markdown#optionsbullet
  const output = await remark()
    .use({ settings: { bullet: '-' } })
    .use(github, { mentionStrong: false, ...options })
    .process(content);
  return output.toString();
}
