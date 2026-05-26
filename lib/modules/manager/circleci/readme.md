The `circleci` manager extracts both `docker` as well as `orb` datasources from CircleCI config files.

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
