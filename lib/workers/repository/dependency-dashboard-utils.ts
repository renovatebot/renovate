import { regEx } from '../../util/regex';

export class MarkdownHtmlFixer {
  private fixedMd: string | null = null;
  private missingHtmlTags: string[];

  static isValidMdHtml(md: string): boolean {
    return !getMissingHtmlTags(md).length;
  }

  constructor(private readonly md: string) {
    this.missingHtmlTags = getMissingHtmlTags(this.md);
  }

  fix(): string {
    if (this.fixedMd) {
      return this.fixedMd;
    }

    if (this.isValidMdHtml()) {
      return this.md;
    }

    this.fixedMd =
      this.md +
      '\n' +
      this.missingHtmlTags.map((str) => str.replace('<', '</')).join('\n') +
      '\n';

    return this.fixedMd;
  }

  private isValidMdHtml(): boolean {
    return !this.missingHtmlTags.length;
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

  get(): string[] {
    return this.stack;
  }
}

function isHtmlPair(opening: string, closing: string): boolean {
  const isOpeningTag = regEx(/<[^/]/);
  const tagRe = regEx(/<\/?\s*(?<tag>\w*)\s*>/);

  function getTagName(str: string): string | undefined {
    return tagRe.exec(str)?.groups?.tag;
  }

  return (
    isOpeningTag.test(opening) &&
    closing.startsWith('</') &&
    getTagName(opening) === getTagName(closing)
  );
}

function getMissingHtmlTags(md: string): string[] {
  const re = regEx(/<[\w/]*>/g);

  const stack = new Stack();
  for (const match of md.matchAll(re) ?? []) {
    if (!match) {
      break;
    }
    const top = stack.peek();
    const next = match[0];

    if (!top) {
      stack.push(next);
      continue;
    }

    if (isHtmlPair(top, next)) {
      stack.pop();
      continue;
    }

    stack.push(next);
  }

  return stack.get();
}
