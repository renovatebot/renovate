Extracts all Docker images in a `Dockerfile`.

Renovate's managers does not understand versioning, that's up to Renovate's versioning modules.
The default Docker versioning for Docker datasources treats suffixes as "compatibility", for example: `-alpine`.
Many Docker images are _not_ SemVer compliant because they use such suffixes in their tags.

If Renovate does not update your Dockerfile images correctly, you may need to tell Renovate what versioning it should use.
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

Read [Renovate's Docker Versioning](https://docs.renovatebot.com/modules/versioning/#docker-versioning) docs to learn more.
