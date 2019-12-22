import { fetchUpdates } from '../../../../lib/workers/repository/process/fetch';
import * as _npm from '../../../../lib/manager/npm';
import * as lookup from '../../../../lib/workers/repository/process/lookup';
import { mocked } from '../../../util';
import { ManagerApi } from '../../../../lib/manager/common';

const npm: ManagerApi = _npm;
const lookupUpdates = mocked(lookup).lookupUpdates;

jest.mock('../../../../lib/workers/repository/process/lookup');

describe('workers/repository/process/fetch', () => {
  describe('fetchUpdates()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = require('../../../config/config/_fixtures');
    });
    it('handles empty deps', async () => {
      const packageFiles = {
        npm: [{ packageFile: 'package.json', deps: [] }],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
    });
    it('handles ignored, skipped and disabled', async () => {
      config.ignoreDeps = ['abcd'];
      config.packageRules = [
        {
          packageNames: ['foo'],
          enabled: false,
        },
      ];
      const packageFiles: any = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              { depName: 'abcd' },
              { depName: 'zzzz' },
              { depName: 'foo' },
              { depName: 'skipped', skipReason: 'some-reason' },
            ],
            internalPackages: ['zzzz'],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles.npm[0].deps[0].skipReason).toEqual('ignored');
      expect(packageFiles.npm[0].deps[0].updates).toHaveLength(0);
      expect(packageFiles.npm[0].deps[1].skipReason).toEqual(
        'internal-package'
      );
      expect(packageFiles.npm[0].deps[1].updates).toHaveLength(0);
      expect(packageFiles.npm[0].deps[2].skipReason).toEqual('disabled');
      expect(packageFiles.npm[0].deps[2].updates).toHaveLength(0);
    });
    it('fetches updates', async () => {
      config.rangeStrategy = 'auto';
      const packageFiles: any = {
        npm: [
          {
            packageFile: 'package.json',
            packageJsonType: 'app',
            deps: [
              {
                datasource: 'npm',
                depName: 'aaa',
                depType: 'devDependencies',
              },
              { depName: 'bbb', depType: 'dependencies' },
            ],
          },
        ],
      };
      // TODO: fix types
      npm.getPackageUpdates = jest.fn(_ => ['a', 'b'] as never);
      lookupUpdates.mockResolvedValue(['a', 'b'] as never);
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles.npm[0].deps[0].skipReason).toBeUndefined();
      expect(packageFiles.npm[0].deps[0].updates).toHaveLength(2);
    });
  });
});
