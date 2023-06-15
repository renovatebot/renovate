---
title: Bazel
description: Bazel dependencies support in Renovate
---

# Bazel

Renovate supports upgrading dependencies in Bazel `WORKSPACE` files and `MODULE.bazel` files.

## How it works

1. Bazel support is enabled automatically
1. Renovate will search for any `WORKSPACE` and `MODULE.bazel` files in the repository
1. Existing dependencies will be extracted from the files (see below for the supported dependency declarations)
1. Renovate will replace any old versions with the latest version available

## Bazel module (`MODULE.bazel`) support

### Bazel registry discovery

Renovate searches [Bazel registries](https://bazel.build/external/registry) to find new Bazel module versions.
You can customize the registries your Bazel workspace uses by including [`--registry` CLI flag](https://bazel.build/reference/command-line-reference#flag--registry) entries in your [`.bazelrc` files](https://bazel.build/run/bazelrc).
Renovate checks the workspace's `.bazelrc` files for custom registry entries.
If no registries are specified, it will default to the [Bazel Central Registry](https://github.com/bazelbuild/bazel-central-registry).
If you do not set any custom registries, Renovate defaults to the [Bazel Central Registry](https://github.com/bazelbuild/bazel-central-registry).

Here are some important points about Renovate's Bazel registry searches.
Renovate will:

- use _all_ `--registry` flag values found in a workspace's `.bazelrc` file
- use any files that are transitively imported by a `.bazelrc` file
- only use `--registry` flag values that are not associated with [a configuration](https://bazel.build/run/bazelrc#config)
- query the registries in the order that they are found in the `.bazelrc` file

#### Example: multiple `.bazelrc` files

In this example, there is a `.bazelrc` file which imports another file called `.registry.bazelrc`.
Both those files have `--registry` values:

```
# -------------
# .bazelrc File
# -------------
import .registry.bazelrc
build --registry=https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main

# ----------------------
# .registry.bazelrc File
# ----------------------
build --registry=https://example.com/custom_registry
```

The resulting registry list is:

1. `<https://example.com/custom_registry>`
1. `<https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main>`

#### Example: Registry entries using Bazel configuration

In this example, a `.bazelrc` file has registry values with and without a configuration:

```
# -------------
# .bazelrc File
# -------------
build:ci --registry=https://internal.server/custom_registry
build --registry=https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main
```

In this case the `https://internal.server/custom_registry` will be ignored.
The final registry list is:

1. `<https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main>`

### Supported Bazel module declarations

#### `bazel_dep`

Renovate will update the `version` value for a [`bazel_dep`](https://bazel.build/rules/lib/globals/module#bazel_dep) declaration.

```python
bazel_dep(name = "cgrindel_bazel_starlib", version = "0.15.0")
```

In the example above, the `0.15.0` will be evaluated against a repository's registries.
If a new version is found, the value will be replaced with the new version.

#### `git_override`

If Renovate finds a [`git_override`](https://bazel.build/rules/lib/globals/module#git_override), it will ignore the related `bazel_dep` and evaluate the `commit` value at the specified `remote`.

```python
bazel_dep(name = "cgrindel_bazel_starlib", version = "0.15.0")

git_override(
    module_name = "cgrindel_bazel_starlib",
    commit = "fb47f0e9f7c376a7700fc9fe3319231ae57880df",
    remote = "https://github.com/cgrindel/bazel-starlib.git",
)
```

If the primary branch has a newer commit than in the list, Renovate will update the `commit` value.

#### `single_version_override`

The [`single_version_override`](https://bazel.build/rules/lib/globals/module#single_version_override) is a declaration with many purposes.
Renovate evaluates two attributes from this declaration: `version` and `registry`.

If a `version` is specified, it overrides the version specified in the `bazel_dep` pinning it to the specified value.
In the following example, Renovate will note that the version has been pinned to `1.2.3`.
This will result in `rules_foo` being ignored for update evaluation.

```python
bazel_dep(name = "rules_foo", version = "1.2.4")

single_version_override(
  module_name = "rules_foo",
  version = "1.2.3",
)
```

If a `registry` is specified, Renovate will use the specified registry URL to check for a new version.
In the following example, Renovate will only use the `https://example.com/custom_registry` registry to discover `rules_foo` versions.
Any registry values specified in the repository's `.bazelrc` files will be ignored for the `rules_foo` module.

```python
bazel_dep(name = "rules_foo", version = "1.2.3")

single_version_override(
  module_name = "rules_foo",
  registry = "https://example.com/custom_registry",
)
```

#### `archive_override` and `local_path_override`

If Renovate finds an [`archive_override`](https://bazel.build/rules/lib/globals/module#archive_override) or a [`local_path_override`](https://bazel.build/rules/lib/globals/module#local_path_override), it will ignore the related `bazel_dep`.
Because these declarations lack versionable attributes, Renovate will not update them.

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

Renovate will extract dependencies from:

- `container_pull`
- `oci_pull`
- `git_repository`
- `go_repository`
- `maven_install`
- `http_archive` or `http_file` declarations

### `git_repository`

Renovate will update any `git_repository` declaration that has the following:

1. name
1. remote matching `https://github.com/<owner>/<repo>.git`
1. tag using a valid SemVer

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

Renovate will update any `http_archive` or `http_file` declaration that has the following:

1. name
1. url matching `https://github.com/<owner>/<repo>/releases/download/<semver>/<repo>.tar.gz`
1. sha256

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

Contributions and/or feature requests are welcome to support more patterns or additional use cases.
