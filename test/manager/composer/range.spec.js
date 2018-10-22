const { getRangeStrategy } = require('../../../lib/manager/composer');

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('pins require-dev', () => {
    const config = { rangeStrategy: 'auto', depType: 'require-dev' };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('pins project require', () => {
    const config = {
      rangeStrategy: 'auto',
      composerJsonType: 'project',
      depType: 'require',
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('widens complex ranges', () => {
    const config = {
      rangeStrategy: 'auto',
      depType: 'require',
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('widens complex bump', () => {
    const config = {
      rangeStrategy: 'bump',
      depType: 'require',
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('defaults to replace', () => {
    const config = { rangeStrategy: 'auto', depType: 'require' };
    expect(getRangeStrategy(config)).toEqual('replace');
  });
});
