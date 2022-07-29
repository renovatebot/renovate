import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class SourceUrlsMatcher extends Matcher {
  static readonly id: string = 'source-urls';

  override matches(
    { sourceUrl }: PackageRuleInputConfig,
    { matchSourceUrls }: PackageRule
  ): boolean | null {
    if (is.undefined(matchSourceUrls) || is.undefined(sourceUrl)) {
      return null;
    }

    const upperCaseSourceUrl = sourceUrl?.toUpperCase();
    return matchSourceUrls.some(
      (url) => upperCaseSourceUrl === url.toUpperCase()
    );
  }
}
