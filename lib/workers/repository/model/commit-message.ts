export class CommitMessage {
  public static readonly SEPARATOR: string = ':';

  private readonly message: string;

  private readonly prefix: string;

  constructor(message: string, prefix = '') {
    this.message = message.trim();
    this.prefix = prefix.trim();
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

  public toString(): string {
    const prefix = CommitMessage.formatPrefix(this.prefix);
    const message = this.formatMessage();

    return [prefix, message].join(' ').trim();
  }

  private formatMessage(): string {
    if (this.prefix) {
      return this.message;
    }

    return this.message.charAt(0).toUpperCase() + this.message.slice(1);
  }
}
