---
title: Private npm module support
description: How to support private npm  modules when using Renovate
---

# Private npm module support

## When are npm private modules used?

Private npm modules are used at two times during Renovate's process.

#### 1. Module lookup

If a private npm module is listed as a dependency in a `package.json`, then Renovate will attempt to keep it up-to-date by querying the npm registry like it would for any other package. Hence, by default a private package lookup will fail, because of lack of credentials. This means it won't be "renovated" and its version will remain unchanged, unless you update it manually. These failures don't affect Renovate's ability to look up _other_ modules in the same package file.

Assuming the private module lookup succeeds (solutions for that are described later in this document) then private module versions will be kept up-to-date like public modules are.

#### 2. Lock file generation

If you are using a lock file (e.g. yarn's `yarn.lock` or npm's `package-lock.json`) then Renovate needs to update that lock file whenever _any_ npm module listed in your `package.json` is updated to a new version.

To do this, Renovate will run `npm install` or `yarn install` and save the resulting lock file. If a private module hasn't been updated, it _usually_ won't matter if npm/yarn can't find it, but it's possible that the install will fail if it attempts to look up a private module and fails, even when that private module is not the main one being updated.

## Supported npm authentication approaches

The recommended approaches for private module authentication are:

**If you are running your own Renovate bot**: copy an `.npmrc` file to the home dir of the bot

**If you are using private modules with npmjs.org**: Add an encrypted `npmToken` to your Renovate config

**If you are using a private registry**: Add an unencrypted `npmrc` plus an encrypted `npmToken` in config

All the various approaches are described below:

### Add/authenticate the "renovate" npm user to your private npm modules

The Renovate app itself runs with credentials for the "renovate" user on npm. Therefore, a simple solution to enabling private modules is to treat Renovate as another account on your team and add the npm user "renovate" to the necessary projects that Renovate needs to access. Renovate will then use its own npm authentication if it finds none configured in your repository.

### Commit .npmrc file into repository

One approach that many projects use for private repositories is to simply check in an authenticated `.npmrc` or `.yarnrc` into the repository that is then shared between all developers. Therefore anyone running `npm install` or `yarn install` from the project root will be automatically authenticated with npm without having to distribute npm logins to every developer and make sure they've run `npm login` first before installing.

The good news is that this works for Renovate too. If Renovate detects a `.npmrc` or `.yarnrc` file then it will use it for its install.

### Add npmrc string to Renovate config

The above solution maybe have a downside that all users of the repository (e.g. developers) will also use any `.npmrc` that is checked into the repository, instead of their own one in `~/.npmrc`. To avoid this, you can instead add your `.npmrc` authentication line to your Renovate config under the field `npmrc`. e.g. a `renovate.json` might look like this:

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

If you don't wish for all users of the repository to be able to see the unencrypted token, you can encrypt it with Renovate's public key instead, so that only Renovate can decrypt it.

