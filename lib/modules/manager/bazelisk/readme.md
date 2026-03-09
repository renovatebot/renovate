Simply keeps the `.bazelversion` file updated.

### Lockfile support

When a `MODULE.bazel.lock` file exists in the repository, updating the Bazel version also regenerates the lockfile.
See the [bazel-module manager docs](../bazel-module/readme.md#lockfile-support) for details.
