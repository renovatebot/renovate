---
title: Private module support
description: How to support private modules when using Renovate
---

# Private module support

It's a very common requirement to be able to support private module/dependency lookups.
This page describes Renovate's approach to authentication.

First, a quick note on terminology:

- The terms `module`, `package` and `dependency` can mostly be used interchangeably below
- The terms `credentials`, `secrets` and `authentication` are also used interchangeably

## When does Renovate need credentials?

By default, the only credentials Renovate has are those for the "platform", i.e. GitHub, GitLab, etc.
If the token used has sufficient permissions, this will enable Renovate to lookup dependencies located in alternative repositories on the same host or any hosted on any embedded package registry on the same host.

It's also quite common to need to look up packages on other protected hosts, including npmjs, Docker Hub, or private registries like Nexus or Artifactory.
Any time you need Renovate to access such registries with credentials then you will need to provision them as part of your config.

There are four times in Renovate's behavior when it may need credentials:

- Resolving private config presets
- Looking up dependency versions
- Looking up release notes
- Passing to package managers when updating lock files or checksums

Note: if you self-host Renovate, and have a self-hosted registry which _doesn't_ require authentication to access, then such modules/packages are not considered "private" to Renovate.

## Private Config Presets

Renovate supports config presets, including those which are private.

Although npm presets were the first type supported, they are now deprecated and it is recommend that all users migrate to git-hosted "local" presets instead.
However if you do still use them, private modules should work if you configure the `npmrc` file including token credentials in your bot admin config.
Credentials stored on disk (e.g. in `~/.npmrc`) are no longer supported.

The recommended way of using local presets is to configure then using "local" presets, e.g. `"extends": ["local>myorg/renovate-config"]`, and ensure that the platform token has access to that repo.

It's not recommended that you use a private repository to host your config while then extending it from a public repository.
If your preset doesn't contain secrets then you should make it public, while if it does contain secrets then it's better to split your preset between a public one which all repos extend, and a private one with secrets which only other private repos extend.

In summary, the recommended approach to private presets is:

- Host the presets on the same server/platform as other repositories
- Make sure you install Renovate into the preset repository so that it has credentials to access it from other private repos
- Use `local>....` syntax to refer to private presets

## Dependency Version Lookups

Whenever Renovate detects that a project uses a particular dependency, it attempts to look up that dependency to see if any new versions exist.
If such a package is private, then Renovate must be configured with the relevant credentials.
Renovate does not use any package managers for this step and performs all HTTP(S) lookups itself, including insertion of authentication headers.

Configuring Renovate with credentials requires `hostRules`.
Each host rule consists of a `hostType` value and/or a way to match against hosts using `baseUrl`, `hostName` or `domainName`.

`hostType` is not particularly important at this step unless you have different credentials for the same host, however it is sometimes useful in later steps so is good to include if you can.
It can be either a "platform" name (e.g. `github`, `azure`, etc) or a "datasource" name (e.g. `npm`, `maven`, `github-tags`, etc).

`baseUrl` can be used if you want to only apply the credentials for a nested path within the host, e.g. `https://registry.company.com/nested/path/`.
If the same credentials apply to all paths on a host, then use `hostName` instead, e.g. `registry.company.com`.
Finally, to apply credentials to all hosts within the domain, use `domainName`, e.g. `company.com`.
You need to pick _only one_ of these and not configure more than one of these fields within the same host rule, otherwise it will error.

In addition to the above options to match against a host, you need to add the credentials.
Typically they are either `token`, or `username` + `password`.
Other credential terms are not supported yet.

Here is an example of some host rules:

```json
{
  "hostRules": [
    {
      "hostName": "registry.npmjs.org",
      "token": "abc123"
    },
    {
      "baseUrl": "https://registry.company.com/pypi-simple/",
      "username": "engineering",
      "password": "abc123"
    }
  ]
}
```

Renovate applies theses `hostRules` to every HTTP(s) request which is sent, so they are largely independent of any platform or datasource logic.
With `hostRules` in place, private package lookups should all work.

## Looking up Release Notes

When Renovate creates Pull Requests, its default behavior is to locate and embed release notes/changelogs of packages.
These release notes are fetched from the source repository of packages and not from the registries themselves, so if they are private then they will require different credentials.

When it comes to open source, most packages host their source on `github.com` in public repositories.
However, GitHub greatly rate limits unauthenticated API requests so there is a need to configure credentials for github.com as otherwise the bot will get rate limited quickly.
It can be confusing for people who host their own source code privately to be asked to configure a `github.com` token but without it Release Notes for most open source packages will be blocked.

Currently the preferred way to configure `github.com` credentials for self-hosted Renovate is:

- Create a read-only Personal Access Token (PAT) for a `github.com` account. This can be any GitHub account, it might be better to create a "empty" account just for this purpose.
- Add the PAT to Renovate using the environment variable `GITHUB_COM_TOKEN`

## Package Manager Credentials for Artifact Updating

In Renovate terminology, "artifacts" includes lock files, checksum files, and vendored dependencies.
One way of understanding artifacts is: "everything else that needs to be updated when the dependency version changes".

