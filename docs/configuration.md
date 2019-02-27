# Configuration

## Configuration Methods

Configuration is supported via any or all of the below:

- Configuration file
- Environment
- CLI
- `renovate.json`, `.github/renovate.json`, `.renovaterc.json`, or `.renovaterc` in target repository
- `renovate` field of `package.json` in target repository

The above are listed in reverse order of preference. i.e. `package.json`
settings will override `renovate.json` settings, CLI, which overrides env, which
overrides the config file, which overrides defaults.

### Default Configuration

Default configuration values can be found in
[lib/config/definitions.js](../lib/config/definitions.js)

### Configuration File

You can override default configuration using a configuration file, with default
name `config.js` in the working directory. If you need an alternate location or
name, set it in the environment variable `RENOVATE_CONFIG_FILE`.

Using a configuration file gives you very granular configuration options. For
instance, you can override most settings at the global (file), repository, or
package level. e.g. apply one set of labels for `backend/package.json` and a
different set for `frontend/package.json` in the same repository.

```javascript
module.exports = {
  labels: ['upgrade'],
  repositories: [
    {
      repository: 'singapore/repo1',
      packageRules: [
        {
          paths: ['frontend/package.json'],
          labels: ['upgrade', 'frontend'],
        },
      ],
    },
    {
      repository: 'singapore/repo2',
      labels: ['renovate'],
    },
    'singapore/repo3',
  ],
  packageRules: [
    {
      packageNames: ['jquery'],
      labels: ['jquery', 'uhoh'],
    },
  ],
};
```

### CLI

```
$ node renovate --help
```

To configure any `<list>` items, separate with commas. E.g. `renovate --labels=renovate,dependency`.

### renovate.json

If you add a `renovate.json` file to the root of your repository, you can use
this to override default settings. `renovate` will still auto-discover all `package.json` files in the
repository.

### package.json

If you add configuration options to your `package.json` then these will override
any other settings above.

```json
"renovate": {
  "labels": [
    "upgrade",
    "bot"
  ]
}
```

## Configuration Options

Please see [https://renovatebot.com/docs/configuration-options/](https://renovatebot.com/docs/configuration-options/) for a list of user-facing configuration options.

For further options when running your own instance of Renovate, please see the full config definitions file at `lib/config/definitions.js`.
