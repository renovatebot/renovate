---
title: Node.js Versions
description: Node versions support in Renovate
---

# Node.js Versions

Renovate can upgrade the [Node.js](https://nodejs.org/en/) runtime used by your project so that you're using the latest bug fixes, performance improvements, security mitigations, etc. that meet your project's unique needs.

## File Support

Renovate is capable of managing the Node.js version in the following files:

- The [`engines`](https://docs.npmjs.com/files/package.json#engines) field in [`package.json`](https://docs.npmjs.com/files/package.json).
- The [`.nvmrc`](https://github.com/creationix/nvm#nvmrc) file for the [Node Version Manager](https://github.com/creationix/nvm).
- The [`node_js`](https://docs.travis-ci.com/user/languages/javascript-with-nodejs/#Specifying-Node.js-versions) field in [`.travis.yml`](https://docs.travis-ci.com/user/customizing-the-build/).

## How It Works

Node.js renovation in `package.json > engines` and in `.nvmrc` is enabled by default, if your existing version is pinned.

To enable `.travis.yml` renovation, you must:

1.  Enable Travis renovation explicitly by setting the following Renovate configuration: `"travis": { "enabled": true }`
2.  Optionally, configure a support policy (As documented below).

When Renovate processes your project's repository it will look for the files listed above and submit a single pull request that upgrades all Node.js versions simulteniously.

## Configuring Support Policy

Renovate supports a [`supportPolicy`](configuration-options/#supportpolicy) option that can be passed the following values and associated versions (current as of December 2017):

**Default:** `lts`

| supportPolicy | versions | description                                               |
| ------------- | -------- | --------------------------------------------------------- |
| lts           | 6,8,10   | All releases classified as LTS, including in maintenance  |
| active        | 8,10,11  | All releases classified as active and not maintenance     |
| current       | 11       | The latest Node.js classified as "current"                |
| lts_active    | 8,10     | All releases classified as Active LTS and not maintenance |
| lts_latest    | 10       | The latest LTS release                                    |

The version numbers associated with each support policy will be updated as new versions of Node.js are released, moved to LTS or maintenance, etc.

For example, to instruct Renovate to upgrade your project to the latest [Long-term Support](https://github.com/nodejs/Release#release-plan) release, you can use the following configuration:

```json
"supportPolicy": ["lts_latest"]
```

It's best to define this support policy inside the `node` configuration object so that it is applied to all Node.js-related files.

For additional language support see the [`supportPolicy` documentation](configuration-options/#supportpolicy).
