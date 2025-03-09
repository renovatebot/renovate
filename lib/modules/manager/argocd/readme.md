To use the `argocd` manager you must set your own `filePatterns` pattern.
The `argocd` manager has no default `filePatterns` pattern, because there is no common filename or directory name convention for Argo CD YAML files.
By setting your own `filePatterns` Renovate avoids having to check each `*.yaml` file in a repository for a Argo CD definition.

If you need to change the versioning format, read the [versioning](../../../modules/versioning/index.md) documentation to learn more.

Some configuration examples:

```json title="If most .yaml files in your repository are for Argo CD"
{
  "argocd": {
    "filePatterns": ["/\\.yaml$/"]
  }
}
```

```json title="Argo CD YAML files are in a argocd/ directory"
{
  "argocd": {
    "filePatterns": ["/argocd/.+\\.yaml$/"]
  }
}
```

```json title="One Argo CD file in a directory"
{
  "argocd": {
    "filePatterns": ["/^config/applications\\.yaml$/"]
  }
}
```
