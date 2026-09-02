This datasource returns releases for a package from the Anaconda.org API, prefix.dev, or any standard conda channel that serves a per-platform `repodata.json` index (such as a self-hosted mirror or an Artifactory conda repository).

The backend is selected from the `registryUrl`:

- `https://api.anaconda.org/package/<channel>/` uses the Anaconda.org REST API
- `https://prefix.dev/<channel>/` uses the prefix.dev API
- Any other `registryUrl` is treated as a standard conda channel, and the package is looked up in a `repodata.json` index

Channel indexes are large, often hundreds of megabytes uncompressed.
Renovate therefore fetches the zstd-compressed `repodata.json.zst`, and falls back to `repodata.json` only when the compressed variant is not published.
Each index is downloaded once per repository and shared by every dependency that needs it.
A channel index carries no homepage or source URL, so no changelog links are generated for packages resolved that way.

This datasource support following cases:

Look up `numpy` in `conda-forge` channel on anaconda.

```
{
  packageName: 'conda-forge/numpy',
}
```

Look up `numpy` in `conda-forge` channel from prefix.dev using API `https://prefix.dev/api/graphql`.

```
{
  packageName: 'numpy',
  registryUrls: ["https://prefix.dev/conda-forge/"]
}
```

### Multiple channels support

```
{
  packageName: 'some-package',
  registryUrls: [
    "https://api.anaconda.org/package/conda-forge/",
    "https://prefix.dev/conda-forge/",
  ]
}
```

The above example will lookup try to find the package on anaconda first, if the package can not be found on prefix.dev.

### Standard conda channels (`repodata.json`)

A standard conda channel publishes one `repodata.json` index per platform subdir, plus a `noarch` subdir for builds that work on every platform.
There are two ways to point Renovate at one.

Point the `registryUrl` at a single subdir, and the package is resolved from the `repodata.json` of that subdir alone.

```
{
  packageName: 'python',
  registryUrls: ["https://example.com/artifactory/api/conda/conda-virtual/linux-64/"]
}
```

Or point it at the channel and add a `platforms` query parameter naming the platforms that must be supported.
Renovate then reads the index for each of those platforms plus `noarch`, and offers a version only when it is installable on every one of them, meaning the version appears either in that platform subdir or in `noarch`.

```
{
  packageName: 'python',
  registryUrls: ["https://example.com/artifactory/api/conda/conda-virtual?platforms=linux-64,win-64"]
}
```

!!! note
  The `platforms` parameter gives Renovate context and is not part of the channel URL.
  It is removed before the index is requested.

Prefer the `platforms` form whenever a lock file has to solve for several platforms at once, which is what the `pixi` manager emits.
Listing the subdirs as separate `registryUrls` instead cannot express that requirement, because Renovate stops at the first registry that answers.
A package that moved from platform-specific builds to `noarch` would then keep resolving to the stale builds left behind in its platform subdir, since conda channels never remove old builds.

A platform whose subdir the channel does not publish is ignored rather than treated as empty, so one missing subdir does not hide every version.
