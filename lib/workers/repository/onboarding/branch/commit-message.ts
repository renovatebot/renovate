import { RenovateConfig } from '../../../../config/types';
import { CommitMessage } from '../../model/commit-message';
import { CommitMessageBuilder } from '../../model/commit-message-builder';

export class OnboardingCommitMessageFactory {
  private readonly config: Partial<RenovateConfig>;

  private readonly configFile: string;

  constructor(config: Partial<RenovateConfig>, configFile: string) {
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
    const commitMessageBuilder = new CommitMessageBuilder();

    if (commitMessagePrefix) {
      commitMessageBuilder.withCustomPrefix(commitMessagePrefix);
    } else if (this.areSemanticCommitsEnabled()) {
      commitMessageBuilder.withSemanticPrefix(
        semanticCommitType,
        semanticCommitScope
      );
    }

    if (onboardingCommitMessage) {
      commitMessageBuilder.setMessage(onboardingCommitMessage);
    } else {
      commitMessageBuilder.setMessage(`add ${this.configFile}`);
    }

    return commitMessageBuilder.build();
  }

  private areSemanticCommitsEnabled(): boolean {
    return this.config.semanticCommits === 'enabled';
  }
}
