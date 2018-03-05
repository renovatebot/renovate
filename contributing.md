# Contributing

Contributions are welcome and desirable, in the form of:

* Bug reports (create an issue)
* Feature requests (create an issue)
* Code (create a Pull Request)
* Comments (comment on any of the above)

Before you start any Pull Request, it's recommended that you create an issue to discuss
first if you have any doubts about requirement or implementation. That way you can be sure that the maintainer(s)
agree on what to change and how, and you can hopefully get a quick merge
afterwards.

## Running the source code locally

After you have forked and cloned the project, check that it's running OK locally.

First you will need to install dependencies. We use
[yarn](https://github.com/yarnpkg/yarn) so run `yarn install` instead of `npm install`.

Also, `renovate` supports only node.js versions 8 and above. Use a version manager like `nvm` or `n` if you'll need to switch between versions easily.

Examples of running Renovate:

```sh
$ yarn start username/reponame
$ LOG_LEVEL=trace yarn start username/reponame
$ yarn start username/reponame --renovate-fork=true
```

## Running tests

You can run `yarn test` locally to test your code. We test all PRs using the same tests, run on TravisCI.

The Renovate project maintains 100% test coverage, so any Pull Request will fail if it does not contain full coverage for code. Using `// instanbul-ignore` is not ideal but sometimes is a pragmatic solution if an additional test wouldn't really prove anything.

Also, do not let coverage put you off submitting a PR! Maybe we can help, or at least guide. Also, it can be good to submit your PR as a work in progress (WIP) without tests first so that you can get a thumbs up from others about the changes, and write tests after.

## Linting and formatting

We use [Prettier](https://github.com/prettier/prettier) for code formatting. If
your code fails `yarn test` due to a `prettier` rule then you should find that the offending file will be updated automatically and pass the second time you run `yarn test` because each time you run it, it includes the `--fix` command automatically.

## Adding configuration options

We wish to keep backwards-compatibility as often as possible, as well as make
the code configurable, so most new functionality should be controllable via
configuration options.

If you wish to add one, add it to `lib/config/definitions.js` and then add documentation to `website/docs/_posts/2017-10-05-configuration-options.md`.
