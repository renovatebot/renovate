Extracts image references in a `Dockerfile` and/or `Containerfile`.

Renovate's managers does not understand versioning, that's up to Renovate's versioning modules.
The default `docker` versioning for container image datasources treats suffixes as "compatibility", for example: `-alpine`.
Many container images are _not_ SemVer compliant because they use such suffixes in their tags.

If Renovate does not update your container images correctly, you may need to tell Renovate what versioning it should use.
For example, if you know that an image follows SemVer, you can tell Renovate to use `"semver"` versioning for that image:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["whitesource/renovate"],
      "versioning": "semver"
    }
  ]
}
```

Read [Renovate's Docker Versioning](../../versioning/docker/index.md) docs to learn more.
