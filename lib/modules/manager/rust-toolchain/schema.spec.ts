import { codeBlock } from 'common-tags';
import { RustToolchain } from './schema.ts';

describe('modules/manager/rust-toolchain/schema', () => {
  describe('RustToolchain', () => {
    it('parses valid TOML with channel', () => {
      const toml = codeBlock`
        [toolchain]
        channel = "1.89.1"
      `;

      const result = RustToolchain.parse(toml);

      expect(result).toEqual({
        toolchain: {
          channel: '1.89.1',
        },
      });
    });

    it('parses TOML with additional fields', () => {
      const toml = codeBlock`
        [toolchain]
        channel = "1.89.1"
        components = ["rustfmt", "clippy"]
        targets = ["wasm32-unknown-unknown"]
      `;

      const result = RustToolchain.parse(toml);

      expect(result).toEqual({
        toolchain: {
          channel: '1.89.1',
        },
      });
    });

    it('throws error for invalid TOML', () => {
      const toml = 'this is not valid toml [';

      expect(() => RustToolchain.parse(toml)).toThrow('Invalid TOML');
    });

    it('throws error for missing toolchain section', () => {
      const toml = codeBlock`
        [other]
        channel = "1.89.1"
      `;

      expect(() => RustToolchain.parse(toml)).toThrow(
        'Invalid input: expected object, received undefined',
      );
    });

    it('parses successfully when channel field is missing', () => {
      const toml = codeBlock`
        [toolchain]
        components = ["rustfmt"]
      `;

      const result = RustToolchain.parse(toml);

      expect(result).toEqual({
        toolchain: {},
      });
    });

    it('throws error for non-string channel', () => {
      const toml = codeBlock`
        [toolchain]
        channel = 123
      `;

      expect(() => RustToolchain.parse(toml)).toThrow(
        'Invalid input: expected string, received number',
      );
    });

    it('parses successfully for empty channel', () => {
      const toml = codeBlock`
        [toolchain]
        channel = ""
      `;

      const result = RustToolchain.parse(toml);

      expect(result).toEqual({
        toolchain: {
          channel: '',
        },
      });
    });

    it('parses TOML with path', () => {
      const toml = codeBlock`
        [toolchain]
        path = "/path/to/toolchain"
      `;

      const result = RustToolchain.parse(toml);

      expect(result).toEqual({
        toolchain: {
          path: '/path/to/toolchain',
        },
      });
    });

    it('parses TOML with both channel and path', () => {
      const toml = codeBlock`
        [toolchain]
        channel = "1.89.1"
        path = "/path/to/toolchain"
      `;

      const result = RustToolchain.parse(toml);

      expect(result).toEqual({
        toolchain: {
          channel: '1.89.1',
          path: '/path/to/toolchain',
        },
      });
    });

    it('parses nightly channel', () => {
      const toml = codeBlock`
        [toolchain]
        channel = "nightly-2025-10-12"
      `;

      const result = RustToolchain.parse(toml);

      expect(result).toEqual({
        toolchain: {
          channel: 'nightly-2025-10-12',
        },
      });
    });

    it('parses stable keyword', () => {
      const toml = codeBlock`
        [toolchain]
        channel = "stable"
      `;

      const result = RustToolchain.parse(toml);

      expect(result).toEqual({
        toolchain: {
          channel: 'stable',
        },
      });
    });
  });
});
