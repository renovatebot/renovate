import { Fixtures } from '../../../../test/fixtures';
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
    it.each([
      [
        'registry-only.yarnrc.yml',
        {
          npmRegistryServer: 'https://private.example.com/npm',
        },
      ],
      [
        'multiple-scopes.yarnrc.yml',
        {
          npmRegistryServer: 'https://private.example.com/npm',
          npmScopes: {
            foo: {
              npmRegistryServer: 'https://private.example.com/npm-foo',
            },
            bar: {
              npmRegistryServer: 'https://private.example.com/npm-bar',
            },
          },
        },
      ],
      ['malformed.yarnrc.yml', null],
      ['registry-not-a-string.yarnrc.yml', null],
      ['scoped-registry-not-a-string.yarnrc.yml', null],
      ['scopes-not-an-object.yarnrc.yml', null],
      ['single-scope-not-an-object.yarnrc.yml', null],
    ])('produces expected config (%s)', (yarnrcFile, expectedConfig) => {
      const config = loadConfigFromYarnrcYml(Fixtures.get(yarnrcFile));

      expect(config).toEqual(expectedConfig);
    });
  });
});
