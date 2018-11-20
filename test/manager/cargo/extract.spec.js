const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/cargo/extract');

const cargo1toml = fs.readFileSync('test/_fixtures/cargo/Cargo.1.toml', 'utf8');
const cargo2toml = fs.readFileSync('test/_fixtures/cargo/Cargo.2.toml', 'utf8');
const cargo3toml = fs.readFileSync('test/_fixtures/cargo/Cargo.3.toml', 'utf8');
const cargo4toml = fs.readFileSync('test/_fixtures/cargo/Cargo.4.toml', 'utf8');

describe('lib/manager/cargo/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(cargo1toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(5);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(cargo2toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(18 + 6 + 1);
    });
    it('handles inline tables', () => {
      const res = extractPackageFile(cargo3toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(7);
    });
    it('handles standard tables', () => {
      const res = extractPackageFile(cargo4toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
