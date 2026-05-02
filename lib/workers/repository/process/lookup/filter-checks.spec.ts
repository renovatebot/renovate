import * as _datasourceCommon from '../../../../modules/datasource/common.ts';
import { Datasource } from '../../../../modules/datasource/datasource.ts';
import type {
  GetReleasesConfig,
  PostprocessReleaseConfig,
  PostprocessReleaseResult,
  Release,
  ReleaseResult,
} from '../../../../modules/datasource/index.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import { clone } from '../../../../util/clone.ts';
import * as _dateUtil from '../../../../util/date.ts';
import * as _mergeConfidence from '../../../../util/merge-confidence/index.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import type { Timestamp } from '../../../../util/timestamp.ts';
import { filterInternalChecks } from './filter-checks.ts';
import type { LookupUpdateConfig, UpdateResult } from './types.ts';

vi.mock('../../../../util/date.ts');
const dateUtil = vi.mocked(_dateUtil);

vi.mock('../../../../util/merge-confidence/index.ts');
const mergeConfidence = vi.mocked(_mergeConfidence);

vi.mock('../../../../modules/datasource/common.ts');
const { getDatasourceFor } = vi.mocked(_datasourceCommon);

class DummyDatasource extends Datasource {
  constructor() {
    super('some-datasource');
  }

  override getReleases(_: GetReleasesConfig): Promise<ReleaseResult | null> {
    return Promise.resolve(null);
  }
}

let config: Partial<LookupUpdateConfig & UpdateResult>;

const versioning = allVersioning.get('semver');

const releases: Release[] = [
  {
    version: '1.0.1',
    releaseTimestamp: '2021-01-01T00:00:01.000Z' as Timestamp,
  },
  {
    version: '1.0.2',
    releaseTimestamp: '2021-01-03T00:00:00.000Z' as Timestamp,
  },
  {
    version: '1.0.3',
    releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
  },
  {
    version: '1.0.4',
    releaseTimestamp: '2021-01-07T00:00:00.000Z' as Timestamp,
  },
];

