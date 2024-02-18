import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { anyMatchRegexOrGlob } from '../string-match';
import { Matcher } from './base';

export class RepositoriesMatcher extends Matcher {
  override matches(
    { repository }: PackageRuleInputConfig,
    { matchRepositories }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchRepositories)) {
      return null;
    }

    if (is.undefined(repository)) {
      return false;
    }

    return anyMatchRegexOrGlob(repository, matchRepositories);
  }

  override excludes(
    { repository }: PackageRuleInputConfig,
    { excludeRepositories }: PackageRule,
  ): boolean | null {
    if (is.undefined(excludeRepositories)) {
      return null;
    }

    if (is.undefined(repository)) {
      return false;
    }

    return anyMatchRegexOrGlob(repository, excludeRepositories);
  }
}
