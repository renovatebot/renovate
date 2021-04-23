---
title: Private module support
description: How to support private modules when using Renovate
---

# Private module support

It's a very common requirement to be able to support private module/dependency lookups. This page describes Renovate's approach to authentication.

First, a quick note on terminology:

- The terms `module`, `package` and `dependency` can mostly be used interchangeably below
- The terms `credentials`, `secrets` and `authentication` are also used interchangeably

## When does Renovate need credentials?

By default, the only credentials Renovate has are those for the "platform", i.e. GitHub, GitLab, etc. If the token used has sufficient permissions, this will enable Renovate to lookup dependencies located in alternative repositories on the same host or any hosted on any embedded package registry on the same host.

It's also quite common to need to look up packages on other protected hosts, including npmjs, Docker Hub, or private registries like Nexus or Artifactory. Any time you need Renovate to access such registries with credentials then you will need to provision them as part of your config.

There are four times in Renovate's behavior when it may need credentials:

- Resolving private config presets
- Looking up dependency versions
- Looking up release notes
- Passing to package managers when updating lock files or checksums

Note: if you self-host Renovate, and have a self-hosted registry which _doesn't_ require authentication to access, then such modules/packages are not considered "private" to Renovate.

## Private Config Presets

Renovate supports config presets, including those which are private.

Although npm presets were the first type supported, they are now deprecated and it is recommend that all users migrate to git-hosted "local" presets instead. However if you do still use them, private modules should work if you configure the `npmrc` file including token credentials in your bot admin config. Credentials stored on disk (e.g. in `~/.npmrc`) are no longer supported.

The recommended way of using local presets is to configure then using "local" presets, e.g. like `"extends": ["local>myorg/renovate-config"]`, and ensure that the platform token has access to that repo.

It's not recommended that you use a private repository to host your config while then extending it from a public repository. If your preset doesn't contain secrets then you should make it public, while if it does contain secrets then it's better to split your preset between a public one which all repos extend, and a private one with secrets which only other private repos extend.

In summary, the recommended approach to private presets is:

- Host the presets on the same server/platform as other repositories
- Make sure you install Renovate into the preset repository so that it has credentials to access it from other private repos
- Use `local>....` syntax to refer to private presets

## Dependency Version Lookups

Whenever Renovate detects that a project uses a particular dependency, it attempts to look up that dependency to see if any new versions exist. If such a package is private, then Renovate will need to be configured with the relevant credentials. Renovate does not use any package managers for this step and performs all HTTP(S) lookups itself, including insertion of authentication headers.

Configuring Renovate with credentials requires `hostRules`. Each host rule consists of a `hostType` value and/or a way to match against hosts using `baseUrl`, `hostName` or `domainName`.

`hostType` is not particularly important at this step unless you have different credentials for the same host, however it is sometimes useful in later steps so is good to include if you can. It can be either a "platform" name (e.g. `github`, `azure`, etc) or a "datasource" name (e.g. `npm`, `maven`, `github-tags`, etc).

`baseUrl` can be used if you want to only apply the credentials for a nested path within the host, e.g. `https://registry.company.com/nested/path/`. If the same credentials apply to all paths on a host, then use `hostName` instead, e.g. `registry.company.com`. Finally, to apply credentials to all hosts within the domain, use `domainName`, e.g. `company.com`. You need to pick only one of these and not try to use multiple at the same time, or it will be a config error.

In addition to the above options to match against a host, you need to add the credentials. Typically they are either `token`, or `username` + `password`. Other credential terms are not supported yet.

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

Renovate applies theses `hostRules` to every HTTP(s) request which is sent, so they are largely independent of any platform or datasource logic. With `hostRules` in place, private package lookups should all work.

## Release Notes

When Renovate creates Pull Requests, its default behavior is to locate and embed release notes/changelogs of packages. These release notes are fetched from the source repository of packages and not from the registries themselves, so if they are private then they will require different credentials.

When it comes to open source, most packages host their source on `github.com` in public repositories. However, GitHub greatly rate limits unauthenticated API requests so there is a need to configure credentials for github.com as otherwise the bot will get rate limited quickly. It can be confusing for people who host their own source code privately to be asked to configure a `github.com` token but without it Release Notes for most open source packages will be blocked.

Currently the preferred way to configure `github.com` credentials for self-hosted Renovate is:

- Create a read-only Personal Access Token (PAT) for a `github.com` account. It can be any account, and may even be best to be an empty account created just for this purpose.
- Add the PAT to Renovate using the environment variable `GITHUB_COM_TOKEN`

## Package Manager Credentials for Artifact Updating

In Renovate terminology, "artifacts" includes lock files, checksum files, and vendored dependencies. One way of understanding artifacts is: "everything else that needs to be updated when the dependency version changes".

Not all package managers supported by Renovate require artifact updating, because not all use lock or checksum files. But when such files need updating, Renovate does so by using the package managers themselves instead of trying to "reverse engineer" each package manager's file formats and behavior. Importantly, such package managers are run via shell commands and do not understand Renovate's `hostRules` objects, so Renovate needs to reformat the credentials into formats (such as environment variables or configuration files) which the package manager understands.

Because of this need to convert `hostRules` credentials into a format which package managers understand, sometimes artifact updating can fail due to missing credentials. Sometimes this can be resolved by changing Renovate configuration, but other times it may be due to a feature gap. The following details the most common/popular manager artifacts updating and how credentials are passed:

### bundler

`hostRules` with `hostType=rubygems` are converted into environment variables which Bundler supports.

### composer

Any `hostRules` token for `github.com` or `gitlab.com` are found and written out to `COMPOSER_AUTH` in env for Composer to parse. Any `hostRules` with `hostType=packagist` are also included.

### gomod

If a `github.com` token is found in `hostRules`, then it is written out to local git config prior to running `go` commands. The command run is `git config --global url."https://${token}@github.com/".insteadOf "https://github.com/"`.

### npm

The best way to do this now is using `hostRules` and no longer via `.npmrc` files on disk or in config. `hostRules` credentials with `hostType=npm` are written to a `.npmrc` file in the same directory as the `package.json` being updated. See [private npm modules](./private-npm-modules) for more details.

### nuget

For each known NuGet registry, Renovate searches for `hostRules` with `hostType=nuget` and matching host. For those found, a command similar to the following is run: `dotnet nuget add source ${registryInfo.feedUrl} --configfile ${nugetConfigFile} --username ${username} --password ${password} --store-password-in-clear-text`

### poetry

For every poetry source, a `hostRules` search is done and then any found credentials are added to env like `POETRY_HTTP_BASIC_X_USERNAME` and `POETRY_HTTP_BASIC_X_PASSWORD`.

<!-- TODO:
 * Describe admin vs repo config of hostRules
 * App details: no public->private presets lookup, encrypted
-->