describe('workers/repository/process/lookup/filter-checks', () => {
  let sortedReleases: Release[];

  beforeEach(() => {
    config = { currentVersion: '1.0.0' };
    sortedReleases = clone(releases);
    dateUtil.getElapsedMs.mockReturnValueOnce(toMs('3 days') ?? 0);
    dateUtil.getElapsedMs.mockReturnValueOnce(toMs('5 days') ?? 0);
    dateUtil.getElapsedMs.mockReturnValueOnce(toMs('7 days') ?? 0);
    dateUtil.getElapsedMs.mockReturnValueOnce(toMs('9 days') ?? 0);
  });

  describe('.filterInternalChecks()', () => {
    it('returns latest release if internalChecksFilter=none', async () => {
      config.internalChecksFilter = 'none';
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release?.version).toBe('1.0.4');
    });

    it('uses datasource-level interception mechanism', async () => {
      config.datasource = 'some-datasource';
      config.packageName = 'some-package';
      config.internalChecksFilter = 'strict';

      class SomeDatasource extends DummyDatasource {
        override postprocessRelease(
          _: PostprocessReleaseConfig,
          release: Release,
        ): Promise<PostprocessReleaseResult> {
          if (release.version !== '1.0.2') {
            return Promise.resolve('reject');
          }

          release.isStable = true;
          return Promise.resolve(release);
        }
      }
      getDatasourceFor.mockReturnValue(new SomeDatasource());

      const { release } = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );

      expect(release).toEqual({
        version: '1.0.2',
        releaseTimestamp: '2021-01-03T00:00:00.000Z',
        isStable: true,
      });
    });

    it('returns non-pending latest release if internalChecksFilter=flexible and none pass checks', async () => {
      config.internalChecksFilter = 'flexible';
      config.minimumReleaseAge = '10 days';
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release?.version).toBe('1.0.4');
    });

    it('returns pending latest release if internalChecksFilter=strict and none pass checks', async () => {
      config.internalChecksFilter = 'strict';
      config.minimumReleaseAge = '10 days';
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );
      expect(res.pendingChecks).toBeTrue();
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release?.version).toBe('1.0.4');
    });

    it('returns non-latest release if internalChecksFilter=strict and some pass checks', async () => {
      config.internalChecksFilter = 'strict';
      config.minimumReleaseAge = '6 days';
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(2);
      expect(res.release?.version).toBe('1.0.2');
    });

    it('returns non-latest release if internalChecksFilter=flexible and some pass checks', async () => {
      config.internalChecksFilter = 'flexible';
      config.minimumReleaseAge = '6 days';
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(2);
      expect(res.release?.version).toBe('1.0.2');
    });

    it('picks up minimumReleaseAge settings from packageRules', async () => {
      config.internalChecksFilter = 'strict';
      config.minimumReleaseAge = '6 days';
      config.packageRules = [
        { matchUpdateTypes: ['patch'], minimumReleaseAge: '1 day' },
      ];
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release?.version).toBe('1.0.4');
    });

    it('picks up minimumReleaseAge settings from updateType', async () => {
      config.internalChecksFilter = 'strict';
      config.patch = { minimumReleaseAge: '4 days' };
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(1);
      expect(res.release?.version).toBe('1.0.3');
    });

    describe('if internalChecksFilter=strict, minimumReleaseAge is specified, and the latest release does not have a releaseTimestamp', () => {
      beforeEach(() => {
        // NOTE that we need to reset the existing test set up to make sure that we call `getElapsedMs` in the right order
        dateUtil.getElapsedMs.mockReset();
        // NOTE that we do NOT want to return 3 days, as we want the first release that has a timestamp (1.0.3) to be within the `minimumReleaseAge=4 days`
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('5 days') ?? 0);
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('7 days') ?? 0);
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('9 days') ?? 0);
      });

      it('does not return the latest release, if minimumReleaseAgeBehaviour=timestamp-required', async () => {
        const releasesWithMissingReleaseTimestamp: Release[] = [
          {
            version: '1.0.1',
            releaseTimestamp: '2021-01-01T00:00:01.000Z' as Timestamp,
          },
          {
            version: '1.0.2',
            releaseTimestamp: '2021-01-03T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.0.3',
            releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.0.4',
            // no releaseTimestamp
          },
        ];

        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = '4 days';
        config.minimumReleaseAgeBehaviour = 'timestamp-required';
        const res = await filterInternalChecks(
          config,
          versioning,
          'patch',
          releasesWithMissingReleaseTimestamp,
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(1);
        expect(res.release?.version).toBe('1.0.3');
      });

      it('returns the latest release, if minimumReleaseAgeBehaviour=timestamp-optional', async () => {
        const releasesWithMissingReleaseTimestamp: Release[] = [
          {
            version: '1.0.1',
            releaseTimestamp: '2021-01-01T00:00:01.000Z' as Timestamp,
          },
          {
            version: '1.0.2',
            releaseTimestamp: '2021-01-03T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.0.3',
            releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.0.4',
            // no releaseTimestamp
          },
        ];

        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = '100 days';
        config.minimumReleaseAgeBehaviour = 'timestamp-optional';
        const res = await filterInternalChecks(
          config,
          versioning,
          'patch',
          releasesWithMissingReleaseTimestamp,
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(0);
        expect(res.release?.version).toBe('1.0.4');
      });

      it('returns latest release, if minimumReleaseAgeBehaviour=timestamp-required but minimumReleaseAge=0 days', async () => {
        const releasesWithMissingReleaseTimestamp: Release[] = [
          {
            version: '1.0.1',
            releaseTimestamp: '2021-01-01T00:00:01.000Z' as Timestamp,
          },
          {
            version: '1.0.2',
            releaseTimestamp: '2021-01-03T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.0.3',
            releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.0.4',
            // no releaseTimestamp
          },
        ];

        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = '0 days';
        config.minimumReleaseAgeBehaviour = 'timestamp-required';
        const res = await filterInternalChecks(
          config,
          versioning,
          'patch',
          releasesWithMissingReleaseTimestamp,
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(0);
        expect(res.release?.version).toBe('1.0.4');
      });
    });

    it('picks up minimumConfidence settings from updateType', async () => {
      config.internalChecksFilter = 'strict';
      config.minimumConfidence = 'high';
      mergeConfidence.isActiveConfidenceLevel.mockReturnValue(true);
      mergeConfidence.satisfiesConfidenceLevel.mockReturnValueOnce(false);
      mergeConfidence.satisfiesConfidenceLevel.mockReturnValueOnce(false);
      mergeConfidence.satisfiesConfidenceLevel.mockReturnValueOnce(false);
      mergeConfidence.satisfiesConfidenceLevel.mockReturnValueOnce(true);
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases,
      );
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(3);
      expect(res.release?.version).toBe('1.0.1');
    });

    describe('minimumReleaseAge object form with delayMinor key', () => {
      const minorReleases: Release[] = [
        {
          version: '1.0.1',
          releaseTimestamp: '2021-01-01T00:00:00.000Z' as Timestamp,
        },
        {
          version: '1.1.0',
          releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
        },
        {
          version: '1.1.1',
          releaseTimestamp: '2021-01-06T00:00:00.000Z' as Timestamp,
        },
        {
          version: '1.1.3',
          releaseTimestamp: '2021-01-08T00:00:00.000Z' as Timestamp,
        },
      ];

      beforeEach(() => {
        dateUtil.getElapsedMs.mockReset();
      });

      it('blocks new minor versions that are not old enough', async () => {
        // Loop order (highest to lowest): 1.1.3, 1.1.1, 1.1.0, 1.0.1
        // For 1.1.3: version group check against 1.1.0 timestamp → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 1.1.1: version group check against 1.1.0 timestamp → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 1.1.0: version group check against 1.1.0 timestamp → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 1.0.1: same minor as current (1.0) → no check needed

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMinor: '7 days' };

        const res = await filterInternalChecks(
          config,
          versioning,
          'minor',
          clone(minorReleases),
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(3);
        expect(res.release?.version).toBe('1.0.1');
      });

      it('allows minor versions that are old enough and picks latest patch', async () => {
        // Loop order (highest to lowest): 1.1.3, 1.1.1, 1.1.0, 1.0.1
        // For 1.1.3: version group check against 1.1.0 timestamp → 8 days (old enough)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('8 days') ?? 0);

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMinor: '7 days' };

        const res = await filterInternalChecks(
          config,
          versioning,
          'minor',
          clone(minorReleases),
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(0);
        expect(res.release?.version).toBe('1.1.3');
      });

      it('falls back to latest patch of older mature minor when latest minor is too young', async () => {
        const multiMinorReleases: Release[] = [
          {
            version: '1.0.1',
            releaseTimestamp: '2021-01-01T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.1.0',
            releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.1.1',
            releaseTimestamp: '2021-01-06T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.2.0',
            releaseTimestamp: '2021-01-10T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.2.1',
            releaseTimestamp: '2021-01-11T00:00:00.000Z' as Timestamp,
          },
        ];
        // Loop order: 1.2.1, 1.2.0, 1.1.1, 1.1.0, 1.0.1
        // For 1.2.1: version group check against 1.2.0 → 3 days (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('3 days') ?? 0);
        // For 1.2.0: version group check against 1.2.0 → 3 days (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('3 days') ?? 0);
        // For 1.1.1: version group check against 1.1.0 → 8 days (old enough)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('8 days') ?? 0);

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMinor: '7 days' };

        const res = await filterInternalChecks(
          config,
          versioning,
          'minor',
          multiMinorReleases,
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(2);
        expect(res.release?.version).toBe('1.1.1');
      });

      it('does not apply to patch updates within the same minor version', async () => {
        // Current is 1.1.0, candidates are all 1.1.x (same minor)
        // No getElapsedMs calls needed since version group check won't apply to same minor

        config.currentVersion = '1.1.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMinor: '7 days' };

        const patchReleases: Release[] = [
          {
            version: '1.1.1',
            releaseTimestamp: '2021-01-06T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.1.3',
            releaseTimestamp: '2021-01-08T00:00:00.000Z' as Timestamp,
          },
        ];

        const res = await filterInternalChecks(
          config,
          versioning,
          'patch',
          patchReleases,
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(0);
        expect(res.release?.version).toBe('1.1.3');
      });

      it('works together with default minimumReleaseAge', async () => {
        // Loop order: 1.1.3, 1.1.1, 1.1.0, 1.0.1
        // For 1.1.3: default minimumReleaseAge check → 2 days (too young, needs 3 days) → pending
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('2 days') ?? 0);
        // For 1.1.1: default minimumReleaseAge check → 4 days (old enough)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('4 days') ?? 0);
        // For 1.1.1: version group check against 1.1.0 → 8 days (old enough)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('8 days') ?? 0);

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { default: '3 days', delayMinor: '7 days' };

        const res = await filterInternalChecks(
          config,
          versioning,
          'minor',
          clone(minorReleases),
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(1);
        expect(res.release?.version).toBe('1.1.1');
      });

      it('picks up minimumReleaseAge object from packageRules', async () => {
        // For 1.1.3: version group check against 1.1.0 → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 1.1.1: version group check against 1.1.0 → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 1.1.0: version group check against 1.1.0 → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.packageRules = [
          {
            matchUpdateTypes: ['minor'],
            minimumReleaseAge: { delayMinor: '7 days' } as any,
          },
        ];

        const res = await filterInternalChecks(
          config,
          versioning,
          'minor',
          clone(minorReleases),
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(3);
        expect(res.release?.version).toBe('1.0.1');
      });

      it('returns pending latest release if all minor versions are too young with internalChecksFilter=strict', async () => {
        const allNewMinorReleases: Release[] = [
          {
            version: '1.1.0',
            releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.1.1',
            releaseTimestamp: '2021-01-06T00:00:00.000Z' as Timestamp,
          },
        ];
        // For 1.1.1: version group check → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 1.1.0: version group check → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMinor: '7 days' };

        const res = await filterInternalChecks(
          config,
          versioning,
          'minor',
          allNewMinorReleases,
        );
        expect(res.pendingChecks).toBeTrue();
        expect(res.pendingReleases).toHaveLength(0);
        expect(res.release?.version).toBe('1.1.1');
      });

      it('blocks minor versions with missing first-release timestamp when minimumReleaseAgeBehaviour=timestamp-required', async () => {
        const releasesWithMissingTimestamp: Release[] = [
          {
            version: '1.0.1',
            releaseTimestamp: '2021-01-01T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.1.0',
            // no releaseTimestamp for the first release in minor 1.1
          },
          {
            version: '1.1.1',
            releaseTimestamp: '2021-01-06T00:00:00.000Z' as Timestamp,
          },
        ];

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMinor: '7 days' };
        config.minimumReleaseAgeBehaviour = 'timestamp-required';

        const res = await filterInternalChecks(
          config,
          versioning,
          'minor',
          releasesWithMissingTimestamp,
        );
        // Both 1.1.1 and 1.1.0 should be pending because 1.1.0 has no timestamp
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(2);
        expect(res.release?.version).toBe('1.0.1');
      });
    });

    describe('minimumReleaseAge object form with delayMajor key', () => {
      const majorReleases: Release[] = [
        {
          version: '1.0.1',
          releaseTimestamp: '2021-01-01T00:00:00.000Z' as Timestamp,
        },
        {
          version: '2.0.0',
          releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
        },
        {
          version: '2.0.1',
          releaseTimestamp: '2021-01-06T00:00:00.000Z' as Timestamp,
        },
        {
          version: '2.1.0',
          releaseTimestamp: '2021-01-08T00:00:00.000Z' as Timestamp,
        },
      ];

      beforeEach(() => {
        dateUtil.getElapsedMs.mockReset();
      });

      it('blocks new major versions that are not old enough', async () => {
        // Loop order (highest to lowest): 2.1.0, 2.0.1, 2.0.0, 1.0.1
        // For 2.1.0: version group check against 2.0.0 timestamp → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 2.0.1: version group check against 2.0.0 timestamp → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 2.0.0: version group check against 2.0.0 timestamp → 1 day (too young)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
        // For 1.0.1: same major as current (1) → no check needed

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMajor: '7 days' };

        const res = await filterInternalChecks(
          config,
          versioning,
          'major',
          clone(majorReleases),
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(3);
        expect(res.release?.version).toBe('1.0.1');
      });

      it('allows major versions that are old enough', async () => {
        // For 2.1.0: version group check against 2.0.0 → 8 days (old enough)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('8 days') ?? 0);

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMajor: '7 days' };

        const res = await filterInternalChecks(
          config,
          versioning,
          'major',
          clone(majorReleases),
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(0);
        expect(res.release?.version).toBe('2.1.0');
      });

      it('blocks major versions with missing first-release timestamp when minimumReleaseAgeBehaviour=timestamp-required', async () => {
        const releasesWithMissingTimestamp: Release[] = [
          {
            version: '1.0.1',
            releaseTimestamp: '2021-01-01T00:00:00.000Z' as Timestamp,
          },
          {
            version: '2.0.0',
            // no releaseTimestamp for the first release in major 2
          },
          {
            version: '2.0.1',
            releaseTimestamp: '2021-01-06T00:00:00.000Z' as Timestamp,
          },
        ];

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayMajor: '7 days' };
        config.minimumReleaseAgeBehaviour = 'timestamp-required';

        const res = await filterInternalChecks(
          config,
          versioning,
          'major',
          releasesWithMissingTimestamp,
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(2);
        expect(res.release?.version).toBe('1.0.1');
      });
    });

    describe('minimumReleaseAge object form with delayPatch key', () => {
      beforeEach(() => {
        dateUtil.getElapsedMs.mockReset();
      });

      it('applies delayPatch to patch updates', async () => {
        const patchReleases: Release[] = [
          {
            version: '1.0.1',
            releaseTimestamp: '2021-01-01T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.0.2',
            releaseTimestamp: '2021-01-05T00:00:00.000Z' as Timestamp,
          },
          {
            version: '1.0.3',
            releaseTimestamp: '2021-01-08T00:00:00.000Z' as Timestamp,
          },
        ];
        // Loop order: 1.0.3, 1.0.2, 1.0.1
        // For 1.0.3: individual release check → 2 days (too young, needs 3 days)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('2 days') ?? 0);
        // For 1.0.2: individual release check → 5 days (old enough)
        dateUtil.getElapsedMs.mockReturnValueOnce(toMs('5 days') ?? 0);

        config.currentVersion = '1.0.0';
        config.internalChecksFilter = 'strict';
        config.minimumReleaseAge = { delayPatch: '3 days' };

        const res = await filterInternalChecks(
          config,
          versioning,
          'patch',
          patchReleases,
        );
        expect(res.pendingChecks).toBeFalse();
        expect(res.pendingReleases).toHaveLength(1);
        expect(res.release?.version).toBe('1.0.2');
      });
    });
  });
});
