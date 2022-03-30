# Running Renovate

As a Renovate end user, there are two main categories of use:

- You self-host Renovate, e.g. by running the pre-built Docker image, or
- Someone else is hosting Renovate, and you install/configure it for the repositories you choose

If someone else is hosting Renovate for you, or you are using the WhiteSource Renovate App on GitHub, then you can skip ahead to the [installing & onboarding](./installing-onboarding.md) page.

## Self-Hosting Renovate

Self-hosting Renovate means that you are the "administrator" of the bot, which entails:

- You provide infrastructure for it to run on,
- You provision its global config,
- You ensure it's running regularly,
- You ensure Renovate bot itself is updated

### Available distributions

#### npm package (CLI)

Renovate's Open Source CLI is built and distributed as the npm package `renovate`.
You can run this directly in any Node.js environment - even via `npx` - and it will process all the repositories it is configured with, before exiting.
When you install Renovate from npm it naturally does not come bundled with any third-party tools or languages such as Ruby, Python, Composer, Bundler, Poetry, etc.
Therefore if you need Renovate to support any non-npm lock files like Bundler then you'll need to make sure all required third-party tools are pre-installed in the same environment alongside Renovate before you run it.

The `renovate` npm package is compatible with all of Renovate's supported platforms.

Renovate requires Node.js `>=14.15.0` and Git `>=2.33.0`.

#### Docker image

The `renovate` npm package is also distributed via pre-built Node.js images on Docker Hub (`renovate/renovate`).

The `slim` image contains only Node.js so works if either:

- You do not require any additional package managers, or
- You map the Docker socket into the container so that Renovate can dynamically invoke "sidecar" images when necessary

The "full" image (which `latest` defaults to) has every package manager which Renovate supports already preinstalled.
This approach works best for many, but does have the following downsides:

- It only has _one_ version of each language/manager - usually the latest
- It's several gigabytes in size

The `renovate/renovate` Docker images are compatible with all of Renovate's supported platforms.

#### GitHub Action

Renovate's npm tool is also provided as a pre-prepared GitHub Action on [`renovatebot/github-action`](https://github.com/renovatebot/github-action).
Details on how to use it can be found in the repository.

#### GitLab Runner

