import { minimatch } from './minimatch';

describe('util/minimatch', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('caches minimatch', () => {
    expect(minimatch('foo')).toBe(minimatch('foo'));
  });

  it('does not cache minimatch', () => {
    expect(minimatch('foo', {}, false)).not.toBe(minimatch('foo', {}, false));
  });
});
