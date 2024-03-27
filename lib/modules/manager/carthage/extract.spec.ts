import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { extractPackageFile } from '.';

const cartfileSample = Fixtures.get('Cartfile.sample');

const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('modules/manager/carthage/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts from simple file', async () => {
      GlobalConfig.set(adminConfig);
      const res = await extractPackageFile(cartfileSample, 'Cartfile');
      expect(res?.deps).toMatchObject([
        {
          depName: 'ReactiveCocoa',
          packageName: 'ReactiveCocoa/ReactiveCocoa',
          currentValue: '>= 2.3.1',
          datasource: 'github-tags',
        },
        {
          depName: 'Mantle',
          packageName: 'Mantle/Mantle',
          currentValue: '~> 1.0',
          datasource: 'github-tags',
        },
        {
          depName: 'libextobjc',
          packageName: 'jspahrsummers/libextobjc',
          currentValue: '== 0.4.1',
          datasource: 'github-tags',
        },
        {
          depName: 'xcconfigs',
          skipReason: 'unspecified-version',
        },
        {
          depName: 'xcconfigs-legacy',
          skipReason: 'git-dependency',
        },
        {
          depName: 'git-error-translations',
          skipReason: 'git-dependency',
        },
        {
          depName: 'git-error-translations2',
          skipReason: 'git-dependency',
        },
        {
          depName: 'repo1',
          packageName: 'user/repo1',
          currentValue: '== 1.0',
          datasource: 'github-tags',
        },
        {
          depName: 'repo2',
          packageName: 'user/repo2',
          currentValue: '== 1.0',
          datasource: 'gitlab-tags',
        },
        {
          depName: 'repo3',
          packageName: 'https://githost.com/user/repo3',
          currentValue: '== 1.0',
          datasource: 'git-tags',
        },
        {
          depName: 'project',
          skipReason: 'local-dependency',
        },
        {
          depName: 'MyFramework',
          registryUrls: ['https://my.domain.com/release/MyFramework.json'],
          currentValue: '~> 2.3',
        },
        {
          depName: 'MyFrameworkVersionless',
          skipReason: 'unspecified-version',
        },
        {
          depName: 'MyFramework',
          skipReason: 'local-dependency',
        },
        {
          depName: 'MyFramework',
          skipReason: 'local-dependency',
        },
        {
          depName: 'MyFramework',
          skipReason: 'local-dependency',
        },
      ]);
    });
  });
});
