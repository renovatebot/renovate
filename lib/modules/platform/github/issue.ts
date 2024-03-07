import { DateTime } from 'luxon';
import { z } from 'zod';
import { getCache } from '../../../util/cache/repository';
import type { GithubIssue as Issue } from './types';

const GithubIssueBase = z.object({
  number: z.number(),
  state: z.string().transform((val) => val.toLowerCase()),
  title: z.string(),
  body: z.string(),
});

const GithubGraphqlIssue = GithubIssueBase.extend({
  updatedAt: z.string(),
}).transform((issue): Issue => {
  const lastModified = issue.updatedAt;
  const { number, state, title, body } = issue;
  return { number, state, title, body, lastModified };
});

const GithubRestIssue = GithubIssueBase.extend({
  updated_at: z.string(),
}).transform((issue): Issue => {
  const lastModified = issue.updated_at;
  const { number, state, title, body } = issue;
  return { number, state, title, body, lastModified };
});

export const GithubIssue = z.union([GithubGraphqlIssue, GithubRestIssue]);
export type GithubIssue = z.infer<typeof GithubIssue>;

type CacheData = Record<number, GithubIssue>;

export class GithubIssueCache {
  private static toReconcile: GithubIssue[] | null = null;

  private static reset(cacheData: CacheData): void {
    this.toReconcile = null;
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

    if (this.toReconcile) {
      cacheData = this.doReconcile(cacheData, this.toReconcile);
    }

    return cacheData;
  }

  static getIssues(): GithubIssue[] | null {
    const cacheData = this.data;
    if (!cacheData) {
      return null;
    }

    return Object.values(cacheData).sort(
      ({ lastModified: a }, { lastModified: b }) => {
        const x = DateTime.fromISO(a);
        const y = DateTime.fromISO(b);

        if (x > y) {
          return -1;
        }

        if (x < y) {
          return 1;
        }

        return 0;
      },
    );
  }

  static setIssues(issues: GithubIssue[]): void {
    const cacheData: CacheData = {};
    for (const issue of issues) {
      cacheData[issue.number] = issue;
    }
    this.reset(cacheData);
  }

  static addIssue(issue: GithubIssue): void {
    const cacheData = this.data;
    if (cacheData) {
      cacheData[issue.number] = issue;
    }
  }

  static reconcileIssues(issues: GithubIssue[]): void {
    this.toReconcile = issues;
  }

  private static doReconcile(
    cacheData: CacheData,
    issues: GithubIssue[],
  ): CacheData {
    let isReconciled = false;

    for (const issue of issues) {
      const cachedIssue = cacheData[issue.number];

      if (cachedIssue.lastModified === issue.lastModified) {
        isReconciled = true;
        break;
      }

      cacheData[issue.number] = issue;
    }

    if (issues.length === Object.keys(cacheData).length) {
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
