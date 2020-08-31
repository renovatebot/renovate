import { coerceBranchConfig } from './coerce';

describe('workers/coerce', () => {
  it('nullify empty', () => {
    const config = {};
    expect(coerceBranchConfig(config)).toEqual({
      recreateClosed: null,
    });
  });
  it('preserve undefined', () => {
    const config = {
      recreateClosed: undefined,
    };
    expect(coerceBranchConfig(config)).toEqual(config);
  });
  it('success', () => {
    const config = {
      foo: 'foo',
      bar: 42,
    };
    expect(coerceBranchConfig(config)).toEqual({
      ...config,
      recreateClosed: null,
    });
  });
  it('error', () => {
    const config = {
      foo: 'bar',
      recreateClosed: 'should be a boolean',
    };
    expect(coerceBranchConfig(config)).toEqual(config);
  });
});
