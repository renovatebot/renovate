import type { RenovateConfig } from '../../../../config/types';
import * as template from '../../../../util/template';
import type { CommitMessage } from '../../model/commit-message';
import { CommitMessageFactory } from '../../model/commit-message-factory';

export class ConfigMigrationCommitMessageFactory {
  private readonly config: RenovateConfig;

  private readonly configFile: string;

  constructor(config: RenovateConfig, configFile: string) {
    this.config = config;
    this.configFile = configFile;
  }

  create(): CommitMessage {
    const { commitMessage } = this.config;

    this.config.commitMessageAction =
      this.config.commitMessageAction === 'Update'
        ? ''
        : this.config.commitMessageAction;

    this.config.commitMessageTopic =
      this.config.commitMessageTopic === 'dependency {{depName}}'
        ? `Migrate config ${this.configFile}`
        : this.config.commitMessageTopic;

    this.config.commitMessageExtra = '';
    this.config.semanticCommitScope = 'config';

    const commitMessageFactory = new CommitMessageFactory(this.config);
    const commit = commitMessageFactory.create();

    if (commitMessage) {
      commit.subject = template.compile(commitMessage, {
        ...this.config,
        commitMessagePrefix: '',
      });
    } else {
      commit.subject = `Migrate config ${this.configFile}`;
    }

    return commit;
  }
}
