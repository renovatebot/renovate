import { RenovateConfig, getConfig, mocked } from '../../../../test/util';
import { MavenDatasource } from '../../../modules/datasource/maven';
import type { PackageFile } from '../../../modules/manager/types';
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
      expect(packageFiles).toEqual({
        npm: [{ deps: [], packageFile: 'package.json' }],
      });
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
      expect(packageFiles.npm[0].deps[0].skipReason).toBe('ignored');
      expect(packageFiles.npm[0].deps[0].updates).toHaveLength(0);
      expect(packageFiles.npm[0].deps[1].skipReason).toBe('disabled');
      expect(packageFiles.npm[0].deps[1].updates).toHaveLength(0);
    });

    it('fetches updates', async () => {
      config.rangeStrategy = 'auto';
      const packageFiles: any = {
        maven: [
          {
            packageFile: 'pom.xml',
            deps: [{ datasource: MavenDatasource.id, depName: 'bbb' }],
          },
        ],
      };
      lookupUpdates.mockResolvedValue({ updates: ['a', 'b'] } as never);
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
    });

    it('skips deps with empty names', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        docker: [
          {
            packageFile: 'values.yaml',
            deps: [
              { depName: '', currentValue: '2.8.11', datasource: 'docker' },
              { depName: 'abcd' },
              { currentValue: '2.8.11', datasource: 'docker' },
              { depName: ' ' },
              { depName: null },
              { depName: undefined },
              { depName: { oh: 'no' } as unknown as string },
            ],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles.docker[0].deps[0].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[1].skipReason).toBeUndefined();
      expect(packageFiles.docker[0].deps[2].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[3].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[4].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[5].skipReason).toBe('invalid-name');
      expect(packageFiles.docker[0].deps[6].skipReason).toBe('invalid-name');
    });
  });
});
