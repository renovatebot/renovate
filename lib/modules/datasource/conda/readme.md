This datasource returns releases for package from anaconda registry and prefix.dev. Other repositories are not supported currently.

This datasource support following cases:

Look up numpy in conda-forge channel on anaconda.

```
{
  packageName: 'conda-forge/numpy',
}
```

Look up numpy in conda-forge channel from https://prefix.dev/api/graphql.

```
{
  packageName: 'numpy',
  registryUrls: ["https://prefix.dev/conda-forge/"]
}
```

### Multiple channels support.

```
{
  packageName: 'some-package',
  registryUrls: [
    "https://api.anaconda.org/package/conda-forge/",
    "https://prefix.dev/conda-forge/",
  ]
}
```

Will lookup in anaconda first, if we can't find this package on anaconda/conda-forge, it will fallback to conda-forge on prefix.dev.
