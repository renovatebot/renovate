This datasource identifies an image's source repository according to the [pre-defined annotation keys of the OCI Image Format Specification](https://github.com/opencontainers/image-spec/blob/main/annotations.md).

This datasource looks for the metadata of the **latest stable** image found on the Docker registry and uses the value of the label `org.opencontainers.image.source` and `org.label-schema.vcs-url` as the `sourceUrl`.
Additionally, it uses the value of the label `org.opencontainers.image.revision` as the `gitRef`.

The [Label Schema](https://label-schema.org/) is superseded by OCI annotations, use the `org.opencontainers.image.source` label if possible.

If you maintain a Docker image and want Renovate to find your changelogs, add a `org.opencontainers.image.source` field to your Dockerfile.
The link must point to your GitHub or GitLab repository.
Here's an example from our `renovate/renovate` Dockerfile:

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/renovatebot/renovate"
```

If you use [Harbor](https://goharbor.io/) as a proxy cache for Docker Hub, then you must use Harbor version `2.5.0` or higher.
