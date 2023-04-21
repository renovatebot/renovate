import { extractPackageFile } from '.';

describe('modules/manager/bazel-module/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n', 'MODULE.bazel');
      expect(res).toBeNull();
    });
  });
});
