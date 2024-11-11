import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import * as allVersioning from '../../modules/versioning';
import { getRegexPredicate } from '../string-match';
import { Matcher } from './base';

export class CurrentVersionMatcher extends Matcher {
  override matches(
    {
      versioning,
      lockedVersion,
      currentValue,
      currentVersion,
    }: PackageRuleInputConfig,
    { matchCurrentVersion }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchCurrentVersion)) {
      return null;
    }
    const isUnconstrainedValue =
      !!lockedVersion && is.nullOrUndefined(currentValue);
    const versioningApi = allVersioning.get(versioning);
    const matchCurrentVersionStr = matchCurrentVersion.toString();
    const matchCurrentVersionPred = getRegexPredicate(matchCurrentVersionStr);

    if (matchCurrentVersionPred) {
      const compareVersion = lockedVersion ?? currentVersion ?? currentValue;
      return (
        !is.nullOrUndefined(compareVersion) &&
        matchCurrentVersionPred(compareVersion)
      );
    }
    if (versioningApi.isVersion(matchCurrentVersionStr)) {
      try {
        return (
          isUnconstrainedValue ||
          !!(
            currentValue &&
            versioningApi.isValid(currentValue) &&
            versioningApi.matches(matchCurrentVersionStr, currentValue)
          )
        );
      } catch {
        return false;
      }
    }

    const compareVersion = versioningApi.isVersion(currentValue)
      ? currentValue // it's a version so we can match against it
      : (lockedVersion ?? currentVersion); // need to match against this currentVersion, if available
    if (is.nullOrUndefined(compareVersion)) {
      return false;
    }
    if (versioningApi.isVersion(compareVersion)) {
      return versioningApi.matches(compareVersion, matchCurrentVersion);
    }
    logger.debug(
      { matchCurrentVersionStr, currentValue },
      'Could not find a version to compare',
    );
    return false;
  }
}
