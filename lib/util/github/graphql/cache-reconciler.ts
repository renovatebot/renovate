import { DateTime } from 'luxon';
import type { GithubDatasourceItem } from './types';
import { isDateExpired } from './util';

export class GithubGraphqlCacheReconciler<
  GithubItem extends GithubDatasourceItem
> {
  static readonly stabilityDays = 7;

  private latestReleaseDate: DateTime | null = null;
  private readonly reconciledVersions = new Set<string>();

  constructor(
    private items: Record<string, GithubItem>,
    private readonly asOf: DateTime
  ) {}

  reconcilePage(items: GithubItem[]): boolean {
    let done = false;
    for (const item of items) {
      const { version, releaseTimestamp } = item;

      const oldItem = this.items[version];
      if (oldItem && this.stabilityPeriodExpired(oldItem)) {
        done = true;
      }

      this.items[version] = item;
      this.reconciledVersions.add(version);

      const releaseDate = DateTime.fromISO(releaseTimestamp);
      this.latestReleaseDate ??= releaseDate;
      if (releaseDate > this.latestReleaseDate) {
        this.latestReleaseDate = releaseDate;
      }
    }

    return done;
  }

  private stabilityPeriodExpired(item: GithubItem): boolean {
    return isDateExpired(this.asOf, item.releaseTimestamp, {
      days: GithubGraphqlCacheReconciler.stabilityDays,
    });
  }

  getItems(): Record<string, GithubItem> {
    const result: Record<string, GithubItem> = {};
    for (const [version, item] of Object.entries(this.items)) {
      if (
        this.stabilityPeriodExpired(item) ||
        this.reconciledVersions.has(version)
      ) {
        result[version] = item;
      }
    }
    return result;
  }
}
