import type { RenovateConfig } from '../../../../config/types.ts';
import * as template from '../../../../util/template/index.ts';
import { CommitMessageFactory } from '../../model/commit-message-factory.ts';
import type { CommitMessage } from '../../model/commit-message.ts';

export class ConfigMigrationCommitMessageFactory {
  private readonly config: RenovateConfig;
  private readonly configFile: string;

  constructor(config: RenovateConfig, configFile: string) {
    this.config = config;
    this.configFile = configFile;
  }

  private create(commitMessageTopic: string): CommitMessage {
    const { commitMessage } = this.config;

    const config = {
      ...this.config,
      semanticCommitScope: 'config',
      commitMessageExtra: '',
      commitMessageAction: '',
      commitMessageSuffix: '',
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
    return this.create(`Migrate Renovate config`).toString();
  }
}
