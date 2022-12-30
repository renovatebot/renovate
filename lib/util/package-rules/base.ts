import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import type { MatcherApi } from './types';

export abstract class Matcher implements MatcherApi {
  /**
   * Test exclusion packageRule against inputConfig
   * @return null if no rules are defined, true if exclusion should be applied and else false
   * @param inputConfig
   * @param packageRule
   */
  excludes(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule
  ): boolean | null {
    return null;
  }

  /**
   * Test match packageRule against inputConfig
   * @return null if no rules are defined, true if match should be applied and else false
   * @param inputConfig
   * @param packageRule
   */
  abstract matches(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule
  ): boolean | null;
}
