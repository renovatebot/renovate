# Self-Hosting Renovate

## Open Source vs Commercial versions

Although Renovate is now best known as a "service" via the GitHub App, that service is actually running this same open source project, so you can get the same functionality if running it yourself. The version you see here in this repository can be cloned or `npm` installed in seconds and give you the exact core functionality as in the app.

There is also a commercially-licensed "Professional Edition" of Renovate available for GitHub Enterprise, that includes a stateful priority job queue, background scheduler and webhook listener.
For details and documentation on Renovate Pro, please visit [renovatebot.com/pro](https://renovatebot.com/pro).

## Installing Renovate OSS

#### npmjs

```
$ npm install -g renovate
```

#### Docker

Renovate is available for Docker via an automated build [renovate/renovate](https://hub.docker.com/r/renovate/renovate/). It builds `latest` based on the `master` branch and all semver tags are published too. All the following are valid:

```
$ docker run renovate/renovate
$ docker run renovate/renovate:11.32.3
$ docker run renovate/renovate:11.32
$ docker run renovate/renovate 11
```

If you wish to configure Renovate using a `config.js` file then map it to `/usr/src/app/config.js` using Docker volumes.

## Authentication

You need to select a repository user for `renovate` to assume the identity of,
and generate a Personal Access Token. It's strongly recommended that you use a
dedicated "bot" account for this to avoid user confusion and to avoid the
Renovate bot mistaking changes you have made or PRs you have raised for its own.

You can find instructions for GitHub
[here](https://help.github.com/articles/creating-an-access-token-for-command-line-use/)
(select "repo" permissions)

You can find instructions for GitLab
[here](https://docs.gitlab.com/ee/api/README.html#personal-access-tokens). Note: GitLab APIv3 is no longer supported - please upgrade to GitLab APIv4 before testing Renovate.

You can find instructions for VSTS
[vsts](https://www.visualstudio.com/en-us/docs/integrate/get-started/authentication/pats).

This token needs to be configured via file, environment variable, or CLI. See
[docs/configuration.md](configuration.md) for details. The simplest way is
to expose it as `GITHUB_TOKEN` or `GITLAB_TOKEN` or `VSTS_TOKEN`.

## Usage

Run `renovate --help` for usage details.

Note: The first time you run `renovate` on a repository, it will not upgrade any
dependencies. Instead, it will create a Pull Request (Merge Request if GitLab)
called 'Configure Renovate' and commit a default `renovate.json` file to the
repository. This PR can be closed as unmerged if the default settings are fine for
you. Also, this behaviour can be disabled if you set the `onboarding`
configuration option to `false` before running.

## Deployment

See
[deployment docs](https://github.com/renovatebot/renovate/blob/master/docs/deployment.md)
for details.
