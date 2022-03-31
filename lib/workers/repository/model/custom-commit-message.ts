import type { CommitMessageJSON } from '../../../types';
import { CommitMessage } from './commit-message';

export interface CustomCommitMessageJSON extends CommitMessageJSON {
  prefix?: string;
}

export class CustomCommitMessage extends CommitMessage {
  #prefix = '';

  get prefix(): string {
    return this.#prefix;
  }

  set prefix(value: string) {
    this.#prefix = value.trim();
  }

  override toJSON(): CustomCommitMessageJSON {
    const json = super.toJSON();

    return {
      ...json,
      prefix: this.#prefix,
    };
  }
}
