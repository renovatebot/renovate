import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';
import { anyMatchRegexOrMinimatch } from './match';

export class RepositoriesMatcher extends Matcher {
  override matches(
    { repository }: PackageRuleInputConfig,
    { matchRepositories }: PackageRule,
  ): boolean | null {
    if (is.undefined(repository)) {
      return false;
    }

    if (is.undefined(matchRepositories)) {
      return null;
    }

    return anyMatchRegexOrMinimatch(repository, matchRepositories);
  }

  override excludes(
    { repository }: PackageRuleInputConfig,
    { excludeRepositories }: PackageRule,
  ): boolean | null {
    if (is.undefined(repository)) {
      return false;
    }

    if (is.undefined(excludeRepositories)) {
      return null;
    }

    return anyMatchRegexOrMinimatch(repository, excludeRepositories);
  }
}
