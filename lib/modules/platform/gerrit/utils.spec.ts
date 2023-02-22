import { Fixtures } from '../../../../test/fixtures';
import { mocked } from '../../../../test/util';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import type { BranchStatus } from '../../../types';
import * as _hostRules from '../../../util/host-rules';
import { setBaseUrl } from '../../../util/http/gerrit';
import type { GerritChangeStatus, GerritLabelTypeInfo } from './types';
import * as utils from './utils';
import { mapBranchStatusToLabel } from './utils';

jest.mock('../../../util/host-rules');

const baseUrl = 'https://gerrit.example.com';
const hostRules = mocked(_hostRules);

describe('modules/platform/gerrit/utils', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../../util/host-rules');

    setBaseUrl(baseUrl);
  });

  describe('getGerritRepoUrl()', () => {
    it('create a git url with username/password', () => {
      hostRules.find.mockReturnValue({
        username: 'abc',
        password: '123',
      });
      const repoUrl = utils.getGerritRepoUrl('web/apps', baseUrl);
      expect(repoUrl).toBe('https://abc:123@gerrit.example.com/a/web/apps');
    });

    it('create a git url without username/password', () => {
      hostRules.find.mockReturnValue({});
      const repoUrl = utils.getGerritRepoUrl('web/apps', baseUrl);
      expect(repoUrl).toBe('https://gerrit.example.com/a/web/apps');
    });

    it('throws on invalid endpoint', () => {
      expect(() => utils.getGerritRepoUrl('web/apps', '...')).toThrow(
        Error(CONFIG_GIT_URL_UNAVAILABLE)
      );
    });
  });

  describe('mapPrStateToGerritFilter()', () => {
    it.each([
      ['closed', 'status:closed'],
      ['merged', 'status:merged'],
      ['!open', '-status:open'],
      ['open', 'status:open'],
      ['all', '-is:wip'],
      [undefined, '-is:wip'],
    ])(
      'maps pr state %p to gerrit filter %p',
      (prState: any | undefined, filter: string) => {
        expect(utils.mapPrStateToGerritFilter(prState)).toEqual(filter);
      }
    );
  });

  describe('mapGerritChangeStateToPrState()', () => {
    it.each([
      ['NEW' as GerritChangeStatus, 'open'],
      ['MERGED' as GerritChangeStatus, 'merged'],
      ['ABANDONED' as GerritChangeStatus, 'closed'],
    ])(
      'maps gerrit change state %p to PrState %p',
      (state: GerritChangeStatus, prState: any) => {
        expect(utils.mapGerritChangeStateToPrState(state)).toEqual(prState);
      }
    );
  });

  describe('mapGerritChangeToPr()', () => {
    it('map a gerrit change to to Pr', () => {
      expect(
        utils.mapGerritChangeToPr(Fixtures.getJson('change-data.json'))
      ).toMatchSnapshot();
    });

    it('map a gerrit change without sourceBranch-tag to Pr', () => {
      const change = Fixtures.getJson('change-data.json');
      change.hashtags = [];
      expect(utils.mapGerritChangeToPr(change)).toMatchSnapshot();
    });
  });

  describe('extractSourceBranch()', () => {
    it('extract source branch from existing gerrit change', () => {
      expect(
        utils.extractSourceBranch(Fixtures.getJson('change-data.json'))
      ).toMatchSnapshot();
    });
  });

  describe('findPullRequestBody()', () => {
    it('find pull-request-body', () => {
      expect(
        utils.findPullRequestBody(Fixtures.getJson('change-data.json'))
      ).toBe('Last PR-Body');
    });

    it('no pull-request-body message found', () => {
      const change = Fixtures.getJson('change-data.json');
      change.messages = undefined;
      expect(utils.findPullRequestBody(change)).toBeUndefined();
      change.messages = [];
      expect(utils.findPullRequestBody(change)).toBeUndefined();
      change.messages = [{ tag: 'other-tag', message: 'message' }];
      expect(utils.findPullRequestBody(change)).toBeUndefined();
    });
  });

  describe('mapBranchStatusToLabel()', () => {
    const labelWithOne: GerritLabelTypeInfo = {
      values: { '-1': 'rejected', '0': 'default', '1': 'accepted' },
      default_value: 0,
    };

    it.each([
      ['red' as BranchStatus, -1],
      ['yellow' as BranchStatus, -1],
      ['green' as BranchStatus, 1],
    ])(
      'Label with +1/-1 map branchState=%p to %p',
      (branchState, expectedValue) => {
        expect(mapBranchStatusToLabel(branchState, labelWithOne)).toEqual(
          expectedValue
        );
      }
    );

    const labelWithTwo: GerritLabelTypeInfo = {
      values: {
        '-2': 'rejected',
        '-1': 'disliked',
        '0': 'default',
        '1': 'looksOkay',
        '2': 'approved',
      },
      default_value: 0,
    };

    it.each([
      ['red' as BranchStatus, -2],
      ['yellow' as BranchStatus, -2],
      ['green' as BranchStatus, 2],
    ])(
      'Label with +2/-2, map branchState=%p to %p',
      (branchState, expectedValue) => {
        expect(mapBranchStatusToLabel(branchState, labelWithTwo)).toEqual(
          expectedValue
        );
      }
    );
  });
});
