import is from '@sindresorhus/is';
import { PlatformId } from '../../../constants';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getCache } from '../../../util/cache/repository';
import type { GithubHttp, GithubHttpOptions } from '../../../util/http/github';
import { parseLinkHeader } from '../../../util/url';
import type { Pr } from '../types';
import { ApiCache } from './api-cache';
import { coerceRestPr } from './common';
import type { ApiPageCache, GhRestPr } from './types';

function removeUrlFields(input: unknown): void {
  if (is.plainObject(input)) {
    for (const [key, val] of Object.entries(input)) {
      if ((key === 'url' || key.endsWith('_url')) && is.string(val)) {
        delete input[key];
      } else {
        removeUrlFields(val);
      }
    }
  }
}

function massageGhRestPr(ghPr: GhRestPr): GhRestPr {
  removeUrlFields(ghPr);
  delete ghPr?.head?.repo?.pushed_at;
  delete ghPr?.base?.repo?.pushed_at;
  delete ghPr?._links;
  return ghPr;
}

function getPrApiCache(): ApiCache<GhRestPr> {
  const repoCache = getCache();
  repoCache.platform ??= {};
  repoCache.platform.github ??= {};
  repoCache.platform.github.prCache ??= { items: {} };
  const apiPageCache = repoCache.platform.github
    .prCache as ApiPageCache<GhRestPr>;

  const items = Object.values(apiPageCache.items);
  if (items?.[0]?._links) {
    for (const ghPr of items) {
      massageGhRestPr(ghPr);
    }
  }

  const prCache = new ApiCache(apiPageCache);
  return prCache;
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
 *      until `ApiCache.coerce` function indicates that
 *      no more fresh items can be found in the next page.
 *
 *      We expect to fetch just one page per run in average,
 *      since it's rare to have more than 100 updated PRs.
 */
export async function getPrCache(
  http: GithubHttp,
  repo: string,
  username: string | null
): Promise<Record<number, Pr>> {
  const prCache: Record<number, Pr> = {};
  const prApiCache = getPrApiCache();

  try {
    let requestsTotal = 0;
    let apiQuotaAffected = false;
    let needNextPageFetch = true;
    let needNextPageSync = true;

    let pageIdx = 1;
    while (needNextPageFetch && needNextPageSync) {
      const urlPath = `repos/${repo}/pulls?per_page=20&state=all&sort=updated&direction=desc&page=${pageIdx}`;

      const opts: GithubHttpOptions = { paginate: false };
      if (pageIdx === 1) {
        if (is.emptyArray(prApiCache.getItems())) {
          // Speed up initial fetch
          opts.paginate = true;
        }
      }

      const res = await http.getJson<GhRestPr[]>(urlPath, opts);
      apiQuotaAffected = true;
      requestsTotal += 1;

      const {
        headers: { link: linkHeader },
      } = res;

      let { body: page } = res;

      if (username) {
        page = page.filter(
          (ghPr) =>
            ghPr?.user?.login &&
            (ghPr.user.login === username || ghPr.user.login.endsWith('[bot]'))
        );
      }

      for (const ghPr of page) {
        massageGhRestPr(ghPr);
      }

      needNextPageSync = prApiCache.reconcile(page);
      needNextPageFetch = !!parseLinkHeader(linkHeader)?.next;

      if (pageIdx === 1) {
        needNextPageFetch &&= !opts.paginate;
      }

      pageIdx += 1;
    }

    logger.debug(
      {
        pullsTotal: prApiCache.getItems().length,
        requestsTotal,
        apiQuotaAffected,
      },
      `getPrList success`
    );
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'getPrList err');
    throw new ExternalHostError(err, PlatformId.Github);
  }

  for (const ghPr of prApiCache.getItems()) {
    const pr = coerceRestPr(ghPr);
    if (pr) {
      prCache[ghPr.number] = pr;
    }
  }

  return prCache;
}
