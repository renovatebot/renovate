import { codeBlock } from 'common-tags';
import { DateTime } from 'luxon';
import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import type { BranchStatus } from '../../../types';
import { repoFingerprint } from '../util';
import { client as _client } from './client';
import type {
  GerritAccountInfo,
  GerritChange,
  GerritChangeMessageInfo,
  GerritLabelInfo,
  GerritLabelTypeInfo,
  GerritProjectInfo,
  GerritRevisionInfo,
} from './types';
import {
  REQUEST_DETAILS_FOR_PRS,
  TAG_PULL_REQUEST_BODY,
  mapGerritChangeToPr,
} from './utils';
import { writeToConfig } from '.';
import * as gerrit from '.';
import { git, hostRules, partial } from '~test/util';

const gerritEndpointUrl = 'https://dev.gerrit.com/renovate';

const codeReviewLabel: GerritLabelTypeInfo = {
  values: {
    '-2': 'bad',
    '-1': 'unlikely',
    0: 'neutral',
    1: 'ok',
    2: 'good',
  },
  default_value: 0,
};

vi.mock('../../../util/host-rules');
vi.mock('./client');
const clientMock = vi.mocked(_client);

describe('modules/platform/gerrit/index', () => {
  const t0 = DateTime.fromISO('2025-04-14T16:33:37.000000000', {
    zone: 'utc',
  }) as DateTime<true>;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(t0.toMillis());
  });

  beforeEach(async () => {
    hostRules.find.mockReturnValue({
      username: 'user',
      password: 'pass',
    });
    writeToConfig({
      repository: 'test/repo',
      labels: {},
    });
    await gerrit.initPlatform({
      endpoint: gerritEndpointUrl,
      username: 'user',
      password: 'pass',
    });
  });

  describe('initPlatform()', () => {
    it('should throw if no endpoint', () => {
      expect.assertions(1);
      expect(() => gerrit.initPlatform({})).toThrow();
    });

    it('should throw if no username/password', () => {
      expect.assertions(1);
      expect(() => gerrit.initPlatform({ endpoint: 'endpoint' })).toThrow();
    });

    it('should init', async () => {
      expect(
        await gerrit.initPlatform({
          endpoint: gerritEndpointUrl,
          username: 'abc',
          password: '123',
        }),
      ).toEqual({ endpoint: 'https://dev.gerrit.com/renovate/' });
    });
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      clientMock.getRepos.mockResolvedValueOnce(['repo1', 'repo2']);
      expect(await gerrit.getRepos()).toEqual(['repo1', 'repo2']);
    });
  });

  it('initRepo() - inactive', async () => {
    clientMock.getProjectInfo.mockRejectedValueOnce(
      new Error(REPOSITORY_ARCHIVED),
    );
    await expect(gerrit.initRepo({ repository: 'test/repo' })).rejects.toThrow(
      REPOSITORY_ARCHIVED,
    );
  });

  describe('initRepo()', () => {
    const projectInfo: GerritProjectInfo = {
      id: 'repo1',
      name: 'test-repo2',
    };

    beforeEach(() => {
      clientMock.getBranchInfo.mockResolvedValueOnce({
        ref: 'sha-hash....',
        revision: 'main',
      });
    });

    it('initRepo() - active', async () => {
      clientMock.getProjectInfo.mockResolvedValueOnce(projectInfo);
      clientMock.findChanges.mockResolvedValueOnce([]);
      expect(await gerrit.initRepo({ repository: 'test/repo' })).toEqual({
        defaultBranch: 'main',
        isFork: false,
        repoFingerprint: repoFingerprint('test/repo', `${gerritEndpointUrl}/`),
      });
      expect(git.initRepo).toHaveBeenCalledWith({
        url: 'https://user:pass@dev.gerrit.com/renovate/a/test%2Frepo',
      });
    });

    it('initRepo() - abandon rejected changes', async () => {
      clientMock.getProjectInfo.mockResolvedValueOnce({
        ...projectInfo,
        labels: { 'Code-Review': codeReviewLabel },
      });
      clientMock.findChanges.mockResolvedValueOnce([
        partial<GerritChange>({ _number: 1 }),
        partial<GerritChange>({ _number: 2 }),
      ]);

      await gerrit.initRepo({ repository: 'test/repo' });

      expect(clientMock.findChanges.mock.calls[0]).toEqual([
        'test/repo',
        { branchName: '', label: '-2', state: 'open' },
      ]);
      expect(clientMock.abandonChange.mock.calls).toEqual([
        [
          1,
          'This change has been abandoned as it was voted with Code-Review -2.',
        ],
        [
          2,
          'This change has been abandoned as it was voted with Code-Review -2.',
        ],
      ]);
    });
  });

  describe('findPr()', () => {
    it('findPr() - no results', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerrit.findPr({
          branchName: 'branch',
          state: 'open',
          targetBranch: 'master',
        }),
      ).resolves.toBeNull();
      expect(clientMock.findChanges).toHaveBeenCalledWith('test/repo', {
        branchName: 'branch',
        state: 'open',
        targetBranch: 'master',
        limit: 1,
        requestDetails: REQUEST_DETAILS_FOR_PRS,
      });
    });

    it('findPr() - found', async () => {
      const change = partial<GerritChange>({
        _number: 123456,
        current_revision: 'some-revision',
        revisions: {
          'some-revision': partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: source',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerrit.findPr({
          branchName: 'branch',
          state: 'open',
          targetBranch: 'master',
        }),
      ).resolves.toHaveProperty('number', 123456);
    });
  });

  describe('getPr()', () => {
    it('getPr() - found', async () => {
      const change = partial<GerritChange>({});
      clientMock.getChange.mockResolvedValueOnce(change);
      await expect(gerrit.getPr(123456)).resolves.toEqual(
        mapGerritChangeToPr(change),
      );
      expect(clientMock.getChange).toHaveBeenCalledWith(
        123456,
        undefined,
        REQUEST_DETAILS_FOR_PRS,
      );
    });

    it('getPr() - not found', async () => {
      clientMock.getChange.mockRejectedValueOnce({ statusCode: 404 });
      await expect(gerrit.getPr(123456)).resolves.toBeNull();
    });

    it('getPr() - other error', async () => {
      clientMock.getChange.mockRejectedValueOnce(new Error('other error'));
      await expect(gerrit.getPr(123456)).rejects.toThrow();
    });
  });

  describe('updatePr()', () => {
    beforeAll(() => {
      gerrit.writeToConfig({ labels: {} });
    });

    it('updatePr() - closed => abandon the change', async () => {
      const change = partial<GerritChange>({});
      clientMock.getChange.mockResolvedValueOnce(change);
      await gerrit.updatePr({
        number: 123456,
        prTitle: change.subject,
        state: 'closed',
      });
      expect(clientMock.abandonChange).toHaveBeenCalledWith(123456);
    });

    it('updatePr() - existing prBody found in change.messages => nothing todo...', async () => {
      const change = partial<GerritChange>({
        current_revision: 'some-revision',
        revisions: {
          'some-revision': partial<GerritRevisionInfo>({
            commit_with_footers: 'some message',
          }),
        },
      });
      clientMock.getChange.mockResolvedValueOnce(change);
      clientMock.getMessages.mockResolvedValueOnce([
        partial<GerritChangeMessageInfo>({
          tag: TAG_PULL_REQUEST_BODY,
          message: 'Last PR-Body',
        }),
      ]);
      await gerrit.updatePr({
        number: 123456,
        prTitle: 'title',
        prBody: 'Last PR-Body',
      });
      expect(clientMock.addMessage).not.toHaveBeenCalled();
    });

    it('updatePr() - new prBody found in change.messages => add as message', async () => {
      const change = partial<GerritChange>({});
      clientMock.getChange.mockResolvedValueOnce(change);
      clientMock.getMessages.mockResolvedValueOnce([]);
      await gerrit.updatePr({
        number: 123456,
        prTitle: change.subject,
        prBody: 'NEW PR-Body',
      });
      expect(clientMock.addMessageIfNotAlreadyExists).toHaveBeenCalledWith(
        123456,
        'NEW PR-Body',
        TAG_PULL_REQUEST_BODY,
      );
    });
  });

  describe('createPr()', () => {
    it('createPr() - no existing found => rejects', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerrit.createPr({
          sourceBranch: 'source',
          targetBranch: 'target',
          prTitle: 'title',
          prBody: 'body',
        }),
      ).rejects.toThrow(
        `the change should be created automatically from previous push to refs/for/source`,
      );
    });

    it('createPr() - found existing but not created in the last 5 minutes => rejects', async () => {
      const change = partial<GerritChange>({
        _number: 123456,
        created: t0.minus({ minutes: 6 }).toISO().replace('T', ' '),
        current_revision: 'some-revision',
        revisions: {
          'some-revision': partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: source',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerrit.createPr({
          sourceBranch: 'source',
          targetBranch: 'target',
          prTitle: 'title',
          prBody: 'body',
        }),
      ).rejects.toThrow(/it was not created in the last 5 minutes/);
    });

    it('createPr() - update body', async () => {
      const change = partial<GerritChange>({
        _number: 123456,
        current_revision: 'some-revision',
        created: t0.minus({ seconds: 30 }).toISO().replace('T', ' '),
        revisions: {
          'some-revision': partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: source',
          }),
        },
        messages: [],
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      const pr = await gerrit.createPr({
        sourceBranch: 'source',
        targetBranch: 'target',
        prTitle: 'title',
        prBody: 'body',
        platformPrOptions: {
          autoApprove: false,
        },
      });
      expect(pr).toHaveProperty('number', 123456);
      expect(clientMock.addMessageIfNotAlreadyExists).toHaveBeenCalledWith(
        123456,
        'body',
        TAG_PULL_REQUEST_BODY,
        [],
      );
    });
  });

  describe('getBranchPr()', () => {
    it('getBranchPr() - no result', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerrit.getBranchPr('renovate/dependency-1.x'),
      ).resolves.toBeNull();
      expect(clientMock.findChanges).toHaveBeenCalledWith('test/repo', {
        branchName: 'renovate/dependency-1.x',
        state: 'open',
        limit: 1,
        refreshCache: undefined,
        requestDetails: REQUEST_DETAILS_FOR_PRS,
      });
    });

    it('getBranchPr() - found', async () => {
      const change = partial<GerritChange>({
        _number: 123456,
        current_revision: 'some-revision',
        revisions: {
          'some-revision': partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: renovate/dependency-1.x',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerrit.getBranchPr('renovate/dependency-1.x', 'master'),
      ).resolves.toHaveProperty('number', 123456);
      expect(clientMock.findChanges.mock.lastCall).toEqual([
        'test/repo',
        {
          state: 'open',
          branchName: 'renovate/dependency-1.x',
          limit: 1,
          targetBranch: 'master',
          requestDetails: REQUEST_DETAILS_FOR_PRS,
        },
      ]);
    });

    it('getBranchPr() - found even without targetBranch', async () => {
      const change = partial<GerritChange>({
        _number: 123456,
        current_revision: 'some-revision',
        revisions: {
          'some-revision': partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: renovate/dependency-1.x',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerrit.getBranchPr('renovate/dependency-1.x', undefined),
      ).resolves.toHaveProperty('number', 123456);
      expect(clientMock.findChanges.mock.lastCall).toEqual([
        'test/repo',
        {
          state: 'open',
          branchName: 'renovate/dependency-1.x',
          limit: 1,
          targetBranch: undefined,
          requestDetails: REQUEST_DETAILS_FOR_PRS,
        },
      ]);
    });
  });

  describe('refreshPr()', () => {
    it('refreshPr()', async () => {
      clientMock.getChange.mockResolvedValueOnce(partial<GerritChange>({}));
      await expect(gerrit.refreshPr(123456)).toResolve();
      expect(clientMock.getChange).toHaveBeenCalledWith(
        123456,
        true,
        REQUEST_DETAILS_FOR_PRS,
      );
    });
  });

  describe('getPrList()', () => {
    it('getPrList() - empty list', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(gerrit.getPrList()).resolves.toEqual([]);
      expect(clientMock.findChanges).toHaveBeenCalledWith('test/repo', {
        branchName: '',
        requestDetails: REQUEST_DETAILS_FOR_PRS,
      });
    });

    it('getPrList() - multiple results', async () => {
      const change = partial<GerritChange>({
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: renovate/dependency-1.x',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change, change, change]);
      await expect(gerrit.getPrList()).resolves.toHaveLength(3);
    });
  });

  describe('mergePr()', () => {
    it('mergePr() - blocker by Verified', async () => {
      clientMock.submitChange.mockRejectedValueOnce({
        statusCode: 409,
        message: 'blocked by Verified',
      });
      await expect(gerrit.mergePr({ id: 123456 })).resolves.toBeFalse();
      expect(clientMock.submitChange).toHaveBeenCalledWith(123456);
    });

    it('mergePr() - success', async () => {
      clientMock.submitChange.mockResolvedValueOnce(
        partial<GerritChange>({ status: 'MERGED' }),
      );
      await expect(gerrit.mergePr({ id: 123456 })).resolves.toBeTrue();
    });

    it('mergePr() - other errors', async () => {
      clientMock.submitChange.mockRejectedValueOnce(
        new Error('any other error'),
      );
      await expect(gerrit.mergePr({ id: 123456 })).rejects.toThrow();
    });
  });

  describe('getBranchStatus()', () => {
    it('getBranchStatus() - change not found => yellow', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await expect(
        gerrit.getBranchStatus('renovate/dependency-1.x'),
      ).resolves.toBe('yellow');
    });

    it('getBranchStatus() - change found, submittable and not hasProblems => green', async () => {
      const change = partial<GerritChange>({
        submittable: true,
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerrit.getBranchStatus('renovate/dependency-1.x'),
      ).resolves.toBe('green');
    });

    it('getBranchStatus() - change found, submittable but hasProblems => red', async () => {
      const change = partial<GerritChange>({
        submittable: true,
        problems: [{ message: 'error1' }, { message: 'error2' }],
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: renovate/dependency-1.x',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerrit.getBranchStatus('renovate/dependency-1.x'),
      ).resolves.toBe('red');
    });

    it('getBranchStatus() - change found and hasProblems => red', async () => {
      const change = partial<GerritChange>({
        submittable: false,
        problems: [{ message: 'error1' }, { message: 'error2' }],
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: renovate/dependency-1.x',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerrit.getBranchStatus('renovate/dependency-1.x'),
      ).resolves.toBe('red');
    });

    it('getBranchStatus() - changes found and hasBlockingLabels but no problems => red', async () => {
      const change = partial<GerritChange>({
        submittable: true,
        problems: [],
        labels: {
          Verified: { blocking: true },
        },
        current_revision: 'abc',
        revisions: {
          abc: partial<GerritRevisionInfo>({
            commit_with_footers: 'Renovate-Branch: renovate/dependency-1.x',
          }),
        },
      });
      clientMock.findChanges.mockResolvedValueOnce([change]);
      await expect(
        gerrit.getBranchStatus('renovate/dependency-1.x'),
      ).resolves.toBe('red');
    });
  });

  describe('getBranchStatusCheck()', () => {
    describe('GerritLabel is not available', () => {
      beforeAll(() => {
        writeToConfig({ labels: {} });
      });

      it.each([
        'unknownCtx',
        'renovate/stability-days',
        'renovate/merge-confidence',
      ])('getBranchStatusCheck() - %s', async (ctx) => {
        await expect(
          gerrit.getBranchStatusCheck('renovate/dependency-1.x', ctx),
        ).resolves.toBe('yellow');
        expect(clientMock.findChanges).not.toHaveBeenCalled();
      });
    });

    describe('GerritLabel is available', () => {
      beforeEach(() => {
        writeToConfig({
          labels: {
            'Renovate-Merge-Confidence': {
              values: { '0': 'default', '-1': 'Unsatisfied', '1': 'Satisfied' },
              default_value: 0,
            },
          },
        });
      });

      it.each([
        {
          label: 'Renovate-Merge-Confidence',
          labelValue: { rejected: partial<GerritAccountInfo>({}) },
          expectedState: 'red' as BranchStatus,
        },
        {
          label: 'Renovate-Merge-Confidence',
          labelValue: { approved: partial<GerritAccountInfo>({}) },
          expectedState: 'green' as BranchStatus,
        },
        {
          label: 'Renovate-Merge-Confidence',
          labelValue: {
            approved: partial<GerritAccountInfo>({}),
            rejected: partial<GerritAccountInfo>({}),
          },
          expectedState: 'red' as BranchStatus,
        },
        {
          label: 'Renovate-Merge-Confidence',
          labelValue: {
            approved: partial<GerritAccountInfo>({}),
            rejected: partial<GerritAccountInfo>({}),
            blocking: true,
          },
          expectedState: 'red' as BranchStatus,
        },
      ])('$ctx/$labels', async ({ label, labelValue, expectedState }) => {
        const change = partial<GerritChange>({
          labels: {
            [label]: partial<GerritLabelInfo>({ ...labelValue }),
          },
        });
        clientMock.findChanges.mockResolvedValueOnce([change]);
        await expect(
          gerrit.getBranchStatusCheck('renovate/dependency-1.x', label),
        ).resolves.toBe(expectedState);
      });
    });
  });

  describe('setBranchStatus()', () => {
    describe('GerritLabel is not configured in Renovate', () => {
      beforeEach(() => {
        writeToConfig({ labels: {} });
      });

      it('setBranchStatus(renovate/stability-days)', async () => {
        await expect(
          gerrit.setBranchStatus({
            branchName: 'branch',
            context: 'renovate/stability-days',
            state: 'red',
            description: 'desc',
          }),
        ).resolves.toBeUndefined();
        expect(clientMock.setLabel).not.toHaveBeenCalled();
      });

      it('setBranchStatus(renovate/merge-confidence)', async () => {
        await expect(
          gerrit.setBranchStatus({
            branchName: 'branch',
            context: 'renovate/merge-confidence',
            state: 'red',
            description: 'desc',
          }),
        ).resolves.toBeUndefined();
        expect(clientMock.setLabel).not.toHaveBeenCalled();
      });
    });

    describe('GerritLabel is configured in Renovate', () => {
      beforeEach(() => {
        writeToConfig({
          labels: {
            'Renovate-Merge-Confidence': {
              values: { '0': 'default', '-1': 'Unsatisfied', '1': 'Satisfied' },
              default_value: 0,
            },
          },
        });
      });

      it.each([
        {
          ctx: 'Renovate-Merge-Confidence',
          branchState: 'red' as BranchStatus,
          expectedVote: -1,
          expectedLabel: 'Renovate-Merge-Confidence',
        },
        {
          ctx: 'Renovate-Merge-Confidence',
          branchState: 'yellow' as BranchStatus,
          expectedVote: -1,
          expectedLabel: 'Renovate-Merge-Confidence',
        },
        {
          ctx: 'Renovate-Merge-Confidence',
          branchState: 'green' as BranchStatus,
          expectedVote: 1,
          expectedLabel: 'Renovate-Merge-Confidence',
        },
      ])(
        '$ctx/$branchState',
        async ({ ctx, branchState, expectedVote, expectedLabel }) => {
          const change = partial<GerritChange>({
            _number: 123456,
            current_revision: 'abc',
            revisions: {
              abc: partial<GerritRevisionInfo>({
                commit_with_footers: 'Renovate-Branch: renovate/dependency-1.x',
              }),
            },
            labels: {
              [ctx]: partial<GerritLabelInfo>({
                approved: partial<GerritAccountInfo>({}),
                rejected: partial<GerritAccountInfo>({}),
              }),
            },
          });
          clientMock.findChanges.mockResolvedValueOnce([change]);
          await gerrit.setBranchStatus({
            branchName: 'renovate/dependency-1.x',
            context: ctx,
            state: branchState,
            description: 'desc',
          });
          expect(clientMock.setLabel).toHaveBeenCalledWith(
            123456,
            expectedLabel,
            expectedVote,
          );
        },
      );

      it('no change found', async () => {
        clientMock.findChanges.mockResolvedValueOnce([]);
        await expect(
          gerrit.setBranchStatus({
            branchName: 'renovate/dependency-1.x',
            context: 'Renovate-Merge-Confidence',
            state: 'red',
            description: 'desc',
          }),
        ).resolves.toBeUndefined();
        expect(clientMock.setLabel).not.toHaveBeenCalled();
      });

      it('does not call setLabel() if label does not exist in change', async () => {
        const change = partial<GerritChange>({
          _number: 123456,
          current_revision: 'abc',
          revisions: {
            abc: partial<GerritRevisionInfo>({
              commit_with_footers: 'Renovate-Branch: renovate/dependency-1.x',
            }),
          },
        });
        clientMock.findChanges.mockResolvedValueOnce([change]);
        await expect(
          gerrit.setBranchStatus({
            branchName: 'branch',
            context: 'renovate/merge-confidence',
            state: 'red',
            description: 'desc',
          }),
        ).resolves.toBeUndefined();
        expect(clientMock.setLabel).not.toHaveBeenCalled();
      });
    });
  });

  describe('deleteLabel()', () => {
    it('deleteLabel() - deletes a label', async () => {
      const pro = gerrit.deleteLabel(123456, 'hashtag1');
      await expect(pro).resolves.toBeUndefined();
      expect(clientMock.deleteHashtag).toHaveBeenCalledTimes(1);
      expect(clientMock.deleteHashtag).toHaveBeenCalledWith(123456, 'hashtag1');
    });
  });

  describe('addReviewers()', () => {
    it('addReviewers() - add reviewers', async () => {
      await expect(
        gerrit.addReviewers(123456, ['user1', 'user2']),
      ).resolves.toBeUndefined();
      expect(clientMock.addReviewers).toHaveBeenCalledTimes(1);
      expect(clientMock.addReviewers).toHaveBeenCalledWith(123456, [
        'user1',
        'user2',
      ]);
    });
  });

  describe('addAssignees()', () => {
    it('addAssignees() - set assignee', async () => {
      await expect(
        gerrit.addAssignees(123456, ['user1', 'user2']),
      ).resolves.toBeUndefined();
      expect(clientMock.addAssignee).toHaveBeenCalledTimes(1);
      expect(clientMock.addAssignee).toHaveBeenCalledWith(123456, 'user1');
    });
  });

  describe('ensureComment()', () => {
    it('ensureComment() - without tag', async () => {
      await expect(
        gerrit.ensureComment({
          number: 123456,
          topic: null,
          content: 'My-Comment-Msg',
        }),
      ).resolves.toBeTrue();
      expect(clientMock.addMessageIfNotAlreadyExists).toHaveBeenCalledWith(
        123456,
        'My-Comment-Msg',
        undefined,
      );
    });

    it('ensureComment() - with tag', async () => {
      await expect(
        gerrit.ensureComment({
          number: 123456,
          topic: 'myTopic',
          content: 'My-Comment-Msg',
        }),
      ).resolves.toBeTrue();
      expect(clientMock.addMessageIfNotAlreadyExists).toHaveBeenCalledWith(
        123456,
        'My-Comment-Msg',
        'myTopic',
      );
    });
  });

  describe('getRawFile()', () => {
    beforeEach(() => {
      clientMock.getFile.mockResolvedValueOnce('{}');
    });

    it('getRawFile() - repo and branch', async () => {
      await expect(
        gerrit.getRawFile('renovate.json', 'test/repo', 'main'),
      ).resolves.toBe('{}');
      expect(clientMock.getFile).toHaveBeenCalledWith(
        'test/repo',
        'main',
        'renovate.json',
      );
    });

    it('getRawFile() - repo/branch from config', async () => {
      writeToConfig({
        repository: 'repo',
        head: 'master',
        labels: {},
      });
      await expect(gerrit.getRawFile('renovate.json')).resolves.toBe('{}');
      expect(clientMock.getFile).toHaveBeenCalledWith(
        'repo',
        'master',
        'renovate.json',
      );
    });

    it('getRawFile() - branch defaults', async () => {
      writeToConfig({
        repository: 'repo',
        head: undefined,
        labels: {},
      });
      await expect(gerrit.getRawFile('renovate.json')).resolves.toBe('{}');
      expect(clientMock.getFile).toHaveBeenCalledWith(
        'repo',
        'HEAD',
        'renovate.json',
      );
    });

    it('getRawFile() - no repo', async () => {
      writeToConfig({
        repository: undefined,
        head: 'master',
        labels: {},
      });
      await expect(gerrit.getRawFile('renovate.json')).resolves.toBe(null);
      expect(clientMock.getFile).not.toHaveBeenCalled();
    });
  });

  describe('getJsonFile()', () => {
    //TODO: the wanted semantic is not clear
    it('getJsonFile()', async () => {
      clientMock.getFile.mockResolvedValueOnce('{}');
      await expect(
        gerrit.getJsonFile('renovate.json', 'test/repo', 'main'),
      ).resolves.toEqual({});
    });
  });

  describe('massageMarkdown()', () => {
    it('massageMarkdown()', () => {
      expect(
        gerrit.massageMarkdown(
          codeBlock`
          Pull Request
          PR
          Branch creation
          Disabled because a matching PR was automerged previously
          Whenever PR becomes conflicted
          close this Pull Request unmerged
          Close this PR
          you tick the rebase/retry checkbox
          checking the rebase/retry box above
          `,
          'rebase',
        ),
      ).toBe(codeBlock`
        change
        change
        Change creation
        Disabled because a matching change was automerged previously
        Whenever change becomes conflicted
        abandon or vote this change with Code-Review -2
        Abandon or vote this change with Code-Review -2
        you add the _rebase_ hashtag to this change
        adding the _rebase_ hashtag to this change
        `);
    });
  });

  describe('currently unused/not-implemented functions', () => {
    it('deleteLabel()', async () => {
      await expect(
        gerrit.deleteLabel(123456, 'label'),
      ).resolves.toBeUndefined();
    });

    it('ensureCommentRemoval()', async () => {
      await expect(
        gerrit.ensureCommentRemoval({
          type: 'by-topic',
          number: 123456,
          topic: 'topic',
        }),
      ).resolves.toBeUndefined();
    });

    it('ensureIssueClosing()', async () => {
      await expect(gerrit.ensureIssueClosing('title')).resolves.toBeUndefined();
    });

    it('ensureIssue()', async () => {
      await expect(
        gerrit.ensureIssue({ body: 'body', title: 'title' }),
      ).resolves.toBeNull();
    });

    it('findIssue()', async () => {
      await expect(gerrit.findIssue('title')).resolves.toBeNull();
    });

    it('getIssueList()', async () => {
      await expect(gerrit.getIssueList()).resolves.toStrictEqual([]);
    });
  });
});
