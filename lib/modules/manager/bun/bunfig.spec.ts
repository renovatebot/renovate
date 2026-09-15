import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import type { PackageDependency } from '../types.ts';
import { applyBunfigRegistries, loadBunfigToml } from './bunfig.ts';
import type { BunfigConfig } from './schema.ts';

vi.mock('../../../util/fs/index.ts');

function npmDeps(...packageNames: string[]): PackageDependency[] {
  return packageNames.map((depName) => ({
    depName,
    datasource: NpmDatasource.id,
  }));
}

describe('modules/manager/bun/bunfig', () => {
  describe('loadBunfigToml()', () => {
    it('returns null for a missing file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      await expect(loadBunfigToml('bunfig.toml')).resolves.toBeNull();
    });

    it('returns null for invalid TOML', async () => {
      fs.readLocalFile.mockResolvedValueOnce('invalid toml {');

      await expect(loadBunfigToml('bunfig.toml')).resolves.toBeNull();
    });

    it('returns null for valid TOML with invalid schema', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [install]
        registry = 123
      `);

      await expect(loadBunfigToml('bunfig.toml')).resolves.toBeNull();
    });

    it('parses a bunfig without install section', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [run]
        shell = "zsh"
      `);

      await expect(loadBunfigToml('bunfig.toml')).resolves.toEqual({});
    });

    it('parses default and scoped registries', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [install]
        registry = "https://registry.example.com"

        [install.scopes]
        myorg = "https://registry.myorg.com"
        otherorg = { url = "https://registry.other.com", token = "secret" }
      `);

      await expect(loadBunfigToml('bunfig.toml')).resolves.toEqual({
        install: {
          registry: 'https://registry.example.com',
          scopes: {
            myorg: 'https://registry.myorg.com',
            otherorg: 'https://registry.other.com',
          },
        },
      });
    });

    it('parses the default registry object form', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [install]
        registry = { url = "https://registry.example.com", token = "abc123" }
      `);

      await expect(loadBunfigToml('bunfig.toml')).resolves.toEqual({
        install: { registry: 'https://registry.example.com' },
      });
    });
  });

  describe('applyBunfigRegistries()', () => {
    it('does nothing without a bunfig', () => {
      const deps = npmDeps('lodash');

      applyBunfigRegistries(deps, null);

      expect(deps[0].registryUrls).toBeUndefined();
    });

    it('does nothing without an install section', () => {
      const deps = npmDeps('lodash');

      applyBunfigRegistries(deps, {});

      expect(deps[0].registryUrls).toBeUndefined();
    });

    it('does nothing without a configured registry', () => {
      const deps = npmDeps('lodash');

      applyBunfigRegistries(deps, { install: {} });

      expect(deps[0].registryUrls).toBeUndefined();
    });

    it('skips dependencies of other datasources', () => {
      const deps: PackageDependency[] = [
        { depName: 'lodash', datasource: 'github-tags' },
      ];

      applyBunfigRegistries(deps, {
        install: { registry: 'https://registry.example.com' },
      });

      expect(deps[0].registryUrls).toBeUndefined();
    });

    it('skips dependencies without a name', () => {
      const deps: PackageDependency[] = [{ datasource: NpmDatasource.id }];

      applyBunfigRegistries(deps, {
        install: { registry: 'https://registry.example.com' },
      });

      expect(deps[0].registryUrls).toBeUndefined();
    });

    it('applies the default registry', () => {
      const deps = npmDeps('lodash', '@myorg/utils');

      applyBunfigRegistries(deps, {
        install: { registry: 'https://registry.example.com' },
      });

      expect(deps).toMatchObject([
        { registryUrls: ['https://registry.example.com'] },
        { registryUrls: ['https://registry.example.com'] },
      ]);
    });

    it('prefers a scoped registry over the default registry', () => {
      const deps = npmDeps('lodash', '@myorg/utils', '@other/pkg');

      applyBunfigRegistries(deps, {
        install: {
          registry: 'https://registry.example.com',
          scopes: { myorg: 'https://registry.myorg.com' },
        },
      });

      expect(deps).toMatchObject([
        { registryUrls: ['https://registry.example.com'] },
        { registryUrls: ['https://registry.myorg.com'] },
        { registryUrls: ['https://registry.example.com'] },
      ]);
    });

    it('matches scopes which keep the leading @', () => {
      const deps = npmDeps('@myorg/utils');

      applyBunfigRegistries(deps, {
        install: { scopes: { '@myorg': 'https://registry.myorg.com' } },
      });

      expect(deps[0].registryUrls).toEqual(['https://registry.myorg.com']);
    });

    it('leaves unmatched scopes alone when there is no default registry', () => {
      const deps = npmDeps('@other/pkg');

      applyBunfigRegistries(deps, {
        install: { scopes: { myorg: 'https://registry.myorg.com' } },
      });

      expect(deps[0].registryUrls).toBeUndefined();
    });

    it('resolves the registry by package name', () => {
      const deps: PackageDependency[] = [
        {
          depName: 'utils',
          packageName: '@myorg/utils',
          datasource: NpmDatasource.id,
        },
      ];

      applyBunfigRegistries(deps, {
        install: { scopes: { myorg: 'https://registry.myorg.com' } },
      });

      expect(deps[0].registryUrls).toEqual(['https://registry.myorg.com']);
    });

    it('ignores registries which are not HTTP URLs', () => {
      const deps = npmDeps('lodash', '@myorg/utils');

      applyBunfigRegistries(deps, {
        install: {
          registry: '$NPM_REGISTRY',
          scopes: { myorg: 'ftp://registry.myorg.com' },
        },
      });

      expect(deps[0].registryUrls).toBeUndefined();
      expect(deps[1].registryUrls).toBeUndefined();
    });

    it('removes credentials from registry URLs', () => {
      const deps = npmDeps('lodash', '@myorg/utils');

      applyBunfigRegistries(deps, {
        install: {
          registry: 'https://user:pass@registry.example.com/',
          scopes: { myorg: 'https://$NPM_TOKEN@registry.myorg.com/' },
        },
      });

      expect(deps).toMatchObject([
        { registryUrls: ['https://registry.example.com/'] },
        { registryUrls: ['https://registry.myorg.com/'] },
      ]);
    });

    describe('with an .npmrc file', () => {
      const bunfig: BunfigConfig = {
        install: { registry: 'https://registry.example.com' },
      };

      it('keeps a scoped registry from the .npmrc file', () => {
        const deps = npmDeps('lodash', '@myorg/utils');

        applyBunfigRegistries(
          deps,
          bunfig,
          '@myorg:registry=https://registry.myorg.com\n',
        );

        expect(deps[0].registryUrls).toEqual(['https://registry.example.com']);
        expect(deps[1].registryUrls).toBeUndefined();
      });

      it('overrides a scoped registry from the .npmrc file', () => {
        const deps = npmDeps('@myorg/utils');

        applyBunfigRegistries(
          deps,
          {
            install: { scopes: { myorg: 'https://registry.bunfig.com' } },
          },
          '@myorg:registry=https://registry.myorg.com\n',
        );

        expect(deps[0].registryUrls).toEqual(['https://registry.bunfig.com']);
      });

      it('overrides the default registry from the .npmrc file', () => {
        const deps = npmDeps('lodash');

        applyBunfigRegistries(
          deps,
          bunfig,
          'registry=https://registry.myorg.com\n',
        );

        expect(deps[0].registryUrls).toEqual(['https://registry.example.com']);
      });

      it('ignores empty and unscoped .npmrc registry keys', () => {
        const deps = npmDeps('@myorg/utils');

        applyBunfigRegistries(
          deps,
          bunfig,
          '@myorg:registry=\n//registry.myorg.com/:_authToken=abc\n',
        );

        expect(deps[0].registryUrls).toEqual(['https://registry.example.com']);
      });
    });
  });
});
