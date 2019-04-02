const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/poetry/extract');

const pyproject1toml = fs.readFileSync(
  'test/manager/poetry/_fixtures/pyproject.1.toml',
  'utf8'
);

const pyproject2toml = fs.readFileSync(
  'test/manager/poetry/_fixtures/pyproject.2.toml',
  'utf8'
);

const pyproject3toml = fs.readFileSync(
  'test/manager/poetry/_fixtures/pyproject.3.toml',
  'utf8'
);

const pyproject4toml = fs.readFileSync(
  'test/manager/poetry/_fixtures/pyproject.4.toml',
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
      expect(res.deps).toHaveLength(8);
    });
    it('extracts multiple dependencies (with dep = {version = "1.2.3"} case)', () => {
      const res = extractPackageFile(pyproject2toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(7);
    });
    it('handles case with no dependencies', () => {
      const res = extractPackageFile(pyproject3toml, config);
      expect(res).toBeNull();
    });
    it('handles multiple constraint dependencies', () => {
      const res = extractPackageFile(pyproject4toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
  });
});
