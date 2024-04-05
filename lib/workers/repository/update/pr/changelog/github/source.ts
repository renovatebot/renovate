import URL from 'node:url';
import { GlobalConfig } from '../../../../../../config/global';
import { logger } from '../../../../../../logger';
import * as hostRules from '../../../../../../util/host-rules';
import type { BranchUpgradeConfig } from '../../../../../types';
import { ChangeLogSource } from '../source';
import type { ChangeLogError } from '../types';
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
    const parsedUrl = URL.parse(sourceUrl);
    const host = parsedUrl.host;
    const manager = config.manager;
    const packageName = config.packageName;

    const url = sourceUrl.startsWith('https://github.com/')
      ? 'https://api.github.com/'
      : sourceUrl;
    const { token } = hostRules.find({
      hostType: 'github',
      url,
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
