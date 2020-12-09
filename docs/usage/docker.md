---
title: Docker
description: Docker Package Manager Support in Renovate
---

# Docker

Renovate supports upgrading dependencies in various types of Docker definition files:

- Docker's `Dockerfile` files
- Docker Compose `docker-compose.yml` files
- CircleCI config files
- Kubernetes manifest files
- Ansible configuration files

## How It Works

1. Renovate searches in each repository for any files matching each manager's configured `fileMatch` pattern(s)
1. Matching files are parsed, Renovate checks if the file(s) contain any Docker image references (e.g. `FROM` lines in a `Dockerfile`)
1. If the image tag in use "looks" like a version (e.g. `node:14`, `node:14.1`, `node:14.1.0`, `node:14-onbuild`) then Renovate checks the Docker registry for upgrades (e.g. from `node:14.1.0` to `node:14.2.0`)

## Preservation of Version Precision

By default, Renovate preserves the precision level specified in the Docker images.
For example, if the existing image is pinned at `node:14.1` then Renovate only proposes upgrades to `node:14.2` or `node:14.3`.
This means that you will not get upgrades to a more specific versions like `node:14.2.0` or `node:14.3.0`.
Renovate does not yet support "pinning" an imprecise version to a precise version, e.g. from `node:14.2` to `node:14.2.0`, however it's a feature we'd like to implement one day.

## Version compatibility

Although suffixes in SemVer indicate pre-releases (e.g. `v1.2.0-alpha.2`), in Docker they typically indicate compatibility, e.g. `12.2.0-alpine`.
By default Renovate assumes suffixes indicate compatibility, for this reason Renovate will not _change_ any suffixes.
Renovate will update `14.1.0-alpine` to `14.1.1-alpine` but never updates to `14.1.1` or `14.1.1-stretch` as that would change the suffix.

If this behavior does not suit a particular package you have, Renovate allows you to customize the `versioning` scheme it uses.
For example, you have a Docker image `foo/bar` that sticks to SemVer versioning.
This means that you need to tell Renovate that suffixes indicate pre-release versions, and not compatibility.

You could then use this `packageRules` array, to tell Renovate to use `semver` versioning for the `foo/bar` package:

```json
{
  "packageRules": [
    {
      "datasources": ["docker"],
      "packageNames": ["foo/bar"],
      "versioning": "semver"
    }
  ]
}
```

Another example is the official `python` image, which follows `pep440` versioning.
You can tell Renovate to use the `pep440` versioning scheme with this set of `packageRules`:

```json
{
  "packageRules": [
    {
      "datasources": ["docker"],
      "packageNames": ["python"],
      "versioning": "pep440"
    }
  ]
}
```

If traditional versioning doesn't work, consider using Renovate's built-in `loose` `versioning`.
It essentially does a best-effort sort of versions, regardless of whether they contain letters or digits.

Finally, if you use a Docker image that follows a versioning approach not captured by any of the existing versioning schemes, and which `loose` sorts incorrectly, you can try the `regex` `versioning`.
It uses regex capture group syntax to let you specify which part of the version string is major, minor, patch, pre-release, or compatibility.
See the docs for `versioning` for documentation and examples of `regex` versioning in action.

## Digest Pinning

We recommend that you pin your Docker images to an exact digest.
By pinning to a digest you ensure your Docker builds are **immutable**: every time you do a `pull` you get the same content.

If you have experience with the way dependency versioning is handled in the JavaScript/npm ecosystem, you might be used to exact versions being immutable.
e.g. if you specify a version like `2.0.1`, you and your colleagues always get the exact same "code".

What you may not expect is that Docker's tags are not immutable versions, even if they look like a version.
e.g. you probably expect `node:14` and `node:14.9` to change over time, but you might incorrectly assume that `node:14.9.0` never changes.
Although it probably _shouldn't_, the reality is that any Docker image tag _can_ change content, and potentially break.

Using a Docker digest as the image's primary identifier instead of using a Docker tag will achieve immutability.
As a human it's quite inconvenient to work with strings like `FROM node@sha256:d938c1761e3afbae9242848ffbb95b9cc1cb0a24d889f8bd955204d347a7266e`.
Luckily Renovate can update the digests for you, so you don't have to.

