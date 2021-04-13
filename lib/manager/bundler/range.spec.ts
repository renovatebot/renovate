import { getName } from '../../../test/util';
import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe(getName(__filename), () => {
  describe('getRangeStrategy()', () => {
    it('returns replace when rangeStrategy is auto', () => {
      const config: RangeConfig = { rangeStrategy: 'auto' };
      expect(getRangeStrategy(config)).toEqual('replace');
    });
    it('returns the config value when rangeStrategy is different than auto', () => {
      const config: RangeConfig = { rangeStrategy: 'update-lockfile' };
      expect(getRangeStrategy(config)).toEqual('update-lockfile');
    });
  });
});
