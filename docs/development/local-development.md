# Local Development

This document gives tips and tricks on how to run Renovate locally to add features or fix bugs.
You can improve this documentation by opening a pull request.
For example, if you think anything is unclear, or you think something needs to be added, open a pull request!

## Installation

### Prerequisites

You need the following dependencies for local development:

- Git `>=2.33.0`
- Node.js `>=14.15.4`
- Yarn `^1.22.5`
- C++ compiler
- Java between `8` and `12`

We support Node.js versions according to the [Node.js release schedule](https://github.com/nodejs/Release#release-schedule).

You need Java to execute Gradle tests.
If you don’t have Java installed, the Gradle tests will be skipped.

#### Linux

You can use the following commands on Ubuntu.

```sh
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update
sudo apt-get install -y git build-essential nodejs yarn default-jre-headless
```

You can also use [SDKMAN](https://sdkman.io/) to manage Java versions.

#### Windows

Follow these steps to set up your development environment on Windows 10.
If you already installed a part, skip the corresponding step.

- Install [Git](https://git-scm.com/downloads). Make sure you've [configured your username and email](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup)
- Install [Node.js LTS](https://nodejs.org/en/download/)
- In an Administrator PowerShell prompt, run `npm install -global npm` and then `npm --debug install --global windows-build-tools`
- Install [Yarn](https://yarnpkg.com/lang/en/docs/install/#windows-stable)
- Install Java, e.g. from [AdoptOpenJDK](https://adoptopenjdk.net/?variant=openjdk11) or any other distribution

  You can see what versions you're using like this:

  ```powershell
  PS C:\Windows\system32> git --version
  PS C:\Windows\system32> node --version
  PS C:\Windows\system32> yarn --version
  PS C:\Windows\system32> java -version
  ```

#### VS Code Remote Development

If you are using [VS Code](https://code.visualstudio.com/) you can skip installing [the prerequisites](#prerequisites) and work in a [development container](https://code.visualstudio.com/docs/remote/containers) instead.

- Install the [Remote - Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) and [check its system requirements](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers#system-requirements)
- Open the repository folder in VS Code
- Choose "Reopen in Container" via the command palette or the small button in the lower left corner

The VS Code [integrated terminal](https://code.visualstudio.com/docs/editor/integrated-terminal) is now running in the container and can be used to run additional commands.

#### Local Docker

If, for some reason, you can't run the relevant versions on your local machine, you can run everything from a Docker image.
To build the correct docker image:

```
docker build -f .devcontainer/Dockerfile -t renovatebot_local .
```

Then you can run Yarn directly from Docker, for instance:

```
docker run -it --rm -v "$PWD":/usr/src/app -w /usr/src/app renovatebot_local yarn install
```

## Fork and Clone

If you want to contribute to the project, you should first "fork" the main project using the GitHub website and then clone your fork locally.
The Renovate project uses the [Yarn](https://github.com/yarnpkg/yarn) package management system instead of npm.

To ensure everything is working properly on your end, you must:

1. Install all dependencies with `yarn install`
1. Make a build with `yarn build`, which should pass with no errors
1. Verify all tests pass and have 100% test coverage, by running `yarn test`
1. Verify the installation by running `yarn start`. You must see this error: `You must configure a GitHub personal access token`

You only need to do these steps once.

Before you submit a pull request you should:

1. Install newer dependencies with `yarn install`
1. Run the tests with `yarn test`

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
Now run against the test repo you created, e.g. `yarn start r4harry/testrepo1`.
If your token is set up correctly, you should find that Renovate created a "Configure Renovate" PR in the `testrepo1`.

If this is working then in future you can create other test repos to verify your code changes against.

## Tests

You can run `yarn test` locally to test your code.
We test all PRs using the same tests, run on GitHub Actions.
`yarn test` runs an `eslint` check, a `prettier` check, a `type` check and then all the unit tests using `jest`.

Refactor PRs should ideally not change or remove tests (adding tests is OK).

### Jest

You can run just the Jest unit tests by running `yarn jest`.
You can also run just a subset of the Jest tests using file matching, e.g. `yarn jest composer` or `yarn jest workers/repository/update/branch`.
If you get a test failure due to a "snapshot" mismatch, and you are sure that you need to update the snapshot, then you can append `-u` to the end.
e.g. `yarn jest composer -u` would update the saved snapshots for _all_ tests in `**/composer/**`.

### Coverage

The Renovate project maintains 100% test coverage, so any Pull Request will fail if it does not have full coverage for code.
Using `// istanbul ignore` is not ideal but sometimes is a pragmatic solution if an additional test wouldn't really prove anything.

To view the current test coverage locally, open up `coverage/index.html` in your browser.

Do not let coverage put you off submitting a PR!
Maybe we can help, or at least guide.
Also, it can be good to submit your PR as a work in progress (WIP) without tests first so that you can get a thumbs up from others about the changes, and write tests after.

## Linting and formatting

We use [Prettier](https://github.com/prettier/prettier) to format our code.
If your code fails `yarn test` due to a `prettier` rule then run `yarn lint-fix` to fix it or most `eslint` errors automatically before running `yarn test` again.
You usually don't need to fix any Prettier errors by hand.

If you're only working on the documentation files, you can use the `yarn doc-fix` command to format your work.

## Keeping your Renovate fork up to date

First of all, never commit to the `main` branch of your fork - always use a "feature" branch like `feat/1234-add-yarn-parsing`.

Make sure your fork is up-to-date with the Renovate `main` branch, check this each time before you create a new branch.
To do this, see these GitHub guides:

[Configuring a remote for a fork](https://help.github.com/articles/configuring-a-remote-for-a-fork/)

[Syncing a fork](https://help.github.com/articles/syncing-a-fork/)

## Tips and tricks

### Running Renovate against forked repositories

Quite often, the quickest way for you to test or fix something is to fork an existing repository.
But by default Renovate skips over repositories that are forked.
To override this default, you need to specify the setting `includeForks` as `true`.

Tell Renovate to run on your forked repository by doing one of the following:

1. Add `"includeForks": true` to the `renovate.json` file in your forked repository
1. Run Renovate with the CLI flag `--renovate-fork=true`

### Log files

Usually, `debug` is good enough to troubleshoot most problems or verify functionality.

It's usually easier to have the logs in a file that you can open with a text editor.
You can use a command like this to put the log messages in a file:

```
LOG_LEVEL=debug yarn start myaccount/therepo > debug.log
```

The example command will redirect/save Renovate's output to the `debug.log` file (and overwrite `debug.log` if it already exists).

### Adding configuration options

We want stay backwards-compatible as much as possible, as well as make the code configurable.
So most new functionality should be controllable via configuration options.

Create your new configuration option in the `lib/config/options/index.ts` file.
Also create documentation for the option in the `docs/usage/configuration-options.md` file.

## Debugging

### Chrome's inspect tool

It's really easy to debug Renovate with the help of Chrome's inspect tool.
Here's an example:

1. Open `chrome://inspect` in Chrome, then click on "Open dedicated DevTools for Node"
1. Add a `debugger;` statement somewhere in the source code where you want to start debugging
1. Run Renovate using `yarn debug ...` instead of `yarn start ...`
1. Click "Resume script execution" in Chrome DevTools and wait for your break point to be triggered

### VS Code

You can also debug with VS Code.
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
