---
date: 2017-07-31
title: Private npm module support
categories:
  - deep-dives
description: How to support private npm  modules when using Renovate
type: Document
order: 30
---

## When are npm private modules used?

Private npm modules are used at two times during Renovate's process.

#### 1. Module lookup

If a private npm module is listed as a dependency in a `package.json`, then Renovate will attempt to keep it up-to-date like all other modules. By default - unless configured otherwise - Renovate will query the main npm registry like it would for a publicly scoped package. Hence, by default a private package lookup will fail, because without authentication npm will answer that the package doesn't exist. This means it won't be "renovated" and its version will remain as it is, unless you update it manually. All other modules can be looked up independently of this and Renovate can detect if they need updating.

Assuming the lookup succeeds (solutions for that are described later in this document) then private modules will be kept up-to-date like public modules are.

#### 2. Lock file generation

If you are using a lock file (yarn's `yarn.lock` or npm's `package-lock.json`) then Renovate needs to regenerate that lock file whenever _any_ npm module listed in your `package.json` is updated to a new version.

To do this, Renovate will run `npm install` or `yarn install` and save the resulting lock file. The "problem" here is that for the install to succeed - and lock file to be generated - then all modules must be found, including private ones. Therefore if a private module can't be found, and you're using lock files, then the private module install failure will then block _any_ module from being renovated.

Because lock files are quickly becoming "the new standard", we think it's essential that Renovate can access/install any private modules necessary.

## Supported npm authentication approaches

#### Authenticate the "renovate" npm user to your private npm module

The Renovate app itself runs with credentials for the "renovate" user on npm. Therefore, a simple solution to enabling private modules is to treat Renovate as another account on your team and add the npm user "renovate" to the necessary projects that Renovate needs to access. Renovate will then use its own npm authentication if it finds none in your repository.

#### Commit .npmrc file into repository

One approach that many projects use for private repositories is to simply check in an authenticated `.npmrc` or `.yarnrc` into the repository that is then shared between all developers. Therefore anyone running `npm install` or `yarn install` from the project root will be automatically authenticated with npm without having to distribute npm logins to every developer and make sure they've run `npm login` first before installing.

The good news is that this works for Renovate too. If Renovate detects a `.npmrc` or `.yarnrc` file then it will use it for its install.

#### Add npmrc string to Renovate config

The above solution maybe have a downside that all users of the repository (e.g. developers) will also use any `.npmrc` that is checked into the repository, instead of their own one in `~/.npmrc`. To avoid this, you can instead add your `.npmrc` authentication line to your Renovate config under the field `npmrc`. e.g. a `renovate.json` might look like this:

```json
{
  "npmrc":
    "//some.registry.com/:_authToken=abcdefghi-1234-jklmno-aac6-12345567889"
}
```

If configured as such, Renovate will use this to authenticate with npm.

