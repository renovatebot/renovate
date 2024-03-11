import { DateTime } from 'luxon';
import { z } from 'zod';
import { getCache } from '../../../util/cache/repository';

const GithubIssueBase = z.object({
  number: z.number(),
  state: z.string().transform((val) => val.toLowerCase()),
  title: z.string(),
  body: z.string(),
});

export interface GithubIssue {
  body: string;
  number: number;
  state: string;
  title: string;
  lastModified: string;
}

const GithubGraphqlIssue = GithubIssueBase.extend({
  updatedAt: z.string(),
}).transform((issue): GithubIssue => {
  const lastModified = issue.updatedAt;
  const { number, state, title, body } = issue;
  return { number, state, title, body, lastModified };
});

const GithubRestIssue = GithubIssueBase.extend({
  updated_at: z.string(),
}).transform((issue): GithubIssue => {
  const lastModified = issue.updated_at;
  const { number, state, title, body } = issue;
  return { number, state, title, body, lastModified };
});

export const GithubIssue = z.union([GithubGraphqlIssue, GithubRestIssue]);

type CacheData = Record<number, GithubIssue>;

export class GithubIssueCache {
  private static reset(cacheData: CacheData): void {
    this.issuesToReconcile = null;
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.github ??= {};
    repoCache.platform.github.issuesCache = cacheData;
  }

  private static get data(): CacheData | undefined {
    let cacheData = getCache().platform?.github?.issuesCache as
      | CacheData
      | undefined;
    if (!cacheData) {
      return undefined;
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

  private static issuesToReconcile: GithubIssue[] | null = null;

  /**
   * At the moment of repo initialization, repository cache is not available.
   * What we can do is to store issues for later reconciliation.
   */
  static addIssuesToReconcile(issues: GithubIssue[]): void {
    this.issuesToReconcile = issues;
  }

  private static reconcile(cacheData: CacheData): CacheData {
    if (!this.issuesToReconcile) {
      return cacheData;
    }

    let isReconciled = false;

    for (const issue of this.issuesToReconcile) {
      const cachedIssue = cacheData[issue.number];

      // If we reached the the item which is already in the cache,
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
    if (this.issuesToReconcile.length >= Object.keys(cacheData).length) {
      isReconciled = true;
    }

    if (!isReconciled) {
      const emptyCacheData: CacheData = {};
      this.reset(emptyCacheData);
      return emptyCacheData;
    }

    this.reset(cacheData);
    return cacheData;
  }
}
