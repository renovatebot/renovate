---
title: Bazel
description: Bazel dependencies support in Renovate
---

# Bazel

Renovate supports upgrading dependencies in Bazel `WORKSPACE` files and `MODULE.bazel` files.

## How it works

1. Bazel support is enabled automatically
2. Renovate will search for any `WORKSPACE` and `MODULE.bazel` files in the repository
3. Existing dependencies will be extracted from the files (see below for the supported dependency declarations)
4. Renovate will replace any old versions with the latest version available

## Bazel Module (`MODULE.bazel`) Support

### Bazel Registry Discovery

Bazel module version discovery centers around interrogation of one or more [Bazel registries](https://bazel.build/external/registry). 
A Bazel workspace can specify the registries that it uses by including [--registry](https://bazel.build/reference/command-line-reference#flag--registry) entries in [bazelrc files](https://bazel.build/run/bazelrc).
Renovate will inspect a workspace's bazelrc files looking for registries to use during Bazel module version discovery.
If no registries are specified, it will default to the [Bazel Central Registry](https://github.com/bazelbuild/bazel-central-registry).

The following are some important points about Renovate's Bazel registry discovery:
- Renovate will use all `--registry` flag values found in a workspace's `.bazelrc` file or any files transitively imported by the `.bazelrc` file.
- Renovate will only use `--registry` flag values that are not associated with [a configuration](https://bazel.build/run/bazelrc#config).
- Renovate will query the registries in the order that they are found in the bazlerc files.


#### Example: Multiple bazelrc Files

In the following example, there is a `.bazelrc` file that imports a file called `.registry.bazelrc`.
Each of these files contains `--registry` values.

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

1. https://example.com/custom_registry
2. https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main


#### Example: Registry Entries Using Bazel Configuration

In this example, a `.bazelrc` file contains registry value with and without a configuration.

```
# -------------
# .bazelrc File
# -------------
build:ci --registry=https://internal.server/custom_registry
build --registry=https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main
```

In this case the `https://internal.server/custom_registry` will be ignored. The resulting registry list is:

1. https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main

### Supported Bazel Module Declarations

#### `bazel_dep`

The `version` value for a `bazel_dep` declaration will be updated for a 

```python
bazel_dep(name = "cgrindel_bazel_starlib", version = "0.15.0")
```

## Legacy `WORKSPACE` File Support

Existing dependencies will be extracted from `container_pull`, `oci_pull`, `git_repository`, `go_repository`, `maven_install`, and `http_archive`/`http_file` declarations

### `git_repository`

Renovate will update any `git_repository` declaration that has the following:

1. name
2. remote matching `https://github.com/<owner>/<repo>.git`
3. tag using a valid SemVer

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
2. url matching `https://github.com/<owner>/<repo>/releases/download/<semver>/<repo>.tar.gz`
3. sha256

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
