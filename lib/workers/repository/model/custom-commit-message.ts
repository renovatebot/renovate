import type { CommitMessageJSON } from '../../../types';
import { CommitMessage } from './commit-message';

export interface CustomCommitMessageJSON extends CommitMessageJSON {
  prefix?: string;
}

export class CustomCommitMessage extends CommitMessage {
  private _prefix = '';

  get prefix(): string {
    return this._prefix;
  }

  set prefix(value: string) {
    this._prefix = this.normalizeInput(value);
  }

  override toJSON(): CustomCommitMessageJSON {
    const json = super.toJSON();

    return {
      ...json,
      prefix: this._prefix,
    };
  }
}
