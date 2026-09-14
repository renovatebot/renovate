import {
  isArray,
  isNonEmptyString,
  isNullOrUndefined,
  isUndefined,
} from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global.ts';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { MISSING_API_CREDENTIALS } from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';
import { getApiToken } from '../merge-confidence/index.ts';
import { Matcher } from './base.ts';

export class MergeConfidenceMatcher extends Matcher {
  override matches(
    { mergeConfidenceLevel }: PackageRuleInputConfig,
    { matchConfidence }: PackageRule,
  ): boolean | null {
    if (isNullOrUndefined(matchConfidence)) {
      return null;
    }

    // if we're on `local` platform - for instance to test against a repo - don't error, but don't allow the packageRule either
    if (GlobalConfig.get('platform') === 'local') {
      logger.once.debug(
        "Skipping packageRule(s) with `matchConfidence`, as we're running in platform=local",
      );
      return null;
    }

    /*
     * Throw an error for unauthenticated use of the matchConfidence matcher.
     */
    if (isUndefined(getApiToken())) {
      const error = new Error(MISSING_API_CREDENTIALS);
      error.validationSource = 'MatchConfidence Authenticator';
      error.validationError = 'Missing credentials';
      error.validationMessage = `The \`matchConfidence\` matcher in \`packageRules\` requires authentication. Please refer to the [documentation](${GlobalConfig.get('productLinks').documentation}configuration-options/#packagerulesmatchconfidence) and add the required host rule.`;
      throw error;
    }

    return (
      isArray(matchConfidence) &&
      isNonEmptyString(mergeConfidenceLevel) &&
      matchConfidence.includes(mergeConfidenceLevel)
    );
  }
}
