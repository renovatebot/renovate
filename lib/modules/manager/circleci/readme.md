The `circleci` manager extracts both `docker` as well as `orb` datasources from CircleCI config files.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

### YAML aliases and merge keys

Renovate parses CircleCI config files as YAML 1.2.
Merge keys (`<<`) are a [YAML 1.1](https://yaml.org/type/merge.html) feature and are not part of YAML 1.2.
A config that relies on merge keys can therefore fail to parse — for example, a mapping with more than one `<<` key is rejected as a duplicate key under YAML 1.2.
When parsing fails, Renovate skips the entire file and misses every `docker` and `orb` dependency in it.

To keep merge keys working, add a `%YAML 1.1` directive as the first line of the file:

```yaml
%YAML 1.1
---
version: 2.1
# ... rest of your config
```

CircleCI itself processes merge keys regardless of the directive, so this does not change how your pipeline runs.

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
