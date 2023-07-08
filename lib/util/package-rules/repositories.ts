import is from '@sindresorhus/is';
import { minimatch } from 'minimatch';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { regEx } from '../regex';
import { Matcher } from './base';
import { anyMatchRegexOrMinimatch } from './match';
import { massagePattern } from './utils';

export class RepositoriesMatcher extends Matcher {
  override matches(
    { repository }: PackageRuleInputConfig,
    { matchRepositories }: PackageRule
  ): boolean | null {
    if (is.undefined(matchRepositories)) {
      return null;
    }

    if (is.undefined(repository)) {
      return false;
    }

    return anyMatchRegexOrMinimatch(matchRepositories, repository);
  }

  override excludes(
    { repository }: PackageRuleInputConfig,
    { excludeRepositories }: PackageRule
  ): boolean | null {
    if (is.undefined(excludeRepositories)) {
      return null;
    }
    if (is.undefined(repository)) {
      return false;
    }
    return excludeRepositories.some(
      (matchRepositoryName) =>
        isRegexAndMatches(matchRepositoryName, repository) ||
        minimatch(repository, matchRepositoryName, { dot: true })
    );
  }
}

function isRegexAndMatches(repoPattern: string, repo: string): boolean {
  if (
    repoPattern.length < 2 ||
    !repoPattern.startsWith('/') ||
    !repoPattern.endsWith('/')
  ) {
    return false;
  }

  const repoPatternWithoutSlashes = repoPattern.slice(1, -1);

  try {
    const re = regEx(massagePattern(repoPatternWithoutSlashes));
    if (re.test(repo)) {
      logger.trace(`${repo} matches against ${String(re)}`);
      return true;
    }
    return false;
  } catch (error: any) {
    logger.debug(`invalid regex provided ${repoPatternWithoutSlashes}`);
    return false;
  }
}
