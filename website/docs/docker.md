---
title: Docker
description: Docker Package Manager Support in Renovate
---

# Docker

Renovate supports upgrading dependencies in various types of Docker definition files:

- Docker's `Dockerfile` files
- Docker Compose files
- CircleCI config files
- Kubernetes manifests
- Ansible configuration iles

## How It Works

1.  Renovate will search each repository for any files matching each manager's configured `fileMatch` pattern(s)
2.  Files are downloaded and then checked to see if they contain any Docker image references (e.g. `FROM` lines in `Dockerfile`s)
3.  If the image tag in use "looks" like a semver (e.g. `node:8`, `node:8.9`, `node:8.9.0`, `node:8-onbuild`) then Renovate will look up the Docker registry to determine if any upgrades are available (e.g. `node:8.9.1`).

## Digest Pinning

Pinning your docker images to an exact digest is recommended for reasons of **immutability**. In short: so every time you `pull`, you get the same content.

If your experience with dependency versioning comes from a place like javascript/npm, you might be used to exact versions being immutable, e.g. if you specify a version like `2.0.1` then you and your colleagues will always get the exact same "code". What you may not expect is that Docker's tags are not immutable versions even if they look like a version. e.g. you probably expect that `node:8` and `node:8.9` will change over time, but you might incorrectly assume that `node:8.9.0` would never change. Although it probably _shouldn't_, the reality is that any Docker image tag _can_ change content, and potentially break.

Using a docker digest as the image's primary identifier instead of docker tag will achieve immutability but as a human it's quite inconvenient to deal with strings like `FROM node@sha256:552348163f074034ae75643c01e0ba301af936a898d778bb4fc16062917d0430`. The good news is that, as a human you no longer need to manually update such digests once you have Renovate on the job.

Also, to retain some human-friendliness, Renovate will actually retain the tag in the `FROM` line too, e.g. `FROM node:8@sha256:552348163f074034ae75643c01e0ba301af936a898d778bb4fc16062917d0430`. Read on to see how Renovate keeps it up-to-date.

## Digest Updating

If you have followed our advice to go from tags like `node:8` to `node:8@sha256:552348163f074034ae75643c01e0ba301af936a898d778bb4fc16062917d0430`, then you are likely to receive Renovate PRs whenever the `node:8` image is updated on Docker Hub.

Previously this would have been "invisible" to you - one day you pull code that represents `node:8.9.0` and the next day you get `node:8.9.1`. But you can never be sure, especially as Docker caches. Perhaps some of your colleagues or worst still your build machine are stuck on an older version with a security vulnerability.

Instead, you will now receive these updates via Pull Requests, or perhaps committed directly to your repository if you enable branch automerge for convenience. This ensures everyone on the team gets the latest versions and is in sync.

## Version Upgrading

Renovate also supports _upgrading_ versions in Docker tags, e.g. from `node:8.9.0` to `node:8.9.1` or `node:8.9` to `node:8.10`. If your tags looks like a version, Renovate will upgrade it like a version.

Thanks to this, you may wish to change the way you tag your image dependencies to be more specific, e.g. change from `node:8` to `node:8.9.1` so that every Renovate PR will be more human friendly, e.g. you can know that you are getting a PR because `node` upgraded from `8.9.1` to `8.9.2` and not because `8.9.1` somehow changed.

Currently, Renovate will upgrade minor/patch versions (e.g. from `8.9.0` to `8.9.1`) by default, but not upgrade major versions. If you wish to enable major versions then add the preset `docker:enableMajor` to your `extends` array in your `renovate.json`.

Renovate has a some docker-specific intelligence when it comes to versions. For example:

- It understands that tag suffixes are frequently used, such as `node:8.9-onbuild`. Renovate will only upgrade from/to the same suffix.
- It understands that some dependencies (e.g. `node` and `ubuntu`) use even numbers for stable and odd for unstable. Renovate won't upgrade from stable to unstable

## Configuring/Disabling

If you wish to make changes that apply to all Docker managers, then add them to the `docker` config object. If you wish to override Docker settings for one particular type of manager, use that manager's config object instead. For example. to disable digest updates for Docker Compose only but leave them for other managers like `Dockerfile`, you would add this:

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

Add `"default:automergeDigest"` to your `extends` array. Also add `"default:automergeBranchPush"` if you wish for these to be committed directly to your base branch without raising a PR first.

##### Registry authentication

If you are running your own Renovate bot, add this to your `config.js`:

```js
module.exports = {
  hostRules: [
    {
      platform: 'docker',
      username: '<your-username>',
      password: '<your-password>',
    },
  ],
};
```

Alternatively, configure `DOCKER_USERNAME` and `DOCKER_PASSWORD` in env to achieve the same.
