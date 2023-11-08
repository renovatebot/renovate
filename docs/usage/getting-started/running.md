# Running Renovate

As end user, you can choose from these ways to run Renovate:

- You use the Mend Renovate App
- You self-administer/host your own Renovate instance
- Someone else is hosting Renovate, and you install/configure it for the repositories you choose

If you're using the Mend Renovate App, or if someone else is hosting Renovate for you, skip ahead to the [installing & onboarding](./installing-onboarding.md) page.

## Self-Hosting Renovate

When self-hosting Renovate you're the "administrator" of the bot, this means you:

- provide the infrastructure that Renovate runs on,
- provision Renovate's global config,
- make sure Renovate bot runs regularly,
- make sure Renovate bot itself is updated

If you're self-hosting Renovate on Windows, read [Self-hosting on Windows](./installing-onboarding.md#self-hosting-on-windows) to prevent line endings from confusing Renovate bot.

If you're running Renovate Community Edition or Renovate Enterprise Edition, refer to the documentation on the [`mend/renovate-ce-ee` GitHub repository](https://github.com/mend/renovate-ce-ee).

### Available distributions

#### npm package (CLI)

Renovate's Open Source CLI is built and distributed as the npm package `renovate`.
You can run this package in any Node.js environment - even via `npx` - and it will process all the repositories it is configured with, before exiting.

When installing Renovate via npm you are responsible for installing any third-party tools or languages like Ruby, Python, Composer, Bundler, Poetry, etc.

The `renovate` npm package is compatible with all of Renovate's supported platforms.

#### Docker images

Renovate is also distributed as Docker images on Docker Hub (`renovate/renovate`) and GitHub container registry (`ghcr.io/renovatebot/renovate`).
These Docker images work on all the hosting platforms that Renovate supports.

Both `linux/amd64` and `linux/arm64` architectures are supported, but you may still find some bugs in the `arm64` image.
You can't run the Docker images in a Windows or macOS container.

In general, you can run Renovate natively on Windows as long as you have all tools it will need (e.g. `npm`, `pipenv`, etc.) preinstalled before you run Renovate.

There are two Docker image flavors:

- The default image, which installs required tools at runtime (default for `latest` tag),
- The `-full` image, which comes with latest or very recent versions of every tool pre-installed

##### The default image (formerly `slim`)

The default image only comes with the Node.js environment.
Renovate will then install any needed tools when it runs.
Read the `binarySource=install` documentation for more details.
We recommend this default image for most users.

