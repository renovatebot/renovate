import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { extractPackageFile } from '.';

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
          packageName: 'postgrex',
        },
        {
          currentValue: '<1.7.0 or ~>1.7.1',
          datasource: 'hex',
          depName: 'ranch',
          packageName: 'ranch',
        },
        {
          currentDigest: undefined,
          currentValue: '0.6.0',
          datasource: 'github-tags',
          depName: 'cowboy',
          packageName: 'ninenines/cowboy',
        },
        {
          currentDigest: undefined,
          currentValue: 'main',
          datasource: 'git-tags',
          depName: 'phoenix',
          packageName: 'https://github.com/phoenixframework/phoenix.git',
        },
        {
          currentDigest: '795036d997c7503b21fb64d6bf1a89b83c44f2b5',
          currentValue: undefined,
          datasource: 'github-tags',
          depName: 'ecto',
          packageName: 'elixir-ecto/ecto',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          packageName: 'secret:acme',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'also_secret:acme',
        },
        {
          currentValue: '>0.2.0 and <=1.0.0',
          datasource: 'hex',
          depName: 'metrics',
          packageName: 'metrics',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          packageName: 'jason',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'hackney',
          packageName: 'hackney',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          packageName: 'hammer_backend_redis',
        },
        {
          currentValue: '== 1.0.10',
          currentVersion: '1.0.10',
          datasource: 'hex',
          depName: 'castore',
          packageName: 'castore',
        },
        {
          currentValue: '~> 2.0.0',
          datasource: 'hex',
          depName: 'gun',
          packageName: 'grpc_gun',
        },
        {
          currentValue: '~> 0.4.0',
          datasource: 'hex',
          depName: 'another_gun',
          packageName: 'raygun',
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
          packageName: 'postgrex',
          lockedVersion: '0.8.4',
        },
        {
          currentValue: '<1.7.0 or ~>1.7.1',
          datasource: 'hex',
          depName: 'ranch',
          packageName: 'ranch',
          lockedVersion: '1.7.1',
        },
        {
          currentDigest: undefined,
          currentValue: '0.6.0',
          datasource: 'github-tags',
          depName: 'cowboy',
          packageName: 'ninenines/cowboy',
          lockedVersion: '0.6.0',
        },
        {
          currentDigest: undefined,
          currentValue: 'main',
          datasource: 'git-tags',
          depName: 'phoenix',
          packageName: 'https://github.com/phoenixframework/phoenix.git',
          lockedVersion: undefined,
        },
        {
          currentDigest: '795036d997c7503b21fb64d6bf1a89b83c44f2b5',
          currentValue: undefined,
          datasource: 'github-tags',
          depName: 'ecto',
          packageName: 'elixir-ecto/ecto',
          lockedVersion: undefined,
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          packageName: 'secret:acme',
          lockedVersion: '1.5.0',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'also_secret:acme',
          lockedVersion: '1.3.4',
        },
        {
          currentValue: '>0.2.0 and <=1.0.0',
          datasource: 'hex',
          depName: 'metrics',
          packageName: 'metrics',
          lockedVersion: '1.0.0',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          packageName: 'jason',
          lockedVersion: '1.4.4',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'hackney',
          packageName: 'hackney',
          lockedVersion: '1.20.1',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          packageName: 'hammer_backend_redis',
          lockedVersion: '6.2.0',
        },
        {
          currentValue: '== 1.0.10',
          currentVersion: '1.0.10',
          datasource: 'hex',
          depName: 'castore',
          packageName: 'castore',
          lockedVersion: '1.0.10',
        },
        {
          currentValue: '~> 2.0.0',
          datasource: 'hex',
          depName: 'gun',
          packageName: 'grpc_gun',
          lockedVersion: '2.0.1',
        },
        {
          currentValue: '~> 0.4.0',
          datasource: 'hex',
          depName: 'another_gun',
          packageName: 'raygun',
          lockedVersion: '0.4.0',
        },
      ]);
    });
  });
});
