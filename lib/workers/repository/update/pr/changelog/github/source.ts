import { GlobalConfig } from '../../../../../../config/global.ts';
import { logger } from '../../../../../../logger/index.ts';
import * as hostRules from '../../../../../../util/host-rules.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { ChangeLogSource } from '../source.ts';
import type { ChangeLogError } from '../types.ts';
export class GitHubChangeLogSource extends ChangeLogSource {
  constructor() {
    super('github', 'github-tags');
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    const baseUrl = this.getBaseUrl(config);
    return baseUrl.startsWith('https://github.com/')
      ? 'https://api.github.com/'
      : baseUrl + 'api/v3/';
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }

  protected override shouldSkipPackage(config: BranchUpgradeConfig): boolean {
    if (
      config.sourceUrl === 'https://github.com/DefinitelyTyped/DefinitelyTyped'
    ) {
      logger.trace('No release notes for @types');
      return true;
    }

    return false;
  }

  protected override hasValidToken(config: BranchUpgradeConfig): {
    isValid: boolean;
    error?: ChangeLogError;
  } {
    const sourceUrl = config.sourceUrl!;
    const { host } = new URL(sourceUrl);
    const manager = config.manager;
    const packageName = config.packageName;

    const url = sourceUrl.startsWith('https://github.com/')
      ? 'https://api.github.com/'
      : sourceUrl;
    const { token } = hostRules.find({
      hostType: 'github',
      url,
      readOnly: true,
    });
    // istanbul ignore if
    if (host && !token) {
      if (host.endsWith('.github.com') || host === 'github.com') {
        if (!GlobalConfig.get('githubTokenWarn')) {
          logger.debug(
            { manager, packageName, sourceUrl },
            'GitHub token warning has been suppressed. Skipping release notes retrieval',
          );
          return { isValid: false };
        }
        logger.warn(
          { manager, packageName, sourceUrl },
          'No github.com token has been configured. Skipping release notes retrieval',
        );
        return { isValid: false, error: 'MissingGithubToken' };
      }
      logger.debug(
        { manager, packageName, sourceUrl },
        'Repository URL does not match any known github hosts - skipping changelog retrieval',
      );
      return { isValid: false };
    }
    return { isValid: true };
  }
}
