import type { IGitApi } from 'azure-devops-node-api/GitApi';
import type { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { mockDeep } from 'vitest-mock-extended';
import { reset as memCacheReset } from '../../../util/cache/memory';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository';
import * as _azureApi from './azure-got-wrapper';
import { AzurePrCache } from './pr-cache';
import { getRenovatePRFormat } from './util';
import { partial } from '~test/util';

vi.mock('./azure-got-wrapper', () => mockDeep());
const azureApi = vi.mocked(_azureApi);

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
  let cache = getCache();

  beforeAll(() => {
    vi.useFakeTimers();
  });

  beforeEach(() => {
    vi.setSystemTime(new Date('2025-01-30T10:50:00.000'));
    memCacheReset();
    repoCacheReset();
    cache = getCache();
  });

  it('fetches cache', async () => {
    azureApi.gitApi.mockResolvedValue(
      partial<IGitApi>({
        getPullRequests: vi.fn().mockResolvedValue([pr1]),
      }),
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

    azureApi.gitApi.mockResolvedValue(
      partial<IGitApi>({
        getPullRequests: vi.fn().mockResolvedValue([pr2, pr1]),
      }),
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
