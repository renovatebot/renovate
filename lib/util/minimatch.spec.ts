import { minimatch } from './minimatch';

describe('util/minimatch', () => {
  it('caches minimatch', () => {
    expect(minimatch('foo')).toBe(minimatch('foo'));
    expect(minimatch('foo', { dot: true })).toBe(
      minimatch('foo', { dot: true }),
    );
  });

  it('does not cache minimatch', () => {
    expect(minimatch('foo', undefined, false)).not.toBe(
      minimatch('foo', undefined, false),
    );
    expect(minimatch('foo')).not.toBe(minimatch('foo', undefined, false));
    expect(minimatch('foo', { dot: true })).not.toBe(minimatch('foo'));
  });
});
