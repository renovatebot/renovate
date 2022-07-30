import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class SourceUrlPrefixesMatcher extends Matcher {
  static readonly id: string = 'source-url-prefixes';

  override matches(
    { sourceUrl }: PackageRuleInputConfig,
    { matchSourceUrlPrefixes }: PackageRule
  ): boolean | null {
    if (is.undefined(matchSourceUrlPrefixes)) {
      return null;
    }
    if (is.undefined(sourceUrl)) {
      return false;
    }
    const upperCaseSourceUrl = sourceUrl?.toUpperCase();

    return matchSourceUrlPrefixes.some((prefix) =>
      upperCaseSourceUrl?.startsWith(prefix.toUpperCase())
    );
  }
}
