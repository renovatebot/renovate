import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { logger } from '../../../logger';
import * as allVersioning from '../../../modules/versioning';
import { configRegexPredicate } from '../../regex';
import { Matcher } from '../base';

export class CurrentVersionMatcher extends Matcher {
  static readonly id: string = 'current-version';

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

    let positiveMatch = false;
    const unconstrainedValue = !!lockedVersion && is.undefined(currentValue);
    const version = allVersioning.get(versioning);
    const matchCurrentVersionStr = matchCurrentVersion.toString();
    const matchCurrentVersionPred = configRegexPredicate(
      matchCurrentVersionStr
    );
    if (matchCurrentVersionPred) {
      if (
        !unconstrainedValue &&
        (!currentValue || !matchCurrentVersionPred(currentValue))
      ) {
        return false;
      }
      positiveMatch = true;
    } else if (version.isVersion(matchCurrentVersionStr)) {
      let isMatch = false;
      try {
        isMatch =
          unconstrainedValue ||
          !!(
            currentValue &&
            version.matches(matchCurrentVersionStr, currentValue)
          );
      } catch (err) {
        // Do nothing
      }
      if (!isMatch) {
        return false;
      }
      positiveMatch = true;
    } else {
      const compareVersion =
        currentValue && version.isVersion(currentValue)
          ? currentValue // it's a version so we can match against it
          : lockedVersion ?? currentVersion; // need to match against this currentVersion, if available
      if (compareVersion) {
        // istanbul ignore next
        if (version.isVersion(compareVersion)) {
          const isMatch = version.matches(compareVersion, matchCurrentVersion);
          // istanbul ignore if
          if (!isMatch) {
            return false;
          }
          positiveMatch = true;
        } else {
          return false;
        }
      } else {
        logger.debug(
          { matchCurrentVersionStr, currentValue },
          'Could not find a version to compare'
        );
        return false;
      }
    }
    return positiveMatch;
  }
}
