GraphQL can be used to efficiently retrieve all the tags and releases from GitHub.
The approach involves fetching items in reverse chronological order by the `created_at` field.
Items can be retrieved page by page until the first cached item is reached.

Although sorting by the `updated_at` field would be more precise, this option is not available in the API.
As a result, we also fetch relatively all items that are relatively _fresh_.
The freshness period is equal to the TTL of the entire cache, and this allows for updates or deletions to be reflected in the cache during that time.

In most cases, only one page of releases will need to be fetched during a Renovate run.
While it is possible to reduce this to zero for most runs, the practical implementation is complex and prone to errors.

# Components overview

```
lib/util/github/graphql
│
├── cache-strategies
│   ├── abstract-cache-strategy.ts   <- common logic: `reconcile()` and `finalize()`
│   ├── memory-cache-strategy.ts     <- single Renovate run (private packages)
│   └── package-cache-strategy.ts    <- long-term persistence (public packages)
│
├── query-adapters
│   ├── releases-query-adapter.ts    <- GitHub releases
│   └── tags-query-adapter.ts        <- GitHub tags
│
├── datasource-fetcher.ts            <- Complex pagination loop
│
└── index.ts                         <- Facade that hides whole thing
```

The datasource-fetcher.ts file contains the core component that implements the logic for looping over paginated GraphQL results.
This class is meant to be instantiated every time we need to paginate over GraphQL results.
It is responsible for handling several aspects of the fetch process, including:

- Making HTTP requests to the `/graphql` endpoint
- Handling and aggregating errors that may occur during the fetch process
- Dynamically adjusting the page size and retrying in the event of server errors
- Enforcing a maximum limit on the number of queries that can be made
- Detecting whether a package is private or public, and selecting the appropriate cache strategy (in-memory or long-term) accordingly
- Ensuring proper concurrency when querying the same package simultaneously.

The `cache-strategies/` directory is responsible for caching implementation.
The core function is `reconcile()` which updates the cache data structure with pages of items one-by-one.

The files in `query-adapters/` directory allow for GitHub releases and tags to be fetched according to their specifics and to be transformed to the form suitable for caching.
For cached items, only `version` and `releaseTimestamp` fields are mandatory.
Other fields are specific to GitHub tags or GitHub releases.

# Process overview

## Initial fetch

Let's suppose we perform fetching for the first time.
For simplicity, this example assumes that we are retrieving items in small batches of 5 at a time.
The cache TTL is assumed to be 30 days.

```js
// Page 1
[
  { "version": "3.1.1", "releaseTimestamp": "2022-12-18" },
  { "version": "3.1.0", "releaseTimestamp": "2022-12-15" },
  { "version": "3.0.2", "releaseTimestamp": "2022-12-09" },
  { "version": "3.0.1", "releaseTimestamp": "2022-12-08" },
  { "version": "3.0.0", "releaseTimestamp": "2022-12-05" },
]

// Page 2
[
  { "version": "2.2.2", "releaseTimestamp": "2022-11-23" },
  { "version": "2.2.1", "releaseTimestamp": "2022-10-17" },
  { "version": "2.2.0", "releaseTimestamp": "2022-10-13" },
  { "version": "2.1.1", "releaseTimestamp": "2022-10-07" },
  { "version": "2.1.0", "releaseTimestamp": "2022-09-21" },
]

// Page 3
[
  { "version": "2.0.1", "releaseTimestamp": "2022-09-18" },
  { "version": "2.0.0", "releaseTimestamp": "2022-09-01" },
]
```

As we retrieve items during the fetch process, we gradually construct a data structure in the following form:

