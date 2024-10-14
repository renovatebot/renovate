import type { Response } from 'got';
import { partial } from '../../../../test/util';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import type {
  BbsRestRepo,
  BitbucketError,
  BitbucketErrorResponse,
} from './types';
import {
  BITBUCKET_INVALID_REVIEWERS_EXCEPTION,
  getExtraCloneOpts,
  getInvalidReviewers,
  getRepoGitUrl,
} from './utils';

function sshLink(projectKey: string, repositorySlug: string): string {
  return `ssh://git@stash.renovatebot.com:7999/${projectKey.toLowerCase()}/${repositorySlug}.git`;
}

function httpLink(
  endpointStr: string,
  projectKey: string,
  repositorySlug: string,
): string {
  return `${endpointStr}scm/${projectKey}/${repositorySlug}.git`;
}

function infoMock(
  endpoint: URL | string,
  projectKey: string,
  repositorySlug: string,
  options: { cloneUrl: { https: boolean; ssh: boolean } } = {
    cloneUrl: { https: true, ssh: true },
  },
): BbsRestRepo {
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
    links.clone = [];
    if (options.cloneUrl.https) {
      links.clone.push({
        href: httpLink(endpointStr, projectKey, repositorySlug),
        name: 'http',
      });
    }

    if (options.cloneUrl.ssh) {
      links.clone.push({
        href: sshLink(projectKey, repositorySlug),
        name: 'ssh',
      });
    }
    return {
      id: 123,
      project: { key: projectKey },
      origin: { name: repositorySlug, slug: repositorySlug },
      links,
    };
  } else {
    // This mimics the behavior of bb-server which does not include the clone property at all
    // if ssh and https are both turned off
    return {
      id: 1,
      project: { key: projectKey },
      origin: { name: repositorySlug, slug: repositorySlug },
      links: { clone: undefined },
    };
  }
}

describe('modules/platform/bitbucket-server/utils', () => {
  function createError(
    body: Partial<BitbucketErrorResponse> | undefined = undefined,
  ) {
    return partial<BitbucketError>({
      response: partial<Response<BitbucketErrorResponse>>({ body }),
    });
  }

  it('getInvalidReviewers', () => {
    expect(
      getInvalidReviewers(
        createError({
          errors: [
            {
              exceptionName: BITBUCKET_INVALID_REVIEWERS_EXCEPTION,
              reviewerErrors: [{ context: 'dummy' }, {}],
            },
          ],
        }),
      ),
    ).toStrictEqual(['dummy']);
    expect(getInvalidReviewers(createError())).toStrictEqual([]);
    expect(
      getInvalidReviewers(
        createError({
          errors: [{ exceptionName: BITBUCKET_INVALID_REVIEWERS_EXCEPTION }],
        }),
      ),
    ).toStrictEqual([]);
  });

  const scenarios = {
    'endpoint with no path': new URL('https://stash.renovatebot.com'),
    'endpoint with path': new URL('https://stash.renovatebot.com/vcs/'),
  };

  describe('getRepoGitUrl', () => {
    Object.entries(scenarios).forEach(([scenarioName, url]) => {
      describe(scenarioName, () => {
        const username = 'abc';
        const password = '123';
        const opts = {
          username,
          password,
        };

        it('works gitUrl:undefined generate endpoint', () => {
          expect(
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              undefined,
              infoMock(url, 'SOME', 'repo', {
                cloneUrl: { https: false, ssh: false },
              }),
              opts,
            ),
          ).toBe(
            httpLink(url.toString(), 'SOME', 'repo').replace(
              'https://',
              `https://${username}:${password}@`,
            ),
          );
        });

        it('works gitUrl:undefined use endpoint with injected auth', () => {
          expect(
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              undefined,
              infoMock(url, 'SOME', 'repo', {
                cloneUrl: { https: true, ssh: false },
              }),
              opts,
            ),
          ).toBe(
            httpLink(url.toString(), 'SOME', 'repo').replace(
              'https://',
              `https://${username}:${password}@`,
            ),
          );
        });

        it('works gitUrl:undefined use ssh', () => {
          expect(
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              undefined,
              infoMock(url, 'SOME', 'repo', {
                cloneUrl: { https: false, ssh: true },
              }),
              opts,
            ),
          ).toBe(sshLink('SOME', 'repo'));
        });

        it('works gitUrl:default', () => {
          expect(
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              'default',
              infoMock(url, 'SOME', 'repo'),
              opts,
            ),
          ).toBe(
            httpLink(url.toString(), 'SOME', 'repo').replace(
              'https://',
              `https://${username}:${password}@`,
            ),
          );
        });

        it('gitUrl:default invalid http url throws CONFIG_GIT_URL_UNAVAILABLE', () => {
          expect(() =>
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              'default',
              infoMock('invalidUrl', 'SOME', 'repo', {
                cloneUrl: { https: true, ssh: false },
              }),
              opts,
            ),
          ).toThrow(Error(CONFIG_GIT_URL_UNAVAILABLE));
        });

        it('gitUrl:default no http url returns generated url', () => {
          expect(
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              'default',
              infoMock(url, 'SOME', 'repo', {
                cloneUrl: { https: false, ssh: false },
              }),
              opts,
            ),
          ).toBe(
            httpLink(url.toString(), 'SOME', 'repo').replace(
              'https://',
              `https://${username}:${password}@`,
            ),
          );
        });

        it('gitUrl:ssh no ssh url throws CONFIG_GIT_URL_UNAVAILABLE', () => {
          expect(() =>
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              'ssh',
              infoMock(url, 'SOME', 'repo', {
                cloneUrl: { https: false, ssh: false },
              }),
              opts,
            ),
          ).toThrow(Error(CONFIG_GIT_URL_UNAVAILABLE));
        });

        it('works gitUrl:ssh', () => {
          expect(
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              'ssh',
              infoMock(url, 'SOME', 'repo'),
              opts,
            ),
          ).toBe(sshLink('SOME', 'repo'));
        });

        it('works gitUrl:endpoint', () => {
          expect(
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              'endpoint',
              infoMock(url, 'SOME', 'repo'),
              opts,
            ),
          ).toBe(
            httpLink(url.toString(), 'SOME', 'repo').replace(
              'https://',
              `https://${username}:${password}@`,
            ),
          );
        });

        it('works gitUrl:endpoint no basic auth', () => {
          expect(
            getRepoGitUrl(
              'SOME/repo',
              url.toString(),
              'endpoint',
              infoMock(url, 'SOME', 'repo'),
              {},
            ),
          ).toBe(httpLink(url.toString(), 'SOME', 'repo'));
        });
      });
    });
  });

  describe('getExtraCloneOpts', () => {
    it('should not configure bearer token', () => {
      const res = getExtraCloneOpts({});
      expect(res).toEqual({});
    });

    it('should configure bearer token', () => {
      const res = getExtraCloneOpts({ token: 'abc' });
      expect(res).toEqual({
        '-c': 'http.extraheader=Authorization: Bearer abc',
      });
    });
  });
});
