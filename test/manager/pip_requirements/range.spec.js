const { getRangeStrategy } = require('../../../lib/manager/pip_requirements');

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('pins if auto', () => {
    const config = { rangeStrategy: 'auto' };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
});
