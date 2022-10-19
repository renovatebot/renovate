import { LookupAllOptions, LookupOneOptions, lookup as _dnsLookup } from 'dns';
import type { EntryObject, IPFamily, LookupOptions } from 'cacheable-lookup';
import QuickLRU from 'quick-lru';
import { logger } from '../../logger';

const cache = new QuickLRU<string, any>({ maxSize: 1000 });

function lookup(
  ...[host, options, callback]:
    | [
        hostname: string,
        family: IPFamily,
        callback: (
          error: NodeJS.ErrnoException,
          address: string,
          family: IPFamily
        ) => void
      ]
    | [
        hostname: string,
        callback: (
          error: NodeJS.ErrnoException,
          address: string,
          family: IPFamily
        ) => void
      ]
    | [
        hostname: string,
        options: LookupOptions & { all: true },
        callback: (
          error: NodeJS.ErrnoException,
          result: ReadonlyArray<EntryObject>
        ) => void
      ]
    | [
        hostname: string,
        options: LookupOptions,
        callback: (
          error: NodeJS.ErrnoException,
          address: string,
          family: IPFamily
        ) => void
      ]
): void {
  let opts: LookupOneOptions | LookupAllOptions;
  // TODO: strict null incompatible types (#7154)
  let cb: any;

  if (typeof options === 'function') {
    opts = {};
    cb = options;
  } else if (typeof options === 'number') {
    opts = { family: options };
    cb = callback;
  } else {
    opts = options;
    cb = callback;
  }

  // istanbul ignore if: not used
  if (opts.all) {
    const key = `${host}_all`;
    if (cache.has(key)) {
      logger.trace({ host }, 'dns lookup cache hit');
      cb(null, cache.get(key));
      return;
    }

    _dnsLookup(host, opts, (err, res) => {
      if (err) {
        logger.debug({ host, err }, 'dns lookup error');
        cb(err, null, null);
        return;
      }
      logger.trace({ host, opts, res }, 'dns lookup');
      cache.set(key, res);
      cb(null, res, null);
    });
  } else {
    if (cache.has(host)) {
      logger.trace({ host }, 'dns lookup cache hit');
      cb(null, ...cache.get(host));
      return;
    }

    _dnsLookup(host, opts, (err, ...res) => {
      if (err) {
        logger.debug({ host, err }, 'dns lookup error');
        cb(err);
        return;
      }
      logger.trace({ host, opts, res }, 'dns lookup');
      cache.set(host, res);
      cb(null, ...res);
    });
  }
}

export { lookup as dnsLookup };

export function printDnsStats(): void {
  logger.debug({ hosts: Array.from(cache.keys()) }, 'dns cache');
}

export function clearDnsCache(): void {
  cache.clear();
}