Be careful how you do this however. If you simply copy the contents from an `~/.npmrc` on a developer machine and that developer ever logs out on that machine, then the token will be invalidated and Renovate will no longer be able to authenticate. Please generate the token using [npm token](https://docs.npmjs.com/cli/token) instead, and generate it using the option `--read-only`.

#### Add npmToken to Renovate config

If you are using the main npmjs registry then you can configure just the npmToken instead:

```json
{
  "npmToken": "abcdefghi-1234-jklmno-aac6-12345567889"
}
```

It's recommended that you use the [npm token](https://docs.npmjs.com/cli/token) command to generate this token, and generate it using the option `--read-only`.

#### Add encrypted .npmrc file into repository

Even if your repository is private itself, you may still prefer not to put an unencrypted `.npmrc` file into your renovate config. An alternative is to put an _encrypted_ version into the config, inside an `encrypted` configuration block.

If you are using the hosted Renovate app service on GitHub, you can do this using the [renovate-encrypt](https://npmjs.com/package/renovate-encrypt) module. To get an encrypted value, use it like this:

```sh
$ renovate-encrypt < .npmrc
WOTWu+jliBtXYz3CU2eI7dDyMIvSJKS2N5PEHZmLB3XKT3vLaaYTGCU6m92Q9FgdaM/q2wLYun2JrTP4GPaW8eGZ3iiG1cm7lgOR5xPnkCzz0DUmSf6Cc/6geeVeSFdJ0zqlEAhdNMyJ4pUW6iQxC3WJKgM/ADvFtme077Acvc0fhCXv0XvbNSbtUwHF/gD6OJ0r2qlIzUMGJk/eI254xo5SwWVctc1iZS9LW+L0/CKjqhWh4SbyglP3lKE5shg3q7mzWDZepa/nJmAnNmXdoVO2aPPeQCG3BKqCtCfvLUUU/0LvnJ2SbQ1obyzL7vhh2OF/VsATS5cxbHvoX/hxWQ==
```

(if installed globally)

or just run it without installing using `npx`:

```
$ npx renovate-encrypt < .npmrc
WOTWu+jliBtXYz3CU2eI7dDyMIvSJKS2N5PEHZmLB3XKT3vLaaYTGCU6m92Q9FgdaM/q2wLYun2JrTP4GPaW8eGZ3iiG1cm7lgOR5xPnkCzz0DUmSf6Cc/6geeVeSFdJ0zqlEAhdNMyJ4pUW6iQxC3WJKgM/ADvFtme077Acvc0fhCXv0XvbNSbtUwHF/gD6OJ0r2qlIzUMGJk/eI254xo5SwWVctc1iZS9LW+L0/CKjqhWh4SbyglP3lKE5shg3q7mzWDZepa/nJmAnNmXdoVO2aPPeQCG3BKqCtCfvLUUU/0LvnJ2SbQ1obyzL7vhh2OF/VsATS5cxbHvoX/hxWQ==
```

You will then get an encrypted string that you can substitute into your renovate.json instead, it will now look something like this:

```json
{
  "encrypted": {
    "npmrc":
      "WOTWu+jliBtXYz3CU2eI7dDyMIvSJKS2N5PEHZmLB3XKT3vLaaYTGCU6m92Q9FgdaM/q2wLYun2JrTP4GPaW8eGZ3iiG1cm7lgOR5xPnkCzz0DUmSf6Cc/6geeVeSFdJ0zqlEAhdNMyJ4pUW6iQxC3WJKgM/ADvFtme077Acvc0fhCXv0XvbNSbtUwHF/gD6OJ0r2qlIzUMGJk/eI254xo5SwWVctc1iZS9LW+L0/CKjqhWh4SbyglP3lKE5shg3q7mzWDZepa/nJmAnNmXdoVO2aPPeQCG3BKqCtCfvLUUU/0LvnJ2SbQ1obyzL7vhh2OF/VsATS5cxbHvoX/hxWQ=="
  }
}
```

#### Add an encrypted npm token to repository

Similar to the above, but using npm token. As described earlier, use [generate-npm-token](https://npmjs.com/package/generate-npm-token) to generate an npm token and then [renovate-encrypt](https://npmjs.com/package/renovate-encrypt) to encrypt it.

```sh
$ echo "abcdefghi-1234-jklmno-aac6-12345567889" | renovate-encrypt
xxT19RIdhAh09lkhdrK39HzKNBn3etoLZAwHdeJ25cX+5y52a9kAC7flXmdw5JrkciN08aQuRNqDaKxp53IVptB5AYOnQPrt8MCT+x0zHgp4A1zv1QOV84I6uugdWpFSjPUkmLGMgULudEZJMlY/dAn/IVwf/IImqwazY8eHyJAA4vyUqKkL9SXzHjvS+OBonQ/9/AHYYKmDJwT8vLSRCKrXxJCdUfH7ZnikZbFqjnURJ9nGUHP44rlYJ7PFl05RZ+X5WuZG/A27S5LuBvguyQGcw8A2AZilHSDta9S/4eG6kb22jX87jXTrT6orUkxh2WHI/xvNUEout0gxwWMDkA==
```

The configure it like:

```json
{
  "encrypted": {
    "npmToken":
      "xxT19RIdhAh09lkhdrK39HzKNBn3etoLZAwHdeJ25cX+5y52a9kAC7flXmdw5JrkciN08aQuRNqDaKxp53IVptB5AYOnQPrt8MCT+x0zHgp4A1zv1QOV84I6uugdWpFSjPUkmLGMgULudEZJMlY/dAn/IVwf/IImqwazY8eHyJAA4vyUqKkL9SXzHjvS+OBonQ/9/AHYYKmDJwT8vLSRCKrXxJCdUfH7ZnikZbFqjnURJ9nGUHP44rlYJ7PFl05RZ+X5WuZG/A27S5LuBvguyQGcw8A2AZilHSDta9S/4eG6kb22jX87jXTrT6orUkxh2WHI/xvNUEout0gxwWMDkA=="
  }
}
```

## Future npm authentication approaches

#### Webhooks from npm registry

The npm registry allows for owners of packages to send webhooks to custom destinations whenever the package is updated. Using this approach, it would be possible to notify the Renovate App API of updates to your private npm modules and we store these in our database.

An important downside of this approach to be aware of is that this could solve only Use #1 (module lookup) and not Use #2 (Lock file generation). As it seems inevitable that most projects will adopt lock files - especially projects advanced enough to be using private npm modules - this solution is taking a lower priority compared to the first two, because it may ultimately not be required if lock file support becomes as widespread as expected.
