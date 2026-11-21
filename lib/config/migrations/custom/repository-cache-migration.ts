import { isNullOrUndefined, isPlainObject, isString } from '@sindresorhus/is';
import type { RenovateOptions, RepositoryCacheConfig } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

/**
 * The flat repository cache options which moved into `repositoryCache`, with the field they moved to and the type they had.
 */
export const flatRepositoryCacheOptions: Record<
  string,
  { field: keyof RepositoryCacheConfig; type: RenovateOptions['type'] }
> = {
  httpCacheTtlDays: { field: 'maximumHttpDays', type: 'integer' },
  prCacheSyncMaxPages: { field: 'prSyncMaxPages', type: 'integer' },
  repositoryCacheForceLocal: { field: 'forceLocal', type: 'boolean' },
  repositoryCacheType: { field: 'type', type: 'string' },
};

export const repositoryCacheStates = ['disabled', 'enabled', 'reset'];

/**
 * Converts a `repositoryCache` value from before it was an object, where it was only the state.
 *
 * Returns `undefined` for a value which can't be converted, so it's left for validation to report.
 */
function toObject(value: unknown): Record<string, unknown> | undefined {
  if (isNullOrUndefined(value)) {
    return {};
  }
  if (isPlainObject(value)) {
    return { ...value };
  }
  if (isString(value) && repositoryCacheStates.includes(value)) {
    return { state: value };
  }
  return undefined;
}

export class RepositoryCacheMigration extends AbstractMigration {
  override readonly propertyName =
    // oxlint-disable-next-line renovate/require-regex-util -- must stay a native RegExp: MigrationsService matches propertyName via isRegExp(), which RE2 instances fail
    /^(?:httpCacheTtlDays|prCacheSyncMaxPages|repositoryCache(?:ForceLocal|Type)?)$/;

  override run(value: unknown, key: string): void {
    const repositoryCache = toObject(this.get('repositoryCache'));
    if (!repositoryCache) {
      return;
    }

    if (key !== 'repositoryCache') {
      repositoryCache[flatRepositoryCacheOptions[key].field] ??= value;
      this.delete(key);
    }
    this.setHard('repositoryCache', repositoryCache);
  }
}
