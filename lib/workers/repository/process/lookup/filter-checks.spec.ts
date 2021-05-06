import { getConfig, getName, mocked } from '../../../../../test/util';
import { Release } from '../../../../datasource';
import { clone } from '../../../../util/clone';
import * as _dateUtil from '../../../../util/date';
import * as allVersioning from '../../../../versioning';
import { filterInternalChecks } from './filter-checks';
import { LookupUpdateConfig, UpdateResult } from './types';

jest.mock('../../../../util/date');

const dateUtil = mocked(_dateUtil);

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

describe(getName(), () => {
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
    it('returns latest release if internalChecksFilter=none', () => {
      const res = filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toHaveLength(0);
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release.version).toEqual('1.0.4');
    });
    it('returns non-pending latest release if internalChecksFilter=flexible and none pass checks', () => {
      config.internalChecksFilter = 'flexible';
      config.stabilityDays = 10;
      const res = filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toHaveLength(0);
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release.version).toEqual('1.0.4');
    });
    it('returns pending latest release if internalChecksFilter=strict and none pass checks', () => {
      config.internalChecksFilter = 'strict';
      config.stabilityDays = 10;
      const res = filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toHaveLength(1);
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release.version).toEqual('1.0.4');
    });
    it('returns non-latest release if internalChecksFilter=strict and some pass checks', () => {
      config.internalChecksFilter = 'strict';
      config.stabilityDays = 6;
      const res = filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toHaveLength(0);
      expect(res.pendingReleases).toHaveLength(2);
      expect(res.release.version).toEqual('1.0.2');
    });
    it('returns non-latest release if internalChecksFilter=flexible and some pass checks', () => {
      config.internalChecksFilter = 'strict';
      config.stabilityDays = 6;
      const res = filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toHaveLength(0);
      expect(res.pendingReleases).toHaveLength(2);
      expect(res.release.version).toEqual('1.0.2');
    });
    it('picks up stabilityDays settings from hostRules', () => {
      config.internalChecksFilter = 'strict';
      config.stabilityDays = 6;
      config.packageRules = [{ matchUpdateTypes: ['patch'], stabilityDays: 1 }];
      const res = filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toHaveLength(0);
      expect(res.pendingReleases).toHaveLength(0);
      expect(res.release.version).toEqual('1.0.4');
    });
    it('picks up stabilityDays settings from updateType', () => {
      config.internalChecksFilter = 'strict';
      config.patch = { stabilityDays: 4 };
      const res = filterInternalChecks(
        config,
        versioning,
        'patch',
        sortedReleases
      );
      expect(res).toMatchSnapshot();
      expect(res.pendingChecks).toHaveLength(0);
      expect(res.pendingReleases).toHaveLength(1);
      expect(res.release.version).toEqual('1.0.3');
    });
  });
});
