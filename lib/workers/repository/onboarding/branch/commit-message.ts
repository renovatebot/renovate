import type { RenovateConfig } from '../../../../config/types';
import { CommitMessage } from '../../model/commit-message';

export class OnboardingCommitMessageFactory {
  private readonly config: RenovateConfig;

  private readonly configFile: string;

  constructor(config: RenovateConfig, configFile: string) {
    this.config = config;
    this.configFile = configFile;
  }

  create(): CommitMessage {
    const {
      commitMessagePrefix,
      onboardingCommitMessage,
      semanticCommitScope,
      semanticCommitType,
    } = this.config;
    const commitMessage = new CommitMessage();

    if (commitMessagePrefix) {
      commitMessage.setCustomPrefix(commitMessagePrefix);
    } else if (this.areSemanticCommitsEnabled()) {
      commitMessage.setSemanticPrefix(semanticCommitType, semanticCommitScope);
    }

    if (onboardingCommitMessage) {
      commitMessage.setMessage(onboardingCommitMessage);
    } else {
      commitMessage.setMessage(`add ${this.configFile}`);
    }

    return commitMessage;
  }

  private areSemanticCommitsEnabled(): boolean {
    return this.config.semanticCommits === 'enabled';
  }
}
