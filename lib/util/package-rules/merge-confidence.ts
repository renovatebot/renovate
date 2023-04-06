import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class MergeConfidenceMatcher extends Matcher {
  override matches(
    { mergeConfidenceLevel }: PackageRuleInputConfig,
    { matchConfidence }: PackageRule
  ): boolean | null {
    if (is.nullOrUndefined(matchConfidence)) {
      return null;
    }
    return (
      is.array(matchConfidence) &&
      is.nonEmptyString(mergeConfidenceLevel) &&
      matchConfidence.includes(mergeConfidenceLevel)
    );
  }
}
