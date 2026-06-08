# Caching

Renovate caches data to run faster and reduce load on platforms and registries. This page is for self-hosted administrators who configure those caches and diagnose cache-related symptoms.

Renovate caching is layered, not a single store. That matters when cached data appears stale, disk usage keeps growing, or deleting one cache does not change the symptom.

## Renovate caches

Renovate has three caches of its own:

| Cache            | Backend                | Persists between runs | Configurable |
| ---------------- | ---------------------- | --------------------- | ------------ |
| Memory cache     | memory                 | no                    | no           |
| Package cache    | Redis, SQLite, or file | with a backend        | yes          |
| Repository cache | local file or S3       | when enabled          | yes          |

Package manager caches and persisted repository data can produce the same symptoms — stale results or growing disk use — but they are separate storage areas, covered in [Related storage](#related-storage).

### Memory cache

The memory cache holds short-lived data that Renovate can reuse while processing one repository, such as HTTP and npm config presets, a Hex registry's public key, or a branch's status checks.

Renovate creates a fresh memory cache for each repository. It avoids repeated work within that repository run but is not shared with later repositories or runs. The memory cache is automatic and has no configuration.

### Package cache

The package cache stores reusable data from upstream package lookups: final release and version results, plus the digests, tags, changelogs, and selected HTTP responses a datasource fetches while producing them.

<!-- prettier-ignore -->
!!! tip
    The package cache is the main cache to configure as a self-hosted administrator.
    <br>
    It cuts both run time and the load Renovate puts on public registries.

Resolved presets can also be stored in the package cache.

For GitHub releases and tags fetched over GraphQL, public-repository data is stored in the package cache, while private-repository data stays in the memory cache and is re-fetched on the next run unless [`cachePrivatePackages`](./self-hosted-configuration.md#cacheprivatepackages) is enabled.

Renovate selects one backend by precedence — Redis, then SQLite, then a local file — as shown in [Choose cache storage](#choose-cache-storage).

Despite the similar name, the package cache does not hold package-manager downloads, such as a `go mod` or npm install cache; those are [related storage](#related-storage).

<details markdown>

<summary>Package cache namespaces</summary>

The package cache is keyed by namespace. Each namespace and its default TTL are documented under [`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride).

<!-- Autogenerate cache-namespaces -->

</details>

| Option                                                                            | What it controls                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`presetCachePersistence`](./self-hosted-configuration.md#presetcachepersistence) | whether resolved presets are stored in the package cache |

Choose its backend in [Choose cache storage](#choose-cache-storage); tune its freshness and private-data behavior in [Freshness, TTL, and stale data](#freshness-ttl-and-stale-data) and [Caching private and authenticated data](#caching-private-and-authenticated-data).

### Repository cache

The repository cache stores metadata about one repository so Renovate can skip work it already did and send fewer platform API requests.

<!-- prettier-ignore -->
!!! note
    This stores **metadata** about the repository, not the repository itself.
    <br>
    The contents are similar to what Renovate logs at `DEBUG` level.

It holds, among other things:

- extracted package-file state
- the state of branches Renovate manages, including their PR, their updates, and whether each branch is behind the base branch, conflicted, or modified by someone other than Renovate
- onboarding and reconfigure branch state
- platform metadata, such as a cache of the repository's PRs
- repository-specific HTTP cache data
- the calculated [`semanticCommits`](./configuration-options.md#semanticcommits) value
- Renovate's own PR comments

This lets Renovate skip work, such as extracting every package file, when the repository has not changed.

The repository cache is disabled by default ([`repositoryCache=disabled`](./self-hosted-configuration.md#repositorycache)). When enabled, Renovate stores it on the local filesystem under [`cacheDir`](./self-hosted-configuration.md#cachedir), or in an S3-compatible bucket via [`repositoryCacheType=s3://my-bucket/some-path`](./self-hosted-configuration.md#repositorycachetype).

| Option                                                                      | What it controls                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`httpCacheTtlDays`](./self-hosted-configuration.md#httpcachettldays)       | how long cached HTTP responses live in the repository cache |
| [`prCacheSyncMaxPages`](./self-hosted-configuration.md#prcachesyncmaxpages) | how many pages of PRs Renovate syncs into the cache         |

Choose where the repository cache is stored in [Choose cache storage](#choose-cache-storage).

### Where HTTP responses are cached

Renovate caches many of its outbound HTTP responses, but there is no single HTTP cache and no per-request switch to control it. Where a response lands depends on the code path that made the request:

- Repository and platform calls, such as a repository's PRs, can be stored in the repository cache.
- Datasource calls can be stored in the package cache.
- Some responses stay in the memory cache and are not persisted between runs.

Where a code path uses an HTTP cache provider, Renovate stores the response's `ETag` and `Last-Modified` values, then revalidates on a later run with `If-None-Match` and `If-Modified-Since`. A `304 Not Modified` reply lets Renovate reuse the cached response.

Some package-cache paths also gate cacheability on `Cache-Control`: where that check is enabled for a datasource, Renovate stores the response only if the header lists `public`. A missing `Cache-Control` header does not disable caching, and Renovate does not use `max-age` as its cache TTL — see [Freshness, TTL, and stale data](#freshness-ttl-and-stale-data).

## Related storage

Package-manager caches and persisted repository data affect runtime and disk use, but they are not Renovate caches.

### Package-manager caches

When Renovate runs a package manager — for example `go mod tidy` during a lockfile update — that tool downloads and caches its own data. Renovate does not control those caches.

Where it can, Renovate centralizes these caches under [`cacheDir`](./self-hosted-configuration.md#cachedir)`/others`. The tools include npm, Yarn, pnpm, Go, pip and other Python tools, Composer, Bundler, and helpers for Debian, RPM, NuGet, and Terraform.

<!-- prettier-ignore -->
!!! warning
    Gradle is an exception: its cache growth may land under Gradle's own home and cache directories rather than `cacheDir/others`.

These caches let artifact and lockfile commands avoid re-downloading data. They do not help datasource lookups. Clean them between runs, as described in [Storage growth and cleanup](#storage-growth-and-cleanup).

### Persisted repository data

Renovate does not keep a repository's contents in any of its own caches; the repository cache holds only metadata. `persistRepoData` keeps the cloned repository on the host between runs, so Renovate can `git fetch` instead of running a fresh `git clone`. This clone is separate storage, not part of the repository cache.

| Option                                                              | What it controls                                    |
| ------------------------------------------------------------------- | --------------------------------------------------- |
| [`persistRepoData`](./self-hosted-configuration.md#persistrepodata) | keep the cloned repository on the host between runs |

## Choose cache storage

Renovate does not have one backend setting for every cache. Choose package cache storage and repository cache storage separately.

### Package cache backend

Renovate chooses Redis when `redisUrl` is set, then SQLite when `RENOVATE_X_SQLITE_PACKAGE_CACHE` is set, then local file storage under `cacheDir`.

Caveats:

- **Local file** uses disk and inodes under `cacheDir`. It uses [cacache](https://www.npmjs.com/package/cacache), which matters when troubleshooting local package cache growth.
- **Redis** is an operational dependency, not a fallback. It needs capacity, monitoring, auth or TLS, and a reliable network.
- **SQLite** is selected only when Redis is absent and `RENOVATE_X_SQLITE_PACKAGE_CACHE` is set. It is local storage; treat concurrent or shared-volume use cautiously.

| Option                                                                                             | What it controls                                                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`redisUrl`](./self-hosted-configuration.md#redisurl)                                              | use Redis as the backend; `rediss://` enables TLS                       |
| [`cacheDir`](./self-hosted-configuration.md#cachedir)                                              | local file backend location, and the base path for other on-disk caches |
| [`RENOVATE_X_SQLITE_PACKAGE_CACHE`](./self-hosted-experimental.md#renovate_x_sqlite_package_cache) | use SQLite as the backend                                               |
| [`RENOVATE_X_SQLITE_BUSY_TIMEOUT`](./self-hosted-experimental.md#renovate_x_sqlite_busy_timeout)   | SQLite busy timeout                                                     |

### Repository cache backend

`repositoryCache` is disabled by default. When enabled, `repositoryCacheType=local` stores repository metadata under `cacheDir`, while `repositoryCacheType=s3://…` stores it in an S3-compatible bucket.

Caveats:

- **Local repository cache** is separate from the local package cache.
- **S3-compatible repository cache** needs valid endpoint, region, and path-style config, plus credentials that last the whole run.

| Option                                                                                  | What it controls                               |
| --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`repositoryCache`](./self-hosted-configuration.md#repositorycache)                     | enable, disable, or reset the repository cache |
| [`repositoryCacheType`](./self-hosted-configuration.md#repositorycachetype)             | local file vs S3-compatible backend            |
| [`repositoryCacheForceLocal`](./self-hosted-configuration.md#repositorycacheforcelocal) | also keep a local copy when using S3           |
| [`s3Endpoint`](./self-hosted-configuration.md#s3endpoint)                               | S3-compatible endpoint                         |
| [`s3PathStyle`](./self-hosted-configuration.md#s3pathstyle)                             | S3 path-style addressing                       |

## Caching private and authenticated data

Whether private or authenticated data is cached depends on the code path — the specific route through Renovate's code, which can differ even within one cache — not on a single switch. Treat what gets cached as separate from where it is stored.

### When the package cache stores a result

Three conditions must hold before the package cache stores a result:

1. A package cache backend exists.
2. The code path uses the package cache.
3. The data passes that path's cacheability checks.

The checks vary by code path. They can include the datasource's public/private flag, the registry URL, the upstream's own visibility fields (such as a repository's private flag), whether the request was authenticated, and the response's HTTP cache headers.

### What `cachePrivatePackages` does and doesn't do

Setting `cachePrivatePackages=true` lets supported code paths store data they would otherwise skip as private or authenticated. Each still applies its own validation, and the setting does not extend to the repository cache or related storage. Because it persists private data, it requires a trusted backend.

### Trust boundaries on shared backends

Public/private detection is path-specific; Renovate has no single, universal detector. An authenticated request does not always mean a package is private, and a private registry does not always emit a clear signal.

So `cachePrivatePackages=false` is not an airtight guarantee: supported code paths skip data they classify as private, but some private data can still reach the cache through a code path or HTTP response that classifies it as public. Do not rely on it as the only barrier on a shared backend.

<!-- prettier-ignore -->
!!! warning
    A shared package cache backend can spread stale or wrong entries across repositories and processes, and it can expose private metadata to anyone who can read the backend.
    <br>
    Cache private package data only on a trusted, isolated backend.

Renovate does not encrypt cache contents itself. Two points follow:

- `redisPrefix` separates key names only; it provides no tenant isolation.
- Encryption at rest and in transit is the backend's and host's responsibility: S3 encryption at rest, Redis encryption at rest where needed, Redis TLS via `redisUrl=rediss://…` for transit, and filesystem or volume encryption.

| Option                                                                        | What it controls                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`cachePrivatePackages`](./self-hosted-configuration.md#cacheprivatepackages) | whether supported paths may cache private or authenticated data |
| [`redisPrefix`](./self-hosted-configuration.md#redisprefix)                   | Redis key-name separation (not tenant isolation)                |

## Freshness, TTL, and stale data

Some package cache code paths use two time-to-live (TTL) values for the same entry:

- **Soft TTL (logical):** the freshness window. After it expires, Renovate tries to refresh the entry from upstream.
- **Hard TTL (physical):** the maximum stale-fallback window. After it expires, Renovate can no longer use the entry.

This two-level expiry applies to selected cached datasource and HTTP results, such as release metadata, tags, digests, and conditionally revalidated HTTP responses.

If a refresh fails and the hard TTL has not passed, Renovate can serve the stale entry rather than failing. The soft TTL is built in; if it is longer than the hard TTL, Renovate uses the soft value for both.

For example, the `npm` datasource has a default soft TTL of 15 minutes, and `cacheHardTtlMinutes` defaults to 7 days. Suppose you raise the soft TTL to 1 hour with `cacheTtlOverride`. After that hour passes, Renovate can use a stale `npm` entry in two ways:

- It reuses the `ETag` from the cached result. If the registry returns `304 Not Modified`, Renovate revalidates and uses the cached data.
- If the request to the registry errors, Renovate uses the stale data while it is within the hard TTL — 7 days by default.

Longer TTLs lower traffic and widen the stale window. Shorter TTLs improve freshness and raise traffic.

| Option                                                                      | What it controls                              |
| --------------------------------------------------------------------------- | --------------------------------------------- |
| [`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride)       | override the built-in soft TTL, per namespace |
| [`cacheHardTtlMinutes`](./self-hosted-configuration.md#cachehardttlminutes) | the hard TTL, the stale-fallback ceiling      |

## Storage growth and cleanup

The package cache and related local storage grow for different reasons and need different cleanup.

Package cache size scales with the repository count, the datasource mix, changelog- and tag-heavy packages, the configured TTLs, whether private packages are cached, and the backend's own cleanup behavior.

Package-manager and helper cache size scales with how often artifacts update, each package manager's behavior, the dependency ecosystem, whether `cacheDir/others` persists, and helper or datasource downloads stored outside the package cache.

Persisted repository data grows with cloned repositories. Clean it separately when clone storage is the problem.

`cacheDir/others` needs separate attention:

- Package cache TTLs don't clean it, and moving the package cache to Redis doesn't shrink it.
- Clean it between runs, when no Renovate child process is using it.
- Cleanup forces later re-downloads. In CI, weigh upload and restore cost against re-downloading before persisting all of it.

Local disk under `cacheDir` can grow over time, as noted in [discussion #33612](https://github.com/renovatebot/renovate/discussions/33612). Clean it periodically on long-lived or persistently cached hosts.

For Redis sizing, there is no maintainer-backed universal size or per-repository formula. Size and monitor it operationally:

- **Monitor:** memory use, key count, evictions, latency, and cache hit and miss rates.
- **Drivers:** repository count, package ecosystems, run frequency, TTLs, changelog and tag volume, private-package caching, and prefix sharing.

## Reset or invalidate a cache

Identify the cache or storage area before you delete or tune anything. Resetting the wrong thing wastes work and can hide the problem. Users cannot invalidate caches; only self-hosted administrators can.

### Reset the repository cache

Use [`repositoryCache=reset`](./self-hosted-configuration.md#repositorycache) for a processed repository. Target a specific repository with [`repositories`](./self-hosted-configuration.md#repositories) when you can.

<!-- prettier-ignore -->
!!! tip
    When resetting the cache for one repository, scope the run to that repository so you do not reset others.

For S3-compatible storage, you can instead delete that repository's `cache.json`. Renovate recreates it when it does not find it.

### Invalidate the package cache

There is no general, user-facing command to invalidate a single package cache entry.

- **Redis:** delete the relevant keys or prefix.
- **Local file:** remove the relevant local package cache storage.
- **SQLite:** remove the relevant database or storage.

[`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride) changes freshness; it is not an immediate deletion.

### Clean package-manager caches

Clean `cacheDir/others`, or selected subdirectories, only between runs when no Renovate child process is using it. Expect later runs to rebuild these caches and re-download.

### Clean persisted repository data

Clean the cloned repository data separately from the caches; it affects only cloning and fetching.

### When the symptom is not a cache

Some "stale" symptoms are state, not cache, and resetting a cache will not fix them:

- onboarding or reconfigure branch state
- stale Renovate branch state
- an invalid lockfile or package state
- package-manager auth config
- a registry-URL misconfiguration
- backend connectivity or credential failure

## Troubleshooting

Use the symptom to identify the storage layer first. Cache statistics in the logs show what Renovate served, fetched, stored, or skipped.

### Read the cache statistics

At `DEBUG` level, Renovate logs cache statistics you can match to a symptom.

`Datasource cache statistics` reports the outer datasource release-result cache per datasource, registry, and package:

- `hit` — Renovate served the release result from the package cache.
- `miss` — Renovate did not find a cached release result, so it fetched one.
- `set` — Renovate stored the fetched release result.
- `skip` — Renovate fetched a release result but did not store it in this cache. This does not describe every lower-level HTTP cache write.

`HTTP cache statistics` reports HTTP cache-provider decisions per host:

- `localHit` and `localMiss` — a package HTTP cache entry was used before contacting upstream, or was too old for the soft TTL.
- `hit` and `miss` — an upstream revalidation returned `304 Not Modified`, or Renovate saved a fresh `200` response.

### Symptoms

- **Local disk under `cacheDir` keeps growing**
  - Likely: package-manager caches under `cacheDir/others`, the local file package cache, repository cache, or persisted repo data.
  - Check: largest subdirectories under `cacheDir`. If Redis or S3 are enabled, check `cacheDir/others` first.
  - Fix: clean the specific storage area between runs. Redis does not store package-manager downloads.
- **Renovate exits or slows down when Redis is unavailable**
  - Likely: Redis package cache backend connectivity, auth, TLS, timeout, or capacity.
  - Check: Redis logs, latency, memory, evictions, auth or TLS config, and Renovate cache-init errors.
  - Fix: fix Redis or remove [`redisUrl`](./self-hosted-configuration.md#redisurl) until the backend is reliable.
- **SQLite package cache is locked, busy, or corrupt**
  - Likely: concurrent SQLite access or filesystem locking problems.
  - Check: whether concurrent runners share the same SQLite file and whether the filesystem supports locking.
  - Fix: serialize access, raise [`RENOVATE_X_SQLITE_BUSY_TIMEOUT`](./self-hosted-experimental.md#renovate_x_sqlite_busy_timeout), or delete the database if it is corrupt.
- **Repository cache in S3 fails to read or write**
  - Likely: S3-compatible endpoint, region, path-style setting, credentials, or credential lifetime.
  - Check: `RepoCacheS3.read()` or `RepoCacheS3.write()` errors and the S3 client environment.
  - Fix: correct the backend config. Delete a repository's `cache.json` only when that cache file is stale or corrupt.
- **A newly published private package version is not found**
  - Likely: a package cache or package HTTP cache entry is still inside its soft TTL, or a private response was cached as public.
  - Check: cache stats for the datasource or URL, TTL, auth/private classification, and the backend key.
  - Fix: wait for the TTL, shorten [`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride), or delete the backend entry.
- **Registry calls or `429` errors continue despite caching**
  - Likely: cold or expired cache, unshared runners, missing backend, non-cacheable path, wrong registry URL, or per-version lookups.
  - Check: `hit`/`miss`/`set`/`skip` stats and whether requests go to the expected registry.
  - Fix: use a reliable shared package cache, fix registry URLs, and tune TTL only after confirming cache behavior.
- **A wrong or stale package result appears across repositories**
  - Likely: a shared package cache entry produced by another repository or process.
  - Check: whether affected repositories share Redis, prefix, SQLite file, or local cache storage; inspect the matching namespace and key.
  - Fix: delete the backend entry, upgrade if a known cache bug was fixed, or isolate the backend by trust boundary.
- **Lockfile or artifact command gets `401`**
  - Likely: package-manager credentials or config, not the package cache.
  - Check: the failing command, generated tool config, [`hostRules`](./configuration-options.md#hostrules), and manager-specific auth.
  - Fix: fix package-manager auth or config. Deleting the package cache will not fix a bad artifact command.
- **Renovate clones from scratch on every run**
  - Likely: [`persistRepoData=false`](./self-hosted-configuration.md#persistrepodata) or ephemeral local storage, not the repository cache.
  - Check: whether the cloned repository data survives between runs.
  - Fix: enable [`persistRepoData`](./self-hosted-configuration.md#persistrepodata) and persist or restore the local repo data.
- **Preset or inherited config changes are not reflected**
  - Likely: repository HTTP cache, memory cache, or package cache when [`presetCachePersistence`](./self-hosted-configuration.md#presetcachepersistence) is enabled.
  - Check: logs for `http cache: Using cached response` and the `preset` namespace if preset persistence is enabled.
  - Fix: reset the repository cache for repository HTTP cache data, or delete the relevant `preset` package cache entry.
