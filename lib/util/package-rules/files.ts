import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { minimatch } from '../minimatch';
import { Matcher } from './base';

export class FileNamesMatcher extends Matcher {
  override matches(
    { packageFile, lockFiles }: PackageRuleInputConfig,
    { matchFileNames }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchFileNames)) {
      return null;
    }
    if (is.undefined(packageFile)) {
      return false;
    }

    return matchFileNames.some(
      (matchFileName) =>
        minimatch(matchFileName, { dot: true }).match(packageFile) ||
        (is.array(lockFiles) &&
          lockFiles.some((lockFile) =>
            minimatch(matchFileName, { dot: true }).match(lockFile),
          )),
    );
  }
}
