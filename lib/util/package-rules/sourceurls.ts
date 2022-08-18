import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class SourceUrlsMatcher extends Matcher {
  override matches(
    { sourceUrl }: PackageRuleInputConfig,
    { matchSourceUrls }: PackageRule
  ): boolean | null {
    if (is.undefined(matchSourceUrls)) {
      return null;
    }
    if (is.undefined(sourceUrl)) {
      return false;
    }

    const upperCaseSourceUrl = sourceUrl?.toUpperCase();
    return matchSourceUrls.some(
      (url) => upperCaseSourceUrl === url.toUpperCase()
    );
  }
}
