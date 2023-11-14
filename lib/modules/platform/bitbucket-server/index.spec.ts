import is from '@sindresorhus/is';
import { mockDeep } from 'jest-mock-extended';
import * as httpMock from '../../../../test/http-mock';
import {
  REPOSITORY_CHANGED,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import type * as _git from '../../../util/git';
import type { Platform } from '../types';

jest.mock('timers/promises');
jest.mock('../../../util/git');
jest.mock('../../../util/host-rules', () => mockDeep());

function sshLink(projectKey: string, repositorySlug: string): string {
  return `ssh://git@stash.renovatebot.com:7999/${projectKey.toLowerCase()}/${repositorySlug}.git`;
}

function httpLink(
  endpointStr: string,
  projectKey: string,
  repositorySlug: string,
): string {
  return `${endpointStr}scm/${projectKey.toLowerCase()}/${repositorySlug}.git`;
}

function repoMock(
  endpoint: URL | string,
  projectKey: string,
  repositorySlug: string,
  options: { cloneUrl: { https: boolean; ssh: boolean } } = {
    cloneUrl: { https: true, ssh: true },
  },
) {
  const endpointStr = endpoint.toString();
  const links: {
    self: { href: string }[];
    clone?: { href: string; name: string }[];
  } = {
    self: [
      {
        href: `${endpointStr}projects/${projectKey}/repos/${repositorySlug}/browse`,
      },
    ],
  };

  if (options.cloneUrl.https || options.cloneUrl.ssh) {
    // This mimics the behavior of bb-server which does not include the clone property at all
    // if ssh and https are both turned off
    links.clone = [
      options.cloneUrl.https
        ? {
            href: httpLink(endpointStr, projectKey, repositorySlug),
            name: 'http',
          }
        : null,
      options.cloneUrl.ssh
        ? {
            href: sshLink(projectKey, repositorySlug),
            name: 'ssh',
          }
        : null,
    ].filter(is.truthy);
  }

  return {
    slug: repositorySlug,
    id: 13076,
    name: repositorySlug,
    scmId: 'git',
    state: 'AVAILABLE',
    statusMessage: 'Available',
    forkable: true,
    project: {
      key: projectKey,
      id: 2900,
      name: `${repositorySlug}'s name`,
      public: false,
      type: 'NORMAL',
      links: {
        self: [
          { href: `https://stash.renovatebot.com/projects/${projectKey}` },
        ],
      },
    },
    public: false,
    links,
  };
}

function prMock(
  endpoint: URL | string,
  projectKey: string,
  repositorySlug: string,
) {
  const endpointStr = endpoint.toString();
  return {
    id: 5,
    version: 1,
    title: 'title',
    description: '* Line 1\r\n* Line 2',
    state: 'OPEN',
    open: true,
    closed: false,
    createdDate: 1547853840016,
    updatedDate: 1547853840016,
    fromRef: {
      id: 'refs/heads/userName1/pullRequest5',
      displayId: 'userName1/pullRequest5',
      latestCommit: '55efc02b2ab13a43a66cf705f5faacfcc6a762b4',
      // Removed this with the idea it's not needed
      // repository: {},
    },
    toRef: {
      id: 'refs/heads/master',
      displayId: 'master',
      latestCommit: '0d9c7726c3d628b7e28af234595cfd20febdbf8e',
      // Removed this with the idea it's not needed
      // repository: {},
    },
    locked: false,
    author: {
      user: {
        name: 'userName1',
        emailAddress: 'userName1@renovatebot.com',
        id: 144846,
        displayName: 'Renovate Bot',
        active: true,
        slug: 'userName1',
        type: 'NORMAL',
        links: {
          self: [{ href: `${endpointStr}/users/userName1` }],
        },
      },
      role: 'AUTHOR',
      approved: false,
      status: 'UNAPPROVED',
    },
    reviewers: [
      {
        user: {
          name: 'userName2',
          emailAddress: 'userName2@renovatebot.com',
          id: 71155,
          displayName: 'Renovate bot 2',
          active: true,
          slug: 'userName2',
          type: 'NORMAL',
          links: {
            self: [{ href: `${endpointStr}/users/userName2` }],
          },
        },
        role: 'REVIEWER',
        approved: false,
        status: 'UNAPPROVED',
      },
    ],
    participants: [],
    links: {
      self: [
        {
          href: `${endpointStr}/projects/${projectKey}/repos/${repositorySlug}/pull-requests/5`,
        },
      ],
    },
  };
}

const scenarios = {
  'endpoint with no path': new URL('https://stash.renovatebot.com'),
  'endpoint with path': new URL('https://stash.renovatebot.com/vcs'),
};

type HostRules = typeof import('../../../util/host-rules');

describe('modules/platform/bitbucket-server/index', () => {
  Object.entries(scenarios).forEach(([scenarioName, url]) => {
    const urlHost = url.origin;
    const urlPath = url.pathname === '/' ? '' : url.pathname;

    describe(scenarioName, () => {
      let bitbucket: Platform;

      let hostRules: jest.Mocked<HostRules>;
      let git: jest.Mocked<typeof _git>;
      const username = 'abc';
      const password = '123';

      async function initRepo(config = {}): Promise<httpMock.Scope> {
        const scope = httpMock
          .scope(urlHost)
          .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
          .reply(200, repoMock(url, 'SOME', 'repo'))
          .get(
            `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
          )
          .reply(200, {
            displayId: 'master',
          });
        await bitbucket.initRepo({
          endpoint: 'https://stash.renovatebot.com/vcs/',
          repository: 'SOME/repo',
          ...config,
        });
        return scope;
      }

      beforeEach(async () => {
        // reset module
        jest.resetModules();
        bitbucket = await import('.');
        hostRules = jest.requireMock('../../../util/host-rules');
        git = jest.requireMock('../../../util/git');
        git.branchExists.mockReturnValue(true);
        git.isBranchBehindBase.mockResolvedValue(false);
        git.getBranchCommit.mockReturnValue(
          '0d9c7726c3d628b7e28af234595cfd20febdbf8e',
        );
        const endpoint =
          scenarioName === 'endpoint with path'
            ? 'https://stash.renovatebot.com/vcs/'
            : 'https://stash.renovatebot.com';
        hostRules.find.mockReturnValue({
          username,
          password,
        });
        await bitbucket.initPlatform({
          endpoint,
          username,
          password,
        });
      });

      describe('initPlatform()', () => {
        it('should throw if no endpoint', () => {
          expect.assertions(1);
          expect(() => bitbucket.initPlatform({})).toThrow();
        });

        it('should throw if no username/password', () => {
          expect.assertions(1);
          expect(() =>
            bitbucket.initPlatform({ endpoint: 'endpoint' }),
          ).toThrow();
        });

        it('should init', async () => {
          expect(
            await bitbucket.initPlatform({
              endpoint: 'https://stash.renovatebot.com',
              username: 'abc',
              password: '123',
            }),
          ).toMatchSnapshot();
        });
      });

      describe('getRepos()', () => {
        it('returns repos', async () => {
          expect.assertions(1);
          httpMock
            .scope(urlHost)
            .get(
              `${urlPath}/rest/api/1.0/repos?permission=REPO_WRITE&state=AVAILABLE&limit=100`,
            )
            .reply(200, {
              size: 1,
              limit: 100,
              isLastPage: true,
              values: [repoMock(url, 'SOME', 'repo')],
              start: 0,
            });
          expect(await bitbucket.getRepos()).toEqual(['SOME/repo']);
        });
      });

      describe('initRepo()', () => {
        it('works', async () => {
          expect.assertions(1);
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, repoMock(url, 'SOME', 'repo'))
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(200, {
              displayId: 'master',
            });
          expect(
            await bitbucket.initRepo({
              endpoint: 'https://stash.renovatebot.com/vcs/',
              repository: 'SOME/repo',
            }),
          ).toMatchSnapshot();
        });

        it('no git url', async () => {
          expect.assertions(1);
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, repoMock(url, 'SOME', 'repo'))
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(200, {
              displayId: 'master',
            });
          expect(
            await bitbucket.initRepo({
              endpoint: 'https://stash.renovatebot.com/vcs/',
              repository: 'SOME/repo',
            }),
          ).toEqual({
            defaultBranch: 'master',
            isFork: false,
            repoFingerprint: expect.any(String),
          });
        });

        it('gitUrl ssh returns ssh url', async () => {
          expect.assertions(2);
          const responseMock = repoMock(url, 'SOME', 'repo', {
            cloneUrl: { https: false, ssh: true },
          });
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, responseMock)
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(200, {
              displayId: 'master',
            });
          const res = await bitbucket.initRepo({
            endpoint: 'https://stash.renovatebot.com/vcs/',
            repository: 'SOME/repo',
            gitUrl: 'ssh',
          });
          expect(git.initRepo).toHaveBeenCalledWith(
            expect.objectContaining({ url: sshLink('SOME', 'repo') }),
          );
          expect(res).toEqual({
            defaultBranch: 'master',
            isFork: false,
            repoFingerprint: expect.any(String),
          });
        });

        it('gitURL endpoint returns generates endpoint URL', async () => {
          expect.assertions(2);
          const link = httpLink(url.toString(), 'SOME', 'repo');
          const responseMock = repoMock(url, 'SOME', 'repo', {
            cloneUrl: { https: false, ssh: false },
          });
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, responseMock)
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(200, {
              displayId: 'master',
            });
          git.getUrl.mockReturnValueOnce(link);
          const res = await bitbucket.initRepo({
            endpoint: 'https://stash.renovatebot.com/vcs/',
            repository: 'SOME/repo',
            gitUrl: 'endpoint',
          });
          expect(git.initRepo).toHaveBeenCalledWith(
            expect.objectContaining({
              url: link,
            }),
          );
          expect(res).toEqual({
            defaultBranch: 'master',
            isFork: false,
            repoFingerprint: expect.any(String),
          });
        });

        it('gitUrl default returns http from API with injected auth', async () => {
          expect.assertions(2);
          const responseMock = repoMock(url, 'SOME', 'repo', {
            cloneUrl: { https: true, ssh: true },
          });
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, responseMock)
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(200, {
              displayId: 'master',
            });
          const res = await bitbucket.initRepo({
            endpoint: 'https://stash.renovatebot.com/vcs/',
            repository: 'SOME/repo',
            gitUrl: 'default',
          });
          expect(git.initRepo).toHaveBeenCalledWith(
            expect.objectContaining({
              url: httpLink(url.toString(), 'SOME', 'repo').replace(
                'https://',
                `https://${username}:${password}@`,
              ),
            }),
          );
          expect(res).toEqual({
            defaultBranch: 'master',
            isFork: false,
            repoFingerprint: expect.any(String),
          });
        });

        it('uses ssh url from API if http not in API response', async () => {
          expect.assertions(2);
          const responseMock = repoMock(url, 'SOME', 'repo', {
            cloneUrl: { https: false, ssh: true },
          });
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, responseMock)
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(200, {
              displayId: 'master',
            });
          const res = await bitbucket.initRepo({
            endpoint: 'https://stash.renovatebot.com/vcs/',
            repository: 'SOME/repo',
          });
          expect(git.initRepo).toHaveBeenCalledWith(
            expect.objectContaining({ url: sshLink('SOME', 'repo') }),
          );
          expect(res).toMatchSnapshot();
        });

        it('uses http url from API with injected auth if http url in API response', async () => {
          expect.assertions(2);
          const responseMock = repoMock(url, 'SOME', 'repo', {
            cloneUrl: { https: true, ssh: true },
          });
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, responseMock)
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(200, {
              displayId: 'master',
            });
          const res = await bitbucket.initRepo({
            endpoint: 'https://stash.renovatebot.com/vcs/',
            repository: 'SOME/repo',
          });
          expect(git.initRepo).toHaveBeenCalledWith(
            expect.objectContaining({
              url: httpLink(url.toString(), 'SOME', 'repo').replace(
                'https://',
                `https://${username}:${password}@`,
              ),
            }),
          );
          expect(res).toMatchSnapshot();
        });

        it('generates URL if API does not contain clone links', async () => {
          expect.assertions(2);
          const link = httpLink(url.toString(), 'SOME', 'repo');
          const responseMock = repoMock(url, 'SOME', 'repo', {
            cloneUrl: { https: false, ssh: false },
          });
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, responseMock)
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(200, {
              displayId: 'master',
            });
          git.getUrl.mockReturnValueOnce(link);
          const res = await bitbucket.initRepo({
            endpoint: 'https://stash.renovatebot.com/vcs/',
            repository: 'SOME/repo',
          });
          expect(git.initRepo).toHaveBeenCalledWith(
            expect.objectContaining({
              url: link,
            }),
          );
          expect(res).toMatchSnapshot();
        });

        it('throws REPOSITORY_EMPTY if there is no default branch', async () => {
          expect.assertions(1);
          httpMock
            .scope(urlHost)
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, repoMock(url, 'SOME', 'repo'))
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/branches/default`,
            )
            .reply(204);
          await expect(
            bitbucket.initRepo({
              endpoint: 'https://stash.renovatebot.com/vcs/',
              repository: 'SOME/repo',
            }),
          ).rejects.toThrow(REPOSITORY_EMPTY);
        });
      });

      describe('repoForceRebase()', () => {
        it('returns false on missing mergeConfig', async () => {
          expect.assertions(1);
          httpMock
            .scope(urlHost)
            .get(
              `${urlPath}/rest/api/1.0/projects/undefined/repos/undefined/settings/pull-requests`,
            )
            .reply(200, {
              mergeConfig: null,
            });
          const actual = await bitbucket.getRepoForceRebase();
          expect(actual).toBeFalse();
        });

        it('returns false on missing defaultStrategy', async () => {
          expect.assertions(1);
          httpMock
            .scope(urlHost)
            .get(
              `${urlPath}/rest/api/1.0/projects/undefined/repos/undefined/settings/pull-requests`,
            )
            .reply(200, {
              mergeConfig: {
                defaultStrategy: null,
              },
            });
          const actual = await bitbucket.getRepoForceRebase();
          expect(actual).toBeFalse();
        });

        it.each(['ff-only', 'rebase-ff-only', 'squash-ff-only'])(
          'return true if %s strategy is enabled',
          async (id) => {
            expect.assertions(1);
            httpMock
              .scope(urlHost)
              .get(
                `${urlPath}/rest/api/1.0/projects/undefined/repos/undefined/settings/pull-requests`,
              )
              .reply(200, {
                mergeConfig: {
                  defaultStrategy: {
                    id,
                  },
                },
              });
            const actual = await bitbucket.getRepoForceRebase();
            expect(actual).toBeTrue();
          },
        );

        it.each(['no-ff', 'ff', 'rebase-no-ff', 'squash'])(
          'return false if %s strategy is enabled',
          async (id) => {
            expect.assertions(1);
            httpMock
              .scope(urlHost)
              .get(
                `${urlPath}/rest/api/1.0/projects/undefined/repos/undefined/settings/pull-requests`,
              )
              .reply(200, {
                mergeConfig: {
                  defaultStrategy: {
                    id,
                  },
                },
              });
            const actual = await bitbucket.getRepoForceRebase();
            expect(actual).toBeFalse();
          },
        );
      });

      describe('addAssignees()', () => {
        it('does not throw', async () => {
          expect(await bitbucket.addAssignees(3, ['some'])).toMatchSnapshot();
        });
      });

      describe('addReviewers', () => {
        it('does not throw', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .twice()
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'));

          expect(await bitbucket.addReviewers(5, ['name'])).toMatchSnapshot();
        });

        it('sends the reviewer name as a reviewer', async () => {
          expect.assertions(1);
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .twice()
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'));

          await expect(bitbucket.addReviewers(5, ['name'])).toResolve();
        });

        it('throws not-found 1', async () => {
          await initRepo();
          await expect(
            bitbucket.addReviewers(null as any, ['name']),
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);
        });

        it('throws not-found 2', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/4`,
            )
            .reply(404);

          await expect(bitbucket.addReviewers(4, ['name'])).rejects.toThrow(
            REPOSITORY_NOT_FOUND,
          );
        });

        it('throws not-found 3', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(404);

          await expect(bitbucket.addReviewers(5, ['name'])).rejects.toThrow(
            REPOSITORY_NOT_FOUND,
          );
        });

        it('throws repository-changed', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(409);
          await expect(bitbucket.addReviewers(5, ['name'])).rejects.toThrow(
            REPOSITORY_CHANGED,
          );
        });

        it('throws on invalid reviewers', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(409, {
              errors: [
                {
                  context: 'reviewers',
                  message:
                    'Errors encountered while adding some reviewers to this pull request.',
                  exceptionName:
                    'com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException',
                  reviewerErrors: [
                    {
                      context: 'name',
                      message: 'name is not a user.',
                      exceptionName: null,
                    },
                  ],
                  validReviewers: [],
                },
              ],
            });

          await expect(
            bitbucket.addReviewers(5, ['name']),
          ).rejects.toThrowErrorMatchingSnapshot();
        });

        it('throws', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(405);
          await expect(
            bitbucket.addReviewers(5, ['name']),
          ).rejects.toThrowErrorMatchingSnapshot();
        });
      });

      describe('deleteLAbel()', () => {
        it('does not throw', async () => {
          expect(await bitbucket.deleteLabel(5, 'renovate')).toMatchSnapshot();
        });
      });

      describe('ensureComment()', () => {
        it('does not throw', async () => {
          httpMock
            .scope(urlHost)
            .get(
              `${urlPath}/rest/api/1.0/projects/undefined/repos/undefined/pull-requests/3/activities?limit=100`,
            )
            .reply(200);
          const res = await bitbucket.ensureComment({
            number: 3,
            topic: 'topic',
            content: 'content',
          });
          expect(res).toBeFalse();
        });

        it('add comment if not found 1', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            })
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments`,
            )
            .reply(200);

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: 'topic',
              content: 'content',
            }),
          ).toBeTrue();
        });

        it('add comment if not found 2', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            })
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments`,
            )
            .reply(200);

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: null,
              content: 'content',
            }),
          ).toBeTrue();
        });

        it('add updates comment if necessary 1', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/21`,
            )
            .reply(200, {
              version: 1,
            })
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/21`,
            )
            .reply(200);

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: 'some-subject',
              content: 'some\ncontent',
            }),
          ).toBeTrue();
        });

        it('add updates comment if necessary 2', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            })
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments`,
            )
            .reply(200);

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: null,
              content: 'some\ncontent',
            }),
          ).toBeTrue();
        });

        it('skips comment 1', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            });

          expect(
            await bitbucket.ensureComment({
              number: 5,
              topic: 'some-subject',
              content: 'blablabla',
            }),
          ).toBeTrue();
        });

        it('skips comment 2', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            });

          const res = await bitbucket.ensureComment({
            number: 5,
            topic: null,
            content: '!merge',
          });
          expect(res).toBeTrue();
        });
      });

      describe('ensureCommentRemoval()', () => {
        it('does not throw', async () => {
          httpMock
            .scope(urlHost)
            .get(
              `${urlPath}/rest/api/1.0/projects/undefined/repos/undefined/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/undefined/repos/undefined/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            });
          await expect(
            bitbucket.ensureCommentRemoval({
              type: 'by-topic',
              number: 5,
              topic: 'topic',
            }),
          ).toResolve();
        });

        it('deletes comment by topic if found', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/21`,
            )
            .reply(200, {
              version: 1,
            })
            .delete(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/21?version=1`,
            )
            .reply(200);

          await expect(
            bitbucket.ensureCommentRemoval({
              type: 'by-topic',
              number: 5,
              topic: 'some-subject',
            }),
          ).toResolve();
        });

        it('deletes comment by content if found', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/22`,
            )
            .reply(200, {
              version: 1,
            })
            .delete(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/22?version=1`,
            )
            .reply(200);

          await expect(
            bitbucket.ensureCommentRemoval({
              type: 'by-content',
              number: 5,
              content: '!merge',
            }),
          ).toResolve();
        });

        it('deletes nothing', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`,
            )
            .reply(200, {
              isLastPage: false,
              nextPageStart: 1,
              values: [
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 21, text: '### some-subject\n\nblablabla' },
                },
                {
                  action: 'COMMENTED',
                  commentAction: 'ADDED',
                  comment: { id: 22, text: '!merge' },
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ action: 'OTHER' }],
            });

          await expect(
            bitbucket.ensureCommentRemoval({
              type: 'by-topic',
              number: 5,
              topic: 'topic',
            }),
          ).toResolve();
        });
      });

      describe('getPrList()', () => {
        it('has pr', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests?state=ALL&role.1=AUTHOR&username.1=abc&limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [prMock(url, 'SOME', 'repo')],
            });
          expect(await bitbucket.getPrList()).toMatchSnapshot();
        });
      });

      describe('getBranchPr()', () => {
        it('has pr', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests?state=ALL&role.1=AUTHOR&username.1=abc&limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [prMock(url, 'SOME', 'repo')],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'));

          expect(
            await bitbucket.getBranchPr('userName1/pullRequest5'),
          ).toMatchSnapshot();
        });

        it('has no pr', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests?state=ALL&role.1=AUTHOR&username.1=abc&limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [prMock(url, 'SOME', 'repo')],
            });

          expect(
            await bitbucket.getBranchPr('userName1/pullRequest1'),
          ).toBeNull();
        });

        it('has no existing pr', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests?state=ALL&role.1=AUTHOR&username.1=abc&limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [],
            });

          expect(
            await bitbucket.getBranchPr('userName1/pullRequest1'),
          ).toBeNull();
        });
      });

      describe('findPr()', () => {
        it('has pr', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests?state=ALL&role.1=AUTHOR&username.1=abc&limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [prMock(url, 'SOME', 'repo')],
            });

          expect(
            await bitbucket.findPr({
              branchName: 'userName1/pullRequest5',
              prTitle: 'title',
              state: 'open',
            }),
          ).toMatchSnapshot();
        });

        it('has no pr', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests?state=ALL&role.1=AUTHOR&username.1=abc&limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [prMock(url, 'SOME', 'repo')],
            });

          expect(
            await bitbucket.findPr({
              branchName: 'userName1/pullRequest5',
              prTitle: 'title',
              state: 'closed',
            }),
          ).toBeNull();
        });
      });

      describe('createPr()', () => {
        it('posts PR', async () => {
          const scope = await initRepo();
          scope
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, prMock(url, 'SOME', 'repo'))
            .get(
              `${urlPath}/rest/default-reviewers/1.0/projects/SOME/repos/repo/reviewers?sourceRefId=refs/heads/branch&targetRefId=refs/heads/master&sourceRepoId=5&targetRepoId=5`,
            )
            .reply(200, [{ name: 'jcitizen' }])
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'));

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

        it('posts PR default branch', async () => {
          const scope = await initRepo();
          scope
            .get(`${urlPath}/rest/api/1.0/projects/SOME/repos/repo`)
            .reply(200, prMock(url, 'SOME', 'repo'))
            .get(
              `${urlPath}/rest/default-reviewers/1.0/projects/SOME/repos/repo/reviewers?sourceRefId=refs/heads/branch&targetRefId=refs/heads/master&sourceRepoId=5&targetRepoId=5`,
            )
            .reply(200, [{ name: 'jcitizen' }])
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'));

          const pr = await bitbucket.createPr({
            sourceBranch: 'branch',
            targetBranch: 'master',
            prTitle: 'title',
            prBody: 'body',
            labels: null,
            platformOptions: {
              bbUseDefaultReviewers: true,
            },
          });
          expect(pr?.number).toBe(5);
        });
      });

      describe('getPr()', () => {
        it('returns null for no prNo', async () => {
          httpMock.scope(urlHost);
          expect(await bitbucket.getPr(undefined as any)).toBeNull();
        });

        it('gets a PR', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'));

          expect(await bitbucket.getPr(5)).toMatchSnapshot();
        });

        it('canRebase', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/3`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .twice()
            .reply(200, prMock(url, 'SOME', 'repo'));

          expect(await bitbucket.getPr(3)).toMatchSnapshot();

          expect(await bitbucket.getPr(5)).toMatchSnapshot();

          expect(await bitbucket.getPr(5)).toMatchSnapshot();
        });

        it('gets a closed PR', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, {
              version: 0,
              number: 5,
              state: 'MERGED',
              reviewers: [],
              fromRef: {},
              toRef: {},
            });

          expect(await bitbucket.getPr(5)).toMatchSnapshot();
        });
      });

      describe('updatePr()', () => {
        it('puts PR', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200);

          await expect(
            bitbucket.updatePr({
              number: 5,
              prTitle: 'title',
              prBody: 'body',
              targetBranch: 'new_base',
            }),
          ).toResolve();
        });

        it('closes PR', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, { state: 'OPEN', version: 42 })
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/decline?version=42`,
            )
            .reply(200, { status: 'DECLINED' });

          await expect(
            bitbucket.updatePr({
              number: 5,
              prTitle: 'title',
              prBody: 'body',
              state: 'closed',
            }),
          ).toResolve();
        });

        it('re-opens PR', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, { state: 'DECLINED', version: 42 })
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/reopen?version=42`,
            )
            .reply(200, { status: 'OPEN' });

          await expect(
            bitbucket.updatePr({
              number: 5,
              prTitle: 'title',
              prBody: 'body',
              state: 'open',
            }),
          ).toResolve();
        });

        it('throws not-found 1', async () => {
          await initRepo();
          await expect(
            bitbucket.updatePr({
              number: null as any,
              prTitle: 'title',
              prBody: 'body',
            }),
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);
        });

        it('throws not-found 2', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/4`,
            )
            .reply(404);
          await expect(
            bitbucket.updatePr({ number: 4, prTitle: 'title', prBody: 'body' }),
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);
        });

        it('throws not-found 3', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(404);

          await expect(
            bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);
        });

        it('handles invalid users gracefully by retrying without invalid reviewers', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(409, {
              errors: [
                {
                  context: 'reviewers',
                  message:
                    'Errors encountered while adding some reviewers to this pull request.',
                  exceptionName:
                    'com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException',
                  reviewerErrors: [
                    {
                      context: 'userName2',
                      message: 'userName2 is not a user.',
                      exceptionName: null,
                    },
                  ],
                  validReviewers: [],
                },
              ],
            })
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
              (body) => body.reviewers.length === 0,
            )
            .reply(200, prMock(url, 'SOME', 'repo'));

          await expect(
            bitbucket.updatePr({
              number: 5,
              prTitle: 'title',
              prBody: 'body',
              state: 'open',
            }),
          ).toResolve();
        });

        it('throws repository-changed', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(409);

          await expect(
            bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
          ).rejects.toThrow(REPOSITORY_CHANGED);
        });

        it('throws', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .put(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(405);

          await expect(
            bitbucket.updatePr({ number: 5, prTitle: 'title', prBody: 'body' }),
          ).rejects.toThrowErrorMatchingSnapshot();
        });
      });

      describe('mergePr()', () => {
        it('posts Merge', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/merge?version=1`,
            )
            .reply(200);

          expect(
            await bitbucket.mergePr({
              branchName: 'branch',
              id: 5,
            }),
          ).toBeTrue();
        });

        it('throws not-found 1', async () => {
          await initRepo();
          const res = bitbucket.mergePr({
            branchName: 'branch',
            id: null as any,
          });
          await expect(res).rejects.toThrow(REPOSITORY_NOT_FOUND);
        });

        it('throws not-found 2', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/4`,
            )
            .reply(404);

          await expect(
            bitbucket.mergePr({
              branchName: 'branch',
              id: 4,
            }),
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);
        });

        it('throws not-found 3', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/merge?version=1`,
            )
            .reply(404);

          await expect(
            bitbucket.mergePr({
              branchName: 'branch',
              id: 5,
            }),
          ).rejects.toThrow(REPOSITORY_NOT_FOUND);
        });

        it('throws conflicted', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/merge?version=1`,
            )
            .reply(409);

          expect(
            await bitbucket.mergePr({
              branchName: 'branch',
              id: 5,
            }),
          ).toBeFalsy();
        });

        it('unknown error', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`,
            )
            .reply(200, prMock(url, 'SOME', 'repo'))
            .post(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/merge?version=1`,
            )
            .reply(405);

          await expect(
            bitbucket.mergePr({
              branchName: 'branch',
              id: 5,
            }),
          ).resolves.toBeFalse();
        });
      });

      describe('massageMarkdown()', () => {
        it('returns diff files', () => {
          expect(
            bitbucket.massageMarkdown(
              '<details><summary>foo</summary>bar</details>text<details>',
            ),
          ).toMatchSnapshot();
        });

        it('sanitizes HTML comments in the body', () => {
          const prBody = bitbucket.massageMarkdown(`---

- [ ] <!-- rebase-check -->If you want to rebase/retry this PR, click this checkbox
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

      describe('getBranchStatus()', () => {
        it('should be success', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200, {
              successful: 3,
              inProgress: 0,
              failed: 0,
            });

          expect(await bitbucket.getBranchStatus('somebranch', true)).toBe(
            'green',
          );
        });

        it('should be pending', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200, {
              successful: 3,
              inProgress: 1,
              failed: 0,
            });

          expect(await bitbucket.getBranchStatus('somebranch', true)).toBe(
            'yellow',
          );

          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200, {
              successful: 0,
              inProgress: 0,
              failed: 0,
            });

          expect(await bitbucket.getBranchStatus('somebranch', true)).toBe(
            'yellow',
          );
        });

        it('should be failed', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200, {
              successful: 1,
              inProgress: 1,
              failed: 1,
            });

          expect(await bitbucket.getBranchStatus('somebranch', true)).toBe(
            'red',
          );

          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .replyWithError('requst-failed');

          expect(await bitbucket.getBranchStatus('somebranch', true)).toBe(
            'red',
          );
        });

        it('throws repository-changed', async () => {
          git.branchExists.mockReturnValue(false);
          await initRepo();
          await expect(
            bitbucket.getBranchStatus('somebranch', true),
          ).rejects.toThrow(REPOSITORY_CHANGED);
        });
      });

      describe('getBranchStatusCheck()', () => {
        it('should be success', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [
                {
                  state: 'SUCCESSFUL',
                  key: 'context-2',
                  url: 'https://renovatebot.com',
                },
              ],
            });

          expect(
            await bitbucket.getBranchStatusCheck('somebranch', 'context-2'),
          ).toBe('green');
        });

        it('should be pending', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [
                {
                  state: 'INPROGRESS',
                  key: 'context-2',
                  url: 'https://renovatebot.com',
                },
              ],
            });

          expect(
            await bitbucket.getBranchStatusCheck('somebranch', 'context-2'),
          ).toBe('yellow');
        });

        it('should be failure', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [
                {
                  state: 'FAILED',
                  key: 'context-2',
                  url: 'https://renovatebot.com',
                },
              ],
            });

          expect(
            await bitbucket.getBranchStatusCheck('somebranch', 'context-2'),
          ).toBe('red');
        });

        it('should be null', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .replyWithError('requst-failed');

          expect(
            await bitbucket.getBranchStatusCheck('somebranch', 'context-2'),
          ).toBeNull();

          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [],
            });

          expect(
            await bitbucket.getBranchStatusCheck('somebranch', 'context-2'),
          ).toBeNull();
        });
      });

      describe('setBranchStatus()', () => {
        it('should be success 1', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .twice()
            .reply(200, {
              isLastPage: true,
              values: [{ key: 'context-1', state: 'SUCCESSFUL' }],
            })
            .post(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200)
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200, {});

          await expect(
            bitbucket.setBranchStatus({
              branchName: 'somebranch',
              context: 'context-2',
              description: null as any,
              state: 'green',
            }),
          ).toResolve();
        });

        it('should be success 2', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .twice()
            .reply(200, {
              isLastPage: true,
              values: [{ key: 'context-1', state: 'SUCCESSFUL' }],
            })
            .post(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200)
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200, {});

          await expect(
            bitbucket.setBranchStatus({
              branchName: 'somebranch',
              context: 'context-2',
              description: null as any,
              state: 'red',
            }),
          ).toResolve();
        });

        it('should be success 3', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .twice()
            .reply(200, {
              isLastPage: true,
              values: [{ key: 'context-1', state: 'SUCCESSFUL' }],
            })
            .post(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200)
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200, {});

          await expect(
            bitbucket.setBranchStatus({
              branchName: 'somebranch',
              context: 'context-2',
              description: null as any,
              state: 'red',
            }),
          ).toResolve();
        });

        it('should be success 4', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .twice()
            .reply(200, {
              isLastPage: true,
              values: [{ key: 'context-1', state: 'SUCCESSFUL' }],
            })
            .post(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200)
            .get(
              `${urlPath}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .reply(200, {});

          await expect(
            bitbucket.setBranchStatus({
              branchName: 'somebranch',
              context: 'context-2',
              description: null as any,
              state: 'yellow',
            }),
          ).toResolve();
        });

        it('should be success 5', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ key: 'context-1', state: 'SUCCESSFUL' }],
            })
            .post(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e`,
            )
            .replyWithError('requst-failed');

          await expect(
            bitbucket.setBranchStatus({
              branchName: 'somebranch',
              context: 'context-2',
              description: null as any,
              state: 'green',
            }),
          ).toResolve();
        });

        it('should be success 6', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`,
            )
            .reply(200, {
              isLastPage: true,
              values: [{ key: 'context-1', state: 'SUCCESSFUL' }],
            });

          await expect(
            bitbucket.setBranchStatus({
              branchName: 'somebranch',
              context: 'context-1',
              description: null as any,
              state: 'green',
            }),
          ).toResolve();
        });
      });

      describe('getJsonFile()', () => {
        it('returns file content', async () => {
          const data = { foo: 'bar' };
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/browse/file.json?limit=20000`,
            )
            .reply(200, {
              isLastPage: true,
              lines: [{ text: JSON.stringify(data) }],
            });
          const res = await bitbucket.getJsonFile('file.json');
          expect(res).toEqual(data);
        });

        it('returns file content in json5 format', async () => {
          const lines = [
            { text: '{' },
            { text: '  // json5 comment' },
            { text: '  foo: "bar"' },
            { text: '}' },
          ];
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/browse/file.json5?limit=20000`,
            )
            .reply(200, {
              isLastPage: true,
              lines,
            });
          const res = await bitbucket.getJsonFile('file.json5');
          expect(res).toEqual({ foo: 'bar' });
        });

        it('returns file content from given repo', async () => {
          const data = { foo: 'bar' };
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/DIFFERENT/repos/repo/browse/file.json?limit=20000`,
            )
            .reply(200, {
              isLastPage: true,
              lines: [{ text: JSON.stringify(data) }],
            });
          const res = await bitbucket.getJsonFile(
            'file.json',
            'DIFFERENT/repo',
          );
          expect(res).toEqual(data);
        });

        it('returns file content from branch or tag', async () => {
          const data = { foo: 'bar' };
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/browse/file.json?limit=20000&at=dev`,
            )
            .reply(200, {
              isLastPage: true,
              lines: [{ text: JSON.stringify(data) }],
            });
          const res = await bitbucket.getJsonFile(
            'file.json',
            'SOME/repo',
            'dev',
          );
          expect(res).toEqual(data);
        });

        it('throws on malformed JSON', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/browse/file.json?limit=20000`,
            )
            .reply(200, {
              isLastPage: true,
              lines: [{ text: '!@#' }],
            });
          await expect(bitbucket.getJsonFile('file.json')).rejects.toThrow();
        });

        it('throws on long content', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/browse/file.json?limit=20000`,
            )
            .reply(200, {
              isLastPage: false,
              lines: [{ text: '{' }],
            });
          await expect(bitbucket.getJsonFile('file.json')).rejects.toThrow();
        });

        it('throws on errors', async () => {
          const scope = await initRepo();
          scope
            .get(
              `${urlPath}/rest/api/1.0/projects/SOME/repos/repo/browse/file.json?limit=20000`,
            )
            .replyWithError('some error');
          await expect(bitbucket.getJsonFile('file.json')).rejects.toThrow();
        });
      });
    });
  });
});
