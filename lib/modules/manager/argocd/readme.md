The `argocd` manager has no `fileMatch` default patterns, so it won't match any files until you configure it with a pattern.
This is because there is no commonly accepted file/directory naming convention for argocd YAML files and we don't want to check every single `*.yaml` file in repositories just in case any of them have ArgoCD definitions.

If most `.yaml` files in your repository are argocd ones, then you could add this to your config:

```json
{
  "argocd": {
    "fileMatch": ["\\.yaml$"]
  }
}
```

If instead you have them all inside a `argocd/` directory, you would add this:

```json
{
  "argocd": {
    "fileMatch": ["argocd/.+\\.yaml$"]
  }
}
```

Or if it's only a single file then something like this:

```json
{
  "argocd": {
    "fileMatch": ["^config/applications\\.yaml$"]
  }
}
```

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.
