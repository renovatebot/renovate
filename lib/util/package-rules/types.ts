import type { PackageRule, PackageRuleInputConfig } from '../../config/types';

export type MatchType = 'matches' | 'excludes';

export interface MatcherApi {
  matches(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null | Promise<boolean | null>;
}
