const { extractDependencies } = require('../../../lib/manager/bazel/extract');

describe('lib/manager/bazel/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty if fails to pass', () => {
      const res = extractDependencies('blahhhhh:foo:@what\n', config);
      expect(res).toEqual([]);
    });
    it('returns empty if cannot parse dependency', () => {
      const res = extractDependencies(
        'git_repository(\n  nothing\n)\n',
        config
      );
      expect(res).toEqual([]);
    });
  });
});
