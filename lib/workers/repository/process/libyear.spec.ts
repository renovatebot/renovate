import { addLibYears } from '../../../instrumentation/reporting';
import type { PackageFile } from '../../../modules/manager/types';
import type { Timestamp } from '../../../util/timestamp';
import { calculateLibYears } from './libyear';
import { logger } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('../../../instrumentation/reporting');

describe('workers/repository/process/libyear', () => {
  const config: RenovateConfig = {};

  describe('calculateLibYears', () => {
    it('returns early if no packageFiles', () => {
      calculateLibYears(config, undefined);
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
      calculateLibYears(config, packageFiles);
      expect(logger.logger.once.debug).toHaveBeenCalledWith(
        'No currentVersionTimestamp for some/image',
      );
      expect(logger.logger.once.debug).toHaveBeenCalledWith(
        'No releaseTimestamp for dep1 update to 3.0.0',
      );
      expect(logger.logger.once.debug).toHaveBeenCalledWith(
        'No currentVersionTimestamp for dep3',
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        {
          libYears: {
            managers: {
              bundler: 0.5027322404371585,
              dockerfile: 0,
              npm: 1,
            },
            total: 1.5027322404371586,
          },
          dependencyStatus: {
            outdated: 4,
            total: 5,
          },
        },
        'Repository libYears',
      );
      expect(addLibYears).toHaveBeenCalledWith(config, {
        libYears: {
          managers: {
            bundler: 0.5027322404371585,
            dockerfile: 0,
            npm: 1,
          },
          total: 1.5027322404371586,
        },
        dependencyStatus: {
          outdated: 4,
          total: 5,
        },
      });
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
      calculateLibYears(config, packageFiles);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        {
          libYears: {
            managers: {
              npm: 1,
              regex: 1,
            },
            total: 2,
          },
          dependencyStatus: {
            outdated: 2,
            total: 2,
          },
        },
        'Repository libYears',
      );
    });
  });
});
