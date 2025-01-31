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
                updates: [
                  {
                    newVersion: '2.0.0',
                    releaseTimestamp: '2020-01-01T00:00:00Z' as Timestamp,
                  },
                ],
              },
              {
                depName: 'dep4',
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
        },
        'Repository libYears',
      );
    });

    it('de-duplicates if same dep found in different files', () => {
      // three package files
      // two managers
      // all the files has the same dep and same version
      // expected: in total libyears only one count should be taken
      // in manager1->libyear one count
      // in manager2->libcount one count (even though its duplicate but this manager counted it once hence we should keep it)
      const packageFiles = {
        manager1: [
          {
            packageFile: 'file1',
            deps: [
              {
                depName: 'dep1',
                currentVersion: '0.1.0',
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
            packageFile: 'file2',
            deps: [
              {
                depName: 'dep1',
                currentVersion: '0.1.0',
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
        manager2: [
          {
            packageFile: 'file3',
            deps: [
              {
                depName: 'dep1',
                currentVersion: '0.1.0',
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
            manager1: 1,
            manager2: 1,
          },
          // eslint-disable-next-line no-loss-of-precision
          totalLibYears: 1,
        },
        'Repository libYears',
      );
    });
  });
});
