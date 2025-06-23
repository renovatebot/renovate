---
title: PHP Composer Support
description: PHP Composer support in Renovate
---

# Automated Dependency Updates for PHP Composer Dependencies

Renovate can upgrade dependencies in PHP's `composer.json` and `composer.lock` files.

## How It Works

1. Renovate searches in each repository for any `composer.json` files
1. Existing dependencies are extracted from the relevant sections of the JSON
1. Renovate resolves the dependency on Packagist (or elsewhere if configured), and filter for SemVer versions
1. A PR is created with `composer.json` and `composer.lock` updated in the same commit
1. If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

## Enabling

Either install the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) for self-hosted.

## Private packages

If you are using a [privately hosted Composer package](https://getcomposer.org/doc/articles/authentication-for-private-packages.md) you can pass the credentials via the [`hostRules`](./configuration-options.md#hostrules) configuration.

```json
{
  "hostRules": [
    {
      "matchHost": "some.vendor.com",
      "hostType": "packagist",
      "username": "<your-username>",
      "password": "<your-password>"
    },
    {
      "matchHost": "bearer-auth.for.vendor.com",
      "hostType": "packagist",
      "token": "abcdef0123456789"
    }
  ]
}
```

This host rule is best added to the bot's `config.js` config so that it is not visible to users of the repository.
If you are using the Mend Renovate App then you can encrypt it with Renovate's public key instead, so that only Renovate can decrypt it.

Go to [https://app.renovatebot.com/encrypt](https://app.renovatebot.com/encrypt), paste in the secret string you wish to encrypt, select _Encrypt_, then copy the encrypted result.
You may encrypt your `password` only, but you can encrypt your `username` as well.

```json
{
  "hostRules": [
    {
      "matchHost": "some.vendor.com",
      "hostType": "packagist",
      "encrypted": {
        "username": "<your-encrypted-username>",
        "password": "<your-encrypted-password>"
      }
    },
    {
      "matchHost": "bearer-auth.for.vendor.com",
      "hostType": "packagist",
      "encrypted": {
        "token": "<your-encrypted-token>"
      }
    }
  ]
}
```
