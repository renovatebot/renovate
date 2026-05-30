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

## Release timestamps

Renovate uses registry-controlled Docker Hub `tag_last_pushed` values as Docker release timestamps by default.
Other Docker and OCI registries often do not expose registry-controlled publish timestamps through the OCI Distribution API.

If you enable `dockerReleaseTimestampSource=metadata`, Renovate can also use client-controlled OCI image metadata for non-Docker-Hub registries.
Renovate checks the `org.opencontainers.image.created` manifest annotation first, then the image config `created` field.
This can make `minimumReleaseAge` usable for registries such as GHCR, Quay, GCR, private registries, and pull-through caches that do not expose a supported registry timestamp.

These metadata timestamps are weaker than registry-controlled timestamps because image publishers, build systems, or an attacker with publish access can set them to arbitrary values.
Some projects also rewrite image `created` timestamps for reproducible builds, so the value may be deterministic rather than a publish time.
Keep the default `dockerReleaseTimestampSource=registry` if you use `minimumReleaseAge` as a strict supply-chain safety control.
Only enable `metadata` when you accept this trade-off.

To avoid excessive registry calls, Renovate only attempts metadata timestamp lookups for the newest Docker releases during a lookup.

If you use [Harbor](https://goharbor.io/) as a proxy cache for Docker Hub, then you must use Harbor version `2.5.0` or higher.
