import { Fixtures } from '../../../../test/fixtures';
import { partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';

const config = partial<ExtractConfig>({
  registryAliases: {
    oban: 'https://getoban.pro/repo',
  },
});

const missingRepoConfig = partial<ExtractConfig>({
  registryAliases: {
    unused: 'https://unused.com',
  },
});

describe('modules/manager/mix/extract', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: '' });
  });

  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', async () => {
      const res = await extractPackageFile('nothing here', 'mix.exs', config);
      expect(res).toBeNull();
    });

    it('extracts all dependencies when no lockfile', async () => {
      const res = await extractPackageFile(
        Fixtures.get('mix.exs'),
        'mix.exs',
        config,
      );
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          packageName: 'postgrex',
        },
        {
          currentValue: '>2.1.0 or <=3.0.0',
          datasource: 'hex',
          depName: 'foo_bar',
          packageName: 'foo_bar',
        },
        {
          currentDigest: undefined,
          currentValue: 'v0.4.1',
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
          packageName: 'org:acme:secret',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'org:acme:also_secret',
        },
        {
          currentValue: '~> 1.4',
          datasource: 'hex',
          depName: 'oban_pro',
          packageName: 'repo:oban:oban_pro',
          registryUrls: ['https://getoban.pro/repo'],
        },
        {
          currentValue: '>2.1.0 and <=3.0.0',
          datasource: 'hex',
          depName: 'ex_doc',
          packageName: 'ex_doc',
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
          depName: 'mason',
          packageName: 'mason',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          packageName: 'hammer_backend_redis',
        },
        {
          currentValue: '== 1.6.14',
          currentVersion: '1.6.14',
          datasource: 'hex',
          depName: 'public',
          packageName: 'public',
        },
      ]);
    });

    it('extracts all dependencies and adds the locked version if lockfile present', async () => {
      // allows fetching the sibling mix.lock file
      GlobalConfig.set({ localDir: 'lib/modules/manager/mix/__fixtures__' });
      const res = await extractPackageFile(
        Fixtures.get('mix.exs'),
        'mix.exs',
        config,
      );
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          packageName: 'postgrex',
          lockedVersion: '0.8.2',
        },
        {
          currentValue: '>2.1.0 or <=3.0.0',
          datasource: 'hex',
          depName: 'foo_bar',
          packageName: 'foo_bar',
          lockedVersion: '2.2.0',
        },
        {
          currentDigest: undefined,
          currentValue: 'v0.4.1',
          datasource: 'github-tags',
          depName: 'cowboy',
          packageName: 'ninenines/cowboy',
          lockedVersion: undefined,
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
          packageName: 'org:acme:secret',
          lockedVersion: '1.5.0',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'org:acme:also_secret',
          lockedVersion: '1.3.4',
        },
        {
          currentValue: '~> 1.4',
          datasource: 'hex',
          depName: 'oban_pro',
          packageName: 'repo:oban:oban_pro',
          lockedVersion: '1.4.7',
          registryUrls: ['https://getoban.pro/repo'],
        },
        {
          currentValue: '>2.1.0 and <=3.0.0',
          datasource: 'hex',
          depName: 'ex_doc',
          packageName: 'ex_doc',
          lockedVersion: '2.2.0',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          packageName: 'jason',
          lockedVersion: '1.0.1',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'mason',
          packageName: 'mason',
          lockedVersion: '1.1.0',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          packageName: 'hammer_backend_redis',
          lockedVersion: '6.1.5',
        },
        {
          currentValue: '== 1.6.14',
          currentVersion: '1.6.14',
          datasource: 'hex',
          depName: 'public',
          packageName: 'public',
          lockedVersion: '1.6.14',
        },
      ]);
    });

    it('skips dependencies when registryAliases empty', async () => {
      const res = await extractPackageFile(
        Fixtures.get('mix.exs'),
        'mix.exs',
        (config.registryAliases = {}),
      );
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          packageName: 'postgrex',
        },
        {
          currentValue: '>2.1.0 or <=3.0.0',
          datasource: 'hex',
          depName: 'foo_bar',
          packageName: 'foo_bar',
        },
        {
          currentDigest: undefined,
          currentValue: 'v0.4.1',
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
          packageName: 'org:acme:secret',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'org:acme:also_secret',
        },
        {
          currentValue: '~> 1.4',
          datasource: 'hex',
          depName: 'oban_pro',
          packageName: 'repo:oban:oban_pro',
          skipReason: 'no-repository',
        },
        {
          currentValue: '>2.1.0 and <=3.0.0',
          datasource: 'hex',
          depName: 'ex_doc',
          packageName: 'ex_doc',
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
          depName: 'mason',
          packageName: 'mason',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          packageName: 'hammer_backend_redis',
        },
        {
          currentValue: '== 1.6.14',
          currentVersion: '1.6.14',
          datasource: 'hex',
          depName: 'public',
          packageName: 'public',
        },
      ]);
    });

    it('skips dependencies when repo not in registryAliases', async () => {
      const res = await extractPackageFile(
        Fixtures.get('mix.exs'),
        'mix.exs',
        missingRepoConfig,
      );
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          packageName: 'postgrex',
        },
        {
          currentValue: '>2.1.0 or <=3.0.0',
          datasource: 'hex',
          depName: 'foo_bar',
          packageName: 'foo_bar',
        },
        {
          currentDigest: undefined,
          currentValue: 'v0.4.1',
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
          packageName: 'org:acme:secret',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'org:acme:also_secret',
        },
        {
          currentValue: '~> 1.4',
          datasource: 'hex',
          depName: 'oban_pro',
          packageName: 'repo:oban:oban_pro',
          skipReason: 'no-repository',
        },
        {
          currentValue: '>2.1.0 and <=3.0.0',
          datasource: 'hex',
          depName: 'ex_doc',
          packageName: 'ex_doc',
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
          depName: 'mason',
          packageName: 'mason',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          packageName: 'hammer_backend_redis',
        },
        {
          currentValue: '== 1.6.14',
          currentVersion: '1.6.14',
          datasource: 'hex',
          depName: 'public',
          packageName: 'public',
        },
      ]);
    });
  });
});
