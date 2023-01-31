import { codeBlock } from 'common-tags';
import { loadConfigFromYarnrcYml, resolveRegistryUrl } from './yarnrc';

describe('modules/manager/npm/extract/yarnrc', () => {
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

    it('ignores partial scope match', () => {
      const registryUrl = resolveRegistryUrl('@scope-2/a-package', {
        npmScopes: {
          scope: {
            npmRegistryServer: 'https://scope.example.com/npm',
          },
        },
      });
      expect(registryUrl).toBeNull();
    });
  });

  describe('loadConfigFromYarnrcYml()', () => {
    it.each([
      [
        'npmRegistryServer: https://npm.example.com',
        { npmRegistryServer: 'https://npm.example.com' },
      ],
      [
        codeBlock`
          npmRegistryServer: https://npm.example.com
          npmScopes:
            foo:
              npmRegistryServer: https://npm-foo.example.com
        `,
        {
          npmRegistryServer: 'https://npm.example.com',
          npmScopes: {
            foo: {
              npmRegistryServer: 'https://npm-foo.example.com',
            },
          },
        },
      ],
      [
        codeBlock`
          npmRegistryServer: https://npm.example.com
          nodeLinker: pnp
        `,
        { npmRegistryServer: 'https://npm.example.com' },
      ],
      ['npmRegistryServer: 42', null],
      ['npmScopes: 42', null],
      [
        codeBlock`
          npmScopes:
            foo: 42
        `,
        null,
      ],
      [
        codeBlock`
          npmScopes:
            foo:
              npmRegistryServer: 42
        `,
        null,
      ],
    ])('produces expected config (%s)', (yarnrcYml, expectedConfig) => {
      const config = loadConfigFromYarnrcYml(yarnrcYml);

      expect(config).toEqual(expectedConfig);
    });
  });
});
