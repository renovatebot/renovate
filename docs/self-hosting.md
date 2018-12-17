# Self-Hosting Renovate

## Open Source vs Commercial versions

Although Renovate is now best known as a "service" via the GitHub App, that service is actually running this same open source project, so you can get the same functionality if running it yourself. The version you see here in this repository can be cloned or `npm` installed in seconds and give you the same core functionality as in the app.

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
$ docker run renovate/renovate:13.1.1
$ docker run renovate/renovate:13.1
$ docker run renovate/renovate:13
```

(Please look up what the latest actual tags are though, do not use the above literally).

If you wish to configure Renovate using a `config.js` file then map it to `/usr/src/app/config.js` using Docker volumes.

#### Kubernetes

Renovate's official Docker image is compatible with Kubernetes. Here is an example manifest of running Renovate against a GitHub Enterprise server:

```yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: renovate
spec:
  schedule: "@hourly"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: renovate
            image: renovate/renovate@13.153.0 # Update this to the latest available and then enable Renovate on the manifest
# Environment Variables
            env:
            - name: RENOVATE_PLATFORM
              value: "github"
            - name: RENOVATE_ENDPOINT
              value: "https://github.company.com/api/v3"
            - name: RENOVATE_TOKEN
              value: "abcdefghijklmnopqrstuvwxyz1234567890"
          restartPolicy: OnFailure
```

## Authentication

You need to select a repository user for `renovate` to assume the identity of,
and generate a Personal Access Token. It's strongly recommended that you use a
dedicated "bot" account for this to avoid user confusion and to avoid the
Renovate bot mistaking changes you have made or PRs you have raised for its own.

You can find instructions for GitHub
[here](https://help.github.com/articles/creating-an-access-token-for-command-line-use/)
(select "repo" permissions)

You can find instructions for GitLab
[here](https://docs.gitlab.com/ee/api/README.html#personal-access-tokens).

You can find instructions for Bitbucket AppPasswords [here](https://confluence.atlassian.com/bitbucket/app-passwords-828781300.html).

Note: you should also configure a GitHub token even if your source host is GitLab or Bitbucket, because Renovate will need to perform many queries to github.com in order to retrieve Release Notes.

You can find instructions for VSTS
[vsts](https://www.visualstudio.com/en-us/docs/integrate/get-started/authentication/pats).

This token needs to be configured via file, environment variable, or CLI. See
[docs/configuration.md](configuration.md) for details. The simplest way is
to expose it as `GITHUB_TOKEN`, `GITLAB_TOKEN` or `VSTS_TOKEN`.

For Bitbucket, you can configure `BITBUCKET_USERNAME` and `BITBUCKET_PASSWORD`, or combine them together yourself into `BITBUCKET_TOKEN` using the node REPL:

```
const btoa = str => Buffer.from(str, 'binary').toString('base64');

btoa(`${user}:${bbaAppPassword}`)
```

You must then expose either the token or username + password to your env, or provide them via the CLI. Example:

```sh
renovate --platform=bitbucket --username=rarkins --password=ABCDEFghijklmop123 rarkins/testrepo1
```

## Usage

The following example uses the Renovate CLI tool, which can be installed by running `npm i -g renovate`.

If running your own Renovate bot then you will need a user account that Renovate will run as. It's recommended to use a dedicated account for the bot, e.g. name it `renovate-bot` if on your own instance. Create and save a Personal Access Token for this account.

Create a Renovate config file, e.g. here is an example:

```js
module.exports = {
  endpoint: 'https://self-hosted.gitlab/api/v4/',
  token: '**gitlab_token**',
  platform: 'gitlab',
  logFileLevel: 'warn',
  logLevel: 'info',
  logFile: '/home/user/renovate.log',
  onboarding: true,
  onboardingConfig: {
    extends: ['config:base'],
  },
  repositories: ['username/repo', 'orgname/repo'],
};
```

Here change the `logFile` and `repositories` to something appropriate. Also replace gitlab-token value with the one created during the previous step.

If running against GitHub Enterprise, change the above gitlab values to the equivalent github ones.

You can save this file as anything you want and then use `RENOVATE_CONFIG_FILE` env variable to tell Renovate where to find it.

Most people will run Renovate via cron, e.g. once per hour. Here is an example bash script that you can point `cron` to:

```sh
#!/bin/bash

export PATH="/home/user/.yarn/bin:/usr/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
export RENOVATE_CONFIG_FILE="/home/user/renovate-config.js"
export GITHUB_TOKEN="**github-token**" # Delete this if using GitHub Enterprise
export GITLAB_TOKEN="**github-token**" # Delete this if using GitHub
export GITHUB_COM_TOKEN="**github-token**" # Delete this if using GitLab or github.com

# Renovate
renovate
```

Note: the GitHub token in env is necessary in order to retrieve Release Notes that are hosted on github.com. Use `GITHUB_COM_TOKEN` if running against GitHub Enterprise or `GITHUB_TOKEN` if running against GitLab. i.e. remove one of the lines as applicable.

You should save and test out this script manually first, and add it to cron once you've verified it.

## Deployment

See
[deployment docs](https://github.com/renovatebot/renovate/blob/master/docs/deployment.md)
for details.
