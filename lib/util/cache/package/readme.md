# Package cache

`PackageCache` keeps recently used data in memory (L1) and can store it in Redis, SQLite, or files (L2). L1 avoids repeated backend reads.

Use `withCache(options, fn)` to cache a lookup. It checks whether a cached result is fresh before deciding to call `fn`.

## Reads and writes

`get(namespace, key)` returns the L1 value when present. Otherwise, it acquires a mutex for the key and checks L1 again, since another caller may have filled it while this call waited. If the entry is still missing, it reads L2 and attempts to store the result in L1. Without a backend, an L1 miss returns `undefined`.

L1 wraps each value in `{ value }` to distinguish a cached backend miss (`undefined`) from an absent entry.

Both write methods acquire the key's mutex, update L1, and then write to the configured backend:

- `set(namespace, key, value, hardTtlMinutes)` applies any namespace TTL override.
- `setWithRawTtl(namespace, key, value, hardTtlMinutes)` uses the supplied TTL unchanged. Use it inside cache implementations that have already resolved the TTL.

## Memory limits

L1 has an estimated size budget of 64 MiB by default. Reads and writes mark an entry as recently used. When a new entry would exceed the budget, the least recently used entries are evicted.

The self-hosted administrator can change the budget with `packageCacheMemoryLimit`, in MiB. Setting it to `0` disables L1.

Entry size is calculated once on insertion: the UTF-8 JSON representation of `{ value }`, the key, and a 128-byte allowance for bookkeeping. Later mutations of cached objects can make the estimate inaccurate.

Oversized values and values that cannot be JSON-serialized bypass L1.

## Cleanup

`softReset()` clears L1 between repositories. At shutdown, cleanup clears L1 and closes the backend. Standalone `PackageCache` instances use `destroy()` for shutdown.

## Concurrent requests

- `PackageCache` serializes backend reads and writes for each key.
- `withCache` holds a lock across the complete lookup: read the cache, check freshness, fetch if needed, and store the result.

The per-key mutex registry resets between repositories.

## Using `withCache`

Pass `namespace` and `key` in the options, followed by the function that obtains the value. `ttlMinutes` defaults to 30, `cacheable` to `true`, and `fallback` to `false`.

`withCache` stores the result with a `cachedAt` timestamp. It adds `cache-decorator:` to the supplied key before passing it to `PackageCache`.

When `cacheable` is `false`, the function runs directly without using either cache layer. The administrator can override this restriction with `cachePrivatePackages: true`.

An optional `shouldCacheResult` predicate checks both cached values and new results. Rejected cached values are ignored. Rejected new results are returned to the caller but not stored. A new `undefined` result is never stored by `withCache`; `null` can be stored if the predicate accepts it.

### Freshness and fallback

The soft TTL determines how long a cached result can be returned without fetching fresh data. With `fallback: true`, an older result can still be returned if the fetch throws, provided it is within the hard TTL.

| Cached result                                                    | Action                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Within the soft TTL                                              | Return the cached value.                                                  |
| Past the soft TTL but within the hard TTL, with fallback enabled | Call `fn`. Return its result on success or the cached value if it throws. |
| Missing, rejected by `shouldCacheResult`, or past the hard TTL   | Call `fn` and propagate any error.                                        |

Without fallback, the hard TTL equals the soft TTL. With fallback, it is the larger of the soft TTL and `cacheHardTtlMinutes`.

Freshness checks belong to the callers of `PackageCache`: `withCache` checks timestamps, and the HTTP cache provider applies HTTP freshness rules. Backends enforce expiry when reading persistent entries.

### TTL overrides

Administrators can override TTLs by namespace with `cacheTtlOverride`. An exact namespace match takes precedence. Otherwise, the longest matching glob or regex wins. Equally long matches use configuration order.

## Backend selection

At startup, `backend.init()` selects the first matching backend:

1. Redis if `redisUrl` is configured.
2. SQLite if `RENOVATE_X_SQLITE_PACKAGE_CACHE` has a non-empty value and `cacheDir` is configured.
3. The file cache, using `cacache`, if `cacheDir` is configured.
