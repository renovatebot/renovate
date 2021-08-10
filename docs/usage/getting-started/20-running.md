# Running Renovate

As a Renovate end user, there are two main categories of use:

- You self-host Renovate, e.g. by running the pre-built Docker image, or
- Someone else is hosting Renovate, and you install/configure it for the repositories you choose

If someone else is hosting Renovate for you, or you are using the WhiteSource Renovate App on GitHub, then you can skip ahead to the Installing Renovate into Repositories section.

## Self-Hosting Renovate

Self-hosting Renovate means that you are the "administrator" of the bot, which entails:

- You provide infrastructure for it to run on,
- You provision its global config,
- You ensure it's running regularly

### Available distributions

#### npm Package (CLI)

Renovate's Open Source CLI is built and distributed as the npm package `renovate`.
You can run this directly in any Node.js environment - even via `npx` - and it will process all the repositories it is configured with, before exiting.
If you need to support any non-npm lock files like Bundler, Go Modules or Poetry then you'll need to make sure they are pre-installed in the same environment alongside Renovate.

The `renovate` npm package is compatible with all of Renovate's supported platforms.

#### Docker Image

The `renovate` npm package is also distributed in pre-built Node.js images on Docker Hub (`renovate/renovate`).

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
- It's licensed using a EULA and not AGPL

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

### Global Config

Renovate's server-side/admin config is referred to as its "global" config, and can be specified using either a config file, environment variables, or CLI parameters.

Some config is global-only, meaning that either it is only applicable to the bot administrator or it can only be controlled by the administrator and not repository users.
The bot's global config can include both global as well as non-global configuration options, while user/repo config can only include non-global options.
It is recommended to keep as much of the non-global config as possible in repo config files in order to provide maximum transparency to end users.

## Installing Renovate Into Repositories

Renovate administrators can choose to either "autodiscover" installed repositories, or to configure a fixed list of repository names to operate on.

If the adminstrator has configured a fixed list of repositories then the only way to "install" Renovate on an additional repository is for it to be manually added for the next run or restart.

Otherwise, the process can vary:

- Most commonly, you run Renovate as a dedicated "bot user" with `autodiscover=true`, meaning that it will run on every repository which it's been granted access to
- If using a GitHub App (including WhiteSource Renovate on `github.com`) then you can install the app into an account or org and select either "All repositories", or "Select repositories" and pick them manually

Once Renovate has been added to a repository, the first step it usually does is create an "onboarding" Pull Request.
The goal of the onboarding Pull Request is to give a preview of what's to come and allow users to adjust the default config to their liking before fully activating the bot's activities.
