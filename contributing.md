# Contributing

Contributions are welcome and desirable, in the form of:

- Bug reports (raise an issue)
- Feature requests (raise an issue)
- Code (submit a Pull Request)
- Comments (comment on any of the above)

Before you start any Pull Request, it's recommended that you raise an issue first if you have any doubts. That way you can be sure that the maintainer(s) agree on what to change and how, and you can hopefully get a quick merge afterwards.

## Running the source code locally

After you have cloned the project, first check that it's running OK locally.

First you will need to install dependencies. We use [yarn](https://github.com/yarnpkg/yarn) so run `yarn` instead of `npm install`.

`renovate` supports nodejs versions 8 and above.

Examples:

```sh
$ yarn start username/reponame
$ LOG_LEVEL=trace yarn start username/reponame
$ yarn start -- --labels=foo username/reponame
```

## Adding configuration options

We wish to keep backwards-compatibility as often as possible, as well as make the code configurable, so most new functionality should be controllable via configuration options.
Please see [Configuration docs](docs/configuration.md) for a list of current options.

If you wish to add one, add it to `lib/config/definitions.js` and then run `yarn run update-docs`.

## Running tests

You can run `yarn test` locally to test your code. We also run Continuous Integration using CircleCI.

We use [Prettier](https://github.com/prettier/prettier) for code formatting. If your code fails `yarn test` due to a `prettier` rule in `eslint` then it can be fixed by running `yarn run lint-fix`;
