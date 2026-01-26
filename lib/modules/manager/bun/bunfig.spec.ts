import { parseBunfigToml, resolveRegistryUrl } from './bunfig';

describe('modules/manager/bun/bunfig', () => {
  describe('parseBunfigToml', () => {
    it('returns null for invalid TOML', () => {
      expect(parseBunfigToml('invalid toml {')).toBeNull();
    });

    it('returns empty config for empty TOML', () => {
      expect(parseBunfigToml('')).toEqual({});
    });

    it('returns null for valid TOML with invalid schema', () => {
      // Valid TOML but registry is not a string or valid object
      const toml = `
[install]
registry = 123
`;
      expect(parseBunfigToml(toml)).toBeNull();
    });

    it('parses simple string registry', () => {
      const toml = `
[install]
registry = "https://registry.example.com"
`;
      expect(parseBunfigToml(toml)).toEqual({
        install: {
          registry: 'https://registry.example.com',
        },
      });
    });

    it('parses registry object with url and extracts url', () => {
      const toml = `
[install]
registry = { url = "https://registry.example.com", token = "abc123" }
`;
      expect(parseBunfigToml(toml)).toEqual({
        install: {
          registry: 'https://registry.example.com',
        },
      });
    });

    it('parses scoped registries', () => {
      const toml = `
[install.scopes]
myorg = "https://registry.myorg.com"
`;
      expect(parseBunfigToml(toml)).toEqual({
        install: {
          scopes: {
            myorg: 'https://registry.myorg.com',
          },
        },
      });
    });

    it('parses mixed default and scoped registries', () => {
      const toml = `
[install]
registry = "https://registry.example.com"

[install.scopes]
myorg = "https://registry.myorg.com"
otherorg = { url = "https://registry.other.com", token = "secret" }
`;
      expect(parseBunfigToml(toml)).toEqual({
        install: {
          registry: 'https://registry.example.com',
          scopes: {
            myorg: 'https://registry.myorg.com',
            otherorg: 'https://registry.other.com',
          },
        },
      });
    });

    it('ignores unrelated TOML sections', () => {
      const toml = `
[run]
shell = "zsh"

[install]
registry = "https://registry.example.com"
`;
      expect(parseBunfigToml(toml)).toEqual({
        install: {
          registry: 'https://registry.example.com',
        },
      });
    });
  });

  describe('resolveRegistryUrl', () => {
    it('returns null when no install config', () => {
      expect(resolveRegistryUrl('dep', {})).toBeNull();
    });

    it('returns null when no registry configured', () => {
      expect(resolveRegistryUrl('dep', { install: {} })).toBeNull();
    });

    it('returns default registry for unscoped package', () => {
      const config = {
        install: {
          registry: 'https://registry.example.com',
        },
      };
      expect(resolveRegistryUrl('lodash', config)).toBe(
        'https://registry.example.com',
      );
    });

    it('returns default registry for unscoped package with object config', () => {
      // After schema transform, registry is always a string URL
      const config = {
        install: {
          registry: 'https://registry.example.com',
        },
      };
      expect(resolveRegistryUrl('lodash', config)).toBe(
        'https://registry.example.com',
      );
    });

    it('returns scoped registry for scoped package', () => {
      const config = {
        install: {
          registry: 'https://registry.example.com',
          scopes: {
            myorg: 'https://registry.myorg.com',
          },
        },
      };
      expect(resolveRegistryUrl('@myorg/utils', config)).toBe(
        'https://registry.myorg.com',
      );
    });

    it('returns scoped registry for scoped package with object config', () => {
      // After schema transform, scoped registries are always string URLs
      const config = {
        install: {
          scopes: {
            myorg: 'https://registry.myorg.com',
          },
        },
      };
      expect(resolveRegistryUrl('@myorg/utils', config)).toBe(
        'https://registry.myorg.com',
      );
    });

    it('falls back to default registry for unmatched scope', () => {
      const config = {
        install: {
          registry: 'https://registry.example.com',
          scopes: {
            myorg: 'https://registry.myorg.com',
          },
        },
      };
      expect(resolveRegistryUrl('@other/pkg', config)).toBe(
        'https://registry.example.com',
      );
    });

    it('returns null for unmatched scope with no default', () => {
      const config = {
        install: {
          scopes: {
            myorg: 'https://registry.myorg.com',
          },
        },
      };
      expect(resolveRegistryUrl('@other/pkg', config)).toBeNull();
    });

    it('handles scope with @ prefix in config', () => {
      const config = {
        install: {
          scopes: {
            '@myorg': 'https://registry.myorg.com',
          },
        },
      };
      expect(resolveRegistryUrl('@myorg/utils', config)).toBe(
        'https://registry.myorg.com',
      );
    });
  });
});
