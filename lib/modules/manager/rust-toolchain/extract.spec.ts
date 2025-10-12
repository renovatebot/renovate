import { RustVersionDatasource } from '../../datasource/rust-version/index.ts';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/rust-toolchain/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts major.minor.patch versions', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "1.89.1"',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: '1.89.1',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
    });

    it('extracts major.minor ranges', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "1.89"',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: '1.89',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
    });

    it('extracts beta channel', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "beta"',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: 'beta',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
    });

    it('extracts nightly channel', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "nightly"',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: 'nightly',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
    });

    it('extracts dated nightly channel', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "nightly-2025-10-12"',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: 'nightly-2025-10-12',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
    });

    it('returns null for invalid TOML', () => {
      const result = extractPackageFile(
        'this is not valid toml [',
        'rust-toolchain.toml',
      );
      expect(result).toBeNull();
    });

    it('can handle additional fields', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "1.89.1"\ncomponents = ["rustfmt", "clippy"]\ntargets = ["wasm32-unknown-unknown"]\n',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: '1.89.1',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
    });

    it('can read from legacy filename', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "1.89.1"',
        'rust-toolchain',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: '1.89.1',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
    });

    it('returns null for empty legacy file', () => {
      const result = extractPackageFile('', 'rust-toolchain');
      expect(result).toBeNull();
    });

    it('extracts from legacy format', () => {
      const result = extractPackageFile('1.89.1\n', 'rust-toolchain');
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: '1.89.1',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
    });

    it('returns null for multiline legacy files', () => {
      const result = extractPackageFile(
        '1.89.1\nextra line\nanother line\n',
        'rust-toolchain',
      );
      expect(result).toBeNull();
    });
  });
});
