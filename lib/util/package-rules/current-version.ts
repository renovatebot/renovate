import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import * as allVersioning from '../../modules/versioning';
import { configRegexPredicate } from '../regex';
import { Matcher } from './base';

export class CurrentVersionMatcher extends Matcher {
  override matches(
    {
      versioning,
      lockedVersion,
      currentValue,
      currentVersion,
    }: PackageRuleInputConfig,
    { matchCurrentVersion }: PackageRule
  ): boolean | null {
    if (is.undefined(matchCurrentVersion)) {
      return null;
    }

    if (is.nullOrUndefined(currentValue)) {
      return false;
    }

    const isUnconstrainedValue = !!lockedVersion;
    const version = allVersioning.get(versioning);
    const matchCurrentVersionStr = matchCurrentVersion.toString();
    const matchCurrentVersionPred = configRegexPredicate(
      matchCurrentVersionStr
    );

    if (matchCurrentVersionPred) {
      return !(!isUnconstrainedValue && !matchCurrentVersionPred(currentValue));
    }
    if (version.isVersion(matchCurrentVersionStr)) {
      try {
        return (
          isUnconstrainedValue ||
          version.matches(matchCurrentVersionStr, currentValue)
        );
      } catch (err) {
        return false;
      }
    }

    const compareVersion = version.isVersion(currentValue)
      ? currentValue // it's a version so we can match against it
      : lockedVersion ?? currentVersion; // need to match against this currentVersion, if available
    if (is.undefined(compareVersion)) {
      return false;
    }
    if (version.isVersion(compareVersion)) {
      return version.matches(compareVersion, matchCurrentVersion);
    }
    logger.debug(
      { matchCurrentVersionStr, currentValue },
      'Could not find a version to compare'
    );
    return false;
  }
}
