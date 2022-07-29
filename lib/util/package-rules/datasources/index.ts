import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class DatasourcesMatcher extends Matcher {
  static readonly id: string = 'datasources';

  override matches(
    { datasource }: PackageRuleInputConfig,
    { matchDatasources }: PackageRule
  ): boolean | null {
    if (is.undefined(matchDatasources) || is.undefined(datasource)) {
      return null;
    }
    return matchDatasources.includes(datasource);
  }
}
