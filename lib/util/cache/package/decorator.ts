import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { acquireLock } from '../../mutex';
import type { DecoratorCachedRecord, PackageCacheNamespace } from './types';
import * as packageCache from '.';

type Method<This, Args extends any[], Return extends PromiseLike<unknown>> = (
  this: This,
  ...args: Args
) => Return;

type Context<
  This,
  Args extends any[],
  Return extends PromiseLike<unknown>,
> = ClassMethodDecoratorContext<This, Method<This, Args, Return>>;

type BooleanFunction<Args extends any[]> = (...args: Args) => boolean;
type StringFunction<Args extends any[]> = (...args: Args) => string;
type NamespaceStringFunction<Args extends any[]> = (
  ...args: Args
) => PackageCacheNamespace;

/**
 * The cache decorator parameters.
 */
export interface CacheParameters<Args extends any[]> {
  /**
   * The cache namespace
   * Either a string or a hash function that generates a string
   */
  namespace: PackageCacheNamespace | NamespaceStringFunction<Args>;

  /**
   * The cache key
   * Either a string or a hash function that generates a string
   */
  key: string | StringFunction<Args>;

  /**
   * A function that returns true if a result is cacheable
   * Used to prevent caching of private, sensitive, results
   */
  cacheable?: BooleanFunction<Args>;

  /**
   * The TTL (or expiry) of the key in minutes
   */
  ttlMinutes?: number;
}

export function cache<
  This,
  Args extends any[],
  Return extends PromiseLike<unknown>,
>({
  namespace,
  key,
  cacheable = () => true,
  ttlMinutes = 30,
}: CacheParameters<Args>) {
  return function decorator(
    target: Method<This, Args, Return>,
    context: Context<This, Args, Return>,
  ) {
    return function decorated(this: This, ...args: Args) {
      const callback = target;
      const methodName = context.name;

      const res = executeDecorator(
        this,
        args,
        cacheable,
        callback,
        namespace,
        key,
        ttlMinutes,
        methodName,
      );

      return res as unknown as Return;
    };
  };
}

async function executeDecorator<
  This,
  Args extends any[],
  Return extends PromiseLike<unknown>,
>(
  instance: This,
  args: Args,
  cacheable: (...args: Args) => boolean,
  callback: Method<This, Args, Return>,
  namespace: CacheParameters<Args>['namespace'],
  key: CacheParameters<Args>['key'],
  ttlMinutes: number,
  methodName: string | symbol,
): Promise<unknown> {
  const cachePrivatePackages = GlobalConfig.get('cachePrivatePackages', false);
  const isCacheable = cachePrivatePackages || cacheable.apply(instance, args);
  if (!isCacheable) {
    return await callback.apply<This, Args, Return>(instance, args);
  }

  let finalNamespace: PackageCacheNamespace | undefined;
  if (is.string(namespace)) {
    finalNamespace = namespace;
  } else if (is.function_(namespace)) {
    finalNamespace = namespace.apply(instance, args);
  }

  let finalKey: string | undefined;
  if (is.string(key)) {
    finalKey = key;
  } else if (is.function_(key)) {
    finalKey = key.apply(instance, args);
  }

  // istanbul ignore if
  if (!finalNamespace || !finalKey) {
    return await callback.apply<This, Args, Return>(instance, args);
  }

  finalKey = `cache-decorator:${finalKey}`;

  const releaseLock = await acquireLock(finalKey, finalNamespace);

  try {
    const oldRecord = await packageCache.get<DecoratorCachedRecord>(
      finalNamespace,
      finalKey,
    );

    const ttlOverride = getTtlOverride(finalNamespace);
    const softTtl = ttlOverride ?? ttlMinutes;

    const cacheHardTtlMinutes = GlobalConfig.get(
      'cacheHardTtlMinutes',
      7 * 24 * 60,
    );
    let hardTtl = softTtl;
    if (methodName === 'getReleases' || methodName === 'getDigest') {
      hardTtl = Math.max(softTtl, cacheHardTtlMinutes);
    }

    let oldData: unknown;
    if (oldRecord) {
      const now = DateTime.local();
      const cachedAt = DateTime.fromISO(oldRecord.cachedAt);

      const softDeadline = cachedAt.plus({ minutes: softTtl });
      if (now < softDeadline) {
        return oldRecord.value;
      }

      const hardDeadline = cachedAt.plus({ minutes: hardTtl });
      if (now < hardDeadline) {
        oldData = oldRecord.value;
      }
    }

    let newData: unknown;
    if (oldData) {
      try {
        // newData = (await callback()) as T | undefined;
        newData = await callback.apply<This, Args, Return>(instance, args);
      } catch (err) {
        logger.debug(
          { err },
          'Package cache decorator: callback error, returning old data',
        );
        return oldData;
      }
    } else {
      newData = await callback.apply<This, Args, Return>(instance, args);
    }

    if (!is.undefined(newData)) {
      const newRecord: DecoratorCachedRecord = {
        cachedAt: DateTime.local().toISO(),
        value: newData,
      };
      await packageCache.set(finalNamespace, finalKey, newRecord, hardTtl);
    }

    return newData;
  } finally {
    releaseLock();
  }
}

export function getTtlOverride(namespace: string): number | undefined {
  const ttl: unknown = GlobalConfig.get('cacheTtlOverride', {})[namespace];
  if (is.number(ttl)) {
    return ttl;
  }
  return undefined;
}
