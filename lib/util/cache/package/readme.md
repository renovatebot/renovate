# Package Cache

Central caching mechanism for Renovate datasources and lookups. Implements a two-layer architecture:

1.  **L1:** In-memory `Map` (per-process).
2.  **L2:** Persistent storage (File, Redis, or SQLite).

## TTL Handling Scope

Soft/Hard TTL logic is not isolated to the `@cache` decorator.
The HTTP cache layer in `PackageHttpCacheProvider` also resolves and applies soft/hard TTL independently (Cache-Control headers, etc.).
In core caching, only TTL overrides are applied; use `setWithRawTtl` to bypass this logic.

## Flow Architecture

The `@cache` decorator orchestrates the retrieval flow.

### Scenario 1: L1 Memory Cache Hit

The fastest path - data is already in memory.

```mermaid
sequenceDiagram
    participant C as Caller
    participant D as @cache Decorator
    participant M as Memory (L1)

    C->>D: Call decorated method
    D->>M: Check key
    M-->>D: Cache hit
    D-->>C: Return cached value
```

### Scenario 2: L2 Cache Hit (Fresh)

Data is not in memory but exists in backend storage and is still fresh (within Soft TTL).

```mermaid
sequenceDiagram
    participant C as Caller
    participant D as @cache Decorator
    participant M as Memory (L1)
    participant B as Backend (L2)
    participant X as Mutex

    C->>D: Call decorated method
    D->>M: Check key
    M-->>D: Miss

    D->>X: Acquire lock (namespace:key)
    Note over D,X: Prevents duplicate fetches

    D->>M: Check key again
    M-->>D: Still miss

    D->>B: Get cached record
    B-->>D: Return value (within Soft TTL)
    D->>M: Store in L1
    X->>D: Release lock
    D-->>C: Return value
```

### Scenario 3: L2 Cache Hit (Stale) - Only for getReleases/getDigest

Data has expired Soft TTL but is within Hard TTL. Attempts to refresh but falls back if upstream fails.

```mermaid
sequenceDiagram
    participant C as Caller
    participant D as @cache Decorator
    participant M as Memory (L1)
    participant B as Backend (L2)
    participant U as Upstream
    participant X as Mutex

    C->>D: Call getReleases/getDigest
    D->>M: Check key
    M-->>D: Miss

    D->>X: Acquire lock
    D->>M: Check key again
    M-->>D: Still miss

    D->>B: Get cached record
    B-->>D: Return stale value<br/>(Soft TTL expired, Hard TTL valid)

    D->>U: Try to fetch fresh data
    alt Upstream Success
        U-->>D: New value
        D->>B: Update cache with new TTL
        D->>M: Store in L1
        D-->>C: Return new value
    else Upstream Error
        U-->>D: Error
        Note over D: Fallback to stale
        D->>M: Store stale in L1
        D-->>C: Return stale value
    end
    X->>D: Release lock
```

### Scenario 4: L2 Cache Miss

No cached data exists or Hard TTL has expired.

```mermaid
sequenceDiagram
    participant C as Caller
    participant D as @cache Decorator
    participant M as Memory (L1)
    participant B as Backend (L2)
    participant U as Upstream
    participant X as Mutex

    C->>D: Call decorated method
    D->>M: Check key
    M-->>D: Miss

    D->>X: Acquire lock
    D->>M: Check key again
    M-->>D: Still miss

    D->>B: Get cached record
    B-->>D: Miss or expired

    D->>U: Fetch from upstream
    U-->>D: Return value

    D->>B: Store with Hard TTL
    D->>M: Store in L1
    X->>D: Release lock
    D-->>C: Return value
```

### Scenario 5: Non-Cacheable Items

When `cacheable()` returns false, only memory caching is used (unless `cachePrivatePackages` is true).

```mermaid
sequenceDiagram
    participant C as Caller
    participant D as @cache Decorator
    participant M as Memory (L1)
    participant U as Upstream
    participant X as Mutex

    C->>D: Call decorated method
    D->>M: Check key
    M-->>D: Miss

    D->>X: Acquire lock
    D->>M: Check key again
    M-->>D: Still miss

    Note over D: Check cacheable()<br/>cacheable() = false<br/>cachePrivatePackages = false

    D->>U: Fetch from upstream (skip backend)
    U-->>D: Return value

    D->>M: Store in L1 only
    X->>D: Release lock
    D-->>C: Return value
```

### Scenario 6: Concurrent Access (Race Protection)

Multiple concurrent calls for the same key - mutex ensures only one upstream fetch.

