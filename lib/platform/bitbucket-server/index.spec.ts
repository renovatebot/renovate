import {
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_NOT_FOUND,
} from '../../constants/error-messages';
import { PR_STATE_CLOSED, PR_STATE_OPEN } from '../../constants/pull-requests';
import { BranchStatus } from '../../types';
import { GotApi, Platform, RepoParams } from '../common';
import { Storage } from '../git/storage';
import responses from './__fixtures__/responses';

describe('platform/bitbucket-server', () => {
  Object.entries(responses).forEach(([scenarioName, mockResponses]) => {
    describe(scenarioName, () => {
      let bitbucket: Platform;
      let api: jest.Mocked<GotApi>;
      let hostRules: jest.Mocked<typeof import('../../util/host-rules')>;
      let GitStorage: jest.Mock<Storage> & {
        getUrl: jest.MockInstance<any, any>;
      };
      beforeEach(async () => {
        // reset module
        jest.resetModules();
        jest.mock('delay');
        jest.mock(
          '../../util/got',
          () => (url: string, options: { method: string }) => {
            const { method } = options;
            const body = mockResponses[url] && mockResponses[url][method];
            if (!body) {
              return Promise.reject(new Error(`no match for ${method} ${url}`));
            }
            if (body instanceof Promise) {
              return body;
            }
            return Promise.resolve({ body });
          }
        );
        jest.mock('../git/storage');
        jest.mock('../../util/host-rules');
        hostRules = require('../../util/host-rules');
        api = require('./bb-got-wrapper').api;
        jest.spyOn(api, 'get');
        jest.spyOn(api, 'post');
        jest.spyOn(api, 'put');
        jest.spyOn(api, 'delete');
        bitbucket = await import('.');
        GitStorage = require('../git/storage').Storage;
        GitStorage.mockImplementation(
          () =>
            ({
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
              commitFiles: jest.fn(),
              mergeBranch: jest.fn(),
              deleteBranch: jest.fn(),
              getRepoStatus: jest.fn(),
              getBranchCommit: jest.fn(
                () => '0d9c7726c3d628b7e28af234595cfd20febdbf8e'
              ),
            } as any)
        );
        const endpoint =
          scenarioName === 'endpoint with path'
            ? 'https://stash.renovatebot.com/vcs/'
            : 'https://stash.renovatebot.com';
        hostRules.find.mockReturnValue({
          username: 'abc',
          password: '123',
        });
        await bitbucket.initPlatform({
          endpoint,
          username: 'abc',
          password: '123',
        });
      });

      afterEach(async () => {
        await bitbucket.cleanRepo();
      });

      function initRepo(config?: Partial<RepoParams>) {
        return bitbucket.initRepo({
          endpoint: 'https://stash.renovatebot.com/vcs/',
          repository: 'SOME/repo',
          ...config,
        } as any);
      }

      describe('initPlatform()', () => {
        it('should throw if no endpoint', () => {
          expect.assertions(1);
          expect(() => bitbucket.initPlatform({})).toThrow();
        });
        it('should throw if no username/password', () => {
          expect.assertions(1);
          expect(() =>
            bitbucket.initPlatform({ endpoint: 'endpoint' })
          ).toThrow();
        });
        it('should init', async () => {
          expect(
            await bitbucket.initPlatform({
              endpoint: 'https://stash.renovatebot.com',
              username: 'abc',
              password: '123',
            })
          ).toMatchSnapshot();
        });
      });

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
        it('does not throw', async () => {
          expect.assertions(1);
          api.get.mockResolvedValueOnce({
            body: {
              isLastPage: false,
              lines: ['{'],
              size: 50000,
            },
          } as any);

          const res = await initRepo({ optimizeForDisabled: true });
          expect(res).toMatchSnapshot();
        });

        it('throws disabled', async () => {
          expect.assertions(1);
          api.get.mockResolvedValueOnce({
            body: { isLastPage: true, lines: ['{ "enabled": false }'] },
          } as any);
          await expect(initRepo({ optimizeForDisabled: true })).rejects.toThrow(
            REPOSITORY_DISABLED
          );
        });
      });

      describe('repoForceRebase()', () => {
        it('returns false on missing mergeConfig', async () => {
          expect.assertions(1);
          api.get.mockResolvedValueOnce({
            body: {
              mergeConfig: null,
            },
          } as any);
          const actual = await bitbucket.getRepoForceRebase();
          expect(actual).toBe(false);
        });

        it('returns false on missing defaultStrategy', async () => {
          expect.assertions(1);
          api.get.mockResolvedValueOnce({
            body: {
              mergeConfig: {
                defaultStrategy: null,
              },
            },
          } as any);
          const actual = await bitbucket.getRepoForceRebase();
          expect(actual).toBe(false);
        });

        it.each(['ff-only', 'rebase-ff-only', 'squash-ff-only'])(
          'return true if %s strategy is enabled',
          async (id) => {
            expect.assertions(1);
            api.get.mockResolvedValueOnce({
              body: {
                mergeConfig: {
                  defaultStrategy: {
                    id,
                  },
                },
              },
            } as any);
            const actual = await bitbucket.getRepoForceRebase();
            expect(actual).toBe(true);
          }
        );

        it.each(['no-ff', 'ff', 'rebase-no-ff', 'squash'])(
          'return false if %s strategy is enabled',
          async (id) => {
            expect.assertions(1);
            api.get.mockResolvedValueOnce({
              body: {
                mergeConfig: {
                  defaultStrategy: {
                    id,
                  },
                },
              },
            } as any);
            const actual = await bitbucket.getRepoForceRebase();
            expect(actual).toBe(false);
          }
        );
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
            await bitbucket.branchExists(undefined as any);
          });
        });
      });

      describe('isBranchStale()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.isBranchStale(undefined as any);
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

      describe('commitFiles()', () => {
        it('sends to gitFs', async () => {
          expect.assertions(1);
          await initRepo();
          await bitbucket.commitFiles({
            branchName: 'some-branch',
            files: [{ name: 'test', contents: 'dummy' }],
            message: 'message',
          });
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('getFile()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.getFile('', '');
        });
      });

      describe('getAllRenovateBranches()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.getAllRenovateBranches('');
        });
      });

      describe('getBranchLastCommitTime()', () => {
        it('sends to gitFs', async () => {
          await initRepo();
          await bitbucket.getBranchLastCommitTime('');
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
          expect.assertions(3);
          await initRepo();
          await bitbucket.addReviewers(5, ['name']);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });

        it('throws not-found', async () => {
          expect.assertions(5);
          await initRepo();

          await expect(
            bitbucket.addReviewers(null as any, ['name'])
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);

          await expect(bitbucket.addReviewers(4, ['name'])).rejects.toThrow(
            REPOSITORY_NOT_FOUND
          );
          api.put.mockReturnValueOnce(
            Promise.reject({
              statusCode: 404,
            })
          );
          await expect(bitbucket.addReviewers(5, ['name'])).rejects.toThrow(
            REPOSITORY_NOT_FOUND
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
          await expect(bitbucket.addReviewers(5, ['name'])).rejects.toThrow(
            REPOSITORY_CHANGED
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
          await expect(bitbucket.addReviewers(5, ['name'])).rejects.toEqual({
            statusCode: 405,
          });
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put.mock.calls).toMatchSnapshot();
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
          expect(
            await bitbucket.ensureComment({
              number: 3,
              topic: 'topic',
              content: 'content',
            })
          ).toBe(false);
          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('add comment if not found', async () => {
          expect.assertions(6);
          await initRepo();
          api.get.mockClear();

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: 'topic',
              content: 'content',
            })
          ).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post).toHaveBeenCalledTimes(1);

          api.get.mockClear();
          api.post.mockClear();

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: null,
              content: 'content',
            })
          ).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post).toHaveBeenCalledTimes(1);
        });

        it('add updates comment if necessary', async () => {
          expect.assertions(8);
          await initRepo();
          api.get.mockClear();

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: 'some-subject',
              content: 'some\ncontent',
            })
          ).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post).toHaveBeenCalledTimes(0);
          expect(api.put).toHaveBeenCalledTimes(1);

          api.get.mockClear();
          api.put.mockClear();

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: null,
              content: 'some\ncontent',
            })
          ).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post).toHaveBeenCalledTimes(1);
          expect(api.put).toHaveBeenCalledTimes(0);
        });

        it('skips comment', async () => {
          expect.assertions(6);
          await initRepo();
          api.get.mockClear();

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: 'some-subject',
              content: 'blablabla',
            })
          ).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put).toHaveBeenCalledTimes(0);

          api.get.mockClear();
          api.put.mockClear();

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: null,
              content: '!merge',
            })
          ).toBe(true);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.put).toHaveBeenCalledTimes(0);
        });
      });

      describe('ensureCommentRemoval()', () => {
        it('does not throw', async () => {
          expect.assertions(1);
          await bitbucket.ensureCommentRemoval({ number: 5, topic: 'topic' });
          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('deletes comment by topic if found', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockClear();

          await bitbucket.ensureCommentRemoval({
            number: 5,
            topic: 'some-subject',
          });
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.delete).toHaveBeenCalledTimes(1);
        });

        it('deletes comment by content if found', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockClear();

          await bitbucket.ensureCommentRemoval({
            number: 5,
            content: '!merge',
          });
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.delete).toHaveBeenCalledTimes(1);
        });

        it('deletes nothing', async () => {
          expect.assertions(2);
          await initRepo();
          api.get.mockClear();

          await bitbucket.ensureCommentRemoval({ number: 5, topic: 'topic' });
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
            await bitbucket.getBranchPr('userName1/pullRequest5')
          ).toMatchSnapshot();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
        it('has no pr', async () => {
          expect.assertions(2);
          await initRepo();
          expect(
            await bitbucket.findPr({ branchName: 'userName1/pullRequest1' })
          ).toBeUndefined();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('findPr()', () => {
        it('has pr', async () => {
          expect.assertions(2);
          await initRepo();
          expect(
            await bitbucket.findPr({
              branchName: 'userName1/pullRequest5',
              prTitle: 'title',
              state: PR_STATE_OPEN,
            })
          ).toMatchSnapshot();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
        it('has no pr', async () => {
          expect.assertions(2);
          await initRepo();
          expect(
            await bitbucket.findPr({
              branchName: 'userName1/pullRequest5',
              prTitle: 'title',
              state: PR_STATE_CLOSED,
            })
          ).toBeUndefined();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
      });

      describe('createPr()', () => {
        it('posts PR', async () => {
          expect.assertions(3);
          await initRepo();
          const { number: id } = await bitbucket.createPr({
            branchName: 'branch',
            prTitle: 'title',
            prBody: 'body',
          });
          expect(id).toBe(5);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });

        it('posts PR default branch', async () => {
          expect.assertions(3);
          await initRepo();
          const { number: id } = await bitbucket.createPr({
            branchName: 'branch',
            prTitle: 'title',
            prBody: 'body',
            labels: null,
            useDefaultBranch: true,
          });
          expect(id).toBe(5);
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });
      });

      describe('getPr()', () => {
        it('returns null for no prNo', async () => {
          expect.assertions(2);
          expect(await bitbucket.getPr(undefined as any)).toBeNull();
          expect(api.get.mock.calls).toMatchSnapshot();
        });
        it('gets a PR', async () => {
          expect.assertions(2);
          await initRepo();
          expect(await bitbucket.getPr(5)).toMatchSnapshot();
          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('canRebase', async () => {
          expect.assertions(4);
          await initRepo();
          const author = global.gitAuthor;
          try {
            expect(await bitbucket.getPr(3)).toMatchSnapshot();

            global.gitAuthor = { email: 'bot@renovateapp.com', name: 'bot' };
            expect(await bitbucket.getPr(5)).toMatchSnapshot();

            global.gitAuthor = { email: 'jane@example.com', name: 'jane' };
            expect(await bitbucket.getPr(5)).toMatchSnapshot();

            expect(api.get.mock.calls).toMatchSnapshot();
          } finally {
            global.gitAuthor = author;
          }
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
              toRef: {},
            },
          } as any);
          expect(await bitbucket.getPr(5)).toMatchSnapshot();
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
            bitbucket.updatePr(null as any, 'title', 'body')
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);

          await expect(bitbucket.updatePr(4, 'title', 'body')).rejects.toThrow(
            REPOSITORY_NOT_FOUND
          );
          api.put.mockReturnValueOnce(
            Promise.reject({
              statusCode: 404,
            })
          );
          await expect(bitbucket.updatePr(5, 'title', 'body')).rejects.toThrow(
            REPOSITORY_NOT_FOUND
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
            REPOSITORY_CHANGED
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

          await expect(
            bitbucket.mergePr(null as any, 'branch')
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);
          await expect(bitbucket.mergePr(4, 'branch')).rejects.toThrow(
            REPOSITORY_NOT_FOUND
          );

          api.post.mockReturnValueOnce(
            Promise.reject({
              statusCode: 404,
            })
          );

          await expect(bitbucket.mergePr(5, 'branch')).rejects.toThrow(
            REPOSITORY_NOT_FOUND
          );
          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });

        it('throws conflicted', async () => {
          expect.assertions(3);
          await initRepo();
          api.post.mockRejectedValueOnce({
            statusCode: 409,
          });
          expect(await bitbucket.mergePr(5, 'branch')).toBeFalsy();
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

        it('sanitizes HTML comments in the body', () => {
          const prBody = bitbucket.getPrBody(`---

- [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box
- [ ] <!-- recreate-branch=renovate/docker-renovate-renovate-16.x --><a href="/some/link">Update renovate/renovate to 16.1.2</a>

---
<!---->
Empty comment.
<!-- This is another comment -->
Followed by some information.
<!-- followed by some more comments -->`);
          expect(prBody).toMatchSnapshot();
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
          } as any);

          await expect(
            bitbucket.getBranchStatus('somebranch', [])
          ).resolves.toEqual(BranchStatus.green);

          await expect(
            bitbucket.getBranchStatus('somebranch')
          ).resolves.toEqual(BranchStatus.green);

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
          } as any);

          await expect(
            bitbucket.getBranchStatus('somebranch', [])
          ).resolves.toEqual(BranchStatus.yellow);

          api.get.mockReturnValueOnce({
            body: {
              successful: 0,
              inProgress: 0,
              failed: 0,
            },
          } as any);

          await expect(
            bitbucket.getBranchStatus('somebranch', [])
          ).resolves.toEqual(BranchStatus.yellow);

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
          } as any);

          await expect(
            bitbucket.getBranchStatus('somebranch', [])
          ).resolves.toEqual(BranchStatus.red);

          api.get.mockImplementationOnce(() => {
            throw new Error('requst-failed');
          });

          await expect(
            bitbucket.getBranchStatus('somebranch', [])
          ).resolves.toEqual(BranchStatus.red);

          expect(api.get.mock.calls).toMatchSnapshot();
        });

        it('throws repository-changed', async () => {
          expect.assertions(1);
          GitStorage.mockImplementationOnce(
            () =>
              ({
                initRepo: jest.fn(),
                branchExists: jest.fn(() => Promise.resolve(false)),
                cleanRepo: jest.fn(),
              } as any)
          );
          await initRepo();
          await expect(
            bitbucket.getBranchStatus('somebranch', [])
          ).rejects.toThrow(REPOSITORY_CHANGED);
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
          } as any);

          await expect(
            bitbucket.getBranchStatusCheck('somebranch', 'context-2')
          ).resolves.toEqual(BranchStatus.green);

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
          } as any);

          await expect(
            bitbucket.getBranchStatusCheck('somebranch', 'context-2')
          ).resolves.toEqual(BranchStatus.yellow);

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
          } as any);

          await expect(
            bitbucket.getBranchStatusCheck('somebranch', 'context-2')
          ).resolves.toEqual(BranchStatus.red);

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
          } as any);

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

          await bitbucket.setBranchStatus({
            branchName: 'somebranch',
            context: 'context-2',
            description: null as any,
            state: BranchStatus.green,
          });

          await bitbucket.setBranchStatus({
            branchName: 'somebranch',
            context: 'context-2',
            description: null as any,
            state: BranchStatus.red,
          });

          await bitbucket.setBranchStatus({
            branchName: 'somebranch',
            context: 'context-2',
            description: null as any,
            state: BranchStatus.red,
          });

          await bitbucket.setBranchStatus({
            branchName: 'somebranch',
            context: 'context-2',
            description: null as any,
            state: BranchStatus.yellow,
          });

          api.post.mockImplementationOnce(() => {
            throw new Error('requst-failed');
          });

          await bitbucket.setBranchStatus({
            branchName: 'somebranch',
            context: 'context-2',
            description: null as any,
            state: BranchStatus.green,
          });

          await bitbucket.setBranchStatus({
            branchName: 'somebranch',
            context: 'context-1',
            description: null as any,
            state: BranchStatus.green,
          });

          expect(api.get.mock.calls).toMatchSnapshot();
          expect(api.post.mock.calls).toMatchSnapshot();
        });
      });
    });
  });
});
