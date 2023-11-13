import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class UpdateTypesMatcher extends Matcher {
  override matches(
    { updateType, isBump }: PackageRuleInputConfig,
    { matchUpdateTypes }: PackageRule,
  ): boolean | null {
    if (is.undefined(matchUpdateTypes)) {
      return null;
    }
    return (
      (is.truthy(updateType) && matchUpdateTypes.includes(updateType)) ||
      (is.truthy(isBump) && matchUpdateTypes.includes('bump'))
    );
  }
}
