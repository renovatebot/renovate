# Configuration Methods

Configuration is supported via any or all of the below:
- Configuration file
- Environment
- CLI
- `package.json` of target repository

The above are listed in reverse order of preference.
i.e. `package.json` options will override, CLI, which overrides env, which overrides the config file, which overrides defaults.

## Default Configuration

Default configuration can be found in [lib/config/default.js](../lib/config/default.js)

## Configuration File

You can override default configuration using a configuration file, with default name `config.js` in the working directory. If you need an alternate location or name, set it in the environment variable `RENOVATE_CONFIG_FILE`.

Using a configuration file gives you very granular configuration options. For instance, you can override most settings at the global (file), repository, or package level. e.g. apply one set of labels for `backend/package.json` and a different set for `frontend/package.json` in the same repository.

```javascript
module.exports = {
  labels: ['defaults'],
  depTypes: ['dependencies', 'devDependencies'],
  repositories: [
    {
      repository: 'singapore/repo1',
      packageFiles: [
        'package.json',
        {
          fileName: 'frontend/package.json',
          labels: ['frontend']
        },
      ],
    },
    {
      repository: 'singapore/repo2',
      depTypes: ['dependencies', 'devDependencies', 'optionalDependencies'],
      labels: ['renovate'],
    },
    'singapore/repo3',
  ]
}
```

## CLI

```
$ renovate --help

  Usage: renovate [options] [repositories...]

  Options:

    -h, --help                  output usage information
    -d, --dep-types <list>      List of dependency types
    -i, --ignore-deps <list>    List of dependencies to ignore
    -b, --labels <list>         List of labels to apply
    -l, --log-level <level>     Log Level
    -p, --package-files <list>  List of package.json file names
    -r, --recreate-prs          Recreate PRs if previously closed
    -t, --token <token>         GitHub Auth Token

  Examples:

    $ renovate --token abc123 singapore/lint-condo
    $ renovate --token abc123 -l verbose singapore/lint-condo
    $ renovate --token abc123 singapore/lint-condo singapore/package-test
```

## package.json

If you add configuration options to your `package.json` then these will override any other settings above.
Obviously, you can't set repository or package file location with this method.

```json
"renovate": {
  "labels": [
    "upgrade",
    "bot"
  ]
}
```
