import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import type { MatcherApi } from './types.ts';

export abstract class Matcher implements MatcherApi {
  /**
   * Test match packageRule against inputConfig
   * @return null if no rules are defined, true if match should be applied and else false
   * @param inputConfig
   * @param packageRule
   */
  abstract matches(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null | Promise<boolean | null>;
}
