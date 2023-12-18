import {
  CodeCommitClient,
  CreatePullRequestApprovalRuleCommand,
  CreatePullRequestCommand,
  DeleteCommentContentCommand,
  GetCommentsForPullRequestCommand,
  GetFileCommand,
  GetPullRequestCommand,
  GetRepositoryCommand,
  ListPullRequestsCommand,
  ListRepositoriesCommand,
  PostCommentForPullRequestCommand,
  UpdatePullRequestDescriptionCommand,
  UpdatePullRequestStatusCommand,
  UpdatePullRequestTitleCommand,
} from '@aws-sdk/client-codecommit';
import { mockClient } from 'aws-sdk-client-mock';
import * as aws4 from 'aws4';
import { logger } from '../../../../test/util';
import {
  PLATFORM_BAD_CREDENTIALS,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import * as git from '../../../util/git';
import type { Platform } from '../types';
import { getCodeCommitUrl } from './codecommit-client';
import { CodeCommitPr, config } from './index';

const codeCommitClient = mockClient(CodeCommitClient);

describe('modules/platform/codecommit/index', () => {
  let codeCommit: Platform;

  beforeAll(async () => {
    codeCommit = await import('.');
    await codeCommit.initPlatform({
      endpoint: 'https://git-codecommit.eu-central-1.amazonaws.com/',
      username: 'accessKeyId',
      password: 'SecretAccessKey',
      token: 'token',
    });
  });

  beforeEach(() => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    codeCommitClient.reset();
    config.prList = undefined;
    config.repository = undefined;
    jest.useRealTimers();
  });

  it('validates massageMarkdown functionality', () => {
    const newStr = codeCommit.massageMarkdown(
      '<details><summary>foo</summary>bar</details>text<details>\n<!--renovate-debug:hiddenmessage123-->',
    );
    expect(newStr).toBe(
      '**foo**bartext\n[//]: # (<!--renovate-debug:hiddenmessage123-->)',
    );
  });

  describe('initPlatform()', () => {
    it('should init', async () => {
      expect(
        await codeCommit.initPlatform({
          endpoint: 'https://git-codecommit.REGION.amazonaws.com/',
          username: 'abc',
          password: '123',
        }),
      ).toEqual({
        endpoint: 'https://git-codecommit.REGION.amazonaws.com/',
      });
    });

    it('should init with env vars', async () => {
      process.env.AWS_REGION = 'REGION';
      await expect(
        codeCommit.initPlatform({
          username: 'abc',
          password: '123',
        }),
      ).resolves.toEqual({
        endpoint: 'https://git-codecommit.REGION.amazonaws.com/',
      });
    });

    it('should', async () => {
      await expect(
        codeCommit.initPlatform({ endpoint: 'non://parsable.url' }),
      ).resolves.toEqual({
        endpoint: 'non://parsable.url',
      });
    });

    it('should as well', async () => {
      await expect(codeCommit.initPlatform({})).resolves.toEqual({
        endpoint: 'https://git-codecommit.us-east-1.amazonaws.com/',
      });
    });
  });

  describe('initRepos()', () => {
    it('fails to git.initRepo', async () => {
      jest.spyOn(git, 'initRepo').mockImplementationOnce(() => {
        throw new Error('any error');
      });
      codeCommitClient.on(GetRepositoryCommand).resolvesOnce({
        repositoryMetadata: {
          defaultBranch: 'main',
          repositoryId: 'id',
        },
      });

      await expect(
        codeCommit.initRepo({ repository: 'repositoryName' }),
      ).rejects.toThrow(new Error(PLATFORM_BAD_CREDENTIALS));
    });

    it('fails on getRepositoryInfo', async () => {
      jest.spyOn(git, 'initRepo').mockReturnValueOnce(Promise.resolve());
      codeCommitClient
        .on(GetRepositoryCommand)
        .rejectsOnce(new Error('Could not find repository'));
      await expect(
        codeCommit.initRepo({ repository: 'repositoryName' }),
      ).rejects.toThrow(new Error(REPOSITORY_NOT_FOUND));
    });

    it('getRepositoryInfo returns bad results', async () => {
      jest.spyOn(git, 'initRepo').mockReturnValueOnce(Promise.resolve());
      codeCommitClient.on(GetRepositoryCommand).resolvesOnce({});
      await expect(
        codeCommit.initRepo({ repository: 'repositoryName' }),
      ).rejects.toThrow(new Error(REPOSITORY_NOT_FOUND));
    });

    it('getRepositoryInfo returns bad results 2', async () => {
      jest.spyOn(git, 'initRepo').mockReturnValueOnce(Promise.resolve());
      codeCommitClient.on(GetRepositoryCommand).resolvesOnce({
        repositoryMetadata: {
          repositoryId: 'id',
        },
      });
      await expect(
        codeCommit.initRepo({ repository: 'repositoryName' }),
      ).rejects.toThrow(new Error(REPOSITORY_EMPTY));
    });

    it('initiates repo successfully', async () => {
      jest.spyOn(git, 'initRepo').mockReturnValueOnce(Promise.resolve());
      codeCommitClient.on(GetRepositoryCommand).resolvesOnce({
        repositoryMetadata: {
          defaultBranch: 'main',
          repositoryId: 'id',
        },
      });
      process.env.AWS_ACCESS_KEY_ID = 'something';
      process.env.AWS_SECRET_ACCESS_KEY = 'something';
      await expect(
        codeCommit.initRepo({ repository: 'repositoryName' }),
      ).resolves.toEqual({
        repoFingerprint:
          'f0bcfd81abefcdf9ae5e5de58d1a868317503ea76422309bc212d1ef25a1e67789d0bfa752a7e2abd4510f4f3e4f60cdaf6202a42883fb97bb7110ab3600785e',
        defaultBranch: 'main',
        isFork: false,
      });
    });

    it('gets the right url', () => {
      process.env.AWS_ACCESS_KEY_ID = '';
      process.env.AWS_SECRET_ACCESS_KEY = '';
      expect(
        getCodeCommitUrl(
          {
            defaultBranch: 'main',
            repositoryId: 'id',
            cloneUrlHttp:
              'https://git-codecommit.us-east-1.amazonaws.com/v1/repos/name',
          },
          'name',
        ),
      ).toBe('https://git-codecommit.us-east-1.amazonaws.com/v1/repos/name');
    });

    it('gets the eu-central-1 url', () => {
      process.env.AWS_ACCESS_KEY_ID = '';
      process.env.AWS_SECRET_ACCESS_KEY = '';
      process.env.AWS_REGION = 'eu-central-1';
      expect(
        getCodeCommitUrl(
          {
            defaultBranch: 'main',
            repositoryId: 'id',
          },
          'name',
        ),
      ).toBe('https://git-codecommit.eu-central-1.amazonaws.com/v1/repos/name');
    });

    it('gets url with username and token', () => {
      jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));
      process.env.AWS_ACCESS_KEY_ID = 'access-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret-access-key';
      process.env.AWS_REGION = 'eu-central-1';
      process.env.AWS_SESSION_TOKEN = '';
      const signer = new aws4.RequestSigner({
        service: 'codecommit',
        host: 'git-codecommit.eu-central-1.amazonaws.com',
        method: 'GIT',
        path: 'v1/repos/name',
      });
      const dateTime = signer.getDateTime();
      const token = `${dateTime}Z${signer.signature()}`;
      expect(
        getCodeCommitUrl(
          {
            defaultBranch: 'main',
            repositoryId: 'id',
          },
          'name',
        ),
      ).toBe(
        `https://access-key-id:${token}@git-codecommit.eu-central-1.amazonaws.com/v1/repos/name`,
      );
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
      codeCommitClient.on(ListRepositoriesCommand).resolvesOnce(result);

      const res = await codeCommit.getRepos();
      expect(res).toEqual(['repoName']);
    });

    it('returns empty if error', async () => {
      codeCommitClient
        .on(ListRepositoriesCommand)
        .rejectsOnce(new Error('something'));
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

  describe('getPrList()', () => {
    it('gets PR list by author', async () => {
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['1', '2'] });
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
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce({});
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
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
      codeCommitClient
        .on(GetPullRequestCommand)
        .rejectsOnce(new Error('failed connection'));
      // test cache
      const res2 = await codeCommit.getPrList();
      expect(res2).toMatchObject([
        {
          sourceBranch: 'refs/heads/sourceBranch',
          targetBranch: 'refs/heads/targetBranch',
          state: 'open',
          number: 1,
          title: 'someTitle',
        },
      ]);
    });

    it('checks if nullcheck works for list prs', async () => {
      codeCommitClient.on(ListPullRequestsCommand).resolvesOnce({});
      const res = await codeCommit.getPrList();
      expect(res).toEqual([]);
    });
  });

  describe('findPr()', () => {
    it('throws error on findPr', async () => {
      const err = new Error('failed');
      codeCommitClient.on(ListPullRequestsCommand).rejectsOnce(err);
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: 'open',
      });
      expect(res).toBeNull();
      expect(logger.logger.error).toHaveBeenCalledWith({ err }, 'findPr error');
    });

    it('finds pr', async () => {
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['1'] });
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
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: 'open',
      });
      expect(res).toMatchObject({
        sourceBranch: 'refs/heads/sourceBranch',
        targetBranch: 'refs/heads/targetBranch',
        state: 'open',
        number: 1,
        title: 'someTitle',
      });
    });

    it('finds any pr with that title in regardless of state', async () => {
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['1'] });
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
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: 'all',
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
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['1'] });
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: '!open',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: '!open',
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
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['1'] });
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          pullRequestStatus: 'closed',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
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

    it('returns empty list in case prs dont exist yet', async () => {
      const res = await codeCommit.findPr({
        branchName: 'sourceBranch',
        prTitle: 'someTitle',
        state: 'open',
      });
      expect(res).toBeNull();
    });
  });

  describe('getBranchPr()', () => {
    it('codecommit find PR for branch', async () => {
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['1'] });
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
      codeCommitClient.on(GetPullRequestCommand).resolves(prRes);
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
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['1'] });
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
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
      const res = await codeCommit.getBranchPr('branch_without_pr');
      expect(res).toBeNull();
    });
  });

  describe('getPr()', () => {
    it('gets pr', async () => {
      const prRes = {
        pullRequest: {
          title: 'someTitle',
          description: 'body',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
            },
          ],
        },
      };

      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);

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

      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);

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

      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);

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
      codeCommitClient
        .on(GetPullRequestCommand)
        .rejectsOnce(new Error('bad creds'));
      const res = await codeCommit.getPr(1);
      expect(res).toBeNull();
    });
  });

  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      const uint8arrData = new Uint8Array(Buffer.from(JSON.stringify(data)));
      codeCommitClient
        .on(GetFileCommand)
        .resolvesOnce({ fileContent: uint8arrData });
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
      const uint8arrData = new Uint8Array(Buffer.from(json5Data));
      codeCommitClient
        .on(GetFileCommand)
        .resolvesOnce({ fileContent: uint8arrData });
      const res = await codeCommit.getJsonFile('file.json');
      expect(res).toEqual({ foo: 'bar' });
    });

    it('returns null', async () => {
      codeCommitClient
        .on(GetFileCommand)
        .resolvesOnce({ fileContent: undefined });
      const res = await codeCommit.getJsonFile('file.json');
      expect(res).toBeNull();
    });
  });

  describe('getRawFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      const uint8arrData = new Uint8Array(Buffer.from(JSON.stringify(data)));
      codeCommitClient
        .on(GetFileCommand)
        .resolvesOnce({ fileContent: uint8arrData });
      const res = await codeCommit.getRawFile('file.json');
      expect(res).toBe('{"foo":"bar"}');
    });

    it('returns null', async () => {
      codeCommitClient
        .on(GetFileCommand)
        .resolvesOnce({ fileContent: undefined });
      const res = await codeCommit.getRawFile('file.json');
      expect(res).toBeNull();
    });

    it('returns file content in json5 format', async () => {
      const json5Data = `
        {
          // json5 comment
          foo: 'bar'
        }
      `;
      const uint8arrData = new Uint8Array(Buffer.from(json5Data));
      codeCommitClient
        .on(GetFileCommand)
        .resolvesOnce({ fileContent: uint8arrData });
      const res = await codeCommit.getRawFile('file.json');
      expect(res).toBe(`
        {
          // json5 comment
          foo: 'bar'
        }
      `);
    });
  });

  describe('createPr()', () => {
    it('posts PR', async () => {
      const prRes = {
        pullRequest: {
          pullRequestId: '1',
          pullRequestStatus: 'OPEN',
          title: 'someTitle',
          description: 'mybody',
          pullRequestTargets: [
            {
              sourceCommit: '123',
              destinationCommit: '321',
            },
          ],
        },
      };

      codeCommitClient.on(CreatePullRequestCommand).resolvesOnce(prRes);
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
        body: 'mybody',
      });
    });

    it('doesnt return a title', async () => {
      const prRes = {
        pullRequest: {
          pullRequestId: '1',
          pullRequestStatus: 'OPEN',
        },
      };

      codeCommitClient.on(CreatePullRequestCommand).resolvesOnce(prRes);

      await expect(
        codeCommit.createPr({
          sourceBranch: 'sourceBranch',
          targetBranch: 'targetBranch',
          prTitle: 'mytitle',
          prBody: 'mybody',
        }),
      ).rejects.toThrow(new Error('Could not create pr, missing PR info'));
    });
  });

  describe('updatePr()', () => {
    it('updates PR', async () => {
      codeCommitClient.on(UpdatePullRequestDescriptionCommand).resolvesOnce({});
      codeCommitClient.on(UpdatePullRequestTitleCommand).resolvesOnce({});
      codeCommitClient.on(UpdatePullRequestStatusCommand).resolvesOnce({});
      await expect(
        codeCommit.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'body',
          state: 'open',
        }),
      ).toResolve();
    });

    it('updates PR body if cache is not the same', async () => {
      config.prList = [];
      const pr: CodeCommitPr = {
        number: 1,
        state: 'open',
        title: 'someTitle',
        sourceBranch: 'sourceBranch',
        targetBranch: 'targetBranch',
        sourceCommit: '123',
        destinationCommit: '321',
        sourceRepo: undefined,
        body: 'some old description',
      };
      config.prList.push(pr);
      codeCommitClient.on(UpdatePullRequestDescriptionCommand).resolvesOnce({});
      codeCommitClient.on(UpdatePullRequestTitleCommand).resolvesOnce({});
      codeCommitClient.on(UpdatePullRequestStatusCommand).resolvesOnce({});
      await expect(
        codeCommit.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'new description',
          state: 'open',
        }),
      ).toResolve();
    });

    it('updates PR body does not update if cache is the same', async () => {
      config.prList = [];
      const pr: CodeCommitPr = {
        number: 1,
        state: 'open',
        title: 'someTitle',
        sourceBranch: 'sourceBranch',
        targetBranch: 'targetBranch',
        sourceCommit: '123',
        destinationCommit: '321',
        sourceRepo: undefined,
        body: 'new description',
      };
      config.prList.push(pr);
      codeCommitClient.on(UpdatePullRequestTitleCommand).resolvesOnce({});
      codeCommitClient.on(UpdatePullRequestStatusCommand).resolvesOnce({});
      await expect(
        codeCommit.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'new description',
          state: 'open',
        }),
      ).toResolve();
    });

    it('updates PR regardless of status failure', async () => {
      codeCommitClient.on(UpdatePullRequestDescriptionCommand).resolvesOnce({});
      codeCommitClient.on(UpdatePullRequestTitleCommand).resolvesOnce({});
      codeCommitClient
        .on(UpdatePullRequestStatusCommand)
        .rejectsOnce(new Error('update status failure'));
      await expect(
        codeCommit.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'body',
          state: 'open',
        }),
      ).toResolve();
    });

    it('updates PR with status closed', async () => {
      codeCommitClient.on(UpdatePullRequestDescriptionCommand).resolvesOnce({});
      codeCommitClient.on(UpdatePullRequestTitleCommand).resolvesOnce({});
      codeCommitClient.on(UpdatePullRequestStatusCommand).resolvesOnce({});
      await expect(
        codeCommit.updatePr({
          number: 1,
          prTitle: 'title',
          prBody: 'body',
          state: 'closed',
        }),
      ).toResolve();
    });
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  // describe('mergePr()', () => {
  // eslint-disable-next-line jest/no-commented-out-tests
  //   it('checks that rebase is not supported', async () => {
  //     expect(
  //       await codeCommit.mergePr({
  //         branchName: 'branch',
  //         id: 1,
  //         strategy: 'rebase',
  //       })
  //     ).toBeFalse();
  //   });

  // eslint-disable-next-line jest/no-commented-out-tests
  //   it('posts Merge with auto', async () => {
  //     const prRes = {
  //       pullRequest: {
  //         title: 'someTitle',
  //         pullRequestStatus: 'OPEN',
  //         pullRequestTargets: [
  //           {
  //             sourceReference: 'refs/heads/sourceBranch',
  //             destinationReference: 'refs/heads/targetBranch',
  //           },
  //         ],
  //       },
  //     };
  //     codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
  //     codeCommitClient.on(MergeBranchesBySquashCommand).resolvesOnce({});
  //
  //     const updateStatusRes = {
  //       pullRequest: {
  //         pullRequestStatus: 'OPEN',
  //       },
  //     };
  //     codeCommitClient
  //       .on(UpdatePullRequestStatusCommand)
  //       .resolvesOnce(updateStatusRes);
  //     expect(
  //       await codeCommit.mergePr({
  //         branchName: 'branch',
  //         id: 1,
  //         strategy: 'auto',
  //       })
  //     ).toBeTrue();
  //   });
  //
  // eslint-disable-next-line jest/no-commented-out-tests
  //   it('posts Merge with squash', async () => {
  //     const prRes = {
  //       pullRequest: {
  //         title: 'someTitle',
  //         pullRequestStatus: 'OPEN',
  //         pullRequestTargets: [
  //           {
  //             sourceReference: 'refs/heads/sourceBranch',
  //             destinationReference: 'refs/heads/targetBranch',
  //           },
  //         ],
  //       },
  //     };
  //     codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
  //     codeCommitClient.on(MergeBranchesBySquashCommand).resolvesOnce({});
  //     const updateStatusRes = {
  //       pullRequest: {
  //         pullRequestStatus: 'OPEN',
  //       },
  //     };
  //     codeCommitClient
  //       .on(UpdatePullRequestStatusCommand)
  //       .resolvesOnce(updateStatusRes);
  //     expect(
  //       await codeCommit.mergePr({
  //         branchName: 'branch',
  //         id: 5,
  //         strategy: 'squash',
  //       })
  //     ).toBeTrue();
  //   });

  // eslint-disable-next-line jest/no-commented-out-tests
  //   it('posts Merge with fast-forward', async () => {
  //     const prRes = {
  //       pullRequest: {
  //         title: 'someTitle',
  //         pullRequestStatus: 'OPEN',
  //         pullRequestTargets: [
  //           {
  //             sourceReference: 'refs/heads/sourceBranch',
  //             destinationReference: 'refs/heads/targetBranch',
  //           },
  //         ],
  //       },
  //     };
  //     codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
  //     codeCommitClient.on(MergeBranchesBySquashCommand).resolvesOnce({});
  //     const updateStatusRes = {
  //       pullRequest: {
  //         pullRequestStatus: 'OPEN',
  //       },
  //     };
  //     codeCommitClient
  //       .on(UpdatePullRequestStatusCommand)
  //       .resolvesOnce(updateStatusRes);
  //     expect(
  //       await codeCommit.mergePr({
  //         branchName: 'branch',
  //         id: 1,
  //         strategy: 'fast-forward',
  //       })
  //     ).toBe(true);
  //   });

  // eslint-disable-next-line jest/no-commented-out-tests
  //   it('checks that merge-commit is not supported', async () => {
  //     const prRes = {
  //       pullRequest: {
  //         title: 'someTitle',
  //         pullRequestStatus: 'OPEN',
  //         pullRequestTargets: [
  //           {
  //             sourceReference: 'refs/heads/sourceBranch',
  //             destinationReference: 'refs/heads/targetBranch',
  //           },
  //         ],
  //       },
  //     };
  //     codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
  //     expect(
  //       await codeCommit.mergePr({
  //         branchName: 'branch',
  //         id: 1,
  //         strategy: 'merge-commit',
  //       })
  //     ).toBeFalse();
  //   });
  // });

  describe('ensureComment', () => {
    it('adds comment if missing', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '42',
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
      codeCommitClient
        .on(GetCommentsForPullRequestCommand)
        .resolvesOnce(commentsRes);
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['42'] });
      const prRes = {
        pullRequest: {
          number: '42',
          title: 'someTitle',
          pullRequestStatus: 'OPEN',
          pullRequestTargets: [
            {
              sourceReference: 'refs/heads/sourceBranch',
              destinationReference: 'refs/heads/targetBranch',
              sourceCommit: '123',
              destinationCommit: '321',
            },
          ],
        },
      };
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
      codeCommitClient.on(PostCommentForPullRequestCommand).resolvesOnce({});
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(res).toBeTrue();
      expect(logger.logger.info).toHaveBeenCalledWith(
        { repository: undefined, prNo: 42, topic: 'some-subject' },
        'Comment added',
      );
    });

    it('updates comment if different content', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '42',
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
      codeCommitClient
        .on(GetCommentsForPullRequestCommand)
        .resolvesOnce(commentsRes);
      codeCommitClient.on(PostCommentForPullRequestCommand).resolvesOnce({});
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(res).toBeTrue();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { repository: undefined, prNo: 42, topic: 'some-subject' },
        'Comment updated',
      );
    });

    it('does nothing if comment exists and is the same', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '42',
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
      codeCommitClient
        .on(GetCommentsForPullRequestCommand)
        .resolvesOnce(commentsRes);
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'my comment content',
      });
      expect(res).toBeTrue();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { repository: undefined, prNo: 42, topic: 'some-subject' },
        'Comment is already update-to-date',
      );
    });

    it('does nothing if comment exists and is the same when there is no topic', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '42',
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
      codeCommitClient
        .on(GetCommentsForPullRequestCommand)
        .resolvesOnce(commentsRes);
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: null,
        content: 'my comment content',
      });
      expect(res).toBeTrue();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { repository: undefined, prNo: 42, topic: null },
        'Comment is already update-to-date',
      );
    });

    it('throws an exception in case of api failed connection ', async () => {
      const err = new Error('some error');
      codeCommitClient.on(GetCommentsForPullRequestCommand).rejectsOnce(err);
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: null,
        content: 'my comment content',
      });
      expect(res).toBeFalse();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { err },
        'Unable to retrieve pr comments',
      );
    });

    it('fails at null check for response', async () => {
      codeCommitClient.on(GetCommentsForPullRequestCommand).resolvesOnce({});
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: null,
        content: 'my comment content',
      });
      expect(res).toBeFalse();
    });

    it('doesnt find comments obj and source or destination commit', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '42',
            repositoryName: 'someRepo',
            beforeCommitId: 'beforeCommitId',
            afterCommitId: 'afterCommitId',
          },
        ],
      };
      codeCommitClient
        .on(GetCommentsForPullRequestCommand)
        .resolvesOnce(commentsRes);
      codeCommitClient
        .on(ListPullRequestsCommand)
        .resolvesOnce({ pullRequestIds: ['42'] });
      const prRes = {
        pullRequest: {
          number: '42',
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
      codeCommitClient.on(GetPullRequestCommand).resolvesOnce(prRes);
      const res = await codeCommit.ensureComment({
        number: 42,
        topic: null,
        content: 'my comment content',
      });
      expect(res).toBeFalse();
    });
  });

  describe('ensureCommentRemoval', () => {
    it('deletes comment by topic if found', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '42',
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
      codeCommitClient
        .on(GetCommentsForPullRequestCommand)
        .resolvesOnce(commentsRes);
      codeCommitClient.on(DeleteCommentContentCommand).resolvesOnce({});
      await codeCommit.ensureCommentRemoval({
        type: 'by-topic',
        number: 42,
        topic: 'some-subject',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'comment "some-subject" in PR #42 was removed',
      );
    });

    it('doesnt find commentsForPullRequestData', async () => {
      codeCommitClient.on(GetCommentsForPullRequestCommand).resolvesOnce({});
      codeCommitClient.on(DeleteCommentContentCommand).resolvesOnce({});
      await codeCommit.ensureCommentRemoval({
        type: 'by-topic',
        number: 42,
        topic: 'some-subject',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'commentsForPullRequestData not found',
      );
    });

    it('doesnt find comment obj', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '42',
            repositoryName: 'someRepo',
            beforeCommitId: 'beforeCommitId',
            afterCommitId: 'afterCommitId',
          },
        ],
      };
      codeCommitClient
        .on(GetCommentsForPullRequestCommand)
        .resolvesOnce(commentsRes);
      codeCommitClient.on(DeleteCommentContentCommand).resolvesOnce({});
      await codeCommit.ensureCommentRemoval({
        type: 'by-topic',
        number: 42,
        topic: 'some-subject',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'comments object not found under commentsForPullRequestData',
      );
    });

    it('deletes comment by content if found', async () => {
      const commentsRes = {
        commentsForPullRequestData: [
          {
            pullRequestId: '42',
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
      codeCommitClient
        .on(GetCommentsForPullRequestCommand)
        .resolvesOnce(commentsRes);
      codeCommitClient.on(DeleteCommentContentCommand).resolvesOnce({});
      await codeCommit.ensureCommentRemoval({
        type: 'by-content',
        number: 42,
        content: 'my comment content',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'comment "my comment content" in PR #42 was removed',
      );
    });

    it('throws exception in case failed api connection', async () => {
      const err = new Error('some error');
      codeCommitClient.on(GetCommentsForPullRequestCommand).rejectsOnce(err);
      await codeCommit.ensureCommentRemoval({
        type: 'by-content',
        number: 42,
        content: 'my comment content',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { err },
        'Unable to retrieve pr comments',
      );
    });
  });

  describe('addReviewers', () => {
    it('checks that the function resolves', async () => {
      const res = {
        approvalRule: {
          approvalRuleName: 'Assignees By Renovate',
          lastModifiedDate: new Date(),
          ruleContentSha256: '7c44e6ebEXAMPLE',
          creationDate: new Date(),
          approvalRuleId: 'aac33506-EXAMPLE',
          approvalRuleContent:
            '{"Version": "2018-11-08","Statements": [{"Type": "Approvers","NumberOfApprovalsNeeded": 1,"ApprovalPoolMembers": ["arn:aws:iam::someUser:user/ReviewerUser"]}]}',
          lastModifiedUser: 'arn:aws:iam::someUser:user/ReviewerUser',
        },
      };
      codeCommitClient
        .on(CreatePullRequestApprovalRuleCommand)
        .resolvesOnce(res);
      await expect(
        codeCommit.addReviewers(13, [
          'arn:aws:iam::someUser:user/ReviewerUser',
        ]),
      ).toResolve();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        res,
        'Approval Rule Added to PR #13:',
      );
    });
  });
});
