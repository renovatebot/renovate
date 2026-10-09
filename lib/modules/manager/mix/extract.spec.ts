import { Fixtures } from '~test/fixtures.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/mix/extract', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: '' });
  });

  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', async () => {
      const res = await extractPackageFile('nothing here', 'mix.exs');
      expect(res).toBeNull();
    });

    it('extracts all dependencies when no lockfile', async () => {
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs');
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          depType: 'prod',
          packageName: 'postgrex',
        },
        {
          currentValue: '<1.7.0 or ~>1.7.1',
          datasource: 'hex',
          depName: 'ranch',
          depType: 'prod',
          packageName: 'ranch',
        },
        {
          currentDigest: undefined,
          currentValue: '0.6.0',
          datasource: 'github-tags',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'ninenines/cowboy',
        },
        {
          currentDigest: undefined,
          currentValue: 'main',
          datasource: 'git-tags',
          depName: 'phoenix',
          depType: 'prod',
          packageName: 'https://github.com/phoenixframework/phoenix.git',
        },
        {
          currentDigest: '795036d997c7503b21fb64d6bf1a89b83c44f2b5',
          currentValue: undefined,
          datasource: 'github-tags',
          depName: 'ecto',
          depType: 'prod',
          packageName: 'elixir-ecto/ecto',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          depType: 'prod',
          packageName: 'secret:acme',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          depType: 'dev',
          packageName: 'also_secret:acme',
        },
        {
          currentValue: '~> 1.7',
          datasource: 'hex',
          depName: 'oban_pro',
          depType: 'prod',
          packageName: 'oban_pro',
          skipReason: 'unknown-registry',
        },
        {
          currentValue: '>0.2.0 and <=1.0.0',
          datasource: 'hex',
          depName: 'metrics',
          depType: 'prod',
          packageName: 'metrics',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          depType: 'prod',
          packageName: 'jason',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'hackney',
          depType: 'prod',
          packageName: 'hackney',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          depType: 'prod',
          packageName: 'hammer_backend_redis',
        },
        {
          currentValue: '== 1.0.10',
          currentVersion: '1.0.10',
          datasource: 'hex',
          depName: 'castore',
          depType: 'prod',
          packageName: 'castore',
        },
        {
          currentValue: '~> 2.0.0',
          datasource: 'hex',
          depName: 'gun',
          depType: 'prod',
          packageName: 'grpc_gun',
        },
        {
          currentValue: '~> 0.4.0',
          datasource: 'hex',
          depName: 'another_gun',
          depType: 'prod',
          packageName: 'raygun',
        },
        {
          currentValue: '~> 1.7',
          datasource: 'hex',
          depName: 'credo',
          depType: 'dev',
          packageName: 'credo',
        },
        {
          currentValue: '== 0.37.0',
          currentVersion: '0.37.0',
          datasource: 'hex',
          depName: 'floki',
          depType: 'dev',
          packageName: 'floki',
        },
      ]);
    });

    it('extracts all dependencies and adds the locked version if lockfile present', async () => {
      // allows fetching the sibling mix.lock file
      GlobalConfig.set({ localDir: 'lib/modules/manager/mix/__fixtures__' });
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs');
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          depType: 'prod',
          packageName: 'postgrex',
          lockedVersion: '0.8.4',
        },
        {
          currentValue: '<1.7.0 or ~>1.7.1',
          datasource: 'hex',
          depName: 'ranch',
          depType: 'prod',
          packageName: 'ranch',
          lockedVersion: '1.7.1',
        },
        {
          currentDigest: undefined,
          currentValue: '0.6.0',
          datasource: 'github-tags',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'ninenines/cowboy',
          lockedVersion: '0.6.0',
        },
        {
          currentDigest: undefined,
          currentValue: 'main',
          datasource: 'git-tags',
          depName: 'phoenix',
          depType: 'prod',
          packageName: 'https://github.com/phoenixframework/phoenix.git',
          lockedVersion: undefined,
        },
        {
          currentDigest: '795036d997c7503b21fb64d6bf1a89b83c44f2b5',
          currentValue: undefined,
          datasource: 'github-tags',
          depName: 'ecto',
          depType: 'prod',
          packageName: 'elixir-ecto/ecto',
          lockedVersion: undefined,
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          depType: 'prod',
          packageName: 'secret:acme',
          lockedVersion: '1.5.0',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          depType: 'dev',
          packageName: 'also_secret:acme',
          lockedVersion: '1.3.4',
        },
        {
          currentValue: '~> 1.7',
          datasource: 'hex',
          depName: 'oban_pro',
          depType: 'prod',
          packageName: 'oban_pro',
          lockedVersion: '1.7.2',
          skipReason: 'unknown-registry',
        },
        {
          currentValue: '>0.2.0 and <=1.0.0',
          datasource: 'hex',
          depName: 'metrics',
          depType: 'prod',
          packageName: 'metrics',
          lockedVersion: '1.0.0',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          depType: 'prod',
          packageName: 'jason',
          lockedVersion: '1.4.4',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'hackney',
          depType: 'prod',
          packageName: 'hackney',
          lockedVersion: '1.20.1',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          depType: 'prod',
          packageName: 'hammer_backend_redis',
          lockedVersion: '6.2.0',
        },
        {
          currentValue: '== 1.0.10',
          currentVersion: '1.0.10',
          datasource: 'hex',
          depName: 'castore',
          depType: 'prod',
          packageName: 'castore',
          lockedVersion: '1.0.10',
        },
        {
          currentValue: '~> 2.0.0',
          datasource: 'hex',
          depName: 'gun',
          depType: 'prod',
          packageName: 'grpc_gun',
          lockedVersion: '2.0.1',
        },
        {
          currentValue: '~> 0.4.0',
          datasource: 'hex',
          depName: 'another_gun',
          depType: 'prod',
          packageName: 'raygun',
          lockedVersion: '0.4.0',
        },
        {
          currentValue: '~> 1.7',
          datasource: 'hex',
          depName: 'credo',
          depType: 'dev',
          packageName: 'credo',
          lockedVersion: '1.7.10',
        },
        {
          currentValue: '== 0.37.0',
          currentVersion: '0.37.0',
          datasource: 'hex',
          depName: 'floki',
          depType: 'dev',
          lockedVersion: '0.37.0',
          packageName: 'floki',
        },
      ]);
    });

    it('resolves a repo dependency through registryAliases', async () => {
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs', {
        registryAliases: { oban: 'https://repo.oban.pro' },
      });

      expect(res?.deps).toContainEqual({
        currentValue: '~> 1.7',
        datasource: 'hex',
        depName: 'oban_pro',
        depType: 'prod',
        packageName: 'oban_pro',
        registryUrls: ['https://repo.oban.pro'],
      });
      expect(res?.deps).not.toContainEqual(
        expect.objectContaining({ skipReason: 'unknown-registry' }),
      );
    });

    it('skips a repo dependency missing from registryAliases', async () => {
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs', {
        registryAliases: { other: 'https://example.com' },
      });

      expect(res?.deps).toContainEqual({
        currentValue: '~> 1.7',
        datasource: 'hex',
        depName: 'oban_pro',
        depType: 'prod',
        packageName: 'oban_pro',
        skipReason: 'unknown-registry',
      });
      expect(res?.deps).not.toContainEqual(
        expect.objectContaining({ registryUrls: expect.anything() }),
      );
    });

    it('treats hexpm repos as hex.pm itself', async () => {
      const content = [
        'defp deps do',
        '  [',
        '    {:plug, "~> 1.0", repo: "hexpm"},',
        '    {:secret, "~> 1.0", repo: "hexpm:acme"}',
        '  ]',
        'end',
      ].join('\n');

      const res = await extractPackageFile(content, 'mix.exs', {});

      expect(res?.deps).toEqual([
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'plug',
          depType: 'prod',
          packageName: 'plug',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          depType: 'prod',
          packageName: 'secret:acme',
        },
      ]);
    });
  });
});
