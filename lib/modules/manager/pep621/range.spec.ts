import { getRangeStrategy as getManagerRangeStrategy } from '../index.ts';
import type { RangeConfig } from '../types.ts';
import { getRangeStrategy } from './index.ts';

describe('modules/manager/pep621/range', () => {
  it('defaults to replace', () => {
    const config: RangeConfig = { rangeStrategy: 'auto' };
    expect(getRangeStrategy(config)).toBe('replace');
  });

  it('returns update-lockfile for in-range-only', () => {
    const config: RangeConfig = { rangeStrategy: 'in-range-only' };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('returns same otherwise', () => {
    const config: RangeConfig = { rangeStrategy: 'update-lockfile' };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('keeps replace as the manager default', () => {
    const config: RangeConfig = { manager: 'pep621', rangeStrategy: 'auto' };
    expect(getManagerRangeStrategy(config)).toBe('replace');
  });
});
