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

The "full" image (which `latest` defaults to) contains every package manager which Renovate supports already preinstalled.
This approach works best for many, but does have the following downsides:

- It only contains _one_ version of each language/manager - usually the latest
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

### Hosting Renovate

Once you have decided on a Renovate distribution, you need to decide where and how to run it.

For the GitHub Action and GitLab Runner approaches, they will naturally run on their respective CI infrastructure.
For the npm package approach or Docker images, you will need some form of VM or container infrastructure to run Renovate on.

In all the above cases you will need to make sure that some form of cron-like capability exists to schedule when Renovate runs.
In general we recommend to run Renovate hourly if possible.

WhiteSource Renovate On-Premises and WhiteSource Remediate both run as long-lived containers so do not need any additional cron-like concept as it is built-in.

### Global config

Renovate's server-side/admin config is referred to as its "global" config, and can be specified using either a config file (`config.js`, `config.json`, `config.json5`, `config.yaml` or `config.yml`), environment variables, or CLI parameters.

Some config is global-only, meaning that either it is only applicable to the bot administrator or it can only be controlled by the administrator and not repository users.
Those are documented in [Self-hosted Configuration](../self-hosted-configuration.md).
Your bot's global config can include both global as well as non-global configuration options, while user/repo config can only include non-global options.
It is recommended to keep as much of the non-global config as possible in repo config files in order to provide maximum transparency to end users.

If you are configuring using environment variables, there are two possibilities:

- Upper-cased, camel-cased, `RENOVATE_`-prefixed single config options like `RENOVATE_TOKEN=abc123` or `RENOVATE_GIT_AUTHOR=a@b.com`
- Set `RENOVATE_CONFIG` to a [stringified](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) version of the full JSON config, e.g. `RENOVATE_CONFIG='{"token":"abc123","gitAuthor":"a@b.com"}'`

If you combine both of the above then any single config option in the environment variable will override what's in `RENOVATE_CONFIG`.

Note: it's also possible to change the default prefix from `RENOVATE_` using `ENV_PREFIX`. e.g. `ENV_PREFIX=RNV_ RNV_TOKEN=abc123 renovate`.

#### Using `config.js`

If you use a `config.js`, it will be expected to export a configuration via `module.exports`.
The value can be either a plain JavaScript object like in this example where `config.js` exports a plain object:

```javascript
module.exports = {
  token: 'abcdefg',
};
```

