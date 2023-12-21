# Rubygems datasource

Datasource query order depends on the registry.

## Querying `rubygems.org`

Rubygems rate limits are easy to hit, so we need to be careful with the queries.
This is implemented with two-level cache:

- First, we query `https://rubygems.org/versions` endpoint for current versions for all packages.

  Either full or delta sync is performed, depending on the cache state.

  All the data of this layer is stored in-memory as the mapping `packageName -> version[]`.

  ```mermaid
  stateDiagram-v2
    [*] --> Empty

    state "Empty" as Empty
    Empty --> FullSync: getPkgReleases()

    state "Synced" as Synced
    Synced --> DeltaSync

    state "Unsupported" as Unsupported
    Unsupported --> [*]

    state "Full sync" as FullSync : GET /versions (~20Mb)
    state full_sync_result <<choice>>
    FullSync --> full_sync_result: Response
    full_sync_result --> Synced: (1) Status 200
    full_sync_result --> Unsupported: (2) Status 404
    full_sync_result --> Empty: (3) Status other than 200 or 404\n Clear cache and throw ExternalHostError

    state "Delta sync" as DeltaSync: GET /versions with "Range" header
    state delta_sync_result <<choice>>
    DeltaSync --> delta_sync_result: Successful response
    delta_sync_result --> Synced: (1) Status other than 206\nFull data is received, extract and replace old cache\n (as if it is the full sync)
    delta_sync_result --> FullSync: (2) The head of response doesn't match\n the tail of the previously fetched data
    delta_sync_result --> Synced: (3) The head of response matches\n the tail of the previously fetched data

    state delta_sync_error <<choice>>
    DeltaSync --> delta_sync_error: Error response
    delta_sync_error --> FullSync: (1) Status 416 should not happen\nbut moves to full sync
    delta_sync_error --> Unsupported: (2) Status 404
    delta_sync_error --> Empty: (3) Status other than 404 or 416
  ```

- Then, more data is obtained from `https://rubygems.org/api/v1/versions/<package>.json` and `https://rubygems.org/api/v1/gems/<package>.json`.

  From the previous layer, the cache key is formed from the `packageName`, and the list of versions is additionally hashed and stored to ensure consistency, so that we reach these API endpoints only when the key has expired or when the list of versions has changed.

  The data for this cache layer is being persisted in the longer-term package cache.

## Querying `rubygems.pkg.github.com` or `gitlab.com`

These particular registries are queried using obsolete API

- `/api/v1/dependencies`

## Other registries

- Fetch from `/api/v1/versions/<package>.json`
- Fallback to `/info/<package>`, if above fails
- Fallback to the obsolete `/api/v1/dependencies`, if above fails
