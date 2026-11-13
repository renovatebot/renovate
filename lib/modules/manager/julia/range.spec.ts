import type { RangeConfig } from '../types.ts';
import { getRangeStrategy } from './index.ts';

describe('modules/manager/julia/range', () => {
  it('returns the configured strategy', () => {
    const config: RangeConfig = { rangeStrategy: 'bump' };

    expect(getRangeStrategy(config)).toBe('bump');
  });

  it('widens by default', () => {
    const config: RangeConfig = { rangeStrategy: 'auto' };

    expect(getRangeStrategy(config)).toBe('widen');
  });
});
