import { setTimeout } from 'node:timers/promises';
import { isEmptyArray, isNonEmptyArray } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global.ts';
import { PLATFORM_RATE_LIMIT_EXCEEDED } from '../../../constants/error-messages.ts';
import { instrument } from '../../../instrumentation/index.ts';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider.ts';
import type {
  GithubHttp,
  GithubHttpOptions,
} from '../../../util/http/github.ts';
import { parseLinkHeader } from '../../../util/url.ts';
import { ApiCache } from './api-cache.ts';
import { coerceRestPr, mapMergeStartegy } from './common.ts';
import {
  prIsInMergeQueueQuery,
  prViewerCanMergeAsAdminQuery,
} from './graphql.ts';
import { MergeAsyncResult } from './schema.ts';
import type {
  ApiPageCache,
  AsyncMergeParams,
  GhPr,
  GhRestPr,
} from './types.ts';

function getPrApiCache(): ApiCache<GhPr> {
  const repoCache = getCache();
  if (!repoCache?.platform?.github?.pullRequestsCache) {
    logger.debug('PR cache: cached data not found, creating new cache');
    repoCache.platform ??= {};
    repoCache.platform.github ??= {};
    repoCache.platform.github.pullRequestsCache ??= { items: {} };
  }

  const prApiCache = new ApiCache<GhPr>(
    repoCache.platform.github.pullRequestsCache as ApiPageCache<GhPr>,
  );
  return prApiCache;
}

/**
 *  Fetch and return Pull Requests from GitHub repository:
 *
 *   1. Synchronize long-term cache.
 *
 *   2. Store items in raw format, i.e. exactly what
 *      has been returned by GitHub REST API.
 *
 *   3. Convert items to the Renovate format and return.
 *
 * In order synchronize ApiCache properly, we handle 3 cases:
 *
 *   a. We never fetched PR list for this repo before.
 *      If cached PR list is empty, we assume it's the case.
 *
 *      In this case, we're falling back to quick fetch via
 *      `paginate=true` option (see `util/http/github.ts`).
 *
 *   b. Some of PRs had changed since last run.
 *
 *      In this case, we sequentially fetch page by page
 *      until the oldest item on an unfiltered page predates
 *      the cache's `lastModified` timestamp.
 *
 *      We expect to fetch just one page per run in average,
 *      since it's rare to have more than 100 updated PRs.
 */
export async function getPrCache(
  http: GithubHttp,
  repo: string,
  username?: string,
): Promise<Record<number, GhPr>> {
  const prApiCache = getPrApiCache();
  const isInitial = isEmptyArray(prApiCache.getItems());

  // Snapshot before the loop — reconcile() updates lastModified as it
  // processes items, so reading it inside the loop would create a moving target.
  // If lastModified is missing but items exist (populated via updateItem()),
  // derive cutoff from the newest cached item.
  let lastModifiedRaw = prApiCache.getLastModified();
  if (!lastModifiedRaw && !isInitial) {
    const items = prApiCache.getItems();
    for (const item of items) {
      if (!lastModifiedRaw || item.updated_at > lastModifiedRaw) {
        lastModifiedRaw = item.updated_at;
      }
    }
  }
  const cutoffTime = lastModifiedRaw ? DateTime.fromISO(lastModifiedRaw) : null;

  try {
    const maxSyncPages = GlobalConfig.get('prCacheSyncMaxPages');
    const startTime = Date.now();
    let requestsTotal = 0;
    let apiQuotaAffected = false;
    let needNextPageFetch = true;
    let needNextPageSync = true;

    let pageIdx = 1;

    await instrument('sync GitHub PR cache', async () => {
      while (needNextPageFetch && needNextPageSync) {
        const opts: GithubHttpOptions = { paginate: false, memCache: false };
        if (pageIdx === 1) {
          opts.cacheProvider = repoCacheProvider;
          if (isInitial) {
            opts.paginate = true;
          }
        }

        let perPage: number;
        if (isInitial) {
          logger.debug('PR cache: initial fetch');
          perPage = 100;
        } else {
          logger.debug('PR cache: sync fetch');
          perPage = 20;
        }

        const urlPath = `repos/${repo}/pulls?per_page=${perPage}&state=all&sort=updated&direction=desc&page=${pageIdx}`;

        const res = await http.getJsonUnchecked<GhRestPr[]>(urlPath, opts);
        apiQuotaAffected = true;
        requestsTotal += 1;

        const {
          headers: { link: linkHeader },
        } = res;

        let { body: page } = res;

        if (!isInitial && cutoffTime && isNonEmptyArray(page)) {
          // Advance watermark so next run doesn't re-scan these pages,
          // even if no Renovate PRs are found.
          prApiCache.updateLastModified(page[0].updated_at);

          const oldestOnPage = DateTime.fromISO(page.at(-1)!.updated_at);
          if (oldestOnPage < cutoffTime) {
            needNextPageSync = false;
          }
        }

        if (username) {
          const filteredPage = page.filter(
            (ghPr) => ghPr?.user?.login && ghPr.user.login === username,
          );

          logger.debug(
            `PR cache: Filtered ${page.length} PRs to ${filteredPage.length} (user=${username})`,
          );

          page = filteredPage;
        }

        const items = page.map(coerceRestPr);

        if (isNonEmptyArray(items)) {
          prApiCache.reconcile(items);
        }

        needNextPageFetch = !!parseLinkHeader(linkHeader)?.next;

        if (pageIdx === 1) {
          needNextPageFetch &&= !opts.paginate;
        }

        // Safety net: cutoff-based stop should always fire first
        if (
          !isInitial &&
          needNextPageFetch &&
          needNextPageSync &&
          pageIdx >= maxSyncPages
        ) {
          logger.warn(
            { repo, pages: pageIdx },
            'PR cache: hit max sync pages, stopping',
          );
          needNextPageSync = false;
        }

        pageIdx += 1;
      }
    });

    const durationMs = Math.round(Date.now() - startTime);
    logger.debug(
      {
        pullsTotal: prApiCache.getItems().length,
        requestsTotal,
        apiQuotaAffected,
        durationMs,
      },
      `PR cache: getPrList success`,
    );
  } catch (err) /* v8 ignore next -- PR cache sync failures are wrapped as ExternalHostError, not simulated in specs */ {
    logger.debug({ err }, 'PR cache: getPrList err');
    throw new ExternalHostError(err, 'github');
  }

  return prApiCache.getItems();
}

