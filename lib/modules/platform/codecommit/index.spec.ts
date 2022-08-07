import type { logger as _logger } from '../../../logger';
import { PrState } from '../../../types';
import type * as _git from '../../../util/git';
import type { Platform } from '../types';
import { massageMarkdown } from './index';
// const mod = require('@aws-sdk/client-codecommit')
// const codeCommitClient = mod['CodeCommit'];

jest.mock('@aws-sdk/client-codecommit');

describe('modules/platform/codecommit/index', () => {
  let codeCommit: Platform;
  let git: jest.Mocked<typeof _git>;
  let logger: jest.Mocked<typeof _logger>;
  let codeCommitClient: any;

  beforeEach(async () => {
    // reset module
    jest.resetModules();
    jest.mock('../../../util/git');
    jest.mock('../../../util/host-rules');
    jest.mock('../../../logger');
    const mod = require('@aws-sdk/client-codecommit');
    codeCommitClient = mod['CodeCommit'];
    codeCommit = await import('.');
    logger = (await import('../../../logger')).logger as any;
    git = require('../../../util/git');
    git.branchExists.mockReturnValue(true);
    git.isBranchBehindBase.mockResolvedValue(false);

    await codeCommit.initPlatform({
      endpoint: 'https://git-codecommit.eu-central-1.amazonaws.com/',
      username: 'accessKeyId',
      password: 'SecretAccessKey',
    });
  });

  it('validates massageMarkdown functionality', () => {
    const newStr = massageMarkdown(
      '<details><summary>foo</summary>bar</details>text<details>\n<!--renovate-debug:hiddenmessage123-->'
    );
    expect(newStr).toBe(
      '**foo**bartext\n[//]: # (<!--renovate-debug:hiddenmessage123-->)'
    );
  });

  describe('initPlatform()', () => {
    it('should throw if no username/password', () => {
      expect(() => codeCommit.initPlatform({})).toThrow(
        'Init: You must configure a AWS user(accessKeyId), password(secretAccessKey) and endpoint/AWS_REGION'
      );
    });

    it('should show warning message if custom endpoint', () => {
      expect(() =>
        codeCommit.initPlatform({
          endpoint: 'endpoint',
          username: 'abc',
          password: '123',
        })
      ).toThrow(
        'Init: You must configure a AWS user(accessKeyId), password(secretAccessKey) and endpoint/AWS_REGION'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Can't parse region, make sure your endpoint is correct"
      );
    });

    it('should init', async () => {
      expect(
        await codeCommit.initPlatform({
          endpoint: 'https://git-codecommit.REGION.amazonaws.com/',
          username: 'abc',
          password: '123',
        })
      ).toEqual({
        endpoint: 'REGION',
        token: '123',
        renovateUsername: 'abc',
      });
    });
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      const result = {
        repositories: [
          {
            repositoryId: 'id',
            repositoryName: 'repoName',
          },
        ],
      };

      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(result);
        });

      const res = await codeCommit.getRepos();
      expect(res).toEqual(['repoName']);
    });
  });

  describe('getRepoForceRebase()', () => {
    it('Always return false, since CodeCommit does not support force rebase', async () => {
      const actual = await codeCommit.getRepoForceRebase();
      expect(actual).toBeFalse();
    });
  });

  function prepareMocksForListPr() {
    //getPrList()
    jest
      .spyOn(codeCommitClient.prototype, 'send')
      .mockImplementationOnce(() => {
        return Promise.resolve({ pullRequestIds: ['1'] });
      });
    const prRes = {
      pullRequest: {
        title: 'someTitle',
        pullRequestStatus: 'OPEN',
        pullRequestTargets: [
          {
            sourceReference: 'refs/heads/sourceBranchName',
            destinationReference: 'refs/heads/targetBranch',
          },
        ],
      },
    };
    //getPr()
    jest.spyOn(codeCommitClient.prototype, 'send').mockImplementation(() => {
      return Promise.resolve(prRes);
    });
  }

  describe('getPrList()', () => {
    it('gets PR list by author', async () => {
      prepareMocksForListPr();
      const res = await codeCommit.getPrList();
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranchName',
        state: 'OPEN',
        number: 1,
        title: 'someTitle',
      });
    });
  });

  describe('getBranchPr()', () => {
    it('codecommit find PR for branch', async () => {
      prepareMocksForListPr();
      const res = await codeCommit.getBranchPr('sourceBranchName');
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranchName',
        state: 'OPEN',
        number: 1,
        title: 'someTitle',
      });
    });

    it('returns null if no PR for branch', async () => {
      prepareMocksForListPr();
      const res = await codeCommit.getBranchPr('branch_without_pr');
      expect(res).toBeNull();
    });
  });

  describe('findPr()', () => {
    it('finds pr', async () => {
      prepareMocksForListPr();
      const res = await codeCommit.findPr({
        branchName: 'sourceBranchName',
        prTitle: 'someTitle',
        state: PrState.Open,
      });
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranchName',
        state: 'OPEN',
        number: 1,
        title: 'someTitle',
      });
    });
  });

  describe('getPr()', () => {
    it('gets pr', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranchName',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      jest.spyOn(codeCommitClient.prototype, 'send').mockImplementation(() => {
        return Promise.resolve(prRes);
      });

      const res = await codeCommit.getPr(1);
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranchName',
        state: 'OPEN',
        number: 1,
        title: 'someTitle',
      });
    });
  });

  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return JSON.stringify(data);
        });
      const res = await codeCommit.getJsonFile('file.json');
      expect(res).toEqual(data);
    });

    it('returns file content in json5 format', async () => {
      const json5Data = `
        {
          // json5 comment
          foo: 'bar'
        }
      `;
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return JSON.stringify(json5Data);
        });
      const res = await codeCommit.getJsonFile('file.json');
      expect(res).toEqual({ foo: 'bar' });
    });
  });
});

