import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';

export type MatchType = 'matches' | 'excludes';

export interface MatcherApi {
  matches(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null | Promise<boolean | null>;
}
