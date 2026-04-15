The `bazel` datasource is designed to query one or more [Bazel registries](https://bazel.build/external/registry) or file based BCR using the first successful result.

When using the default [Bazel Central Registry](https://registry.bazel.build/), release timestamps are fetched from the BCR UI, enabling support for `minimumReleaseAge`. The timestamp reflects when the module version was merged into the BCR. This is not available for custom or file-based registries.
