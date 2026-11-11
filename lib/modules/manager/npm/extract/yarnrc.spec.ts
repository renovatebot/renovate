import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import {
  loadConfigFromInheritedYarnrcYml,
  loadConfigFromLegacyYarnrc,
  loadConfigFromYarnrcYml,
  mergeYarnConfigs,
  resolveRegistryUrl,
} from './yarnrc.ts';

vi.mock('../../../../util/fs/index.ts');

describe('modules/manager/npm/extract/yarnrc', () => {
  beforeEach(() => {
    fs.findLocalSiblingAndParents.mockResolvedValue([]);
    fs.readLocalFile.mockResolvedValue(null);
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

    it('ignores missing scope registryServer', () => {
      const registryUrl = resolveRegistryUrl('@scope/a-package', {
        npmScopes: {
          scope: {},
        },
        npmRegistryServer: 'https://private.example.com/npm',
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
      ['', null],
    ])('produces expected config (%s)', (yarnrcYml, expectedConfig) => {
      const config = loadConfigFromYarnrcYml(yarnrcYml);

      expect(config).toEqual(expectedConfig);
    });
  });

  describe('loadConfigFromLegacyYarnrc()', () => {
    it.each([
      [
        codeBlock`
          # yarn lockfile v1
          registry "https://npm.example.com"
        `,
        {
          npmRegistryServer: 'https://npm.example.com',
        },
      ],
      [
        codeBlock`
          disturl "https://npm-dist.example.com"
          registry https://npm.example.com
          sass_binary_site "https://node-sass.example.com"
        `,
        {
          npmRegistryServer: 'https://npm.example.com',
        },
      ],
      [
        codeBlock`
          --install.frozen-lockfile true
          "registry" "https://npm.example.com"
          "@foo:registry" "https://npm-foo.example.com"
          "@bar:registry" "https://npm-bar.example.com"
        `,
        {
          npmRegistryServer: 'https://npm.example.com',
          npmScopes: {
            foo: {
              npmRegistryServer: 'https://npm-foo.example.com',
            },
            bar: {
              npmRegistryServer: 'https://npm-bar.example.com',
            },
          },
        },
      ],
    ])('produces expected config (%s)', (legacyYarnrc, expectedConfig) => {
      const config = loadConfigFromLegacyYarnrc(legacyYarnrc);

      expect(config).toEqual(expectedConfig);
    });
  });

  describe('mergeYarnConfigs()', () => {
    it('returns child when parent config is null', () => {
      const mergedConfig = mergeYarnConfigs(null, {
        npmRegistryServer: 'https://child.example.com',
      });

      expect(mergedConfig).toEqual({
        npmRegistryServer: 'https://child.example.com',
      });
    });

    it('returns parent when child config is null', () => {
      const mergedConfig = mergeYarnConfigs(
        {
          npmRegistryServer: 'https://parent.example.com',
        },
        null,
      );

      expect(mergedConfig).toEqual({
        npmRegistryServer: 'https://parent.example.com',
      });
    });

    it('merges child config on top of parent config preserving child catalog(s)', () => {
      const mergedConfig = mergeYarnConfigs(
        {
          npmRegistryServer: 'https://default.example.com',
          npmScopes: {
            root: {
              npmRegistryServer: 'https://root.example.com',
            },
            shared: {
              npmRegistryServer: 'https://shared-root.example.com',
            },
          },
          catalog: {
            typescript: '^5.0.0',
            eslint: '^8.0.0',
          },
          catalogs: {
            ci: {
              vitest: '^2.0.0',
              eslint: '^8.0.0',
            },
          },
        },
        {
          npmScopes: {
            leaf: {
              npmRegistryServer: 'https://leaf.example.com',
            },
            shared: {
              npmRegistryServer: 'https://shared-leaf.example.com',
            },
          },
          catalog: {
            eslint: '^9.0.0',
            prettier: '^3.0.0',
          },
          catalogs: {
            ci: {
              eslint: '^9.0.0',
              '@types/node': '^22.0.0',
            },
            test: {
              vitest: '^3.0.0',
            },
          },
        },
      );

      expect(mergedConfig).toEqual({
        npmRegistryServer: 'https://default.example.com',
        npmScopes: {
          root: {
            npmRegistryServer: 'https://root.example.com',
          },
          leaf: {
            npmRegistryServer: 'https://leaf.example.com',
          },
          shared: {
            npmRegistryServer: 'https://shared-leaf.example.com',
          },
        },
        catalog: {
          eslint: '^9.0.0',
          prettier: '^3.0.0',
        },
        catalogs: {
          ci: {
            eslint: '^9.0.0',
            '@types/node': '^22.0.0',
          },
          test: {
            vitest: '^3.0.0',
          },
        },
      });
    });
  });

  describe('loadConfigFromInheritedYarnrcYml()', () => {
    it('returns null when no inherited .yarnrc.yml files are found', async () => {
      fs.findLocalSiblingAndParents.mockResolvedValue([]);

      const config = await loadConfigFromInheritedYarnrcYml(
        'packages/foo/package.json',
      );

      expect(config).toBeNull();
    });

    it('returns null for absolute package file path', async () => {
      fs.findLocalSiblingAndParents.mockResolvedValue([]);

      const config = await loadConfigFromInheritedYarnrcYml(
        '/absolute/package.json',
      );

      expect(config).toBeNull();
    });

    it('loads and merges inherited files from parent to child', async () => {
      fs.findLocalSiblingAndParents.mockResolvedValue([
        'packages/.yarnrc.yml',
        '.yarnrc.yml',
      ]);

      fs.readLocalFile.mockImplementation((path): Promise<any> => {
        if (path === '.yarnrc.yml') {
          return Promise.resolve(codeBlock`
            npmRegistryServer: https://parent.example.com
            npmScopes:
              parent:
                npmRegistryServer: https://scope-parent.example.com
          `);
        }
        if (path === 'packages/.yarnrc.yml') {
          return Promise.resolve(codeBlock`
            npmScopes:
              leaf:
                npmRegistryServer: https://scope-leaf.example.com
          `);
        }
        return Promise.resolve(null);
      });

      const config = await loadConfigFromInheritedYarnrcYml(
        'packages/foo/package.json',
      );

      expect(config).toEqual({
        npmRegistryServer: 'https://parent.example.com',
        npmScopes: {
          parent: {
            npmRegistryServer: 'https://scope-parent.example.com',
          },
          leaf: {
            npmRegistryServer: 'https://scope-leaf.example.com',
          },
        },
      });
    });

    it('skips empty inherited files', async () => {
      fs.findLocalSiblingAndParents.mockResolvedValue([
        'packages/.yarnrc.yml',
        '.yarnrc.yml',
      ]);

      fs.readLocalFile.mockImplementation((path): Promise<any> => {
        if (path === '.yarnrc.yml') {
          return Promise.resolve('   \n');
        }
        if (path === 'packages/.yarnrc.yml') {
          return Promise.resolve(
            'npmRegistryServer: https://child.example.com',
          );
        }
        return Promise.resolve(null);
      });

      const config = await loadConfigFromInheritedYarnrcYml(
        'packages/foo/package.json',
      );

      expect(config).toEqual({
        npmRegistryServer: 'https://child.example.com',
      });
    });
  });
});
