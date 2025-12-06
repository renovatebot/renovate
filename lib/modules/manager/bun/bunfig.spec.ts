import { parseBunfigToml, resolveRegistryUrl } from './bunfig';

describe('modules/manager/bun/bunfig', () => {
  describe('parseBunfigToml', () => {
    it('returns null for invalid TOML', () => {
      expect(parseBunfigToml('invalid toml {')).toBeNull();
    });

    it('returns empty config for empty TOML', () => {
      expect(parseBunfigToml('')).toEqual({});
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

    it('parses registry object with url', () => {
      const toml = `
[install]
registry = { url = "https://registry.example.com", token = "abc123" }
`;
      expect(parseBunfigToml(toml)).toEqual({
        install: {
          registry: {
            url: 'https://registry.example.com',
            token: 'abc123',
          },
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
            otherorg: {
              url: 'https://registry.other.com',
              token: 'secret',
            },
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

    it('returns default registry object url for unscoped package', () => {
      const config = {
        install: {
          registry: {
            url: 'https://registry.example.com',
            token: 'abc',
          },
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

    it('returns scoped registry object url for scoped package', () => {
      const config = {
        install: {
          scopes: {
            myorg: {
              url: 'https://registry.myorg.com',
              token: 'secret',
            },
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
