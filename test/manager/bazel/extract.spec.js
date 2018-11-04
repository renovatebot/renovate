const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/bazel/extract');

const workspaceFile = fs.readFileSync(
  'test/_fixtures/bazel/WORKSPACE1',
  'utf8'
);

describe('lib/manager/bazel/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n', config);
      expect(res).toBe(null);
    });
    it('returns empty if cannot parse dependency', () => {
      const res = extractPackageFile('git_repository(\n  nothing\n)\n', config);
      expect(res).toBe(null);
    });
    it('extracts multiple types of dependencies', () => {
      const res = extractPackageFile(workspaceFile, config);
      expect(res.deps).toMatchSnapshot();
    });
  });
});
