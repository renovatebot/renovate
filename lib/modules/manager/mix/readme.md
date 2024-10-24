The `mix` manager extracts dependencies for the `hex` datasource and uses Renovate's implementation of Hex SemVer to evaluate updates.

The `mix` package manager itself is also used to keep the lock file up-to-date.

### Private organizations on hex.pm

When your mix file contains organization dependencies, you must define a `hostRule` for hex.pm. You will need a hex.pm token with API read and Organization
access permissions.

```elixir
{:private_package, "~> 0.17.0", organization: "your_org"}
```

```js
module.exports = {
  hostRules: [
    {
      matchHost: 'https://hex.pm/api/repos/your_org/',
      token: process.env.RENOVATE_HEX_TOKEN,
      authType: 'Token-Only',
    },
    {
      matchHost: 'https://getoban.pro/repo',
      token: process.env.RENOVATE_OBAN_AUTH_TOKEN,
      authType: 'Token-Only',
    },
  ],
};
```

### Private registries

When your mix file contains repo dependencies, you must define a `hostRule` for
the registry _and_ a `registryAlias`.

```elixir
{:oban, "~> 2.14"},
{:oban_pro, "~> 0.13", repo: "oban"},
{:oban_web, "~> 2.9", repo: "oban"}
```

```js
module.exports = {
  hostRules: [
    {
      matchHost: 'https://getoban.pro/repo',
      token: process.env.RENOVATE_OBAN_AUTH_TOKEN,
      authType: 'Token-Only',
    },
  ],
  registryAliases: {
    oban: 'https://getoban.pro/repo',
  },
};
```
