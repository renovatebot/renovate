Supports conda `environment.yml` files.

Renovate has no concept of conda channels and their different priorities. The manager will open separate PRs for updates from different channels. This allows you to make a decision about which updates to merge.

**Warning**

When enabling the manager, you will get _Package Lookup Warnings_ for all packages that are not present in all channels. This is, again, due to renovate not having a concept of conda channels and treating each package for each channel as a separate dependency. You can safely ignore those warnings for a package if they do not occur for all channels you are using (including the default channels).

**Limitations**

The `conda` manager only supports a subset of the conda environment.yml specification. The following limitations exist:

- Only [release versions](https://docs.conda.io/projects/conda/en/latest/user-guide/concepts/pkg-specs.html#supported-version-strings) that are strictly semantically versioned are supported (e.g. `2.1.5`, but not `3.1.7.6`).
- The default `msys2` channel for Windows is not added when using default channels as renovate does not know which operating system you will use the `environment.yml` file with. If you use Windows, you will have to explicitly include the `msys2` channel to get all updates.
- key-value arguments in dependency specifications are not supported.
- The key `pip` in the `dependencies` list is ignored if it is a list.
- There is no support for the nonstandard keys introduced by [conda-lock](https://github.com/conda-incubator/conda-lock).
