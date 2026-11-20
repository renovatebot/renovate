The `circleci` manager extracts `docker`, `orb` and `github-releases` datasources from CircleCI config files.

[Functions](https://circleci.com/docs/functions/functions-intro/) are read from the top-level `functions:` block, for example `setup-go: github.com/circleci-functions/setup-go@v0.7.0`.
A function is released as a GitHub release of the repository it is named after, so Renovate looks it up with the `github-releases` datasource.
CircleCI only accepts exact function versions, so Renovate updates the exact version.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

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