The Renovate team provide a ["Renovate Runner"](https://gitlab.com/renovate-bot/renovate-runner/) project to make it easier to run Renovate as a CI pipeline job.
This supports both `gitlab.com` as well as self-hosted GitLab.
Details for how it works can be found in the project.

#### WhiteSource Renovate On-Premises

WhiteSource Renovate On-Premises (WSOP) started out as a commercial product "Renovate Pro", but was renamed and made free to use when Renovate became a part of WhiteSource in 2019.
It is built similarly to the "full" Renovate image described above, but with these differences:

- It is a stateful app and does not exit once it's processed all repositories
- It is installed as an App on GitHub, and behaves similarly on GitLab - for example responding to webhooks
- It includes a priority job queue which prioritizes events like merged PRs over scheduled jobs
- It is released every 1-2 months in a slower, more stable cadence than Renovate OSS, which releases on every commit
- It's licensed using an end-user license agreement (EULA) and not the Affero General Public License (AGPL)

WSOP supports GitHub (both `github.com` and GitHub Enterprise Server) as well as GitLab self-hosted.
Documentation can be found in its public GitHub repository [`whitesource/renovate-on-prem`](https://github.com/whitesource/renovate-on-prem).

#### WhiteSource Remediate

[WhiteSource Remediate](https://www.whitesourcesoftware.com/wp-content/media/2021/04/whitesource-remediation-solution.pdf) is an extension of WSOP available for WhiteSource commercial customers, with full enterprise support.
It is integrated with WhiteSource's vulnerability detection capabilities and additionally supports the capability of "horizontal" scalability - the ability to configure many Renovate "worker" containers which share a common job queue in order to not conflict with each other.

WhiteSource Remediate supports GitHub Enterprise Server, GitLab self-hosted, and Bitbucket Server.

#### Forking Renovate app

"Forking Renovate" is the sister app to the WhiteSource Renovate App on GitHub.com.
The difference is that Forking Renovate does not require `write` permissions to create branches within the repo, and instead submits PRs from its own fork.
Because of how it works, it functions on public repositories only and additionally cannot support `automerge` capabilities.

[Install Forking Renovate from GitHub App](https://github.com/apps/forking-renovate).

##### Benefits

Forking Renovate needs only `read` level access to the code of any repository it runs on.

##### Drawbacks

If you use Forking Renovate, you'll miss out on these features of the regular Renovate app:

- Automerge is not supported
- The `baseBranches` config option is not supported
- The app dashboard (`app.renovatebot.com`) is currently not supported

### Hosting Renovate

Once you have decided on a Renovate distribution, you need to decide where and how to run it.

For the GitHub Action and GitLab Runner approaches, they will naturally run on their respective CI infrastructure.
For the npm package approach or Docker images, you will need some form of VM or container infrastructure to run Renovate on.

In all the above cases you will need to make sure that some form of cron-like capability exists to schedule when Renovate runs.
In general we recommend to run Renovate hourly if possible.

WhiteSource Renovate On-Premises and WhiteSource Remediate both run as long-lived containers so do not need any additional cron-like concept as it is built-in.

### Global config

Renovate's server-side/admin config is referred to as its "global" config, and can be specified using either a config file, environment variables, or CLI parameters.
By default Renovate checks if a file named `config.js` is present.
Any other (`*.js`, `*.json`, `*.json5`, `*.yaml` or `*.yml`) file is supported, when you reference it with the `RENOVATE_CONFIG_FILE` environment variable (e.g. `RENOVATE_CONFIG_FILE=config.yaml`).

Some config is global-only, meaning that either it is only applicable to the bot administrator or it can only be controlled by the administrator and not repository users.
Those are documented in [Self-hosted Configuration](../self-hosted-configuration.md).
Your bot's global config can include both global as well as non-global configuration options, while user/repo config can only include non-global options.
It is recommended to keep as much of the non-global config as possible in repo config files in order to provide maximum transparency to end users.

If you are configuring using environment variables, there are two possibilities:

- Upper-cased, camel-cased, `RENOVATE_`-prefixed single config options like `RENOVATE_TOKEN=abc123` or `RENOVATE_GIT_AUTHOR=a@b.com`
- Set `RENOVATE_CONFIG` to a [stringified](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) version of the full JSON config, e.g. `RENOVATE_CONFIG='{"token":"abc123","gitAuthor":"a@b.com"}'`

If you combine both of the above then any single config option in the environment variable will override what's in `RENOVATE_CONFIG`.

<!-- prettier-ignore -->
!!! note
    It's also possible to change the default prefix from `RENOVATE_` using `ENV_PREFIX`. e.g. `ENV_PREFIX=RNV_ RNV_TOKEN=abc123 renovate`.

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
An example of a `config.js` that exports an async function (which is a function that returns a `Promise`) can be seen in a comment for [#10011: Allow autodiscover filtering for repo topic](https://github.com/renovatebot/renovate/issues/10011#issuecomment-992568583) and more examples can be seen in [`file.spec.ts`](https://github.com/renovatebot/renovate/blob/main/lib/workers/global/config/parse/file.spec.ts).

### Authentication

Regardless of platform, you need to select a user account for `renovate` to assume the identity of, and generate a Personal Access Token.
It is recommended to be `@renovate-bot` if you are using a self-hosted server with free choice of usernames.
It is also recommended that you configure `config.gitAuthor` with the same identity as your Renovate user, e.g. like `"gitAuthor": "Renovate Bot <renovate@whitesourcesoftware.com>"`.

#### Docs

Read the platform-specific docs to learn how to setup authentication on your platform:

- [Azure DevOps](https://docs.renovatebot.com/modules/platform/azure/)
- [Bitbucket Cloud](https://docs.renovatebot.com/modules/platform/bitbucket/)
- [Bitbucket Server](https://docs.renovatebot.com/modules/platform/bitbucket-server/)
- [Gitea](https://docs.renovatebot.com/modules/platform/gitea/)
- [github.com or GHES](https://docs.renovatebot.com/modules/platform/github/)
- [GitLab](https://docs.renovatebot.com/modules/platform/gitlab/)

### GitHub.com token for release notes

If you are running on any platform except github.com, it's important to also configure the environment variable `GITHUB_COM_TOKEN` containing a Personal Access Token for github.com.
This account can actually be _any_ account on GitHub, and needs only read-only access.
It's used when fetching release notes for repositories in order to increase the hourly API limit.
It's also OK to configure the same as a host rule instead, if you prefer that.

<!-- prettier-ignore -->
!!! note
    If you're using Renovate in a project where dependencies are loaded from github.com (such as Go modules hosted on GitHub) it is highly recommended to add a token.
    Otherwise you will exceed the rate limit from the github.com API, which will lead to Renovate closing and reopening PRs because it could not get reliable info on updated dependencies.

### Self-hosting examples

For more examples on running Renovate self-hosted, please read our [Self-hosted examples](../examples/self-hosting.md) page.
