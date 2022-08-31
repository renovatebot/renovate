import { TextEncoder } from 'web-encoding';
import {
  PLATFORM_BAD_CREDENTIALS,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import type { logger as _logger } from '../../../logger';
import { PrState } from '../../../types';
import type * as _git from '../../../util/git';
import type { Platform } from '../types';

jest.mock('@aws-sdk/client-codecommit');
jest.mock('@aws-sdk/client-iam');

describe('modules/platform/codecommit/index', () => {
  let codeCommit: Platform;
  let logger: jest.Mocked<typeof _logger>;
  let git: jest.Mocked<typeof _git>;
  let codeCommitClient: any;
  let iamClient: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.mock('../../../util/git');
    jest.mock('../../../util/host-rules');
    jest.mock('../../../logger');
    git = require('../../../util/git');
    const mod = require('@aws-sdk/client-codecommit');
    codeCommitClient = mod['CodeCommit'];
    codeCommit = await import('.');
    logger = (await import('../../../logger')).logger as any;
    const modIam = require('@aws-sdk/client-iam');
    iamClient = modIam['IAM'];
    jest.spyOn(iamClient.prototype, 'send').mockImplementationOnce(() => {
      throw new Error('User: aws:arn:example:123456 has no permissions');
    });
    await codeCommit.initPlatform({
      endpoint: 'https://git-codecommit.eu-central-1.amazonaws.com/',
      username: 'accessKeyId',
      password: 'SecretAccessKey',
    });
  });

  it('validates massageMarkdown functionality', () => {
    const newStr = codeCommit.massageMarkdown(
      '<details><summary>foo</summary>bar</details>text<details>\n<!--renovate-debug:hiddenmessage123-->'
    );
    expect(newStr).toBe(
      '**foo**bartext\n[//]: # (<!--renovate-debug:hiddenmessage123-->)'
    );
  });

  describe('initPlatform()', () => {
    it('should throw if no username/password', async () => {
      let error;
      try {
        await codeCommit.initPlatform({});
      } catch (e) {
        error = e.message;
      }
      expect(error).toBe(
        'Init: You must configure a AWS user(accessKeyId), password(secretAccessKey) and endpoint/AWS_REGION'
      );
    });

    it('should show warning message if custom endpoint', async () => {
      let error;
      try {
        await codeCommit.initPlatform({
          endpoint: 'endpoint',
          username: 'abc',
          password: '123',
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toBe(
        'Init: You must configure a AWS user(accessKeyId), password(secretAccessKey) and endpoint/AWS_REGION'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        "Can't parse region, make sure your endpoint is correct"
      );
    });

    it('should init', async () => {
      jest.spyOn(iamClient.prototype, 'send').mockImplementationOnce(() => {
        throw new Error('User: aws:arn:example:123456 has no permissions');
      });
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      expect(
        await codeCommit.initPlatform({
          endpoint: 'https://git-codecommit.REGION.amazonaws.com/',
          username: 'abc',
          password: '123',
        })
      ).toEqual({
        endpoint: 'https://git-codecommit.REGION.amazonaws.com/',
      });
    });

    it('should init with env vars', async () => {
      jest.spyOn(iamClient.prototype, 'send').mockImplementationOnce(() => {
        throw new Error('User: aws:arn:example:123456 has no permissions');
      });
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      process.env.AWS_REGION = 'REGION';
      let res;
      try {
        res = await codeCommit.initPlatform({
          username: 'abc',
          password: '123',
        });
      } catch (err) {
        res = err.message;
      } finally {
        delete process.env.AWS_REGION;
      }
      expect(res).toEqual({
        endpoint: 'https://git-codecommit.REGION.amazonaws.com/',
      });
    });
  });

  describe('initRepos()', () => {
    it('fails to git.initRepo', async () => {
      jest.spyOn(git, 'initRepo').mockImplementationOnce(() => {
        throw new Error('any error');
      });
      let error;
      try {
        await codeCommit.initRepo({
          repository: 'repositoryName',
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toBe(PLATFORM_BAD_CREDENTIALS);
    });

    it('fails on getRepositoryInfo', async () => {
      jest.spyOn(git, 'initRepo').mockImplementationOnce(() => {
        return Promise.resolve();
      });
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw new Error('Could not find repository');
        });
      let error;
      try {
        await codeCommit.initRepo({
          repository: 'repositoryName',
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toBe(REPOSITORY_NOT_FOUND);
    });

    it('getRepositoryInfo returns bad results', async () => {
      jest.spyOn(git, 'initRepo').mockImplementationOnce(() => {
        return Promise.resolve();
      });
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      let error;
      try {
        await codeCommit.initRepo({
          repository: 'repositoryName',
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toBe(REPOSITORY_NOT_FOUND);
    });

    it('getRepositoryInfo returns bad results 2', async () => {
      jest.spyOn(git, 'initRepo').mockImplementationOnce(() => {
        return Promise.resolve();
      });
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve({ repo: {} });
        });
      let error;
      try {
        await codeCommit.initRepo({
          repository: 'repositoryName',
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toBe(REPOSITORY_EMPTY);
    });

    it('initiates repo successfully', async () => {
      jest.spyOn(git, 'initRepo').mockImplementationOnce(() => {
        return Promise.resolve();
      });
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve({
            repositoryMetadata: {
              defaultBranch: 'main',
              repositoryId: 'id',
            },
          });
        });
      const repoResult = await codeCommit.initRepo({
        repository: 'repositoryName',
      });

      expect(repoResult).toEqual({
        repoFingerprint:
          'f0bcfd81abefcdf9ae5e5de58d1a868317503ea76422309bc212d1ef25a1e67789d0bfa752a7e2abd4510f4f3e4f60cdaf6202a42883fb97bb7110ab3600785e',
        defaultBranch: 'main',
        isFork: false,
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

    it('returns empty if error', async () => {
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw new Error('something');
        });

      const res = await codeCommit.getRepos();
      expect(res).toEqual([]);
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
            sourceReference: 'refs/heads/sourceBranch',
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
      expect(res).toMatchObject([
        {
          sourceBranch: 'refs/heads/sourceBranch',
          targetBranch: 'refs/heads/targetBranch',
          state: 'open',
          number: 1,
          title: 'someTitle',
        },
      ]);
    });
  });

  describe('findPr()', () => {
    it('finds pr', async () => {
      prepareMocksForListPr();
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: PrState.Open,
      });
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'open',
        number: 1,
        title: 'someTitle',
      });
    });

    it('throws error on findPr', async () => {
      const err = new Error('failed');
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw err;
        });
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: PrState.Open,
      });
      expect(res).toBeNull();
      expect(logger.error).toHaveBeenCalledWith({ err }, 'findPr error');
    });

    it('returns empty list in case prs dont exist yet', async () => {
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve({ pullRequestIds: [] });
        });
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: PrState.Open,
      });
      expect(res).toBeNull();
    });

    it('finds any pr with that title in regardless of state', async () => {
      prepareMocksForListPr();
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: PrState.All,
      });
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'open',
        number: 1,
        title: 'someTitle',
      });
    });

    it('finds closed/merged pr', async () => {
      //getPrList()
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve({ pullRequestIds: ['1'] });
        });
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: PrState.NotOpen,
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      //getPr()
      jest.spyOn(codeCommitClient.prototype, 'send').mockImplementation(() => {
        return Promise.resolve(prRes);
      });
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: PrState.NotOpen,
      });
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'closed',
        number: 1,
        title: 'someTitle',
      });
    });

    it('finds any pr', async () => {
      //getPrList()
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve({ pullRequestIds: ['1'] });
        });
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: PrState.Closed,
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      //getPr()
      jest.spyOn(codeCommitClient.prototype, 'send').mockImplementation(() => {
        return Promise.resolve(prRes);
      });
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
      });
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'closed',
        number: 1,
        title: 'someTitle',
      });
    });
  });

  describe('getBranchPr()', () => {
    it('codecommit find PR for branch', async () => {
      prepareMocksForListPr();
      const res = await codeCommit.getBranchPr('sourceBranch');
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'open',
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

  describe('getPr()', () => {
    it('gets pr', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
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
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'open',
        number: 1,
        title: 'someTitle',
      });
    });

    it('gets closed pr', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'CLOSED',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
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
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'closed',
        number: 1,
        title: 'someTitle',
      });
    });

    it('gets merged pr', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
              mergeMetadata: {
                isMerged: true,
              },
            },
          ],
        },
      };

      jest.spyOn(codeCommitClient.prototype, 'send').mockImplementation(() => {
        return Promise.resolve(prRes);
      });

      const res = await codeCommit.getPr(1);
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'merged',
        number: 1,
        title: 'someTitle',
      });
    });

    it('returns null in case input is null', async () => {
      jest.spyOn(codeCommitClient.prototype, 'send').mockImplementation(() => {
        throw new Error('bad creds');
      });

      const res = await codeCommit.getPr(1);
      expect(res).toBeNull();
    });
  });

  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      const encoder = new TextEncoder();
      const int8arrData = encoder.encode(JSON.stringify(data));
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return { fileContent: int8arrData };
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
      const encoder = new TextEncoder();
      const int8arrData = encoder.encode(json5Data);
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return { fileContent: int8arrData };
        });
      const res = await codeCommit.getJsonFile('file.json');
      expect(res).toEqual({ foo: 'bar' });
    });

    it('errors out', async () => {
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw new Error('bad filename');
        });
      const res = await codeCommit.getJsonFile('file.json');
      expect(res).toBeNull();
    });
  });

  describe('getRawFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      const encoder = new TextEncoder();
      const int8arrData = encoder.encode(JSON.stringify(data));
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return { fileContent: int8arrData };
        });
      const res = await codeCommit.getRawFile('file.json');
      expect(res).toBe('{"foo":"bar"}');
    });

    it('returns file content in json5 format', async () => {
      const json5Data = `
        {
          // json5 comment
          foo: 'bar'
        }
      `;
      const encoder = new TextEncoder();
      const int8arrData = encoder.encode(json5Data);
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return { fileContent: int8arrData };
        });
      const res = await codeCommit.getRawFile('file.json');
      expect(res).toBe(`
        {
          // json5 comment
          foo: 'bar'
        }
      `);
    });

    it('errors out', async () => {
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw new Error('bad filename');
        });
      const res = await codeCommit.getRawFile('file.json');
      expect(res).toBeNull();
    });
  });

  describe('createPr()', () => {
    it('posts PR', async () => {
      const prRes = {
        pullRequest: {
          pullRequestId: '1',
          pullRequestStatus: 'OPEN',
          title: 'someTitle',
        },
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(prRes);
        });

      const pr = await codeCommit.createPr({
        sourceBranch: 'sourceBranch',
        targetBranch: 'targetBranch',
        prTitle: 'mytitle',
        prBody: 'mybody',
      });

      expect(pr).toMatchObject({
        number: 1,
        state: 'open',
        title: 'someTitle',
        sourceBranch: 'sourceBranch',
        targetBranch: 'targetBranch',
        sourceRepo: undefined,
      });
    });
  });

  describe('updatePr()', () => {
    it('updates PR', async () => {
      jest.spyOn(codeCommitClient.prototype, 'send').mockImplementation(() => {
        return Promise.resolve();
      });

      await expect(
        codeCommit.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'body',
          state: PrState.Open,
        })
      ).toResolve();
    });

    it('updates PR regardless of status failure', async () => {
      // updatePrDescription
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      // updatePrTitle
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      // updatePrStatus
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw new Error('update status failure');
        });
      await expect(
        codeCommit.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'body',
          state: PrState.Open,
        })
      ).toResolve();
    });

    it('updates PR with status closed', async () => {
      // updatePrDescription
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      // updatePrTitle
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      // updatePrStatus
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      await expect(
        codeCommit.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'body',
          state: PrState.Closed,
        })
      ).toResolve();
    });
  });

  describe('mergePr()', () => {
    it('checks that rebase is not supported', async () => {
      expect(
        await codeCommit.mergePr({
          branchName: 'branch',
          id: 1,
          strategy: 'rebase',
        })
      ).toBeFalse();
    });

    it('posts Merge with auto', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      //getPr()
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(prRes);
        });
      //squash merge
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      const updateStatusRes = {
        pullRequest: {
          pullRequestStatus: 'OPEN',
        },
      };
      //updateStatus
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(updateStatusRes);
        });
      expect(
        await codeCommit.mergePr({
          branchName: 'branch',
          id: 1,
          strategy: 'auto',
        })
      ).toBeTrue();
    });

    it('posts Merge with squash', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      //getPr()
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(prRes);
        });
      //squash merge
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      const updateStatusRes = {
        pullRequest: {
          pullRequestStatus: 'OPEN',
        },
      };
      //updateStatus
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(updateStatusRes);
        });
      expect(
        await codeCommit.mergePr({
          branchName: 'branch',
          id: 5,
          strategy: 'squash',
        })
      ).toBeTrue();
    });

    it('posts Merge with fast-forward', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      //getPr()
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(prRes);
        });
      //squash merge
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      const updateStatusRes = {
        pullRequest: {
          pullRequestStatus: 'OPEN',
        },
      };
      //updateStatus
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(updateStatusRes);
        });
      expect(
        await codeCommit.mergePr({
          branchName: 'branch',
          id: 1,
          strategy: 'fast-forward',
        })
      ).toBe(true);
    });

    it('checks that merge-commit is not supported', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      //getPr()
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(prRes);
        });
      expect(
        await codeCommit.mergePr({
          branchName: 'branch',
          id: 1,
          strategy: 'merge-commit',
        })
      ).toBeFalse();
    });
  });

  describe('ensureComment', () => {
    it('adds comment if missing', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '1',
            repositoryName: 'someRepo',
            beforeCommitId: 'beforeCommitId',
            afterCommitId: 'afterCommitId',
            comments: [
              {
                commentId: '1',
                content: 'my comment content',
              },
            ],
          },
        ],
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(commentsRes);
        });
      const eventsRes = {
        pullRequestEvents: [
          {
            pullRequestSourceReferenceUpdatedEventMetadata: {
              beforeCommitId: 'beforeCid',
              afterCommitId: 'afterCid',
            },
          },
        ],
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(eventsRes);
        });
      //create comment
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(res).toBeTrue();
      expect(logger.info).toHaveBeenCalledWith(
        { repository: undefined, prNo: 42, topic: 'some-subject' },
        'Comment added'
      );
    });

    it('updates comment if different content', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '1',
            repositoryName: 'someRepo',
            beforeCommitId: 'beforeCommitId',
            afterCommitId: 'afterCommitId',
            comments: [
              {
                commentId: '1',
                content: '### some-subject\n\n - my comment content',
              },
            ],
          },
        ],
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(commentsRes);
        });
      //create comment
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(res).toBeTrue();
      expect(logger.debug).toHaveBeenCalledWith(
        { repository: undefined, prNo: 42, topic: 'some-subject' },
        'Comment updated'
      );
    });

    it('does nothing if comment exists and is the same', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '1',
            repositoryName: 'someRepo',
            beforeCommitId: 'beforeCommitId',
            afterCommitId: 'afterCommitId',
            comments: [
              {
                commentId: '1',
                content: '### some-subject\n\nmy comment content',
              },
            ],
          },
        ],
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(commentsRes);
        });
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'my comment content',
      });
      expect(res).toBeTrue();
      expect(logger.debug).toHaveBeenCalledWith(
        { repository: undefined, prNo: 42, topic: 'some-subject' },
        'Comment is already update-to-date'
      );
    });

    it('does nothing if comment exists and is the same when there is no topic', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '1',
            repositoryName: 'someRepo',
            beforeCommitId: 'beforeCommitId',
            afterCommitId: 'afterCommitId',
            comments: [
              {
                commentId: '1',
                content: 'my comment content',
              },
            ],
          },
        ],
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(commentsRes);
        });
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: null,
        content: 'my comment content',
      });
      expect(res).toBeTrue();
      expect(logger.debug).toHaveBeenCalledWith(
        { repository: undefined, prNo: 42, topic: null },
        'Comment is already update-to-date'
      );
    });

    it('throws an exception in case of api failed connection ', async () => {
      const err = new Error('some error');
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw err;
        });
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: null,
        content: 'my comment content',
      });
      expect(res).toBeFalse();
      expect(logger.debug).toHaveBeenCalledWith(
        { err },
        'Unable to retrieve pr comments'
      );
    });
  });

  describe('ensureCommentRemoval', () => {
    it('deletes comment by topic if found', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '1',
            repositoryName: 'someRepo',
            beforeCommitId: 'beforeCommitId',
            afterCommitId: 'afterCommitId',
            comments: [
              {
                commentId: '1',
                content: '### some-subject\n\nmy comment content',
              },
            ],
          },
        ],
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(commentsRes);
        });
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      await codeCommit.ensureCommentRemoval({
        type: 'by-topic',
        number: 42,
        topic: 'some-subject',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'comment "some-subject" in PR #42 was removed'
      );
    });

    it('deletes comment by content if found', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '1',
            repositoryName: 'someRepo',
            beforeCommitId: 'beforeCommitId',
            afterCommitId: 'afterCommitId',
            comments: [
              {
                commentId: '1',
                content: 'my comment content',
              },
            ],
          },
        ],
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(commentsRes);
        });
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve();
        });
      await codeCommit.ensureCommentRemoval({
        type: 'by-content',
        number: 42,
        content: 'my comment content',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'comment "my comment content" in PR #42 was removed'
      );
    });

    it('throws exception in case failed api connection', async () => {
      const err = new Error('some error');
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          throw err;
        });
      await codeCommit.ensureCommentRemoval({
        type: 'by-content',
        number: 42,
        content: 'my comment content',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { err },
        'Unable to retrieve pr comments'
      );
    });
  });

  describe('addReviewers', () => {
    it('checks that the function resolves', async () => {
      const res = {
        approvalRule: {
          approvalRuleName: 'Assignees By Renovate',
          lastModifiedDate: 1570752871.932,
          ruleContentSha256: '7c44e6ebEXAMPLE',
          creationDate: 1570752871.932,
          approvalRuleId: 'aac33506-EXAMPLE',
          approvalRuleContent:
            '{"Version": "2018-11-08","Statements": [{"Type": "Approvers","NumberOfApprovalsNeeded": 1,"ApprovalPoolMembers": ["arn:aws:iam::someUser:user/ReviewerUser"]}]}',
          lastModifiedUser: 'arn:aws:iam::someUser:user/ReviewerUser',
        },
      };
      jest
        .spyOn(codeCommitClient.prototype, 'send')
        .mockImplementationOnce(() => {
          return Promise.resolve(res);
        });
      await expect(
        codeCommit.addReviewers(13, ['arn:aws:iam::someUser:user/ReviewerUser'])
      ).toResolve();
      expect(logger.debug).toHaveBeenCalledWith(
        res,
        'Approval Rule Added to PR #13:'
      );
    });
  });
});
