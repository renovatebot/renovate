---
title: Bazel
description: Bazel dependencies support in Renovate
---

# Bazel

Renovate upgrades dependencies in Bazel `WORKSPACE` files and `MODULE.bazel` files.

## How it works

1. Bazel support is enabled automatically
1. Renovate searches the repository for any `WORKSPACE` and `MODULE.bazel` files
1. Renovate extracts the dependencies it finds from the files (see below for the supported dependency declarations)
1. Renovate updates old dependencies to the latest version

## Bazel module (`MODULE.bazel`) support

### Bazel registry discovery

Renovate searches [Bazel registries](https://bazel.build/external/registry) to find new Bazel module versions.
You customize the registries your Bazel workspace uses by including [`--registry`](https://bazel.build/reference/command-line-reference#flag--registry) entries in your [`.bazelrc` files](https://bazel.build/run/bazelrc).
Renovate checks the workspace's `.bazelrc` files for custom registry entries.
If no registries are found, Renovate defaults to the [Bazel Central Registry](https://bcr.bazel.build/).

Here are some important points about Renovate's Bazel registry searches.
Renovate:

- uses _all_ `--registry` values found in a workspace's `.bazelrc` file
- uses any files that are transitively imported by a `.bazelrc` file
- only uses `--registry` values that are not associated with [a configuration](https://bazel.build/run/bazelrc#config)
- queries the registries in the order that they are found in the `.bazelrc` file

#### Example: multiple `.bazelrc` files

In this example, there is a `.bazelrc` file which imports another file called `.registry.bazelrc`.
Both files have `--registry` values:

```title=".bazelrc"
import .registry.bazelrc
build --registry=https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main
```

```title=".registry.bazelrc"
build --registry=https://example.com/custom_registry
```

The final registry list is:

1. `<https://example.com/custom_registry>`
1. `<https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main>`

#### Example: registry entries using Bazel configuration

In this example, a `.bazelrc` file has registry values with and without a configuration:

```title=".bazelrc"
build:ci --registry=https://internal.server/custom_registry
build --registry=https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main
```

In this case the `https://internal.server/custom_registry` is ignored.
The final registry list is:

1. `<https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main>`

### Supported Bazel module declarations

#### `bazel_dep`

Renovate updates the `version` value for a [`bazel_dep`](https://bazel.build/rules/lib/globals/module#bazel_dep) declaration.

```python
bazel_dep(name = "cgrindel_bazel_starlib", version = "0.15.0")
```

In the example above, Renovate evaluates the `0.15.0` version against the repository's registries.
If Renovate finds a newer version, it updates `0.15.0` to match that version.

#### `git_override`

If Renovate finds a [`git_override`](https://bazel.build/rules/lib/globals/module#git_override), it ignores the related `bazel_dep` entry and instead evaluates the `commit` value at the specified `remote`.

```python
bazel_dep(name = "cgrindel_bazel_starlib", version = "0.15.0")

git_override(
    module_name = "cgrindel_bazel_starlib",
    commit = "fb47f0e9f7c376a7700fc9fe3319231ae57880df",
    remote = "https://github.com/cgrindel/bazel-starlib.git",
)
```

If the primary branch has a newer commit than in the list, Renovate updates the `commit` value.

#### `single_version_override`

The [`single_version_override`](https://bazel.build/rules/lib/globals/module#single_version_override) is a declaration with many purposes.
Renovate only evaluates _two_ attributes from this declaration: `version` and `registry`.

If a `version` is specified, it overrides the version in the `bazel_dep`.
In the following example, Renovate notices that the version is pinned to `1.2.3`.
This results in `rules_foo` being ignored for update evaluation.

```python
bazel_dep(name = "rules_foo", version = "1.2.4")

single_version_override(
  module_name = "rules_foo",
  version = "1.2.3",
)
```

If a `registry` is specified, Renovate uses the specified registry URL to check for a new version.
In the following example, Renovate only uses the `https://example.com/custom_registry` registry to discover `rules_foo` versions.
Any registry values specified in the repository's `.bazelrc` files are ignored for the `rules_foo` module.

```python
bazel_dep(name = "rules_foo", version = "1.2.3")

single_version_override(
  module_name = "rules_foo",
  registry = "https://example.com/custom_registry",
)
```

#### `archive_override` and `local_path_override`

If Renovate finds an [`archive_override`](https://bazel.build/rules/lib/globals/module#archive_override) or a [`local_path_override`](https://bazel.build/rules/lib/globals/module#local_path_override), it ignores the related `bazel_dep`.
Because these declarations lack versionable attributes, Renovate does not update them.

```python
bazel_dep(name = "rules_foo", version = "1.2.3")

archive_override(
  module_name = "rules_foo",
  urls = [
    "https://example.com/archive.tar.gz",
  ],
)
```

#### `multiple_version_override`

Renovate ignores [`multiple_version_override`](https://bazel.build/rules/lib/globals/module#multiple_version_override).
`multiple_version_override` does not affect the processing of version updates for a module.

## Legacy `WORKSPACE` files

Renovate extracts dependencies from the following repository rules:

- `container_pull`
- `oci_pull`
- `git_repository`
- `go_repository`
- `maven_install`
- `http_archive`
- `http_file`

It also recognizes when these repository rule names are prefixed with an underscore.
For example, `_http_archive` is treated the same as `http_archive`.

### `git_repository`

Renovate updates any `git_repository` declaration that has the following:

1. `name`
1. `remote` matching `https://github.com/<owner>/<repo>.git`
1. `tag` using a valid SemVer

e.g.:

```
git_repository(
    name = "build_bazel_rules_typescript",
    remote = "https://github.com/bazelbuild/rules_typescript.git",
    tag = "0.6.1",
)
```

Renovate uses the list of **tags** on the remote repository (GitHub) to detect a new version.

### `http_archive` and `http_file`

Renovate updates any `http_archive` or `http_file` declaration that has the following:

1. `name`
1. `url` matching `https://github.com/<owner>/<repo>/releases/download/<semver>/<repo>.tar.gz`
1. `sha256`

e.g.:

```
http_archive(
    name = "io_bazel_rules_go",
    url = "https://github.com/bazelbuild/rules_go/releases/download/0.7.1/rules_go-0.7.1.tar.gz",
    sha256 = "341d5eacef704415386974bc82a1783a8b7ffbff2ab6ba02375e1ca20d9b031c",
)
```

Renovate uses the list of **releases** that it finds at the `url` to detect a new version.

### `maven_install`

By default, Maven dependencies are extracted in the context of Gradle versioning scheme.
To change it, configure `packageRules` like this:

```json
{
  "packageRules": [
    {
      "matchManagers": ["bazel"],
      "matchDatasources": ["maven"],
      "versioning": "maven"
    }
  ]
}
```

## Future work

We welcome contributions or feature requests to support more patterns or use cases.
