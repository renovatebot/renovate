import { isUndefined } from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class RepositoriesMatcher extends Matcher {
  override matches(
    { repository }: PackageRuleInputConfig,
    { matchRepositories }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchRepositories)) {
      return null;
    }

    if (isUndefined(repository)) {
      return false;
    }

    return matchRegexOrGlobList(repository, matchRepositories);
  }
}
