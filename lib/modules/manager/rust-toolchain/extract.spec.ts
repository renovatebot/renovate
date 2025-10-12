import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { RustNightlyDatasource } from '../../datasource/rust-nightly';
import * as rustToolchainVersioning from '../../versioning/rust-toolchain';
import * as rustToolchainNightlyVersioning from '../../versioning/rust-toolchain-nightly';
import { extractPackageFile } from './extract';

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
            packageName: 'rust-lang/rust',
            currentValue: '1.89.1',
            datasource: GithubReleasesDatasource.id,
            versioning: rustToolchainVersioning.id,
          },
        ],
      });
    });

    it('extracts major.minor versions', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "1.89"',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            packageName: 'rust-lang/rust',
            currentValue: '1.89',
            datasource: GithubReleasesDatasource.id,
            versioning: rustToolchainVersioning.id,
          },
        ],
      });
    });

    it('returns null for beta channel', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "beta"',
        'rust-toolchain.toml',
      );
      expect(result).toBeNull();
    });

    it('extracts nightly channel', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "nightly"',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust-nightly',
            depType: 'toolchain',
            currentValue: 'nightly',
            datasource: RustNightlyDatasource.id,
            versioning: rustToolchainNightlyVersioning.id,
          },
        ],
      });
    });

    it('extracts pinned nightly versions', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "nightly-2025-10-12"',
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust-nightly',
            depType: 'toolchain',
            currentValue: 'nightly-2025-10-12',
            datasource: RustNightlyDatasource.id,
            versioning: rustToolchainNightlyVersioning.id,
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
            packageName: 'rust-lang/rust',
            currentValue: '1.89.1',
            datasource: GithubReleasesDatasource.id,
            versioning: rustToolchainVersioning.id,
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
            packageName: 'rust-lang/rust',
            currentValue: '1.89.1',
            datasource: GithubReleasesDatasource.id,
            versioning: rustToolchainVersioning.id,
          },
        ],
      });
    });

    it('returns null for empty legacy file', () => {
      const result = extractPackageFile('', 'rust-toolchain');
      expect(result).toBeNull();
    });

    it('extracts from legacy format', () => {
      const result = extractPackageFile('1.89.1', 'rust-toolchain');
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            packageName: 'rust-lang/rust',
            currentValue: '1.89.1',
            datasource: GithubReleasesDatasource.id,
            versioning: rustToolchainVersioning.id,
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
