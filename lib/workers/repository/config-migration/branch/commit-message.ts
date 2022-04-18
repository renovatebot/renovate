import type { RenovateConfig } from '../../../../config/types';
import * as template from '../../../../util/template';

export class ConfigMigrationCommitMessageFactory {
  private readonly config: RenovateConfig;

  private readonly configFile: string;

  constructor(config: RenovateConfig, configFile: string) {
    this.config = config;
    this.configFile = configFile;
  }

  create(): string {
    const { commitMessagePrefix, commitMessage, semanticCommitType } =
      this.config;
    let prefix: string | null = null;

    if (commitMessagePrefix) {
      prefix = (commitMessagePrefix ?? '').trim();
    } else if (this.areSemanticCommitsEnabled()) {
      prefix = (semanticCommitType ?? '').trim() + '(config)';
    }

    const action =
      this.config.commitMessageAction === 'Update'
        ? ''
        : this.config.commitMessageAction;
    const topic =
      this.config.commitMessageTopic === 'dependency {{depName}}'
        ? `Migrate config ${this.configFile}`
        : this.config.commitMessageTopic;

    return template
      .compile(commitMessage ?? `Migrate config ${this.configFile}`, {
        ...this.config,
        commitMessagePrefix: prefix ?? '',
        commitMessageAction: action,
        commitMessageTopic: topic,
        commitMessageExtra: '',
      })
      .trim()
      .replaceAll('  ', ' ');
  }

  private areSemanticCommitsEnabled(): boolean {
    return this.config.semanticCommits === 'enabled';
  }
}
