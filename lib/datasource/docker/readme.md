This datasource fetches the release note from a source repository specified according to the [pre-defined annotation keys of the OCI Image Format Specification](https://github.com/opencontainers/image-spec/blob/main/annotations.md).

Namely, it will extract the value of label `org.opencontainers.image.source` if it exist **on the latest stable tags**.

The [Label Schema](https://label-schema.org/) is superseded by OCI annotations, therefore this datasource does not support the `org.label-schema.vcs-url` label.
