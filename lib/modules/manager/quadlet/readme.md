Renovate supports updating of Podman Quadlet `.container`, `.image`, or `.volume` files or other files that use the same systemd format (via `managerFilePatterns` configuration).
Updates are performed if there is an Image option in Container, Image, or Volume units:

```ini
[Container]
Image=docker.io/library/alpine:3.22
```

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
