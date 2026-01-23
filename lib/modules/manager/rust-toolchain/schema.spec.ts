import { RustToolchain } from './schema';

describe('modules/manager/rust-toolchain/schema', () => {
  describe('RustToolchain', () => {
    it('parses valid TOML with channel', () => {
      const toml = `
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
      const toml = `
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
      const toml = `
[other]
channel = "1.89.1"
`;

      expect(() => RustToolchain.parse(toml)).toThrow();
    });

    it('throws error for missing channel field', () => {
      const toml = `
[toolchain]
components = ["rustfmt"]
`;

      expect(() => RustToolchain.parse(toml)).toThrow();
    });

    it('throws error for non-string channel', () => {
      const toml = `
[toolchain]
channel = 123
`;

      expect(() => RustToolchain.parse(toml)).toThrow();
    });

    it('parses nightly channel', () => {
      const toml = `
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
      const toml = `
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
