The `kubernetes` manager has no `fileMatch` default patterns, so it won't match any files until you configure it with a pattern.
This is because there is no commonly accepted file/directory naming convention for Kubernetes YAML files and we don't want to check every single `*.yaml` file in repositories just in case any of them have Kubernetes definitions.

If most `.yaml` files in your repository are Kubernetes ones, then you could add this to your config:

```json
{
  "kubernetes": {
    "fileMatch": ["\\.yaml$"]
  }
}
```

If instead you have them all inside a `k8s/` directory, you would add this:

```json
{
  "kubernetes": {
    "fileMatch": ["k8s/.+\\.yaml$"]
  }
}
```

Or if it's only a single file then something like this:

```json
{
  "kubernetes": {
    "fileMatch": ["^config/k8s\\.yaml$"]
  }
}
```

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
