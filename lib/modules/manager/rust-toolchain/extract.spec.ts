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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: '1.89.1' } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: '1.89' } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: '1.89.1' } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 0,
          constraints: { rust: { depName: 'rust', value: '1.89.1' } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 1,
          constraints: { rust: { depName: 'rust', value: '1.89.1' } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 1,
          constraints: { rust: { depName: 'rust', value: '1.89.1' } },
        },
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
        sharedConstraintsScope: {
          directory: '',
          precedence: 1,
          constraints: { rust: { depName: 'rust', value: null } },
        },
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

    describe('shared constraints', () => {
      it.each`
        file                                | channel      | precedence
        ${'crates/foo/rust-toolchain.toml'} | ${'1.100.0'} | ${0}
        ${'crates/foo/rust-toolchain'}      | ${'1.100'}   | ${1}
      `(
        'shares $channel from $file with its directory',
        ({ file, channel, precedence }) => {
          const content = file.endsWith('.toml')
            ? `[toolchain]\nchannel = "${channel}"`
            : channel;

          const result = extractPackageFile(content, file);

          expect(result?.sharedConstraintsScope).toEqual({
            directory: 'crates/foo',
            precedence,
            constraints: { rust: { depName: 'rust', value: channel } },
          });
        },
      );

      it.each`
        file                                | content
        ${'rust-toolchain.toml'}            | ${'[toolchain]\nchannel = "1.100.0.1"'}
        ${'fuzz/rust-toolchain.toml'}       | ${'[toolchain]\nchannel = "nightly"'}
        ${'fuzz/rust-toolchain'}            | ${'stable'}
        ${'fuzz/rust-toolchain'}            | ${'nightly-2025-10-12'}
        ${'rust-toolchain'}                 | ${'1.100.0-beta.1'}
        ${'rust-toolchain'}                 | ${'1.100.0-x86_64-unknown-linux-gnu'}
        ${'rust-toolchain'}                 | ${'1.100-beta'}
        ${'rust-toolchain'}                 | ${'1.100.0-beta'}
        ${'rust-toolchain'}                 | ${'1.100-x86_64-unknown-linux-gnu'}
        ${'crates/foo/rust-toolchain.toml'} | ${'[toolchain]\npath = "/opt/rust"'}
      `('shares no Rust version for $content in $file', ({ file, content }) => {
        const result = extractPackageFile(content, file);

        expect(result?.sharedConstraintsScope?.constraints).toEqual({
          rust: { depName: 'rust', value: null },
        });
      });
    });
  });
});
