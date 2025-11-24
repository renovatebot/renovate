import { isUndefined } from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { matchRegexOrGlobList } from '../string-match';
import { Matcher } from './base';

export class DatasourcesMatcher extends Matcher {
  override matches(
    { datasource }: PackageRuleInputConfig,
    { matchDatasources }: PackageRule,
  ): boolean | null {
    if (isUndefined(matchDatasources)) {
      return null;
    }
    if (isUndefined(datasource)) {
      return false;
    }
    return matchRegexOrGlobList(datasource, matchDatasources);
  }
}
