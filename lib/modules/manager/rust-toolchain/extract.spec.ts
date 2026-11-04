import { codeBlock } from 'common-tags';
import { logger } from '~test/util.ts';
import { RustVersionDatasource } from '../../datasource/rust-version/index.ts';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/rust-toolchain/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts major.minor.patch versions', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = "1.89.1"
        `,
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
        codeBlock`
          [toolchain]
          channel = "1.89"
        `,
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

    it('extracts stable channel', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = "stable"
        `,
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: 'stable',
            datasource: RustVersionDatasource.id,
          },
        ],
      });
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('extracts beta channel', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = "beta"
        `,
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
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('extracts nightly channel', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = "nightly"
        `,
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
        codeBlock`
          [toolchain]
          channel = "nightly-2025-10-12"
        `,
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
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns null when [toolchain] section is absent', () => {
      const result = extractPackageFile(
        'channel = "1.89.1"\n',
        'rust-toolchain.toml',
      );
      expect(result).toBeNull();
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns dep with unspecified-version skipReason when channel is absent', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          components = ["rustfmt"]
        `,
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            datasource: RustVersionDatasource.id,
            skipReason: 'unspecified-version',
          },
        ],
      });
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns dep with unspecified-version skipReason for empty channel', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = ""
        `,
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            datasource: RustVersionDatasource.id,
            skipReason: 'unspecified-version',
          },
        ],
      });
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns dep with path-dependency skipReason when only path is set', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          path = "/path/to/toolchain"
        `,
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            datasource: RustVersionDatasource.id,
            skipReason: 'path-dependency',
          },
        ],
      });
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('prefers channel over path when both are set', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = "1.89.1"
          path = "/path/to/toolchain"
        `,
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
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns dep with invalid-version skipReason for unparseable channel value', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = "not-a-rust-channel"
        `,
        'rust-toolchain.toml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: 'not-a-rust-channel',
            datasource: RustVersionDatasource.id,
            skipReason: 'invalid-version',
          },
        ],
      });
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('can handle additional fields', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = "1.89.1"
          components = ["rustfmt", "clippy"]
          targets = ["wasm32-unknown-unknown"]
        `,
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
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('can read from legacy filename', () => {
      const result = extractPackageFile(
        codeBlock`
          [toolchain]
          channel = "1.89.1"
        `,
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
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns null for empty legacy file', () => {
      const result = extractPackageFile('', 'rust-toolchain');
      expect(result).toBeNull();
      expect(logger.logger.warn).not.toHaveBeenCalled();
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
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns dep with invalid-version skipReason for legacy file with a single garbage line', () => {
      const result = extractPackageFile(
        'not-a-rust-channel\n',
        'rust-toolchain',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'rust',
            depType: 'toolchain',
            currentValue: 'not-a-rust-channel',
            datasource: RustVersionDatasource.id,
            skipReason: 'invalid-version',
          },
        ],
      });
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns null for multiline legacy files', () => {
      const result = extractPackageFile(
        codeBlock`
          1.89.1
          extra line
          another line
        `,
        'rust-toolchain',
      );
      expect(result).toBeNull();
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });
  });
});
