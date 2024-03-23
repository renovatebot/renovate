import { DateTime } from 'luxon';
import { z } from 'zod';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';

const GithubIssueBase = z.object({
  number: z.number(),
  state: z.string().transform((val) => val.toLowerCase()),
  title: z.string(),
  body: z.string(),
});

const GithubGraphqlIssue = GithubIssueBase.extend({
  updatedAt: z.string(),
}).transform((issue) => {
  const lastModified = issue.updatedAt;
  const { number, state, title, body } = issue;
  return { number, state, title, body, lastModified };
});

const GithubRestIssue = GithubIssueBase.extend({
  updated_at: z.string(),
}).transform((issue) => {
  const lastModified = issue.updated_at;
  const { number, state, title, body } = issue;
  return { number, state, title, body, lastModified };
});

export const GithubIssue = z.union([GithubGraphqlIssue, GithubRestIssue]);
export type GithubIssue = z.infer<typeof GithubIssue>;

type CacheData = Record<number, GithubIssue>;

export class GithubIssueCache {
  private static reset(cacheData: CacheData | null): void {
    memCache.set('github-issues-reconcile-queue', null);
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.github ??= {};
    if (cacheData) {
      repoCache.platform.github.issuesCache = cacheData;
    } else {
      delete repoCache.platform.github.issuesCache;
    }
  }

  private static get data(): CacheData | null {
    let cacheData: CacheData | undefined | null = getCache().platform?.github
      ?.issuesCache as CacheData | undefined;
    if (!cacheData) {
      return null;
    }

    cacheData = this.reconcile(cacheData);
    return cacheData;
  }

  static getIssues(): GithubIssue[] | null {
    const cacheData = this.data;
    if (!cacheData) {
      return null;
    }

    const sortedResult = Object.values(cacheData).sort(
      ({ lastModified: a }, { lastModified: b }) =>
        DateTime.fromISO(b).toMillis() - DateTime.fromISO(a).toMillis(),
    );

    return sortedResult;
  }

  static setIssues(issues: GithubIssue[]): void {
    const cacheData: CacheData = {};
    for (const issue of issues) {
      cacheData[issue.number] = issue;
    }
    this.reset(cacheData);
  }

  static updateIssue(issue: GithubIssue): void {
    const cacheData = this.data;
    if (cacheData) {
      cacheData[issue.number] = issue;
    }
  }

  /**
   * At the moment of repo initialization, repository cache is not available.
   * What we can do is to store issues for later reconciliation.
   */
  static addIssuesToReconcile(issues: GithubIssue[] | undefined): void {
    memCache.set('github-issues-reconcile-queue', issues);
  }

  private static reconcile(cacheData: CacheData): CacheData | null {
    const issuesToReconcile = memCache.get<GithubIssue[]>(
      'github-issues-reconcile-queue',
    );
    if (!issuesToReconcile) {
      return cacheData;
    }

    let isReconciled = false;

    for (const issue of issuesToReconcile) {
      const cachedIssue = cacheData[issue.number];

      // If we reached the item which is already in the cache,
      // it means sync is done.
      if (
        cachedIssue &&
        cachedIssue.number === issue.number &&
        cachedIssue.lastModified === issue.lastModified
      ) {
        isReconciled = true;
        break;
      }

      cacheData[issue.number] = issue;
    }

    // If we've just iterated over all the items in the cache,
    // it means sync is also done.
    if (issuesToReconcile.length >= Object.keys(cacheData).length) {
      isReconciled = true;
    }

    if (!isReconciled) {
      logger.debug('Issues cache: reset');
      this.reset(null);
      return null;
    }

    logger.debug('Issues cache: synced');
    this.reset(cacheData);
    return cacheData;
  }
}
