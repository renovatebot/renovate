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

      expect(() => RustToolchain.parse(toml)).toThrow();
    });

    it('throws error for missing toolchain section', () => {
      const toml = codeBlock`
        [other]
        channel = "1.89.1"
      `;

      expect(() => RustToolchain.parse(toml)).toThrow();
    });

    it('throws error for missing channel field', () => {
      const toml = codeBlock`
        [toolchain]
        components = ["rustfmt"]
      `;

      expect(() => RustToolchain.parse(toml)).toThrow();
    });

    it('throws error for non-string channel', () => {
      const toml = codeBlock`
        [toolchain]
        channel = 123
      `;

      expect(() => RustToolchain.parse(toml)).toThrow();
    });

    it('throws error for empty channel', () => {
      const toml = codeBlock`
        [toolchain]
        channel = ""
      `;

      expect(() => RustToolchain.parse(toml)).toThrow();
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
