import type { RenovateConfig } from '../../../../config/types';
import * as template from '../../../../util/template';
import type { CommitMessage } from '../../model/commit-message';
import { CommitMessageFactory } from '../../model/commit-message-factory';

export class ConfigMigrationCommitMessageFactory {
  constructor(
    private readonly config: RenovateConfig,
    private readonly configFile: string,
  ) {}

  private create(commitMessageTopic: string): CommitMessage {
    const { commitMessage } = this.config;

    const config = {
      ...this.config,
      semanticCommitScope: 'config',
      commitMessageExtra: '',
      commitMessageAction: '',
      commitMessageTopic,
    };

    const commitMessageFactory = new CommitMessageFactory(config);
    const commit = commitMessageFactory.create();

    if (commitMessage) {
      config.commitMessagePrefix = '';
      commit.subject = template.compile(commitMessage, config);
    } else {
      commit.subject = commitMessageTopic;
    }

    return commit;
  }

  getCommitMessage(): string {
    return this.create(`Migrate config ${this.configFile}`).toString();
  }

  getPrTitle(): string {
    return this.create(`Migrate renovate config`).toString();
  }
}