/*
describe('modules/platform/bitbucket/index', () => {


  describe('createPr()', () => {
    it('posts PR', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/default-reviewers')
        .reply(200, {
          values: [{ uuid: '{1234-5678}' }],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(200, { id: 5 });
      const pr = await bitbucket.createPr({
        sourceBranch: 'branch',
        targetBranch: 'master',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          bbUseDefaultReviewers: true,
        },
      });
      expect(pr?.number).toBe(5);
    });

    it('removes inactive reviewers when updating pr', async () => {
      const inactiveReviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const activeReviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/default-reviewers')
        .reply(200, {
          values: [activeReviewer, inactiveReviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: ['Malformed reviewers list'],
            },
            message: 'reviewers: Malformed reviewers list',
          },
        })
        .get('/2.0/users/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D')
        .reply(200, {
          account_status: 'inactive',
        })
        .get('/2.0/users/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D')
        .reply(200, {
          account_status: 'active',
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(200, { id: 5 });
      const pr = await bitbucket.createPr({
        sourceBranch: 'branch',
        targetBranch: 'master',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          bbUseDefaultReviewers: true,
        },
      });
      expect(pr?.number).toBe(5);
    });

    it('removes default reviewers no longer member of the workspace when creating pr', async () => {
      const notMemberReviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const memberReviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/default-reviewers')
        .reply(200, {
          values: [memberReviewer, notMemberReviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Bob Smith is not a member of this workspace and cannot be added to this pull request',
              ],
            },
            message:
              'reviewers: Bob Smith is not a member of this workspace and cannot be added to this pull request',
          },
        })
        .get(
          '/2.0/workspaces/some/members/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D'
        )
        .reply(404)
        .get(
          '/2.0/workspaces/some/members/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D'
        )
        .reply(200)
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(200, { id: 5 });
      const pr = await bitbucket.createPr({
        sourceBranch: 'branch',
        targetBranch: 'master',
        prTitle: 'title',
        prBody: 'body',
        platformOptions: {
          bbUseDefaultReviewers: true,
        },
      });
      expect(pr?.number).toBe(5);
    });

    it('throws exception when unable to check default reviewers workspace membership', async () => {
      const reviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/default-reviewers')
        .reply(200, {
          values: [reviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Bob Smith is not a member of this workspace and cannot be added to this pull request',
              ],
            },
            message:
              'reviewers: Bob Smith is not a member of this workspace and cannot be added to this pull request',
          },
        })
        .get(
          '/2.0/workspaces/some/members/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D'
        )
        .reply(401);
      await expect(() =>
        bitbucket.createPr({
          sourceBranch: 'branch',
          targetBranch: 'master',
          prTitle: 'title',
          prBody: 'body',
          platformOptions: {
            bbUseDefaultReviewers: true,
          },
        })
      ).rejects.toThrow(new Error('Response code 401 (Unauthorized)'));
    });

    it('rethrows exception when PR create error due to unknown reviewers error', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
      };

      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/default-reviewers')
        .reply(200, {
          values: [reviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: ['Some other unhandled error'],
            },
            message: 'Some other unhandled error',
          },
        });
      await expect(() =>
        bitbucket.createPr({
          sourceBranch: 'branch',
          targetBranch: 'master',
          prTitle: 'title',
          prBody: 'body',
          platformOptions: {
            bbUseDefaultReviewers: true,
          },
        })
      ).rejects.toThrow(new Error('Response code 400 (Bad Request)'));
    });

    it('rethrows exception when PR create error not due to reviewers field', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
      };

      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/default-reviewers')
        .reply(200, {
          values: [reviewer],
        })
        .post('/2.0/repositories/some/repo/pullrequests')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              description: ['Some other unhandled error'],
            },
            message: 'Some other unhandled error',
          },
        });
      await expect(() =>
        bitbucket.createPr({
          sourceBranch: 'branch',
          targetBranch: 'master',
          prTitle: 'title',
          prBody: 'body',
          platformOptions: {
            bbUseDefaultReviewers: true,
          },
        })
      ).rejects.toThrow(new Error('Response code 400 (Bad Request)'));
    });
  });


  describe('updatePr()', () => {
    it('puts PR', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [reviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200);
      await expect(
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' })
      ).toResolve();
    });

    it('removes inactive reviewers when updating pr', async () => {
      const inactiveReviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const activeReviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [activeReviewer, inactiveReviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: ['Malformed reviewers list'],
            },
            message: 'reviewers: Malformed reviewers list',
          },
        })
        .get('/2.0/users/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D')
        .reply(200, {
          account_status: 'inactive',
        })
        .get('/2.0/users/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D')
        .reply(200, {
          account_status: 'active',
        })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200);
      await expect(
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' })
      ).toResolve();
    });

    it('removes reviewers no longer member of the workspace when updating pr', async () => {
      const notMemberReviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const memberReviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
        account_id: '456',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [memberReviewer, notMemberReviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Bob Smith is not a member of this workspace and cannot be added to this pull request',
              ],
            },
            message:
              'reviewers: Bob Smith is not a member of this workspace and cannot be added to this pull request',
          },
        })
        .get(
          '/2.0/workspaces/some/members/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D'
        )
        .reply(404)
        .get(
          '/2.0/workspaces/some/members/%7B90b6646d-1724-4a64-9fd9-539515fe94e9%7D'
        )
        .reply(200)
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200);

      await expect(
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' })
      ).toResolve();
    });

    it('throws exception when unable to check reviewers workspace membership', async () => {
      const reviewer = {
        display_name: 'Bob Smith',
        uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
        account_id: '123',
      };
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [reviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: [
                'Bob Smith is not a member of this workspace and cannot be added to this pull request',
              ],
            },
            message:
              'reviewers: Bob Smith is not a member of this workspace and cannot be added to this pull request',
          },
        })
        .get(
          '/2.0/workspaces/some/members/%7Bd2238482-2e9f-48b3-8630-de22ccb9e42f%7D'
        )
        .reply(401);
      await expect(() =>
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' })
      ).rejects.toThrow(new Error('Response code 401 (Unauthorized)'));
    });

    it('rethrows exception when PR update error due to unknown reviewers error', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
      };

      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [reviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              reviewers: ['Some other unhandled error'],
            },
            message: 'Some other unhandled error',
          },
        });
      await expect(() =>
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' })
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('rethrows exception when PR create error not due to reviewers field', async () => {
      const reviewer = {
        display_name: 'Jane Smith',
        uuid: '{90b6646d-1724-4a64-9fd9-539515fe94e9}',
      };

      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { reviewers: [reviewer] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(400, {
          type: 'error',
          error: {
            fields: {
              description: ['Some other unhandled error'],
            },
            message: 'Some other unhandled error',
          },
        });
      await expect(() =>
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' })
      ).rejects.toThrow(new Error('Response code 400 (Bad Request)'));
    });

    it('throws an error on failure to get current list of reviewers', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(500, undefined);
      await expect(() =>
        bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' })
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('closes PR', async () => {
      const scope = await initRepoMock();
      scope
        .get('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200, { values: [pr] })
        .put('/2.0/repositories/some/repo/pullrequests/5')
        .reply(200)
        .post('/2.0/repositories/some/repo/pullrequests/5/decline')
        .reply(200);

      expect(
        await bitbucket.updatePr({
          number: pr.id,
          prTitle: pr.title,
          state: PrState.Closed,
        })
      ).toBeUndefined();
    });
  });

  describe('mergePr()', () => {
    it('posts Merge with optional merge strategy', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
        })
      ).toBeTrue();
    });

    it('posts Merge with auto', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'auto',
        })
      ).toBeTrue();
    });

    it('posts Merge with merge-commit', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'merge-commit',
        })
      ).toBeTrue();
    });

    it('posts Merge with squash', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'squash',
        })
      ).toBe(true);
    });

    it('does not post Merge with rebase', async () => {
      await bitbucket.mergePr({
        branchName: 'branch',
        id: 5,
        strategy: 'rebase',
      });
      expect(httpMock.getTrace()).toBeEmptyArray();
    });

    it('posts Merge with fast-forward', async () => {
      const scope = await initRepoMock();
      scope.post('/2.0/repositories/some/repo/pullrequests/5/merge').reply(200);
      expect(
        await bitbucket.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'fast-forward',
        })
      ).toBeTrue();
    });
  });




});
*/
