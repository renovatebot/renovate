import { RangeConfig } from '../common';
import { getRangeStrategy } from '.';

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('replaces if auto', () => {
    const config: RangeConfig = { rangeStrategy: 'auto' };
    expect(getRangeStrategy(config)).toEqual('replace');
  });
});
