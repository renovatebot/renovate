import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { regEx } from '../regex';
import { Matcher } from './base';
import { massagePattern } from './utils';

export class RepositoryPatternsMatcher extends Matcher {
  override matches(
    { repository }: PackageRuleInputConfig, // TODO - need correct fields
    { matchRepositoryPatterns }: PackageRule
  ): boolean | null {
    if (is.undefined(matchRepositoryPatterns)) {
      return null;
    }

    if (is.undefined(repository)) {
      return false;
    }

    const reposToMatchAgainst = [repository];

    let isMatch = false;
    for (const repositoryPattern of matchRepositoryPatterns) {
      if (
        reposToMatchAgainst.some((repo) =>
          isRepositoryMatch(repositoryPattern, repo)
        )
      ) {
        isMatch = true;
      }
    }
    return isMatch;
  }
}

function isRepositoryMatch(repoPattern: string, repo: string): boolean {
  const re = regEx(massagePattern(repoPattern));
  if (re.test(repo)) {
    logger.trace(`${repo} matches against ${String(re)}`);
    return true;
  }
  return false;
}
