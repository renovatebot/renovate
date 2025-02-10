import { logger } from '../../../../test/util';
import type { PackageFile } from '../../../modules/manager/types';
import type { Timestamp } from '../../../util/timestamp';
import { calculateLibYears } from './libyear';

describe('workers/repository/process/libyear', () => {
  describe('calculateLibYears', () => {
    it('returns early if no packageFiles', () => {
      calculateLibYears(undefined);
      expect(logger.logger.debug).not.toHaveBeenCalled();
    });

    it('calculates libYears', () => {
      const packageFiles: Record<string, PackageFile[]> = {
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'some/image',
                datasource: 'docker',
                currentVersion: '1.0.0',
                updates: [{ newVersion: '2.0.0' }],
              },
            ],
          },
        ],
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                depName: 'dep1',
                datasource: 'npm',
                currentVersion: '0.1.0',
                currentVersionTimestamp: '2019-07-01T00:00:00Z' as Timestamp,
                updates: [
                  {
                    newVersion: '1.0.0',
                    releaseTimestamp: '2020-01-01T00:00:00Z' as Timestamp,
                  },
                  {
                    newVersion: '2.0.0',
                    releaseTimestamp: '2020-07-01T00:00:00Z' as Timestamp,
                  },
                  {
                    newVersion: '3.0.0',
                  },
                ],
              },
            ],
          },
        ],
        bundler: [
          {
            packageFile: 'Gemfile',
            deps: [
              {
                depName: 'dep2',
                currentVersion: '1.0.0',
                datasource: 'rubygems',
                currentVersionTimestamp: '2019-07-01T00:00:00Z' as Timestamp,
                updates: [
                  {
                    newVersion: '2.0.0',
                    releaseTimestamp: '2020-01-01T00:00:00Z' as Timestamp,
                  },
                ],
              },
              {
                depName: 'dep3',
                currentVersion: '1.0.0',
                datasource: 'rubygems',
                updates: [
                  {
                    newVersion: '2.0.0',
                    releaseTimestamp: '2020-01-01T00:00:00Z' as Timestamp,
                  },
                ],
              },
              {
                depName: 'dep4',
                datasource: 'rubygems',
                currentValue: '1.0.0', // coverage
              },
            ],
          },
        ],
      };
      calculateLibYears(packageFiles);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'No currentVersionTimestamp for some/image',
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'No releaseTimestamp for dep1 update to 3.0.0',
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'No currentVersionTimestamp for dep3',
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        {
          managerLibYears: {
            bundler: 0.5027322404371585,
            dockerfile: 0,
            npm: 1,
          },
          // eslint-disable-next-line no-loss-of-precision
          totalLibYears: 1.5027322404371585,
          totalDepsCount: 5,
          outdatedDepsCount: 4,
        },
        'Repository libYears',
      );
    });

    it('de-duplicates if same dep found in different files', () => {
      // there are three package files with the same dependency + version but mixed datasources
      const packageFiles = {
        npm: [
          {
            packageFile: 'folder1/package.json',
            deps: [
              {
                depName: 'dep1',
                currentVersion: '0.1.0',
                datasource: 'npm',
                currentVersionTimestamp: '2019-07-01T00:00:00Z' as Timestamp,
                updates: [
                  {
                    newVersion: '1.0.0',
                    releaseTimestamp: '2020-07-01T00:00:00Z' as Timestamp,
                  },
                ],
              },
            ],
          },
          {
            packageFile: 'folder2/package.json',
            deps: [
              {
                depName: 'dep1',
                currentVersion: '0.1.0',
                datasource: 'npm',
                currentVersionTimestamp: '2019-07-01T00:00:00Z' as Timestamp,
                updates: [
                  {
                    newVersion: '1.0.0',
                    releaseTimestamp: '2020-07-01T00:00:00Z' as Timestamp,
                  },
                ],
              },
            ],
          },
        ],
        regex: [
          {
            packageFile: 'folder3/package.json',
            deps: [
              {
                depName: 'dep1',
                currentVersion: '0.1.0',
                datsource: 'docker',
                currentVersionTimestamp: '2019-07-01T00:00:00Z' as Timestamp,
                updates: [
                  {
                    newVersion: '1.0.0',
                    releaseTimestamp: '2020-07-01T00:00:00Z' as Timestamp,
                  },
                ],
              },
            ],
          },
        ],
      };
      calculateLibYears(packageFiles);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        {
          managerLibYears: {
            npm: 1,
            regex: 1,
          },

          totalLibYears: 2,
          totalDepsCount: 2,
          outdatedDepsCount: 2,
        },
        'Repository libYears',
      );
    });
  });
});
