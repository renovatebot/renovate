import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { extractPackageFile } from '.';

const simplePodfile = Fixtures.get('Podfile.simple');
const complexPodfile = Fixtures.get('Podfile.complex');

const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('modules/manager/cocoapods/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts from simple file', async () => {
      GlobalConfig.set(adminConfig);
      const res = await extractPackageFile(simplePodfile, 'Podfile');
      expect(res?.deps).toMatchObject([
        { depName: 'a' },
        { depName: 'a/sub' },
        { depName: 'b', currentValue: '1.2.3' },
        { depName: 'c', currentValue: '1.2.3' },
        { depName: 'd', skipReason: 'path-dependency' },
        { depName: 'e', skipReason: 'git-dependency' },
        { depName: 'f', skipReason: 'git-dependency' },
        { depName: 'g', datasource: 'git-tags', currentValue: '3.2.1' },
        { depName: 'h', currentValue: '0.0.1', datasource: 'github-tags' },
        { depName: 'i', packageName: 'foo/foo', datasource: 'github-tags' },
        { depName: 'j', packageName: 'bar/bar', datasource: 'gitlab-tags' },
        { depName: 'k', packageName: 'bar/bar', datasource: 'gitlab-tags' },
        {
          depName: 'l',
          packageName: 'https://example.com/baz/baz.git',
          datasource: 'git-tags',
        },
        {
          depName: 'm',
          packageName: 'git@example.com:baz/baz.git',
          datasource: 'git-tags',
        },
      ]);
    });

    it('extracts from complex file', async () => {
      GlobalConfig.set(adminConfig);
      const res = await extractPackageFile(complexPodfile, 'Podfile');
      expect(res?.deps).toMatchObject([
        { depName: 'IQKeyboardManager', currentValue: '~> 6.5.0' },
        { depName: 'CYLTabBarController', currentValue: '~> 1.28.3' },
        { depName: 'PureLayout', currentValue: '~> 3.1.4' },
        { depName: 'AFNetworking/Serialization', currentValue: '~> 3.2.1' },
        { depName: 'AFNetworking/Security', currentValue: '~> 3.2.1' },
        { depName: 'AFNetworking/Reachability', currentValue: '~> 3.2.1' },
        { depName: 'AFNetworking/NSURLSession', currentValue: '~> 3.2.1' },
        { depName: 'MBProgressHUD', currentValue: '~> 1.1.0' },
        { depName: 'MJRefresh', currentValue: '~> 3.1.16' },
        { depName: 'MJExtension', currentValue: '~> 3.1.0' },
        { depName: 'TYPagerController', currentValue: '~> 2.1.2' },
        { depName: 'YYImage', currentValue: '~> 1.0.4' },
        { depName: 'SDWebImage', currentValue: '~> 5.0' },
        { depName: 'SDCycleScrollView', currentValue: '~> 1.80' },
        { depName: 'NullSafe', currentValue: '~> 2.0' },
        { depName: 'TZImagePickerController', currentValue: '~> 3.2.1' },
        { depName: 'TOCropViewController', currentValue: '~> 2.5.1' },
        { depName: 'FMDB', currentValue: '~> 2.7.5' },
        { depName: 'FDStackView', currentValue: '~> 1.0.1' },
        { depName: 'LYEmptyView', skipReason: 'unspecified-version' },
        { depName: 'MMKV', currentValue: '~> 1.0.22' },
        { depName: 'fishhook', skipReason: 'unspecified-version' },
        { depName: 'CocoaLumberjack', currentValue: '~> 3.5.3' },
        { depName: 'GZIP', currentValue: '~> 1.2' },
        { depName: 'LBXScan/LBXNative', currentValue: '~> 2.3' },
        { depName: 'LBXScan/LBXZXing', currentValue: '~> 2.3' },
        { depName: 'LBXScan/UI', currentValue: '~> 2.3' },
        { depName: 'MLeaksFinder', skipReason: 'unspecified-version' },
        { depName: 'FBMemoryProfiler', skipReason: 'unspecified-version' },
      ]);
    });
  });
});
