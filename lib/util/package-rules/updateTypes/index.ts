import is from '@sindresorhus/is';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../../config/types';
import { Matcher } from '../base';

export class UpdateTypesMatcher extends Matcher {
  static readonly id: string = 'update-types';

  override matches(
    { updateType, isBump }: PackageRuleInputConfig,
    { matchUpdateTypes }: PackageRule
  ): boolean | null {
    if (is.undefined(matchUpdateTypes) || is.undefined(isBump)) {
      return null;
    }
    return (
      (updateType && matchUpdateTypes.includes(updateType)) ||
      (isBump && matchUpdateTypes.includes('bump'))
    );
  }
}
