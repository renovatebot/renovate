Renovate supports updating of Docker dependencies within Helm Chart `values.yaml` files or other YAML files that use the same format (via `fileMatch` configuration).
Updates are performed if the files follow the conventional format used in most of the Helm charts:

```yaml
image:
  repository: 'some-docker/dependency'
  tag: v1.0.0
  registry: registry.example.com # optional key, will default to "docker.io"

coreImage:
  registry: docker.io
  repository: bitnami/harbor-core
  tag: 2.1.3-debian-10-r38
```

If you need to change the versioning format, use a custom `packageRules` configuration:

```json
{
  "packageRules": [
    {
      "packagePatterns": ["^linuxserver\\/"],
      "versionScheme": "regex:^(?<compatibility>.*)-v?(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)?$"
    }
  ]
}
```

The config given above will work for all "three dot" tags with any prefix like: `version-v4.0.681`.
Renovate will track the prefix and only update the three part versions.
