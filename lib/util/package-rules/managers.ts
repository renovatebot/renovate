import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class ManagersMatcher extends Matcher {
  override matches(
    { manager }: PackageRuleInputConfig,
    { matchManagers }: PackageRule
  ): boolean | null {
    if (is.undefined(matchManagers)) {
      return null;
    }
    if (is.undefined(manager) || !manager) {
      return false;
    }

    let modifiedMatchManagers: string[];
    if (is.string(matchManagers)) {
      modifiedMatchManagers = [matchManagers.replace('custom.', '')];
    } else {
      modifiedMatchManagers = matchManagers.map((m) =>
        m.replace('custom.', '')
      );
    }

    return modifiedMatchManagers.includes(manager);
  }
}
