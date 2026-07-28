import { DateTime } from 'luxon';
import { logger } from '../../../../logger/index.ts';
import type { MaybePromise } from '../../../../types/index.ts';
import { decodeEntry, encodeEntry, isEnvelope } from '../codec.ts';
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

      // TODO: Delete this legacy cache fallback once pre-envelope entries have
      // expired.
      const entry = await decodeLegacyEntry(raw);
      if (isExpiredLegacyEntry(entry)) {
        await this.removeInvalidEntry(namespace, key);
        return undefined;
      }

      await this.upgradeLegacyEntry(namespace, key, entry);

      logger.trace({ namespace, key }, 'Returning cached value');
      return entry.value as T;
    } catch (err) {
      logger.once.debug({ err }, 'Error while reading package cache value');
      await this.removeInvalidEntry(namespace, key);
      return undefined;
    }
  }

  async set(
    namespace: PackageCacheNamespace,
    key: string,
    value: unknown,
    hardTtlMinutes: number,
  ): Promise<void> {
    logger.trace({ namespace, key, hardTtlMinutes }, 'Saving cached value');

    const ttlSeconds = Math.floor(hardTtlMinutes * 60);

    try {
      if (ttlSeconds <= 0) {
        await this.rm(namespace, key);
        return;
      }

      await this.writeRaw(
        namespace,
        key,
        await encodeEntry(value, DateTime.local()),
        ttlSeconds,
      );
    } catch (err) {
      logger.once.warn({ err }, 'Error while setting package cache value');
    }
  }

  abstract destroy(): Promise<void>;

  protected abstract readRaw(
    namespace: PackageCacheNamespace,
    key: string,
  ): MaybePromise<Buffer | undefined>;

  protected abstract writeRaw(
    namespace: PackageCacheNamespace,
    key: string,
    data: Buffer,
    ttlSeconds: number,
  ): MaybePromise<void>;

  protected abstract rm(
    namespace: PackageCacheNamespace,
    key: string,
  ): MaybePromise<void>;

  // The file backend's cleanup can't read a legacy entry's in-payload expiry, so
  // it overrides this to rewrite the entry as an envelope on read and avoid
  // purging it. Best-effort: overrides must not throw or change the read result.
  // TODO: Delete with the legacy decoder once pre-envelope entries have expired.
  protected upgradeLegacyEntry(
    _namespace: PackageCacheNamespace,
    _key: string,
    _entry: LegacyEntry,
  ): MaybePromise<void> {
    // Default: no upgrade.
  }

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

// TODO: Delete with the legacy JSON-wrapper decoder; envelopes use
// backend-native TTL.
function isExpiredLegacyEntry(entry: LegacyEntry): boolean {
  const { expiry } = entry;
  return (
    expiry !== undefined && (!expiry.isValid || DateTime.local() >= expiry)
  );
}
