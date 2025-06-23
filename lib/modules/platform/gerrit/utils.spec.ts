import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import type { BranchStatus } from '../../../types';
import { setBaseUrl } from '../../../util/http/gerrit';
import { hashBody } from '../pr-body';
import type {
  GerritAccountInfo,
  GerritChange,
  GerritChangeMessageInfo,
  GerritChangeStatus,
  GerritLabelTypeInfo,
  GerritRevisionInfo,
} from './types';
import * as utils from './utils';
import { mapBranchStatusToLabel } from './utils';
import { hostRules, partial } from '~test/util';

vi.mock('../../../util/host-rules');

const baseUrl = 'https://gerrit.example.com';

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
      ['closed', 'status:abandoned'],
      ['merged', 'status:merged'],
      ['!open', '-status:open'],
      ['open', 'status:open'],
      ['all', null],
      [undefined, null],
    ])(
      'maps pr state %p to gerrit filter %p',
      (prState: any, filter: string | null) => {
        expect(utils.mapPrStateToGerritFilter(prState)).toEqual(filter);
      },
    );
  });

  describe('mapGerritChangeStateToPrState()', () => {
    it.each([
      ['NEW' as GerritChangeStatus, 'open'],
      ['MERGED' as GerritChangeStatus, 'merged'],
      ['ABANDONED' as GerritChangeStatus, 'closed'],
      ['unknown' as GerritChangeStatus, undefined],
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
        branch: 'main',
        subject: 'Fix for',
        created: '2025-04-14 16:33:37.000000000',
        reviewers: {
          REVIEWER: [partial<GerritAccountInfo>({ username: 'username' })],
        },
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers:
              'Some change\n\nRenovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
          }),
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
        createdAt: '2025-04-14T16:33:37.000000000',
        sourceBranch: 'renovate/dependency-1.x',
        targetBranch: 'main',
        reviewers: ['username'],
        bodyStruct: {
          hash: hashBody('Last PR-Body'),
        },
        sha: 'abc',
      });
    });

    it('map a gerrit change without reviewers to Pr', () => {
      const change = partial<GerritChange>({
        _number: 123456,
        status: 'NEW',
        branch: 'main',
        subject: 'Fix for',
        reviewers: {},
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers:
              'Some change\n\nRenovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
          }),
        },
      });
      expect(utils.mapGerritChangeToPr(change)).toEqual({
        number: 123456,
        state: 'open',
        title: 'Fix for',
        sourceBranch: 'renovate/dependency-1.x',
        targetBranch: 'main',
        reviewers: [],
        sha: 'abc',
        bodyStruct: {
          hash: hashBody(''),
        },
      });
    });

    it('does not map a gerrit change without source branch to Pr', () => {
      const change = partial<GerritChange>({
        _number: 123456,
        status: 'NEW',
        branch: 'main',
        subject: 'Fix for',
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers:
              'Some change\n\nRenovate-Broke: renovate/dependency-1.x\nChange-Id: ...',
          }),
        },
      });
      expect(utils.mapGerritChangeToPr(change)).toBeNull();
    });

    it('does not reject a broken commit message if knownProperties.sourceBranch is passed', () => {
      const change = partial<GerritChange>({
        _number: 123456,
        status: 'NEW',
        branch: 'main',
        subject: 'Fix for',
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers:
              'Some change\n\nRenovate-Broke: renovate/dependency-1.x\nChange-Id: ...',
          }),
        },
      });
      expect(
        utils.mapGerritChangeToPr(change, {
          sourceBranch: 'renovate/dependency-1.x',
        }),
      ).toEqual({
        number: 123456,
        state: 'open',
        title: 'Fix for',
        sourceBranch: 'renovate/dependency-1.x',
        targetBranch: 'main',
        reviewers: [],
        sha: 'abc',
        bodyStruct: {
          hash: hashBody(''),
        },
      });
    });

    it('avoids iterating through change messages knownProperties.prBody is passed', () => {
      const change = partial<GerritChange>({
        _number: 123456,
        status: 'NEW',
        branch: 'main',
        subject: 'Fix for',
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers:
              'Some change\n\nRenovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
          }),
        },
      });
      expect(
        utils.mapGerritChangeToPr(change, {
          prBody: 'PR Body',
        }),
      ).toEqual({
        number: 123456,
        state: 'open',
        title: 'Fix for',
        sourceBranch: 'renovate/dependency-1.x',
        targetBranch: 'main',
        reviewers: [],
        sha: 'abc',
        bodyStruct: {
          hash: hashBody('PR Body'),
        },
      });
    });
  });

  describe('extractSourceBranch()', () => {
    it('no commit message', () => {
      const change = partial<GerritChange>();
      expect(utils.extractSourceBranch(change)).toBeUndefined();
    });

    it('commit message with no footer', () => {
      const change = partial<GerritChange>({
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers: 'some message...',
          }),
        },
      });
      expect(utils.extractSourceBranch(change)).toBeUndefined();
    });

    it('commit message with footer', () => {
      const change = partial<GerritChange>({
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers:
              'Some change\n\nRenovate-Branch: renovate/dependency-1.x\nChange-Id: ...',
          }),
        },
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
