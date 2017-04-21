# Contributing

Contributions are welcome and desirable, in the form of:

- Bug reports (raise an issue)
- Feature requests (raise an issue)
- Code (submit a Pull Request)
- Comments (comment on any of the above)

Before you submit any code, it's recommended that you raise an issue first if you have any doubts. That way you can be sure that the maintainer(s) agree on what to change and how, and you can hopefully get a quick merge afterwards.

## Running the source code locally

After you have cloned the project, first check that it's running OK locally.

First you will need to install dependencies. We use [yarn](https://github.com/yarnpkg/yarn) so run `yarn` instead of `npm install`.

`renovate` supports node versions 6.9 and above. It is written using async/await so needs `babel` transpilation for node 6.

If running in node 6, you need to run a transpiled version of the code. You can do this without an explicit transpilation step by running `yarn run start-babel`.
Examples:

```sh
$ yarn run start-babel username/reponame
$ LOG_LEVEL=verbose yarn run start-babel username/reponame
$ yarn run start-babel -- --labels=foo username/reponame
```

If running on node 7, you can run just like the above, but use the `yarn run start-raw` command instead of `yarn run start-babel`.

## Adding configuration options

We wish to keep backwards-compatibility as often as possible, as well as make the code configurable, so most new functionality should be controllable via configuration options.
Please see [Configuration docs](docs/configuration.md) for a list of current options.

If you wish to add one, add it to `lib/config/definitions.js` and then run `yarn run update-docs`.

## Running tests

You can run `yarn test` locally to test your code. We also run Continuous Integration using CircleCI.

We use [Prettier](https://github.com/prettier/prettier) for code formatting. If your code fails `yarn test` due to a `prettier` rule in `eslint` then it can be fixed by running `yarn run eslint-fix`;
