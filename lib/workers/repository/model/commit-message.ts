import type { CommitMessageJSON } from '../../../types';

/**
 * @see https://git-scm.com/docs/git-commit#_discussion
 *
 * [optional prefix]: <suject>
 * [optional body]
 * [optional footer]
 */
export abstract class CommitMessage {
  static readonly SEPARATOR: string = ':';
  private static readonly EXTRA_WHITESPACES = /\s+/g;

  #body = '';
  #footer = '';
  #subject = '';

  public static formatPrefix(prefix: string): string {
    if (!prefix) {
      return '';
    }

    if (prefix.endsWith(CommitMessage.SEPARATOR)) {
      return prefix;
    }

    return `${prefix}${CommitMessage.SEPARATOR}`;
  }

  toJSON(): CommitMessageJSON {
    return {
      body: this.#body,
      footer: this.#footer,
      subject: this.#subject,
    };
  }

  toString(): string {
    const parts: ReadonlyArray<string | undefined> = [
      this.title,
      this.#body,
      this.#footer,
    ];

    return parts.filter(Boolean).join('\n\n');
  }

  get title(): string {
    return [CommitMessage.formatPrefix(this.prefix), this.formatSubject()]
      .join(' ')
      .trim();
  }

  set body(value: string) {
    this.#body = value.trim();
  }

  set footer(value: string) {
    this.#footer = value.trim();
  }

  set subject(value: string) {
    this.#subject = value.trim();
    this.#subject = this.#subject?.replace(
      CommitMessage.EXTRA_WHITESPACES,
      ' '
    );
  }

  formatSubject(): string {
    if (!this.#subject) {
      return '';
    }

    if (this.prefix) {
      return this.#subject.charAt(0).toLowerCase() + this.#subject.slice(1);
    }

    return this.#subject.charAt(0).toUpperCase() + this.#subject.slice(1);
  }

  protected abstract get prefix(): string;
}
