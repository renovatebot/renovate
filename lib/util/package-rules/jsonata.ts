import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import { getExpression } from '../jsonata';
import { Matcher } from './base';

export class JsonataMatcher extends Matcher {
  override async matches(
    inputConfig: PackageRuleInputConfig,
    { matchJsonata }: PackageRule,
  ): Promise<boolean | null> {
    if (!matchJsonata) {
      return null;
    }

    for (const expressionStr of matchJsonata) {
      const expression = getExpression(expressionStr);
      if (expression instanceof Error) {
        logger.warn(
          { errorMessage: expression.message },
          'Invalid JSONata expression',
        );
      } else {
        try {
          const result = await expression.evaluate(inputConfig);
          if (result) {
            // Only one needs to match, so return early
            return true;
          }
        } catch (err) {
          logger.warn({ err }, 'Error evaluating JSONata expression');
        }
      }
    }
    // None matched, so return false
    return false;
  }
}
