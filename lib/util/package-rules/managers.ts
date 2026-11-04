import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { isCustomManager } from '../../modules/manager/custom/index.ts';
import { matchRegexOrGlobList } from '../string-match.ts';
import { Matcher } from './base.ts';

export class ManagersMatcher extends Matcher {
  override matches(
    { manager, customName }: PackageRuleInputConfig,
    { matchManagers }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchManagers)) {
      return null;
    }
    if (isUndefined(manager) || !manager) {
      return false;
    }
    if (isCustomManager(manager)) {
      const customManager = `custom.${manager}`;
      if (!customName) {
        return matchRegexOrGlobList(customManager, matchManagers);
      }
      // A named custom manager is matched as `custom.<type>.<customName>`, while
      // `custom.<type>` keeps matching all custom managers of that type.
      const namedCustomManager = `${customManager}.${customName}`;
      const patterns = matchManagers.map((pattern) => {
        if (pattern === customManager) {
          return namedCustomManager;
        }
        if (pattern === `!${customManager}`) {
          return `!${namedCustomManager}`;
        }
        return pattern;
      });
      return matchRegexOrGlobList(namedCustomManager, patterns);
    }
    return matchRegexOrGlobList(manager, matchManagers);
  }
}
