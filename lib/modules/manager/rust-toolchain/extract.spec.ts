import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as rustToolchainVersioning from '../../versioning/rust-toolchain';
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

    it('returns null for nightly channel', () => {
      const result = extractPackageFile(
        '[toolchain]\nchannel = "nightly-2025-10-12"',
        'rust-toolchain.toml',
      );
      expect(result).toBeNull();
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
  });
});
