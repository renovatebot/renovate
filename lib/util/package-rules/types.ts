import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';

export interface MatcherApi {
  matches(
    inputConfig: PackageRuleInputConfig,
    packageRule: PackageRule,
  ): boolean | null | Promise<boolean | null>;
}
