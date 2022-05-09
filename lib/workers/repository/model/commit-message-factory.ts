import type { RenovateSharedConfig } from '../../../config/types';
import type { CommitMessage } from './commit-message';
import { CustomCommitMessage } from './custom-commit-message';
import { SemanticCommitMessage } from './semantic-commit-message';

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

    message.type = this._config.semanticCommitType ?? '';
    message.scope = this._config.semanticCommitScope ?? '';

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
