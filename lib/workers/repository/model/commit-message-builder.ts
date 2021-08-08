import { CommitMessage } from './commit-message';

export class CommitMessageBuilder {
  private message?: string;

  private prefix?: string;

  public build(): CommitMessage {
    return new CommitMessage(this.message, this.prefix);
  }

  public setMessage(message: string): this {
    this.message = message;
    return this;
  }

  public withCustomPrefix(prefix: string): this {
    this.prefix = prefix;
    return this;
  }

  public withSemanticPrefix(type?: string, scope?: string): this {
    if (!type) {
      return this;
    }

    this.prefix = type;

    if (scope) {
      this.prefix += `(${scope})`;
    }

    return this;
  }
}
