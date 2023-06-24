import URL from 'node:url';
import { GlobalConfig } from '../../../../../config/global';
import { logger } from '../../../../../logger';
import type * as allVersioning from '../../../../../modules/versioning';
import { cache } from '../../../../../util/cache/package/decorator';
import * as hostRules from '../../../../../util/host-rules';
import { regEx } from '../../../../../util/regex';
import type { BranchUpgradeConfig } from '../../../../types';
import { getTags } from './github';
import { ChangeLogSource } from './source';
import type { ChangeLogError } from './types';
export class GitHubChangeLogSource extends ChangeLogSource {
  constructor() {
    super('github');
  }

  getAPIBaseUrl(sourceUrl: string): string {
    return sourceUrl.startsWith('https://github.com/')
      ? 'https://api.github.com/'
      : this.getBaseUrl(sourceUrl) + 'api/v3/';
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string
  ): string {
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }

  @cache({
    namespace: `changelog-github-release`,
    key: (endpoint: string, repository: string) =>
      `getTags-${endpoint}-${repository}`,
  })
  getTags(endpoint: string, repository: string): Promise<string[]> {
    return getTags(endpoint, repository);
  }

  protected override shouldSkipSource(sourceUrl: string): boolean {
    if (sourceUrl === 'https://github.com/DefinitelyTyped/DefinitelyTyped') {
      logger.trace('No release notes for @types');
      return true;
    }

    return false;
  }

  protected override findTagOfRelease(
    version: allVersioning.VersioningApi,
    packageName: string,
    depNewVersion: string,
    tags: string[]
  ): string | undefined {
    const regex = regEx(`(?:${packageName}|release)[@-]`, undefined, false);
    const exactReleaseRegex = regEx(`${packageName}[@\\-_]v?${depNewVersion}`);
    const exactTagsList = tags.filter((tag) => {
      return exactReleaseRegex.test(tag);
    });
    let tagName: string | undefined;
    if (exactTagsList.length) {
      tagName = exactTagsList
        .filter((tag) => version.isVersion(tag.replace(regex, '')))
        .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
    } else {
      tagName = tags
        .filter((tag) => version.isVersion(tag.replace(regex, '')))
        .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
    }
    return tagName;
  }

  protected override hasValidToken(
    sourceUrl: string,
    config: BranchUpgradeConfig
  ): { isValid: boolean; error?: ChangeLogError } {
    const parsedUrl = URL.parse(sourceUrl);
    const host = parsedUrl.host!;
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
    if (!token) {
      if (host.endsWith('.github.com') || host === 'github.com') {
        if (!GlobalConfig.get('githubTokenWarn')) {
          logger.debug(
            { manager, packageName, sourceUrl },
            'GitHub token warning has been suppressed. Skipping release notes retrieval'
          );
          return { isValid: false };
        }
        logger.warn(
          { manager, packageName, sourceUrl },
          'No github.com token has been configured. Skipping release notes retrieval'
        );
        return { isValid: false, error: 'MissingGithubToken' };
      }
      logger.debug(
        { manager, packageName, sourceUrl },
        'Repository URL does not match any known github hosts - skipping changelog retrieval'
      );
      return { isValid: false };
    }
    return { isValid: true };
  }
}
