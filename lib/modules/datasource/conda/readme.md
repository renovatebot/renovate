This datasource returns releases for package from anaconda registry and prefix.dev. Other repositories are not supported currently.

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
