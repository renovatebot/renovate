import { codeBlock } from 'common-tags';
import type { Realm, Region } from 'oci-common';
import { ConfigFileAuthenticationDetailsProvider } from 'oci-common';
import { hostRules } from '~test/host-rules.ts';
import { fakeSha, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import {
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import * as hash from '../../../util/hash.ts';
import type { HttpResponse } from '../../../util/http/types.ts';
import { addSecretForSanitizing } from '../../../util/sanitize.ts';
import { getPrBodyStruct } from '../pr-body.ts';
import { repoFingerprint } from '../util.ts';
import { OciClient } from './client.ts';
import * as oci from './index.ts';
import type { OciComment, OciPullRequest, OciRepository } from './types.ts';

vi.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: vi.fn(
    class {
      constructor() {
        return partial<ConfigFileAuthenticationDetailsProvider>({
          getUser: () => userId,
          getRegion: () =>
            partial<Region>({
              regionId: 'eu-milan-1',
              realm: partial<Realm>({ secondLevelDomain: 'oraclecloud.com' }),
            }),
        });
      }
    },
  ),
}));
vi.mock('./client.ts', () => ({
  OciClient: vi.fn(
    class {
      constructor() {
        return api;
      }
    },
  ),
}));

const endpoint = 'https://devops.eu-milan-1.oci.oraclecloud.com/20210630/';
const repositoryId = 'ocid1.devopsrepository.example';
const userId = 'ocid1.user.renovate';
const api = {
  endpoint,
  get: vi.fn<OciClient['get']>(),
  post: vi.fn<OciClient['post']>(),
  put: vi.fn<OciClient['put']>(),
  delete: vi.fn<OciClient['delete']>(),
  getText: vi.fn<OciClient['getText']>(),
  list: vi.fn<OciClient['list']>(),
};
const repo: OciRepository = {
  id: repositoryId,
  defaultBranch: 'refs/heads/main',
  httpUrl:
    'https://devops.scmservice.example/namespaces/ns/projects/prj/repositories/repo',
  sshUrl:
    'ssh://devops.scmservice.example/namespaces/ns/projects/prj/repositories/repo',
  repositoryType: 'HOSTED',
  lifecycleState: 'ACTIVE',
};
const pr: OciPullRequest = {
  id: 'ocid1.devopspullrequest.example',
  displayName: 'Update dependency',
  description: 'PR body',
  sourceBranch: 'refs/heads/renovate/dep',
  destinationBranch: 'refs/heads/main',
  lifecycleDetails: 'OPEN',
  timeCreated: '2026-01-01T00:00:00Z',
  createdBy: { principalId: userId },
};
const number = Number.parseInt(hash.toSha256(pr.id).slice(0, 13), 16);
const prPath = `pullRequests/${pr.id}`;

function response<T>(body: T, statusCode = 200): HttpResponse<T> {
  return { body, statusCode, headers: {} };
}

async function initRepo(): Promise<void> {
  api.get.mockResolvedValueOnce(response(repo));
  await oci.initRepo({ repository: repositoryId });
}

