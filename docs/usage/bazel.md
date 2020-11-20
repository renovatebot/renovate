---
title: Bazel
description: Bazel dependencies support in Renovate
---

# Bazel

Renovate supports upgrading dependencies in Bazel `WORKSPACE` files.

## How it works

1. Bazel support is enabled automatically
2. Renovate will search repositories for any `WORKSPACE` files in the repository
3. Existing dependencies will be extracted from `git_repository` and `http_archive` declarations
4. Renovate will replace any old versions with the latest version available

## git_repository

Renovate will update any `git_repository` declaration that contains the following:

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

## http_archive and http_file

Renovate will update any `http_archive` or `http_file` declaration that contains the following:

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

## Future work

Contributions and/or feature requests are welcome to support more patterns or additional use cases.
