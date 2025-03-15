Renovate supports updating of Docker dependencies within Helm Chart `values.yaml` files or other YAML files that use the same format (via `fileMatch` configuration).
Updates are performed if the files follow the conventional format used in most of the Helm charts:

```yaml
image:
  repository: 'some-docker/dependency'
  tag: v1.0.0
  registry: registry.example.com # optional key, will default to "docker.io"

image:
  repository: 'some-docker/dependency'
  version: v1.0.0

coreImage:
  registry: docker.io
  repository: bitnami/harbor-core
  tag: 2.1.3-debian-10-r38
```

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