Renovate supports a persistent cache for downloaded tools, so that it only needs to unpack the tools on later runs.
Use the [`containerbaseDir` config option](../self-hosted-configuration.md#containerbasedir) to control where Renovate stores its containerbase cache.

If you want, you can map the Docker socket into the container so that Renovate can dynamically invoke "sidecar" images when needed.
You'll need to set `binarySource=docker` for this to work.
Read the [`binarySource` config option docs](../self-hosted-configuration.md#binarysource) for more information.

##### The full image

The `-full` image comes with most package managers that Renovate supports, but not _all_ package managers.
Update your Docker images regularly to keep the pre-installed tools up-to-date.

The full image is for users who don't want to download or install things at runtime.
This image has some downsides, because it:

- Comes pre-installed with _one_ version of each language/manager - usually the latest
- Weighs several gigabytes

#### GitHub Action

Renovate's npm tool is also provided as a GitHub Action on [`renovatebot/github-action`](https://github.com/renovatebot/github-action).
Details on how to use it can be found in the repository.

#### GitLab Runner

The Renovate team provide a ["Renovate Runner"](https://gitlab.com/renovate-bot/renovate-runner/) project to make it easier to run Renovate as a CI pipeline job.
This supports both `gitlab.com` and self-hosted GitLab.
Details for how it works can be found in the project.

#### Mend Renovate Community Edition / Enterprise Edition

Mend Renovate Community Edition (Renovate CE) and Enterprise Edition (Renovate EE) are closed-source offerings of Renovate for self-hosted users.
Renovate CE and Renovate EE have support for GitHub (both `github.com` and GitHub Enterprise Server) as well as GitLab self-hosted.
It is built similarly to the default "full" Renovate image described above, but with these differences:

- It is a stateful app and does not exit after processing all repositories
- It is installed as an App on GitHub, and behaves similarly on GitLab - for example responding to webhooks
- It includes a priority job queue which prioritizes events like merged PRs over scheduled jobs
- It is released every 1-2 months in a slower, more stable cadence than Renovate OSS, which releases on every commit
- It's licensed using an end-user license agreement (EULA) and not the Affero General Public License (AGPL)

Plus, the Enterprise Edition has:

- Horizontal scaling to run multiple 'worker' containers
- Dedicated support from Mend.io
- Premium features, including Smart Merge Control

Go to the Mend.io website to learn more about [Renovate Enterprise Edition](https://www.mend.io/renovate-enterprise/).

To learn how to configure Renovate CE or Renovate EE, read the documentation on the public GitHub repository [`mend/renovate-ce-ee`](https://github.com/mend/renovate-ce-ee).

#### Mend Remediate

[Mend Remediate](https://www.whitesourcesoftware.com/wp-content/media/2021/04/whitesource-remediation-solution.pdf) is an extension of WSOP available for Mend commercial customers, with full enterprise support.
It is integrated with Mend's vulnerability detection capabilities and additionally supports the capability of "horizontal" scalability - the ability to configure many Renovate "worker" containers which share a common job queue in order to not conflict with each other.

Mend Remediate supports GitHub Enterprise Server, GitLab self-hosted, and Bitbucket Server.

#### Forking Renovate app

"Forking Renovate" is the sister app to the Mend Renovate App.
The difference is that Forking Renovate does not need `write` permissions to create branches within the repo, and instead submits PRs from its own fork.
Because of how it works, it functions on public repositories only and additionally cannot support `automerge` capabilities.

[Install Forking Renovate from GitHub App store](https://github.com/apps/forking-renovate).

##### Benefits

Forking Renovate needs only `read` level access to the code of any repository it runs on.

##### Drawbacks

If you use Forking Renovate, you'll miss out on these features of the regular Renovate app:

- Automerge
- The `baseBranches` config option

### Hosting Renovate

After deciding on a Renovate distribution, you need to decide where and how to run it.

For the GitHub Action and GitLab Runner approaches, they will naturally run on their respective CI infrastructure.
For the npm package approach or Docker images, you will need some form of VM or container infrastructure to run Renovate on.

In all the above cases you must make sure that some form of cron-like capability exists to schedule when Renovate runs.
We recommend that you run Renovate hourly, if possible.

Mend Renovate On-Premises and Mend Remediate both run as long-lived containers, so they do not need any cron-like concept as it is built-in.

### Global config

Renovate's server-side/admin config is referred to as its "global" config, and can be set by using either:

- a config file, or
- environment variables, or
- CLI parameters

By default Renovate checks if a file named `config.js` is present.
Any other (`*.js`, `*.json`, `*.json5`, `*.yaml` or `*.yml`) file is supported, when you reference it with the `RENOVATE_CONFIG_FILE` environment variable (for example: `RENOVATE_CONFIG_FILE=config.yaml`).

Some config is global-only, meaning that either it is only applicable to the bot administrator or it can only be controlled by the administrator and not repository users.
Those are documented in [Self-hosted Configuration](../self-hosted-configuration.md).
Your bot's global config can include both global as well as non-global configuration options, while user/repo config can only include non-global options.
We recommend that you keep as much of the non-global config as possible in repository config files.
This way the Renovate end users can see as much of the bot's configuration as possible.

If you are configuring Renovate using environment variables, there are two possibilities:

- Upper-cased, camel-cased, `RENOVATE_`-prefixed single config options like `RENOVATE_TOKEN=abc123` or `RENOVATE_GIT_AUTHOR=a@b.com`
- Set `RENOVATE_CONFIG` to a [stringified](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) version of the full JSON config, for example: `RENOVATE_CONFIG='{"token":"abc123","gitAuthor":"a@b.com"}'`

If you combine both of the above then any single config option in the environment variable will override what's in `RENOVATE_CONFIG`.

<!-- prettier-ignore -->
!!! note
    It's also possible to change the default prefix from `RENOVATE_` using `ENV_PREFIX`.
    For example: `ENV_PREFIX=RNV_ RNV_TOKEN=abc123 renovate`.

#### Using `config.js`

If you use a `config.js`, it will be expected to export a configuration via `module.exports`.
The value can be either a plain JavaScript object like in this example where `config.js` exports a plain object:

```javascript
module.exports = {
  token: 'abcdefg',
};
```

`config.js` may also export a `Promise` of such an object, or a function that will return either a plain JavaScript object or a `Promise` of such an object.
This allows one to include the results of asynchronous operations in the exported value.
An example of a `config.js` that exports an `async` function (which is a function that returns a `Promise`) can be seen in a comment for [#10011: Allow autodiscover filtering for repo topic](https://github.com/renovatebot/renovate/issues/10011#issuecomment-992568583) and more examples can be seen in [`file.spec.ts`](https://github.com/renovatebot/renovate/blob/main/lib/workers/global/config/parse/file.spec.ts).

### Authentication

Regardless of platform, you need to select a user account for `renovate` to assume the identity of, and generate a Personal Access Token.
We recommend you use `@renovate-bot` as username if you're on a self-hosted server where you can set all usernames.
We also recommend you configure `config.gitAuthor` with the same identity as your Renovate user, for example: `"gitAuthor": "Renovate Bot <renovate@some.domain.test>"`.

<!-- prettier-ignore -->
!!! warning
    We recommend you use a single, dedicated username for your Renovate bot.
    Never share the Renovate username with your other bots, as this can cause flip-flopping.

#### Docs

Read the platform-specific docs to learn how to setup authentication on your platform:

- [Azure DevOps](https://docs.renovatebot.com/modules/platform/azure/)
- [Bitbucket Cloud](https://docs.renovatebot.com/modules/platform/bitbucket/)
- [Bitbucket Server](https://docs.renovatebot.com/modules/platform/bitbucket-server/)
- [Gitea and Forgejo](https://docs.renovatebot.com/modules/platform/gitea/)
- [github.com and GitHub Enterprise Server](https://docs.renovatebot.com/modules/platform/github/)
- [GitLab](https://docs.renovatebot.com/modules/platform/gitlab/)

### GitHub.com token for changelogs

If you are running on any platform except github.com, you should also set the environment variable `GITHUB_COM_TOKEN` and put the Personal Access Token for github.com in it.
This account can be _any_ account on GitHub, and needs only `read-only` access.
It's used when fetching changelogs for repositories in order to increase the hourly API limit.
It's also OK to configure the same as a host rule instead, if you prefer that.

<!-- prettier-ignore -->
!!! note
    If you're using Renovate in a project where dependencies are loaded from github.com (such as Go modules hosted on GitHub), we highly recommend that you add a `github.com` PAT (classic).
    Otherwise you will exceed the rate limit for the github.com API, which will lead to Renovate closing and reopening PRs because it could not get reliable info on updated dependencies.

### Self-hosting examples

For more examples on running Renovate self-hosted, read our [Self-hosted examples](../examples/self-hosting.md) page.
