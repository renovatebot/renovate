---
title: Private npm module support
description: How to support private npm modules when using Renovate
---

# Private npm module support

## When are npm private modules used?

Private npm modules are used at two times during Renovate's process:

1. Module lookup
1. Lock file generation

This is explained in more detail below.

### Module lookup

If a private npm module is listed as a dependency in the `package.json` file Renovate attempts to keep it up-to-date.
Renovate queries the npm registry like it does for any other package.
By default Renovate runs without any credentials, and so any private package lookup will fail.
This means, that any private package will not be renovated, and must be updated manually.
The failure to authenticate doesn't affect Renovate's ability to look up _other_ modules in the same package file.

You can fix the private package lookup problem by providing the Renovate bot with the proper credentials.
This is described later in this document.

Assuming the private module lookup succeeds then private package versions will be kept up-to-date like the public package versions are.

### Lock file generation

If you use a lock file (e.g. Yarn's `yarn.lock` or npm's `package-lock.json`) then Renovate must update that lock file whenever _any_ package listed in your package file is updated to a new version.

To do this, Renovate runs `npm install` or equivalent and saves the resulting lock file.
If a private module hasn't been updated, it _usually_ won't matter to npm/Yarn because they won't attempt to update its lock file entry anyway.
However it's possible that the install will fail if it attempts to look up that private module for some reason, even when that private module is not the main one being updated.
It's therefore better to provide Renovate with all the credentials it needs to look up private packages.

## Supported npm authentication approaches

The recommended approaches in order of preference are:

1. **Self-hosted hostRules**: Configure a hostRules entry in the bot's `config.js` with the `hostType`, `hostName` and `token` specified
1. **Renovate App with private modules from npmjs.org**: Add an encrypted `npmToken` to your Renovate config
1. **Renovate App with a private registry**: Add an unencrypted `npmrc` plus an encrypted `npmToken` in config

These approaches are described in full below.

### Add hostRule to bots config

Define `hostRules` like this:

```js
module.exports = {
  hostRules: [
    {
      hostType: 'npm',
      hostName: 'registry.npmjs.org',
      token: process.env.NPMJS_TOKEN,
    },
    {
      hostType: 'npm',
      baseUrl:
        'https://pkgs.dev.azure.com/{organization}/_packaging/{feed}/npm/registry/',
      username: 'VssSessionToken',
      password: process.env.AZURE_NPM_TOKEN,
    },
  ],
};
```

**NOTE:** Do not use `NPM_TOKEN` as an environment variable.

### Add npmrc string to Renovate config

You can add an `.npmrc` authentication line to your Renovate config under the field `npmrc`. e.g. a `renovate.json` might look like this:

```json
{
  "npmrc": "//some.registry.com/:_authToken=abcdefghi-1234-jklmno-aac6-12345567889"
}
```

If configured like this, Renovate will use this to authenticate with npm and will ignore any `.npmrc` files(s) it finds checked into the repository.

### Add npmToken to Renovate config

If you are using the main npmjs registry then you can configure just the npmToken instead:

```json
{
  "npmToken": "abcdefghi-1234-jklmno-aac6-12345567889"
}
```

### Add an encrypted npm token to Renovate config

If you don't want all users of the repository to see the unencrypted token, you can encrypt it with Renovate's public key instead, so that only Renovate can decrypt it.

Go to <https://renovatebot.com/encrypt>, paste in your npm token, click "Encrypt", then copy the encrypted result.

Add the encrypted result inside an `encrypted` object like this:

```json
{
  "encrypted": {
    "npmToken": "xxT19RIdhAh09lkhdrK39HzKNBn3etoLZAwHdeJ25cX+5y52a9kAC7flXmdw5JrkciN08aQuRNqDaKxp53IVptB5AYOnQPrt8MCT+x0zHgp4A1zv1QOV84I6uugdWpFSjPUkmLGMgULudEZJMlY/dAn/IVwf/IImqwazY8eHyJAA4vyUqKkL9SXzHjvS+OBonQ/9/AHYYKmDJwT8vLSRCKrXxJCdUfH7ZnikZbFqjnURJ9nGUHP44rlYJ7PFl05RZ+X5WuZG/A27S5LuBvguyQGcw8A2AZilHSDta9S/4eG6kb22jX87jXTrT6orUkxh2WHI/xvNUEout0gxwWMDkA=="
  }
}
```

If you have no `.npmrc` file then Renovate creates one for you, pointing to the default npmjs registry.
If instead you use an alternative registry or need an `.npmrc` file for some other reason, you should configure it too and substitute the npm token with `${NPM_TOKEN}` for it to be replaced. e.g.

```json
{
  "encrypted": {
    "npmToken": "xxT19RIdhAh09lkhdrK39HzKNBn3etoLZAwHdeJ25cX+5y52a9kAC7flXmdw5JrkciN08aQuRNqDaKxp53IVptB5AYOnQPrt8MCT+x0zHgp4A1zv1QOV84I6uugdWpFSjPUkmLGMgULudEZJMlY/dAn/IVwf/IImqwazY8eHyJAA4vyUqKkL9SXzHjvS+OBonQ/9/AHYYKmDJwT8vLSRCKrXxJCdUfH7ZnikZbFqjnURJ9nGUHP44rlYJ7PFl05RZ+X5WuZG/A27S5LuBvguyQGcw8A2AZilHSDta9S/4eG6kb22jX87jXTrT6orUkxh2WHI/xvNUEout0gxwWMDkA=="
  },
  "npmrc": "registry=https://my.custom.registry/npm\n//my.custom.registry/npm:_authToken=${NPM_TOKEN}"
}
```

Renovate will then use the following logic:

1. If no `npmrc` string is present in config then one will be created with the `_authToken` pointing to the default npmjs registry
1. If an `npmrc` string is present and contains `${NPM_TOKEN}` then that placeholder will be replaced with the decrypted token
1. If an `npmrc` string is present but doesn't contain `${NPM_TOKEN}` then the file will have `_authToken=<token>` appended to it

### Encrypted entire .npmrc file into config

Copy the entire `.npmrc`, replace newlines with `\n` chars, and then try encrypting it at <https://renovatebot.com/encrypt>

You will then get an encrypted string that you can substitute into your `renovate.json` instead.
The end-result looks like this:

```json
{
  "encrypted": {
    "npmrc": "WOTWu+jliBtXYz3CU2eI7dDyMIvSJKS2N5PEHZmLB3XKT3vLaaYTGCU6m92Q9FgdaM/q2wLYun2JrTP4GPaW8eGZ3iiG1cm7lgOR5xPnkCzz0DUmSf6Cc/6geeVeSFdJ0zqlEAhdNMyJ4pUW6iQxC3WJKgM/ADvFtme077Acvc0fhCXv0XvbNSbtUwHF/gD6OJ0r2qlIzUMGJk/eI254xo5SwWVctc1iZS9LW+L0/CKjqhWh4SbyglP3lKE5shg3q7mzWDZepa/nJmAnNmXdoVO2aPPeQCG3BKqCtCfvLUUU/0LvnJ2SbQ1obyzL7vhh2OF/VsATS5cxbHvoX/hxWQ=="
  }
}
```

However be aware that if your `.npmrc` is too long to encrypt then the above command will fail.
