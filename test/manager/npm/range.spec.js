const { getRangeStrategy } = require('../../../lib/manager/npm');

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('pins devDependencies', () => {
    const config = { rangeStrategy: 'auto', depType: 'devDependencies' };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('pins app dependencies', () => {
    const config = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
      packageJsonType: 'app',
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('widens peerDependencies', () => {
    const config = { rangeStrategy: 'auto', depType: 'peerDependencies' };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('widens complex ranges', () => {
    const config = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('widens complex bump', () => {
    const config = {
      rangeStrategy: 'bump',
      depType: 'dependencies',
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('defaults to replace', () => {
    const config = { rangeStrategy: 'auto', depType: 'dependencies' };
    expect(getRangeStrategy(config)).toEqual('replace');
  });
});
