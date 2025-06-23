Extracts dependencies from `jsonnetfile.json` files, updates `jsonnetfile.lock.json` and updates the `vendor` directory.

Supports [lock file maintenance](../../../configuration-options.md#lockfilemaintenance).

This plugin requires `jsonnet-bundler >= v0.4.0` since previous versions don't support updating single dependencies.
