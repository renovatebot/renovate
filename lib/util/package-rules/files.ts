import is from '@sindresorhus/is';
import { minimatch } from 'minimatch';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class FileNamesMatcher extends Matcher {
  override matches(
    { packageFile, lockFiles }: PackageRuleInputConfig,
    { matchFileNames }: PackageRule
  ): boolean | null {
    if (is.undefined(matchFileNames)) {
      return null;
    }
    if (is.undefined(packageFile)) {
      return false;
    }

    return matchFileNames.some(
      (matchFileName) =>
        minimatch(packageFile, matchFileName, { dot: true }) ||
        (is.array(lockFiles) &&
          lockFiles.some((lockFile) =>
            minimatch(lockFile, matchFileName, { dot: true })
          ))
    );
  }
}
