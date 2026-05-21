Simply keeps the `.bazelversion` file updated.

### Lockfile support

When a `MODULE.bazel.lock` file exists in the repository, updating the Bazel version also regenerates the lockfile.
See the [bazel-module manager docs](../bazel-module/index.md#lockfile-support) for details.

It will only run if the [`allowedUnsafeExecutions`](../../../self-hosted-configuration.md#allowedunsafeexecutions) global option includes `bazelModDeps`.
