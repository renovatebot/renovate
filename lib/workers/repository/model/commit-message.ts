import { regEx } from '../../../util/regex';

export class CommitMessage {
  public static readonly SEPARATOR: string = ':';

  private message = '';

  private prefix = '';

  constructor(message = '') {
    this.setMessage(message);
  }

  public static formatPrefix(prefix: string): string {
    if (!prefix) {
      return '';
    }

    if (prefix.endsWith(CommitMessage.SEPARATOR)) {
      return prefix;
    }

    return `${prefix}${CommitMessage.SEPARATOR}`;
  }

  public setMessage(message: string): void {
    this.message = (message || '').trim();
  }

  public setCustomPrefix(prefix?: string): void {
    this.prefix = (prefix ?? '').trim();
  }

  public setSemanticPrefix(type?: string, scope?: string): void {
    this.prefix = (type ?? '').trim();

    if (scope?.trim()) {
      this.prefix += `(${scope.trim()})`;
    }
  }

  public toString(): string {
    const prefix = CommitMessage.formatPrefix(this.prefix);
    const message = this.formatMessage();

    return [prefix, message].join(' ').trim();
  }
  public static formatCasing(commitMessage: string): string {
    return commitMessage.replace(
      regEx(/^([\w]+:|[\w]+\(.*\):)/).test(commitMessage)
        ? regEx(/: \w+/)
        : regEx(/^\w+/),
      (match) => match.toLowerCase()
    );
  }

  private formatMessage(): string {
    if (this.prefix) {
      return this.message;
    }

    return this.message.charAt(0).toUpperCase() + this.message.slice(1);
  }
}
