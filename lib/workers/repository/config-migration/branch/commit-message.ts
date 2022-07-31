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
    const messageTopic = isTitle
      ? `Migrate renovate config`
      : `Migrate config ${this.configFile}`;
    const { commitMessage } = this.config;
    let { commitMessageAction, commitMessageTopic } = this.config;

    commitMessageAction =
      commitMessageAction === 'Update' ? '' : commitMessageAction;

    commitMessageTopic =
      commitMessageTopic === 'dependency {{depName}}'
        ? messageTopic
        : commitMessageTopic;

    const config = {
      ...this.config,
      semanticCommitScope: 'config',
      commitMessageExtra: '',
      commitMessageAction,
      commitMessageTopic,
    };

    const commitMessageFactory = new CommitMessageFactory(config);
    const commit = commitMessageFactory.create();

    if (commitMessage) {
      config.commitMessagePrefix = '';
      commit.subject = template.compile(commitMessage, config);
    } else {
      commit.subject = messageTopic;
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
