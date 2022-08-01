import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class PathsMatcher extends Matcher {
  static readonly id: string = 'paths';

  override matches(
    { packageFile }: PackageRuleInputConfig,
    { matchPaths }: PackageRule
  ): boolean | null {
    if (is.undefined(matchPaths) || is.undefined(packageFile)) {
      return null;
    }

    return matchPaths.some(
      (rulePath) =>
        packageFile.includes(rulePath) ||
        minimatch(packageFile, rulePath, { dot: true })
    );
  }
}
