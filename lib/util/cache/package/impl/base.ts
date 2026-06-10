import { DateTime } from 'luxon';
import { logger } from '../../../../logger/index.ts';
import type { MaybePromise } from '../../../../types/index.ts';
import { decodeEntry, isEnvelope } from '../codec.ts';
import type { LegacyEntry } from '../legacy.ts';
import { decodeLegacyEntry } from '../legacy.ts';
import type { PackageCacheNamespace } from '../types.ts';

export abstract class PackageCacheBase {
  async get<T = unknown>(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<T | undefined> {
    let raw: Buffer | undefined;
    try {
      raw = await this.readRaw(namespace, key);
    } catch (err) {
      logger.once.debug({ err }, 'Error while reading package cache value');
      return undefined;
    }

    if (!raw) {
      logger.trace({ namespace, key }, 'Cache miss');
      return undefined;
    }

    try {
      if (isEnvelope(raw)) {
        const entry = await decodeEntry(raw);
        logger.trace({ namespace, key }, 'Returning cached value');
        return entry.value as T;
      }

      const entry = await decodeLegacyEntry(raw);
      if (isExpiredLegacyEntry(entry)) {
        await this.removeInvalidEntry(namespace, key);
        return undefined;
      }

      logger.trace({ namespace, key }, 'Returning cached value');
      return entry.value as T;
    } catch (err) {
      logger.once.debug({ err }, 'Error while reading package cache value');
      await this.removeInvalidEntry(namespace, key);
      return undefined;
    }
  }

  abstract set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void>;

  abstract destroy(): Promise<void>;

  protected abstract readRaw(
    namespace: PackageCacheNamespace,
    key: string,
  ): MaybePromise<Buffer | undefined>;

  protected abstract rm(
    namespace: PackageCacheNamespace,
    key: string,
  ): MaybePromise<void>;

  private async removeInvalidEntry(
    namespace: PackageCacheNamespace,
    key: string,
  ): Promise<void> {
    try {
      await this.rm(namespace, key);
    } catch (err) {
      logger.once.debug({ err }, 'Error while removing package cache value');
    }
  }
}

function isExpiredLegacyEntry(entry: LegacyEntry): boolean {
  const { expiry } = entry;
  return (
    expiry !== undefined && (!expiry.isValid || DateTime.local() >= expiry)
  );
}
