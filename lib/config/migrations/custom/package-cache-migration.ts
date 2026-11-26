import { isNullOrUndefined, isPlainObject } from '@sindresorhus/is';
import type { PackageCacheConfig, RenovateOptions } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

/**
 * The flat package cache options which moved into `packageCache`, with the field they moved to and the type they had.
 */
export const flatPackageCacheOptions: Record<
  string,
  { field: keyof PackageCacheConfig; type: RenovateOptions['type'] }
> = {
  cacheHardTtlMinutes: { field: 'hardTtlMinutes', type: 'integer' },
  cachePrivatePackages: { field: 'privatePackages', type: 'boolean' },
  cacheTtlOverride: { field: 'ttlOverride', type: 'object' },
  presetCachePersistence: { field: 'presetPersistence', type: 'boolean' },
  redisPrefix: { field: 'redisPrefix', type: 'string' },
  redisUrl: { field: 'redisUrl', type: 'string' },
};

export class PackageCacheMigration extends AbstractMigration {
  override readonly propertyName =
    // oxlint-disable-next-line renovate/require-regex-util -- must stay a native RegExp: MigrationsService matches propertyName via isRegExp(), which RE2 instances fail
    /^(?:packageCache|cacheHardTtlMinutes|cachePrivatePackages|cacheTtlOverride|presetCachePersistence|redisPrefix|redisUrl)$/;

  override run(value: unknown, key: string): void {
    const existing = this.get('packageCache');
    // an invalid `packageCache` is left for validation to report
    if (!isNullOrUndefined(existing) && !isPlainObject(existing)) {
      return;
    }
    const packageCache: Record<string, unknown> = { ...existing };

    if (key !== 'packageCache') {
      packageCache[flatPackageCacheOptions[key].field] ??= value;
      this.delete(key);
    }
    this.setHard('packageCache', packageCache);
  }
}
