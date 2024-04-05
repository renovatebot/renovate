import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class DatasourcesMatcher extends Matcher {
  override matches(
    { datasource }: PackageRuleInputConfig,
    { matchDatasources }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchDatasources)) {
      return null;
    }
    if (is.undefined(datasource)) {
      return false;
    }
    return matchDatasources.includes(datasource);
  }
}
