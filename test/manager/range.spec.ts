import { getRangeStrategy } from '../../lib/manager';
import { RangeConfig } from '../../lib/manager/common';
import { MANAGER_CIRCLE_CI, MANAGER_NPM } from '../../lib/constants/managers';
import { DEP_TYPE_DEPENDENCIES } from '../../lib/constants/dependency';

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = {
      manager: MANAGER_NPM,
      rangeStrategy: 'widen',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('returns manager strategy', () => {
    const config: RangeConfig = {
      manager: MANAGER_NPM,
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEPENDENCIES,
      packageJsonType: 'app',
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('defaults to replace', () => {
    const config: RangeConfig = {
      manager: MANAGER_CIRCLE_CI,
      rangeStrategy: 'auto',
    };
    expect(getRangeStrategy(config)).toEqual('replace');
  });
  it('returns rangeStrategy if not auto', () => {
    const config: RangeConfig = {
      manager: MANAGER_CIRCLE_CI,
      rangeStrategy: 'future',
    };
    expect(getRangeStrategy(config)).toEqual('future');
  });
});
