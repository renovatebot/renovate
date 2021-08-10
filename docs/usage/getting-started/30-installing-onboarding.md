# Installing and Onboarding Renovate into Repositories

## Repository Installation

Renovate administrators can configure Renovate to either "autodiscover" installed repositories, or configure a fixed list of repository names to operate on.

If the adminstrator has configured a fixed list of repositories then the only way to "install" Renovate on an additional repository is for it to be manually added for the next run or restart.

Otherwise, the process for adding new repositories to a Renovate installation can vary:

- Most commonly, you run Renovate as a dedicated "bot user" with global config option `autodiscover` set to `true`, meaning that it will run on every repository which it's been granted access to
- If using a GitHub App (including WhiteSource Renovate on `github.com`) then you can install the app into an account or org and select either "All repositories", or "Select repositories" and pick them manually

### Hosted GitHub.com App

Installing/enabling WhiteSource's Renovate GitHub App is simple.

First, navigate to [https://github.com/apps/renovate](https://github.com/apps/renovate) and click the Install button:

![Github App Install button](assets/images/github-app-install.png)

The only choice you need to make is whether to run Renovate on all repositories or on selected repositories:

![Github App repositories](assets/images/github-app-choose-repos.png)

Renovate will ignore any repositories that don't have known package files, as well as any forks, so you can enable Renovate for all your repositories with no problems.
That said, most people run Renovate on selected repositories.
Unfortunately GitHub doesn't offer a "select all except X,Y,Z" option, so you must select each repository where you want Renovate to run.

Once you're done selecting repositories for Renovate to run on, click the green Install button at the bottom of the page and Renovate will be enabled for those repositories and start the onboarding process.

Note: if you are using the WhiteSource Renovate App then it has a custom behavior for forked repositories.
If you choose "All repositories" when installing then forked repositories will be skipped by default, while if you choose "Select repositories" then they will be processed by Renovate even if they're a fork.

### Hosted GitLab.com App

Unfortunately WhiteSource's hotsed GitLab app needed to be taken offline indefinitely until a viable security model for bots on GitLab.com is available.
For more details on GitLab security for bots, please see the [GitLab Bot Security](../gitlab-bot-security.md) doc.

## Repository Onboarding

Once you have enabled Renovate on a repository, you will receive a "Configure Renovate" Pull Request looking something like this:

![Onboarding](assets/images/onboarding.png)

### No risk onboarding

Conveniently, Renovate will not make any changes to your repository or raise any further Pull Requests until after you _merge_ the onboarding Pull Request.
If there is anything about the Pull Request that you don't like or understand, take your time to read the [documentation](https://docs.renovatebot.com) or ask questions on the [discussions forum on GitHub](https://github.com/renovatebot/renovate/discussions) and merge the PR only once you're satisfied with the result.

You can edit your Renovate configuration **within the `renovate/configure` branch** and Renovate will keep updating the description in the PR to match, so you can keep doing that until you're satisfied with the results.

### Check for warnings

If you have any Warnings or Errors listed, see if you need or want to make any changes to address them.
If you do, then make them in your base branch (e.g. `main`) so that Renovate can recreate its Configure Renovate PR from it on its next cycle.

### Configuration location

The "Configure Renovate" PR will include a `renovate.json` file in the root directory, with suggested default settings.
If you don't want a `renovate.json` file in your repository you can use one of the following files instead:

- `renovate.json5`
- `.github/renovate.json`
- `.github/renovate.json5`
- `.gitlab/renovate.json`
- `.gitlab/renovate.json5`
- `.renovaterc`
- `.renovaterc.json`
- `package.json` (deprecated)

#### package.json

You can add the same settings to a `"renovate"` section in your `package.json` file instead.
The `package.json` file must be located at the root of your repository.
This is handy if you are already using a `package.json` file anyway, e.g. when you're working on a JavaScript project.
The configuration in your `package.json` will apply to the whole project (this includes other, nested `package.json` files).

Note: this approach has been deprecated and will be removed in a future release.

### Customised defaults

Most of the settings in the `renovate.json` onboarding configuration are defaults, however usually this configuration file will have some default overrides in it, such as:

- Automatically enabling Angular-style semantic commits if your repository uses them
- Determining whether to use dependency range pinning depending on the detected project type (app vs library)

### Common overrides

Please check the docs on this website for an exhaustive Configuration Reference.
To help you get started, here are some of the most commonly changed (overridden) configuration settings:

- **rangeStrategy**: By default (with zero config) it's `"replace"` however the `"config:base"` preset overrides it to `"auto"`. If you don't want to pin dependency versions and retain ranges, add the `":preserveSemverRanges"` preset to the `extends` array
- **labels**: Labels to assign to Pull Requests
- **assignees**: GitHub user(s) to assign the Pull Requests to

Renovate will update your PR description each time it finds changes.

### Merge

Once you're done checking and configuring in your Configure Renovate PR, it's time to merge it to enable the real Pull Requests to begin.

## Repository re-configuration

You might want to re-do the Renovate configuration _after_ you merged the initial onboarding PR.
Get a new onboarding PR, by following the steps described in [Reconfiguring Renovate](https://docs.renovatebot.com/reconfigure-renovate/).
If you don't receive a new onboarding PR within a few hours when using the WhiteSource Renovate App, then please create a Discussions post to request staff trigger it manually.
