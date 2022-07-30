import { regEx } from '../../../../util/regex';
import * as template from '../../../../util/template';
import type { BranchUpgradeConfig } from '../../../types';
import type { CommitMessage } from '../../model/commit-message';
import { CommitMessageFactory } from '../../model/commit-message-factory';
import { SemanticCommitMessage } from '../../model/semantic-commit-message';

export class UpdateCommitMessageFactory {
  private readonly _config: BranchUpgradeConfig;

  constructor(config: BranchUpgradeConfig) {
    this._config = config;
  }

  create(): CommitMessage {
    const config = {
      ...this._config,
    };

    const { commitMessage: commitMessageTemplate } = config;

    const commitMessageFactory = new CommitMessageFactory(config);
    const commitMessage = commitMessageFactory.create();
    // Remove commitMessagePrefix from config to avoid duplicate rendering (from commitMessage.prefix and commitMessageTemplate)
    config.commitMessagePrefix = '';

    if (SemanticCommitMessage.is(commitMessage)) {
      commitMessage.scope = template.compile(
        config.semanticCommitScope ?? '',
        config
      );
    }

    // Compile a few times in case there are nested templates
    let subject = template.compile(commitMessageTemplate ?? '', config);
    subject = template.compile(subject, config);
    subject = template.compile(subject, config);
    commitMessage.subject = subject.replace(regEx(/to vv(\d)/), 'to v$1');

    commitMessage.body = template.compile(config.commitBody ?? '', config);

    return commitMessage;
  }
}
