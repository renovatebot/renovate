This datasource returns releases for package from anaconda registry. Third-part repo is not supported currently.

This datasource support following cases:

Default registry url with channel prefixed `packageName`:

```js
{
  packageName: 'conda-forge/numpy',
}
```

```js
{
  packageName: 'conda-forge/numpy',
  registryUrls: [
    "https://api.anaconda.org/package/",
  ]
}
```

Canonical `packageName` with registryUrls including channels info to support multiple channels conda package:

```js
{
  packageName: 'numpy',
  registryUrls: [
    "https://api.anaconda.org/package/cuda/",
    "https://api.anaconda.org/package/conda-forge/",
  ]
}
```

<!-- see https://github.com/renovatebot/renovate/issues/2213#issuecomment-2687645736 for future plan -->