describe('modules/platform/oci/index', () => {
  beforeEach(async () => {
    GlobalConfig.reset();
    git.getBranchCommit.mockReturnValue(fakeSha('main'));
    vi.stubEnv('OCI_COMPARTMENT_ID', undefined);
    api.list.mockResolvedValue([pr]);
    api.get.mockResolvedValue(response(pr));
    api.post.mockResolvedValue(response(pr));
    api.put.mockResolvedValue(response(pr));
    await oci.initPlatform({});
    await initRepo();
  });

  describe('initPlatform', () => {
    it('uses the OCI profile region by default', async () => {
      await expect(oci.initPlatform({})).resolves.toEqual({ endpoint });
      expect(OciClient).toHaveBeenLastCalledWith(
        endpoint,
        expect.objectContaining({ getUser: expect.any(Function) }),
      );
      expect(oci.id).toBe('oci');
      expect(oci.experimental).toBeTrue();
    });

    it.each(['https://devops.eu-milan-1.oci.oraclecloud.com', endpoint])(
      'accepts API endpoints with or without the version: %s',
      async (url) => {
        await expect(oci.initPlatform({ endpoint: url })).resolves.toEqual({
          endpoint,
        });
      },
    );

    it.each([
      'not a URL',
      'http://example.com',
      'https://user@example.com',
      'https://:password@example.com',
      'https://example.com?token=abc',
      'https://example.com#fragment',
    ])('rejects unsafe endpoints: %s', (url) => {
      expect(() => oci.initPlatform({ endpoint: url })).toThrow(
        'OCI endpoint must be an HTTPS API URL',
      );
    });

    it('selects a custom OCI profile and configuration file', async () => {
      vi.stubEnv('OCI_CONFIG_FILE', '/config/oci');
      vi.stubEnv('OCI_CONFIG_PROFILE', 'RENOVATE');

      await oci.initPlatform({});

      expect(ConfigFileAuthenticationDetailsProvider).toHaveBeenLastCalledWith(
        '/config/oci',
        'RENOVATE',
      );
    });
  });

  describe('initRepo', () => {
    it.each([{ forkToken: 'token' }, { forkOrg: 'organization' }])(
      'rejects unsupported fork mode: %j',
      async (forkConfig) => {
        await expect(
          oci.initRepo({ repository: repositoryId, ...forkConfig }),
        ).rejects.toThrow('OCI fork creation is not supported');
      },
    );

    it('accepts the default forkCreation flag without enabling fork mode', async () => {
      api.get.mockResolvedValueOnce(response(repo));

      await expect(
        oci.initRepo({ repository: repositoryId, forkCreation: true }),
      ).resolves.toMatchObject({ defaultBranch: 'main', isFork: false });
    });
    it.each([undefined, 'default', 'endpoint'] as const)(
      'uses HTTPS for gitUrl=%s',
      async (gitUrl) => {
        api.get.mockResolvedValueOnce(response(repo));

        await expect(
          oci.initRepo({ repository: repositoryId, gitUrl }),
        ).resolves.toEqual({
          defaultBranch: 'main',
          isFork: false,
          repoFingerprint: repoFingerprint(repositoryId, endpoint),
        });
        expect(git.initRepo).toHaveBeenLastCalledWith({
          url: repo.httpUrl,
          defaultBranch: 'main',
          cloneSubmodules: undefined,
          cloneSubmodulesFilter: undefined,
        });
      },
    );

    it('supports SSH, forwards clone options, and does not add HTTPS credentials', async () => {
      await oci.initPlatform({ username: 'user', password: 'token' });
      api.get.mockResolvedValueOnce(response(repo));

      await oci.initRepo({
        repository: repositoryId,
        gitUrl: 'ssh',
        cloneSubmodules: true,
        cloneSubmodulesFilter: ['module'],
      });

      expect(git.initRepo).toHaveBeenLastCalledWith({
        url: repo.sshUrl,
        defaultBranch: 'main',
        cloneSubmodules: true,
        cloneSubmodulesFilter: ['module'],
      });
      expect(hostRules.getAll()).toEqual([]);
    });

    it('scopes configured HTTPS credentials to the Git host', async () => {
      await oci.initPlatform({
        username: 'tenancy/user',
        password: 'auth-token',
      });

      await initRepo();

      expect(hostRules.getAll()).toEqual([
        {
          hostType: 'oci',
          matchHost: 'devops.scmservice.example',
          resolvedHost: 'devops.scmservice.example',
          trustTier: 'untrusted',
          username: 'tenancy/user',
          password: 'auth-token',
        },
      ]);
      expect(git.initRepo).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://tenancy%2Fuser:auth-token@devops.scmservice.example/namespaces/ns/projects/prj/repositories/repo',
        }),
      );
    });

    it('does not install incomplete HTTPS credentials', async () => {
      await oci.initPlatform({ username: 'user' });

      await initRepo();

      expect(hostRules.getAll()).toEqual([]);
    });

    it('recognizes forked repositories and unqualified branches', async () => {
      api.get.mockResolvedValueOnce(
        response({
          ...repo,
          defaultBranch: 'master',
          repositoryType: 'FORKED',
        }),
      );

      await expect(
        oci.initRepo({ repository: repositoryId }),
      ).resolves.toMatchObject({ defaultBranch: 'master', isFork: true });
    });

    it.each`
      status | expected
      ${404} | ${REPOSITORY_NOT_FOUND}
      ${403} | ${REPOSITORY_ACCESS_FORBIDDEN}
      ${401} | ${'OCI repository lookup failed (401)'}
    `('handles HTTP $status', async ({ status, expected }) => {
      api.get.mockResolvedValueOnce(response({}, status));

      await expect(oci.initRepo({ repository: repositoryId })).rejects.toThrow(
        expected,
      );
    });

    it.each([{ defaultBranch: undefined }])(
      'rejects empty repositories: %j',
      async (overrides) => {
        api.get.mockResolvedValueOnce(response({ ...repo, ...overrides }));

        await expect(
          oci.initRepo({ repository: repositoryId }),
        ).rejects.toThrow(REPOSITORY_EMPTY);
      },
    );

    it('rejects a repository without a default branch commit', async () => {
      api.get.mockResolvedValueOnce(response(repo));
      git.getBranchCommit.mockReturnValueOnce(null);

      await expect(oci.initRepo({ repository: repositoryId })).rejects.toThrow(
        REPOSITORY_EMPTY,
      );
    });

    it('uses Git refs rather than stale OCI repository statistics', async () => {
      api.get.mockResolvedValueOnce(response({ ...repo, commitCount: 0 }));

      await expect(
        oci.initRepo({ repository: repositoryId }),
      ).resolves.toMatchObject({ defaultBranch: 'main' });
    });

    it('rejects mirrored repositories', async () => {
      api.get.mockResolvedValueOnce(
        response({ ...repo, repositoryType: 'MIRRORED' }),
      );

      await expect(oci.initRepo({ repository: repositoryId })).rejects.toThrow(
        REPOSITORY_MIRRORED,
      );
    });

    it.each([undefined, 'ssh'] as const)(
      'rejects a missing clone URL (%s)',
      async (gitUrl) => {
        api.get.mockResolvedValueOnce(
          response({ ...repo, httpUrl: undefined, sshUrl: undefined }),
        );

        await expect(
          oci.initRepo({ repository: repositoryId, gitUrl }),
        ).rejects.toThrow('clone URL is unavailable');
      },
    );

    it('propagates Git failures', async () => {
      api.get.mockResolvedValueOnce(response(repo));
      git.initRepo.mockRejectedValueOnce(new Error('authentication failed'));

      await expect(oci.initRepo({ repository: repositoryId })).rejects.toThrow(
        'authentication failed',
      );
    });

    it('clears cached PRs between repositories', async () => {
      await oci.getPrList();
      await initRepo();
      api.list.mockResolvedValueOnce([]);

      await expect(oci.getPrList()).resolves.toEqual([]);
    });
  });

  describe('autodiscovery', () => {
    it('requires an explicit discovery scope', async () => {
      await expect(oci.getRepos()).rejects.toThrow(
        'autodiscovery requires autodiscoverProjects',
      );
    });

    it('discovers active repositories in a compartment, excluding mirrors', async () => {
      vi.stubEnv('OCI_COMPARTMENT_ID', 'compartment');
      api.list.mockResolvedValueOnce([
        repo,
        { ...repo, id: 'mirror', repositoryType: 'MIRRORED' },
      ]);

      await expect(oci.getRepos({ projects: [] })).resolves.toEqual([
        repositoryId,
      ]);
      expect(api.list).toHaveBeenLastCalledWith('repositories', {
        compartmentId: 'compartment',
        lifecycleState: 'ACTIVE',
      });
    });

    it('discovers projects and deduplicates results', async () => {
      api.list.mockResolvedValue([repo]);

      await expect(
        oci.getRepos({ projects: ['project-a', 'project-b'] }),
      ).resolves.toEqual([repositoryId]);
      expect(api.list).toHaveBeenCalledWith('repositories', {
        projectId: 'project-b',
        lifecycleState: 'ACTIVE',
      });
    });
  });

  describe('pull requests', () => {
    const forkPr: OciPullRequest = {
      ...pr,
      id: 'ocid1.devopspullrequest.fork',
      sourceRepositoryId: 'ocid1.devopsrepository.fork',
    };

    it('normalizes and caches PRs, scoped to the current author', async () => {
      const prs = await oci.getPrList();

      expect(prs).toEqual([
        {
          id: pr.id,
          authorId: userId,
          number,
          title: pr.displayName,
          body: pr.description,
          bodyStruct: getPrBodyStruct(pr.description),
          sourceBranch: 'renovate/dep',
          targetBranch: 'main',
          sourceRepo: repositoryId,
          state: 'open',
          createdAt: pr.timeCreated,
          isDraft: false,
          reviewers: undefined,
          cannotMergeReason: undefined,
        },
      ]);
      await expect(oci.getPrList()).resolves.toBe(prs);
      expect(api.list).toHaveBeenCalledExactlyOnceWith('pullRequests', {
        repositoryId,
        createdBy: userId,
      });
    });

    it('supports ignorePrAuthor', async () => {
      GlobalConfig.set({ ignorePrAuthor: true });

      await oci.getPrList();

      expect(api.list).toHaveBeenLastCalledWith('pullRequests', {
        repositoryId,
      });
    });

    it('excludes incoming fork PRs from the managed list and identifier lookup', async () => {
      GlobalConfig.set({ ignorePrAuthor: true });
      api.list.mockResolvedValueOnce([forkPr, pr]);
      const forkNumber = Number.parseInt(
        hash.toSha256(forkPr.id).slice(0, 13),
        16,
      );

      const prs = await oci.getPrList();

      expect(prs).toMatchObject([{ id: pr.id }]);
      await expect(oci.getPr(forkNumber)).resolves.toBeNull();
      await expect(
        oci.updatePr({ number: forkNumber, prTitle: 'Title', state: 'closed' }),
      ).rejects.toThrow('pull request not found');
      expect(api.put).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      'matches the local PR when a fork uses the same branch (includeOtherAuthors=%s)',
      async (includeOtherAuthors) => {
        api.list.mockResolvedValue([
          forkPr,
          { ...pr, sourceRepositoryId: repositoryId },
        ]);

        const found = await oci.findPr({
          branchName: 'renovate/dep',
          targetBranch: 'main',
          state: 'open',
          includeOtherAuthors,
        });
        const branchPr = await oci.getBranchPr('renovate/dep');

        expect(found).toMatchObject({ id: pr.id, sourceRepo: repositoryId });
        expect(branchPr).toMatchObject({ id: pr.id });
        expect(api.get).toHaveBeenLastCalledWith(prPath, {
          throwHttpErrors: false,
        });
      },
    );

    it.each(['CLOSED', 'MERGED'] as const)(
      'does not treat a %s fork PR as a previous local update',
      async (lifecycleDetails) => {
        api.list.mockResolvedValueOnce([{ ...forkPr, lifecycleDetails }]);

        const found = await oci.findPr({
          branchName: 'renovate/dep',
          prTitle: pr.displayName,
          targetBranch: 'main',
          state: '!open',
        });

        expect(found).toBeNull();
      },
    );

    it('can find and read other authors without changing the author-scoped cache', async () => {
      await oci.getPrList();
      const other = {
        ...pr,
        id: 'foreign-pr',
        createdBy: { principalId: 'other' },
      };
      api.list.mockResolvedValueOnce([other]);

      const found = await oci.findPr({
        branchName: 'renovate/dep',
        includeOtherAuthors: true,
      });

      expect(found).toMatchObject({ id: other.id, authorId: 'other' });
      expect(api.list).toHaveBeenLastCalledWith('pullRequests', {
        repositoryId,
      });
      api.get.mockResolvedValueOnce(response(other));
      await expect(oci.getPr(found!.number)).resolves.toMatchObject({
        id: other.id,
      });
      await expect(oci.getPrList()).resolves.toMatchObject([{ id: pr.id }]);
    });

    it.each`
      lifecycleDetails | state       | cannotMergeReason
      ${'CLOSED'}      | ${'closed'} | ${undefined}
      ${'MERGED'}      | ${'merged'} | ${undefined}
      ${'CONFLICT'}    | ${'open'}   | ${'Merge conflicts'}
      ${'MERGING'}     | ${'open'}   | ${undefined}
    `(
      'maps $lifecycleDetails',
      async ({ lifecycleDetails, state, cannotMergeReason }) => {
        api.list.mockResolvedValueOnce([
          {
            ...pr,
            lifecycleDetails,
            description: undefined,
            sourceRepositoryId: repositoryId,
            reviewers: [{ principalId: 'reviewer' }],
          },
        ]);

        await expect(oci.getPrList()).resolves.toMatchObject([
          {
            state,
            cannotMergeReason,
            body: '',
            sourceRepo: repositoryId,
            reviewers: ['reviewer'],
          },
        ]);
      },
    );

    it('detects identifier collisions rather than targeting the wrong PR', async () => {
      vi.spyOn(hash, 'toSha256').mockReturnValue('a'.repeat(64));
      api.list.mockResolvedValueOnce([pr, { ...pr, id: 'another-id' }]);

      await expect(oci.getPrList()).rejects.toThrow('identifier collision');
      api.list.mockResolvedValueOnce([pr]);
      await expect(oci.getPrList()).resolves.toHaveLength(1);
    });

    it('also detects collisions when creating a PR with a loaded cache', async () => {
      vi.spyOn(hash, 'toSha256').mockReturnValue('a'.repeat(64));
      await oci.getPrList();
      api.post.mockResolvedValueOnce(response({ ...pr, id: 'another-id' }));

      await expect(
        oci.createPr({
          sourceBranch: 'branch',
          targetBranch: 'main',
          prTitle: 'Title',
          prBody: 'Body',
        }),
      ).rejects.toThrow('identifier collision');
    });

    it('deduplicates instances of the same PR without reporting a collision', async () => {
      api.list.mockResolvedValueOnce([pr, pr]);

      await expect(oci.getPrList()).resolves.toHaveLength(1);
    });

    it('refreshes PR details by OCID', async () => {
      await expect(oci.getPr(number)).resolves.toMatchObject({
        id: pr.id,
        number,
      });
      expect(api.get).toHaveBeenLastCalledWith(prPath, {
        throwHttpErrors: false,
      });
    });

    it('refreshes only the requested cached PR', async () => {
      api.list.mockResolvedValueOnce([pr, { ...pr, id: 'other' }]);

      await oci.getPr(number);

      await expect(oci.getPrList()).resolves.toHaveLength(2);
    });

    it('returns null for an unknown PR', async () => {
      await expect(oci.getPr(-1)).resolves.toBeNull();
    });

    it('returns null for a deleted PR', async () => {
      api.get.mockResolvedValueOnce(response({}, 404));

      await expect(oci.getPr(number)).resolves.toBeNull();
      await expect(oci.getPr(number)).resolves.toBeNull();
      await expect(oci.getPrList()).resolves.toEqual([]);
    });

    it('does not restore a deleted PR identity while loading the list cache', async () => {
      await oci.createPr({
        sourceBranch: 'branch',
        targetBranch: 'main',
        prTitle: 'Title',
        prBody: 'Body',
      });
      api.get.mockResolvedValueOnce(response({}, 404));

      await expect(oci.getPr(number)).resolves.toBeNull();
      await expect(oci.getPr(number)).resolves.toBeNull();

      expect(api.get).toHaveBeenLastCalledWith(prPath, {
        throwHttpErrors: false,
      });
    });

    it('does not hide authentication failures', async () => {
      api.get.mockResolvedValueOnce(response({}, 403));

      await expect(oci.getPr(number)).rejects.toThrow('lookup failed (403)');
    });

    it('finds an open branch PR with fresh details', async () => {
      await expect(oci.getBranchPr('renovate/dep')).resolves.toMatchObject({
        number,
      });
      await expect(oci.getBranchPr('missing')).resolves.toBeNull();
    });

    it.each`
      query                                                      | found
      ${{ branchName: 'renovate/dep' }}                          | ${true}
      ${{ branchName: 'missing' }}                               | ${false}
      ${{ branchName: 'renovate/dep', prTitle: pr.displayName }} | ${true}
      ${{ branchName: 'renovate/dep', prTitle: 'wrong' }}        | ${false}
      ${{ branchName: 'renovate/dep', targetBranch: 'main' }}    | ${true}
      ${{ branchName: 'renovate/dep', targetBranch: 'other' }}   | ${false}
      ${{ branchName: 'renovate/dep', state: 'open' }}           | ${true}
      ${{ branchName: 'renovate/dep', state: 'closed' }}         | ${false}
      ${{ branchName: 'renovate/dep', state: '!open' }}          | ${false}
    `('finds PRs using $query', async ({ query, found }) => {
      const result = await oci.findPr(query);

      expect(result?.number ?? null).toBe(found ? number : null);
    });

    it('finds closed and merged PRs', async () => {
      api.list.mockResolvedValueOnce([{ ...pr, lifecycleDetails: 'CLOSED' }]);

      await expect(
        oci.findPr({ branchName: 'renovate/dep', state: '!open' }),
      ).resolves.toMatchObject({ number, state: 'closed' });
      await expect(
        oci.findPr({ branchName: 'renovate/dep', state: 'closed' }),
      ).resolves.toMatchObject({ number });
    });

    it('can refresh the PR cache', async () => {
      await oci.getPrList();
      api.list.mockResolvedValueOnce([]);

      await expect(
        oci.findPr({ branchName: 'renovate/dep', refreshCache: true }),
      ).resolves.toBeNull();
    });

    it('creates a PR and invalidates the cache', async () => {
      await oci.getPrList();

      await expect(
        oci.createPr({
          sourceBranch: 'renovate/dep',
          targetBranch: 'main',
          prTitle: 'Update dependency',
          prBody: 'PR body',
        }),
      ).resolves.toMatchObject({ number, state: 'open' });

      expect(api.post).toHaveBeenLastCalledWith('pullRequests', {
        repositoryId,
        displayName: 'Update dependency',
        description: 'PR body',
        sourceBranch: 'renovate/dep',
        destinationBranch: 'main',
      });
      api.list.mockResolvedValueOnce([]);
      await expect(oci.getPrList()).resolves.toEqual([]);
    });

    it('creates a PR before the list cache is loaded', async () => {
      await expect(
        oci.createPr({
          sourceBranch: 'renovate/dep',
          targetBranch: 'main',
          prTitle: 'Update',
          prBody: 'Body',
        }),
      ).resolves.toMatchObject({ number });
    });

    it('rejects drafts instead of silently publishing them', async () => {
      await expect(
        oci.createPr({
          sourceBranch: 'branch',
          targetBranch: 'main',
          prTitle: 'Draft',
          prBody: 'Body',
          draftPR: true,
        }),
      ).rejects.toThrow('does not support draft');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('updates PR metadata without changing state', async () => {
      await oci.updatePr({
        number,
        prTitle: 'New title',
        prBody: '',
        targetBranch: 'release',
      });

      expect(api.put).toHaveBeenLastCalledWith(prPath, {
        displayName: 'New title',
        description: '',
        destinationBranch: 'release',
      });
      expect(api.post).not.toHaveBeenCalled();
    });

    it.each`
      oldState    | newState    | action
      ${'OPEN'}   | ${'closed'} | ${'decline'}
      ${'CLOSED'} | ${'open'}   | ${'reopen'}
    `(
      'changes $oldState to $newState',
      async ({ oldState, newState, action }) => {
        api.get.mockResolvedValueOnce(
          response({ ...pr, lifecycleDetails: oldState }),
        );

        await oci.updatePr({ number, prTitle: 'Title', state: newState });

        expect(api.post).toHaveBeenLastCalledWith(
          `${prPath}/actions/${action}`,
        );
        expect(api.put).toHaveBeenLastCalledWith(prPath, {
          displayName: 'Title',
          description: undefined,
          destinationBranch: undefined,
        });
        const putOrder = api.put.mock.invocationCallOrder[0];
        const postOrder = api.post.mock.invocationCallOrder[0];
        expect(postOrder < putOrder).toBe(oldState === 'CLOSED');
      },
    );

    it('does not reopen an already open PR', async () => {
      await oci.updatePr({ number, prTitle: 'Title', state: 'open' });

      expect(api.post).not.toHaveBeenCalled();
    });

    it('does not update metadata when closing an already closed PR', async () => {
      api.get.mockResolvedValueOnce(
        response({ ...pr, lifecycleDetails: 'CLOSED' }),
      );

      await oci.updatePr({ number, prTitle: 'Title', state: 'closed' });

      expect(api.post).not.toHaveBeenCalled();
      expect(api.put).not.toHaveBeenCalled();
    });

    it('requires reopening a closed PR before editing metadata', async () => {
      api.get.mockResolvedValueOnce(
        response({ ...pr, lifecycleDetails: 'CLOSED' }),
      );

      await expect(oci.updatePr({ number, prTitle: 'Title' })).rejects.toThrow(
        'Reopen the OCI pull request',
      );

      expect(api.put).not.toHaveBeenCalled();
    });

    it('refreshes state after reopening succeeds but a metadata update fails', async () => {
      await oci.getPrList();
      api.get.mockResolvedValueOnce(
        response({ ...pr, lifecycleDetails: 'CLOSED' }),
      );
      api.put.mockRejectedValueOnce(new Error('connection lost'));

      await expect(
        oci.updatePr({ number, prTitle: 'Title', state: 'open' }),
      ).rejects.toThrow('connection lost');

      api.list.mockResolvedValueOnce([pr]);
      await expect(oci.getPrList()).resolves.toMatchObject([{ state: 'open' }]);
      await oci.updatePr({ number, prTitle: 'Title', state: 'open' });
      expect(api.post).toHaveBeenCalledExactlyOnceWith(
        `${prPath}/actions/reopen`,
      );
    });

    it('handles PR deletion during a state update', async () => {
      api.get.mockResolvedValueOnce(response({}, 404));

      await oci.updatePr({ number, prTitle: 'Title', state: 'closed' });

      expect(api.post).not.toHaveBeenCalled();
      expect(api.put).not.toHaveBeenCalled();
    });

    it('does not reopen merged PRs', async () => {
      api.get.mockResolvedValueOnce(
        response({ ...pr, lifecycleDetails: 'MERGED' }),
      );

      await expect(
        oci.updatePr({ number, prTitle: 'Title', state: 'open' }),
      ).rejects.toThrow('merged OCI pull request');
      expect(api.put).not.toHaveBeenCalled();
    });

    it('rejects updates of an unknown PR', async () => {
      await expect(
        oci.updatePr({ number: -1, prTitle: 'Title' }),
      ).rejects.toThrow('pull request not found');
    });

    it('preserves existing reviewers and deduplicates additions', async () => {
      api.get.mockResolvedValueOnce(
        response({
          ...pr,
          reviewers: [{ principalId: 'ocid1.user.existing' }],
        }),
      );

      await oci.addReviewers(number, [
        'ocid1.user.existing',
        'ocid1.user.new',
        'ocid1.user.new',
      ]);

      expect(api.put).toHaveBeenLastCalledWith(prPath, {
        reviewers: [
          { principalId: 'ocid1.user.existing' },
          { principalId: 'ocid1.user.new' },
        ],
      });
    });

    it('adds reviewers to an empty list', async () => {
      await oci.addReviewers(number, ['ocid1.user.new']);

      expect(api.put).toHaveBeenLastCalledWith(prPath, {
        reviewers: [{ principalId: 'ocid1.user.new' }],
      });
    });

    it('rejects reviewers for an unknown PR', async () => {
      await expect(oci.addReviewers(-1, ['ocid1.user.new'])).rejects.toThrow(
        'pull request not found',
      );
    });

    it('ignores empty reviewer lists', async () => {
      await oci.addReviewers(number, []);

      expect(api.put).not.toHaveBeenCalled();
    });

    it('explains that reviewer names and groups must be user OCIDs', async () => {
      await expect(oci.addReviewers(number, ['reviewer-name'])).rejects.toThrow(
        'OCI reviewers must be user OCIDs',
      );

      expect(api.put).not.toHaveBeenCalled();
    });

    it('skips the PR author and already assigned reviewers', async () => {
      await oci.addReviewers(number, [userId]);
      api.get.mockResolvedValueOnce(
        response({
          ...pr,
          reviewers: [{ principalId: 'ocid1.user.existing' }],
        }),
      );
      await oci.addReviewers(number, ['ocid1.user.existing']);

      expect(api.put).not.toHaveBeenCalled();
    });

    it('skips the PR author while adding another reviewer', async () => {
      await oci.addReviewers(number, [userId, 'ocid1.user.new']);

      expect(api.put).toHaveBeenCalledExactlyOnceWith(prPath, {
        reviewers: [{ principalId: 'ocid1.user.new' }],
      });
    });

    it('warns when unsupported labels are configured', async () => {
      await oci.createPr({
        sourceBranch: 'branch',
        targetBranch: 'main',
        prTitle: 'Title',
        prBody: 'Body',
        labels: ['dependencies'],
      });
      await oci.updatePr({
        number,
        prTitle: 'Title',
        labels: [],
        addLabels: ['other'],
        removeLabels: [],
      });

      expect(logger.once.warn).toHaveBeenCalledWith(
        expect.stringContaining('configured labels are ignored'),
      );
    });
  });

  describe('files', () => {
    it('reads a file through the object and content APIs', async () => {
      api.get.mockResolvedValueOnce(response({ type: 'BLOB', sha: 'abc' }));
      api.getText.mockResolvedValueOnce('contents');

      await expect(oci.getRawFile('dir/file name.json')).resolves.toBe(
        'contents',
      );
      expect(api.get).toHaveBeenLastCalledWith(
        `repositories/${repositoryId}/object?filePath=dir%2Ffile+name.json`,
        { throwHttpErrors: false, responseBecomesConfig: true },
      );
      expect(api.getText).toHaveBeenLastCalledWith(
        `repositories/${repositoryId}/objects/abc/content?filePath=dir%2Ffile+name.json`,
        { responseBecomesConfig: true },
      );
    });

    it('supports other repositories and branches/tags for presets', async () => {
      api.get.mockResolvedValueOnce(response({ type: 'BLOB', sha: 'abc' }));
      api.getText.mockResolvedValueOnce('{"enabled":true}');

      await expect(
        oci.getJsonFile('default.json', 'other', 'release/v1'),
      ).resolves.toEqual({ enabled: true });
      expect(api.get).toHaveBeenLastCalledWith(
        'repositories/other/object?filePath=default.json&refName=release%2Fv1',
        { throwHttpErrors: false, responseBecomesConfig: true },
      );
    });

    it.each`
      status | body
      ${404} | ${{}}
      ${400} | ${{ code: 'InvalidParameter', message: 'Invalid filePath:missing.json' }}
      ${200} | ${{ type: 'TREE' }}
    `(
      'returns null for a missing file or directory ($status)',
      async ({ status, body }) => {
        api.get.mockResolvedValueOnce(response(body, status));

        await expect(oci.getRawFile('missing.json')).resolves.toBeNull();
      },
    );

    it.each`
      status | body
      ${403} | ${{}}
      ${400} | ${{ code: 'InvalidParameter', message: 'Invalid refName' }}
      ${400} | ${{ code: 'Other', message: 'Invalid filePath:missing.json' }}
    `(
      'propagates other file errors ($status, $body)',
      async ({ status, body }) => {
        api.get.mockResolvedValueOnce(response(body, status));

        await expect(oci.getRawFile('missing.json')).rejects.toThrow(
          'OCI file lookup failed',
        );
      },
    );

    it('returns null JSON when a file is missing', async () => {
      api.get.mockResolvedValueOnce(response({}, 404));

      await expect(oci.getJsonFile('missing.json')).resolves.toBeNull();
    });
  });

  describe('comments', () => {
    const comment: OciComment = {
      id: 'comment-id',
      data: '### topic\n\nold',
      createdBy: { principalId: userId },
    };

    it('creates a comment without modifying another user’s comment', async () => {
      await oci.getPrList();
      api.list.mockResolvedValueOnce([
        { ...comment, createdBy: { principalId: 'someone-else' } },
      ]);

      await expect(
        oci.ensureComment({ number, topic: 'topic', content: 'new' }),
      ).resolves.toBeTrue();
      expect(api.post).toHaveBeenLastCalledWith(`${prPath}/comments`, {
        data: '### topic\n\nnew',
      });
    });

    it('updates its own topic comment', async () => {
      await oci.getPrList();
      api.list.mockResolvedValueOnce([comment]);

      await oci.ensureComment({ number, topic: 'topic', content: 'new' });

      expect(api.put).toHaveBeenLastCalledWith(
        `${prPath}/comments/comment-id`,
        { data: '### topic\n\nnew' },
      );
    });

    it('leaves identical comments unchanged', async () => {
      await oci.getPrList();
      api.list.mockResolvedValueOnce([comment]);

      await oci.ensureComment({ number, topic: 'topic', content: 'old' });

      expect(api.put).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('matches topicless comments by exact content', async () => {
      await oci.getPrList();
      api.list.mockResolvedValueOnce([
        { ...comment, data: 'content' },
        { ...comment, data: 'other' },
      ]);

      await oci.ensureComment({ number, topic: null, content: 'content' });

      expect(api.put).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('creates topicless comments when none match', async () => {
      await oci.getPrList();
      api.list.mockResolvedValueOnce([comment]);

      await oci.ensureComment({ number, topic: null, content: 'new' });

      expect(api.post).toHaveBeenLastCalledWith(`${prPath}/comments`, {
        data: 'new',
      });
    });

    it('leaves inline comments and replies alone, including its own', async () => {
      await oci.getPrList();
      const comments = [
        { ...comment, filePath: 'package.json' },
        { ...comment, parentId: 'discussion' },
      ];
      api.list.mockResolvedValueOnce(comments);

      await oci.ensureComment({ number, topic: 'topic', content: 'new' });

      expect(api.post).toHaveBeenLastCalledWith(`${prPath}/comments`, {
        data: '### topic\n\nnew',
      });
      expect(api.put).not.toHaveBeenCalled();
      api.list.mockResolvedValueOnce(comments);
      await oci.ensureCommentRemoval({
        type: 'by-topic',
        number,
        topic: 'topic',
      });
      expect(api.delete).not.toHaveBeenCalled();
    });

    it('uses the same sanitization when creating and removing comments', async () => {
      addSecretForSanitizing('test-comment-secret');
      await oci.getPrList();
      api.list.mockResolvedValueOnce([]);

      await oci.ensureComment({
        number,
        topic: 'test-comment-secret',
        content: 'test-comment-secret',
      });

      expect(api.post).toHaveBeenLastCalledWith(`${prPath}/comments`, {
        data: '### **redacted**\n\n**redacted**',
      });
      api.list.mockResolvedValueOnce([
        { ...comment, data: '### **redacted**\n\n**redacted**' },
      ]);
      await oci.ensureCommentRemoval({
        type: 'by-topic',
        number,
        topic: 'test-comment-secret',
      });
      api.list.mockResolvedValueOnce([{ ...comment, data: '**redacted**' }]);
      await oci.ensureCommentRemoval({
        type: 'by-content',
        number,
        content: 'test-comment-secret',
      });
      expect(api.delete).toHaveBeenCalledTimes(2);
    });

    it.each(['by-topic', 'by-content'] as const)(
      'removes only matching owned comments (%s)',
      async (type) => {
        await oci.getPrList();
        api.list.mockResolvedValueOnce([
          comment,
          { ...comment, id: 'foreign', createdBy: { principalId: 'other' } },
          { ...comment, id: 'unrelated', data: 'unrelated' },
        ]);

        await oci.ensureCommentRemoval({
          type,
          number,
          topic: 'topic',
          content: comment.data,
        });

        expect(api.delete).toHaveBeenCalledExactlyOnceWith(
          `${prPath}/comments/comment-id`,
        );
      },
    );
  });

  it('adapts Markdown and exposes its body limit', () => {
    expect(
      oci.massageMarkdown(
        '<details><summary>Release notes</summary>body</details>',
      ),
    ).toBe('**Release notes**body');
    expect(oci.maxBodyLength()).toBe(4000);
  });

  it('truncates before hashing and does not truncate a prepared body again', async () => {
    const body = oci.massageMarkdown('a'.repeat(5000));

    expect(body).toHaveLength(oci.maxBodyLength());
    expect(body).toContain('PR body was truncated');
    expect(oci.massageMarkdown(body)).toBe(body);

    await oci.createPr({
      sourceBranch: 'branch',
      targetBranch: 'main',
      prTitle: 'Title',
      prBody: body,
    });

    expect(api.post).toHaveBeenLastCalledWith(
      'pullRequests',
      expect.objectContaining({ description: body }),
    );
  });

  it('keeps truncated release notes free of details tags and stable across PR writes', async () => {
    const input = codeBlock`
      ### Release Notes

      <details>
      <summary>v2.0.0</summary>

      ${'Release notes. '.repeat(400)}

      </details>

      ---

      ### Configuration

      Please merge this manually once you are satisfied.
    `;

    const body = oci.massageMarkdown(input);

    expect(body.length).toBeLessThanOrEqual(oci.maxBodyLength());
    expect(body).toContain('**v2.0.0**');
    expect(body).toContain('PR body was truncated');
    expect(body).toContain('### Configuration');
    expect(body).toContain(
      'Please merge this manually once you are satisfied.',
    );
    expect(body).not.toContain('<details>');
    expect(body).not.toContain('</details>');
    expect(oci.massageMarkdown(body)).toBe(body);

    await oci.createPr({
      sourceBranch: 'renovate/dep',
      targetBranch: 'main',
      prTitle: 'Title',
      prBody: input,
    });
    await oci.updatePr({ number, prTitle: 'Title', prBody: body });

    expect(api.post).toHaveBeenLastCalledWith(
      'pullRequests',
      expect.objectContaining({ description: body }),
    );
    expect(api.put).toHaveBeenLastCalledWith(
      prPath,
      expect.objectContaining({ description: body }),
    );
  });

  it('fails closed for unsupported features', async () => {
    await expect(oci.mergePr({ id: number })).resolves.toBeFalse();
    await expect(oci.getBranchStatus('branch', true)).resolves.toBe('yellow');
    await expect(oci.getBranchStatusCheck('branch', 'ci')).resolves.toBeNull();
    await expect(
      oci.setBranchStatus({
        branchName: 'branch',
        context: 'ci',
        description: 'check',
        state: 'green',
      }),
    ).resolves.toBeUndefined();
    await expect(oci.addAssignees(number, ['user'])).resolves.toBeUndefined();
    await expect(oci.deleteLabel(number, 'label')).resolves.toBeUndefined();
    await expect(oci.getIssueList()).resolves.toEqual([]);
    await expect(oci.findIssue('Dashboard')).resolves.toBeNull();
    await expect(
      oci.ensureIssue({ title: 'Dashboard', body: 'body' }),
    ).resolves.toBeNull();
    await expect(oci.ensureIssueClosing('Dashboard')).resolves.toBeUndefined();
  });
});
