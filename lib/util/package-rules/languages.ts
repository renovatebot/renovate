import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class LanguagesMatcher extends Matcher {
  override matches(
    { language }: PackageRuleInputConfig,
    { matchLanguages }: PackageRule
  ): boolean | null {
    if (is.undefined(matchLanguages)) {
      return null;
    }
    if (is.undefined(language)) {
      return false;
    }
    return matchLanguages.includes(language);
  }
}
