import type { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import type * as AzureApi from './azure-got-wrapper';
import type { AzurePr, AzurePrCacheData } from './types';
import { getRenovatePRFormat } from './util';

export class AzurePrCache {
  private items: AzurePr[] = [];
  private cache: AzurePrCacheData;

  private constructor(
    private repoId: string,
    private project: string,
  ) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.azure ??= {};

    let pullRequestCache = repoCache.platform.azure
      .pullRequestsCache as AzurePrCacheData;
    if (!pullRequestCache) {
      logger.debug('Initializing new PR cache at repository cache');
      pullRequestCache = {
        items: {},
        updated_at: null,
      };
    }
    repoCache.platform.azure.pullRequestsCache = pullRequestCache;
    this.cache = pullRequestCache;
    this.updateItems();
  }

  private static async init(
    repo: string,
    project: string,
    azureApi: any,
  ): Promise<AzurePrCache> {
    const res = new AzurePrCache(repo, project);
    const isSynced = memCache.get<true | undefined>('azure-pr-cache-synced');

    if (!isSynced) {
      await res.sync(azureApi);
      memCache.set('azure-pr-cache-synced', true);
    }

    return res;
  }

  private getPrs(): AzurePr[] {
    return this.items;
  }

  static async getPrs(
    repo: string,
    project: string,
    azureApi: any,
  ): Promise<AzurePr[]> {
    const prCache = await AzurePrCache.init(repo, project, azureApi);
    return prCache.getPrs();
  }

  private setPr(pr: AzurePr): void {
    logger.debug(`Adding PR #${pr.number} to the PR cache`);
    this.cache.items[pr.number] = pr;
    this.updateItems();
  }

  static async setPr(
    repo: string,
    project: string,
    azureApi: any,
    item: AzurePr,
  ): Promise<void> {
    const prCache = await AzurePrCache.init(repo, project, azureApi);
    prCache.setPr(item);
  }

  private reconcile(rawItems: GitPullRequest[]): boolean {
    const { items: oldItems } = this.cache;
    let { updated_at } = this.cache;

    let needNextPage = true;

    for (const rawItem of rawItems) {
      const id = rawItem.pullRequestId!;

      const oldItem = oldItems[id];
      const newItem = getRenovatePRFormat(rawItem);

      // Using current date because azure pullrequest responses do not return updated date
      const itemNewTime = DateTime.now().toUTC();

      if (dequal(oldItem, newItem)) {
        needNextPage = false;
        continue;
      }

      oldItems[id] = newItem;

      const cacheOldTime = updated_at ? DateTime.fromISO(updated_at) : null;
      if (!cacheOldTime || itemNewTime > cacheOldTime) {
        updated_at = itemNewTime.toISO();
      }
    }

    this.cache.updated_at = updated_at;
    return needNextPage;
  }

  private async sync(azureApi: typeof AzureApi): Promise<AzurePrCache> {
    logger.debug('Syncing PR list');
    const azureApiGit = await azureApi.gitApi();
    let fetchedPrs: GitPullRequest[];
    let skip = 0;
    do {
      fetchedPrs = await azureApiGit.getPullRequests(
        this.repoId,
        {
          status: 4,
          // fetch only prs directly created on the repo and not by forks
          sourceRepositoryId: this.project,
        },
        this.project,
        0,
        skip,
        100,
      );

      const needNextPage = this.reconcile(fetchedPrs);
      if (!needNextPage) {
        break;
      }
      skip += 100;
    } while (fetchedPrs.length > 0);

    this.updateItems();

    return this;
  }

  /**
   * Ensure the pr cache starts with the most recent PRs.
   * JavaScript ensures that the cache is sorted by PR number.
   */
  private updateItems(): void {
    this.items = Object.values(this.cache.items).reverse();
  }
}
