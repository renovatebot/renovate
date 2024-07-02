Keeps Copier templates up to date.
Supports multiple `.copier-answers(...).y(a)ml` files in a single repository.
If a template requires unsafe features, Copier must be invoked with the `--trust` flag.
Enabling this behavior must be allowed in the [self-hosted configuration](../../../self-hosted-configuration.md) via `allowScripts`.
Actually enable it in the [configuration](../../../configuration-options.md) by setting `ignoreScripts` to `false`.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
