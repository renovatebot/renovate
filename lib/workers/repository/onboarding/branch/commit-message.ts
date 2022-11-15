import type { RenovateConfig } from '../../../../config/types';
import type { CommitMessage } from '../../model/commit-message';
import { CommitMessageFactory } from '../../model/commit-message-factory';

export class OnboardingCommitMessageFactory {
  private readonly config: RenovateConfig;

  private readonly configFile: string;

  constructor(config: RenovateConfig, configFile: string) {
    this.config = config;
    this.configFile = configFile;
  }

  create(): CommitMessage {
    const { onboardingCommitMessage } = this.config;
    const commitMessageFactory = new CommitMessageFactory(this.config);
    const commitMessage = commitMessageFactory.create();

    if (onboardingCommitMessage) {
      commitMessage.subject = onboardingCommitMessage;
    } else {
      commitMessage.subject = `add ${this.configFile}`;
    }

    return commitMessage;
  }
}
