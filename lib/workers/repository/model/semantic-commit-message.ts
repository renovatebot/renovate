import type { CommitMessageJSON } from '../../../types';
import { CommitMessage } from './commit-message';

export interface SemanticCommitMessageJSON extends CommitMessageJSON {
  scope?: string;
  type?: string;
}

/**
 * @see https://www.conventionalcommits.org/en/v1.0.0/#summary
 *
 * <type>[optional scope]: <description>
 * [optional body]
 * [optional footer]
 */
export class SemanticCommitMessage extends CommitMessage {
  private static readonly REGEXP =
    /^(?<type>[\w]+)(\((?<scope>[\w-]+)\))?(?<breaking>!)?: ((?<issue>([A-Z]+-|#)[\d]+) )?(?<description>.*)/;

  private scope?: string;
  private type?: string;

  static is(value: unknown): value is SemanticCommitMessage {
    return value instanceof SemanticCommitMessage;
  }

  static fromString(value: string): SemanticCommitMessage {
    const { groups = {} } = value.match(SemanticCommitMessage.REGEXP) ?? {};

    const message = new SemanticCommitMessage();
    message.setType(groups.type);
    message.setScope(groups.scope);
    message.setSubject(groups.description);

    return message;
  }

  override toJSON(): SemanticCommitMessageJSON {
    const json = super.toJSON();

    return {
      ...json,
      scope: this.scope,
      type: this.type,
    };
  }

  setScope(scope?: string): void {
    this.scope = scope?.trim();
  }

  setType(type?: string): void {
    this.type = type?.trim();
  }

  protected get prefix(): string {
    if (this.type && !this.scope) {
      return this.type;
    }

    if (this.scope) {
      return `${this.type}(${this.scope})`;
    }

    return '';
  }
}
