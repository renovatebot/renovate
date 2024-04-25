import { mocked, partial } from '../../../../test/util';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import type { BranchStatus } from '../../../types';
import * as _hostRules from '../../../util/host-rules';
import { setBaseUrl } from '../../../util/http/gerrit';
import { hashBody } from '../pr-body';
import type {
  GerritAccountInfo,
  GerritChange,
  GerritChangeMessageInfo,
  GerritChangeStatus,
  GerritLabelTypeInfo,
} from './types';
import * as utils from './utils';
import { mapBranchStatusToLabel } from './utils';

jest.mock('../../../util/host-rules');

const baseUrl = 'https://gerrit.example.com';
const hostRules = mocked(_hostRules);

describe('modules/platform/gerrit/utils', () => {
  beforeEach(() => {
    setBaseUrl(baseUrl);
  });

  describe('getGerritRepoUrl()', () => {
    it('create a git url with username/password', () => {
      hostRules.find.mockReturnValue({
        username: 'abc',
        password: '123',
      });
      const repoUrl = utils.getGerritRepoUrl('web/apps', baseUrl);
      expect(repoUrl).toBe('https://abc:123@gerrit.example.com/a/web%2Fapps');
    });

    it('create a git url without username/password', () => {
      hostRules.find.mockReturnValue({});
      expect(() => utils.getGerritRepoUrl('web/apps', baseUrl)).toThrow(
        'Init: You must configure a Gerrit Server username/password',
      );
    });

    it('throws on invalid endpoint', () => {
      expect(() => utils.getGerritRepoUrl('web/apps', '...')).toThrow(
        Error(CONFIG_GIT_URL_UNAVAILABLE),
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
      (prState: any, filter: string) => {
        expect(utils.mapPrStateToGerritFilter(prState)).toEqual(filter);
      },
    );
  });

  describe('mapGerritChangeStateToPrState()', () => {
    it.each([
      ['NEW' as GerritChangeStatus, 'open'],
      ['MERGED' as GerritChangeStatus, 'merged'],
      ['ABANDONED' as GerritChangeStatus, 'closed'],
      ['unknown' as GerritChangeStatus, 'all'],
    ])(
      'maps gerrit change state %p to PrState %p',
      (state: GerritChangeStatus, prState: any) => {
        expect(utils.mapGerritChangeStateToPrState(state)).toEqual(prState);
      },
    );
  });

  describe('mapGerritChangeToPr()', () => {
    it('map a gerrit change to to Pr', () => {
      const change = partial<GerritChange>({
        _number: 123456,
        status: 'NEW',
        hashtags: ['other', 'sourceBranch-renovate/dependency-1.x'],
        branch: 'main',
        subject: 'Fix for',
        reviewers: {
          REVIEWER: [partial<GerritAccountInfo>({ username: 'username' })],
          REMOVED: [],
          CC: [],
        },
        messages: [
          partial<GerritChangeMessageInfo>({
            id: '9d78ac236714cee8c2d86e95d638358925cf6853',
            tag: 'pull-request',
            message: 'Patch Set 1:\n\nOld PR-Body',
          }),
          partial<GerritChangeMessageInfo>({
            id: '1d17c930381e88e177bbc59595c3ec941bd21028',
            tag: 'pull-request',
            message: 'Patch Set 12:\n\nLast PR-Body',
          }),
          partial<GerritChangeMessageInfo>({
            id: '9d78ac236714cee8c2d86e95d638358925cf6853',
            message: 'other message...',
          }),
        ],
      });

      expect(utils.mapGerritChangeToPr(change)).toEqual({
        number: 123456,
        state: 'open',
        title: 'Fix for',
        sourceBranch: 'renovate/dependency-1.x',
        targetBranch: 'main',
        reviewers: ['username'],
        bodyStruct: {
          hash: hashBody('Last PR-Body'),
        },
      });
    });

    it('map a gerrit change without sourceBranch-tag and reviewers to Pr', () => {
      const change = partial<GerritChange>({
        _number: 123456,
        status: 'NEW',
        hashtags: ['other'],
        branch: 'main',
        subject: 'Fix for',
      });
      expect(utils.mapGerritChangeToPr(change)).toEqual({
        number: 123456,
        state: 'open',
        title: 'Fix for',
        sourceBranch: 'main',
        targetBranch: 'main',
        reviewers: [],
        bodyStruct: {
          hash: hashBody(''),
        },
      });
    });
  });

  describe('extractSourceBranch()', () => {
    it('without hashtags', () => {
      const change = partial<GerritChange>({
        hashtags: undefined,
      });
      expect(utils.extractSourceBranch(change)).toBeUndefined();
    });

    it('no hashtag with "sourceBranch-" prefix', () => {
      const change = partial<GerritChange>({
        hashtags: ['other', 'another'],
      });
      expect(utils.extractSourceBranch(change)).toBeUndefined();
    });

    it('hashtag with "sourceBranch-" prefix', () => {
      const change = partial<GerritChange>({
        hashtags: ['other', 'sourceBranch-renovate/dependency-1.x', 'another'],
      });
      expect(utils.extractSourceBranch(change)).toBe('renovate/dependency-1.x');
    });
  });

  describe('findPullRequestBody()', () => {
    it('find pull-request-body', () => {
      const change = partial<GerritChange>({
        messages: [
          partial<GerritChangeMessageInfo>({
            id: '9d78ac236714cee8c2d86e95d638358925cf6853',
            tag: 'pull-request',
            message: 'Patch Set 1:\n\nOld PR-Body',
          }),
          partial<GerritChangeMessageInfo>({
            id: '1d17c930381e88e177bbc59595c3ec941bd21028',
            tag: 'pull-request',
            message: 'Patch Set 12:\n\nLast PR-Body',
          }),
          partial<GerritChangeMessageInfo>({
            id: '9d78ac236714cee8c2d86e95d638358925cf6853',
            message: 'other message...',
          }),
        ],
      });
      expect(utils.findPullRequestBody(change)).toBe('Last PR-Body');
    });

    it('no pull-request-body message found', () => {
      const change = partial<GerritChange>({});
      expect(utils.findPullRequestBody(change)).toBeUndefined();
      change.messages = [];
      expect(utils.findPullRequestBody(change)).toBeUndefined();
      change.messages = [
        partial<GerritChangeMessageInfo>({
          tag: 'other-tag',
          message: 'message',
        }),
      ];
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
          expectedValue,
        );
      },
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
          expectedValue,
        );
      },
    );
  });
});
