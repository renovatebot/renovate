import { regEx } from '../../util/regex';

export class DashboardHtmlFixer {
  private readonly md: string;
  private fixedMd: string | null = null;
  private missingHtmlTags: string[];

  static isValidMdHtml(md: string): boolean {
    return !getMissingHtmlTags(md).length;
  }

  constructor(markdown: string) {
    // edge-case: remove truncated html tag at the end of the markdown string
    this.md = markdown.replace(/<\/?\w*$/, '');
    this.missingHtmlTags = getMissingHtmlTags(this.md);
  }

  fix(): string {
    if (this.fixedMd) {
      return this.fixedMd;
    }

    if (this.isValidMdHtml()) {
      this.fixedMd = this.md;
      return this.fixedMd;
    }

    this.fixedMd =
      this.md +
      '\n\n' +
      this.missingHtmlTags.map((str) => str.replace('<', '</')).join('\n') +
      '\n\n';

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
