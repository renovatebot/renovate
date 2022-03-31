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
  static readonly #REGEXP =
    /^(?<type>[\w]+)(\((?<scope>[\w-]+)\))?(?<breaking>!)?: ((?<issue>([A-Z]+-|#)[\d]+) )?(?<description>.*)/;

  #scope = '';
  #type = '';

  static is(value: unknown): value is SemanticCommitMessage {
    return value instanceof SemanticCommitMessage;
  }

  static fromString(value: string): SemanticCommitMessage {
    const { groups = {} } = value.match(SemanticCommitMessage.#REGEXP) ?? {};

    const message = new SemanticCommitMessage();
    message.type = groups.type ?? '';
    message.scope = groups.scope ?? '';
    message.subject = groups.description ?? '';

    return message;
  }

  override toJSON(): SemanticCommitMessageJSON {
    const json = super.toJSON();

    return {
      ...json,
      scope: this.#scope,
      type: this.#type,
    };
  }

  set scope(value: string) {
    this.#scope = value.trim();
  }

  set type(value: string) {
    this.#type = value.trim();
  }

  protected get prefix(): string {
    if (this.#type && !this.#scope) {
      return this.#type;
    }

    if (this.#scope) {
      return `${this.#type}(${this.#scope})`;
    }

    return '';
  }
}
