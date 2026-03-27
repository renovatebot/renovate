import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { logger } from '../../logger/index.ts';
import { getExpression } from '../jsonata.ts';
import { Matcher } from './base.ts';

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
