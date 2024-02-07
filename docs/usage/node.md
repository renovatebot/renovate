---
title: Node.js Versions
description: Node.js versions support in Renovate
---

# Node.js Versions

Renovate can upgrade the [Node.js](https://nodejs.org/en/) runtime used by your project.
This way you're using the latest bug fixes, performance improvements, security mitigations, etc.

## LTS codenames

Renovate understands [codenames for Node.js LTS releases](https://github.com/nodejs/Release/blob/main/CODENAMES.md) and will offer upgrades for them (e.g. from `fermium` to `gallium`) as long as the `node` versioning scheme is being used.

## File Support

Renovate can manage the Node.js version in the following files:

- The [`engines`](https://docs.npmjs.com/files/package.json#engines) field in [`package.json`](https://docs.npmjs.com/files/package.json)
- The [`volta`](https://docs.volta.sh/guide/understanding#managing-your-project) field in [`package.json`](https://docs.npmjs.com/files/package.json)
- The [`.nvmrc`](https://github.com/creationix/nvm#nvmrc) file for the [Node Version Manager](https://github.com/creationix/nvm)
- The [`.node-version`](https://github.com/nodenv/nodenv#choosing-the-node-version) file for the [nodenv](https://github.com/nodenv/nodenv) environment manager
- The [`.tool-versions`](https://asdf-vm.com/manage/configuration.html#tool-versions) file for the [asdf](https://github.com/asdf-vm/asdf) version manager
- The [`node_js`](https://docs.travis-ci.com/user/languages/javascript-with-nodejs/#Specifying-Node.js-versions) field in [`.travis.yml`](https://docs.travis-ci.com/user/customizing-the-build/)

## Configuring which version of npm Renovate uses

When `binarySource=docker` or `binarySource=install`, such as in the Mend Renovate App, Renovate will choose and install an `npm` version dynamically.

To control which version or constraint is installed, you should use the `engines.npm` property in your `package.json` file.
Renovate bot will then use that version constraint for npm when it creates a pull request.

For example, if you want to use at least npm `8.1.0` and also allow newer versions of npm in the `8.x` range, you would put this in your `package.json` file:

```json title="package.json"
{
  "engines": {
    "npm": "^8.1.0"
  }
}
```

Alternatively, the npm version can also be configured via the [`constraints` option](./configuration-options.md#constraints).
