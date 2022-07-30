import is from '@sindresorhus/is';
import type { CommitMessageJSON } from '../../../types';

/**
 * @see https://git-scm.com/docs/git-commit#_discussion
 *
 * [optional prefix]: <suject>
 * [optional body]
 * [optional footer]
 */
export abstract class CommitMessage {
  private static readonly EXTRA_WHITESPACES = /\s+/g;

  private _body = '';
  private _footer = '';
  private _subject = '';

  formatPrefix(): string {
    if (!this.prefix) {
      return '';
    }

    return this.prefix;
  }

  toJSON(): CommitMessageJSON {
    return {
      body: this._body,
      footer: this._footer,
      subject: this._subject,
    };
  }

  toString(): string {
    const parts: ReadonlyArray<string | undefined> = [
      this.title,
      this._body,
      this._footer,
    ];

    return parts.filter(is.nonEmptyStringAndNotWhitespace).join('\n\n');
  }

  get title(): string {
    return [this.formatPrefix(), this.formatSubject()].join(' ').trim();
  }

  set body(value: string) {
    this._body = this.normalizeInput(value);
  }

  set footer(value: string) {
    this._footer = this.normalizeInput(value);
  }

  set subject(value: string) {
    this._subject = this.normalizeInput(value);
    this._subject = this._subject?.replace(
      CommitMessage.EXTRA_WHITESPACES,
      ' '
    );
  }

  formatSubject(): string {
    if (!this._subject) {
      return '';
    }

    if (this.prefix) {
      return this._subject.charAt(0).toLowerCase() + this._subject.slice(1);
    }

    return this._subject.charAt(0).toUpperCase() + this._subject.slice(1);
  }

  protected abstract get prefix(): string;

  protected normalizeInput(value: string | null | undefined): string {
    return value?.trim() ?? '';
  }
}
