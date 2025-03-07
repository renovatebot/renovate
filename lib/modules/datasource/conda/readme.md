This datasource returns releases for package from anaconda registry and prefix.dev. Other repositories are not supported currently.

This datasource support following cases:

Looks numpy in conda-forge channel on anaconda.

```
{
  packageName: 'conda-forge/numpy',
}
```

Looks numpy in conda-forge channel from https://prefix.dev/api/graphql.

```
{
  packageName: 'numpy',
  registryUrls: ["https://prefix.dev/conda-forge/"]
}
```

Multiple channel support.
Will go to api.anaconda.org first, if datasource can't find this package on anaconda/conda-forge, it will fallback to https://prefix.dev/api/graphql.

```
{
  packageName: 'some-package',
  registryUrls: [
    "https://api.anaconda.org/package/conda-forge/",
    "https://prefix.dev/conda-forge/",
  ]
}
```
