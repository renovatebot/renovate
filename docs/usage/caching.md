# Caching

As a tool for updating dependencies, Renovate needs to interact with many different [Datasources](./modules/datasource/index.md) to determine what update(s) are available for a given repository, requiring a large amount of outbound HTTP traffic.

To avoid unnecessary stress on upstream services, [like Maven Central](https://www.sonatype.com/blog/maven-central-and-the-tragedy-of-the-commons), as well as making each run of Renovate more efficient, Renovate works to heavily cache external HTTP requests where possible.

## Factors affecting caching

Renovate will conditionally cache data based on a few factors.

Firstly, depending on how you run Renovate, it may be possible to improve caching.

For instance, if Renovate runs against a single repository at a time:

```sh
# newlines for readability purposes only
env RENOVATE_TOKEN=...
  renovate --platform github
  renovatebot/renovate

# then run another repo
env RENOVATE_TOKEN=...
  renovate --platform github
  containerbase/base
```

In this case, the [In-Memory Cache](#in-memory-cache) Renovate holds will be lost each time the Renovate process exits.

Compare this to the case that you run multiple repositories in a single Renovate process:

```sh
# newlines for readability purposes only
env RENOVATE_TOKEN=...
  renovate --platform github
  renovatebot/renovate containerbase/base
```

In this example, the In-Memory Cache will be shared between all repositories being processed.

In both cases, the Renovate runs execute on the same host (whether it is a VM, container or your personal laptop) and so the on-disk caches will be shared between Renovate runs.

Secondly, Renovate does not intentionally cache data that should be private.
If it believes it is interacting with a private repository and/or a private package, Renovate will not cache the data in a persistent layer (but it may be available in the In-Memory Cache).
See [What happens to HTTP calls that require authentication?](#what-happens-to-http-calls-that-require-authentication) and [What happens to private packages being retrieved?](#what-happens-to-private-packages-being-retrieved) below for more details.

Finally, if you are running Renovate across many hosts (for instance across a Kubernetes cluster or on your automated build platform like GitLab CI), [we strongly recommend](#recommended-performance-improvements) using a persistent Package Cache, and ideally a persistent Repository Cache, too.

## Cache types

Renovate has three caches of its own:

| Cache                                 | Backend                | Persists between runs | Configurable |
| ------------------------------------- | ---------------------- | --------------------- | ------------ |
| [In-Memory Cache](#in-memory-cache)   | Memory                 | no                    | no           |
| [Package Cache](#package-cache)       | Redis, SQLite, or file | with a backend        | yes          |
| [Repository Cache](#repository-cache) | File or S3             | when enabled          | yes          |

Renovate uses 3 types of cache:

### In-Memory Cache

The In-Memory Cache includes any short-lived data which is worth caching within a given Renovate run (for a single repo or against multiple), but is not worth persisting for more long-term access.

<!-- markdownlint-disable MD024 -->

#### What is in it?

Renovate stores a mix of different types of data in the In-Memory Cache, for instance when retrieving HTTP-/npm-based config presets, getting the public key for a Hex registry or for **listing status checks on a GitHub branch**.

<!-- markdownlint-disable MD024 -->

#### Where is it stored?

In-memory.

As soon as the Renovate process exits, all data is lost.

<!-- markdownlint-disable MD024 -->

#### Which options configure it?

It is not configurable.

### Repository Cache

The Repository Cache includes metadata about repositories to reduce the work that Renovate will need to perform on future runs.

The Repository Cache is primarily aimed at reducing the work that Renovate needs to be perform each time it executes against a repository, and limiting the API requests it needs to send to the configured Platform.

!!! note
  This only contains **metadata** about the repository, not the repository itself.
  <br>
  This includes similar data to what Renovate logs at `DEBUG` log level.

<!-- markdownlint-disable MD024 -->

#### What is in it?

This cache includes (among other information):

<!-- markdownlint-disable MD007 -->

- `configFileName`: this repository's filename i.e. `renovate.json5`
- `branches`: information about the branches Renovate is currently managing, and:
  - whether they are associated with a PR
  - what update(s) are in the given branch
  - whether the branch is conflicted/behind the base branch or if it's been modified by someone other than Renovate
- `onboardingBranchCache`, `reconfigureBranchCache`: cache for the state of the onboarding/reconfigure branches
- `platform`: specific information for the given Platform, such as a cache of all PRs
- `httpCache`/`httpCacheHead`: cached repository-specific HTTP responses
- `semanticCommits`: the current calculation for the repo's [`semanticCommits`](./configuration-options.md#semanticcommits)
- `prComments`: any PR comments that Renovate has made on PRs

This generally allows Renovate to not need to perform potentially expensive work (like extracting all package files in a repository) if the repository has not changed.

<!-- markdownlint-disable MD024 -->

#### Where is it stored?

By default, there is no Repository Cache as [`repositoryCache=disabled`](./self-hosted-configuration.md#repositorycache) is the default.

If enabled, this cache data is stored by default in the local filesystem, under the [`cacheDir`](./self-hosted-configuration.md#cachedir) location.

It can be configured to be stored in an S3-compatible location using i.e. [`repositoryCacheType=s3://my-bucket/some-path/repo-cache`](./self-hosted-configuration.md#repositorycachetype).

<!-- markdownlint-disable MD024 -->

#### Which options configure it?

- the [`repositoryCache` object](./self-hosted-configuration.md#repositorycachetype):
  - [`repositoryCache.state`](./self-hosted-configuration.md#repositorycachestate): whether to enable the Repository Cache
  - [`repositoryCache.type`](./self-hosted-configuration.md#repositorycachetype): where the Repository Cache should be stored
  - [`repositoryCache.maximumHttpDays`](./self-hosted-configuration.md#repositorycachemaximumhttpdays): how many days a cached HTTP response should stay in the Repository Cache for
  - [`repositoryCache.prSyncMaxPages`](./self-hosted-configuration.md#repositorycacheprsyncmaxpages): how many pages of Pull Requests to sync into the Repository Cache
  - [`repositoryCache.forceLocal`](./self-hosted-configuration.md#repositorycacheforcelocal): whether to also persist it to the local filesystem if using `repositoryCacheType=s3://...`

#### Is there any expected stability on the format of the Repository Cache?

No.

The format of the Repository Cache may change in breaking ways in a minor or patch version of Renovate, as may we change what each field means.
It is only expected for Renovate itself to interact with the Repository Cache.

#### How do I invalidate the cache?

It is not possible for a _user_ to invalidate the Package Cache.

A self-hosted administrator can use the following options to invalidate the cache:

- **Redis:** delete the relevant keys or prefix
- **Local file:** remove the relevant local package cache storage
- **SQLite:** remove the relevant database or storage

If you only wish to invalidate the HTTP calls that are cached, you can set [`repositoryCache.maximumHttpDays=0`](./self-hosted-configuration.md#repositorycachemaximumhttpdays).

Although it may **??**, [`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride) changes freshness; it is not an immediate deletion.

After invalidating the cache, this will be recreated by Renovate on the next run, if `repositoryCache.state=enabled`.

### Package Cache

The Package Cache includes metadata about package releases, their changelogs, and HTTP responses from [Datasources](./modules/datasource/index.md).

The Package Cache is primarily aimed at improving quality-of-life for upstream providers, such as package registries.

!!! tip
  The Package Cache is one of the most important areas to configure as a self-hosted Administrator.
  <br>
  Not only does this reduce the time taken for Renovate to run, but it also helps reduce the burden on public package registries.

<!-- markdownlint-disable MD024 -->

#### What is in it?

The Package Cache contains:

<!-- markdownlint-disable MD007 -->

- HTTP responses from Datasources
  - See below for the full list of namespaces
- GitHub GraphQL data for GitHub releases/tags
  - If the repo is public, any tags/releases will be stored in the cache
  - If the repo is private, any tags/releases will be cached in-memory in the Renovate process (and subsequent Renovate runs will need to re-fetch the data)

<details markdown>

<summary>Package Cache Namespaces</summary>

The following namespaces are used (and explained in more detail in the [`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride) docs):

<!-- Autogenerate cache-namespaces -->

</details>

<!-- markdownlint-disable MD024 -->

#### Where is it stored?

By default, the Package Cache is stored in the local filesystem, under the [`cacheDir`](./self-hosted-configuration.md#cachedir) location.

When using the local filesystem, the [cacache](https://www.npmjs.com/package/cacache) library is used.

When the [`redisUrl`](./self-hosted-configuration.md#redisurl) self-hosted configuration option is set, the Package Cache will be stored in Redis.

Renovate has experimental support for using SQLite as the Package Cache backend, which can be configured using [`RENOVATE_X_SQLITE_PACKAGE_CACHE`](./self-hosted-experimental.md#renovate_x_sqlite_package_cache).

<!-- markdownlint-disable MD024 -->

#### Which options configure it?

- [`packageCache` object](./self-hosted-configuration.md#packagecache):
  - [`hardTtlMinutes`](./self-hosted-configuration.md#cachehardttlminutes): maximum duration to keep datasource cache entries
  - [`presetPersistence`](./self-hosted-configuration.md#presetcachepersistence): whether to cache remote presets in the Package Cache
  - [`privatePackages`](./self-hosted-configuration.md#cacheprivatepackages): cache private packages (See [What happens to HTTP calls that require authentication?](#what-happens-to-http-calls-that-require-authentication) and [What happens to private packages being retrieved?](#what-happens-to-private-packages-being-retrieved) below for more details)
  - [`redisPrefix`](./self-hosted-configuration.md#redisprefix): a prefix for the key names in Redis
  - [`redisUrl`](./self-hosted-configuration.md#redisurl): when configured, use Redis for the Package Cache
  - [`ttlOverride`](./self-hosted-configuration.md#cachettloverride): overrides for the expiry/TTL of specified datasource cache entries
- [`RENOVATE_X_SQLITE_PACKAGE_CACHE`](./self-hosted-experimental.md#renovate_x_sqlite_package_cache): use SQLite as the Package Cache backend
- [`RENOVATE_X_SQLITE_BUSY_TIMEOUT`](./self-hosted-experimental.md#renovate_x_sqlite_busy_timeout): when using SQLite, increase the busy timeout

#### How do I invalidate the cache?

**??**

#### Is there any expected stability on the format of the Repository Cache?

Some.

The cache keys **??** - see "Package Cache Namespaces" [above](#what-is-in-it_2) - **??**.

The format of the Repository Cache may change in breaking ways in a minor or patch version of Renovate, as may we change what each field means.
It is only expected for Renovate itself to interact with the Repository Cache.

## Other related configuration options

- [`persistRepoData`](./self-hosted-configuration.md#persistrepodata)

## Recommended performance improvements

!!! tip
  Following these recommendations not only improve the performance for your own Renovate deployment, but make it less heavy on the registries you rely upon.

1. **Strongly recommended**: Set the Package Cache to use Redis, or the `cacheDir` to a persistent volume shared across runs
1. Preferably: Set the Repository Cache to use an S3-compatible backend

```
## Clearing the cahce **??**

**??** Renovate does some - but it's in caharge of doing so

Redis doesn't automagically clear it

So you may sometimes want/need to**??**

Check the **??** namespaces
```

## Related storage locations

There are also **??**

### Package manager caches

In the case that Renovate executes commands that trigger a package manager to run, for instance `go mod tidy`, then there may be some downloads + caching that the package manager itself may do.

Where possible, Renovate will centralize these cache locations under [`cacheDir`](./self-hosted-configuration.md#cachedir), i.e. in `$cacheDir/others/go` and `$cacheDir/others/yarn`.

Note that this directory can grow over time (as noted in [#33612](https://github.com/renovatebot/renovate/discussions/33612)), so should be periodically cleaned up, if you are running long-lived hosts and/or persistently caching the `cacheDir`.

#### How do I invalidate the cache?

You can invalid the cache for package managers by browsing to your [`cacheDir`](./self-hosted-configuration.md#cachedir), and deleting relevant folders under `$cacheDir/others`

We recommend you only do this when Renovate is not running, otherwise it could cause package manager processes to fail in unexpected ways.

After invalidating the cache, this will be re-filled as package managers execute.

### Persistent repo storage

By default, Renovate does not **??**.

When using [`persistRepoData`](./self-hosted-configuration.md#persistrepodata), **??**.

Renovate **??**.

#### How do I invalidate the cache?

## FAQs

### How much memory should I use for my Package Cache?

Unfortunately "it depends".

!!! note
  There are a number of factors that are taken into account when tuning a Package Cache - watch this space for more info.

It is recommended to start with 2-4GB of memory, and see how this scales, depending on your organization, the number of repos you are using.

!!! hint
  In November 2026, Mend-hosted Renovate uses an AWS ElastiCache `cache.m7g.2xlarge` instance of Redis (OSS), which has ~26GiB of memory, and sees roughly 60% usage at peak.

### Why does Renovate attempt to categorise what is **public/private data? maybe something else?**?

In cases where **??**, this can **??**.

In some self-hosted environments (such as for a company's **??**), it is safe **??**.

However, because it could lead to information **??** that may not be intended, especially if running **??**, it is**??**.

### What's the difference between the "soft" and "hard" cache?

Renovate internally uses two types of Time-to-Live (TTL) for its cache:

- **Soft TTL (logical):** When a cache entry's soft TTL expires, Renovate tries to refresh the data from the upstream source.
- **Hard TTL (physical):** When a cache entry's hard TTL expires, Renovate permanently removes the data from the cache.

This two-level cache expiry is used for:

1. [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) with `ETag`, `Last-Modified`, and `If-Modified-Since` headers
2. `getReleases` and `getDigest` datasource methods, i.e. the package release data

If an upstream request fails, Renovate can still use stale data from the cache as long as its hard TTL has not expired.

If the soft TTL for a cache entry is longer than the hard TTL, Renovate uses the soft TTL value for both.
The soft TTL is hard-coded but can be overridden with [`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride).

**Example:**

The `npm` datasource has a default soft TTL of 15 minutes.
When `cacheHardTtlMinutes` is set, for example to 60, Renovate will use the stale `npm` data in the following ways:

- The `ETag` from the cached result is used in new requests. If the upstream server returns a `304 Not Modified` response, the cached data is revalidated and used.
- If an error occurs when querying the `npmjs` registry, Renovate will use the stale data from the cache as long as it has been cached for less than 60 minutes.

Note that this is a **??**, not **??**.
‼️‼️ When using Redis, this is enforced on Redis' side, and **??** expiry managed **??**. https://renovatebot.slack.com/archives/CAFH752JU/p1795090102134079 ‼️‼️

### Where are HTTP responses cached?

HTTP responses may be persisted across all 3 of Renovate's caches.

Certain HTTP requests - such as the repository's PRs and the Dependency Dashboard Issue - make more sense to be tied to the Repository Cache, while others - such as HTTP calls to Datasources - make sense to be in the Package Cache.

Additionally, some HTTP requests are only stored in the In-Memory Cache, but are not persisted between Renovate runs.

The cache used for HTTP responses is not user-configurable.

### Is the data encrypted in the cache(s)?

No.

Neither Repository Cache nor Package Cache data is stored encrypted at rest.

Encryption at rest with the Repository Cache should be configured on the S3-compatible backend.

Encryption at rest for the Package Cache should be configured on the Redis instance.
Encryption in transit for the Package Cache can be configured by using TLS/SSL-enabled Redis, and specifying [`redisUrl=rediss://...`](./self-hosted-configuration.md#redisurl).

### Does Renovate cache HTTP calls that don't return a `Cache-Control` header?

**??**

No, Renovate will not.
Renovate treats the absence of a **??**

### What happens to HTTP calls that require authentication?

**??**

### What happens to private packages being retrieved?

Private package **??**

It's [`cachePrivatePackages`](./self-hosted-configuration.md#cacheprivatepackages)

### Does Renovate store a copy of the repo?

No, Renovate does not store and/or cache copies of the repository, or files within the repository.

It is possible to use [`persistRepoData`](./self-hosted-configuration.md#persistrepodata) to keep the cloned repo on the host Renovate is running on, but this does not get persisted into any of Renovate's caches.

### How do I invalidate the cache?

It is not possible for a _user_ to invalidate the Repository Cache.

A self-hosted administrator can use the following options to invalidate the cache:

For the Repository Cache, a self-hosted administrator can use [`repositoryCache=reset`](./self-hosted-configuration.md#repositorycache).

!!! tip
  If resetting the cache for a specific repo, it is worthwhile making sure you target only a specific repository, for instance using the [`repositories`](./self-hosted-configuration.md#repositories) configuration option.

The Repository Cache can also be reset by deleting the `cache.json` file from the S3-compatible backend.
When Renovate does not see it present, it will recreate it.

To invalidate an entry in the Package Cache is more involved, and requires configuring [`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride) for the specific namespace(s) and key(s) that you wish to invalidate, then running Renovate.

If specifying [`redisUrl`](./self-hosted-configuration.md#redisurl) to use Redis for the Package Cache, connecting to the Redis server and deleting the keys is also a valid option.

###

---

## Other **??** relevant

- [`cacheTtlOverride`](./self-hosted-configuration.md#cachettloverride)
- [`cacheHardTtlMinutes`](./self-hosted-configuration.md#cachehardttlminutes)
- `prCacheSyncMaxPages`
- persistRepoData

---

```
When Renovate encounters `Cache-Control` headers, it will abide by them, as well as perform conditional HTTP requests when `ETag` HTTP headers are received.
```
