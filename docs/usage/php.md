---
title: PHP Composer Support
description: PHP Composer support in Renovate
---

# Automated Dependency Updates for PHP Composer Dependencies

Renovate supports upgrading dependencies in PHP's `composer.json` files and their accompanying `composer.lock` lock files.

## How It Works

1.  Renovate will search each repository for any `composer.json` files.
2.  Existing dependencies will be extracted from the relevant sections of the JSON
3.  Renovate will resolve the dependency on Packagist or elsewhere if configured, and filter for semver versions
4.  A PR will be created with `composer.json` and `composer.lock` updated in the same commit
5.  If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR.

## Enabling

Either install the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) for self-hosted.

## Private packages

If you are using a [privately hosted Composer package](https://getcomposer.org/doc/articles/authentication-for-private-packages.md) you can pass the credentials via the [`hostRules`](https://docs.renovatebot.com/configuration-options/#hostrules) configuration.

```json
{
  "hostRules": [
    {
      "hostName": "some.vendor.com",
      "hostType": "packagist",
      "username": "<your-username>",
      "password": "<your-password>"
    }
  ]
}
```

This host rule is best added to the bot's `config.js` config so that it is not visible to users of the repository.
If you are using the hosted WhiteSource Renovate App then you can encrypt it with Renovate's public key instead, so that only Renovate can decrypt it.

Go to [https://renovatebot.com/encrypt](https://renovatebot.com/encrypt), paste in the secret string you wish to encrypt, click _Encrypt_, then copy the encrypted result.
You may encrypt your `password` only or even pass your `username` encrypted.

```json
{
  "hostRules": [
    {
      "hostName": "some.vendor.com",
      "hostType": "packagist",
      "encrypted": {
        "username": "<your-encrypted-password",
        "password": "<your-encrypted-password"
      }
    }
  ]
}
```
