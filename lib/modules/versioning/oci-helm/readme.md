Versioning syntax for OCI Helm Charts.

Helm Charts pushed to an OCI registry generally follow [Semantic Versioning 2.0](https://semver.org).
However, there is a restriction regarding _build information_.
In [Semantic Versioning 2.0](https://semver.org) _build information_ is separated by `+` from the remaining version string.
OCI registry don't support `+` as a tag character.
When pushing Helm Charts to OCI registries, `+` will be translated to `_` to store it as a tag.

Other _versioning_ like `docker`, `helm` or `semver` do not take this into account as it would potentially break existing usages.
That's why this dedicated _versioning_ exists.
It is based off `helm` _versioning_, and internally replaces `_` in retrieved updates with `+` for current value comparison.
The resulting _newValue_ will keep its `+`.
