import { minimatch } from './minimatch';

describe('util/minimatch', () => {
  it('caches minimatch', () => {
    expect(minimatch('foo')).toBe(minimatch('foo'));
  });

  it('does not cache minimatch', () => {
    expect(minimatch('foo', {}, false)).not.toBe(minimatch('foo', {}, false));
    expect(minimatch('foo')).not.toBe(minimatch('foo', {}, false));
  });
});