export function updatePrCache(pr: GhPr): void {
  const cache = getPrApiCache();
  cache.updateItem(pr);
}

/**
 * Check whether the PR is currently in the merge queue.
 * Fails open: errors are logged at debug level and treated as "not queued".
 */
export async function isPrInMergeQueue(
  http: GithubHttp,
  owner: string,
  name: string,
  prNo: number,
): Promise<boolean> {
  try {
    const res = await http.requestGraphql<{
      repository: {
        pullRequest: { isInMergeQueue: boolean } | null;
      };
    }>(prIsInMergeQueueQuery, {
      variables: { owner, name, number: prNo },
      readOnly: true,
      count: 1, // bypass graphql check
    });
    if (res?.errors) {
      logger.debug(
        { prNo, errors: res.errors },
        'Failed to fetch PR merge queue status',
      );
      return false;
    }
    return res?.data?.repository?.pullRequest?.isInMergeQueue === true;
  } catch (err) {
    if (err instanceof Error && err.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
      throw err;
    }
    logger.debug({ prNo, err }, 'Error fetching PR merge queue status');
    return false;
  }
}

// GitHub completes async merges in the background, usually within a few
// seconds
const asyncMergePollIntervalMs = 1000;
const asyncMergePollTimeoutMs = 10_000;

interface AsyncMergeRequest {
  merge_action: 'direct_merge' | 'merge_queue';
  merge_method?: string;
  bypass_rules?: boolean;
}

/**
 * Merges the PR through the async merge API and polls the result. Returns
 * `'unsupported'` if the GitHub Enterprise Server lacks the async merge API.
 */
export async function asyncMergePr(
  http: GithubHttp,
  params: AsyncMergeParams,
): Promise<boolean | 'unsupported'> {
  const { prNo, token } = params;
  const request = await chooseAsyncMergeRequest(http, params);
  const url = `repos/${params.repository}/pulls/${prNo}/merge-async`;
  const options: GithubHttpOptions = { body: request, token };
  logger.debug({ url, request }, 'mergePr');
  let result: MergeAsyncResult | null;
  try {
    result = (await http.putJson(url, options, MergeAsyncResult)).body;
  } catch (err) {
    if (
      err instanceof ExternalHostError ||
      err.message === PLATFORM_RATE_LIMIT_EXCEEDED
    ) {
      throw err;
    }
    const parsed = MergeAsyncResult.safeParse(err.response?.body);
    const pendingUuid = parsed.data?.details.uuid;
    if (err.statusCode === 409 && pendingUuid) {
      logger.debug(`An earlier merge request for PR #${prNo} is still pending`);
      result = await pollAsyncMerge(http, url, pendingUuid, token);
      return resolveAsyncMerge(params, result);
    }
    if (err.statusCode === 400) {
      logger.debug(
        `GitHub refused the merge request for PR #${prNo}: ${err.response?.body?.message}`,
      );
      return false;
    }
    if (err.statusCode === 404 && params.isGhes) {
      logger.debug(
        'Async merge API not available on this GitHub host, falling back to the merge endpoint',
      );
      return 'unsupported';
    }
    logger.warn({ err }, 'Failed to merge PR');
    return false;
  }
  const uuid = result.details.uuid;
  if (result.status === 'pending' && uuid) {
    result = await pollAsyncMerge(http, url, uuid, token);
  }
  return resolveAsyncMerge(params, result);
}

