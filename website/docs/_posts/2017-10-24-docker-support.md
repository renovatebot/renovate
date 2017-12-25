---
date: 2017-10-24
title: Docker Support
categories:
  - deep-dives
description: How Renovate supports Docker image updating
type: Document
order: 20
---

Renovate now supports updating Dockerfile `FROM` sources.

## Docker image digests

One important way that Docker registries differ from npm is that Docker users mostly reference _tags_, and tags are not immutable, meaning that not only might (will) the `node:8` tag change (i.e. what you get today with a Docker pull is not the same as you might get tomorrow) but also tags that look like full versions (e.g. `node:8.7.0`) may also change, if the image publisher wishes to do so. Whereas in npm, a fully specified version is always immutable and won't change on you one day (whether accidentally, deliberately, or maliciously).

Docker registries do support immutable tags in the form of _digests_. Instead of using a tag like `selenium/node-chrome:3.6.0` you can instead use `selenium/node-chrome@sha256:d99b4622b4329bbb563fd1b66c7f6e4b3255394112cb369ca12c8cdc631bc689`. This way you are guaranteed the underlying image won't change, but it's not really human-friendly.

The good news is that it doesn't really need to be human-friendly if humans no longer have to update these FROM lines by hand, and instead use Renovate. <ore good news is that Docker does actually allow you to use both a tag and digest in a FROM line to make it more human-friendly, even if the tag is completely ignored. i.e. you can actually use `selenium/node-chrome:3.6.0@sha256:d99b4622b4329bbb563fd1b66c7f6e4b3255394112cb369ca12c8cdc631bc689`.

## Pin digests

Renovate's default behaviour is therefore to "pin" digests, so that any changes to the underlying image that you pull is therefore deliberate, traceable and revertible.

If you use a plain image name without tag, e.g. `node`, it will be updated to `node@latest:sha256:...................`.

If you use an image name with tag, the digest will be added. e.g. `node:8.7.0` will become `node:8.7.0@sha256:...................` or `node:8` will become `node:8@sha256:...................`.

If you prefer to avoid using digests altogether, you can add `"pinDigests": false` to your `renovate.json` config.

## Digest updating

Once you have pinned digests to your image/tag source, Renovate will keep checking if that tag has a new digest available and raise PRs accordingly.

Therefore you'll still _get_ updates for your desired tags as they're available, but instead of them appearing unannounced and potentially breaking your Docker image, instead they will appear as Renovate Pull Requests so that you are aware that something changed and can accept or reject accordingly.

## Version updating

Renovate also now supports _upgrading_ tags, if those tags include a recognisable semver-like scheme.

For example, `node:6.10` would receive PRs for `node:6.11` and `node:8.7`. Or `node:8.7.0` would receive a PR for `node:8.7.1` if/once it's released. This is supported in addition to the digest updating behaviour described above, although digests have been left off these examples for brevity.

Importantly, Renovate also tries to understand tag suffixes. e.g. if your existing docker image is `node:8.6-onbuild` then Renovate is smart enough to suggest to you `node:8.7-onbuild` and not any other 8.7 upgrades.

Version updating is not enabled by default in Renovate currently. If you wish to try it out, you can add `preview:dockerVersions` to your `extends` array in `renovate.json`.

## Future functionality

Note the current caveats:

* There is no way to turn off the suffix matching (e.g. `-onbuild`) so if someone tagged images like `4.0.0-alpha.1` then you will not receive a PR for `4.0.0-alpha.2` as that would be considered a different suffix.

* Renovate cannot yet differentiate between stable and unstable based on version numbers, e.g. if you run `node:6` then you will get offered `node:7` in additional `node:8` as Renovate doesn't know that odd numbers mean unstable

* Renovate has no rules for LTS vs non-LTS, e.g. it will propose `node:8` as an upgrade to `node:6` even if `node:6` is LTS while `node:8` is just stable

* Similar caveats with `ubuntu`, e.g. it might propose `17.04` as an upgrade from `16.04`

Mostly these caveats are harmless, i.e. you can simply close any unwanted upgrades and they won't be suggested again.
