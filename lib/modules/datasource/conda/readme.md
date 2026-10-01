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
Point the `registryUrl` at a single subdir, and the package is resolved from the `repodata.json` of that subdir alone.

```
{
  packageName: 'python',
  registryUrls: ["https://example.com/artifactory/api/conda/conda-virtual/linux-64/"]
}
```

Renovate prefers the zstd-compressed `repodata.json.zst` and falls back to the plain `repodata.json` when a channel does not publish the compressed variant.
Each index is downloaded once per repository and shared by every dependency resolved from that subdir.

Results from a standard conda channel are not written to the shared package cache, because such channels are usually self-hosted and access controlled.
Set `cachePrivatePackages` to cache them anyway.

!!! tip
  Downloading an index of this size can take longer than the default request timeout.
  If a channel logs `ETIMEDOUT` for its `repodata.json`, raise `timeout` in a `hostRules` entry for that host.
