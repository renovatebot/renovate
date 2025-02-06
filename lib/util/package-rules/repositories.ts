import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
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

    return matchRegexOrGlobList(repository, matchRepositories);
  }
}
