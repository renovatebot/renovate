export interface CommitMessageJSON {
  body?: string;
  footer?: string;
  title: string;
}

/**
 * @see https://git-scm.com/docs/git-commit#_discussion
 *
 * <title>
 * [optional body]
 * [optional footer]
 */
export abstract class AbstractCommitMessage {
  static readonly SEPARATOR: string = ':';

  private body?: string;
  private footer?: string;

  toString(): string {
    const parts: ReadonlyArray<string> = [this.title, this.body, this.footer];

    return parts.filter(Boolean).join('\n\n');
  }

  toJSON(): CommitMessageJSON {
    return {
      body: this.body,
      footer: this.footer,
      title: this.title,
    };
  }

  abstract get title(): string;

  setBody(body?: string): void {
    this.body = body?.trim();
  }

  setFooter(footer?: string): void {
    this.footer = footer?.trim();
  }
}
