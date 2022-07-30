import type { RenovateConfig } from '../../../../config/types';
import * as template from '../../../../util/template';
import type { CommitMessage } from '../../model/commit-message';
import { CommitMessageFactory } from '../../model/commit-message-factory';

export class ConfigMigrationCommitMessageFactory {
  private commitMessage: string | null = null;
  private prTitle: string | null = null;

  constructor(
    private readonly config: RenovateConfig,
    private readonly configFile: string
  ) {}

  private create(isTitle = false): CommitMessage {
    const { commitMessage } = this.config;
    const commitMessageTopic = isTitle
      ? `Migrate renovate config`
      : `Migrate config ${this.configFile}`;

    const config = {
      ...this.config,
      semanticCommitScope: 'config',
      commitMessagePrefix: '',
      commitMessageExtra: '',
      commitMessageAction: '',
      commitMessageTopic,
    };

    const commitMessageFactory = new CommitMessageFactory(config);
    const commit = commitMessageFactory.create();

    if (commitMessage) {
      commit.subject = template.compile(commitMessage, config);
    } else {
      commit.subject = commitMessageTopic;
    }

    return commit;
  }

  getCommitMessage(): string {
    if (this.commitMessage === null) {
      this.commitMessage = this.create().toString();
    }
    return this.commitMessage;
  }

  getPrTitle(): string {
    if (this.prTitle === null) {
      this.prTitle = this.create(true).toString();
    }
    return this.prTitle;
  }
}