`config.js` may also export a `Promise` of such an object, or a function that will return either a plain Javascript object or a `Promise` of such an object.
This allows one to include the results of asynchronous operations in the exported value.
An example of a `config.js` that exports an async function (which is a function that returns a `Promise`) can be seen in a comment for [#10011: Allow autodiscover filtering for repo topic](https://github.com/renovatebot/renovate/issues/10011#issuecomment-992568583) and more examples can be seen in [`file.spec.ts`](https://github.com/renovatebot/renovate/blob/main/lib/workers/global/config/parse/file.spec.ts).

### Authentication

Regardless of platform, you need to select a user account for `renovate` to assume the identity of, and generate a Personal Access Token.
It is recommended to be `@renovate-bot` if you are using a self-hosted server with free choice of usernames.
It is also recommended that you configure `config.gitAuthor` with the same identity as your Renovate user, e.g. like `"gitAuthor": "Renovate Bot <renovate@whitesourcesoftware.com>"`.

#### GitHub (Enterprise Server)

First, [create a Personal Access Token](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) for the bot account (select "repo" scope).
Configure it either as `token` in your `config.js` file, or in environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.

For GitHub Enterprise Server set the `endpoint` in your `config.js` to `https://github.enterprise.com/api/v3/`.

##### Running as a GitHub App

Instead of a bot account with a Personal Access Token you can run `renovate` as a self-hosted [GitHub App](https://docs.github.com/en/developers/apps/getting-started-with-apps).

When creating the GitHub App give it the following permissions:

- Checks: Read & write
- Contents: Read & write
- Issues: Read & write
- Metadata: Read-only
- Pull requests: Read & write
- Commit statuses: Read & write
- Dependabot alerts: Read-only
- Workflows: Read & write

Other values like Homepage URL, User authorization callback URL and webhooks can be disabled or filled with dummy values.

Inside your `config.js` you need to set the following values, assuming the name of your app is `self-hosted-renovate`:

**`username:"self-hosted-renovate[bot]"`**

The slug name of your app with `[bot]` appended

**`gitAuthor:"Self-hosted Renovate Bot <123456+self-hosted-renovate[bot]@users.noreply.github.enterprise.com>"`**

The [GitHub App associated email](https://github.community/t/logging-into-git-as-a-github-app/115916/2) to match commits to the bot.
It needs to contain the user id _and_ the username followed by the `users.noreply.`-domain of either github.com or the GitHub Enterprise Server.
A way to get the user id of a GitHub app is to [query the user API](https://docs.github.com/en/rest/reference/users#get-a-user) at `api.github.com/user/self-hosted-renovate[bot]` (github.com) or `github.enterprise.com/api/v3/uer/self-hosted-renovate[bot]` (GitHub Enterprise Server).

**`token:"x-access-token:${github-app-installation}"`**

The token needs to be prefixed with `x-access-token` and be a [GitHub App Installation token](https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation).
**Note** The installation tokens expire after 1 hour and need to be regenerated regularly.
Alternatively as environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.

**`repositories: ["orgname/repo-1","orgname/repo-2"]`**

List of repositories to run on.
Auto discovery does not work with a GitHub App.
Alternatively as comma-separated environment variable `RENOVATE_REPOSITORIES`.
The GitHub App installation token is scoped at most to a single organization and running on multiple organizations requires multiple invocations of `renovate` with different `token` and `repositories` parameters.

#### GitLab

First, [create a personal access token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) for the bot account (select `read_user`, `api` and `write_repository` scopes, or `read_user`, `read_api` and `read_repository` for dry runs).
Configure it either as `token` in your `config.js` file, or in environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.
Don't forget to configure `platform=gitlab` somewhere in config.

#### Bitbucket Cloud

First, [create an AppPassword](https://confluence.atlassian.com/bitbucket/app-passwords-828781300.html) for the bot account.
Give the bot App password the following permission scopes:

- [`account`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#account) (Account: Read)
- [`team`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#team) (Workspace membership: Read)
- [`issue:write`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#issue-write) (Issues: Write)
- [`pullrequest:write`](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#pullrequest-write) (Pull requests: Write)

Configure it as `password` in your `config.js` file, or in environment variable `RENOVATE_PASSWORD`, or via CLI `--password=`.
Also be sure to configure the `username` for your bot account too.
Don't forget to configure `platform=bitbucket` somewhere in config.

#### Bitbucket Server

Create a [Personal Access Token](https://confluence.atlassian.com/bitbucketserver/personal-access-tokens-939515499.html) for your bot account.
Configure it as `password` in your `config.js` file, or in environment variable `RENOVATE_PASSWORD`, or via CLI `--password=`.
Also configure the `username` for your bot account too, if you decided not to name it `@renovate-bot`.
Don't forget to configure `platform=bitbucket-server` somewhere in config.

If you use MySQL or MariaDB you must set `unicodeEmoji` to `false` in the bot config (`RENOVATE_CONFIG_FILE`) to prevent issues with emojis.

### Azure DevOps

First, [create a Personal Access Token](https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats) for the bot account.
Configure it either as `token` in your `config.js` file, or in environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.
Don't forget to configure `platform=azure` somewhere in config.

#### Gitea

First, [create an access token](https://docs.gitea.io/en-us/api-usage/#authentication-via-the-api) for your bot account.
Configure it as `token` in your `config.js` file, or in environment variable `RENOVATE_TOKEN`, or via CLI `--token=`.
Don't forget to configure `platform=gitea` somewhere in config.

### GitHub.com token for release notes

If you are running on any platform except github.com, it's important to also configure the environment variable `GITHUB_COM_TOKEN` containing a Personal Access Token for github.com.
This account can actually be _any_ account on GitHub, and needs only read-only access.
It's used when fetching release notes for repositories in order to increase the hourly API limit.
It's also OK to configure the same as a host rule instead, if you prefer that.

**Note:** If you're using Renovate in a project where dependencies are loaded from github.com (such as Go modules hosted on GitHub) it is highly recommended to add a token as you will exceed the rate limit from the github.com API, which will lead to Renovate closing and reopening PRs because it could not get reliable info on updated dependencies.

### Self-hosting examples

For more examples on running Renovate self-hosted, please read our [Self-hosted examples](../examples/self-hosting.md) page.
