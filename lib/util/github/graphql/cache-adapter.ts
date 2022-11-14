import { DateTime, DurationLikeObject } from 'luxon';
import * as packageCache from '../../../util/cache/package';
import type { GithubDatasourceItem } from './types';

interface GithubGraphqlCacheData<GithubItem extends GithubDatasourceItem> {
  items: Record<string, GithubItem>;

  createdAt: string;

  refreshedAt: string;

  mostRecentlyReleasedAt?: string;
}

/**
 * Tells whether the time `duration` is expired starting
 * from the `date` (ISO date format) at the moment of `now`.
 */
function isExpired(
  now: DateTime,
  date: string,
  duration: DurationLikeObject
): boolean {
  const then = DateTime.fromISO(date);
  const expiry = then.plus(duration);
  return now >= expiry;
}

export class GithubGraphqlCacheAdapter<
  GithubItem extends GithubDatasourceItem
> {
  static readonly cacheTTLDays = 30;
  static readonly stabilityDays = 7;

  static readonly cacheNs = `github-graphql-cache-adapter`;

  static readonly resetDeltaMinutes = 10;

  static getRandomDeltaMinutes(): number {
    const rnd = Math.random();
    return Math.floor(rnd * GithubGraphqlCacheAdapter.resetDeltaMinutes);
  }

  static async init<T extends GithubDatasourceItem>(
    cacheKey: string | null
  ): Promise<GithubGraphqlCacheAdapter<T>> {
    const now = DateTime.now();

    let cacheData: GithubGraphqlCacheData<T> | undefined;
    if (cacheKey) {
      const storedCacheData = await packageCache.get<GithubGraphqlCacheData<T>>(
        GithubGraphqlCacheAdapter.cacheNs,
        cacheKey
      );

      if (
        storedCacheData &&
        !isExpired(now, storedCacheData.createdAt, {
          days: GithubGraphqlCacheAdapter.cacheTTLDays,
        })
      ) {
        cacheData = storedCacheData;
      }
    }

    if (!cacheData) {
      cacheData = {
        items: {},
        createdAt: now.toISO(),
        refreshedAt: now.toISO(),
      };
    }

    return new GithubGraphqlCacheAdapter(cacheKey, now, cacheData);
  }

  private latestReleaseDate: DateTime | null = null;

  private readonly checkedVersions = new Set<string>();

  private constructor(
    private readonly cacheKey: string | null,
    private readonly now: DateTime,
    private cacheData: GithubGraphqlCacheData<GithubItem>
  ) {
    if (cacheData.mostRecentlyReleasedAt) {
      this.latestReleaseDate = DateTime.fromISO(
        cacheData.mostRecentlyReleasedAt
      );
    }
  }

  reconcilePage(items: GithubItem[]): boolean {
    let done = false;
    for (const item of items) {
      const { version, releaseTimestamp } = item;

      const oldItem = this.cacheData.items[version];
      if (oldItem && this.stabilityPeriodExpired(oldItem)) {
        done = true;
      }

      this.cacheData.items[version] = item;
      this.checkedVersions.add(version);

      const releaseDate = DateTime.fromISO(releaseTimestamp);
      this.latestReleaseDate ??= releaseDate;
      if (releaseDate > this.latestReleaseDate) {
        this.latestReleaseDate = releaseDate;
      }
    }

    return done;
  }

  stabilityPeriodExpired(item: GithubItem): boolean {
    return isExpired(this.now, item.releaseTimestamp, {
      days: GithubGraphqlCacheAdapter.stabilityDays,
    });
  }

  removeDeletedVersions(): void {
    for (const [version, item] of Object.entries(this.cacheData.items)) {
      if (
        !this.stabilityPeriodExpired(item) &&
        !this.checkedVersions.has(version)
      ) {
        delete this.cacheData.items[version];
      }
    }
  }

  getItems(): GithubItem[] {
    return Object.values(this.cacheData.items);
  }

  async save(): Promise<void> {
    if (!this.cacheKey) {
      return;
    }

    const cacheCreatedAt = this.cacheData.createdAt;
    const expiry = DateTime.fromISO(cacheCreatedAt).plus(
      GithubGraphqlCacheAdapter.cacheTTLDays
    );
    const { minutes: ttlMinutes } = expiry
      .diff(this.now, ['minutes'])
      .toObject();
    if (ttlMinutes && ttlMinutes > 0) {
      const cacheValue: GithubGraphqlCacheData<GithubItem> = {
        ...this.cacheData,
        createdAt: cacheCreatedAt,
        refreshedAt: this.now.toISO(),
      };

      if (this.latestReleaseDate) {
        cacheValue.mostRecentlyReleasedAt = this.latestReleaseDate.toISO();
      }

      await packageCache.set(
        GithubGraphqlCacheAdapter.cacheNs,
        this.cacheKey,
        cacheValue,
        ttlMinutes
      );
    }
  }
}
