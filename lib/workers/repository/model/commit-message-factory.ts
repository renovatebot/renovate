import type { RenovateSharedConfig } from '../../../config/types.ts';
import { coerceString } from '../../../util/string.ts';
import type { CommitMessage } from './commit-message.ts';
import { CustomCommitMessage } from './custom-commit-message.ts';
import { SemanticCommitMessage } from './semantic-commit-message.ts';

type CommitMessageConfig = Pick<
  RenovateSharedConfig,
  | 'commitMessagePrefix'
  | 'semanticCommits'
  | 'semanticCommitScope'
  | 'semanticCommitType'
>;

export class CommitMessageFactory {
  private readonly _config: CommitMessageConfig;

  constructor(config: CommitMessageConfig) {
    this._config = config;
  }

  create(): CommitMessage {
    const message = this.areSemanticCommitsEnabled
      ? this.createSemanticCommitMessage()
      : this.createCustomCommitMessage();

    return message;
  }

  private createSemanticCommitMessage(): SemanticCommitMessage {
    const message = new SemanticCommitMessage();

    message.type = coerceString(this._config.semanticCommitType);
    message.scope = coerceString(this._config.semanticCommitScope);

    return message;
  }

  private createCustomCommitMessage(): CustomCommitMessage {
    const message = new CustomCommitMessage();
    message.prefix = this._config.commitMessagePrefix ?? '';

    return message;
  }

  private get areSemanticCommitsEnabled(): boolean {
    return (
      !this._config.commitMessagePrefix &&
      this._config.semanticCommits === 'enabled'
    );
  }
}
