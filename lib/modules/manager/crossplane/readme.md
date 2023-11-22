The `crossplane` manager has no `fileMatch` default patterns, so it won't match any files until you configure it with a pattern.
This is because there is no commonly accepted file/directory naming convention for crossplane YAML files and we don't want to check every single `*.yaml` file in repositories just in case any of them have Crossplane Packages definitions: Configurations, Providers, Functions.

If most `.yaml` files in your repository are Crossplane ones, then you could add this to your config:

```json
{
  "crossplane": {
    "fileMatch": ["\\.yaml$"]
  }
}
```

If instead you have them all inside a `packages/` directory, you would add this:

```json
{
  "crossplane": {
    "fileMatch": ["packages/.+\\.yaml$"]
  }
}
```

Or if it's only a single file then something like this:

```json
{
  "crossplane": {
    "fileMatch": ["^config/provider\\.yaml$"]
  }
}
```

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.

The `crossplane` manager has three `depType`s to allow a fine-grained control of which dependencies are upgraded:

- `configuration`
- `function`
- `provider`
