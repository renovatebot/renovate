import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
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

    return matchPaths.some(
      (rulePath) =>
        packageFile.includes(rulePath) ||
        minimatch(packageFile, rulePath, { dot: true })
    );
  }
}
