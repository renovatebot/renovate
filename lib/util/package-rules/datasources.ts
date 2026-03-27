import { isUndefined } from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { matchRegexOrGlobList } from '../string-match.ts';
import { Matcher } from './base.ts';

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
