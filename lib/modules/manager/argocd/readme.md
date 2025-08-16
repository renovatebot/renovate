To use the `argocd` manager you must set your own `managerFilePatterns` pattern.
The `argocd` manager has no default `managerFilePatterns` pattern, because there is no common filename or directory name convention for Argo CD YAML files.
By setting your own `managerFilePatterns` Renovate avoids having to check each `*.yaml` file in a repository for a Argo CD definition.

If you need to change the versioning format, read the [versioning](../../../modules/versioning/index.md) documentation to learn more.

Some configuration examples:

```json title="If most .yaml files in your repository are for Argo CD"
{
  "argocd": {
    "managerFilePatterns": ["/\\.yaml$/"]
  }
}
```

```json title="Argo CD YAML files are in a argocd/ directory"
{
  "argocd": {
    "managerFilePatterns": ["/argocd/.+\\.yaml$/"]
  }
}
```

```json title="One Argo CD file in a directory"
{
  "argocd": {
    "managerFilePatterns": ["/^config/applications\\.yaml$/"]
  }
}
```
