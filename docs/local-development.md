# Local Development

This document serves to give tips and tricks on how to run Renovate locally to add features or fix bugs.
Please submit PRs to improve it if you think anything is unclear or you can think of something that should be added.

## Install

#### Fork and Clone

If you will contribute to the project, you should first "fork" it using the GitHub Website and then clone your fork.

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

Although it's possible to make small changes without testing against a real repository, in most cases it's important that you run a "real" test on a repository before you submit a feature or fix.
It's possible to do this against GitHub or GitLab public hosts, and you can also use both.

#### Register new account (optional)

It's recommended that you set up a dedicated test account on GitHub or GitLab, so that you minimise the risk that you accidentally cause problems when testing out Renovate.
e.g. if your GitHub username is "alex88" then maybe you register "alex88-testing" for use with Renovate.

#### Generate platform token

Once you have decided on your platform and account, log in and generate a "Personal Access Token" that can be used to authenticate Renovate.

#### Export platform token

Although you can specify a token to Renovate using `--token=`, it is annoying if you need to include this every time.
You are better off to instead export an Environment Variable for this.
If your platform of choice is GitHub, then export GITHUB_TOKEN, and if it's GitLab then export GITLAB_TOKEN.
It's also find to export both so that you can switch between platforms.

## Tests

You can run `yarn test` locally to test your code. We test all PRs using the same tests, run on TravisCI.

#### Coverage

The Renovate project maintains 100% test coverage, so any Pull Request will fail if it does not contain full coverage for code.
Using `// instanbul-ignore` is not ideal but sometimes is a pragmatic solution if an additional test wouldn't really prove anything.

To view the current test coverage locally, open up `coverage/lcov-report/index.html` in your browser.

Do not let coverage put you off submitting a PR! Maybe we can help, or at least guide.
Also, it can be good to submit your PR as a work in progress (WIP) without tests first so that you can get a thumbs up from others about the changes, and write tests after.

#### Linting and formatting

We use [Prettier](https://github.com/prettier/prettier) for code formatting. If
your code fails `yarn test` due to a `prettier` rule then you should find that the offending file will be updated automatically and pass the second time you run `yarn test` because each time you run it, it includes the `--fix` command automatically.

## Tips and tricks

#### Forked repositories

Quite often, the quickest way for you to test or fix something is to fork an existing repository.
However, by default Renovate skips over repositories that are forked.
To override this default, you need to specify the setting `renovateFork` as `true`.

Option 1: Add `"renovateFork": true` to the `renovate.json` of the repository
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
