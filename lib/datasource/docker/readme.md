This datasource will fetch a release note from a source repository specified according to the [pre-defined annotation keys](https://github.com/opencontainers/image-spec/blob/main/annotations.md) of the OCI Image Format Specification.

Namely, it will extract the value of label `org.opencontainers.image.source` if it exist **on the latest stable tags**.

[Label Schema](https://label-schema.org/) is now superceded by OCI by annotations, and this datasource do not support `org.label-schema.vcs-url` label.
