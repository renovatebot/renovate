import { partial } from '../../../../../test/util';
import * as allVersioning from '../../../../modules/versioning';
import { filterVersions } from './filter';
import type { FilterConfig } from './types';

const versioning = allVersioning.get('semver');

const releases = [
  {
    version: '1.0.1',
    releaseTimestamp: '2021-01-01T00:00:01.000Z',
  },
  {
    version: '1.2.0',
    releaseTimestamp: '2021-01-03T00:00:00.000Z',
  },
  {
    version: '2.0.0',
    releaseTimestamp: '2021-01-05T00:00:00.000Z',
  },
  {
    version: '2.1.0',
    releaseTimestamp: '2021-01-07T00:00:00.000Z',
  },
  // for coverage
  {
    version: 'invalid.version',
    releaseTimestamp: '2021-01-07T00:00:00.000Z',
  },
];

describe('workers/repository/process/lookup/filter', () => {
  describe('.filterVersions()', () => {
    it('should filter versions allowed by semver syntax when allowedVersions is not valid version, range or pypi syntax', () => {
      const config = partial<FilterConfig>({
        ignoreUnstable: false,
        ignoreDeprecated: false,
        respectLatest: false,
        allowedVersions: '>1',
      });
      const currentVersion = '1.0.0';
      const latestVersion = '2.0.0';

      jest.spyOn(versioning, 'isVersion').mockReturnValue(true);
      jest.spyOn(versioning, 'isGreaterThan').mockReturnValue(true);

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        versioning,
      );

      expect(filteredVersions).toEqual([
        { version: '2.0.0', releaseTimestamp: '2021-01-05T00:00:00.000Z' },
        { version: '2.1.0', releaseTimestamp: '2021-01-07T00:00:00.000Z' },
      ]);
    });
  });
});
