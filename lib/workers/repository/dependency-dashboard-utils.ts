import { regEx } from '../../util/regex';

export class DashboardHtmlFixer {
  static isValidMdHtml(md: string): boolean {
    return !getMissingHtmlTags(md).length;
  }

  static fix(markdown: string): string {
    // edge-case: remove truncated html tag at the end of the markdown string
    const md = markdown.replace(/<\/?\w*$/, '');

    if (DashboardHtmlFixer.isValidMdHtml(md)) {
      return md;
    }

    return (
      md +
      '\n\n' +
      getMissingHtmlTags(md)
        .map((str) => str.replace('<', '</'))
        .join('\n') +
      '\n\n'
    );
  }
}

class Stack {
  private readonly stack: string[] = [];

  peek(): string | null {
    const len = this.stack.length - 1;
    if (len < 0) {
      return null;
    }
    return this.stack[len];
  }

  push(str: string): number {
    return this.stack.push(str);
  }

  pop(): string | undefined {
    return this.stack.pop();
  }

  getContent(): string[] {
    return [...this.stack].reverse();
  }
}

function isHtmlPair(opening: string, closing: string): boolean {
  const isOpeningTag = regEx(/<[^/]/);
  const tagTypeRe = regEx(/<\/?\s*(?<type>\w*)\s*>/);

  function getTagName(str: string): string | undefined {
    return tagTypeRe.exec(str)?.groups?.type;
  }

  return (
    isOpeningTag.test(opening) &&
    closing.startsWith('</') &&
    getTagName(opening) === getTagName(closing)
  );
}

function getMissingHtmlTags(md: string): string[] {
  const htmlTag = regEx(/<[\w/]*>/g);

  const stack = new Stack();
  for (const match of md.matchAll(htmlTag)) {
    const prev = stack.peek();
    const next = match[0];

    if (!prev) {
      stack.push(next);
      continue;
    }

    if (isHtmlPair(prev, next)) {
      stack.pop();
      continue;
    }

    stack.push(next);
  }

  return stack.getContent();
}
