import jsonata from 'jsonata';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { Matcher } from './base';

export class JsonataMatcher extends Matcher {
  override async matches(
    inputConfig: PackageRuleInputConfig,
    { matchJsonata }: PackageRule,
  ): Promise<boolean | null> {
    if (!matchJsonata) {
      return null;
    }

    let expression;
    try {
      expression = jsonata(matchJsonata);
    } catch (err) {
      logger.warn({ err }, 'Invalid JSONata expression');
      return false;
    }
    try {
      const result = await expression.evaluate(inputConfig);
      return Boolean(result);
    } catch (err) {
      logger.warn({ err }, 'Error evaluating JSONata expression');
      return false;
    }
  }
}
