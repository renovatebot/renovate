const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/poetry/extract');

const pyproject1toml = fs.readFileSync(
  'test/datasource/poetry/_fixtures/pyproject.1.toml',
  'utf8'
);

describe('lib/manager/poetry/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(pyproject1toml, config);
      expect(res.deps).toMatchSnapshot();
      // expect(res.deps).toHaveLength(6);
    });
  });
});
