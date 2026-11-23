The `circleci` manager extracts `docker`, `orb` and `github-releases` datasources from CircleCI config files.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

### Functions

[Functions](https://circleci.com/docs/functions/functions-intro/) are read from the top-level `functions:` block, for example:

```yaml
functions:
  setup-go: github.com/circleci-functions/setup-go@v0.7.0
```

Functions are looked up with the `github-releases` datasource, so Renovate only discovers updates for functions named after a GitHub.com repository.

!!! note
  CircleCI only accepts a full `vX.Y.Z` version tag, so Renovate uses [`semver` versioning](../../versioning/semver/index.md) instead of [`github-actions` versioning](../../versioning/github-actions/index.md).
  <br>
  It is also not possible to digest pin these references.

### Private orbs

To get private orbs working you should:

1. Encrypt your CircleCI token with the [Renovate encryption page](https://app.renovatebot.com/encrypt)
1. Create a new `hostRules` entry in your Renovate config file
1. Put the encrypted token in the `token` field

The end-result should look like this:

```json
{
  "hostRules": [
    {
      "matchHost": "circleci.com",
      "authType": "Token-Only",
      "encrypted": {
        "token": "****"
      }
    }
  ]
}
```

This config strips the Bearer/Basic prefix from the `authorization` header.
