import type { RenovateConfig } from '../../../../config/types';
import { clone } from '../../../../util/clone';
import * as template from '../../../../util/template';
import type { CommitMessage } from '../../model/commit-message';
import { CommitMessageFactory } from '../../model/commit-message-factory';

export class ConfigMigrationSemanticFactory {
  private readonly config: RenovateConfig;
  private commitMessage: string | null = null;
  private prTitle: string | null = null;

  constructor(config: RenovateConfig, private readonly configFile: string) {
    this.config = clone(config);
  }

  private create(isTitle = false): CommitMessage {
    const { commitMessage } = this.config;
    const commitMessageTopic = isTitle
      ? `Migrate renovate config`
      : `Migrate config ${this.configFile}`;

    this.config.commitMessageAction =
      this.config.commitMessageAction === 'Update'
        ? ''
        : this.config.commitMessageAction;

    this.config.commitMessageTopic =
      this.config.commitMessageTopic === 'dependency {{depName}}'
        ? commitMessageTopic
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
