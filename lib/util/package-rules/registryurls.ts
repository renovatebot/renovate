import { isNullOrUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { anyMatchRegexOrGlobList } from '../string-match.ts';
import { Matcher } from './base.ts';

export class RegistryUrlsMatcher extends Matcher {
  override matches(
    { registryUrls }: PackageRuleInputConfig,
    { matchRegistryUrls }: PackageRule,
  ): boolean | null {
    if (isNullOrUndefined(matchRegistryUrls)) {
      return null;
    }
    if (isNullOrUndefined(registryUrls)) {
      return false;
    }
    return anyMatchRegexOrGlobList(registryUrls, matchRegistryUrls);
  }
}