Not all package managers supported by Renovate require artifact updating, because not all use lock or checksum files.
But when such files need updating, Renovate does so by using the package managers themselves instead of trying to "reverse engineer" each package manager's file formats and behavior.
Importantly, such package managers are run via shell commands and do not understand Renovate's `hostRules` objects, so Renovate needs to reformat the credentials into formats (such as environment variables or configuration files) which the package manager understands.

Because of this need to convert `hostRules` credentials into a format which package managers understand, sometimes artifact updating can fail due to missing credentials.
Sometimes this can be resolved by changing Renovate configuration, but other times it may be due to a feature gap.
The following details the most common/popular manager artifacts updating and how credentials are passed:

### bundler

`hostRules` with `hostType=rubygems` are converted into environment variables which Bundler supports.

### composer

Any `hostRules` token for `github.com` or `gitlab.com` are found and written out to `COMPOSER_AUTH` in env for Composer to parse.
Any `hostRules` with `hostType=packagist` are also included.

### gomod

If a `github.com` token is found in `hostRules`, then it is written out to local git config prior to running `go` commands.
The command run is `git config --global url."https://${token}@github.com/".insteadOf "https://github.com/"`.

### npm

The best way to do this now is using `hostRules` and no longer via `.npmrc` files on disk or in config.
`hostRules` credentials with `hostType=npm` are written to a `.npmrc` file in the same directory as the `package.json` being updated.
See [private npm modules](./private-npm-modules) for more details.

### nuget

For each known NuGet registry, Renovate searches for `hostRules` with `hostType=nuget` and matching host.
For those found, a command similar to the following is run: `dotnet nuget add source ${registryInfo.feedUrl} --configfile ${nugetConfigFile} --username ${username} --password ${password} --store-password-in-clear-text`

### poetry

For every poetry source, a `hostRules` search is done and then any found credentials are added to env like `POETRY_HTTP_BASIC_X_USERNAME` and `POETRY_HTTP_BASIC_X_PASSWORD`.

## WhiteSource Renovate Hosted App Encryption

The popular [Renovate App on GitHub](https://github.com/apps/renovate) is hosted by WhiteSource.
If you are a user of this app, and have private modules, then the following is applicable.

### Private presets with public repositories

If you have a preset in a private repo but reference ("extend") it from a public repository then it won't work.
This is because public repositories are provided with a token scoped to only that particular repository, and not for all repositories within the organization.
This is a security measure so that if a the token is accidentally leaked publicly, the damage is limited to the public repository it leaked to and not to every repository within the organization.

The solution to this is that you should break your presets into public and private ones, and reference only the public ones from public repositories.

### Encrypting secrets

It is strongly recommended that you don't commit secrets to repositories, including private ones, and this includes secrets needed by Renovate to access private modules.
Therefore the preferred approach to secrets is that the bot administrator configures them as `hostRules` which are then applied to all repositories which the bot accesses.

If you need to provide credentials to the hosted Renovate App, please do this:

- Encrypt each secret string using <https://app.renovatebot.com/encrypt>. Note: this encrypts using the app's public key fully in the browser and does not send the original secret to any server. You can download this file and perform the encryption fully offline if you like.
- Wrap each secret field in an [encrypted](https://docs.renovatebot.com/configuration-options/#encrypted) object and paste in the encrypted secret value instead. An example is shown below:

```json
{
  "hostRules": [
    {
      "hostName": "registry.npmjs.org",
      "encrypted": {
        "token": "3f832f2983yf89hsd98ahadsjfasdfjaslf............"
      }
    },
    {
      "baseUrl": "https://custom.registry.company.com/pypi/",
      "username": "bot1",
      "encrypted": {
        "password": "p278djfdsi9832jnfdshufwji2r389fdskj........."
      }
    }
  ]
}
```

### Access to GitHub Actions Secrets

The WhiteSource Renovate App does not run using GitHub Actions, but such secrets would be a bad fit for the app anyway for the following reasons:

- The app would be granted access to _all_ the repository/org secrets, not just the ones you want
- If Renovate wants access to such secrets, it would need to ask for them from every user, not just the ones who want to use this approach (GitHub does not support the concept of optional permissions for Apps, so people do not have the option to decline)

## Admin/Bot config vs User/Repository config for Self-hosted users

"AdminBot config" refers to the config which the Renovate Bot administrator provides at bot startup, e.g. using environment variables, CLI parameters, or the `config.js` configuration file.
User/Repository config refers to the in-repository config file which defaults to `renovate.json` but has a large number of alternative filenames supported.

If there is a need to supply custom rules for certain repository, it can still be done using the `config.js` file and the `repositories` array.

If per-repository config must be done within the repository, it is still recommended against committing secrets directly (including e.g. `.npmrc` files with tokens) and instead encrypting them with a custom public key first.
For instructions on this, see the above section on encrypting secrets for the WhiteSource Renovate App but instead:

- Save a copy of the <https://app.renovatebot.com/encrypt> HTML file locally, or host it locally
- Generate a public/private key pair for the app using the instructions in [privateKey](https://docs.renovatebot.com/self-hosted-configuration/#privatekey)
- Replace the existing public key in the HTML with the public key you generated in the step prior
- Use the resulting HTML encrypt page to encrypt secrets for your app before adding them to user/repository config
- Configure the app to run with `privateKey` set to the private key you generated above
