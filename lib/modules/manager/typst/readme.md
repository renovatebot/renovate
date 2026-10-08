Manages versions of Typst package imports in `.typ` files for update.

The Typst datasource fetches package information from the [official public Typst index](https://packages.typst.org/preview/index.json).
Only the `preview` namespace is supported. Local and other unsupported namespaces are skipped.
Custom registries are not supported.
