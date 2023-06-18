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
      expect(res?.deps).toBeEmpty();
    });

    it('extracts all dependencies', async () => {
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs');
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
          depName: 'ecto',
          packageName: 'ecto',
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
          packageName: 'secret:acme',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'also_secret:acme',
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
          depName: 'jason',
          packageName: 'jason',
        },
        {
          currentValue: '== 1.6.14',
          currentVersion: '1.6.14',
          datasource: 'hex',
          depName: 'phoenix',
          packageName: 'phoenix',
        },
      ]);
    });
  });
});
