import type { CommitMessageJSON } from '../../../types';
import { CommitMessage } from './commit-message';

export interface CustomCommitMessageJSON extends CommitMessageJSON {
  prefix?: string;
}

export class CustomCommitMessage extends CommitMessage {
  private _prefix?: string;

  setPrefix(prefix?: string): void {
    this._prefix = prefix?.trim();
  }

  override toJSON(): CustomCommitMessageJSON {
    const json = super.toJSON();

    return {
      ...json,
      prefix: this._prefix,
    };
  }

  protected get prefix(): string {
    return this._prefix ?? '';
  }
}
