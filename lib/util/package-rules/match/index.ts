import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';
import { match } from './main';

export class MatchMatcher extends Matcher {
  override matches(
    config: PackageRuleInputConfig,
    rule: PackageRule,
  ): boolean | null {
    if (is.nullOrUndefined(rule.match)) {
      return null;
    }
    return match(rule.match, config);
  }
}
