import { minimatch } from './minimatch';

describe('util/minimatch', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('caches minimatch', () => {
    expect(minimatch('foo')).toBe(minimatch('foo'));
    expect(minimatch('foo', { debug: true })).toBe(
      minimatch('foo', { debug: true })
    );
  });

  it('does not cache minimatch', () => {
    expect(minimatch('foo', undefined, false)).not.toBe(
      minimatch('foo', undefined, false)
    );
    expect(minimatch('foo')).not.toBe(minimatch('foo', undefined, false));
    expect(minimatch('foo', { dot: true })).not.toBe(minimatch('foo'));
  });
});