To keep things human-friendly, Renovate will retain the Docker tag in the `FROM` line, e.g. `FROM node:14.15.1@sha256:d938c1761e3afbae9242848ffbb95b9cc1cb0a24d889f8bd955204d347a7266e`.
Read on to see how Renovate updates Docker digests.

## Digest Updating

If you follow our advice to go from a simple tag like `node:14` to using a pinned digest `node:14@sha256:d938c1761e3afbae9242848ffbb95b9cc1cb0a24d889f8bd955204d347a7266e`, you will receive Renovate PRs whenever the `node:14` image is updated on Docker Hub.

Previously this update would have been "invisible" to you - one day you pull code that represents `node:14.9.0` and the next day you get code that represents `node:14.9.1`.
But you can never be sure, especially as Docker caches.
Perhaps some of your colleagues or worse still your build machine are stuck on an older version with a security vulnerability.

By pinning to a digest instead, you will receive these updates via Pull Requests, or even committed directly to your repository if you enable branch automerge for convenience.
This ensures everyone on the team uses the latest versions and is in sync.

## Version Upgrading

Renovate also supports _upgrading_ versions in Docker tags, e.g. from `node:14.9.0` to `node:14.9.1` or `node:14.9` to `node:14.10`.
If your tags looks like a version, Renovate will upgrade it like a version.

Thanks to this, you may wish to change the way you tag your image dependencies to be more specific, e.g. change from `node:14` to `node:14.9.1` so that every Renovate PR will be more human friendly, e.g. you can know that you are getting a PR because `node` upgraded from `14.9.1` to `14.9.2` and not because `14.9.1` somehow changed.

Currently, Renovate will upgrade minor/patch versions (e.g. from `14.9.0` to `14.9.1`) by default, but not upgrade major versions.
If you wish to enable major versions then add the preset `docker:enableMajor` to your `extends` array in your `renovate.json`.

Renovate has some Docker-specific intelligence when it comes to versions.
For example:

## Configuring/Disabling

If you wish to make changes that apply to all Docker managers, then add them to the `docker` config object.
This is not foolproof, because some managers like `circleci` and `ansible` support multiple datasources that do not inherit from the `docker` config object.

If you wish to override Docker settings for one particular type of manager, use that manager's config object instead.
For example, to disable digest updates for Docker Compose only but leave them for other managers like `Dockerfile`, you would use this:

```json
  "docker-compose": {
    "digest": {
      "enabled": false
    }
  }
```

The following configuration options are applicable to Docker:

##### Disable all Docker Renovation

Add `"docker:disable"` to your `extends` array.

##### Disable Renovate for only certain Dockerfiles

Add all paths to ignore into the `ignorePaths` configuration field. e.g.

```json
{
  "extends": ["config:base"],
  "ignorePaths": ["docker/old-files/"]
}
```

##### Enable Docker major updates

Add `"docker:enableMajor"` to your `extends` array.

##### Disable digest pinning

Add `"default:pinDigestsDisabled"` to your `extends` array.

##### Automerge digest updates

Add `"default:automergeDigest"` to your `extends` array.
Also add `"default:automergeBranchPush"` if you wish for these to be committed directly to your base branch without raising a PR first.

##### Registry authentication

Here is an example of configuring a default Docker username/password in `config.js`:

```js
module.exports = {
  hostRules: [
    {
      hostType: 'docker',
      username: '<your-username>',
      password: '<your-password>',
    },
  ],
};
```

It is possible to add additional host rules following the [documentation](https://docs.renovatebot.com/configuration-options/#hostrules).
For example if you have some images you host yourself that are password protected and also some images you pull from Docker Hub without authentication then you can configure for a specific Docker host like this:

```js
module.exports = {
  hostRules: [
    {
      hostType: 'docker',
      hostName: 'your.host.io',
      username: '<your-username>',
      password: '<your-password>',
    },
  ],
};
```

If you need to configure per-repository credentials then you can also configure the above within a repository's Renovate config (e.g. `renovate.json`);
