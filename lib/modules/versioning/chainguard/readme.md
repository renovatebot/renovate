The Chainguard versioning scheme is used by [Wolfi/Chainguard OS](https://www.chainguard.dev/unchained/introducing-wolfi-the-first-linux-un-distro-designed-for-securing-the-software-supply-chain) Docker/OCI images (`cgr.dev/...`).

The versioning extends the `alpine` versioning with additional support for the [unique tags](https://edu.chainguard.dev/chainguard/chainguard-images/features/unique-tags/) feature as well as special handling of Chainguard's `-dev` suffix.

While Chainguard creates/updates the standard `latest` tag for each image which can be used via the existing `docker` datasource, typically you want to specify an exact version/tag of an image to deploy/use. Generally, Chainguard images are versioned/tagged using the version of the core package the image is based on/for, as an example: The [cert-manager-webhook](https://images.chainguard.dev/directory/image/cert-manager-webhook/overview) image will be tagged directly based on the version (including the revision/epoch) of the `cert-manager` APK package it contains.

However, because an image contains multiple packages, not just the main package, an additional version field can be incremented anytime a dependency like `glibc` is updated but the main package remains on the same version. This is handled by Chainguard’s [unique tags](https://edu.chainguard.dev/chainguard/chainguard-images/images-features/unique-tags/) feature which adds a (always incrementing) date timestamp when the image was built in the format `-%Y%m%d%H%M`. So using the [cert-manager-webhook](https://github.com/wolfi-dev/os/blob/main/cert-manager-1.14.yaml) image as an example, we could have the following tags:

- `1.14.2-r0-202402261115`: The first build of `1.14.2`
- `1.14.2-r0-202403060824`: A dependency like `glibc` is updated
- `1.14.2-r1-202403070335`: A CVE in `cert-manager` is identified/patched by Chainguard
- `1.14.2-r1-202403081212`: A dependency like `busybox` is updated

The `chainguard` versioning scheme correctly handles parsing/incrementing these versions as well as the `-dev` suffix.
