// eslint-disable-next-line no-unused-vars
const URL = require('url');
// eslint-disable-next-line no-unused-vars
const responses = require('./_fixtures/responses');

describe('platform/bitbucket-server', () => {
  Object.entries(responses).forEach(([scenarioName, mockResponses]) => {
    describe(scenarioName, () => {
      let bitbucket;
      let api;
      let hostRules;
      let GitStorage;
      beforeEach(() => {
        // reset module
        jest.resetModules();
        jest.mock('got', () => (url, options) => {
          const { method } = options;
          const body = mockResponses[url] && mockResponses[url][method];
          if (!body) {
            return Promise.reject(new Error(`no match for ${method} ${url}`));
          }
          if (body instanceof Promise) {
            return body;
          }
          return Promise.resolve({ body });
        });
        jest.mock('../../../lib/platform/git/storage');
        hostRules = require('../../../lib/util/host-rules');
        api = require('../../../lib/platform/bitbucket-server/bb-got-wrapper');
        jest.spyOn(api, 'get');
        jest.spyOn(api, 'post');
        jest.spyOn(api, 'put');
        jest.spyOn(api, 'delete');
        bitbucket = require('../../../lib/platform/bitbucket-server');
        GitStorage = require('../../../lib/platform/git/storage');
        GitStorage.mockImplementation(() => ({
          initRepo: jest.fn(),
          cleanRepo: jest.fn(),
          getFileList: jest.fn(),
          branchExists: jest.fn(() => true),
          isBranchStale: jest.fn(() => false),
          setBaseBranch: jest.fn(),
          getBranchLastCommitTime: jest.fn(),
          getAllRenovateBranches: jest.fn(),
          getCommitMessages: jest.fn(),
          getFile: jest.fn(),
          commitFilesToBranch: jest.fn(),
          mergeBranch: jest.fn(),
          deleteBranch: jest.fn(),
          getRepoStatus: jest.fn(),
          getBranchCommit: jest.fn(
            () => '0d9c7726c3d628b7e28af234595cfd20febdbf8e'
          ),
        }));

        // clean up hostRules
        hostRules.clear();
        hostRules.update({
          platform: 'bitbucket-server',
          token: 'token',
          username: 'username',
          password: 'password',
          endpoint: mockResponses.baseURL,
        });
      });

      afterEach(() => {
        bitbucket.cleanRepo();
      });

      function initRepo() {
        return bitbucket.initRepo({
          repository: 'SOME/repo',
          gitAuthor: 'bot@renovateapp.com',
        });
      }

      describe('getRepos()', () => {
        it('returns repos', async () => {
          expect.assertions(2);
          expect(await bitbucket.getRepos()).toEqual(['some/repo']);
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('initRepo()', () => {
        it('works', async () => {
          expect.assertions(1);
          const res = await initRepo();
          expect(res).toMatchSnapshot();
        });

        it('no author', async () => {
          expect.assertions(1);
          const res = await bitbucket.initRepo({
            repository: 'SOME/repo',
          });
          expect(res).toMatchSnapshot();
        });

        it('sends the host as the endpoint option', async () => {
          expect.assertions(2);
          GitStorage.getUrl.mockClear();
          await bitbucket.initRepo({
            repository: 'SOME/repo',
          });
          expect(GitStorage.getUrl).toHaveBeenCalledTimes(1);
          expect(GitStorage.getUrl.mock.calls[0][0]).toHaveProperty(
            'host',
            `${mockResponses.baseURL.replace('https://', '')}/scm`
          );
        });
      });

      describe('repoForceRebase()', () => {
        it('always return false, since bitbucket does not support force rebase', () => {
          expect.assertions(1);
          const actual = bitbucket.getRepoForceRebase();
          expect(actual).toBe(false);
        });
      });

      describe('setBaseBranch()', () => {
        it('updates file list', async () => {
          expect.assertions(1);
          await initRepo();
          await bitbucket.setBaseBranch('branch');
          await bitbucket.setBaseBranch();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('getFileList()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.getFileList();
        });
      });

      describe('branchExists()', () => {
        describe('getFileList()', () => {
          it('sends to gitFs', async () => {
            await initRepo();
            await bitbucket.branchExists();
          });
        });
      });

      describe('isBranchStale()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.isBranchStale();
        });
      });

      describe('deleteBranch()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.deleteBranch('branch');
        });
      });

      describe('mergeBranch()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.mergeBranch('branch');
        });
      });

      describe('commitFilesToBranch()', () => {
        it('sends to gitFs', async () => {
          expect.assertions(1);
          await initRepo();
          await bitbucket.commitFilesToBranch('some-branch', [{}]);
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('getFile()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.getFile();
        });
      });

      describe('getAllRenovateBranches()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.getAllRenovateBranches();
        });
      });

      describe('getBranchLastCommitTime()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.getBranchLastCommitTime();
        });
      });

      describe('addAssignees()', () => {
        it('does not throw', async () => {
          await bitbucket.addAssignees(3, ['some']);
        });
      });

      describe('addReviewers', () => {
        it('does not throw', async () => {
          await initRepo();
          await bitbucket.addReviewers(5, ['name']);
        });

        it('sends the reviewer name as a reviewer', async () => {
          expect.assertions(1);
          await initRepo();
          await bitbucket.addReviewers(5, ['name']);
          expect(api.post.mock.calls).toMatchSnapshot();
        });
      });

      describe('deleteLAbel()', () => {
        it('does not throw', async () => {
          await bitbucket.deleteLabel(5, 'renovate');
        });
      });

      describe('ensureComment()', () => {
        it('does not throw', async () => {
          expect.assertions(2);
          expect(await bitbucket.ensureComment(3, 'topic', 'content')).toBe(
            false
          );
          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('add comment if not found', async () => {
          expect.assertions(6);
          await initRepo();
          api.get.mockClear();

          expect(await bitbucket.ensureComment(5, 'topic', 'content')).toBe(
            true
          );
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post).toHaveBeenCalledTimes(1);

          api.get.mockClear();
          api.post.mockClear();

          expect(await bitbucket.ensureComment(5, null, 'content')).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post).toHaveBeenCalledTimes(1);
        });

        it('add updates comment if necessary', async () => {
          expect.assertions(8);
          await initRepo();
          api.get.mockClear();

          expect(
            await bitbucket.ensureComment(5, 'some-subject', 'some\ncontent')
          ).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post).toHaveBeenCalledTimes(0);
          expect(api.put).toHaveBeenCalledTimes(1);

          api.get.mockClear();
          api.put.mockClear();

          expect(await bitbucket.ensureComment(5, null, 'some\ncontent')).toBe(
            true
          );
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post).toHaveBeenCalledTimes(1);
          expect(api.put).toHaveBeenCalledTimes(0);
        });

        it('skips comment', async () => {
          expect.assertions(6);
          await initRepo();
          api.get.mockClear();

          expect(
            await bitbucket.ensureComment(5, 'some-subject', 'blablabla')
          ).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put).toHaveBeenCalledTimes(0);

          api.get.mockClear();
          api.put.mockClear();

          expect(await bitbucket.ensureComment(5, null, '!merge')).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put).toHaveBeenCalledTimes(0);
        });
      });

      describe('ensureCommentRemoval()', () => {
        it('does not throw', async () => {
          expect.assertions(1);
          await bitbucket.ensureCommentRemoval(5, 'topic');
          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('deletes comment if found', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockClear();

          await bitbucket.ensureCommentRemoval(5, 'some-subject');
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.delete).toHaveBeenCalledTimes(1);
        });

        it('deletes nothing', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockClear();

          await bitbucket.ensureCommentRemoval(5, 'topic');
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.delete).toHaveBeenCalledTimes(0);
        });
      });

      describe('getPrList()', () => {
        it('has pr', async () => {
          expect.assertions(2);
          await initRepo();
          expect(await bitbucket.getPrList()).toMatchSnapshot();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('getBranchPr()', () => {
        it('has pr', async () => {
          expect.assertions(2);
          await initRepo();
          expect(
            await bitbucket.getBranchPr('userName1/pullRequest5', false)
          ).toMatchSnapshot();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
        it('has no pr', async () => {
          expect.assertions(2);
          await initRepo();
          expect(
            await bitbucket.findPr('userName1/pullRequest1', false)
          ).toBeUndefined();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('findPr()', () => {
        it('has pr', async () => {
          expect.assertions(2);
          await initRepo();
          expect(
            await bitbucket.findPr('userName1/pullRequest5', 'title', 'open')
          ).toMatchSnapshot();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
        it('has no pr', async () => {
          expect.assertions(2);
          await initRepo();
          expect(
            await bitbucket.findPr('userName1/pullRequest5', 'title', 'closed')
          ).toBeUndefined();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('createPr()', () => {
        it('posts PR', async () => {
          expect.assertions(3);
          await initRepo();
          const { id } = await bitbucket.createPr('branch', 'title', 'body');
          expect(id).toBe(5);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });

        it('posts PR default branch', async () => {
          expect.assertions(3);
          await initRepo();
          const { id } = await bitbucket.createPr(
            'branch',
            'title',
            'body',
            null,
            true
          );
          expect(id).toBe(5);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });
      });

      describe('getPr()', () => {
        it('returns null for no prNo', async () => {
          expect.assertions(2);
          expect(await bitbucket.getPr()).toBeNull();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
        it('gets a PR', async () => {
          expect.assertions(2);
          await initRepo();
          expect(await bitbucket.getPr(5)).toMatchSnapshot();
          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('gets a closed PR', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockReturnValueOnce({
            body: {
              version: 0,
              number: 5,
              state: 'MERGED',
              reviewers: [],
              fromRef: {},
            },
          });
          expect(await bitbucket.getPr(5)).toMatchSnapshot();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('getPrFiles()', () => {
        it('returns empty files', async () => {
          expect.assertions(1);
          expect(await bitbucket.getPrFiles(null)).toHaveLength(0);
        });

        it('returns one file', async () => {
          expect.assertions(2);
          await initRepo();
          expect(await bitbucket.getPrFiles(5)).toHaveLength(1);
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('updatePr()', () => {
        it('puts PR', async () => {
          expect.assertions(2);
          await initRepo();
          await bitbucket.updatePr(5, 'title', 'body');
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put.mock.calls).toMatchSnapshot();
        });

        it('throws not-found', async () => {
          expect.assertions(5);
          await initRepo();

          await expect(
            bitbucket.updatePr(null, 'title', 'body')
          ).rejects.toThrow('not-found');

          await expect(bitbucket.updatePr(4, 'title', 'body')).rejects.toThrow(
            'not-found'
          );
          api.put.mockReturnValueOnce(
            Promise.reject({
              statusCode: 404,
            })
          );
          await expect(bitbucket.updatePr(5, 'title', 'body')).rejects.toThrow(
            'not-found'
          );

          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put.mock.calls).toMatchSnapshot();
        });

        it('throws repository-changed', async () => {
          expect.assertions(3);
          await initRepo();
          api.put.mockReturnValueOnce(
            Promise.reject({
              statusCode: 409,
            })
          );
          await expect(bitbucket.updatePr(5, 'title', 'body')).rejects.toThrow(
            'repository-changed'
          );
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put.mock.calls).toMatchSnapshot();
        });

        it('throws', async () => {
          expect.assertions(3);
          await initRepo();
          api.put.mockReturnValueOnce(
            Promise.reject({
              statusCode: 405,
            })
          );
          await expect(bitbucket.updatePr(5, 'title', 'body')).rejects.toEqual({
            statusCode: 405,
          });
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put.mock.calls).toMatchSnapshot();
        });
      });

      describe('mergePr()', () => {
        it('posts Merge', async () => {
          expect.assertions(3);
          await initRepo();
          expect(await bitbucket.mergePr(5, 'branch')).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });

        it('throws not-found', async () => {
          expect.assertions(5);
          await initRepo();

          await expect(bitbucket.mergePr(null, 'branch')).rejects.toThrow(
            'not-found'
          );
          await expect(bitbucket.mergePr(4, 'branch')).rejects.toThrow(
            'not-found'
          );

          api.post.mockReturnValueOnce(
            Promise.reject({
              statusCode: 404,
            })
          );

          await expect(bitbucket.mergePr(5, 'branch')).rejects.toThrow(
            'not-found'
          );
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });

        it('throws conflicted', async () => {
          expect.assertions(3);
          await initRepo();
          api.post.mockReturnValueOnce(
            Promise.reject({
              statusCode: 409,
            })
          );
          await expect(bitbucket.mergePr(5, 'branch')).rejects.toThrow(
            'repository-changed'
          );
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });

        it('unknown error', async () => {
          expect.assertions(3);
          await initRepo();
          api.post.mockReturnValueOnce(
            Promise.reject({
              statusCode: 405,
            })
          );
          await expect(bitbucket.mergePr(5, 'branch')).resolves.toBe(false);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });
      });

      describe('getPrBody()', () => {
        it('returns diff files', () => {
          expect(
            bitbucket.getPrBody(
              '<details><summary>foo</summary>bar</details>text<details>'
            )
          ).toMatchSnapshot();
        });
      });

      describe('getCommitMessages()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.getCommitMessages();
        });
      });

      describe('getVulnerabilityAlerts()', () => {
        it('returns empty array', async () => {
          expect.assertions(1);
          expect(await bitbucket.getVulnerabilityAlerts()).toEqual([]);
        });
      });

      describe('getBranchStatus()', () => {
        it('should be success', async () => {
          expect.assertions(3);
          await initRepo();
          api.get.mockReturnValueOnce({
            body: {
              successful: 3,
              inProgress: 0,
              failed: 0,
            },
          });

          await expect(
            bitbucket.getBranchStatus('somebranch', true)
          ).resolves.toEqual('success');

          await expect(
            bitbucket.getBranchStatus('somebranch')
          ).resolves.toEqual('success');

          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('should be pending', async () => {
          expect.assertions(3);
          await initRepo();
          api.get.mockReturnValueOnce({
            body: {
              successful: 3,
              inProgress: 1,
              failed: 0,
            },
          });

          await expect(
            bitbucket.getBranchStatus('somebranch', true)
          ).resolves.toEqual('pending');

          api.get.mockReturnValueOnce({
            body: {
              successful: 0,
              inProgress: 0,
              failed: 0,
            },
          });

          await expect(
            bitbucket.getBranchStatus('somebranch', true)
          ).resolves.toEqual('pending');

          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('should be failed', async () => {
          expect.assertions(3);
          await initRepo();

          api.get.mockReturnValueOnce({
            body: {
              successful: 1,
              inProgress: 1,
              failed: 1,
            },
          });

          await expect(
            bitbucket.getBranchStatus('somebranch', true)
          ).resolves.toEqual('failed');

          api.get.mockImplementationOnce(() => {
            throw new Error('requst-failed');
          });

          await expect(
            bitbucket.getBranchStatus('somebranch', true)
          ).resolves.toEqual('failed');

          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('getBranchStatusCheck()', () => {
        it('should be success', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockReturnValueOnce({
            body: {
              isLastPage: true,
              values: [
                {
                  state: 'SUCCESSFUL',
                  key: 'context-2',
                  url: 'https://renovatebot.com',
                },
              ],
            },
          });

          await expect(
            bitbucket.getBranchStatusCheck('somebranch', 'context-2')
          ).resolves.toEqual('success');

          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('should be pending', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockReturnValueOnce({
            body: {
              isLastPage: true,
              values: [
                {
                  state: 'INPROGRESS',
                  key: 'context-2',
                  url: 'https://renovatebot.com',
                },
              ],
            },
          });

          await expect(
            bitbucket.getBranchStatusCheck('somebranch', 'context-2')
          ).resolves.toEqual('pending');

          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('should be failure', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockReturnValueOnce({
            body: {
              isLastPage: true,
              values: [
                {
                  state: 'FAILED',
                  key: 'context-2',
                  url: 'https://renovatebot.com',
                },
              ],
            },
          });

          await expect(
            bitbucket.getBranchStatusCheck('somebranch', 'context-2')
          ).resolves.toEqual('failure');

          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('should be null', async () => {
          expect.assertions(3);
          await initRepo();
          api.get.mockImplementationOnce(() => {
            throw new Error('requst-failed');
          });

          await expect(
            bitbucket.getBranchStatusCheck('somebranch', 'context-2')
          ).resolves.toBeNull();

          api.get.mockReturnValueOnce({
            body: {
              isLastPage: true,
              values: [],
            },
          });

          await expect(
            bitbucket.getBranchStatusCheck('somebranch', 'context-2')
          ).resolves.toBeNull();

          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('setBranchStatus()', () => {
        it('should be success', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockClear();

          await bitbucket.setBranchStatus(
            'somebranch',
            'context-2',
            null,
            'success'
          );

          await bitbucket.setBranchStatus(
            'somebranch',
            'context-2',
            null,
            'failed'
          );

          await bitbucket.setBranchStatus(
            'somebranch',
            'context-2',
            null,
            'failure'
          );

          await bitbucket.setBranchStatus(
            'somebranch',
            'context-2',
            null,
            'pending'
          );

          api.post.mockImplementationOnce(() => {
            throw new Error('requst-failed');
          });

          await bitbucket.setBranchStatus(
            'somebranch',
            'context-2',
            null,
            'success'
          );

          await bitbucket.setBranchStatus(
            'somebranch',
            'context-1',
            null,
            'success'
          );

          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });
      });
    });
  });
});
