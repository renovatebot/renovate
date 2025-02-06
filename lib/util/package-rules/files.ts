import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { anyMatchRegexOrGlobList, matchRegexOrGlobList } from '../string-match';
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

    if (matchRegexOrGlobList(packageFile, matchFileNames)) {
      return true;
    }

    if (is.array(lockFiles)) {
      return anyMatchRegexOrGlobList(lockFiles, matchFileNames);
    }

    return false;
  }
}
