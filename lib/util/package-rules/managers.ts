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
    if (matchManagers.includes(manager)) {
      return true;
    }
    // Special handling for npm, pnpm, yarn
    // allow matchManagers=npm to match even if manager is pnpm or yarn
    const alternativeNpmManagers = ['pnpm', 'yarn'];
    if (
      alternativeNpmManagers.includes(manager) &&
      matchManagers.includes('npm')
    ) {
      return true;
    }
    return false;
  }
}
