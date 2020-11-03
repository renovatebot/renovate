# Local Development

This document gives tips and tricks on how to run Renovate locally to add features or fix bugs.
You can improve this documentation by opening a pull request.
For example, if you think anything is unclear, or you think something needs to be added, open a pull request!

## Installation

### Prerequisites

You need the following dependencies for local development:

- Git
- Node.js `^12.13.0 || >=14.15.0`
- Yarn `^1.17.0`
- C++ compiler
- Python `^3.8`
- Java between `8` and `12`

We support Node.js versions according to the [Node.js release schedule](https://github.com/nodejs/Release#release-schedule).

You need Java to execute Gradle tests.
If you don’t have Java installed, the Gradle tests will be skipped.

_Linux_

You can use the following commands on Ubuntu.

```sh
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update
sudo apt-get install -y git python-minimal build-essential nodejs yarn default-jre-headless
```

You can also use [SDKMAN](https://sdkman.io/) to manage Java versions.

_Windows_

Follow these steps to set up your development environment on Windows 10.
If you already installed a component, skip the corresponding step.

- Install [Git](https://git-scm.com/downloads). Make sure you've [configured your username and email](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup).
- Install [Node.js LTS](https://nodejs.org/en/download/).
- In an Administrator PowerShell prompt, run `npm install -global npm` and then `npm --add-python-to-path='true' --debug install --global windows-build-tools`.
- Install [Yarn](https://yarnpkg.com/lang/en/docs/install/#windows-stable).
- Install Java, e.g. from [AdoptOpenJDK](https://adoptopenjdk.net/?variant=openjdk11) or any other distribution.

  Verify you're using the appropriate versions:

  ```
  PS C:\Windows\system32> git --version
  git version 2.29.0.windows.1
  PS C:\Windows\system32> node --version
  v14.15.0
  PS C:\Windows\system32> yarn --version
  1.22.4
  PS C:\Windows\system32> python --version
  Python 3.8.1
  PS C:\Windows\system32> python -c "from unittest import mock; print(mock.__version__)"
  1.0
  PS C:\Windows\system32> java -version
  openjdk version "11.0.6" 2020-01-14
  OpenJDK Runtime Environment 18.9 (build 11.0.6+10)
  OpenJDK 64-Bit Server VM 18.9 (build 11.0.6+10, mixed mode)
  ```

_VS Code Remote Development_

If you are using [VS Code](https://code.visualstudio.com/) you can skip installing [the prerequisites](#prerequisites) and work in a [development container](https://code.visualstudio.com/docs/remote/containers) instead.

- Install the [Remote - Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) and [check its system requirements](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers#system-requirements).
- Open the repository folder in VS Code
- Choose "Reopen in Container" via the command palette or the small button in the lower left corner.

VS Code [integrated terminal](https://code.visualstudio.com/docs/editor/integrated-terminal) is now running in the container and can be used to run additional commands.

## Fork and Clone

If you want to contribute to the project, you should first "fork" the main project using the GitHub Website and then clone your fork locally.
The Renovate project uses the [Yarn](https://github.com/yarnpkg/yarn) package management system instead of npm.

To ensure everything is working properly on your end, you must:

1. Make sure you don't have a local `.npmrc` file that overrides npm's default registry.
1. Install all dependencies with `yarn install`.
1. Make a build with `yarn build`, which should pass with no errors.
1. Verify all tests pass and have 100% test coverage, by running `yarn test`.
1. Verify the installation by running `yarn start`. You must see this error: `Fatal error: No authentication found for platform https://api.github.com/ (github)`

You only need to do these 5 steps this one time.

Before you submit a pull request you should:

1. Install newer dependencies with `yarn install`.
1. Run the tests with `yarn test`.

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
If your token is set up correctly, you should find that it added a "Configure Renovate" PR inside the repo.

If this is working then in future you can create other test repos to verify your code changes against.

## Tests

You can run `yarn test` locally to test your code.
We test all PRs using the same tests, run on GitHub Actions.
`yarn test` runs an `eslint` check, a `prettier` check, a `type` check and then all the unit tests using `jest`.

### Prerequisites

You need to have Python with `mock` installed for all tests to pass.
Python 3 includes `mock` so that approach is recommended.

### Jest

You can run just the Jest unit tests by running `yarn jest`.
You can also run just a subset of the Jest tests using file matching, e.g. `yarn jest composer` or `yarn jest workers/branch`.
If you get a test failure due to a "snapshot" mismatch, and you are sure that you need to update the snapshot, then you can append `-u` to the end.
e.g. `yarn jest composer -u` would update the saved snapshots for _all_ tests in `**/composer/**`.

### Coverage

The Renovate project maintains 100% test coverage, so any Pull Request will fail if it does not contain full coverage for code.
Using `// istanbul ignore` is not ideal but sometimes is a pragmatic solution if an additional test wouldn't really prove anything.

To view the current test coverage locally, open up `coverage/index.html` in your browser.

Do not let coverage put you off submitting a PR!
Maybe we can help, or at least guide.
Also, it can be good to submit your PR as a work in progress (WIP) without tests first so that you can get a thumbs up from others about the changes, and write tests after.

## Linting and formatting

We use [Prettier](https://github.com/prettier/prettier) for code formatting.
If your code fails `yarn test` due to a `prettier` rule then run `yarn lint-fix` to fix it or most `eslint` errors automatically before running `yarn test` again.
You usually shouldn't need to fix any Prettier errors manually.

## Keeping your Renovate fork up to date

First of all, never commit to `master` of your fork - always use a branch like `feat/1234-add-yarn-parsing`.

Then, make sure your fork is up to date with `master` each time before creating a new branch. To do this, see these GitHub guides:

[Configuring a remote for a fork](https://help.github.com/articles/configuring-a-remote-for-a-fork/)

[Syncing a fork](https://help.github.com/articles/syncing-a-fork/)

## Tips and tricks

### Running Renovate against forked repositories

Quite often, the quickest way for you to test or fix something is to fork an existing repository.
However, by default Renovate skips over repositories that are forked.
To override this default, you need to specify the setting `includeForks` as `true`.

Option 1: Add `"includeForks": true` to the `renovate.json` of the repository
Option 2: Run Renovate with the CLI flag `--renovate-fork=true`

### Log files

Usually, `debug` is good enough to troubleshoot most problems or verify functionality.

When logging at debug, it's usually easiest to view the logs in a text editor, so in that case, you can run like this:

```
$ rm -f debug.log && yarn start myaccount/therepo --log-level=debug > debug.log
```

The above will delete any existing `debug.log` and then save Renovate's output to that file.

### Adding configuration options

We wish to keep backwards-compatibility as often as possible, as well as make the code configurable, so most new functionality should be controllable via configuration options.

If you wish to add one, add it to `lib/config/definitions.ts` and then add documentation to `website/docs/configuration-options.md`.

## Debugging

It's really easy to debug Renovate using Chrome's inspect tool.
Try like this:

1. Open `chrome://inspect` in Chrome, then click on "Open dedicated DevTools for Node"
2. Add a `debugger;` statement somewhere in the source code where you want to start debugging
3. Run Renovate using `yarn debug ...` instead of `yarn start ...`
4. Click "Resume script execution" in Chrome DevTools and wait for your break point to be triggered

If you are using VS Code, try like this:

1. In the configuration file, i.e `config.js` in the root directory of the project, add `token` with your personal access token.
2. In the same configuration file, add `repositories` with the repository you want to test against. The file `config.js` would look something like this:

```javascript
module.exports = {
  token: 'xxxxxxxx',
  repositories: ['r4harry/testrepo1'],
};
```

3. Set a breakpoint somewhere in the source code and launch the application in debug mode with selected configuration as `debug`.
4. Wait for your breakpoint to be triggered.
