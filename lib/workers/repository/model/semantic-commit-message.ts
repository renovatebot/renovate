import {
  AbstractCommitMessage,
  CommitMessageJSON,
} from './abstract-commit-message';

export interface SemanticCommitMessageJSON extends CommitMessageJSON {
  scope?: string;
  description?: string;
  type?: string;
}

/**
 * @see https://www.conventionalcommits.org/en/v1.0.0/#summary
 *
 * <type>[optional scope]: <description>
 * [optional body]
 * [optional footer]
 */
export class SemanticCommitMessage extends AbstractCommitMessage {
  private static readonly REGEXP =
    /(?<type>\w+)\s*[(]*(?<scope>\w+)*[)]*:\s*(?<description>[\w\s]*)/;

  private scope?: string;
  private description?: string;
  private type?: string;

  static fromString(value: string): SemanticCommitMessage {
    const { groups } = value.match(SemanticCommitMessage.REGEXP);

    const message = new SemanticCommitMessage();
    message.setType(groups.type);
    message.setScope(groups.scope);
    message.setDescription(groups.description);

    return message;
  }

  override toJSON(): SemanticCommitMessageJSON {
    const json = super.toJSON();

    return {
      ...json,
      scope: this.scope,
      description: this.description,
      type: this.type,
    };
  }

  get title(): string {
    return [this.formatPrefix(), this.formatDescription()].join(' ').trim();
  }

  setDescription(description?: string): void {
    this.description = description?.trim();
  }

  setScope(scope?: string): void {
    this.scope = scope?.trim();
  }

  setType(type?: string): void {
    this.type = type?.trim();
  }

  private get prefix(): string {
    if (!this.scope && !this.type) {
      return '';
    }

    return this.scope ? `${this.type}(${this.scope})` : this.type;
  }

  private formatPrefix(): string {
    if (!this.prefix) {
      return '';
    }

    if (this.prefix.endsWith(SemanticCommitMessage.SEPARATOR)) {
      return this.prefix;
    }

    return `${this.prefix}${SemanticCommitMessage.SEPARATOR}`;
  }

  private formatDescription(): string {
    if (this.prefix) {
      return this.description;
    }

    return this.description.charAt(0).toUpperCase() + this.description.slice(1);
  }
}
