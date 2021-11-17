import { getConfig, mocked } from '../../../../../test/util';
import type { Release } from '../../../../datasource';
import { clone } from '../../../../util/clone';
import * as _dateUtil from '../../../../util/date';
import * as _mergeConfidence from '../../../../util/merge-confidence';
import * as allVersioning from '../../../../versioning';
import { filterInternalChecks } from './filter-checks';
import type { LookupUpdateConfig, UpdateResult } from './types';

jest.mock('../../../../util/date');
jest.mock('../../../../util/merge-confidence');

const dateUtil = mocked(_dateUtil);
const mergeConfidence = mocked(_mergeConfidence);

let config: Partial<LookupUpdateConfig & UpdateResult>;

const versioning = allVersioning.get('semver');

const releases: Release[] = [
  {
    version: '1.0.1',
    releaseTimestamp: '2021-01-01T00:00:01.000Z',
  },
  {
    version: '1.0.2',
    releaseTimestamp: '2021-01-03T00:00:00.000Z',
  },
  {
    version: '1.0.3',
    releaseTimestamp: '2021-01-05T00:00:00.000Z',
  },
  {
    version: '1.0.4',
    releaseTimestamp: '2021-01-07T00:00:00.000Z',
  },
];

describe('workers/repository/process/lookup/filter-checks', () => {
  let sortedReleases: Release[];
  beforeEach(() => {
    config = getConfig();
    config.currentVersion = '1.0.0';
    sortedReleases = clone(releases);
    jest.resetAllMocks();
    dateUtil.getElapsedDays.mockReturnValueOnce(3);
    dateUtil.getElapsedDays.mockReturnValueOnce(5);
    dateUtil.getElapsedDays.mockReturnValueOnce(7);
    dateUtil.getElapsedDays.mockReturnValueOnce(9);
  });

  describe('.filterInternalChecks()', () => {
    it('returns latest release if internalChecksFilter=none', async () => {
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release.version).toBe('1.0.4');
    });

    it('returns non-pending latest release if internalChecksFilter=flexible and none pass checks', async () => {
      config.internalChecksFilter = 'flexible';
      config.stabilityDays = 10;
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release.version).toBe('1.0.4');
    });

    it('returns pending latest release if internalChecksFilter=strict and none pass checks', async () => {
      config.internalChecksFilter = 'strict';
      config.stabilityDays = 10;
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toBeTrue();
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release.version).toBe('1.0.4');
    });

    it('returns non-latest release if internalChecksFilter=strict and some pass checks', async () => {
      config.internalChecksFilter = 'strict';
      config.stabilityDays = 6;
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(2);
      expect(res.release.version).toBe('1.0.2');
    });

    it('returns non-latest release if internalChecksFilter=flexible and some pass checks', async () => {
      config.internalChecksFilter = 'strict';
      config.stabilityDays = 6;
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(2);
      expect(res.release.version).toBe('1.0.2');
    });

    it('picks up stabilityDays settings from hostRules', async () => {
      config.internalChecksFilter = 'strict';
      config.stabilityDays = 6;
      config.packageRules = [{ matchUpdateTypes: ['patch'], stabilityDays: 1 }];
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release.version).toBe('1.0.4');
    });

    it('picks up stabilityDays settings from updateType', async () => {
      config.internalChecksFilter = 'strict';
      config.patch = { stabilityDays: 4 };
      const res = await filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(1);
      expect(res.release.version).toBe('1.0.3');
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
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toBeFalse();
      expect(res.pendingReleases).toHaveLength(3);
      expect(res.release.version).toBe('1.0.1');
    });
  });
});
