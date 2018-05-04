---
title: Bazel
description: Bazel dependencies support in Renovate
---

# Bazel

Renovate supports upgrading dependencies in bazel `WORKSPACE` files.

## How It Works

1.  Bazel support is enabled automatically, so you do not have to explicitly configure it to be enabled
2.  Renovate will search repositories for any `WORKSPACE` files in the repository
3.  Existing dependencies will be extracted from `git_repository` and `http_archive` declarations
4.  Renovate will replace any old versions with the latest version available

## git_repository

Renovate will update any `git_repository` declaration that contains the following:

1.  name
2.  remote matching `https://github.com/<owner>/<repo>.git`
3.  tag using a valid semver

Example:

```
git_repository(
    name = "build_bazel_rules_typescript",
    remote = "https://github.com/bazelbuild/rules_typescript.git",
    tag = "0.6.1",
)
```

New versions will be detected using the list of **tags** for that repository on GitHub.

## http_archive

Renovate will update any `http_archive` declaration that contains the following:

1.  name
2.  url matching `https://github.com/<owner>/<repo>/releases/download/<semver>/<repo>.tar.gz`
3.  sha256

Example:

```
http_archive(
    name = "io_bazel_rules_go",
    url = "https://github.com/bazelbuild/rules_go/releases/download/0.7.1/rules_go-0.7.1.tar.gz",
    sha256 = "341d5eacef704415386974bc82a1783a8b7ffbff2ab6ba02375e1ca20d9b031c",
)
```

New versions will be detected using the list of **releases** for that repository on GitHub.

## Future work

Contributions and/or feature requests are welcome to support more patterns or additional use cases.
