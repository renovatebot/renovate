import jsonata from 'jsonata';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class JsonataMatcher extends Matcher {
  override matches(
    inputConfig: PackageRuleInputConfig,
    { matchJsonata }: PackageRule,
  ): boolean | null {
    if (!matchJsonata) {
      return null;
    }

    try {
      const expression = jsonata(matchJsonata);
      const result = expression.evaluate(inputConfig);
      return Boolean(result);
    } catch (error) {
      return false;
    }
  }
}