/**
 * Merges directly, bypassing the branch rules the token may bypass like the
 * classic merge endpoint unless `bypassRules` is false. On a branch with a
 * merge queue, the PR is added to the merge queue unless the token may and
 * should bypass it. The merge queue merges with its own configured merge
 * method.
 */
async function chooseAsyncMergeRequest(
  http: GithubHttp,
  params: AsyncMergeParams,
): Promise<AsyncMergeRequest> {
  // Without bypassing rules the merge queue applies
  if (params.queueEnabled && !params.bypassRules) {
    return { merge_action: 'merge_queue' };
  }
  if (params.queueEnabled) {
    // viewerCanMergeAsAdmin was verified for user tokens, but not for GitHub
    // App installation tokens
    const canBypass = await canMergeAsAdmin(http, params);
    if (!canBypass) {
      return { merge_action: 'merge_queue' };
    }
  }
  return {
    merge_action: 'direct_merge',
    merge_method: mapMergeStartegy(params.strategy) ?? params.mergeMethod,
    bypass_rules: params.bypassRules,
  };
}

/**
 * Returns whether the token that sends the merge request may bypass the
 * branch rules, including the merge queue, to merge the PR.
 */
async function canMergeAsAdmin(
  http: GithubHttp,
  { owner, name, prNo, token }: AsyncMergeParams,
): Promise<boolean> {
  try {
    const res = await http.requestGraphql<{
      repository: {
        pullRequest: { viewerCanMergeAsAdmin: boolean } | null;
      };
    }>(prViewerCanMergeAsAdminQuery, {
      variables: { owner, name, number: prNo },
      token,
      count: 1, // bypass graphql check
    });
    if (res?.errors) {
      logger.debug(
        { prNo, errors: res.errors },
        'Failed to fetch whether the PR may be merged as admin',
      );
      return false;
    }
    return res?.data?.repository?.pullRequest?.viewerCanMergeAsAdmin === true;
  } catch (err) {
    if (err instanceof Error && err.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
      throw err;
    }
    logger.debug(
      { prNo, err },
      'Error fetching whether the PR may be merged as admin',
    );
    return false;
  }
}

/**
 * Polls the result of the async merge request until it is no longer pending
 * or the timeout is reached. Returns null if the result cannot be fetched.
 */
async function pollAsyncMerge(
  http: GithubHttp,
  url: string,
  uuid: string,
  token?: string,
): Promise<MergeAsyncResult | null> {
  const options: GithubHttpOptions = { memCache: false, token };
  let result: MergeAsyncResult | null = null;
  for (
    let waited = 0;
    waited < asyncMergePollTimeoutMs;
    waited += asyncMergePollIntervalMs
  ) {
    await setTimeout(asyncMergePollIntervalMs);
    try {
      result = (await http.getJson(`${url}/${uuid}`, options, MergeAsyncResult))
        .body;
    } catch (err) {
      if (
        err instanceof ExternalHostError ||
        err.message === PLATFORM_RATE_LIMIT_EXCEEDED
      ) {
        throw err;
      }
      logger.warn({ err }, 'Failed to fetch the async merge result');
      return null;
    }
    if (result.status !== 'pending') {
      return result;
    }
  }
  return result;
}

function resolveAsyncMerge(
  { prNo, cacheMergedPr }: AsyncMergeParams,
  result: MergeAsyncResult | null,
): boolean {
  switch (result?.status) {
    case 'merged': {
      logger.debug(`PR #${prNo} merged`);
      cacheMergedPr(prNo);
      return true;
    }
    case 'enqueued':
      logger.debug(`PR #${prNo} added to the merge queue`);
      return true;
    case 'failed':
      logger.info(
        `GitHub refused to merge PR #${prNo}: ${result.details.message}`,
      );
      return false;
    case 'pending':
      logger.debug(
        `GitHub has not merged PR #${prNo} within ${asyncMergePollTimeoutMs / 1000} s, the next run picks up the result`,
      );
      return false;
    case 'unknown':
      logger.debug(`GitHub returned an unknown merge status for PR #${prNo}`);
      return false;
    default:
      // The result could not be fetched, which has been logged
      return false;
  }
}
