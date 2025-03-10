import type { MergeStrategy } from '../../../config/types';
import * as hostRules from '../../../util/host-rules';
import type { GitUrlOption, Pr } from '../types';
import type { Repo } from './schema';
import type { PrFilterByState } from './types';
import { getMergeMethod, getRepoUrl, matchPrState, smartLinks } from './utils';
import { invalidatePrCache } from './index';

describe('modules/platform/scm-manager/utils', () => {
  describe(getMergeMethod, () => {
    it.each`
      strategy          | method
      ${undefined}      | ${null}
      ${'auto'}         | ${null}
      ${'fast-forward'} | ${'FAST_FORWARD_IF_POSSIBLE'}
      ${'merge-commit'} | ${'MERGE_COMMIT'}
      ${'rebase'}       | ${'REBASE'}
      ${'squash'}       | ${'SQUASH'}
    `(
      'map merge strategy $strategy on PR merge method $method',
      ({
        strategy,
        method,
      }: {
        strategy: string | undefined;
        method: string | null;
      }) => {
        expect(getMergeMethod(strategy as MergeStrategy)).toEqual(method);
      },
    );
  });

  describe(smartLinks, () => {
    it.each`
      body            | result
      ${''}           | ${''}
      ${'](../pull/'} | ${'](pulls/'}
    `(
      'adjust $body to smart link $result',
      ({ body, result }: { body: string; result: string }) => {
        expect(smartLinks(body)).toEqual(result);
      },
    );
  });

  describe(matchPrState, () => {
    const defaultPr: Pr = {
      sourceBranch: 'feature/test',
      createdAt: '2023-08-02T10:48:24.762Z',
      number: 1,
      state: '',
      title: 'Feature Test PR',
      isDraft: false,
    };

    it.each`
      pr                                     | state       | expectedResult
      ${{ ...defaultPr, state: 'OPEN' }}     | ${'all'}    | ${true}
      ${{ ...defaultPr, state: 'DRAFT' }}    | ${'all'}    | ${true}
      ${{ ...defaultPr, state: 'MERGED' }}   | ${'all'}    | ${true}
      ${{ ...defaultPr, state: 'REJECTED' }} | ${'all'}    | ${true}
      ${{ ...defaultPr, state: 'OPEN' }}     | ${'open'}   | ${true}
      ${{ ...defaultPr, state: 'DRAFT' }}    | ${'open'}   | ${true}
      ${{ ...defaultPr, state: 'MERGED' }}   | ${'open'}   | ${false}
      ${{ ...defaultPr, state: 'REJECTED' }} | ${'open'}   | ${false}
      ${{ ...defaultPr, state: 'OPEN' }}     | ${'!open'}  | ${false}
      ${{ ...defaultPr, state: 'DRAFT' }}    | ${'!open'}  | ${false}
      ${{ ...defaultPr, state: 'MERGED' }}   | ${'!open'}  | ${true}
      ${{ ...defaultPr, state: 'REJECTED' }} | ${'!open'}  | ${true}
      ${{ ...defaultPr, state: 'OPEN' }}     | ${'closed'} | ${false}
      ${{ ...defaultPr, state: 'DRAFT' }}    | ${'closed'} | ${false}
      ${{ ...defaultPr, state: 'MERGED' }}   | ${'closed'} | ${true}
      ${{ ...defaultPr, state: 'REJECTED' }} | ${'closed'} | ${true}
    `(
      'match scm pr state $pr.state to renovate pr state $state',
      ({
        pr,
        state,
        expectedResult,
      }: {
        pr: Pr;
        state: string;
        expectedResult: boolean;
      }) => {
        expect(matchPrState(pr, state as PrFilterByState)).toEqual(
          expectedResult,
        );
      },
    );
  });

  describe(getRepoUrl, () => {
    const repo: Repo = {
      contact: 'test@test.com',
      creationDate: '2023-08-02T10:48:24.762Z',
      description: 'Default Repo',
      lastModified: '2023-08-10T10:48:24.762Z',
      namespace: 'default',
      name: 'repo',
      type: 'git',
      archived: false,
      exporting: false,
      healthCheckRunning: false,
      _links: {},
    };

    const endpoint = 'http://localhost:8081/scm/api/v2';
    const gitHttpEndpoint = 'http://localhost:8081/scm/repo/default/repo';
    const gitSshEndpoint = 'ssh://localhost:2222/scm/repo/default/repo';

    beforeEach(() => {
      hostRules.add({ token: 'token', username: 'tzerr' });
      invalidatePrCache();
    });

    it.each`
      gitUrl
      ${'ssh'}
      ${'default'}
      ${'endpoint'}
      ${undefined}
    `(
      'should throw error for option $gitUrl, because protocol links are missing',
      ({ gitUrl }: { gitUrl: string | undefined }) => {
        expect(() =>
          getRepoUrl(repo, gitUrl as GitUrlOption, endpoint),
        ).toThrow('Missing protocol links.');
      },
    );

    it('should throw error because of missing SSH link', () => {
      expect(() =>
        getRepoUrl(
          {
            ...repo,
            _links: { protocol: [{ name: 'http', href: gitHttpEndpoint }] },
          },
          'ssh',
          endpoint,
        ),
      ).toThrow('MISSING_SSH_LINK');
    });

    it('should throw error because protocol links are not an array', () => {
      expect(() =>
        getRepoUrl(
          {
            ...repo,
            _links: { protocol: { name: 'http', href: gitHttpEndpoint } },
          },
          'ssh',
          endpoint,
        ),
      ).toThrow('Expected protocol links to be an array of links.');
    });

    it('should use the provided ssh link', () => {
      expect(
        getRepoUrl(
          {
            ...repo,
            _links: { protocol: [{ name: 'ssh', href: gitSshEndpoint }] },
          },
          'ssh',
          endpoint,
        ),
      ).toEqual(gitSshEndpoint);
    });

    it.each`
      gitUrl
      ${'default'}
      ${'endpoint'}
      ${undefined}
    `(
      'should throw error because of missing HTTP link for option $gitUrl',
      ({ gitUrl }: { gitUrl: string | undefined }) => {
        expect(() =>
          getRepoUrl(
            {
              ...repo,
              _links: { protocol: [{ name: 'ssh', href: gitSshEndpoint }] },
            },
            gitUrl as GitUrlOption | undefined,
            endpoint,
          ),
        ).toThrow('MISSING_HTTP_LINK');
      },
    );

    it.each`
      gitUrl
      ${'default'}
      ${'endpoint'}
      ${undefined}
    `(
      'should throw error because of malformed HTTP link with option $gitUrl',
      ({ gitUrl }: { gitUrl: string | undefined }) => {
        expect(() =>
          getRepoUrl(
            {
              ...repo,
              _links: { protocol: [{ name: 'http', href: 'invalid url' }] },
            },
            gitUrl as GitUrlOption | undefined,
            endpoint,
          ),
        ).toThrow('MALFORMED_HTTP_LINK');
      },
    );

    it.each`
      gitUrl
      ${'default'}
      ${'endpoint'}
      ${undefined}
    `(
      'should use empty string, because username was not provided with option $gitUrl',
      ({ gitUrl }: { gitUrl: string | undefined }) => {
        hostRules.clear();
        expect(
          getRepoUrl(
            {
              ...repo,
              _links: { protocol: [{ name: 'http', href: gitHttpEndpoint }] },
            },
            gitUrl as GitUrlOption | undefined,
            endpoint,
          ),
        ).toBe('http://localhost:8081/scm/repo/default/repo');
      },
    );

    it.each`
      gitUrl
      ${'default'}
      ${'endpoint'}
      ${undefined}
    `(
      'should use empty string, because token was not provided. With option $gitUrl',
      ({ gitUrl }: { gitUrl: string | undefined }) => {
        hostRules.clear();
        hostRules.add({ username: 'tzerr' });
        expect(
          getRepoUrl(
            {
              ...repo,
              _links: { protocol: [{ name: 'http', href: gitHttpEndpoint }] },
            },
            gitUrl as GitUrlOption | undefined,
            endpoint,
          ),
        ).toBe('http://tzerr@localhost:8081/scm/repo/default/repo');
      },
    );

    it.each`
      gitUrl
      ${'default'}
      ${'endpoint'}
      ${undefined}
    `(
      'should provide the HTTP link with username, for option $gitUrl',
      ({ gitUrl }: { gitUrl: string | undefined }) => {
        expect(
          getRepoUrl(
            {
              ...repo,
              _links: { protocol: [{ name: 'http', href: gitHttpEndpoint }] },
            },
            gitUrl as GitUrlOption | undefined,
            endpoint,
          ),
        ).toBe('http://tzerr:token@localhost:8081/scm/repo/default/repo');
      },
    );
  });
});
