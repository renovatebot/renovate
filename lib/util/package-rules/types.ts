import type { PackageRule, PackageRuleInputConfig } from '../../config/types';

export interface MatcherApi {
  matches(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule
  ): boolean | null;
  excludes(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule
  ): boolean | null;
}
