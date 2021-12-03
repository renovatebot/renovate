import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('manager/pip_requirements/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });
  it('pins if auto', () => {
    const config: RangeConfig = { rangeStrategy: 'auto' };
    expect(getRangeStrategy(config)).toBe('pin');
  });
});
