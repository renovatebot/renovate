# Local Development

This document gives tips and tricks on how to run Renovate locally to add features or fix bugs.
You can improve this documentation by opening a pull request.
For example, if you think anything is unclear, or you think something needs to be added, open a pull request!

## Installation

### Prerequisites

You need the following dependencies for local development:

- Git `>=2.33.0`
- Node.js `^18.12.0 || >=20.0.0`
- pnpm `^8.6.11` (use corepack)
- C++ compiler

We recommend you use the version of Node.js defined in the repository's `.nvmrc`.

#### Linux

You can use the following commands on Ubuntu.

```sh
curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y git build-essential nodejs
corepack enable
```

#### Nix

To enter a development shell with the necessary packages, run `nix-shell --packages gcc gitFull nodejs` and then `corepack enable`.

#### Windows

Follow these steps to set up your development environment on Windows 10.
If you already installed a part, skip the corresponding step.

- Install [Git](https://git-scm.com/downloads). Make sure you've [configured your username and email](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup)
- Install [Node.js LTS](https://nodejs.org/en/download/)
- In an Administrator PowerShell prompt, run `npm install -global npm` and then `npm --debug install --global windows-build-tools`
- Enable corepack: `corepack enable`

  You can see what versions you're using like this:

  ```powershell
  PS C:\Windows\system32> git --version
  PS C:\Windows\system32> node --version
  PS C:\Windows\system32> pnpm --version
  ```

#### VS Code Dev Containers

If you are using [VS Code](https://code.visualstudio.com/) you can skip installing [the prerequisites](#prerequisites) and work in a [development container](https://code.visualstudio.com/docs/devcontainers/containers) instead.

- Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) and [check its system requirements](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers#system-requirements)
- Open the repository folder in VS Code
- Choose "Reopen in Container" via the command palette or the small button in the lower left corner

The VS Code [integrated terminal](https://code.visualstudio.com/docs/editor/integrated-terminal) is now running in the container and can be used to run more commands.

To build inside the container:

```shell
pnpm build
```

#### Local Docker

If, for some reason, you can't run the relevant versions on your local machine, you can run everything from a Docker image.
To build the correct docker image:

```
docker build -f .devcontainer/Dockerfile -t renovatebot_local .
```

Starting from Docker Engine 23.0 and Docker Desktop 4.19, Docker uses Buildx by default.
So you must run the following command to get the image loaded to the Docker image store:

```
docker build -f .devcontainer/Dockerfile -t renovatebot_local --load .
```

Then you can run `pnpm` directly from Docker, for instance:

```
docker run -it --rm -v "${PWD}:/usr/src/app" -w /usr/src/app renovatebot_local pnpm install
```

## Fork and Clone

If you want to contribute to the project, you should first "fork" the main project using the GitHub website and then clone your fork locally.
The Renovate project uses the [pnpm](https://github.com/pnpm/pnpm) package management system instead of npm.

To ensure everything is working properly on your end, you must:

1. Install all dependencies with `pnpm install`
1. Make a build with `pnpm build`, which should pass with no errors
1. Verify all tests pass and have 100% test coverage, by running `pnpm test`
1. Verify the installation by running `pnpm start`. You must see this error: `You must configure a GitHub personal access token`

Do not worry about the token error for now, as you will be given instructions on how to configure the token a little later down in this document.

You only need to do these steps once.

Before you submit a pull request you should:

1. Install newer dependencies with `pnpm install`
1. Run the tests with `pnpm test`

## Platform Account Setup

Although it's possible to make small source code improvements without testing against a real repository, in most cases you should run a "real" test on a repository before you submit a feature or fix.
It's possible to do this against GitHub, GitLab or Bitbucket public servers.

### Register new account (optional)

If you're going to be doing a lot of Renovate development then it's recommended that you set up a dedicated test account on GitHub or GitLab, so that you reduce the risk that you accidentally cause problems when testing out Renovate.

e.g. if your GitHub username is "alex88" then maybe you register "alex88-testing" for use with Renovate.

### Generate platform token

Once you have decided on your platform and account, log in and [generate a "Personal Access Token"](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/) that can be used to authenticate Renovate.
Select **repo** scope when generating the token.

### Export platform token

Although you can specify a token to Renovate using `--token=`, it can be inconvenient if you need to include this every time.
You are better off to instead export the Environment Variable `RENOVATE_TOKEN` for this.

### Run against a real repo

To make sure everything is working, create a test repo in your account, e.g. like `https://github.com/r4harry/testrepo1`.
Now, add a file called `.nvmrc` with the content `8.13.0`.
Now run against the test repo you created, e.g. `pnpm start r4harry/testrepo1`.
If your token is set up correctly, you should find that Renovate created a "Configure Renovate" PR in the `testrepo1`.

If this is working then in future you can create other test repos to verify your code changes against.

## Tests

You can run `pnpm test` locally to test your code.
We test all PRs using the same tests, run on GitHub Actions.
`pnpm test` runs an `eslint` check, a `prettier` check, a `type` check and then all the unit tests using `jest`.

Refactor PRs should ideally not change or remove tests (adding tests is OK).

### Jest

Run the Jest unit tests with the `pnpm jest` command.
You can also run a subset of the Jest tests using file matching, e.g. `pnpm jest composer` or `pnpm jest workers/repository/update/branch`.
If you get a test failure due to a "snapshot" mismatch, and you are sure that you need to update the snapshot, then you can append `-u` to the end.
e.g. `pnpm jest composer -u` would update the saved snapshots for _all_ tests in `**/composer/**`.

### Coverage

The Renovate project maintains 100% test coverage, so any Pull Request will fail if it does not have full coverage for code.
Using `// istanbul ignore` is not ideal, but can be a pragmatic solution if adding more tests wouldn't really prove anything.

To view the current test coverage locally, open up `coverage/index.html` in your browser.

Do not let coverage put you off submitting a PR!
Maybe we can help, or at least guide.
Also, it can be good to submit your PR as a work in progress (WIP) without tests first so that you can get a thumbs up from others about the changes, and write tests after.

## Linting and formatting

We use [Prettier](https://github.com/prettier/prettier) to format our code.
If your code fails `pnpm test` due to a `prettier` rule then run `pnpm lint-fix` to fix it or most `eslint` errors automatically before running `pnpm test` again.
You usually don't need to fix any Prettier errors by hand.

If you're only working on the documentation files, you can use the `pnpm doc-fix` command to format your work.

## Keeping your Renovate fork up to date

First of all, never commit to the `main` branch of your fork - always use a "feature" branch like `feat/1234-add-yarn-parsing`.

Make sure your fork is up-to-date with the Renovate `main` branch, check this each time before you create a new branch.
To do this, see these GitHub guides:

[Configuring a remote for a fork](https://help.github.com/articles/configuring-a-remote-for-a-fork/)

[Syncing a fork](https://help.github.com/articles/syncing-a-fork/)

## Tips and tricks

### Log files

Usually, `debug` is good enough to troubleshoot most problems or verify functionality.

It's usually easier to have the logs in a file that you can open with a text editor.
You can use a command like this to put the log messages in a file:

```sh
LOG_LEVEL=debug pnpm start myaccount/therepo > debug.log
```

The example command will redirect/save Renovate's output to the `debug.log` file (and overwrite `debug.log` if it already exists).

### Adding configuration options

We want stay backwards-compatible as much as possible, as well as make the code configurable.
So most new functionality should be controllable via configuration options.

Create your new configuration option in the `lib/config/options/index.ts` file.
Also create documentation for the option in the `docs/usage/configuration-options.md` file.

## Debugging

### Chrome's inspect tool

You can debug Renovate with Chrome's inspect tool.
Here's an example:

1. Open `chrome://inspect` in Chrome, then select "Open dedicated DevTools for Node"
1. Add a `debugger;` statement somewhere in the source code where you want to start debugging
1. Run Renovate using `pnpm debug ...` instead of `pnpm start ...`
1. Select "Resume script execution" in Chrome DevTools and wait for your break point to be triggered

### VS Code

You can also debug Renovate with VS Code.
Here's an example:

1. In the configuration file, e.g. `config.js` in the root directory of the project, add `token` with your Personal Access Token
2. In the same configuration file, add `repositories` with the repository you want to test against. The file `config.js` would look something like this:

```javascript
module.exports = {
  token: 'xxxxxxxx',
  repositories: ['r4harry/testrepo1'],
};
```

<!-- markdownlint-disable MD029 -->

3. Set a breakpoint somewhere in the source code and launch the application in debug mode with selected configuration as `debug`
4. Wait for your breakpoint to be triggered
