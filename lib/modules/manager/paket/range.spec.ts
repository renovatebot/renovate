import type { RangeConfig } from '../types.ts';
import { getRangeStrategy } from './range.ts';

describe('modules/manager/paket/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'pin' };
    expect(getRangeStrategy(config)).toBe('pin');
  });

  it('defaults to update-lockfile', () => {
    const config: RangeConfig = { rangeStrategy: 'auto' };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('returns update-lockfile if rangeStrategy is not defined', () => {
    const config: RangeConfig = {};
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });
});
