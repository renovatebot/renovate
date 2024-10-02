import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { tokenize } from './tokenize';
import { parse } from './parse';
import { evaluate } from './evaluate';
import { Matcher } from '../base';
import { PackageRule, PackageRuleInputConfig } from '../../../config/types';

export function match(input: string, data: unknown): boolean {
  if (!is.plainObject(data)) {
    return false;
  }
  try {
    const tokensList = tokenize(input);
    const ast = parse(tokensList);
    return evaluate(ast, data);
  } catch (err) {
    logger.debug({ err }, 'Error while matching package rule');
    return false;
  }
}

export class MatchMatcher extends Matcher {
  override matches(
    config: PackageRuleInputConfig,
    { match: matchInput }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchInput)) {
      return null;
    }

    return match(matchInput, config);
  }
}
