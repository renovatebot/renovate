import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class FilesMatcher extends Matcher {
  static readonly id: string = 'files';

  override matches(
    { packageFile, lockFiles }: PackageRuleInputConfig,
    { matchFiles }: PackageRule
  ): boolean | null {
    if (is.undefined(matchFiles) || is.undefined(packageFile)) {
      return null;
    }
    return matchFiles.some(
      (fileName) =>
        packageFile === fileName ||
        (is.array(lockFiles) && lockFiles?.includes(fileName))
    );
  }
}
