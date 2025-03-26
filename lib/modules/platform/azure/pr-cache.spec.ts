import type { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';
import type { Mocked } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { reset as memCacheReset } from '../../../util/cache/memory';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository';
import { AzurePrCache } from './pr-cache';
import { getRenovatePRFormat } from './util';

vi.mock('./azure-got-wrapper', () => mockDeep());

const pr1: GitPullRequest = {
  pullRequestId: 1,
  title: 'title',
  status: 1,
  sourceRefName: 'branch',
  targetRefName: 'master',
  reviewers: [],
  labels: [],
  description: 'a merge request',
};

const pr2: GitPullRequest = {
  pullRequestId: 2,
  title: 'title',
  status: 1,
  sourceRefName: 'branch',
  targetRefName: 'master',
  labels: [],
  description: 'a merge request',
};

describe('modules/platform/azure/pr-cache', () => {
  let azureApi: Mocked<typeof import('./azure-got-wrapper')>;
  let cache = getCache();

  beforeAll(() => {
    vi.useFakeTimers();
  });

  beforeEach(async () => {
    azureApi = await vi.importMock('./azure-got-wrapper');

    vi.setSystemTime(new Date('2025-01-30T10:50:00.000'));
    memCacheReset();
    repoCacheReset();
    cache = getCache();
  });

  it('fetches cache', async () => {
    azureApi.gitApi.mockImplementationOnce(
      () =>
        ({
          getPullRequests: vi.fn(() => [pr1]),
        }) as any,
    );

    const res = await AzurePrCache.getPrs('repo', 'project', azureApi);

    expect(res).toMatchObject([
      {
        number: 1,
        title: 'title',
      },
    ]);
    expect(cache).toEqual({
      platform: {
        azure: {
          pullRequestsCache: {
            items: {
              '1': getRenovatePRFormat(pr1),
            },
            updated_at: '2025-01-30T10:50:00.000Z',
          },
        },
      },
    });
  });

  it('syncs cache', async () => {
    cache.platform = {
      azure: {
        pullRequestsCache: {
          items: {
            '1': getRenovatePRFormat(pr1),
          },
          updated_at: '2023-01-01T00:00:00.000Z',
        },
      },
    };

    azureApi.gitApi.mockImplementationOnce(
      () =>
        ({
          getPullRequests: vi.fn(() => [pr2, pr1]),
        }) as any,
    );

    const res = await AzurePrCache.getPrs('repo', 'project', azureApi);

    expect(res).toMatchObject([
      { number: 2, title: 'title' },
      { number: 1, title: 'title' },
    ]);
    expect(cache).toEqual({
      platform: {
        azure: {
          pullRequestsCache: {
            items: {
              '1': getRenovatePRFormat(pr1),
              '2': getRenovatePRFormat(pr2),
            },
            updated_at: '2025-01-30T10:50:00.000Z',
          },
        },
      },
    });
  });
});
