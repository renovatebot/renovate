import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import type { Release } from '../../../../modules/datasource/types';
import * as allVersioning from '../../../../modules/versioning';
import type { Timestamp } from '../../../../util/timestamp';
import { filterVersions } from './filter';
import type { FilterConfig } from './types';
import { partial } from '~test/util';

const versioning = allVersioning.get('semver');

describe('workers/repository/process/lookup/filter', () => {
  describe('.filterVersions()', () => {
    it('should filter versions allowed by semver syntax when allowedVersions is not valid version, range or pypi syntax', () => {
      const releases = [
        {
          version: '1.0.1',
          releaseTimestamp: '2021-01-01T00:00:01.000Z' as Timestamp,
        },
        {
          version: '1.2.0',
          releaseTimestamp: '2021-01-03T00:00:00.000Z' as Timestamp,
        },
        {
          version: '2.0.0',
          releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
        },
        {
          version: '2.1.0',
          releaseTimestamp: '2021-01-07T00:00:00.000Z' as Timestamp,
        },
        // for coverage
        {
          version: 'invalid.version',
          releaseTimestamp: '2021-01-07T00:00:00.000Z' as Timestamp,
        },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        ignoreUnstable: false,
        ignoreDeprecated: false,
        respectLatest: false,
        allowedVersions: '>1',
      });
      const currentVersion = '1.0.0';
      const latestVersion = '2.0.0';

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

    it('should filter versions allowed by allowedMinimumReleaseAge', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const releases = [
        {
          version: '1.0.1',
          // No releaseTimestamp means we cannot filter it out
        },
        {
          version: '1.0.2',
          releaseTimestamp: lastWeek.toISOString() as Timestamp,
        },
        {
          version: '1.2.0',
          releaseTimestamp: yesterday.toISOString() as Timestamp,
        },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        ignoreUnstable: false,
        ignoreDeprecated: false,
        respectLatest: false,
        allowedMinimumReleaseAge: '3 days',
      });
      const currentVersion = '1.0.0';
      const latestVersion = '1.2.0';

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        versioning,
      );

      expect(filteredVersions).toEqual([
        { version: '1.0.1' },
        {
          version: '1.0.2',
          releaseTimestamp: lastWeek.toISOString() as Timestamp,
        },
      ]);
    });

    it('throws if allowedMinimumReleaseAge has an invalid value', () => {
      const releases = [
        {
          version: '1.0.1',
          releaseTimestamp: '2021-01-01T00:00:01.000Z' as Timestamp,
        },
        {
          version: '1.2.0',
          releaseTimestamp: '2021-01-03T00:00:00.000Z' as Timestamp,
        },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        ignoreUnstable: false,
        ignoreDeprecated: false,
        respectLatest: false,
        allowedMinimumReleaseAge: 'not a duration',
      });
      const currentVersion = '1.0.0';
      const latestVersion = '1.2.0';

      expect(() =>
        filterVersions(
          config,
          currentVersion,
          latestVersion,
          releases,
          versioning,
        ),
      ).toThrow(CONFIG_VALIDATION);
    });

    it('allows unstable major upgrades', () => {
      const nodeVersioning = allVersioning.get('node');

      const releases = [
        { version: '1.0.0-alpha' },
        { version: '1.2.3-beta' },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        ignoreUnstable: true,
        ignoreDeprecated: true,
      });
      const currentVersion = '1.0.0-alpha';
      const latestVersion = '1.2.3-beta';

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        nodeVersioning,
      );

      expect(filteredVersions).toEqual([{ version: '1.2.3-beta' }]);
    });

    it('ignores version insufficient prefixes', () => {
      const releases = [
        { version: '1.0.1' },
        { version: '1.2.0' },
        { version: '2.0.0', isDeprecated: true },
        { version: '2.1.0' },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        ignoreUnstable: true,
        ignoreDeprecated: true,
      });
      const currentVersion = 'v1.0.1';
      const latestVersion = 'v2.0.0';

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        versioning,
      );

      expect(filteredVersions).toEqual([
        { version: '1.2.0' },
        { version: '2.1.0' },
      ]);
    });
  });
});
