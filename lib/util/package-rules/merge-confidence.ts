import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { MISSING_API_CREDENTIALS } from '../../constants/error-messages';
import { getApiToken } from '../merge-confidence';
import { Matcher } from './base';

export class MergeConfidenceMatcher extends Matcher {
  override matches(
    { mergeConfidenceLevel }: PackageRuleInputConfig,
    { matchConfidence }: PackageRule,
  ): boolean | null {
    if (is.nullOrUndefined(matchConfidence)) {
      return null;
    }

    /*
     * Throw an error for unauthenticated use of the matchConfidence matcher.
     */
    if (is.undefined(getApiToken())) {
      const error = new Error(MISSING_API_CREDENTIALS);
      error.validationSource = 'MatchConfidence Authenticator';
      error.validationError = 'Missing credentials';
      error.validationMessage =
        'The `matchConfidence` matcher in `packageRules` requires authentication. Please refer to the [documentation](https://docs.renovatebot.com/configuration-options/#matchconfidence) and add the required host rule.';
      throw error;
    }

    return (
      is.array(matchConfidence) &&
      is.nonEmptyString(mergeConfidenceLevel) &&
      matchConfidence.includes(mergeConfidenceLevel)
    );
  }
}
