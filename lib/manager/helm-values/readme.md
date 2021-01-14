Renovate supports updating of Docker dependencies within Helm Chart `values.yaml` files or other YAML files that use the same format (via `fileMatch` configuration).
Updates are performed if the files follow the conventional format used in most of the `stable` Helm charts:

```yaml
image:
  repository: 'some-docker/dependency'
  tag: v1.0.0
  registry: registry.example.com # optional key, will default to "docker.io"
```
