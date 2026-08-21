import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { matchRegexOrGlobList } from '../string-match.ts';
import { Matcher } from './base.ts';

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
