import is from '@sindresorhus/is';
import remark from 'remark';
import type { Plugin } from 'unified';
import { logger } from '../../logger';

interface UrlMatch {
  start: number;
  end: number;
  replaceTo: string;
}

const urlRegex =
  /(?:https?:)?(?:\/\/)?(?:www\.)?(?<!api\.)(?:to)?github\.com\/[-_a-z0-9]+\/[-_a-z0-9]+\/(?:discussions|issues|pull)\/[0-9]+(?:#[-_a-z0-9]+)?/i;

function massageLink(input: string): string {
  return input.replace(/(?:to)?github\.com/i, 'togithub.com');
}

function collectLinkPosition(input: string, matches: UrlMatch[]): Plugin<any> {
  const transformer = (tree: any): void => {
    const type = tree.type;
    const children = is.array<any>(tree.children) ? tree.children : [];
    const startOffset: number = tree.position.start.offset;
    const endOffset: number = tree.position.end.offset;

    if (type === 'link') {
      const substr = input.slice(startOffset, endOffset);
      const url: string = tree.url;
      const offset: number = startOffset + substr.lastIndexOf(url);
      if (urlRegex.test(url)) {
        matches.push({
          start: offset,
          end: offset + url.length,
          replaceTo: massageLink(url),
        });
      }
    } else if (type === 'text') {
      let text: string = tree.value;
      let match = urlRegex.exec(text);
      let currentOffset = 0;
      while (match) {
        const [url] = match;

        currentOffset += match.index;
        const start = startOffset + currentOffset;

        currentOffset += url.length;
        const end = startOffset + currentOffset;

        const newUrl = massageLink(url);
        matches.push({ start, end, replaceTo: `[${url}](${newUrl})` });

        text = text.slice(currentOffset);
        match = urlRegex.exec(text);
      }
    } else {
      children.forEach((child) => {
        transformer(child);
      });
    }
  };

  return () => transformer;
}

export function massageMarkdownLinks(content: string): string {
  try {
    const rightSpaces = content.replace(content.trimRight(), '');
    const matches: UrlMatch[] = [];
    remark().use(collectLinkPosition(content, matches)).processSync(content);
    const result = matches.reduceRight((acc, { start, end, replaceTo }) => {
      const leftPart = acc.slice(0, start);
      const rightPart = acc.slice(end);
      return leftPart + replaceTo + rightPart;
    }, content);
    return result.trimRight() + rightSpaces;
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, `Unable to massage markdown text`);
    return content;
  }
}