```mermaid
sequenceDiagram
    participant C1 as Caller 1
    participant C2 as Caller 2
    participant D as @cache Decorator
    participant M as Memory (L1)
    participant X as Mutex
    participant U as Upstream

    C1->>D: Call method
    C2->>D: Call method (concurrent)

    D->>M: Check key (C1)
    D->>M: Check key (C2)
    M-->>D: Miss (both)

    D->>X: C1 acquires lock
    D->>X: C2 waits for lock

    Note over C1,X: C1 has lock
    D->>M: C1 checks again
    M-->>D: Still miss
    D->>U: C1 fetches from upstream
    U-->>D: Return value
    D->>M: C1 stores in L1
    X->>D: C1 releases lock
    D-->>C1: Return value

    Note over C2,X: C2 gets lock
    D->>M: C2 checks again
    M-->>D: Hit! (C1 stored it)
    X->>D: C2 releases lock
    D-->>C2: Return cached value
```

### Scenario 7: Upstream Error (No Fallback)

When upstream fails and no cached data exists to fall back on.

```mermaid
sequenceDiagram
    participant C as Caller
    participant D as @cache Decorator
    participant M as Memory (L1)
    participant B as Backend (L2)
    participant U as Upstream
    participant X as Mutex

    C->>D: Call decorated method
    D->>M: Check key
    M-->>D: Miss

    D->>X: Acquire lock
    D->>M: Check key again
    M-->>D: Still miss

    D->>B: Get cached record
    B-->>D: No cached data

    D->>U: Fetch from upstream
    U-->>D: Error!

    Note over D: No fallback available
    X->>D: Release lock
    D-->>C: Throw error
```

### Scenario 8: Special Values (undefined)

Undefined values are cached in memory (L1) but never persisted to backend (L2). This prevents repeated upstream calls within a single run while treating undefined as a potential transient failure that should not survive between runs.

```mermaid
sequenceDiagram
    participant C as Caller
    participant D as @cache Decorator
    participant M as Memory (L1)
    participant U as Upstream
    participant X as Mutex

    C->>D: Call decorated method
    D->>M: Check key
    M-->>D: Miss

    D->>X: Acquire lock
    D->>M: Check key again
    M-->>D: Still miss

    D->>U: Execute callback
    U-->>D: Return undefined

    D->>M: Store in L1 only
    Note over D: undefined not persisted to L2
    X->>D: Release lock
    D-->>C: Return undefined

    C->>D: Call again
    D->>M: Check key
    M-->>D: Hit in memory
    D-->>C: Return undefined (no upstream call)
```

## Usage

Apply the decorator to class methods.

```typescript
import { cache } from '../../../util/cache/package';

class MyDatasource {
  @cache({
    namespace: 'datasource-my-source', // or function(arg) => string
    key: 'some-key', // or function(arg) => string
    ttlMinutes: 15, // Soft TTL
    cacheable: (result) => result !== null, // Optional
  })
  async getTags(pkgName: string): Promise<string[]> {
    // Expensive upstream call
  }
}
```

### Persistence vs. Memory (`cacheable`)

The `cacheable` parameter **only controls persistence (L2)**.

- If `cacheable` returns `false`, the result is still stored in **L1 Memory** for the duration of the process.
- Private packages are treated as non-cacheable by default unless forced by config.

| `cacheable()` Result | `cachePrivatePackages` Config | L1 (Memory) | L2 (Disk/Redis) |
| :------------------- | :---------------------------- | :---------- | :-------------- |
| `true`               | `false`                       | ✅          | ✅              |
| `false`              | `false`                       | ✅          | ❌              |
| `false`              | `true`                        | ✅          | ✅              |

## TTL Strategy (Soft vs. Hard)

Renovate uses a dual-TTL system to handle upstream instability.

1.  **Soft TTL (`ttlMinutes`):** Period where data is considered "fresh". Returned immediately without network calls.
2.  **Hard TTL:** Period where data is physically retained on disk. Used for fallback if upstream fails.

**Important:** The Stale-While-Revalidate (Hard TTL) logic is **only active** for methods named:

- `getReleases`
- `getDigest`

For all other methods, `HardTTL = SoftTTL`.

### TTL Resolution Logic

```mermaid
graph TD
    A[Start] --> B{overriden via config?}
    B -- Yes --> C[Soft TTL = override]
    B -- No --> D[Soft TTL = decorator param]
    C --> E
    D --> E{Method Name is<br/>getReleases/getDigest?}
    E -- Yes --> F["Hard TTL = Max(Soft TTL, cacheHardTtlMinutes)"]
    E -- No --> G[Hard TTL = Soft TTL]
```

## Configuration Overrides (`cacheTtlOverride`)

Users can override Soft TTLs via `config.js`. The resolution uses **Longest Matching Pattern**.

| Pattern Type | Example                   | Priority         |
| :----------- | :------------------------ | :--------------- |
| Exact Match  | `datasource-npm`          | 1                |
| Glob         | `datasource-{npm,docker}` | 2 (Length based) |
| Regex        | `/^datasource-/`          | 3 (Length based) |
| Wildcard     | `*`                       | 4                |

## Backends

Backend is selected at startup based on environment and config:

1.  **Redis:** if `redisUrl` is configured.
2.  **SQLite:** if `RENOVATE_X_SQLITE_PACKAGE_CACHE=true`.
3.  **File:** Default. Uses `cacache` with `gzip`.
