import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class DepPatternsMatcher extends Matcher {
  override matches(
    { depName }: PackageRuleInputConfig,
    { matchDepPatterns }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchDepPatterns)) {
      return null;
    }

    if (is.undefined(depName)) {
      return false;
    }

    const massagedPatterns = matchDepPatterns.map((pattern) =>
      pattern === '^*$' || pattern === '*' ? '*' : `/${pattern}/`,
    );
    return matchRegexOrGlobList(depName, massagedPatterns);
  }

  override excludes(
    { depName }: PackageRuleInputConfig,
    { excludeDepPatterns }: PackageRule,
  ): boolean | null {
    if (is.undefined(excludeDepPatterns)) {
      return null;
    }
    if (is.undefined(depName)) {
      return false;
    }

    const massagedPatterns = excludeDepPatterns.map((pattern) =>
      pattern === '^*$' || pattern === '*' ? '*' : `/${pattern}/`,
    );
    return matchRegexOrGlobList(depName, massagedPatterns);
  }
}
