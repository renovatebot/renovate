import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { regEx } from '../regex';
import { Matcher } from './base';
import { massagePattern } from './utils';

export class RepositoryPatternsMatcher extends Matcher {
  override matches(
    { repository }: PackageRuleInputConfig,
    { matchRepositoryPatterns }: PackageRule
  ): boolean | null {
    if (is.undefined(matchRepositoryPatterns)) {
      return null;
    }

    if (is.undefined(repository)) {
      return false;
    }

    let isMatch = false;
    for (const repositoryPattern of matchRepositoryPatterns) {
      if (isRepositoryMatch(repositoryPattern, repository)) {
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
