import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class SourceUrlsMatcher extends Matcher {
  override matches(
    { sourceUrl }: PackageRuleInputConfig,
    { matchSourceUrls }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchSourceUrls)) {
      return null;
    }
    if (!sourceUrl) {
      return false;
    }

    const upperCaseSourceUrl = sourceUrl.toUpperCase();
    const upperCaseMatches = matchSourceUrls.map((url) => url.toUpperCase());
    return matchRegexOrGlobList(upperCaseSourceUrl, upperCaseMatches);
  }
}
