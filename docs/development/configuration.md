# Configuration

## Configuration Methods

Renovate global config can be defined via any of these methods:

- Configuration file
- Environment variables
- CLI parameters

The above are listed in **_reverse order_** of preference. e.g. CLI values will override environment values if they conflict.

### Default Configuration

The default configuration values can be found in [lib/config/options/index.ts](../../lib/config/options/index.ts).
Options which have `"globalOnly": true` are reserved only for bot global configuration and cannot be configured within repository config files.

### Configuration File

You can override default configuration using a configuration file, with default name `config.js` in the working directory.
If you need an alternate location or name, set it in the environment variable `RENOVATE_CONFIG_FILE`.

**Note:** `RENOVATE_CONFIG_FILE` must be provided with an explicit file extension.
For example `RENOVATE_CONFIG_FILE=myconfig.js` or `RENOVATE_CONFIG_FILE=myconfig.json` and not `RENOVATE_CONFIG_FILE=myconfig`.
If none is provided, or the file type is invalid, Renovate will fail.

Using a configuration file gives you very granular configuration options.
For instance, you can override most settings at the global (file), repository, or package level.
e.g. apply one set of labels for `backend/package.json` and a different set of labels for `frontend/package.json` in the same repository.

```javascript
module.exports = {
  npmrc: '//registry.npmjs.org/:_authToken=abc123',
  baseDir: '/tmp/renovate',
  forkProcessing: 'enabled',
  gradle: { enabled: false },
};
```

### CLI

```
node renovate --help
```

To configure any `<list>` items, separate with commas.
E.g. `renovate --labels=renovate,dependency`.

To enable debug logging export `LOG_LEVEL=debug` to your environment.

### renovate.json

If you add a `renovate.json` file to the root of your repository, you can use this to override default settings.

### package.json

If you add configuration options to your `package.json` then these will override any other settings above.

```json
{
  "renovate": {
    "labels": ["upgrade", "bot"]
  }
}
```

## Configuration Options

Please read [our list of user-facing configuration options](https://docs.renovatebot.com/configuration-options/).

For further options when running your own instance of Renovate, please see the full config options file at `lib/config/options/index.ts`.
