import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { Matcher } from './base';

export class PathsMatcher extends Matcher {
  override matches(
    { packageFile }: PackageRuleInputConfig,
    { matchPaths }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPaths)) {
      return null;
    }
    if (is.undefined(packageFile)) {
      return false;
    }

    return matchPaths.some((rulePath) => {
      if (minimatch(packageFile, rulePath, { dot: true })) {
        return true;
      }

      if (packageFile.includes(rulePath)) {
        logger.warn(
          {
            rulePath,
            packageFile,
          },
          'Partial matches for `matchPaths` are deprecated. Please use a minimatch glob pattern or switch to `matchFiles` if you need exact matching.'
        );
        return true;
      }
    });
  }
}
