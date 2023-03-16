import type { PackageRule, PackageRuleInputConfig } from '../../config/types';

export type MatchType = 'matches' | 'excludes';

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

export interface MatcherApiAsync {
  matches(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule
  ): Promise<boolean | null>;

  excludes(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule
  ): Promise<boolean | null>;
}
