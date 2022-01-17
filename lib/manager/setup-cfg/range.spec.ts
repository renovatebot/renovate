import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('manager/setup-cfg/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });
  it('replaces if auto', () => {
    const config: RangeConfig = { rangeStrategy: 'auto' };
    expect(getRangeStrategy(config)).toBe('replace');
  });
});
