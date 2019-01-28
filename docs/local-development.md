# Local Development

This document serves to give tips and tricks on how to run Renovate locally to add features or fix bugs.
Please submit PRs to improve it if you think anything is unclear or you can think of something that should be added.

## Install

#### Fork and Clone

If you will contribute to the project, you should first "fork" the main project using the GitHub Website and then clone your fork locally.

#### Node version

Renovate supports node.js versions 8 and above. Use a version manager like `nvm` or `n` if you'll need to switch between versions easily.

#### Install dependencies

We use [yarn](https://github.com/yarnpkg/yarn) so run `yarn install` to install dependencies instead of `npm install`.

#### Verify installation

Run `yarn start`. You should see this error:

```
FATAL: Renovate fatal error: You need to supply a GitHub token.
```

## Platform Account Setup

Although it's possible to make small source code improvements without testing against a real repository, in most cases it's important that you run a "real" test on a repository before you submit a feature or fix. It's possible to do this against GitHub, GitLab or Bitbucket public servers.

#### Register new account (optional)

If you're going to be doing a lot of Renovate development then it's recommended that you set up a dedicated test account on GitHub or GitLab, so that you reduce the risk that you accidentally cause problems when testing out Renovate.

e.g. if your GitHub username is "alex88" then maybe you register "alex88-testing" for use with Renovate.

#### Generate platform token

Once you have decided on your platform and account, log in and [generate a "Personal Access Token"](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/) that can be used to authenticate Renovate.

#### Export platform token

Although you can specify a token to Renovate using `--token=`, it can be inconvenient if you need to include this every time.
You are better off to instead export the Environment Variable `RENOVATE_TOKEN` for this.

#### Run against a real repo

To make sure everything is working, create a test repo in your account, e.g. like `https://github.com/r4harry/testrepo1`. Now, add a file called `.nvmrc` with the content `8.13.0`. Now run against the test repo you created, e.g. `yarn start r4harry/testrepo1`. If your token is set up correctly, you should find that it added a "Configure Renovate" PR inside the repo.

If this is working then in future you can create other test repos to verify your code changes against.

## Tests

You can run `yarn test` locally to test your code. We test all PRs using the same tests, run on TravisCI. `yarn test` runs an `eslint` check, a `prettier` check, and then all the unit tests using `jest`.

## Jest

You can run just the Jest unit tests by running `yarn jest`. You can also run just a subset of the Jest tests using file matching, e.g. `yarn jest composer` or `yarn jest workers/branch`. If you get a test failure due to a "snapshot" mismatch, and you are sure that you need to update the snapshot, then you can append `-u` to the end. e.g. `yarn jest composer -u` would update the saved Snapshots for _all_ tests in `test/manager/composer/*`.

#### Coverage

The Renovate project maintains 100% test coverage, so any Pull Request will fail if it does not contain full coverage for code.
Using `// istanbul ignore` is not ideal but sometimes is a pragmatic solution if an additional test wouldn't really prove anything.

To view the current test coverage locally, open up `coverage/lcov-report/index.html` in your browser.

Do not let coverage put you off submitting a PR! Maybe we can help, or at least guide.
Also, it can be good to submit your PR as a work in progress (WIP) without tests first so that you can get a thumbs up from others about the changes, and write tests after.

#### Linting and formatting

We use [Prettier](https://github.com/prettier/prettier) for code formatting. If your code fails `yarn test` due to a `prettier` rule then run `yarn lint-fix` to fix it or most `eslint` errors automatically before running `yarn test` again. You usually shouldn't need to fix any prettier errors manually.

## Keeping your Renovate fork up to date

First of all, never commit to `master` of your fork - always use a branch like `feat/1234-add-yarn-parsing`.

Then, make sure your fork is up to date with `master` each time before creating a new branch. To do this, see these GitHub guides:

[Configuring a remote for a fork](https://help.github.com/articles/configuring-a-remote-for-a-fork/)

[Syncing a fork](https://help.github.com/articles/syncing-a-fork/)

## Tips and tricks

#### Runnign Renovate against forked repositories

Quite often, the quickest way for you to test or fix something is to fork an existing repository.
However, by default Renovate skips over repositories that are forked.
To override this default, you need to specify the setting `includeForks` as `true`.

Option 1: Add `"includeForks": true` to the `renovate.json` of the repository
Option 2: Run Renovate with the CLI flag `--renovate-fork=true`

#### Log files

Usually, `debug` is good enough to troubleshoot most problems or verify functionality.

When logging at debug, it's usually easiest to view the logs in a text editor, so in that case you can run like this:

```
$ rm -f debug.log && yarn start myaccount/therepo --log-level=debug > debug.log
```

The above will delete any existing `debug.log` and then save Renovate's output to that file.

#### Adding configuration options

We wish to keep backwards-compatibility as often as possible, as well as make
the code configurable, so most new functionality should be controllable via
configuration options.

If you wish to add one, add it to `lib/config/definitions.js` and then add documentation to `website/docs/_posts/2017-10-05-configuration-options.md`.

## Debugging

It's really easy to debug Renovate using Chrome's inspect tool. Try like this:

1. Open `chrome://inspect` in Chrome, then click on "Open dedicated DevTools for Node"
2. Add a `debugger;` statement somewhere in the source code where you want to start debugging
3. Run Renovate using `yarn debug ...` instead of `yarn start ...`
4. Click "Resume script execution" in Chrome DevTools and wait for your break point to be triggered
