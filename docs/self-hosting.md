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

Renovate's official Docker image is compatible with Kubernetes. The following is an example manifest of running Renovate against a GitHub Enterprise server. First the Kubernetes manifest:

```yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: renovate
spec:
  schedule: '@hourly'
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: renovate
              # Update this to the latest available and then enable Renovate on the manifest
              image: renovate/renovate:13.153.0
              # Environment Variables
              env:
                - name: RENOVATE_PLATFORM
                  valueFrom:
                    secretKeyRef:
                      key: renovate-platform
                      name: renovate-env
                - name: RENOVATE_ENDPOINT
                  valueFrom:
                    secretKeyRef:
                      key: renovate-endpoint
                      name: renovate-env
                - name: RENOVATE_TOKEN
                  valueFrom:
                    secretKeyRef:
                      key: renovate-token
                      name: renovate-env
                - name: GITHUB_COM_TOKEN
                  valueFrom:
                    secretKeyRef:
                      key: github-token
                - name: RENOVATE_AUTODISCOVER
                  valueFrom:
                    secretKeyRef:
                      key: renovate-autodiscover
                      name: renovate-env
          restartPolicy: Never
```

And also this accompanying `secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: renovate-env
type: Opaque
stringData:
  renovate-platform: 'github'
  renovate-endpoint: 'https://github.company.com/api/v3'
  renovate-token: 'your-github-enterprise-renovate-user-token'
  github-token: 'any-personal-user-token-for-github-com-for-fetching-changelogs'
  renovate-autodiscover: 'true'
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

You can find instructions for Azure DevOps
[azureDevOps](https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats).

This token needs to be configured via file, environment variable, or CLI. See
[docs/configuration.md](configuration.md) for details. The simplest way is to expose it as `RENOVATE_TOKEN`.

For Bitbucket, you can configure `RENOVATE_USERNAME` and `RENOVATE_PASSWORD`.

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
export RENOVATE_TOKEN="**some-token**" # GitHub, GitLab, Azure DevOps or BitBucket
export GITHUB_COM_TOKEN="**github-token**" # Delete this if using github.com

# Renovate
renovate
```

Note: the GitHub.com token in env is necessary in order to retrieve Release Notes that are usually hosted on github.com. You don't need to add it if you are already running the bot against github.com, but you do need to add it if you're using GitHub Enterprise, GitLab, Azure DevOps, or Bitbucket.

You should save and test out this script manually first, and add it to cron once you've verified it.

## Deployment

See
[deployment docs](https://github.com/renovatebot/renovate/blob/master/docs/deployment.md)
for details.
