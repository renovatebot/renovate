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

    it('should filter versions when allowedVersions templating is used', () => {
      const releases = [
        {
          version: '1.1.0',
          releaseTimestamp: '2021-01-01T00:00:01.000Z' as Timestamp,
        },
        {
          version: '1.2.0',
          releaseTimestamp: '2021-01-03T00:00:00.000Z' as Timestamp,
        },
        {
          version: '1.3.0',
          releaseTimestamp: '2021-01-03T00:00:00.000Z' as Timestamp,
        },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        ignoreUnstable: false,
        ignoreDeprecated: false,
        respectLatest: false,
        allowedVersions: '<={{major}}.{{add minor 1}}.{{patch}}',
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
        { version: '1.1.0', releaseTimestamp: '2021-01-01T00:00:01.000Z' },
      ]);
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

    it('single version range, but invalid current version (for coverage)', () => {
      const mavenVersioning = allVersioning.get('maven');

      const releases = [
        { version: '1.0.1' },
        { version: '1.2.0' },
        { version: '2.0.0' },
        { version: '2.2.0' },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        ignoreUnstable: false,
        ignoreDeprecated: false,
        respectLatest: true,
      });
      // valid version range, but invalid version
      const currentVersion = '[1.0.1]';
      const latestVersion = '2.0.0';

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        mavenVersioning,
      );

      expect(filteredVersions).toEqual([
        { version: '1.0.1' },
        { version: '1.2.0' },
        { version: '2.0.0' },
      ]);
    });

    it('filters versions with major increment greater than maxMajorIncrement', () => {
      const releases = [
        { version: '19.2.0' },
        { version: '20.0.0' },
        { version: '21.0.0' },
        { version: '2023.3.3' },
        { version: '2024.1.1' },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        maxMajorIncrement: 50,
      });
      const currentVersion = '19.2.0';
      const latestVersion = '2024.1.1';

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        versioning,
      );

      expect(filteredVersions).toEqual([
        { version: '20.0.0' },
        { version: '21.0.0' },
      ]);
    });

    it('allows all versions when maxMajorIncrement is 0', () => {
      const releases = [
        { version: '19.2.0' },
        { version: '20.0.0' },
        { version: '2023.3.3' },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        maxMajorIncrement: 0,
      });
      const currentVersion = '19.2.0';
      const latestVersion = '2023.3.3';

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        versioning,
      );

      expect(filteredVersions).toEqual([
        { version: '20.0.0' },
        { version: '2023.3.3' },
      ]);
    });

    it('filters with maxMajorIncrement set to 1', () => {
      const releases = [
        { version: '1.0.1' },
        { version: '1.2.0' },
        { version: '2.0.0' },
        { version: '3.0.0' },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        maxMajorIncrement: 1,
      });
      const currentVersion = '1.0.0';
      const latestVersion = '3.0.0';

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        versioning,
      );

      expect(filteredVersions).toEqual([
        { version: '1.0.1' },
        { version: '1.2.0' },
        { version: '2.0.0' },
      ]);
    });

    it('handles maxMajorIncrement with 0.x versions', () => {
      const releases = [
        { version: '0.1.0' },
        { version: '0.2.0' },
        { version: '1.0.0' },
        { version: '2.0.0' },
      ] satisfies Release[];

      const config = partial<FilterConfig>({
        maxMajorIncrement: 1,
      });
      const currentVersion = '0.0.1';
      const latestVersion = '2.0.0';

      const filteredVersions = filterVersions(
        config,
        currentVersion,
        latestVersion,
        releases,
        versioning,
      );

      expect(filteredVersions).toEqual([
        { version: '0.1.0' },
        { version: '0.2.0' },
        { version: '1.0.0' },
      ]);
    });
  });
});
