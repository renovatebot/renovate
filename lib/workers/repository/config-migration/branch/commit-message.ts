import type { RenovateConfig } from '../../../../config/types';
import { clone } from '../../../../util/clone';
import * as template from '../../../../util/template';
import type { CommitMessage } from '../../model/commit-message';
import { CommitMessageFactory } from '../../model/commit-message-factory';

export class ConfigMigrationSemanticFactory {
  private readonly config: RenovateConfig;

  private readonly configFile: string;

  constructor(config: RenovateConfig, configFile: string) {
    this.config = clone(config);
    this.configFile = configFile;
  }

  private create(isTitle = false): CommitMessage {
    const { commitMessage } = this.config;
    const topic = isTitle
      ? `Migrate renovate config`
      : `Migrate config ${this.configFile}`;

    this.config.commitMessageAction =
      this.config.commitMessageAction === 'Update'
        ? ''
        : this.config.commitMessageAction;

    this.config.commitMessageTopic =
      this.config.commitMessageTopic === 'dependency {{depName}}'
        ? topic
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
      commit.subject = topic;
    }

    return commit;
  }

  getCommitMessage(): string {
    return this.create().toString();
  }

  getPrTitle(): string {
    return this.create(true).toString();
  }
}
