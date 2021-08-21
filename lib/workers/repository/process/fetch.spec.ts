import { RenovateConfig, getConfig, mocked } from '../../../../test/util';
import * as datasourceMaven from '../../../datasource/maven';
import type { PackageFile } from '../../../manager/types';
import { fetchUpdates } from './fetch';
import * as lookup from './lookup';

const lookupUpdates = mocked(lookup).lookupUpdates;

jest.mock('./lookup');

describe('workers/repository/process/fetch', () => {
  describe('fetchUpdates()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
    });
    it('handles empty deps', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [{ packageFile: 'package.json', deps: [] }],
      };
      await fetchUpdates(config, packageFiles);
      // FIXME: explicit assert condition
      expect(packageFiles).toMatchSnapshot();
    });
    it('handles ignored, skipped and disabled', async () => {
      config.ignoreDeps = ['abcd'];
      config.packageRules = [
        {
          matchPackageNames: ['foo'],
          enabled: false,
        },
      ];
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              { depName: 'abcd' },
              { depName: 'foo' },
              { depName: 'skipped', skipReason: 'some-reason' as never },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles.npm[0].deps[0].skipReason).toEqual('ignored');
      expect(packageFiles.npm[0].deps[0].updates).toHaveLength(0);
      expect(packageFiles.npm[0].deps[1].skipReason).toEqual('disabled');
      expect(packageFiles.npm[0].deps[1].updates).toHaveLength(0);
    });
    it('fetches updates', async () => {
      config.rangeStrategy = 'auto';
      const packageFiles: any = {
        maven: [
          {
            packageFile: 'pom.xml',
            deps: [{ datasource: datasourceMaven.id, depName: 'bbb' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue({ updates: ['a', 'b'] } as never);
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
    });
  });
});
