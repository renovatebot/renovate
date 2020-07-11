import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const cargo1toml = readFileSync(
  'lib/manager/cargo/__fixtures__/Cargo.1.toml',
  'utf8'
);
const cargo2toml = readFileSync(
  'lib/manager/cargo/__fixtures__/Cargo.2.toml',
  'utf8'
);
const cargo3toml = readFileSync(
  'lib/manager/cargo/__fixtures__/Cargo.3.toml',
  'utf8'
);
const cargo4toml = readFileSync(
  'lib/manager/cargo/__fixtures__/Cargo.4.toml',
  'utf8'
);
const cargo5toml = readFileSync(
  'lib/manager/cargo/__fixtures__/Cargo.5.toml',
  'utf8'
);

describe('lib/manager/cargo/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for invalid toml', () => {
      expect(extractPackageFile('invalid toml', config)).toBeNull();
    });
    it('returns null for empty dependencies', () => {
      const cargotoml = '[dependencies]\n';
      expect(extractPackageFile(cargotoml, config)).toBeNull();
    });
    it('returns null for empty dev-dependencies', () => {
      const cargotoml = '[dev-dependencies]\n';
      expect(extractPackageFile(cargotoml, config)).toBeNull();
    });
    it('returns null for empty custom target', () => {
      const cargotoml = '[target."foo".dependencies]\n';
      expect(extractPackageFile(cargotoml, config)).toBeNull();
    });
    it('extracts multiple dependencies simple', () => {
      const res = extractPackageFile(cargo1toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(15);
    });
    it('extracts multiple dependencies advanced', () => {
      const res = extractPackageFile(cargo2toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(18 + 6 + 1);
    });
    it('handles inline tables', () => {
      const res = extractPackageFile(cargo3toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(8);
    });
    it('handles standard tables', () => {
      const res = extractPackageFile(cargo4toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
    it('extracts platform specific dependencies', () => {
      const res = extractPackageFile(cargo5toml, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