Use [renovate-encrypt](https://npmjs.com/package/renovate-encrypt) to encrypt it like so:

```sh
$ echo "abcdefghi-1234-jklmno-aac6-12345567889" | renovate-encrypt
xxT19RIdhAh09lkhdrK39HzKNBn3etoLZAwHdeJ25cX+5y52a9kAC7flXmdw5JrkciN08aQuRNqDaKxp53IVptB5AYOnQPrt8MCT+x0zHgp4A1zv1QOV84I6uugdWpFSjPUkmLGMgULudEZJMlY/dAn/IVwf/IImqwazY8eHyJAA4vyUqKkL9SXzHjvS+OBonQ/9/AHYYKmDJwT8vLSRCKrXxJCdUfH7ZnikZbFqjnURJ9nGUHP44rlYJ7PFl05RZ+X5WuZG/A27S5LuBvguyQGcw8A2AZilHSDta9S/4eG6kb22jX87jXTrT6orUkxh2WHI/xvNUEout0gxwWMDkA==
```

The configure it inside an `encrypted` object like:

```json
{
  "encrypted": {
    "npmToken": "xxT19RIdhAh09lkhdrK39HzKNBn3etoLZAwHdeJ25cX+5y52a9kAC7flXmdw5JrkciN08aQuRNqDaKxp53IVptB5AYOnQPrt8MCT+x0zHgp4A1zv1QOV84I6uugdWpFSjPUkmLGMgULudEZJMlY/dAn/IVwf/IImqwazY8eHyJAA4vyUqKkL9SXzHjvS+OBonQ/9/AHYYKmDJwT8vLSRCKrXxJCdUfH7ZnikZbFqjnURJ9nGUHP44rlYJ7PFl05RZ+X5WuZG/A27S5LuBvguyQGcw8A2AZilHSDta9S/4eG6kb22jX87jXTrT6orUkxh2WHI/xvNUEout0gxwWMDkA=="
  }
}
```

If you have no `.npmrc` file then Renovate will create one for you, pointing to the default npmjs registry. If instead you use an alternative registry or need an `.npmrc` file for some other reason, you should configure it too and substitute the npm token with `${NPM_TOKEN}` for it to be replaced. e.g.

```json
{
  "encrypted": {
    "npmToken": "xxT19RIdhAh09lkhdrK39HzKNBn3etoLZAwHdeJ25cX+5y52a9kAC7flXmdw5JrkciN08aQuRNqDaKxp53IVptB5AYOnQPrt8MCT+x0zHgp4A1zv1QOV84I6uugdWpFSjPUkmLGMgULudEZJMlY/dAn/IVwf/IImqwazY8eHyJAA4vyUqKkL9SXzHjvS+OBonQ/9/AHYYKmDJwT8vLSRCKrXxJCdUfH7ZnikZbFqjnURJ9nGUHP44rlYJ7PFl05RZ+X5WuZG/A27S5LuBvguyQGcw8A2AZilHSDta9S/4eG6kb22jX87jXTrT6orUkxh2WHI/xvNUEout0gxwWMDkA=="
  },
  "npmrc": "registry=https://my.custom.registry/npm\n//my.custom.registry/npm:_authToken=${NPM_TOKEN}"
}
```

Renovate will then use the following logic:

1.  If no `npmrc` string is present in config then one will be created with the `_authToken` pointing to the default npmjs registry
2.  If an `npmrc` string is present and contains `${NPM_TOKEN}` then that placeholder will be replaced with the decrypted token
3.  If an `npmrc` string is present but doesn't contain `${NPM_TOKEN}` then the file will have `_authToken=<token>` appended to it

### Encrypted entire .npmrc file into config

Example:

```
$ npx renovate-encrypt < .npmrc
WOTWu+jliBtXYz3CU2eI7dDyMIvSJKS2N5PEHZmLB3XKT3vLaaYTGCU6m92Q9FgdaM/q2wLYun2JrTP4GPaW8eGZ3iiG1cm7lgOR5xPnkCzz0DUmSf6Cc/6geeVeSFdJ0zqlEAhdNMyJ4pUW6iQxC3WJKgM/ADvFtme077Acvc0fhCXv0XvbNSbtUwHF/gD6OJ0r2qlIzUMGJk/eI254xo5SwWVctc1iZS9LW+L0/CKjqhWh4SbyglP3lKE5shg3q7mzWDZepa/nJmAnNmXdoVO2aPPeQCG3BKqCtCfvLUUU/0LvnJ2SbQ1obyzL7vhh2OF/VsATS5cxbHvoX/hxWQ==
```

You will then get an encrypted string that you can substitute into your renovate.json instead, it will now look something like this:

```json
{
  "encrypted": {
    "npmrc": "WOTWu+jliBtXYz3CU2eI7dDyMIvSJKS2N5PEHZmLB3XKT3vLaaYTGCU6m92Q9FgdaM/q2wLYun2JrTP4GPaW8eGZ3iiG1cm7lgOR5xPnkCzz0DUmSf6Cc/6geeVeSFdJ0zqlEAhdNMyJ4pUW6iQxC3WJKgM/ADvFtme077Acvc0fhCXv0XvbNSbtUwHF/gD6OJ0r2qlIzUMGJk/eI254xo5SwWVctc1iZS9LW+L0/CKjqhWh4SbyglP3lKE5shg3q7mzWDZepa/nJmAnNmXdoVO2aPPeQCG3BKqCtCfvLUUU/0LvnJ2SbQ1obyzL7vhh2OF/VsATS5cxbHvoX/hxWQ=="
  }
}
```

However be aware that if your `.npmrc` is too long to encrypt then the above command will fail.
