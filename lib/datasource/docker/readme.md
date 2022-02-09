This datasource identifies an image's source repository according to the [pre-defined annotation keys of the OCI Image Format Specification](https://github.com/opencontainers/image-spec/blob/main/annotations.md).

This datasource looks for the metadata of the **latest stable** image found on the Docker registry and uses the value of the label `org.opencontainers.image.source` as the `sourceUrl`.

The [Label Schema](https://label-schema.org/) is superseded by OCI annotations, therefore this datasource does not support the `org.label-schema.vcs-url` label.
