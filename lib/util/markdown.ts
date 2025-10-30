import type { Root } from 'mdast';
import { remark } from 'remark';
import gfm from 'remark-gfm';
import type {
  BuildUrlValues as BuildGithubUrlValues,
  Options as RemarkGithubOptions,
} from 'remark-github';
import github, {
  defaultBuildUrl as defaultBuildGithubUrl,
} from 'remark-github';
import type { Processor } from 'unified';
import { detectPlatform } from './common';
import { regEx } from './regex';

// Generic replacements/link-breakers
export function sanitizeMarkdown(markdown: string): string {
  let res = markdown;
  // Put a zero width space after every # followed by a digit
  res = res.replace(regEx(/(\W)#(\d)/gi), '$1#&#8203;$2');
  // Put a zero width space after every @ symbol to prevent unintended hyperlinking
  res = res.replace(regEx(/@/g), '@&#8203;');
  res = res.replace(regEx(/(`\[?@)&#8203;/g), '$1');
  res = res.replace(regEx(/([a-z]@)&#8203;/gi), '$1');
  res = res.replace(regEx(/\/compare\/@&#8203;/g), '/compare/@');
  res = res.replace(regEx(/(\(https:\/\/[^)]*?)\.\.\.@&#8203;/g), '$1...@');
  res = res.replace(regEx(/([\s(])#(\d+)([)\s]?)/g), '$1#&#8203;$2$3');
  // convert escaped backticks back to `
  const backTickRe = regEx(/&#x60;([^/]*?)&#x60;/g);
  res = res.replace(backTickRe, '`$1`');
  res = res.replace(regEx(/`#&#8203;(\d+)`/g), '`#$1`');
  res = res.replace(
    regEx(/(?<before>[^\n]\n)(?<title>#.*)/g),
    '$<before>\n$<title>',
  );
  return res;
}

/**
 * @param baseUrl base URL of the Git platform hosting the repository to link to
 * @param repository repository that all references to linkify are relative to
 * @param content content to process
 * @param extraGithubOptions github options
 * @returns linkified content
 */
export async function linkify(
  baseUrl: string,
  repository: string,
  content: string,
  extraGithubOptions?: RemarkGithubOptions,
): Promise<string> {
  // https://github.com/syntax-tree/mdast-util-to-markdown#optionsbullet
  let pipeline = remark()
    .use({ settings: { bullet: '-' } })
    .use(gfm) as Processor<Root, Root, undefined, Root, string>;

  if (detectPlatform(baseUrl) === 'github') {
    pipeline = pipeline.use(github, {
      mentionStrong: false,
      repository,
      // Override URL building to support GitHub Enterprise with custom domains
      buildUrl(values: Readonly<BuildGithubUrlValues>) {
        return defaultBuildGithubUrl(values).replace(
          /^https:\/\/github.com\//,
          baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
        );
      },
      ...(extraGithubOptions ?? {}),
    });
  }

  const output = await pipeline.process(content);
  return output.toString();
}
