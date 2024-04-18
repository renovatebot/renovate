import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class DepPrefixesMatcher extends Matcher {
  override matches(
    { depName }: PackageRuleInputConfig,
    { matchDepPrefixes }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchDepPrefixes)) {
      return null;
    }

    if (is.undefined(depName)) {
      return false;
    }

    return matchDepPrefixes.some((prefix) => depName.startsWith(prefix));
  }
}
