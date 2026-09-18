import type { RangeConfig } from '../types.ts';
import { getRangeStrategy } from './index.ts';

describe('modules/manager/puppet/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'pin' };
    expect(getRangeStrategy(config)).toBe('pin');
  });

  it('widens metadata.json dependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
      currentValue: '>= 9.0.0 < 10.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('replaces Puppetfile modules', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      currentValue: '9.0.0',
    };
    expect(getRangeStrategy(config)).toBe('replace');
  });
});
