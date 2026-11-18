import { isNonEmptyString } from '@sindresorhus/is';
import type { RenovateConfig } from '../../../../config/types.ts';
import * as template from '../../../../util/template/index.ts';
import { createConfigFileCommitMessage } from '../../model/commit-config-file.ts';

export class ConfigMigrationCommitMessageFactory {
  private readonly config: RenovateConfig;
  private readonly configFile: string;

  constructor(config: RenovateConfig, configFile: string) {
    this.config = config;
    this.configFile = configFile;
  }

  private create(commitMessageTopic: string): string {
    const { commitMessage } = this.config;

    const config = {
      ...this.config,
      semanticCommitScope: 'config',
      commitMessageExtra: '',
      commitMessageAction: '',
      commitMessageSuffix: '',
      commitMessageTopic,
    };

    // a configured commitMessage replaces the prefix rather than following it
    const subject = isNonEmptyString(commitMessage)
      ? template.compile(commitMessage, { ...config, commitMessagePrefix: '' })
      : commitMessageTopic;

    return createConfigFileCommitMessage(config, subject);
  }

  getCommitMessage(): string {
    return this.create(`Migrate config ${this.configFile}`);
  }

  getPrTitle(): string {
    return this.create(`Migrate Renovate config`);
  }
}