```js
{
  "items": {
    "3.1.1": { "version": "3.1.1", "releaseTimestamp": "2022-12-18" },
    "3.1.0": { "version": "3.1.0", "releaseTimestamp": "2022-12-15" },
    "3.0.2": { "version": "3.0.2", "releaseTimestamp": "2022-12-09" },
    "3.0.1": { "version": "3.0.1", "releaseTimestamp": "2022-12-08" },
    "3.0.0": { "version": "3.0.0", "releaseTimestamp": "2022-12-05" },
    "2.2.2": { "version": "2.2.2", "releaseTimestamp": "2022-11-23" },
    "2.2.1": { "version": "2.2.1", "releaseTimestamp": "2022-10-17" },
    "2.2.0": { "version": "2.2.0", "releaseTimestamp": "2022-10-13" },
    "2.1.1": { "version": "2.1.1", "releaseTimestamp": "2022-10-07" },
    "2.1.0": { "version": "2.1.0", "releaseTimestamp": "2022-09-21" },
    "2.0.1": { "version": "2.0.1", "releaseTimestamp": "2022-09-18" },
    "2.0.0": { "version": "2.0.0", "releaseTimestamp": "2022-09-01" },
  },
  "createdAt": "2022-12-20",
}
```

Internally, we index each release by version name for quicker access.
When the fetch process is complete, we return the values of the items object.
If the repository is public, we also persist this data structure in a long-term cache for future use.

## Recurring fetches

In the case where we already have items stored in the cache, we can model the fetch process as follows.
Suppose we have a new release that changes the pagination of our items.
Also note that versions `3.0.1` and `3.0.2` are deleted since last fetch.
The resulting pagination would look like this:

```js
// Page 1                                                   --- FETCHED AND RECONCILED ---
[
  { "version": "4.0.0", "releaseTimestamp": "2022-12-30" }, // new    <- item cached
  { "version": "3.1.1", "releaseTimestamp": "2022-12-18" }, // fresh  <- item updated
  { "version": "3.1.0", "releaseTimestamp": "2022-12-15" }, // fresh  <- item updated
//{ "version": "3.0.2", "releaseTimestamp": "2022-12-09" }, // fresh  <- item deleted
//{ "version": "3.0.1", "releaseTimestamp": "2022-12-08" }, // fresh  <- item deleted
  { "version": "3.0.0", "releaseTimestamp": "2022-12-05" }, // fresh  <- item updated
  { "version": "2.2.2", "releaseTimestamp": "2022-11-23" }, // old    <- fetching stopped
]

// Page 2                                                   --- NOT FETCHED ---
[
  { "version": "2.2.1", "releaseTimestamp": "2022-10-17" }, // old
  { "version": "2.2.0", "releaseTimestamp": "2022-10-13" }, // old
  { "version": "2.1.1", "releaseTimestamp": "2022-10-07" }, // old
  { "version": "2.1.0", "releaseTimestamp": "2022-09-21" }, // old
  { "version": "2.0.1", "releaseTimestamp": "2022-09-18" }, // old
]

// Page 3                                                   --- NOT FETCHED ---
[
  { "version": "2.0.0", "releaseTimestamp": "2022-09-01" }, // old
]
```

Given we performed fetch at the day of latest release, new cache looks like:

```js
{
  "items": {
    "4.0.0": { "version": "4.0.0", "releaseTimestamp": "2022-12-30" },
    "3.1.1": { "version": "3.1.1", "releaseTimestamp": "2022-12-18" },
    "3.1.0": { "version": "3.1.0", "releaseTimestamp": "2022-12-15" },
    "3.0.0": { "version": "3.0.0", "releaseTimestamp": "2022-12-05" },
    "2.2.2": { "version": "2.2.2", "releaseTimestamp": "2022-11-23" },
    "2.2.1": { "version": "2.2.1", "releaseTimestamp": "2022-10-17" },
    "2.2.0": { "version": "2.2.0", "releaseTimestamp": "2022-10-13" },
    "2.1.1": { "version": "2.1.1", "releaseTimestamp": "2022-10-07" },
    "2.1.0": { "version": "2.1.0", "releaseTimestamp": "2022-09-21" },
    "2.0.1": { "version": "2.0.1", "releaseTimestamp": "2022-09-18" },
    "2.0.0": { "version": "2.0.0", "releaseTimestamp": "2022-09-01" },
  },
  "createdAt": "2022-12-20",
}
```

It will be updated by further fetches until cache reset at `2023-01-20`.
