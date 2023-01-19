import { loadConfigFromYarnrcYml, resolveRegistryUrl } from './yarnrc';

describe('modules/datasource/npm/yarnrc', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('resolveRegistryUrl()', () => {
    it('considers default registry', () => {
      const registryUrl = resolveRegistryUrl('a-package', {
        npmRegistryServer: 'https://private.example.com/npm',
      });
      expect(registryUrl).toBe('https://private.example.com/npm');
    });

    it('chooses matching scoped registry over default registry', () => {
      const registryUrl = resolveRegistryUrl('@scope/a-package', {
        npmRegistryServer: 'https://private.example.com/npm',
        npmScopes: {
          scope: {
            npmRegistryServer: 'https://scope.example.com/npm',
          },
        },
      });
      expect(registryUrl).toBe('https://scope.example.com/npm');
    });

    it('ignores non matching scoped registry', () => {
      const registryUrl = resolveRegistryUrl('@scope/a-package', {
        npmScopes: {
          'other-scope': {
            npmRegistryServer: 'https://other-scope.example.com/npm',
          },
        },
      });
      expect(registryUrl).toBeNull();
    });
  });

  describe('loadConfigFromYarnrcYml()', () => {
    it('reads valid file', () => {
      const res = loadConfigFromYarnrcYml(
        `npmRegistryServer: https://private.example.com/npm
npmScopes:
  foo:
    npmRegistryServer: https://private.example.com/npm-foo
  bar:
    npmRegistryServer: https://private.example.com/npm-bar`
      );

      expect(res).toEqual({
        npmRegistryServer: 'https://private.example.com/npm',
        npmScopes: {
          foo: {
            npmRegistryServer: 'https://private.example.com/npm-foo',
          },
          bar: {
            npmRegistryServer: 'https://private.example.com/npm-bar',
          },
        },
      });
    });

    it.each([
      [
        'malformed json',
        `npmRegistryServer: https://private.example.com/npm
      invalidIndent: true
      `,
      ],
      ['npmRegistryServer not a string', 'npmRegistryServer: 42'],
      ['npmScopes not an object', 'npmScopes: 42'],
      [
        'npmScopes/foo not an object',
        `
npmScopes:
  foo: 42
      `,
      ],
      [
        'npmScopes/foo/npmRegistryServer not a string',
        `
npmScopes:
  foo:
    npmRegistryServer: 42
      `,
      ],
    ])('ignores invalid file (%s)', (_, yarnrcYml) => {
      const res = loadConfigFromYarnrcYml(yarnrcYml);

      expect(res).toBeNull();
    });
  });
});
