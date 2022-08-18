import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class FilesMatcher extends Matcher {
  override matches(
    { packageFile, lockFiles }: PackageRuleInputConfig,
    { matchFiles }: PackageRule
  ): boolean | null {
    if (is.undefined(matchFiles)) {
      return null;
    }
    if (is.undefined(packageFile)) {
      return false;
    }

    return matchFiles.some(
      (fileName) =>
        packageFile === fileName ||
        (is.array(lockFiles) && lockFiles?.includes(fileName))
    );
  }
}
